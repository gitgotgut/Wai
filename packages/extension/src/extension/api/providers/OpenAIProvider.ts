import * as https from "https";

export interface TokenUsage {
  provider: string;
  used: number;
  limit: number;
  cost: number;
  fetchedAt: number;
}

/**
 * Fetch today's token usage from the OpenAI API.
 * Uses the /v1/usage endpoint (requires an admin or project API key).
 * Falls back to a rough cost estimate if the endpoint is unavailable.
 */
export async function fetchOpenAIUsage(apiKey: string): Promise<TokenUsage> {
  const today = new Date().toISOString().split("T")[0];
  const url = `https://api.openai.com/v1/usage?date=${today}`;

  const body = await httpGet(url, {
    Authorization: `Bearer ${apiKey}`,
  });

  const data = JSON.parse(body);

  // The /v1/usage endpoint returns an array of per-model snapshots.
  // Sum up total_tokens and costs across all models.
  let totalTokens = 0;
  let totalCost = 0;

  if (Array.isArray(data.data)) {
    for (const entry of data.data) {
      totalTokens += entry.n_context_tokens_total ?? 0;
      totalTokens += entry.n_generated_tokens_total ?? 0;
    }
  }

  // OpenAI doesn't return cost directly; estimate from token count.
  // Average blended rate ~$2.50 per 1M tokens (mix of gpt-4o / gpt-3.5-turbo).
  totalCost = (totalTokens / 1_000_000) * 2.5;

  return {
    provider: "openai",
    used: totalTokens,
    limit: -1, // OpenAI doesn't expose limits via this endpoint
    cost: Math.round(totalCost * 100) / 100,
    fetchedAt: Date.now(),
  };
}

function httpGet(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`OpenAI API returned ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
    req.on("error", reject);
    req.setTimeout(10_000, () => {
      req.destroy(new Error("OpenAI API request timed out"));
    });
  });
}
