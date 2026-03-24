# Phase B: API Key Management + Agent CRUD

> Self-contained implementation prompt. Copy into a Claude conversation to execute.

---

## Context

You are working on **Wai Platform** (`https://github.com/gitgotgut/Wai`). Phase A is complete: Turborepo monorepo, Next.js 15 app with NextAuth v5 (GitHub/Google), Neon Postgres + Drizzle ORM, dashboard shell with Sidebar/Header, and landing page.

### What This Phase Delivers

- tRPC setup (type-safe API layer)
- Encrypted BYOK API key management (AES-256-GCM)
- Agent CRUD (create, edit, delete AI agents)
- Auto-created personal workspace on first agent

---

## Prerequisites

Phase A must be complete:
- `apps/web/` — Next.js with auth working
- `apps/web/src/server/db/schema.ts` — users, accounts, sessions, workspaces, workspace_members tables
- `apps/web/src/server/auth/index.ts` — NextAuth configured

---

## Step-by-Step Implementation

### Step 1: Add DB Tables

Add to `apps/web/src/server/db/schema.ts`:

```typescript
import { boolean, jsonb, real } from "drizzle-orm/pg-core";

// ─── Agents ────────────────────────────────────────────

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull().default("You are a helpful assistant."),
  model: text("model").notNull().default("gpt-4o"),
  provider: text("provider", { enum: ["openai", "anthropic", "google"] }).notNull().default("openai"),
  tools: jsonb("tools").$type<string[]>().default([]),
  knowledgeBase: jsonb("knowledge_base").$type<{ type: string; ref: string }[]>().default([]),
  isPublic: boolean("is_public").notNull().default(false),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("agents_workspace_idx").on(t.workspaceId),
]);

// ─── API Keys (encrypted at rest) ─────────────────────

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["openai", "anthropic", "google"] }).notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  iv: text("iv").notNull(),
  label: text("label").notNull().default("Default"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("api_keys_user_idx").on(t.userId),
]);
```

Run `drizzle-kit push` to apply.

### Step 2: tRPC Setup

Install dependencies:
```bash
cd apps/web
npm install @trpc/server @trpc/client @trpc/react-query @tanstack/react-query superjson zod
```

**`apps/web/src/server/trpc/trpc.ts`**:
```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import { type Session } from "next-auth";
import superjson from "superjson";
import { db } from "../db";

interface CreateContextOptions {
  session: Session | null;
}

export const createTRPCContext = async (opts: CreateContextOptions) => {
  return { session: opts.session, db };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, session: { ...ctx.session, user: ctx.session.user } },
  });
});
```

**`apps/web/src/server/trpc/root.ts`**:
```typescript
import { router } from "./trpc";
import { agentsRouter } from "./routers/agents";
import { apiKeysRouter } from "./routers/apiKeys";

export const appRouter = router({
  agents: agentsRouter,
  apiKeys: apiKeysRouter,
});

export type AppRouter = typeof appRouter;
```

**`apps/web/src/app/api/trpc/[trpc]/route.ts`**:
```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/trpc";
import { auth } from "@/server/auth";

const handler = async (req: Request) => {
  const session = await auth();
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ session }),
  });
};

export { handler as GET, handler as POST };
```

**`apps/web/src/lib/trpc.ts`** — React client:
```typescript
"use client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/trpc/root";

export const trpc = createTRPCReact<AppRouter>();
```

Add a `TRPCProvider` component wrapping `QueryClientProvider` + `trpc.Provider` and include it in the root layout.

### Step 3: Encryption Module

**`apps/web/src/lib/encryption.ts`**:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const getKey = () => Buffer.from(process.env.ENCRYPTION_KEY!, "hex");

export function encrypt(plaintext: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return { ciphertext: encrypted + ":" + tag, iv: iv.toString("hex") };
}

