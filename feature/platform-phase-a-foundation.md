# Phase A: Foundation & Auth

> Self-contained implementation prompt. Copy into a Claude conversation to execute.

---

## Context

You are working on **Wai Platform** — a SaaS extension of the Wai VS Code extension (`https://github.com/gitgotgut/Wai`). The existing extension tracks AI vs. human coding patterns locally. We are transforming the repo into a Turborepo monorepo and adding a Next.js web platform.

### What Exists

The repo currently has a flat VS Code extension structure:

```
src/extension/          # Node.js extension code
src/webview/            # React webview code
esbuild.mjs             # Dual-bundle build
package.json            # Extension manifest
tsconfig.json           # Extension TS config
tsconfig.webview.json   # Webview TS config
media/                  # Compiled webview + CSS
dist/                   # Compiled extension
```

### What This Phase Delivers

- Turborepo monorepo restructure
- `apps/web/` — Next.js 15 platform with authentication
- `packages/extension/` — existing extension (moved, unchanged)
- `packages/shared/` — shared TypeScript types
- Landing page + auth + empty dashboard shell
- Deployed to Vercel

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15 (App Router) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | NextAuth v5 (Auth.js) — GitHub, Google, email magic link |
| Database | Neon Postgres (free tier) + Drizzle ORM |
| Monorepo | Turborepo |
| Hosting | Vercel (free tier) |

---

## Step-by-Step Implementation

### Step 1: Monorepo Scaffolding

Create the Turborepo root configuration:

**`turbo.json`** (root):
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "media/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Root `package.json`**:
```json
{
  "name": "wai",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "db:push": "cd apps/web && npx drizzle-kit push",
    "db:generate": "cd apps/web && npx drizzle-kit generate",
    "db:migrate": "cd apps/web && npx drizzle-kit migrate"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.5.0"
  }
}
```

### Step 2: Move Extension

1. Create `packages/extension/` directory
2. Move ALL existing extension files into it:
   - `src/` → `packages/extension/src/`
   - `esbuild.mjs` → `packages/extension/esbuild.mjs`
   - `tsconfig.json` → `packages/extension/tsconfig.json`
   - `tsconfig.webview.json` → `packages/extension/tsconfig.webview.json`
   - `media/` → `packages/extension/media/`
   - `dist/` → `packages/extension/dist/`
   - `.vscodeignore` → `packages/extension/`
3. The current root `package.json` becomes `packages/extension/package.json`:
   - Change `"name"` to `"@wai/extension"`
   - Add `"@wai/shared": "workspace:*"` to dependencies
   - Keep all existing fields (contributes, activationEvents, etc.)
4. Verify `cd packages/extension && npm run compile` still works

### Step 3: Create Shared Types Package

**`packages/shared/package.json`**:
```json
{
  "name": "@wai/shared",
  "version": "0.0.1",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

**`packages/shared/tsconfig.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

**`packages/shared/src/index.ts`**:
```typescript
export * from "./types/stats";
export * from "./types/sync";
export * from "./types/agents";
```

**`packages/shared/src/types/stats.ts`**:
Extract from the extension's `EventCollector.ts`:
```typescript
export interface DailySnapshot {
  date: string;
  aiGenerated: number;
  humanTyping: number;
  pastes: number;
  aiLinesGenerated: number;
  humanLinesTyped: number;
}

export interface LanguageStats {
  ai: number;
  human: number;
  aiLines: number;
  humanLines: number;
}

export interface SessionStats {
  startTime: number;
  humanTyping: number;
  aiGenerated: number;
  pastes: number;
  sessions: number;
  uniqueDaysActive: string[];
  commandUsageCount: Record<string, number>;
  aiLinesGenerated: number;
  humanLinesTyped: number;
  dailyHistory: DailySnapshot[];
  byLanguage: Record<string, LanguageStats>;
  totalTokensUsed?: number;
  apiCostEstimate?: number;
}
```

