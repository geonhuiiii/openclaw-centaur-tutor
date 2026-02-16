/**
 * OpenClaw 켄타우로스 학습 코치 — 최소 디버그 버전
 *
 * 문제 격리를 위해 모든 외부 의존성을 제거하고
 * 가장 단순한 형태로 registerTool을 테스트합니다.
 */

const centaurTutorPlugin = {
  register(api: any) {
    const logger = api?.logger ?? console;
    logger.info("[CentaurTutor] register() 진입");

    try {
      // ── Tool 등록 (MCP 표준: inputSchema 사용) ──
      api.registerTool({
        name: "centaur_report",
        description: "학습 현황 대시보드를 확인합니다.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
        execute: async (_params: Record<string, unknown>) => {
          return "📈 학습 현황 대시보드\n─────────────────────────\n📚 전체 퀴즈: 0개\n📝 복기 횟수: 0회\n✅ 정답률: -\n\n💡 /study 로 학습을 시작하세요!";
        },
      });
      logger.info("[CentaurTutor] centaur_report 등록 완료");

      api.registerTool({
        name: "centaur_study",
        description: "새로운 학습 내용을 등록합니다.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "학습 내용 텍스트" },
          },
          required: ["text"],
        },
        execute: async (params: Record<string, unknown>) => {
          const text = String(params?.text ?? "");
          return `📚 학습 등록 완료!\n\n입력된 텍스트 (${text.length}자):\n"${text.substring(0, 100)}..."\n\n⏰ 내일 아침 8시에 복기 퀴즈가 전송됩니다.`;
        },
      });
      logger.info("[CentaurTutor] centaur_study 등록 완료");

      api.registerTool({
        name: "centaur_spar",
        description: "AI와 가상 스파링을 시작합니다.",
        inputSchema: {
          type: "object",
          properties: {
            topic: { type: "string", description: "스파링 주제" },
          },
          required: ["topic"],
        },
        execute: async (params: Record<string, unknown>) => {
          const topic = String(params?.topic ?? "일반");
          return `🥊 가상 스파링 시작!\n\n주제: "${topic}"\n\n자, 이 주제에 대해 설명해보세요. 당신의 설명에서 약점을 찾아내겠습니다.`;
        },
      });
      logger.info("[CentaurTutor] centaur_spar 등록 완료");

      api.registerTool({
        name: "centaur_quiz",
        description: "복기 퀴즈를 받습니다.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
        execute: async (_params: Record<string, unknown>) => {
          return "✅ 현재 복기 대상이 없습니다. /study 로 학습을 시작하세요!";
        },
      });
      logger.info("[CentaurTutor] centaur_quiz 등록 완료");

      api.registerTool({
        name: "centaur_level",
        description: "학습 난이도를 확인합니다.",
        inputSchema: {
          type: "object",
          properties: {
            level: {
              type: "string",
              enum: ["beginner", "intermediate", "advanced", "expert"],
              description: "학습 수준",
            },
          },
          required: [],
        },
        execute: async (params: Record<string, unknown>) => {
          if (params?.level) {
            return `✅ 학습 수준이 "${params.level}"로 변경되었습니다.`;
          }
          return "🎯 현재 학습 수준: intermediate\n\n변경: /level [beginner|intermediate|advanced|expert]";
        },
      });
      logger.info("[CentaurTutor] centaur_level 등록 완료");

      logger.info("[CentaurTutor] 모든 도구 등록 완료 (5개)");
    } catch (err) {
      logger.error("[CentaurTutor] register() 실패:", err);
    }
  },
};

// CommonJS 직접 export — OpenClaw이 require()로 로드할 때
// exports.default가 아닌 module.exports 자체가 플러그인이어야 함
module.exports = centaurTutorPlugin;
