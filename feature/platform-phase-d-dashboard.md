# Phase D: Usage Dashboard

> Self-contained implementation prompt. Copy into a Claude conversation to execute.

---

## Context

You are working on **Wai Platform** (`https://github.com/gitgotgut/Wai`). Phases A-C are complete: auth, API key management, agent CRUD, and streaming chat with usage recording. The `usage_records` table is populated on every chat completion.

### What This Phase Delivers

- Cost dashboard with total spend, per-provider breakdown, daily trend chart
- Per-agent analytics (token spend + message count)
- Recent conversations feed
- The analytics layer that makes Wai's platform value visible

---

## Prerequisites

Phase C must be complete:
- `usage_records` table exists and is populated per chat completion
- `conversations` and `messages` tables have data
- Users have chatted with agents (generating usage data)

---

## Step-by-Step Implementation

### Step 1: Usage tRPC Router

**`apps/web/src/server/trpc/routers/usage.ts`**:
```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { usageRecords, agents, conversations } from "../../db/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";

export const usageRouter = router({
  // Overall spend summary
  summary: protectedProcedure
    .input(z.object({
      period: z.enum(["7d", "30d", "all"]).default("30d"),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      let dateFilter;
      if (input.period === "7d") {
        dateFilter = gte(usageRecords.createdAt, new Date(Date.now() - 7 * 86400_000));
      } else if (input.period === "30d") {
        dateFilter = gte(usageRecords.createdAt, new Date(Date.now() - 30 * 86400_000));
      }

      const conditions = dateFilter
        ? and(eq(usageRecords.userId, userId), dateFilter)
        : eq(usageRecords.userId, userId);

      const rows = await ctx.db.select({
        totalCost: sql<number>`coalesce(sum(${usageRecords.cost}), 0)`,
        totalTokensIn: sql<number>`coalesce(sum(${usageRecords.tokensIn}), 0)`,
        totalTokensOut: sql<number>`coalesce(sum(${usageRecords.tokensOut}), 0)`,
        messageCount: sql<number>`count(*)`,
      }).from(usageRecords).where(conditions);

      return rows[0] ?? { totalCost: 0, totalTokensIn: 0, totalTokensOut: 0, messageCount: 0 };
    }),

  // Spend grouped by provider
  byProvider: protectedProcedure
    .input(z.object({
      period: z.enum(["7d", "30d", "all"]).default("30d"),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      let dateFilter;
      if (input.period !== "all") {
        const days = input.period === "7d" ? 7 : 30;
        dateFilter = gte(usageRecords.createdAt, new Date(Date.now() - days * 86400_000));
      }

      const conditions = dateFilter
        ? and(eq(usageRecords.userId, userId), dateFilter)
        : eq(usageRecords.userId, userId);

      return ctx.db.select({
        provider: usageRecords.provider,
        totalCost: sql<number>`coalesce(sum(${usageRecords.cost}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${usageRecords.tokensIn} + ${usageRecords.tokensOut}), 0)`,
        count: sql<number>`count(*)`,
      }).from(usageRecords).where(conditions).groupBy(usageRecords.provider);
    }),

  // Spend grouped by agent
  byAgent: protectedProcedure
    .input(z.object({
      period: z.enum(["7d", "30d", "all"]).default("30d"),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      let dateFilter;
      if (input.period !== "all") {
        const days = input.period === "7d" ? 7 : 30;
        dateFilter = gte(usageRecords.createdAt, new Date(Date.now() - days * 86400_000));
      }

      const conditions = dateFilter
        ? and(eq(usageRecords.userId, userId), dateFilter)
        : eq(usageRecords.userId, userId);

      return ctx.db.select({
        agentId: usageRecords.agentId,
        agentName: agents.name,
        provider: agents.provider,
        totalCost: sql<number>`coalesce(sum(${usageRecords.cost}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${usageRecords.tokensIn} + ${usageRecords.tokensOut}), 0)`,
        messageCount: sql<number>`count(*)`,
      })
        .from(usageRecords)
        .leftJoin(agents, eq(usageRecords.agentId, agents.id))
        .where(conditions)
        .groupBy(usageRecords.agentId, agents.name, agents.provider)
        .orderBy(sql`sum(${usageRecords.cost}) desc`);
    }),

  // Daily cost breakdown (for chart)
  daily: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const since = new Date(Date.now() - input.days * 86400_000);

      return ctx.db.select({
        date: sql<string>`to_char(${usageRecords.createdAt}, 'YYYY-MM-DD')`,
        totalCost: sql<number>`coalesce(sum(${usageRecords.cost}), 0)`,
        tokensIn: sql<number>`coalesce(sum(${usageRecords.tokensIn}), 0)`,
        tokensOut: sql<number>`coalesce(sum(${usageRecords.tokensOut}), 0)`,
        messageCount: sql<number>`count(*)`,
      })
        .from(usageRecords)
        .where(and(eq(usageRecords.userId, userId), gte(usageRecords.createdAt, since)))
        .groupBy(sql`to_char(${usageRecords.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${usageRecords.createdAt}, 'YYYY-MM-DD')`);
    }),

  // Recent conversations across all agents
  recentConversations: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(5) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.select({
        id: conversations.id,
        title: conversations.title,
        agentName: agents.name,
        agentProvider: agents.provider,
        updatedAt: conversations.updatedAt,
      })
        .from(conversations)
        .leftJoin(agents, eq(conversations.agentId, agents.id))
        .where(eq(conversations.userId, ctx.session.user.id))
        .orderBy(desc(conversations.updatedAt))
        .limit(input.limit);
    }),
});
```

Add `usage: usageRouter` to `apps/web/src/server/trpc/root.ts`.

### Step 2: Dashboard Components

**`apps/web/src/components/dashboard/CostSummary.tsx`**:
```tsx
"use client";
import { trpc } from "@/lib/trpc";
import { formatCost } from "@/lib/cost";

export function CostSummary() {
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");
  const { data: summary } = trpc.usage.summary.useQuery({ period });
  const { data: byProvider } = trpc.usage.byProvider.useQuery({ period });

  if (!summary) return <div>Loading...</div>;

  return (
    <div>
      {/* Period selector tabs */}
      <div className="flex gap-2 mb-4">
        {(["7d", "30d", "all"] as const).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded ${period === p ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
            {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "All Time"}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card label="Total Spend" value={formatCost(summary.totalCost)} />
        <Card label="Messages" value={summary.messageCount.toLocaleString()} />
        <Card label="Tokens In" value={formatTokens(summary.totalTokensIn)} />
        <Card label="Tokens Out" value={formatTokens(summary.totalTokensOut)} />
      </div>

      {/* Per-provider breakdown */}
      {byProvider && byProvider.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">By Provider</h3>
          <div className="space-y-2">
            {byProvider.map((row) => (
              <div key={row.provider} className="flex justify-between items-center">
                <span className="capitalize">{row.provider}</span>
                <span className="font-mono">{formatCost(row.totalCost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
```

**`apps/web/src/components/dashboard/UsageChart.tsx`**:
```tsx
"use client";
import { trpc } from "@/lib/trpc";

export function UsageChart() {
  const { data: daily } = trpc.usage.daily.useQuery({ days: 30 });

  if (!daily || daily.length === 0) {
    return <div className="text-gray-400 text-center py-8">No usage data yet. Start chatting with your agents!</div>;
  }

  const maxCost = Math.max(...daily.map((d) => d.totalCost));

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-500 mb-4">Daily Spend</h3>
      <div className="flex items-end gap-1 h-40">
        {daily.map((d) => {
          const height = maxCost > 0 ? (d.totalCost / maxCost) * 100 : 0;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center group relative">
              <div
                className="w-full bg-blue-500 rounded-t hover:bg-blue-400 transition-colors"
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                {d.date}: ${d.totalCost.toFixed(4)} ({d.messageCount} msgs)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**`apps/web/src/components/dashboard/RecentConversations.tsx`**:
```tsx
"use client";
import { trpc } from "@/lib/trpc";
import Link from "next/link";

export function RecentConversations() {
  const { data: recent } = trpc.usage.recentConversations.useQuery({ limit: 5 });

  if (!recent || recent.length === 0) {
    return <p className="text-gray-400">No conversations yet.</p>;
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-500 mb-2">Recent Conversations</h3>
      <ul className="space-y-2">
        {recent.map((c) => (
          <li key={c.id}>
            <Link href={`/agents/${c.id}/chat`}
              className="flex justify-between items-center p-3 border rounded hover:bg-gray-50 dark:hover:bg-gray-800">
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-gray-500">{c.agentName} ({c.agentProvider})</p>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(c.updatedAt).toLocaleDateString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Step 3: Dashboard Page

**`apps/web/src/app/(dashboard)/dashboard/page.tsx`**:
```tsx
import { CostSummary } from "@/components/dashboard/CostSummary";
import { UsageChart } from "@/components/dashboard/UsageChart";
import { RecentConversations } from "@/components/dashboard/RecentConversations";

export default function DashboardPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <CostSummary />
      <UsageChart />
      <RecentConversations />
    </div>
  );
}
```

### Step 4: Agent Detail Stats

On the agent detail page (`/agents/[id]/page.tsx`), add a small stats section:

```tsx
// Add to the existing agent detail page
const { data: agentUsage } = trpc.usage.byAgent.useQuery({ period: "30d" });
const thisAgent = agentUsage?.find((a) => a.agentId === agent.id);

// Render below the edit form:
{thisAgent && (
  <div className="border rounded-lg p-4 mt-6">
    <h3 className="text-sm font-medium text-gray-500 mb-2">Usage (30 days)</h3>
    <div className="grid grid-cols-3 gap-4 text-center">
      <div>
        <p className="text-lg font-bold">{formatCost(thisAgent.totalCost)}</p>
        <p className="text-xs text-gray-500">Cost</p>
      </div>
      <div>
        <p className="text-lg font-bold">{thisAgent.messageCount}</p>
        <p className="text-xs text-gray-500">Messages</p>
      </div>
      <div>
        <p className="text-lg font-bold">{formatTokens(thisAgent.totalTokens)}</p>
        <p className="text-xs text-gray-500">Tokens</p>
      </div>
    </div>
  </div>
)}
```

---

## Acceptance Criteria

- [ ] Dashboard shows total spend, messages, tokens in/out for selected period
- [ ] Period selector (7d / 30d / all) updates all cards
- [ ] Per-provider breakdown shows cost per provider
- [ ] Daily spend chart renders bars for each day with hover tooltips
- [ ] Per-agent breakdown shows which agents cost the most
- [ ] Recent conversations list links to the correct chat page
- [ ] Empty states shown when no data exists
- [ ] Agent detail page shows 30-day usage stats for that agent
