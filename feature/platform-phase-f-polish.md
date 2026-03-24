# Phase F: Polish & Scale

> Self-contained implementation prompt. Copy into a Claude conversation to execute.

---

## Context

You are working on **Wai Platform** (`https://github.com/gitgotgut/Wai`). Phases A-E are complete: the platform has auth, API key management, agent CRUD, streaming chat, usage dashboard, and extension sync. This phase hardens everything for production.

### What This Phase Delivers

- Error boundaries and graceful error handling
- Loading skeletons (React Suspense)
- Rate limiting on API routes
- Audit logging
- SEO and meta tags
- Production hardening

---

## Prerequisites

All previous phases (A-E) complete and deployed.

---

## Step-by-Step Implementation

### Step 1: Add Audit Logs Table

Add to `apps/web/src/server/db/schema.ts`:

```typescript
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("audit_workspace_idx").on(t.workspaceId),
  index("audit_created_idx").on(t.createdAt),
]);
```

Run `drizzle-kit push`.

### Step 2: Audit Logger Utility

**`apps/web/src/lib/audit.ts`**:
```typescript
import { db } from "@/server/db";
import { auditLogs } from "@/server/db/schema";

type AuditAction =
  | "agent.created" | "agent.updated" | "agent.deleted"
  | "api_key.added" | "api_key.deleted"
  | "conversation.created" | "conversation.deleted"
  | "sync.token_generated" | "sync.push_received"
  | "user.signed_in" | "user.signed_out";

export async function audit(
  userId: string,
  action: AuditAction,
  details?: Record<string, unknown>,
  workspaceId?: string,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId,
      workspaceId: workspaceId ?? null,
      action,
      details: details ?? null,
    });
  } catch {
    // Audit logging should never break the app
    console.error(`Failed to write audit log: ${action}`);
  }
}
```

Add `await audit(...)` calls to key mutation handlers in tRPC routers:
- `agents.create` → `audit(userId, "agent.created", { agentId, name })`
- `agents.delete` → `audit(userId, "agent.deleted", { agentId })`
- `apiKeys.add` → `audit(userId, "api_key.added", { provider })`
- `apiKeys.delete` → `audit(userId, "api_key.deleted", { id })`
- `sync.generateToken` → `audit(userId, "sync.token_generated")`

### Step 3: Error Boundaries

**`apps/web/src/components/ErrorBoundary.tsx`**:
```tsx
"use client";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-8 text-center">
          <h2 className="text-lg font-semibold text-red-600">Something went wrong</h2>
          <p className="text-gray-500 mt-2">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**`apps/web/src/app/(dashboard)/error.tsx`**:
```tsx
"use client";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <h2 className="text-xl font-bold text-red-600">Dashboard Error</h2>
      <p className="text-gray-500 mt-2">{error.message}</p>
      <button onClick={reset} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
        Retry
      </button>
    </div>
  );
}
```

Add `error.tsx` files to all major route groups:
- `apps/web/src/app/(dashboard)/agents/error.tsx`
- `apps/web/src/app/(dashboard)/settings/error.tsx`

### Step 4: Loading Skeletons

**`apps/web/src/app/(dashboard)/dashboard/loading.tsx`**:
```tsx
export default function DashboardLoading() {
  return (
    <div className="space-y-8 max-w-5xl animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
      <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>
  );
}
```

**`apps/web/src/app/(dashboard)/agents/loading.tsx`**:
```tsx
export default function AgentsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

### Step 5: Rate Limiting

Install: `cd apps/web && npm install @upstash/ratelimit @upstash/redis`

Alternatively, for zero-dependency in-memory rate limiting (fine for single-instance Vercel):

**`apps/web/src/lib/rate-limit.ts`**:
```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}
```

Apply to critical routes:

**`/api/chat`**: 60 requests per minute per user
**`/api/sync/push`**: 10 requests per minute per user

```typescript
// In /api/chat/route.ts, at the top of POST handler:
const { allowed } = rateLimit(`chat:${session.user.id}`, 60, 60_000);
if (!allowed) {
  return new Response("Rate limit exceeded", { status: 429 });
}
```

### Step 6: SEO and Meta Tags

**`apps/web/src/app/layout.tsx`** — update metadata:
```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Wai — AI Usage Analytics & Agent Platform",
    template: "%s | Wai",
  },
  description: "Track your AI coding patterns. Create dedicated AI agents. Control your costs. BYOK supported.",
  openGraph: {
    title: "Wai — AI Usage Analytics & Agent Platform",
    description: "Track your AI coding patterns. Create dedicated AI agents. Control your costs.",
    type: "website",
    url: "https://wai.dev",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wai — AI Usage Analytics & Agent Platform",
    description: "Track your AI coding patterns. Create dedicated AI agents. Control your costs.",
  },
};
```

Add page-level metadata to key pages:
- Dashboard: `title: "Dashboard"`
- Agents: `title: "Agents"`
- Settings: `title: "Settings"`

### Step 7: Production Environment Checks

**`apps/web/src/lib/env.ts`**:
```typescript
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Validate at startup
export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  NEXTAUTH_SECRET: requireEnv("NEXTAUTH_SECRET"),
  ENCRYPTION_KEY: requireEnv("ENCRYPTION_KEY"),
};
```

### Step 8: Not-Found and Global Error Pages

**`apps/web/src/app/not-found.tsx`**:
```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-gray-500 mt-2">Page not found</p>
      <Link href="/" className="mt-4 text-blue-600 hover:underline">Go home</Link>
    </div>
  );
}
```

**`apps/web/src/app/global-error.tsx`**:
```tsx
"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
        <button onClick={reset} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
          Retry
        </button>
      </body>
    </html>
  );
}
```

---

## Acceptance Criteria

- [ ] Error in dashboard component shows error boundary (not white screen)
- [ ] Loading skeletons appear while data fetches
- [ ] Chat endpoint returns 429 after 60+ requests in 1 minute
- [ ] Sync endpoint returns 429 after 10+ requests in 1 minute
- [ ] Audit logs recorded for agent CRUD, API key changes, token generation
- [ ] 404 page renders for unknown routes
- [ ] Meta tags appear correctly (check with og:image debugger)
- [ ] Missing env vars throw clear error at startup
- [ ] End-to-end flow: signup → add key → create agent → chat → dashboard → extension sync
- [ ] Lighthouse performance score > 90
- [ ] No unhandled promise rejections in production logs
