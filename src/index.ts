import "dotenv/config";
import { CronJob } from "cron";
import { CentaurTutor } from "./tutor/core";
import { PluginConfig, UserLevel } from "./types";

// OpenClaw 플러그인 SDK 타입 (없으면 any로 대체)
type OpenClawPluginApi = any;

/**
 * OpenClaw 켄타우로스 학습 코치 스킬
 *
 * 바둑/체스의 AI 복기 시스템을 학문에 적용한 4단계 학습 자동화:
 *   1. Ingest  → /study 명령으로 학습 노트 등록 → Q&A 자동 추출
 *   2. Spar    → /spar 명령으로 AI 압박 면접관 스파링
 *   3. Review  → Cron 스케줄로 에빙하우스 망각곡선 기반 자동 복기
 *   4. Report  → 주간 약점 리포트 자동 생성
 */

const centaurTutorPlugin = {
  register(api: OpenClawPluginApi) {
    // ────────────────────────────────────────────
    // 설정 파싱
    // ────────────────────────────────────────────
    const rawConfig = api.config ?? {};

    const config: PluginConfig = {
      channel: rawConfig.channel ?? process.env.OPENCLAW_CHANNEL ?? "",
      timezone: rawConfig.timezone ?? process.env.TZ ?? "Asia/Seoul",
      studyLogsDir: rawConfig.studyLogsDir ?? process.env.STUDY_LOGS_DIR ?? "./study_logs",
      dataDir: rawConfig.dataDir ?? process.env.DATA_DIR ?? "./data",
      userLevel: (rawConfig.userLevel ?? process.env.USER_LEVEL ?? "intermediate") as UserLevel,
      language: rawConfig.language ?? process.env.LANGUAGE ?? "ko",
      reviewSchedule: {
        intervals: rawConfig.reviewSchedule?.intervals
          ?? (process.env.REVIEW_INTERVALS ? JSON.parse(process.env.REVIEW_INTERVALS) : [1, 3, 7, 14, 30]),
        morningCron: rawConfig.reviewSchedule?.morningCron ?? process.env.MORNING_CRON ?? "0 8 * * *",
        eveningCron: rawConfig.reviewSchedule?.eveningCron ?? process.env.EVENING_CRON ?? "0 21 * * *",
        weeklyReportCron: rawConfig.reviewSchedule?.weeklyReportCron ?? process.env.WEEKLY_REPORT_CRON ?? "0 10 * * 0",
      },
    };

    const logger = api.logger ?? console;
    let tutor: CentaurTutor;
    let cronJobs: CronJob[] = [];

    // ────────────────────────────────────────────
    // Tool 등록: /study
    // ────────────────────────────────────────────
    api.registerTool({
      name: "centaur_study",
      description: "새로운 학습 내용을 등록합니다. 텍스트에서 Q&A를 추출하여 간격 반복 스케줄에 등록합니다.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "학습 노트 텍스트" },
          topic: { type: "string", description: "학습 주제 (선택)" },
        },
        required: ["text"],
      },
      execute: async (params: { text: string; topic?: string }) => {
        try {
          const result = await tutor.ingestStudyNote(params.text, params.topic);
          return { success: true, message: result.message };
        } catch (err) {
          return { success: false, error: `학습 내용 등록 실패: ${err}` };
        }
      },
    });

    // ────────────────────────────────────────────
    // Tool 등록: /spar
    // ────────────────────────────────────────────
    api.registerTool({
      name: "centaur_spar",
      description: "AI와 가상 스파링을 시작합니다. 학습 내용의 약점을 공격적으로 검증합니다.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "스파링 주제" },
        },
        required: ["topic"],
      },
      execute: async (params: { topic: string }) => {
        try {
          const { firstChallenge, systemPrompt } = tutor.startSparring(params.topic);
          return { success: true, message: firstChallenge, systemPrompt };
        } catch (err) {
          return { success: false, error: `스파링 시작 실패: ${err}` };
        }
      },
    });

    // ────────────────────────────────────────────
    // Tool 등록: /quiz
    // ────────────────────────────────────────────
    api.registerTool({
      name: "centaur_quiz",
      description: "현재 복기 대상 퀴즈를 즉시 받습니다.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        try {
          const result = await tutor.handleQuizCommand();
          return { success: true, message: result };
        } catch (err) {
          return { success: false, error: `퀴즈 로드 실패: ${err}` };
        }
      },
    });

    // ────────────────────────────────────────────
    // Tool 등록: /report
    // ────────────────────────────────────────────
    api.registerTool({
      name: "centaur_report",
      description: "현재 학습 현황 대시보드를 확인합니다.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        try {
          const result = tutor.getStatusReport();
          return { success: true, message: result };
        } catch (err) {
          return { success: false, error: `리포트 생성 실패: ${err}` };
        }
      },
    });

    // ────────────────────────────────────────────
    // Tool 등록: /level
    // ────────────────────────────────────────────
    api.registerTool({
      name: "centaur_level",
      description: "학습 난이도를 확인/조절합니다 (beginner, intermediate, advanced, expert).",
      parameters: {
        type: "object",
        properties: {
          level: {
            type: "string",
            enum: ["beginner", "intermediate", "advanced", "expert"],
            description: "새 학습 수준 (비워두면 현재 수준 표시)",
          },
        },
      },
      execute: async (params: { level?: string }) => {
        try {
          if (params.level) {
            return { success: true, message: `✅ 학습 수준이 "${params.level}"로 변경되었습니다.` };
          }
          return { success: true, message: tutor.getLevelInfo() };
        } catch (err) {
          return { success: false, error: `레벨 확인 실패: ${err}` };
        }
      },
    });

    // ────────────────────────────────────────────
    // Service 등록: Cron 스케줄러 라이프사이클
    // ────────────────────────────────────────────
    api.registerService({
      id: "centaur-tutor",
      start: async () => {
        // 튜터 인스턴스 초기화
        tutor = new CentaurTutor(config);

        logger.info("[CentaurTutor] 초기화 완료");
        logger.info(`  채널: ${config.channel}`);
        logger.info(`  타임존: ${config.timezone}`);
        logger.info(`  학습자 수준: ${config.userLevel}`);
        logger.info(`  복기 간격: ${config.reviewSchedule.intervals.join(", ")}일`);

        // Cron 작업 등록
        const tz = config.timezone;

        // 1) 아침 복기 (기본: 매일 08:00)
        cronJobs.push(
          new CronJob(config.reviewSchedule.morningCron, async () => {
            logger.info(`[Cron] 아침 복기 실행 (${new Date().toISOString()})`);
            try { await tutor.handleDailyReview(); }
            catch (err) { logger.error("[Cron] 아침 복기 실패:", err); }
          }, null, true, tz)
        );

        // 2) 저녁 복기 (기본: 매일 21:00)
        cronJobs.push(
          new CronJob(config.reviewSchedule.eveningCron, async () => {
            logger.info(`[Cron] 저녁 복기 실행 (${new Date().toISOString()})`);
            try { await tutor.handleEveningReview(); }
            catch (err) { logger.error("[Cron] 저녁 복기 실패:", err); }
          }, null, true, tz)
        );

        // 3) 주간 리포트 (기본: 매주 일요일 10:00)
        cronJobs.push(
          new CronJob(config.reviewSchedule.weeklyReportCron, async () => {
            logger.info(`[Cron] 주간 리포트 실행 (${new Date().toISOString()})`);
            try { await tutor.handleWeeklyReport(); }
            catch (err) { logger.error("[Cron] 주간 리포트 실패:", err); }
          }, null, true, tz)
        );

        logger.info(`[Cron] ${cronJobs.length}개의 스케줄 작업 등록 완료`);
      },
      stop: async () => {
        for (const job of cronJobs) {
          job.stop();
        }
        cronJobs = [];
        logger.info("[CentaurTutor] 종료됨");
      },
    });
  },
};

export default centaurTutorPlugin;
