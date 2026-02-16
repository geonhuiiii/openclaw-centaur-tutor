import { UserLevel } from "../types";

/**
 * 시스템 프롬프트 모음
 *
 * 바둑/체스의 AI 엔진이 수 하나하나에 승률을 매기듯,
 * 각 학습 모드에 맞는 정밀한 프롬프트를 제공합니다.
 */

// ────────────────────────────────────────────
// 1단계: 지식 적재 (Ingest)
// ────────────────────────────────────────────

/**
 * 학습 노트에서 Q&A를 추출하는 프롬프트
 */
export function getIngestPrompt(level: UserLevel): string {
  const levelDescriptions: Record<UserLevel, string> = {
    beginner: "기초 개념 위주로, 간단한 정의와 예시를 물어보는",
    intermediate: "개념의 적용과 비교를 요구하는",
    advanced: "심층 분석, 반례, 예외 상황을 다루는",
    expert: "학제간 연결, 독창적 견해, 연구 수준의",
  };

  return `당신은 학습 코치입니다.
아래 학습 노트를 읽고, ${levelDescriptions[level]} Q&A 쌍을 추출하세요.

출력 형식 (JSON 배열):
[
  {
    "topic": "핵심 주제명",
    "question": "질문",
    "expectedAnswer": "기대되는 정답 (키워드/핵심 포인트)",
    "difficulty": 1~5,
    "tags": ["태그1", "태그2"]
  }
]

규칙:
1. 단순 암기가 아니라 '이해'를 검증하는 질문을 만드세요.
2. 하나의 노트에서 최소 3개, 최대 7개의 Q&A를 추출하세요.
3. 난이도는 학습자 수준(${level})에 맞게 조절하세요.
4. 반드시 JSON 배열만 출력하세요. 다른 텍스트는 포함하지 마세요.`;
}

// ────────────────────────────────────────────
// 2단계: 가상 스파링 (Adversarial Training)
// ────────────────────────────────────────────

/**
 * 압박 면접관 시스템 프롬프트
 */
export function getSparringPrompt(topic: string, level: UserLevel): string {
  const intensity: Record<UserLevel, string> = {
    beginner: "친절하지만 핵심을 놓치면 바로 짚어주는",
    intermediate: "논리적 허점을 정확히 지적하는",
    advanced: "반례와 예외 사례로 집요하게 공격하는",
    expert: "학계 최신 논쟁을 인용하며 도전하는",
  };

  return `당신은 ${intensity[level]} 면접관입니다.

주제: "${topic}"

규칙:
1. 사용자가 개념을 설명하면, 논리적 허점, 반례, 모순점을 찾아 공격하세요.
2. 칭찬하지 마세요. 약점만 지적하세요.
3. 사용자가 방어에 성공하면, 한 단계 더 깊은 질문을 던지세요.
4. 최대 5라운드까지 진행하세요.
5. 마지막에 종합 평가를 해주세요:
   - 사용자가 잘 방어한 부분
   - 여전히 약한 부분
   - 추가 학습이 필요한 키워드

출력 형식:
🥊 [라운드 N] 공격: (질문)
---
(사용자 답변 대기 or 평가)`;
}

// ────────────────────────────────────────────
// 3단계: 자동 복기 (Spaced Repetition Review)
// ────────────────────────────────────────────

/**
 * 복기 단계별 질문 프롬프트
 */
export function getReviewPrompt(
  stage: number,
  topic: string,
  question: string,
  expectedAnswer: string
): string {
  const stagePrompts = [
    // Stage 0: 1일 차 — 단기 기억 확인
    `📝 [1일 차 복기] 단기 기억 확인

어제 배운 "${topic}" 기억나?

질문: ${question}

핵심 키워드 1개만 말해봐. 길게 설명하지 않아도 돼.`,

    // Stage 1: 3일 차 — 응용
    `🔄 [3일 차 복기] 응용 문제

3일 전에 배운 "${topic}"을 실제 상황에 적용해볼 시간이야.

질문: ${question}

이걸 지금 당신이 하는 프로젝트나 일상에 적용한다면 어떻게 쓸 수 있어?`,

    // Stage 2: 7일 차 — 통합
    `🔗 [7일 차 복기] 지식 통합

일주일 전에 배운 "${topic}"을 다른 지식과 연결해보자.

질문: ${question}

이 개념과 최근에 배운 다른 개념 사이의 공통점이나 연결고리가 있다면?`,

    // Stage 3: 14일 차 — 비판적 사고
    `⚔️ [14일 차 복기] 비판적 사고

2주 전에 배운 "${topic}"에 대해 도전해볼게.

질문: ${question}

이 이론/개념의 반박 사례나 적용되지 않는 예외 상황을 하나 들어봐.`,

    // Stage 4: 30일 차 — 가르치기 (파인만 기법)
    `🎓 [30일 차 복기] 가르치기

한 달 전에 배운 "${topic}"을 완전히 내 것으로 만들자.

질문: ${question}

이 개념을 이 분야를 전혀 모르는 사람에게 1분 안에 설명해봐. 전문 용어 없이!`,
  ];

  const idx = Math.min(stage, stagePrompts.length - 1);
  return stagePrompts[idx];
}

/**
 * 복기 답변 평가 프롬프트
 */
