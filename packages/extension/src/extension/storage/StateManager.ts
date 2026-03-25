import * as vscode from "vscode";

/**
 * Abstraction over VS Code's globalState and SecretStorage APIs.
 * Public data goes to globalState; sensitive data goes to SecretStorage.
 */
export class StateManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async getGlobalState<T>(key: string): Promise<T | undefined> {
    return this.context.globalState.get<T>(key);
  }

  async setGlobalState<T>(key: string, value: T): Promise<void> {
    await this.context.globalState.update(key, value);
  }

  async getSecret(key: string): Promise<string | undefined> {
    return this.context.secrets.get(key);
  }

  async setSecret(key: string, value: string): Promise<void> {
    await this.context.secrets.store(key, value);
  }

  async deleteSecret(key: string): Promise<void> {
    await this.context.secrets.delete(key);
  }
}
