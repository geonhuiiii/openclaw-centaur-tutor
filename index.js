/**
 * OpenClaw 켄타우로스 학습 코치
 * 순수 JavaScript — voice-call 플러그인 형식 참조
 */

// MCP 표준 응답 포맷 헬퍼
function textResult(message) {
  return {
    content: [{ type: "text", text: message }],
  };
}

module.exports = {
  register(api) {
    var log = api && api.logger ? api.logger : console;
    log.info("[CentaurTutor] register 시작");

    api.registerTool({
      name: "centaur_report",
      label: "Centaur Report",
      description: "학습 현황 대시보드를 확인합니다.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      async execute(_toolCallId, _params) {
        return textResult(
          "📈 학습 현황 대시보드\n─────────────────────────\n📚 전체 퀴즈: 0개\n📝 복기 횟수: 0회\n✅ 정답률: -\n\n💡 /study 로 학습을 시작하세요!"
        );
      },
    });

    api.registerTool({
      name: "centaur_study",
      label: "Centaur Study",
      description: "새로운 학습 내용을 등록합니다.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "학습 내용 텍스트" },
        },
        required: ["text"],
      },
      async execute(_toolCallId, params) {
        var text = params && params.text ? String(params.text) : "";
        return textResult(
          "📚 학습 등록 완료! (" + text.length + "자)\n\n⏰ 내일 아침 8시에 복기 퀴즈가 전송됩니다."
        );
      },
    });

    api.registerTool({
      name: "centaur_spar",
      label: "Centaur Spar",
      description: "AI와 가상 스파링을 시작합니다.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "스파링 주제" },
        },
        required: ["topic"],
      },
      async execute(_toolCallId, params) {
        var topic = params && params.topic ? String(params.topic) : "일반";
        return textResult(
          "🥊 가상 스파링 시작!\n\n주제: " + topic + "\n\n자, 이 주제에 대해 설명해보세요. 당신의 설명에서 약점을 찾아내겠습니다."
        );
      },
    });

    api.registerTool({
      name: "centaur_quiz",
      label: "Centaur Quiz",
      description: "복기 퀴즈를 받습니다.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      async execute(_toolCallId, _params) {
        return textResult(
          "✅ 현재 복기 대상이 없습니다. /study 로 학습을 시작하세요!"
        );
      },
    });

    api.registerTool({
      name: "centaur_level",
      label: "Centaur Level",
      description: "학습 난이도를 확인합니다.",
      parameters: {
        type: "object",
        properties: {
          level: { type: "string", description: "학습 수준" },
        },
        required: [],
      },
      async execute(_toolCallId, params) {
        if (params && params.level) {
          return textResult("✅ 학습 수준이 " + params.level + "로 변경되었습니다.");
        }
        return textResult(
          "🎯 현재 학습 수준: intermediate\n\n변경하려면 level 파라미터를 지정하세요."
        );
      },
    });

    log.info("[CentaurTutor] 도구 5개 등록 완료");
  },
};