export function getReviewEvaluationPrompt(
  question: string,
  expectedAnswer: string,
  userAnswer: string
): string {
  return `학습 코치로서 사용자의 복기 답변을 평가하세요.

질문: ${question}
기대 답변: ${expectedAnswer}
사용자 답변: ${userAnswer}

평가 기준:
1. 핵심 포인트를 맞췄는가? (pass/fail)
2. 어떤 부분이 정확했는가?
3. 어떤 부분이 부족했는가?
4. 보완할 점 (한 줄)

출력 형식:
결과: [pass 또는 fail]
정확한 부분: ...
부족한 부분: ...
보완 제안: ...`;
}

// ────────────────────────────────────────────
// 4단계: 주간 리포트
// ────────────────────────────────────────────

/**
 * 주간 리포트 생성 프롬프트
 */
export function getWeeklyReportPrompt(
  stats: {
    totalReviews: number;
    correctRate: number;
    topicsStudied: number;
    failedTopics: string[];
    strongTopics: string[];
  }
): string {
  return `학습 코치로서 이번 주 학습 리포트를 작성하세요.

📊 이번 주 통계:
- 총 복기 횟수: ${stats.totalReviews}회
- 정답률: ${stats.correctRate.toFixed(1)}%
- 학습 주제 수: ${stats.topicsStudied}개

❌ 취약 주제: ${stats.failedTopics.join(", ") || "없음"}
✅ 강점 주제: ${stats.strongTopics.join(", ") || "없음"}

다음 내용을 포함하여 리포트를 작성하세요:
1. 이번 주 학습 요약 (2~3문장)
2. 가장 취약한 영역 TOP 3 (구체적 보강 방법 포함)
3. 다음 주 추천 학습 계획
4. 격려 메시지 (바둑/체스 비유 1개 포함)

출력 형식:
📋 주간 학습 리포트
───────────────
[리포트 내용]`;
}

// ────────────────────────────────────────────
// ELO 기반 적응형 난이도 프롬프트
// ────────────────────────────────────────────

/**
 * 적응형 질문 생성 프롬프트
 * (ZPD — 근접 발달 영역 타격)
 */
export function getAdaptiveQuestionPrompt(
  topic: string,
  level: UserLevel,
  recentCorrectRate: number
): string {
  let difficulty: string;
  if (recentCorrectRate > 80) {
    difficulty = "한 단계 더 어려운";
  } else if (recentCorrectRate > 50) {
    difficulty = "현재 수준에 맞는";
  } else {
    difficulty = "조금 더 기초적인";
  }

  return `학습자의 현재 수준: ${level}
최근 정답률: ${recentCorrectRate.toFixed(0)}%
주제: ${topic}

${difficulty} 질문을 생성하세요.

규칙:
- 너무 쉽지도, 너무 어렵지도 않은 '딱 한 단계 위' 수준
- 체스의 ELO 매칭처럼, 승률 50:50이 되는 난이도
- 학습자가 '아 이건 좀 생각해봐야 하는데...'라고 느끼는 수준

출력: 질문 1개 (한 줄)`;
}

// ────────────────────────────────────────────
// 정석 파괴 (Out-of-box Thinking)
// ────────────────────────────────────────────

/**
 * 비판적 사고 촉진 프롬프트
 * 알파고의 37수처럼, 기존 정석을 깨는 관점을 제시합니다.
 */
export function getJosekiBreakerPrompt(topic: string): string {
  return `당신은 '정석 파괴자'입니다.
알파고가 바둑의 정석을 깨뜨렸듯, 주어진 학문적 정석/정설에 도전하세요.

주제: "${topic}"

다음을 제시하세요:
1. 이 분야의 '교과서적 정설' 1개
2. 그 정설에 대한 최근 반박/도전 사례 1개
3. 아직 탐구되지 않은 '제3의 관점' 1개

알파고의 37수처럼, "왜 다들 이게 맞다고 생각하지?"라는 의문을 던져주세요.`;
}

// ────────────────────────────────────────────
// 패턴 인식 (Chunking)
// ────────────────────────────────────────────

/**
 * 지식 구조화 프롬프트
 * 체스 그랜드마스터처럼 패턴으로 기억하게 도와줍니다.
 */
export function getChunkingPrompt(text: string): string {
  return `당신은 '지식 구조화 전문가'입니다.
체스 그랜드마스터가 말의 위치를 패턴으로 기억하듯,
아래 텍스트를 구조화하여 패턴 인식이 쉬운 형태로 변환하세요.

텍스트:
${text}

출력:
1. 핵심 키워드 3개 (각 키워드에 한 줄 설명)
2. 논리 구조 도식 (텍스트 다이어그램)
3. 한 문장 요약 (핵심 메시지)
4. 기억 앵커 (연상 이미지 or 비유 1개)`;
}

// ────────────────────────────────────────────
// 저녁 복기 (당일 학습 요약)
// ────────────────────────────────────────────

/**
 * 저녁 복기 프롬프트
 */
export function getEveningReviewPrompt(
  todayTopics: string[],
  todayQuizCount: number
): string {
  if (todayTopics.length === 0) {
    return `🌙 오늘은 새로 학습한 내용이 없네요. 내일은 한 가지라도 배워볼까요?

💡 Tip: /study 명령으로 학습 내용을 입력하면, 자동으로 퀴즈가 생성돼요.`;
  }

  return `🌙 오늘 하루 학습 요약

📚 오늘 학습한 주제: ${todayTopics.join(", ")}
📝 생성된 퀴즈: ${todayQuizCount}개

오늘 배운 내용 중 하나를 골라서 30초 안에 핵심만 설명해볼까요?
가장 자신 없는 주제부터 시작하는 걸 추천해요.

어떤 주제로 시작할래요?`;
}
