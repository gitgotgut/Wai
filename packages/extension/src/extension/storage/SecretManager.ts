import { StateManager } from "./StateManager";

const SECRET_KEYS = {
  openai: "wai.openai.apiKey",
  anthropic: "wai.anthropic.apiKey",
} as const;

type Provider = keyof typeof SECRET_KEYS;

/**
 * High-level secret management for API keys.
 * Uses VS Code's SecretStorage (OS credential manager) under the hood.
 */
export class SecretManager {
  constructor(private readonly state: StateManager) {}

  async setApiKey(provider: Provider, key: string): Promise<void> {
    await this.state.setSecret(SECRET_KEYS[provider], key);
  }

  async getApiKey(provider: Provider): Promise<string | undefined> {
    return this.state.getSecret(SECRET_KEYS[provider]);
  }

  async deleteApiKey(provider: Provider): Promise<void> {
    await this.state.deleteSecret(SECRET_KEYS[provider]);
  }

  async clearAll(): Promise<void> {
    for (const key of Object.values(SECRET_KEYS)) {
      await this.state.deleteSecret(key);
    }
  }

  /** Mask a key for safe logging: "sk-proj-abc...xyz" */
  static mask(key: string): string {
    if (key.length <= 8) return "****";
    return key.slice(0, 4) + "..." + key.slice(-4);
  }
}
