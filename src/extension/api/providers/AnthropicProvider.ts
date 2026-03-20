import type { TokenUsage } from "./OpenAIProvider";

/**
 * Anthropic doesn't expose a public usage/billing endpoint.
 * Provide a rough estimate based on character count from Wai's own tracking.
 *
 * Estimation model:
 *  - 1 token ≈ 4 characters
 *  - Claude Sonnet 4: ~$3 per 1M input tokens (blended in/out)
 */
export function estimateAnthropicUsage(aiCharacters: number): TokenUsage {
  const estimatedTokens = Math.round(aiCharacters / 4);
  const estimatedCost = (estimatedTokens / 1_000_000) * 3;

  return {
    provider: "anthropic",
    used: estimatedTokens,
    limit: -1, // unknown
    cost: Math.round(estimatedCost * 100) / 100,
    fetchedAt: Date.now(),
  };
}
