/**
 * 켄타우로스 학습 코치 — 타입 정의
 */

// ────────────────────────────────────────────
// 학습자 수준 (ELO 기반)
// ────────────────────────────────────────────

/** 학습자 수준 단계 */
export type UserLevel = "beginner" | "intermediate" | "advanced" | "expert";

/** 학습자 ELO 점수 범위 */
export interface EloRange {
  min: number;
  max: number;
  label: UserLevel;
  description: string;
}

// ────────────────────────────────────────────
// 퀴즈 & Q&A
// ────────────────────────────────────────────

/** 퀴즈 항목 */
export interface QuizItem {
  /** 고유 ID */
  id: string;
  /** 학습 주제 */
  topic: string;
  /** 질문 */
  question: string;
  /** 기대 답변 (키워드/핵심) */
  expectedAnswer: string;
  /** 난이도 (1~5) */
  difficulty: number;
  /** 관련 태그 */
  tags: string[];
  /** 생성 일시 (ISO 8601) */
  createdAt: string;
  /** 원본 학습 노트 파일 경로 */
  sourceFile?: string;
}

/** 복기 기록 */
export interface ReviewRecord {
  /** 퀴즈 ID */
  quizId: string;
  /** 복기 일시 (ISO 8601) */
  reviewedAt: string;
  /** 사용자 답변 */
  userAnswer?: string;
  /** 결과: pass=정답, fail=오답, skip=건너뜀 */
  result: "pass" | "fail" | "skip";
  /** AI 피드백 */
  feedback?: string;
}

/** 간격 반복 메타데이터 (퀴즈별 상태) */
export interface SpacedRepetitionMeta {
  /** 퀴즈 ID */
  quizId: string;
  /** 현재 반복 단계 인덱스 (intervals 배열에서의 위치) */
  currentStage: number;
  /** 다음 복기 예정일 (ISO 8601) */
  nextReviewDate: string;
  /** 연속 정답 횟수 */
  consecutiveCorrect: number;
  /** 총 시도 횟수 */
  totalAttempts: number;
  /** 총 정답 횟수 */
  totalCorrect: number;
  /** 마지막 복기 일시 */
  lastReviewedAt?: string;
}

// ────────────────────────────────────────────
// 학습 세션
// ────────────────────────────────────────────

/** 학습 세션 */
export interface StudySession {
  /** 세션 ID */
  id: string;
  /** 시작 일시 */
  startedAt: string;
  /** 종료 일시 */
  endedAt?: string;
  /** 학습 주제 */
  topic: string;
  /** 학습 노트 원본 텍스트 (요약) */
  summary: string;
  /** 추출된 퀴즈 ID 목록 */
  quizIds: string[];
  /** 학습 방법 태그 */
  method: "ingest" | "spar" | "review" | "report";
}

// ────────────────────────────────────────────
// 스파링 (Adversarial Training)
// ────────────────────────────────────────────

/** 스파링 라운드 */
export interface SparringRound {
  /** 라운드 번호 */
  round: number;
  /** AI의 질문/공격 */
  aiChallenge: string;
  /** 사용자 답변 */
  userResponse?: string;
  /** AI 평가 */
  evaluation?: string;
  /** 발견된 약점 */
  weaknessFound?: string;
}

/** 스파링 세션 */
export interface SparringSession {
  /** 세션 ID */
  id: string;
  /** 주제 */
  topic: string;
  /** 시작 일시 */
  startedAt: string;
  /** 라운드 목록 */
  rounds: SparringRound[];
  /** 최종 평가 요약 */
  finalEvaluation?: string;
}

// ────────────────────────────────────────────
// 주간 리포트
// ────────────────────────────────────────────

/** 약점 항목 */
export interface WeaknessItem {
  /** 관련 퀴즈 ID */
  quizId: string;
  /** 주제 */
  topic: string;
  /** 오답 횟수 */
  failCount: number;
  /** 대표 오답 사례 */
  sampleWrongAnswer?: string;
  /** AI 제안 (보강 방법) */
  suggestion: string;
}

/** 주간 리포트 */
export interface WeeklyReport {
  /** 리포트 기간 시작 */
  periodStart: string;
  /** 리포트 기간 종료 */
  periodEnd: string;
  /** 생성 일시 */
  generatedAt: string;
  /** 총 복기 횟수 */
  totalReviews: number;
  /** 정답률 (%) */
  correctRate: number;
  /** 학습한 주제 수 */
  topicsStudied: number;
  /** 상위 약점 목록 */
  topWeaknesses: WeaknessItem[];
  /** 다음 주 학습 제안 */
  recommendations: string[];
}

// ────────────────────────────────────────────
// 설정
// ────────────────────────────────────────────

/** 복기 스케줄 설정 */
export interface ReviewScheduleConfig {
  /** 에빙하우스 복기 간격 (일 단위) */
  intervals: number[];
  /** 아침 복기 cron */
  morningCron: string;
  /** 저녁 복기 cron */
  eveningCron: string;
  /** 주간 리포트 cron */
  weeklyReportCron: string;
}

/** 전체 플러그인 설정 */
export interface PluginConfig {
  /** 복기 질문을 보낼 메신저 채널 */
  channel: string;
  /** 타임존 */
  timezone: string;
  /** 학습 노트 디렉토리 */
  studyLogsDir: string;
  /** 데이터 저장 디렉토리 */
  dataDir: string;
  /** 학습자 수준 */
  userLevel: UserLevel;
  /** 응답 언어 */
  language: string;
  /** 복기 스케줄 설정 */
  reviewSchedule: ReviewScheduleConfig;
}

// ────────────────────────────────────────────
// 영속 데이터 (JSON 파일 저장 구조)
// ────────────────────────────────────────────

/** 퀴즈 DB 전체 구조 */
export interface QuizDatabase {
  /** 전체 퀴즈 항목 */
  quizzes: QuizItem[];
  /** 복기 기록 */
  reviews: ReviewRecord[];
  /** 간격 반복 메타데이터 */
  spacedRepetition: SpacedRepetitionMeta[];
  /** 학습 세션 기록 */
  sessions: StudySession[];
  /** 스파링 세션 기록 */
  sparringSessions: SparringSession[];
  /** 주간 리포트 */
  weeklyReports: WeeklyReport[];
  /** 마지막 업데이트 */
  lastUpdated: string;
}