**`packages/shared/src/types/sync.ts`**:
```typescript
import type { SessionStats } from "./stats";

export interface SyncPayload {
  deviceId: string;
  statsSnapshot: SessionStats;
}

export interface SyncResponse {
  ok: boolean;
  error?: string;
}
```

**`packages/shared/src/types/agents.ts`**:
```typescript
export type AIProvider = "openai" | "anthropic" | "google";

export interface AgentConfig {
  name: string;
  description?: string;
  systemPrompt: string;
  model: string;
  provider: AIProvider;
  tools?: string[];
}
```

### Step 4: Initialize Next.js App

```bash
cd apps
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

Then install additional dependencies:
```bash
cd apps/web
npm install next-auth@beta @auth/drizzle-adapter drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

### Step 5: Database Schema

**`apps/web/drizzle.config.ts`**:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**`apps/web/src/server/db/index.ts`**:
```typescript
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

**`apps/web/src/server/db/schema.ts`** — Phase A tables only:
```typescript
import {
  pgTable, text, timestamp, integer, uuid, varchar,
  uniqueIndex, primaryKey,
} from "drizzle-orm/pg-core";

// ─── NextAuth tables ───────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
}, (t) => [
  uniqueIndex("accounts_provider_account_idx").on(t.provider, t.providerAccountId),
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.identifier, t.token] }),
]);

// ─── Workspaces ────────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 63 }).notNull().unique(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "member", "viewer"] }).notNull().default("member"),
  joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.userId] }),
]);
```

### Step 6: Authentication

**`apps/web/src/server/auth/index.ts`**:
```typescript
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "../db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [GitHub, Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
```

**`apps/web/src/app/(auth)/api/auth/[...nextauth]/route.ts`**:
```typescript
import { handlers } from "@/server/auth";
export const { GET, POST } = handlers;
```

**`apps/web/src/middleware.ts`**:
```typescript
import { auth } from "@/server/auth";

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith("/dashboard")) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
  if (!req.auth && req.nextUrl.pathname.startsWith("/agents")) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
  if (!req.auth && req.nextUrl.pathname.startsWith("/settings")) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/agents/:path*", "/settings/:path*"],
};
```

### Step 7: Dashboard Shell

**`apps/web/src/app/(dashboard)/layout.tsx`**:
```tsx
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header user={session.user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

Create placeholder pages:
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — "Dashboard coming soon"
- `apps/web/src/app/(dashboard)/agents/page.tsx` — "Agents coming soon"
- `apps/web/src/app/(dashboard)/settings/page.tsx` — "Settings coming soon"

### Step 8: Landing Page

**`apps/web/src/app/page.tsx`**:
Simple marketing page with:
- Hero: "Wai — AI Usage Analytics & Agent Platform"
- Subtitle: "Track your AI coding patterns. Create dedicated AI agents. Control your costs."
- CTA button: "Get Started" → `/login`
- Feature grid: Analytics, Agents, BYOK, Extension Sync

### Step 9: Deploy

1. Connect repo to Vercel (link `apps/web` as the root directory)
2. Set environment variables:
   ```
   DATABASE_URL=postgresql://...@neon.tech/wai?sslmode=require
   NEXTAUTH_URL=https://your-domain.vercel.app
   NEXTAUTH_SECRET=<random-32-chars>
   AUTH_GITHUB_ID=<from-github-oauth-app>
   AUTH_GITHUB_SECRET=<from-github-oauth-app>
   AUTH_GOOGLE_ID=<from-google-console>
   AUTH_GOOGLE_SECRET=<from-google-console>
   ```
3. Run `drizzle-kit push` to create tables in Neon
4. Deploy

---

## Acceptance Criteria

- [ ] `turbo build` succeeds for all 3 packages (extension, shared, web)
- [ ] `packages/extension/` produces working .vsix (no regressions)
- [ ] Sign in with GitHub → user row created in Neon → redirected to `/dashboard`
- [ ] Unauthenticated access to `/dashboard` redirects to `/login`
- [ ] Landing page renders at `/`
- [ ] Deployed to Vercel, production auth flow works
