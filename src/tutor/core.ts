import * as fs from "fs";
import * as path from "path";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { QuizStore } from "./quiz-store";
import { SpacedRepetitionEngine } from "./spaced-repetition";
import { OpenClawGateway } from "../messaging/gateway";
import * as prompts from "./prompts";
import {
  PluginConfig,
  QuizItem,
  StudySession,
  SparringSession,
  SparringRound,
  WeeklyReport,
  WeaknessItem,
} from "../types";

/**
 * 켄타우로스 학습 튜터 — 코어 엔진
 *
 * 바둑의 AI 복기 시스템처럼, 4단계 학습 사이클을 자동화합니다:
 * 1. Ingest  — 지식 '기보' 적재
 * 2. Spar    — 가상 스파링 (Adversarial Training)
 * 3. Review  — 자동 복기 (Spaced Repetition + Cron)
 * 4. Report  — 주간 약점 분석 (Meta-Analysis)
 */
export class CentaurTutor {
  private store: QuizStore;
  private srEngine: SpacedRepetitionEngine;
  private gateway: OpenClawGateway;
  private config: PluginConfig;

  constructor(config: PluginConfig) {
    this.config = config;
    this.store = new QuizStore(config.dataDir);
    this.srEngine = new SpacedRepetitionEngine(this.store, config.reviewSchedule);
    this.gateway = new OpenClawGateway();
  }

  // ════════════════════════════════════════════
  // 1단계: 지식 적재 (Ingest)
  // ════════════════════════════════════════════

  /**
   * /study 명령 핸들러
   *
   * 학습 노트 텍스트를 받아 Q&A를 추출하고 DB에 저장합니다.
   * 추출된 Q&A는 자동으로 간격 반복 스케줄에 등록됩니다.
   */
  async ingestStudyNote(text: string, topic?: string): Promise<{
    session: StudySession;
    quizzes: QuizItem[];
    message: string;
  }> {
    // 1) Q&A 추출 프롬프트 생성 (실제 LLM 호출은 OpenClaw가 처리)
    const ingestPrompt = prompts.getIngestPrompt(this.config.userLevel);

    // 2) 여기서는 텍스트에서 수동으로 Q&A를 파싱하는 간단한 로직을 제공
    //    실제 배포 시에는 OpenClaw의 LLM을 통해 추출
    const quizzes = this.store.addQuizzes([
      {
        topic: topic ?? "학습 노트",
        question: `"${(topic ?? text).substring(0, 50)}..."에 대한 핵심 개념을 설명하세요.`,
        expectedAnswer: text.substring(0, 200),
        difficulty: this.getLevelDifficulty(),
        tags: [topic ?? "general", dayjs().format("YYYY-MM-DD")],
        sourceFile: undefined,
      },
    ]);

    // 3) SR 스케줄 등록
    this.srEngine.initializeForQuizzes(quizzes.map((q) => q.id));

    // 4) 학습 세션 기록
    const session = this.store.createSession({
      topic: topic ?? "학습 노트",
      summary: text.substring(0, 500),
      quizIds: quizzes.map((q) => q.id),
      method: "ingest",
    });

    const message = [
      `📚 학습 내용이 등록되었습니다!`,
      ``,
      `📝 주제: ${topic ?? "학습 노트"}`,
      `❓ 생성된 퀴즈: ${quizzes.length}개`,
      `⏰ 첫 복기 예정: ${dayjs().add(1, "day").format("MM/DD (ddd) HH:mm")}`,
      ``,
      `💡 /spar ${topic ?? ""} 명령으로 바로 스파링을 시작할 수 있어요!`,
    ].join("\n");

    return { session, quizzes, message };
  }

