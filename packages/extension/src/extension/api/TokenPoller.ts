import type * as vscode from "vscode";
import type { StateManager } from "../storage/StateManager";
import type { SecretManager } from "../storage/SecretManager";
import type { TokenUsage } from "./providers/OpenAIProvider";
import { fetchOpenAIUsage } from "./providers/OpenAIProvider";
import { estimateAnthropicUsage } from "./providers/AnthropicProvider";

const POLL_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes
const STORAGE_KEY = "wai.tokenUsage";

/**
 * Background poller that periodically checks API token usage
 * and writes the result to StateManager for the dashboard to display.
 */
export class TokenPoller {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly state: StateManager,
    private readonly secrets: SecretManager,
    private readonly output: vscode.OutputChannel,
    private readonly getAiChars: () => number,
  ) {}

  start(): void {
    // Fire once immediately, then on interval
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async getLastUsage(): Promise<TokenUsage | undefined> {
    return this.state.getGlobalState<TokenUsage>(STORAGE_KEY);
  }

  private async poll(): Promise<void> {
    try {
      const openaiKey = await this.secrets.getApiKey("openai");
      if (openaiKey) {
        const usage = await fetchOpenAIUsage(openaiKey);
        await this.state.setGlobalState(STORAGE_KEY, usage);
        return;
      }

      const anthropicKey = await this.secrets.getApiKey("anthropic");
      if (anthropicKey) {
        const usage = estimateAnthropicUsage(this.getAiChars());
        await this.state.setGlobalState(STORAGE_KEY, usage);
        return;
      }
    } catch (err) {
      this.output.appendLine(`[wai] Token polling error: ${err instanceof Error ? err.message : err}`);
    }
  }
}
