/**
 * OpenClaw 켄타우로스 학습 코치
 * 순수 JavaScript — TypeScript 컴파일 없음
 */

module.exports = {
  register(api) {
    const log = api && api.logger ? api.logger : console;
    log.info("[CentaurTutor] register 시작");

    api.registerTool({
      name: "centaur_report",
      description: "학습 현황 대시보드를 확인합니다.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async function () {
        return "📈 학습 현황: 퀴즈 0개 / 복기 0회 / /study 로 시작하세요!";
      },
    });

    api.registerTool({
      name: "centaur_study",
      description: "새로운 학습 내용을 등록합니다.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "학습 내용 텍스트" },
        },
        required: ["text"],
      },
      execute: async function (params) {
        var text = params && params.text ? String(params.text) : "";
        return "📚 학습 등록 완료! (" + text.length + "자) 내일 복기 퀴즈 전송 예정.";
      },
    });

    api.registerTool({
      name: "centaur_spar",
      description: "AI와 가상 스파링을 시작합니다.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "스파링 주제" },
        },
        required: ["topic"],
      },
      execute: async function (params) {
        var topic = params && params.topic ? String(params.topic) : "일반";
        return "🥊 스파링 시작! 주제: " + topic + " — 설명해보세요.";
      },
    });

    api.registerTool({
      name: "centaur_quiz",
      description: "복기 퀴즈를 받습니다.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      execute: async function () {
        return "✅ 복기 대상 없음. /study 로 학습을 시작하세요!";
      },
    });

    api.registerTool({
      name: "centaur_level",
      description: "학습 난이도를 확인합니다.",
      parameters: {
        type: "object",
        properties: {
          level: { type: "string", description: "학습 수준" },
        },
        required: [],
      },
      execute: async function (params) {
        if (params && params.level) {
          return "✅ 학습 수준: " + params.level;
        }
        return "🎯 현재 학습 수준: intermediate";
      },
    });

    log.info("[CentaurTutor] 도구 5개 등록 완료");
  },
};
