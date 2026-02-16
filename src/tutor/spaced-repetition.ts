import dayjs from "dayjs";
import { QuizStore } from "./quiz-store";
import { QuizItem, SpacedRepetitionMeta, ReviewScheduleConfig } from "../types";

/**
 * 에빙하우스 망각곡선 기반 간격 반복 (Spaced Repetition) 엔진
 *
 * 바둑/체스에서 AI가 기보를 분석하듯, 학습 데이터를 분석하여
 * 최적의 복습 시점을 자동으로 결정합니다.
 *
 * 기본 간격: 1일 → 3일 → 7일 → 14일 → 30일
 *
 * 정답 시: 다음 단계로 진행
 * 오답 시: 현재 단계에서 1단계 뒤로 (최소 stage 0)
 * 연속 3회 정답: 한 단계 건너뛰기 (가속)
 */
export class SpacedRepetitionEngine {
  private store: QuizStore;
  private intervals: number[];

  constructor(store: QuizStore, config?: ReviewScheduleConfig) {
    this.store = store;
    this.intervals = config?.intervals ?? [1, 3, 7, 14, 30];
  }

  /**
   * 새 퀴즈에 대해 SR 메타 초기화
   * 첫 복기는 intervals[0]일 후
   */
  initializeForQuiz(quizId: string): SpacedRepetitionMeta {
    const nextDate = dayjs().add(this.intervals[0], "day").toISOString();
    return this.store.getOrCreateSRMeta(quizId, nextDate);
  }

  /**
   * 여러 퀴즈 한 번에 초기화
   */
  initializeForQuizzes(quizIds: string[]): SpacedRepetitionMeta[] {
    return quizIds.map((id) => this.initializeForQuiz(id));
  }

  /**
   * 오늘 복기 대상인 퀴즈 목록 반환
   */
  getDueQuizzes(): QuizItem[] {
    const dueIds = this.store.getDueQuizIds();
    return dueIds
      .map((id) => this.store.getQuiz(id))
      .filter((q): q is QuizItem => q !== undefined);
  }

  /**
   * 복기 결과 처리
   *
   * @param quizId 퀴즈 ID
   * @param isCorrect 정답 여부
   * @returns 업데이트된 SR 메타
   */
  processReviewResult(quizId: string, isCorrect: boolean): SpacedRepetitionMeta {
    const meta = this.store.getOrCreateSRMeta(
      quizId,
      dayjs().add(this.intervals[0], "day").toISOString()
    );

    // 통계 업데이트
    meta.totalAttempts++;
    meta.lastReviewedAt = new Date().toISOString();

    if (isCorrect) {
      meta.totalCorrect++;
      meta.consecutiveCorrect++;

      // 연속 3회 정답: 한 단계 건너뛰기 (가속)
      const stageJump = meta.consecutiveCorrect >= 3 ? 2 : 1;
      meta.currentStage = Math.min(
        meta.currentStage + stageJump,
        this.intervals.length - 1
      );
    } else {
      meta.consecutiveCorrect = 0;

      // 한 단계 뒤로 (최소 0)
      meta.currentStage = Math.max(meta.currentStage - 1, 0);
    }

    // 다음 복기일 계산
    const nextInterval = this.intervals[meta.currentStage];
    meta.nextReviewDate = dayjs().add(nextInterval, "day").toISOString();

    this.store.updateSRMeta(quizId, meta);
    return meta;
  }

  /**
   * 특정 날짜 기준, 복기 단계별 퀴즈 분류
   *
   * 아침 복기: 이전에 배운 내용 중 오늘이 복기일인 퀴즈
   * 저녁 복기: 오늘 새로 배운 내용 요약
   */
  categorizeByStage(): Map<number, QuizItem[]> {
    const allMetas = this.store.getAllSRMetas();
    const now = new Date().toISOString();
    const result = new Map<number, QuizItem[]>();

    for (const meta of allMetas) {
      if (meta.nextReviewDate <= now) {
        const quiz = this.store.getQuiz(meta.quizId);
        if (quiz) {
          const list = result.get(meta.currentStage) ?? [];
          list.push(quiz);
          result.set(meta.currentStage, list);
        }
      }
    }

    return result;
  }

  /**
   * 복기 단계에 따른 질문 유형 결정
   *
   * stage 0 (1일): "핵심 키워드 1개만 말해봐" (단순 회상)
   * stage 1 (3일): "프로젝트에 적용한다면?" (응용)
   * stage 2 (7일): "A개념과 B개념의 공통점은?" (통합)
   * stage 3 (14일): "이 이론의 반박 사례는?" (비판적 사고)
   * stage 4 (30일): "후배에게 설명해봐" (가르치기)
   */
  getReviewType(stage: number): {
    type: string;
    promptTemplate: string;
    description: string;
  } {
    const types = [
      {
        type: "recall",
        promptTemplate:
          '어제 배운 "{topic}" 기억나? 핵심 키워드 1개만 말해봐.',
        description: "단기 기억 확인 — 핵심 키워드 회상",
      },
      {
        type: "apply",
        promptTemplate:
          '3일 전에 배운 "{topic}"을 지금 당신이 하는 프로젝트에 적용한다면 어떻게 쓸 수 있어?',
        description: "응용 — 실제 상황에 적용",
      },
      {
        type: "integrate",
        promptTemplate:
          '저번에 배운 "{topic}" 개념과 최근 배운 다른 개념의 공통점이 뭐야?',
        description: "통합 — 지식 간 연결",
      },
      {
        type: "critique",
        promptTemplate:
          '"{topic}" 이론의 반박 사례나 예외 상황을 하나 들어봐.',
        description: "비판적 사고 — 반례 탐색",
      },
      {
        type: "teach",
        promptTemplate:
          '"{topic}"을 이 분야를 전혀 모르는 사람에게 1분 안에 설명해봐.',
        description: "가르치기 — 파인만 기법",
      },
    ];

    const safeIdx = Math.min(stage, types.length - 1);
    return types[safeIdx];
  }

  /**
   * 복기 질문 생성
   */
  generateReviewQuestion(quiz: QuizItem): string {
    const meta = this.store.getOrCreateSRMeta(
      quiz.id,
      dayjs().add(this.intervals[0], "day").toISOString()
    );
    const reviewType = this.getReviewType(meta.currentStage);
    return reviewType.promptTemplate.replace("{topic}", quiz.topic);
  }

  /**
   * 전체 SR 현황 요약
   */
  getSummary(): {
    totalQuizzes: number;
    dueToday: number;
    mastered: number;
    struggling: number;
    averageCorrectRate: number;
  } {
    const allMetas = this.store.getAllSRMetas();
    const now = new Date().toISOString();

    const dueToday = allMetas.filter((m) => m.nextReviewDate <= now).length;
    const mastered = allMetas.filter(
      (m) => m.currentStage >= this.intervals.length - 1
    ).length;
    const struggling = allMetas.filter(
      (m) => m.totalAttempts >= 3 && m.totalCorrect / m.totalAttempts < 0.5
    ).length;

    const totalAttempts = allMetas.reduce((sum, m) => sum + m.totalAttempts, 0);
    const totalCorrect = allMetas.reduce((sum, m) => sum + m.totalCorrect, 0);

    return {
      totalQuizzes: allMetas.length,
      dueToday,
      mastered,
      struggling,
      averageCorrectRate:
        totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0,
    };
  }
}
