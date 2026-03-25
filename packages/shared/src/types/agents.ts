export type AIProvider = "openai" | "anthropic" | "google";

export interface AgentConfig {
  name: string;
  description?: string;
  systemPrompt: string;
  model: string;
  provider: AIProvider;
  tools?: string[];
}
