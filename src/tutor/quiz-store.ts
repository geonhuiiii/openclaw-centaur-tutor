import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  QuizDatabase,
  QuizItem,
  ReviewRecord,
  SpacedRepetitionMeta,
  StudySession,
  SparringSession,
  WeeklyReport,
} from "../types";

/**
 * 퀴즈 DB 스토어
 *
 * JSON 파일 기반으로 학습 데이터를 영속적으로 관리합니다.
 * - 퀴즈 항목 CRUD
 * - 복기 기록 추가
 * - 간격 반복 메타데이터 관리
 * - 학습/스파링 세션 기록
 */
export class QuizStore {
  private db: QuizDatabase;
  private filePath: string;

  constructor(dataDir: string) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, "quiz_db.json");
    this.db = this.load();
  }

  // ────────────────────────────────────────
  // 파일 I/O
  // ────────────────────────────────────────

  private load(): QuizDatabase {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        return this.sanitize(parsed);
      }
    } catch (err) {
      console.error("[QuizStore] DB 로드 실패:", err);
    }
    return this.createEmpty();
  }

  private save(): void {
    try {
      this.db.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.filePath, JSON.stringify(this.db, null, 2), "utf-8");
    } catch (err) {
      console.error("[QuizStore] DB 저장 실패:", err);
    }
  }

  private createEmpty(): QuizDatabase {
    return {
      quizzes: [],
      reviews: [],
      spacedRepetition: [],
      sessions: [],
      sparringSessions: [],
      weeklyReports: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /** DB 객체의 모든 배열 필드를 보장 (null/undefined → []) */
  private sanitize(raw: any): QuizDatabase {
    return {
      quizzes: Array.isArray(raw?.quizzes) ? raw.quizzes : [],
      reviews: Array.isArray(raw?.reviews) ? raw.reviews : [],
      spacedRepetition: Array.isArray(raw?.spacedRepetition) ? raw.spacedRepetition : [],
      sessions: Array.isArray(raw?.sessions) ? raw.sessions : [],
      sparringSessions: Array.isArray(raw?.sparringSessions) ? raw.sparringSessions : [],
      weeklyReports: Array.isArray(raw?.weeklyReports) ? raw.weeklyReports : [],
      lastUpdated: raw?.lastUpdated ?? new Date().toISOString(),
    };
  }

  // ────────────────────────────────────────
  // 퀴즈 항목
  // ────────────────────────────────────────

  /** 퀴즈 추가 (여러 개 한 번에) */
  addQuizzes(items: Omit<QuizItem, "id" | "createdAt">[]): QuizItem[] {
    const created: QuizItem[] = items.map((item) => ({
      ...item,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    }));

    this.db.quizzes.push(...created);
    this.save();
    return created;
  }

  /** 퀴즈 단건 추가 */
  addQuiz(item: Omit<QuizItem, "id" | "createdAt">): QuizItem {
    return this.addQuizzes([item])[0];
  }

  /** ID로 퀴즈 조회 */
  getQuiz(id: string): QuizItem | undefined {
    return this.db.quizzes.find((q) => q.id === id);
  }

  /** 태그 기반 퀴즈 검색 */
  findQuizzesByTag(tag: string): QuizItem[] {
    return this.db.quizzes.filter((q) => q.tags.includes(tag));
  }

  /** 주제 기반 퀴즈 검색 */
  findQuizzesByTopic(topic: string): QuizItem[] {
    const lower = topic.toLowerCase();
    return this.db.quizzes.filter((q) => q.topic.toLowerCase().includes(lower));
  }

  /** 전체 퀴즈 목록 */
  getAllQuizzes(): QuizItem[] {
    return [...this.db.quizzes];
  }

  /** 퀴즈 삭제 */
  removeQuiz(id: string): boolean {
    const before = this.db.quizzes.length;
    this.db.quizzes = this.db.quizzes.filter((q) => q.id !== id);
    if (this.db.quizzes.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  // ────────────────────────────────────────
  // 복기 기록
  // ────────────────────────────────────────

  /** 복기 기록 추가 */
  addReview(record: Omit<ReviewRecord, "reviewedAt">): ReviewRecord {
    const full: ReviewRecord = {
      ...record,
      reviewedAt: new Date().toISOString(),
    };
    this.db.reviews.push(full);
    this.save();
    return full;
  }

  /** 특정 퀴즈의 복기 기록 조회 */
  getReviewsForQuiz(quizId: string): ReviewRecord[] {
    const reviews = Array.isArray(this.db.reviews) ? this.db.reviews : [];
    return reviews.filter((r) => r.quizId === quizId);
  }

  /** 최근 N일 내 복기 기록 */
  getRecentReviews(days: number): ReviewRecord[] {
    const reviews = Array.isArray(this.db.reviews) ? this.db.reviews : [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();
    return reviews.filter((r) => r.reviewedAt >= cutoffStr);
  }

  // ────────────────────────────────────────
  // 간격 반복 (Spaced Repetition) 메타
  // ────────────────────────────────────────

  /** SR 메타 조회 또는 생성 */
  getOrCreateSRMeta(quizId: string, firstReviewDate: string): SpacedRepetitionMeta {
    if (!Array.isArray(this.db.spacedRepetition)) this.db.spacedRepetition = [];
    let meta = this.db.spacedRepetition.find((m) => m.quizId === quizId);
    if (!meta) {
      meta = {
        quizId,
        currentStage: 0,
        nextReviewDate: firstReviewDate,
        consecutiveCorrect: 0,
        totalAttempts: 0,
        totalCorrect: 0,
      };
      this.db.spacedRepetition.push(meta);
      this.save();
    }
    return meta;
  }

  /** SR 메타 업데이트 */
  updateSRMeta(quizId: string, updates: Partial<SpacedRepetitionMeta>): void {
    if (!Array.isArray(this.db.spacedRepetition)) this.db.spacedRepetition = [];
    const idx = this.db.spacedRepetition.findIndex((m) => m.quizId === quizId);
    if (idx >= 0) {
      this.db.spacedRepetition[idx] = { ...this.db.spacedRepetition[idx], ...updates };
      this.save();
    }
  }

  /** 오늘 복기 대상인 퀴즈 목록 */
  getDueQuizIds(asOf?: string): string[] {
    const now = asOf ?? new Date().toISOString();
    const sr = Array.isArray(this.db.spacedRepetition) ? this.db.spacedRepetition : [];
    return sr
      .filter((m) => m.nextReviewDate <= now)
      .map((m) => m.quizId);
  }

  /** 전체 SR 메타 */
  getAllSRMetas(): SpacedRepetitionMeta[] {
    const sr = Array.isArray(this.db.spacedRepetition) ? this.db.spacedRepetition : [];
    return [...sr];
  }

  // ────────────────────────────────────────
  // 학습 세션
  // ────────────────────────────────────────

  /** 학습 세션 생성 */
  createSession(session: Omit<StudySession, "id" | "startedAt">): StudySession {
    const full: StudySession = {
      ...session,
      id: uuidv4(),
      startedAt: new Date().toISOString(),
    };
    this.db.sessions.push(full);
    this.save();
    return full;
  }

  /** 최근 세션 조회 */
  getRecentSessions(count: number): StudySession[] {
    return this.db.sessions.slice(-count);
  }

  // ────────────────────────────────────────
  // 스파링 세션
  // ────────────────────────────────────────

  /** 스파링 세션 저장 */
  saveSparringSession(session: SparringSession): void {
    const idx = this.db.sparringSessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      this.db.sparringSessions[idx] = session;
    } else {
      this.db.sparringSessions.push(session);
    }
    this.save();
  }

  /** 최근 스파링 세션 */
  getRecentSparringSessions(count: number): SparringSession[] {
    return this.db.sparringSessions.slice(-count);
  }

  // ────────────────────────────────────────
  // 주간 리포트
  // ────────────────────────────────────────

  /** 주간 리포트 저장 */
  saveWeeklyReport(report: WeeklyReport): void {
    this.db.weeklyReports.push(report);
    this.save();
  }

  /** 최근 주간 리포트 */
  getLatestReport(): WeeklyReport | undefined {
    return this.db.weeklyReports[this.db.weeklyReports.length - 1];
  }

  // ────────────────────────────────────────
  // 통계
  // ────────────────────────────────────────

  /** 전체 통계 요약 */
  getStats(): {
    totalQuizzes: number;
    totalReviews: number;
    totalSessions: number;
    totalSparrings: number;
    overallCorrectRate: number;
  } {
    // 방어적 접근: 배열이 아닌 경우 빈 배열로 대체
    const reviews = Array.isArray(this.db.reviews) ? this.db.reviews : [];
    const quizzes = Array.isArray(this.db.quizzes) ? this.db.quizzes : [];
    const sessions = Array.isArray(this.db.sessions) ? this.db.sessions : [];
    const sparringSessions = Array.isArray(this.db.sparringSessions) ? this.db.sparringSessions : [];

    const totalReviews = reviews.length;
    const correctReviews = reviews.filter((r) => r.result === "pass").length;

    return {
      totalQuizzes: quizzes.length,
      totalReviews,
      totalSessions: sessions.length,
      totalSparrings: sparringSessions.length,
      overallCorrectRate: totalReviews > 0 ? (correctReviews / totalReviews) * 100 : 0,
    };
  }
}
