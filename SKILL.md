---
name: centaur-tutor
description: 켄타우로스 학습 코치 — 에빙하우스 망각곡선 기반 자동 복기, 가상 스파링, 적응형 퀴즈를 cron으로 스케줄링합니다
allowed-tools: Bash(npm:*) Bash(npx:*) Bash(openclaw:*) Read Write
---

# 🎓 켄타우로스 학습 코치 (Centaur Tutor)

바둑/체스의 **AI 엔진 기반 학습법(Engine-based Learning)**을 학문에 적용한 OpenClaw 스킬입니다.

체스 챔피언 가리 카스파로프의 **'켄타우로스' 이론** — "인간 + AI 팀이 인간 단독, 혹은 AI 단독보다 강하다" — 을 학습에 적용합니다.

## 핵심 개념

알파고가 바둑의 정석을 깨뜨렸듯, 기존의 수동적 학습법을 AI와의 능동적 협업으로 전환합니다.

| 비유 | 게임(바둑/체스) | 학문 |
|------|----------------|------|
| 기보 적재 | 프로 기사의 기보 학습 | 학습 노트 → Q&A 자동 추출 |
| 실시간 복기 | 대국 후 AI 승률 그래프 분석 | 에빙하우스 망각곡선 기반 자동 복기 |
| 정석 파괴 | 알파고의 37수 | 비판적 사고, 반례 탐색 |
| 가상 대국 | AI와 수천 번 연습 | 압박 면접관 스파링 |
| ELO 매칭 | 실력에 맞는 상대 | 적응형 난이도 조절 |

## 4단계 학습 사이클

### 1단계: 지식 '기보' 적재 (Ingest)

```
사용자: /study 오늘 양자역학 기초 공부했어. 슈뢰딩거 방정식은...
AI: 📚 학습 내용이 등록되었습니다! 생성된 퀴즈: 5개
    ⏰ 첫 복기: 내일 아침 8시
```

학습한 내용에서 Q&A를 자동 추출하고, 간격 반복 스케줄에 등록합니다.

### 2단계: 가상 스파링 (Adversarial Training)

```
사용자: /spar 양자역학의 관측 문제
AI: 🥊 가상 스파링 시작!
    자, 이 주제에 대해 설명해보세요. 약점을 찾아내겠습니다.
```

AI가 **악랄한 면접관**이 되어 논리적 허점을 공격합니다.

### 3단계: 자동 복기 (Cron 기반 — 에빙하우스 망각곡선)

Heartbeat 대신 **Cron**을 사용하여 정확한 시간에 복기합니다.

| 시점 | Cron | 질문 유형 |
|------|------|----------|
| **1일 차** | `0 8 * * *` | "핵심 키워드 1개만 말해봐" (단순 회상) |
| **3일 차** | | "프로젝트에 적용한다면?" (응용) |
| **7일 차** | | "A개념과 B개념의 공통점?" (통합) |
| **14일 차** | | "반박 사례는?" (비판적 사고) |
| **30일 차** | | "후배에게 설명해봐" (파인만 기법) |

정답 시 다음 단계로, 오답 시 한 단계 뒤로. **연속 3회 정답 시 가속**.

### 4단계: 주간 약점 리포트 (Meta-Analysis)

```
매주 일요일 10시 (cron: "0 10 * * 0")

📊 주간 학습 리포트
─────────────────
📅 기간: 02/10 ~ 02/16
복기 횟수: 28회 | 정답률: 73.2% | 학습 주제: 5개

❌ 취약 영역:
  • 양자역학 관측 문제 (오답 4회)
  • 파동-입자 이중성 (오답 2회)

💡 추천:
  • "양자역학 관측 문제"에 /spar 스파링 추천
```

## When to Use

- 사용자가 무언가를 공부했다고 말할 때 → `/study`
- 사용자가 자신의 이해를 테스트하고 싶을 때 → `/spar`
- 사용자가 퀴즈를 요청할 때 → `/quiz`
- 매일 아침/저녁 자동으로 복기 질문 전송 → Cron
- 주간 학습 상태를 확인할 때 → `/report`

## Commands