  /**
   * 학습 노트 파일에서 적재
   */
  async ingestFromFile(filePath: string): Promise<{
    session: StudySession;
    quizzes: QuizItem[];
    message: string;
  }> {
    const fullPath = path.resolve(this.config.studyLogsDir, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const topic = path.basename(filePath, path.extname(filePath));
    return this.ingestStudyNote(content, topic);
  }

  /**
   * LLM으로 추출된 Q&A JSON을 직접 등록
   * (OpenClaw LLM이 JSON을 반환한 후 호출)
   */
  async registerExtractedQuizzes(
    quizData: Array<{
      topic: string;
      question: string;
      expectedAnswer: string;
      difficulty: number;
      tags: string[];
    }>,
    sessionTopic: string
  ): Promise<{ quizzes: QuizItem[]; message: string }> {
    const quizzes = this.store.addQuizzes(
      quizData.map((q) => ({
        ...q,
        sourceFile: undefined,
      }))
    );

    this.srEngine.initializeForQuizzes(quizzes.map((q) => q.id));

    this.store.createSession({
      topic: sessionTopic,
      summary: `${quizzes.length}개의 Q&A 등록`,
      quizIds: quizzes.map((q) => q.id),
      method: "ingest",
    });

    const message = [
      `✅ ${quizzes.length}개의 Q&A가 등록되었습니다!`,
      ``,
      ...quizzes.map(
        (q, i) => `  ${i + 1}. [${q.topic}] ${q.question.substring(0, 60)}...`
      ),
      ``,
      `⏰ 내일 아침 8시에 첫 복기 질문이 전송됩니다.`,
    ].join("\n");

    return { quizzes, message };
  }

  // ════════════════════════════════════════════
  // 2단계: 가상 스파링 (Adversarial Training)
  // ════════════════════════════════════════════

  /**
   * /spar 명령 핸들러
   *
   * 스파링 세션을 시작합니다.
   * 반환된 프롬프트를 OpenClaw LLM에 전달하여 실행합니다.
   */
  startSparring(topic: string): {
    session: SparringSession;
    systemPrompt: string;
    firstChallenge: string;
  } {
    const session: SparringSession = {
      id: uuidv4(),
      topic,
      startedAt: new Date().toISOString(),
      rounds: [],
    };

    const systemPrompt = prompts.getSparringPrompt(topic, this.config.userLevel);

    const firstChallenge = `🥊 가상 스파링을 시작합니다!\n\n주제: "${topic}"\n\n자, 이 주제에 대해 설명해보세요. 당신의 설명에서 약점을 찾아내겠습니다.`;

    this.store.saveSparringSession(session);

    return { session, systemPrompt, firstChallenge };
  }

  /**
   * 스파링 라운드 기록
   */
  recordSparringRound(
    sessionId: string,
    round: SparringRound
  ): void {
    const sessions = this.store.getRecentSparringSessions(100);
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      session.rounds.push(round);
      this.store.saveSparringSession(session);
    }
  }

  // ════════════════════════════════════════════
  // 3단계: 자동 복기 (Cron 트리거)
  // ════════════════════════════════════════════

  /**
   * 아침 복기 핸들러 (cron: 매일 08:00)
   *
   * 에빙하우스 망각곡선에 따라 오늘 복기 대상인 퀴즈를 찾아
   * 메시지를 전송합니다.
   */
  async handleDailyReview(): Promise<string> {
    const dueQuizzes = this.srEngine.getDueQuizzes();

    if (dueQuizzes.length === 0) {
      const msg = "☀️ 좋은 아침! 오늘은 복기 대상이 없어요. 새로운 것을 배워볼까요? /study";
      await this.gateway.sendMessage(this.config.channel, msg);
      return msg;
    }

    // 첫 번째 복기 대상 퀴즈의 질문 생성
    const firstQuiz = dueQuizzes[0];
    const question = this.srEngine.generateReviewQuestion(firstQuiz);

    const meta = this.store.getOrCreateSRMeta(
      firstQuiz.id,
      new Date().toISOString()
    );

    await this.gateway.sendReviewQuestion(this.config.channel, question, {
      stage: meta.currentStage,
      topic: firstQuiz.topic,
      dueCount: dueQuizzes.length,
    });

    return question;
  }

  /**
   * 저녁 복기 핸들러 (cron: 매일 21:00)
   *
   * 오늘 학습한 내용을 요약하고, 간단한 복기 질문을 던집니다.
   */
  async handleEveningReview(): Promise<string> {
    const today = dayjs().startOf("day").toISOString();
    const todaySessions = this.store
      .getRecentSessions(50)
      .filter((s) => s.startedAt >= today);

    const todayTopics = todaySessions.map((s) => s.topic);
    const todayQuizCount = todaySessions.reduce(
      (sum, s) => sum + s.quizIds.length,
      0
    );

    const message = prompts.getEveningReviewPrompt(todayTopics, todayQuizCount);
    await this.gateway.sendEveningReview(this.config.channel, message);
    return message;
  }