export function decrypt(ciphertext: string, ivHex: string): string {
  const [encrypted, tagHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function mask(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}
```

**Environment variable**: Generate `ENCRYPTION_KEY` with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: API Keys Router

**`apps/web/src/server/trpc/routers/apiKeys.ts`**:
```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { apiKeys } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt, mask } from "@/lib/encryption";

export const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await ctx.db.select().from(apiKeys)
      .where(eq(apiKeys.userId, ctx.session.user.id));
    return keys.map((k) => ({
      id: k.id,
      provider: k.provider,
      label: k.label,
      maskedKey: mask(decrypt(k.encryptedKey, k.iv)),
      createdAt: k.createdAt,
    }));
  }),

  add: protectedProcedure
    .input(z.object({
      provider: z.enum(["openai", "anthropic", "google"]),
      key: z.string().min(10).max(200),
      label: z.string().max(50).default("Default"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { ciphertext, iv } = encrypt(input.key);
      const [row] = await ctx.db.insert(apiKeys).values({
        userId: ctx.session.user.id,
        provider: input.provider,
        encryptedKey: ciphertext,
        iv,
        label: input.label,
      }).returning();
      return { id: row.id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(apiKeys).where(
        and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.session.user.id))
      );
    }),

  test: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [keyRow] = await ctx.db.select().from(apiKeys).where(
        and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.session.user.id))
      );
      if (!keyRow) throw new Error("Key not found");

      const decrypted = decrypt(keyRow.encryptedKey, keyRow.iv);

      // Minimal validation call per provider
      if (keyRow.provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${decrypted}` },
        });
        if (!res.ok) throw new Error("OpenAI key is invalid");
      } else if (keyRow.provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": decrypted,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        if (!res.ok && res.status === 401) throw new Error("Anthropic key is invalid");
      }
      // Google: similar pattern with Gemini API

      return { valid: true };
    }),
});
```

### Step 5: Agents Router

**`apps/web/src/server/trpc/routers/agents.ts`**:
```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { agents, workspaces, workspaceMembers } from "../../db/schema";
import { eq, and } from "drizzle-orm";

async function getOrCreateWorkspace(db: any, userId: string) {
  const existing = await db.select().from(workspaces)
    .where(eq(workspaces.ownerId, userId)).limit(1);
  if (existing.length > 0) return existing[0];

  const [ws] = await db.insert(workspaces).values({
    name: "Personal",
    slug: `user-${userId.slice(0, 8)}`,
    ownerId: userId,
  }).returning();

  await db.insert(workspaceMembers).values({
    workspaceId: ws.id,
    userId,
    role: "owner",
  });

  return ws;
}

export const agentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const ws = await getOrCreateWorkspace(ctx.db, ctx.session.user.id);
    return ctx.db.select().from(agents).where(eq(agents.workspaceId, ws.id));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [agent] = await ctx.db.select().from(agents).where(eq(agents.id, input.id));
      return agent ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      systemPrompt: z.string().max(10000).default("You are a helpful assistant."),
      model: z.string().default("gpt-4o"),
      provider: z.enum(["openai", "anthropic", "google"]).default("openai"),
    }))
    .mutation(async ({ ctx, input }) => {
      const ws = await getOrCreateWorkspace(ctx.db, ctx.session.user.id);
      const [agent] = await ctx.db.insert(agents).values({
        workspaceId: ws.id,
        createdBy: ctx.session.user.id,
        ...input,
      }).returning();
      return agent;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      systemPrompt: z.string().max(10000).optional(),
      model: z.string().optional(),
      provider: z.enum(["openai", "anthropic", "google"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(agents).set({ ...data, updatedAt: new Date() }).where(eq(agents.id, id));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(agents).where(eq(agents.id, input.id));
    }),
});
```

### Step 6: Frontend Pages

**API Keys page** (`apps/web/src/app/(dashboard)/settings/api-keys/page.tsx`):
- Form: provider dropdown (OpenAI/Anthropic/Google), key input (password field), label
- List: masked key, provider badge, label, delete button, test button
- Test button calls `apiKeys.test` and shows success/error toast

**Agent list page** (`apps/web/src/app/(dashboard)/agents/page.tsx`):
- Grid of agent cards (name, description, provider badge, model)
- "Create Agent" button → `/agents/new`
- Click card → `/agents/[id]`

**Agent creation page** (`apps/web/src/app/(dashboard)/agents/new/page.tsx`):
- Form fields: name, description, system prompt (textarea), model select, provider select
- Model options per provider:
  - OpenAI: gpt-4o, gpt-4o-mini
  - Anthropic: claude-sonnet-4-20250514, claude-haiku-4-5-20251001
  - Google: gemini-2.5-flash, gemini-2.5-pro
- Submit → redirect to `/agents/[id]`

**Agent detail page** (`apps/web/src/app/(dashboard)/agents/[id]/page.tsx`):
- Edit form (same fields as create, pre-filled)
- Delete button with confirmation
- "Open Chat" button → `/agents/[id]/chat` (placeholder for Phase C)

---

## Acceptance Criteria

- [ ] tRPC works end-to-end (client → server → DB → response)
- [ ] Add OpenAI API key → encrypted in DB → test button validates → masked in list
- [ ] Create agent with name + prompt + model → appears in grid
- [ ] Edit agent fields → changes persisted
- [ ] Delete agent → removed from grid
- [ ] Personal workspace auto-created on first agent creation
- [ ] No plaintext API keys in DB, logs, or network responses
