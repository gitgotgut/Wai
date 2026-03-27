// Prices per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o":             { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":        { input: 0.15,  output: 0.60  },
  // Anthropic
  "claude-sonnet-4-20250514": { input: 3.00,  output: 15.00 },
  "claude-haiku-4-5-20251001":  { input: 0.80,  output: 4.00  },
  // Google
  "gemini-2.5-flash":   { input: 0.15,  output: 0.60  },
  "gemini-2.5-pro":     { input: 1.25,  output: 10.00 },
};

export function calculateCost(
  _provider: string,
  model: string,
  usage: { inputTokens?: number; outputTokens?: number },
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * pricing.input;
  const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}