  /**
   * 복기 답변 처리
   *
   * 사용자의 답변을 평가하고, SR 스케줄을 업데이트합니다.
   */
  processReviewAnswer(
    quizId: string,
    userAnswer: string,
    isCorrect: boolean,
    feedback?: string
  ): {
    updatedMeta: ReturnType<SpacedRepetitionEngine["processReviewResult"]>;
    message: string;
  } {
    // 복기 기록 저장
    this.store.addReview({
      quizId,
      userAnswer,
      result: isCorrect ? "pass" : "fail",
      feedback,
    });

    // SR 스케줄 업데이트
    const updatedMeta = this.srEngine.processReviewResult(quizId, isCorrect);
    const quiz = this.store.getQuiz(quizId);

    const nextDate = dayjs(updatedMeta.nextReviewDate).format("MM/DD (ddd)");

    let message: string;
    if (isCorrect) {
      message = [
        `✅ 정답! 잘 기억하고 있네요.`,
        ``,
        `📊 연속 정답: ${updatedMeta.consecutiveCorrect}회`,
        `📅 다음 복기: ${nextDate}`,
        feedback ? `\n💡 ${feedback}` : "",
      ].join("\n");
    } else {
      message = [
        `❌ 아쉽지만 틀렸어요.`,
        ``,
        `📖 정답: ${quiz?.expectedAnswer ?? "(정보 없음)"}`,
        `📅 다음 복기: ${nextDate} (한 단계 뒤로)`,
        feedback ? `\n💡 ${feedback}` : "",
      ].join("\n");
    }

    return { updatedMeta, message };
  }

  // ════════════════════════════════════════════
  // 4단계: 주간 리포트 (Meta-Analysis)
  // ════════════════════════════════════════════

  /**
   * 주간 리포트 핸들러 (cron: 매주 일요일 10:00)
   */
  async handleWeeklyReport(): Promise<string> {
    const report = this.generateWeeklyReport();
    this.store.saveWeeklyReport(report);

    // 리포트 프롬프트 생성 (LLM용)
    const recentReviews = this.store.getRecentReviews(7);
    const failedQuizIds = recentReviews
      .filter((r) => r.result === "fail")
      .map((r) => r.quizId);
    const passedQuizIds = recentReviews
      .filter((r) => r.result === "pass")
      .map((r) => r.quizId);

    const failedTopics = [
      ...new Set(
        failedQuizIds
          .map((id) => this.store.getQuiz(id)?.topic)
          .filter((t): t is string => t !== undefined)
      ),
    ];
    const strongTopics = [
      ...new Set(
        passedQuizIds
          .map((id) => this.store.getQuiz(id)?.topic)
          .filter((t): t is string => t !== undefined)
      ),
    ];

    const reportPrompt = prompts.getWeeklyReportPrompt({
      totalReviews: report.totalReviews,
      correctRate: report.correctRate,
      topicsStudied: report.topicsStudied,
      failedTopics,
      strongTopics,
    });

    // 간단한 텍스트 리포트도 직접 전송
    const summaryMessage = this.formatWeeklyReportSummary(report);
    await this.gateway.sendWeeklyReport(this.config.channel, summaryMessage);

    return reportPrompt;
  }

  /**
   * 주간 리포트 데이터 생성
   */
  private generateWeeklyReport(): WeeklyReport {
    const now = dayjs();
    const weekAgo = now.subtract(7, "day");

    const recentReviews = this.store.getRecentReviews(7);
    const totalReviews = recentReviews.length;
    const correctCount = recentReviews.filter((r) => r.result === "pass").length;
    const correctRate = totalReviews > 0 ? (correctCount / totalReviews) * 100 : 0;

    // 이번 주 학습한 주제
    const recentSessions = this.store
      .getRecentSessions(100)
      .filter((s) => s.startedAt >= weekAgo.toISOString());
    const topicsStudied = new Set(recentSessions.map((s) => s.topic)).size;

    // 약점 분석
    const failureMap = new Map<string, number>();
    for (const review of recentReviews) {
      if (review.result === "fail") {
        failureMap.set(
          review.quizId,
          (failureMap.get(review.quizId) ?? 0) + 1
        );
      }
    }

    const topWeaknesses: WeaknessItem[] = Array.from(failureMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([quizId, failCount]) => {
        const quiz = this.store.getQuiz(quizId);
        return {
          quizId,
          topic: quiz?.topic ?? "알 수 없음",
          failCount,
          suggestion: `"${quiz?.topic ?? ""}" 주제를 다시 학습하고 /spar 로 스파링해보세요.`,
        };
      });

    return {
      periodStart: weekAgo.toISOString(),
      periodEnd: now.toISOString(),
      generatedAt: now.toISOString(),
      totalReviews,
      correctRate,
      topicsStudied,
      topWeaknesses,
      recommendations: this.generateRecommendations(
        correctRate,
        topWeaknesses,
        topicsStudied
      ),
    };
  }

