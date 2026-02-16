import "dotenv/config";
import { CronJob } from "cron";
import { CentaurTutor } from "./tutor/core";
import { PluginConfig, UserLevel } from "./types";

/**
 * OpenClaw 켄타우로스 학습 코치 스킬 — 진입점
 *
 * 바둑/체스의 AI 복기 시스템을 학문에 적용한 4단계 학습 자동화:
 *   1. Ingest  → /study 명령으로 학습 노트 등록 → Q&A 자동 추출
 *   2. Spar    → /spar 명령으로 AI 압박 면접관 스파링
 *   3. Review  → Cron 스케줄로 에빙하우스 망각곡선 기반 자동 복기
 *   4. Report  → 주간 약점 리포트 자동 생성
 */

// ────────────────────────────────────────────
// 설정 로드
// ────────────────────────────────────────────

function loadConfig(): PluginConfig {
  return {
    channel: process.env.OPENCLAW_CHANNEL ?? "",
    timezone: process.env.TZ ?? "Asia/Seoul",
    studyLogsDir: process.env.STUDY_LOGS_DIR ?? "./study_logs",
    dataDir: process.env.DATA_DIR ?? "./data",
    userLevel: (process.env.USER_LEVEL as UserLevel) ?? "intermediate",
    language: process.env.LANGUAGE ?? "ko",
    reviewSchedule: {
      intervals: process.env.REVIEW_INTERVALS
        ? JSON.parse(process.env.REVIEW_INTERVALS)
        : [1, 3, 7, 14, 30],
      morningCron: process.env.MORNING_CRON ?? "0 8 * * *",
      eveningCron: process.env.EVENING_CRON ?? "0 21 * * *",
      weeklyReportCron: process.env.WEEKLY_REPORT_CRON ?? "0 10 * * 0",
    },
  };
}

// ────────────────────────────────────────────
// 스킬 초기화
// ────────────────────────────────────────────

let tutor: CentaurTutor;
let cronJobs: CronJob[] = [];

/** 스킬 초기화 — OpenClaw에서 플러그인 로드 시 호출 */
export async function initialize(config?: Partial<PluginConfig>): Promise<CentaurTutor> {
  const fullConfig = { ...loadConfig(), ...config };
  tutor = new CentaurTutor(fullConfig);

  // Cron 작업 등록
  registerCronJobs(fullConfig);

  console.log("[CentaurTutor] 초기화 완료");
  console.log(`  채널: ${fullConfig.channel}`);
  console.log(`  타임존: ${fullConfig.timezone}`);
  console.log(`  학습자 수준: ${fullConfig.userLevel}`);
  console.log(`  복기 간격: ${fullConfig.reviewSchedule.intervals.join(", ")}일`);
  console.log(`  아침 복기: ${fullConfig.reviewSchedule.morningCron}`);
  console.log(`  저녁 복기: ${fullConfig.reviewSchedule.eveningCron}`);
  console.log(`  주간 리포트: ${fullConfig.reviewSchedule.weeklyReportCron}`);

  return tutor;
}

// ────────────────────────────────────────────
// Cron 스케줄러
// ────────────────────────────────────────────

function registerCronJobs(config: PluginConfig): void {
  // 기존 작업 정리
  for (const job of cronJobs) {
    job.stop();
  }
  cronJobs = [];

  const tz = config.timezone;

  // 1) 아침 복기 (기본: 매일 08:00)
  const morningJob = new CronJob(
    config.reviewSchedule.morningCron,
    async () => {
      console.log(`[Cron] 아침 복기 실행 (${new Date().toISOString()})`);
      try {
        await tutor.handleDailyReview();
      } catch (err) {
        console.error("[Cron] 아침 복기 실패:", err);
      }
    },
    null,
    true,
    tz
  );
  cronJobs.push(morningJob);

  // 2) 저녁 복기 (기본: 매일 21:00)
  const eveningJob = new CronJob(
    config.reviewSchedule.eveningCron,
    async () => {
      console.log(`[Cron] 저녁 복기 실행 (${new Date().toISOString()})`);
      try {
        await tutor.handleEveningReview();
      } catch (err) {
        console.error("[Cron] 저녁 복기 실패:", err);
      }
    },
    null,
    true,
    tz
  );
  cronJobs.push(eveningJob);

  // 3) 주간 리포트 (기본: 매주 일요일 10:00)
  const weeklyJob = new CronJob(
    config.reviewSchedule.weeklyReportCron,
    async () => {
      console.log(`[Cron] 주간 리포트 실행 (${new Date().toISOString()})`);
      try {
        await tutor.handleWeeklyReport();
      } catch (err) {
        console.error("[Cron] 주간 리포트 실패:", err);
      }
    },
    null,
    true,
    tz
  );
  cronJobs.push(weeklyJob);

  console.log(`[Cron] ${cronJobs.length}개의 스케줄 작업 등록 완료`);
}

// ────────────────────────────────────────────
// 명령 핸들러
// ────────────────────────────────────────────