| 명령 | 설명 | 예시 |
|------|------|------|
| `/study <내용>` | 학습 내용 등록, Q&A 자동 추출 | `/study 오늘 미적분 배웠어. 도함수는...` |
| `/spar <주제>` | AI 압박 면접관 스파링 시작 | `/spar 양자역학의 관측 문제` |
| `/quiz` | 즉시 복기 퀴즈 받기 | `/quiz` |
| `/report` | 학습 현황 대시보드 | `/report` |
| `/level [수준]` | 학습 수준 확인/변경 | `/level advanced` |

## Required Environment Variables

```bash
OPENCLAW_CHANNEL=your_channel          # 복기 질문을 보낼 채널
OPENCLAW_GATEWAY_TOKEN=your_token      # openclaw doctor --generate-gateway-token
```

## Optional Environment Variables

```bash
TZ=Asia/Seoul                          # 타임존 (기본: Asia/Seoul)
STUDY_LOGS_DIR=./study_logs            # 학습 노트 폴더
DATA_DIR=./data                        # 데이터 저장 폴더
USER_LEVEL=intermediate                # beginner|intermediate|advanced|expert
LANGUAGE=ko                            # 응답 언어

# Cron 스케줄 커스터마이즈
MORNING_CRON="0 8 * * *"              # 아침 복기 (기본: 매일 08:00)
EVENING_CRON="0 21 * * *"             # 저녁 복기 (기본: 매일 21:00)
WEEKLY_REPORT_CRON="0 10 * * 0"       # 주간 리포트 (기본: 일요일 10:00)
REVIEW_INTERVALS=[1,3,7,14,30]         # 에빙하우스 복기 간격 (일)
```

## Setup

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp env.example .env
# .env 파일을 열어 필수 값을 채우세요
```

### 3. OpenClaw 연동

```bash
openclaw config set gateway.mode=local
openclaw doctor --generate-gateway-token
openclaw gateway start
```

### 4. 실행

```bash
# 개발 모드 (CLI)
npm run dev -- study "오늘 배운 내용..."
npm run dev -- spar "주제"
npm run dev -- quiz
npm run dev -- report

# Cron 스케줄러 실행 (데몬 모드)
npm run dev -- serve
```

### 5. 빌드 및 배포

```bash
npm run build
```

## Architecture

```
src/
├── index.ts                 # 진입점 + Cron 스케줄러 + CLI
├── types.ts                 # 전체 타입 정의
├── tutor/
│   ├── core.ts              # 4단계 학습 코어 엔진
│   ├── quiz-store.ts        # JSON 기반 퀴즈 DB
│   ├── spaced-repetition.ts # 에빙하우스 간격 반복 알고리즘
│   └── prompts.ts           # 6가지 학습법 시스템 프롬프트
└── messaging/
    └── gateway.ts           # OpenClaw Gateway 메시지 전송
```

## 이론적 배경

1. **블룸의 2시그마 현상**: 1:1 튜터링은 성취도를 2 표준편차(상위 98%) 향상시킵니다.
2. **에빙하우스 망각곡선**: 복습 없이 1일 후 74%, 1주 후 77%, 1달 후 79%를 망각합니다.
3. **켄타우로스 체스**: "약한 인간 + 기계 + 좋은 프로세스" > "강한 기계" or "강한 인간"
4. **적극적 회상(Active Recall)**: 인출 연습이 재독보다 기억 유지율 50% 이상 높음 (Science, 2011)
5. **근접 발달 영역(ZPD)**: 현재 수준보다 '딱 한 단계 위' 난이도가 학습 효율 극대화

## Cron vs Heartbeat

이 스킬은 **Cron**을 사용합니다.

| 기준 | Cron | Heartbeat |
|------|------|-----------|
| 시간 정확도 | 분 단위 정확 | 주기적이나 부정확 |
| 다중 스케줄 | 여러 태스크 독립 관리 | 단일 주기 |
| 커스터마이즈 | 표준 cron 문법 | 제한적 |
| 안정성 | Linux 표준, 검증됨 | 구현 의존적 |

## Tips

1. 📝 매일 `/study`로 최소 1개의 개념을 등록하세요
2. 🥊 어려운 주제일수록 `/spar`로 약점을 먼저 파악하세요
3. ⏰ Cron 알림이 오면 30초만 투자해서 답변하세요
4. 📊 매주 리포트를 확인하고 약점에 집중하세요
5. 🎯 정답률 70%가 넘으면 `/level`을 올리세요