  /**
   * 학습 제안 생성
   */
  private generateRecommendations(
    correctRate: number,
    weaknesses: WeaknessItem[],
    topicsStudied: number
  ): string[] {
    const recs: string[] = [];

    if (correctRate < 50) {
      recs.push(
        "정답률이 50% 미만입니다. 기초 개념을 다시 복습하고, 난이도를 한 단계 낮춰보세요. (/level beginner)"
      );
    } else if (correctRate < 75) {
      recs.push(
        "정답률이 양호합니다. 약점 주제에 집중하여 스파링을 진행해보세요."
      );
    } else {
      recs.push(
        "정답률이 우수합니다! 난이도를 높여 더 깊은 질문에 도전해보세요. (/level advanced)"
      );
    }

    if (weaknesses.length > 0) {
      recs.push(
        `취약 주제 "${weaknesses[0].topic}"에 대해 /spar 스파링을 추천합니다.`
      );
    }

    if (topicsStudied < 3) {
      recs.push("이번 주 학습량이 적습니다. 하루에 하나의 개념이라도 /study 해보세요.");
    }

    return recs;
  }

  /**
   * 주간 리포트 요약 포매팅
   */
  private formatWeeklyReportSummary(report: WeeklyReport): string {
    const lines = [
      `📅 기간: ${dayjs(report.periodStart).format("MM/DD")} ~ ${dayjs(report.periodEnd).format("MM/DD")}`,
      ``,
      `📊 이번 주 통계:`,
      `  • 복기 횟수: ${report.totalReviews}회`,
      `  • 정답률: ${report.correctRate.toFixed(1)}%`,
      `  • 학습 주제: ${report.topicsStudied}개`,
      ``,
    ];

    if (report.topWeaknesses.length > 0) {
      lines.push(`❌ 취약 영역:`);
      for (const w of report.topWeaknesses) {
        lines.push(`  • ${w.topic} (오답 ${w.failCount}회)`);
      }
      lines.push(``);
    }

    if (report.recommendations.length > 0) {
      lines.push(`💡 추천:`);
      for (const rec of report.recommendations) {
        lines.push(`  • ${rec}`);
      }
    }

    return lines.join("\n");
  }

  // ════════════════════════════════════════════
  // 유틸리티
  // ════════════════════════════════════════════

  /**
   * /quiz 명령 핸들러 — 즉시 퀴즈
   */
  async handleQuizCommand(): Promise<string> {
    const dueQuizzes = this.srEngine.getDueQuizzes();

    if (dueQuizzes.length === 0) {
      return "✅ 현재 복기 대상이 없습니다. 새로운 것을 배워볼까요? /study";
    }

    const quiz = dueQuizzes[0];
    const question = this.srEngine.generateReviewQuestion(quiz);

    return `${question}\n\n(퀴즈 ID: ${quiz.id})`;
  }

  /**
   * /report 명령 핸들러 — 즉시 리포트
   */
  getStatusReport(): string {
    const stats = this.store.getStats();
    const srSummary = this.srEngine.getSummary();

    return [
      `📈 학습 현황 대시보드`,
      `${"─".repeat(25)}`,
      ``,
      `📚 전체 퀴즈: ${stats.totalQuizzes}개`,
      `📝 복기 횟수: ${stats.totalReviews}회`,
      `✅ 전체 정답률: ${stats.overallCorrectRate.toFixed(1)}%`,
      ``,
      `⏰ 오늘 복기 대상: ${srSummary.dueToday}개`,
      `🏆 마스터한 퀴즈: ${srSummary.mastered}개`,
      `⚠️ 고전 중인 퀴즈: ${srSummary.struggling}개`,
      ``,
      `🥊 스파링 세션: ${stats.totalSparrings}회`,
      `📖 학습 세션: ${stats.totalSessions}회`,
      ``,
      `현재 수준: ${this.config.userLevel}`,
    ].join("\n");
  }

  /**
   * /level 명령 핸들러 — 수준 확인/조정
   */
  getLevelInfo(): string {
    const srSummary = this.srEngine.getSummary();

    let recommendation: string;
    if (srSummary.averageCorrectRate > 85) {
      recommendation = "🚀 정답률이 높습니다! 난이도를 높여보세요.";
    } else if (srSummary.averageCorrectRate > 60) {
      recommendation = "👍 적절한 수준입니다. 현재 난이도를 유지하세요.";
    } else {
      recommendation = "📖 정답률이 낮습니다. 난이도를 낮추는 것을 권장합니다.";
    }

    return [
      `🎯 학습 수준 정보`,
      ``,
      `현재 수준: ${this.config.userLevel}`,
      `평균 정답률: ${srSummary.averageCorrectRate.toFixed(1)}%`,
      ``,
      recommendation,
      ``,
      `수준 변경: /level [beginner|intermediate|advanced|expert]`,
    ].join("\n");
  }

  /**
   * 수준에 따른 기본 난이도
   */
  private getLevelDifficulty(): number {
    const map = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
    return map[this.config.userLevel] ?? 2;
  }

  /**
   * 프롬프트 내보내기 (OpenClaw LLM 호출용)
   */
  getPrompts() {
    return prompts;
  }
}
