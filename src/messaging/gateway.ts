import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * OpenClaw Gateway 메시지 전송 클라이언트
 *
 * OpenClaw CLI 또는 직접 HTTP API를 통해
 * 텔레그램/디스코드/슬랙 등에 메시지를 전송합니다.
 */
export class OpenClawGateway {
  private gatewayUrl: string;
  private gatewayToken: string | undefined;

  constructor(
    gatewayUrl: string = "http://localhost:18789",
    gatewayToken?: string
  ) {
    this.gatewayUrl = gatewayUrl;
    this.gatewayToken = gatewayToken ?? process.env.OPENCLAW_GATEWAY_TOKEN;
  }

  /**
   * 메시지 전송 (HTTP API 방식)
   */
  async sendMessage(channel: string, message: string): Promise<boolean> {
    try {
      // 먼저 HTTP API 시도
      const response = await fetch(`${this.gatewayUrl}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.gatewayToken
            ? { Authorization: `Bearer ${this.gatewayToken}` }
            : {}),
        },
        body: JSON.stringify({
          action: "send",
          channel,
          message,
        }),
      });

      if (response.ok) {
        console.log(`[Gateway] 메시지 전송 성공: ${channel}`);
        return true;
      }

      console.warn(
        `[Gateway] HTTP 전송 실패 (${response.status}), CLI로 재시도...`
      );
      return this.sendMessageViaCli(channel, message);
    } catch (err) {
      console.warn(`[Gateway] HTTP 연결 실패, CLI로 재시도...`);
      return this.sendMessageViaCli(channel, message);
    }
  }

  /**
   * 메시지 전송 (CLI 방식 — fallback)
   */
  private async sendMessageViaCli(
    channel: string,
    message: string
  ): Promise<boolean> {
    try {
      // 메시지에 포함된 특수문자 이스케이프
      const escapedMessage = message.replace(/"/g, '\\"');
      const escapedChannel = channel.replace(/"/g, '\\"');

      await execAsync(
        `openclaw message send --action send --channel "${escapedChannel}" --message "${escapedMessage}"`
      );
      console.log(`[Gateway] CLI 메시지 전송 성공: ${channel}`);
      return true;
    } catch (err) {
      console.error(`[Gateway] 메시지 전송 실패:`, err);
      return false;
    }
  }

  /**
   * 복기 질문 전송 (포매팅 포함)
   */
  async sendReviewQuestion(
    channel: string,
    question: string,
    metadata?: {
      stage?: number;
      topic?: string;
      dueCount?: number;
    }
  ): Promise<boolean> {
    const header = metadata?.dueCount
      ? `📖 오늘 복기 대상: ${metadata.dueCount}개\n\n`
      : "";

    const stageEmoji = ["📝", "🔄", "🔗", "⚔️", "🎓"][metadata?.stage ?? 0];
    const formatted = `${header}${stageEmoji} ${question}\n\n💬 답변을 입력하거나, /quiz skip 으로 건너뛸 수 있어요.`;

    return this.sendMessage(channel, formatted);
  }

  /**
   * 주간 리포트 전송
   */
  async sendWeeklyReport(
    channel: string,
    report: string
  ): Promise<boolean> {
    const formatted = `📊 주간 학습 리포트\n${"─".repeat(20)}\n\n${report}`;
    return this.sendMessage(channel, formatted);
  }

  /**
   * 저녁 복기 메시지 전송
   */
  async sendEveningReview(
    channel: string,
    message: string
  ): Promise<boolean> {
    return this.sendMessage(channel, message);
  }

  /**
   * 스파링 시작 메시지 전송
   */
  async sendSparringChallenge(
    channel: string,
    topic: string,
    challenge: string
  ): Promise<boolean> {
    const formatted = `🥊 가상 스파링 시작!\n\n주제: ${topic}\n\n${challenge}\n\n💬 당신의 답변을 입력하세요.`;
    return this.sendMessage(channel, formatted);
  }

  /**
   * Gateway 연결 상태 확인
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.gatewayUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