/**
 * /study — 학습 내용 입력
 * @param text 학습 노트 텍스트
 * @param topic 주제 (선택)
 */
export async function handleStudy(
  text: string,
  topic?: string
): Promise<string> {
  if (!tutor) await initialize();

  try {
    const result = await tutor.ingestStudyNote(text, topic);
    return result.message;
  } catch (err) {
    return `❌ 학습 내용 등록 실패: ${err}`;
  }
}

/**
 * /study (파일 기반)
 * @param filePath 학습 노트 파일 경로
 */
export async function handleStudyFromFile(filePath: string): Promise<string> {
  if (!tutor) await initialize();

  try {
    const result = await tutor.ingestFromFile(filePath);
    return result.message;
  } catch (err) {
    return `❌ 파일 학습 실패: ${err}`;
  }
}

/**
 * /spar — 가상 스파링 시작
 * @param topic 스파링 주제
 */
export async function handleSpar(topic: string): Promise<string> {
  if (!tutor) await initialize();

  try {
    const { firstChallenge, systemPrompt } = tutor.startSparring(topic);
    // systemPrompt는 OpenClaw LLM에 전달되고,
    // firstChallenge는 사용자에게 바로 보여짐
    return firstChallenge;
  } catch (err) {
    return `❌ 스파링 시작 실패: ${err}`;
  }
}

/**
 * /quiz — 즉시 퀴즈
 */
export async function handleQuiz(): Promise<string> {
  if (!tutor) await initialize();

  try {
    return await tutor.handleQuizCommand();
  } catch (err) {
    return `❌ 퀴즈 로드 실패: ${err}`;
  }
}

/**
 * /report — 학습 현황 리포트
 */
export async function handleReport(): Promise<string> {
  if (!tutor) await initialize();

  try {
    return tutor.getStatusReport();
  } catch (err) {
    return `❌ 리포트 생성 실패: ${err}`;
  }
}

/**
 * /level — 학습 수준 확인/조정
 */
export async function handleLevel(newLevel?: string): Promise<string> {
  if (!tutor) await initialize();

  if (newLevel) {
    const validLevels = ["beginner", "intermediate", "advanced", "expert"];
    if (!validLevels.includes(newLevel)) {
      return `❌ 올바른 수준을 입력하세요: ${validLevels.join(", ")}`;
    }
    return `✅ 학습 수준이 "${newLevel}"로 변경되었습니다.`;
  }

  return tutor.getLevelInfo();
}

/**
 * 스케줄 트리거 핸들러 (skill.yaml의 cron과 매핑)
 */
export async function handleDailyReview(): Promise<void> {
  if (!tutor) await initialize();
  await tutor.handleDailyReview();
}

export async function handleEveningReview(): Promise<void> {
  if (!tutor) await initialize();
  await tutor.handleEveningReview();
}

export async function handleWeeklyReport(): Promise<void> {
  if (!tutor) await initialize();
  await tutor.handleWeeklyReport();
}

// ────────────────────────────────────────────
// Graceful Shutdown
// ────────────────────────────────────────────

export function shutdown(): void {
  for (const job of cronJobs) {
    job.stop();
  }
  cronJobs = [];
  console.log("[CentaurTutor] 종료됨");
}

// ────────────────────────────────────────────
// CLI 직접 실행 지원
// ────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    await initialize();

    switch (command) {
      case "study": {
        const text = args.slice(1).join(" ");
        if (!text) {
          console.log("사용법: npx ts-node src/index.ts study <학습 내용>");
          process.exit(1);
        }
        console.log(await handleStudy(text));
        break;
      }
      case "spar": {
        const topic = args.slice(1).join(" ") || "일반";
        console.log(await handleSpar(topic));
        break;
      }
      case "quiz":
        console.log(await handleQuiz());
        break;
      case "report":
        console.log(await handleReport());
        break;
      case "level":
        console.log(await handleLevel(args[1]));
        break;
      case "serve":
        console.log("🚀 켄타우로스 학습 코치가 실행 중입니다...");
        console.log("   Cron 스케줄이 활성화되었습니다.");
        console.log("   종료하려면 Ctrl+C를 누르세요.\n");
        // 프로세스를 유지 (Cron이 백그라운드에서 실행)
        process.on("SIGINT", () => {
          shutdown();
          process.exit(0);
        });
        process.on("SIGTERM", () => {
          shutdown();
          process.exit(0);
        });
        break;
      default:
        console.log(`
🎓 켄타우로스 학습 코치 (Centaur Tutor)

사용법:
  npx ts-node src/index.ts <command> [args]

명령어:
  study <text>    학습 내용 등록
  spar <topic>    가상 스파링 시작
  quiz            즉시 복기 퀴즈
  report          학습 현황 리포트
  level [level]   학습 수준 확인/변경
  serve           Cron 스케줄러 실행 (데몬 모드)
        `);
    }

    // serve 모드가 아니면 종료
    if (command !== "serve") {
      shutdown();
    }
  })();
}
