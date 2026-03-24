# Phase C: Chat Interface

> Self-contained implementation prompt. Copy into a Claude conversation to execute.

---

## Context

You are working on **Wai Platform** (`https://github.com/gitgotgut/Wai`). Phase A (auth + dashboard shell) and Phase B (API keys + agent CRUD) are complete. Users can sign in, store encrypted API keys, and create AI agents.

### What This Phase Delivers

- Streaming AI chat with agents via Vercel AI SDK
- Conversation persistence (messages stored in Postgres)
- Token counting and cost tracking per message
- Multi-provider support (OpenAI, Anthropic, Google)

This is the **core product moment** — users can chat with their configured agents.

---

## Prerequisites

Phase B must be complete:
- `agents` and `api_keys` tables exist with data
- tRPC is wired up with `agentsRouter` and `apiKeysRouter`
- Users can create agents and store encrypted API keys

---

## Step-by-Step Implementation

### Step 1: Add DB Tables

Add to `apps/web/src/server/db/schema.ts`:

```typescript
// ─── Conversations & Messages ──────────────────────────

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New conversation"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("conversations_agent_idx").on(t.agentId),
  index("conversations_user_idx").on(t.userId),
]);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  tokenCountIn: integer("token_count_in"),
  tokenCountOut: integer("token_count_out"),
  costEstimate: real("cost_estimate"),
  model: text("model"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("messages_conversation_idx").on(t.conversationId),
]);

// ─── Usage Records ─────────────────────────────────────

export const usageRecords = pgTable("usage_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  agentId: uuid("agent_id").references(() => agents.id),
  conversationId: uuid("conversation_id").references(() => conversations.id),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  cost: real("cost").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("usage_user_idx").on(t.userId),
  index("usage_workspace_idx").on(t.workspaceId),
  index("usage_created_idx").on(t.createdAt),
]);
```

Run `drizzle-kit push` to apply.

### Step 2: Install AI SDK

```bash
cd apps/web
npm install ai @ai-sdk/react @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

### Step 3: Cost Calculation

**`apps/web/src/lib/cost.ts`**:
```typescript
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
  provider: string,
  model: string,
  usage: { promptTokens: number; completionTokens: number },
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}
```

### Step 4: Chat Streaming Endpoint

**`apps/web/src/app/api/chat/route.ts`**:
```typescript
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { agents, apiKeys, messages, usageRecords, conversations } from "@/server/db/schema";
import { decrypt } from "@/lib/encryption";
import { calculateCost } from "@/lib/cost";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { messages: chatMessages, agentId, conversationId } = body;

  // 1. Load agent
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) return new Response("Agent not found", { status: 404 });

  // 2. Load user's API key for agent's provider
  const [keyRow] = await db.select().from(apiKeys).where(
    and(eq(apiKeys.userId, session.user.id), eq(apiKeys.provider, agent.provider))
  );
  if (!keyRow) {
    return new Response(
      `No ${agent.provider} API key configured. Add one in Settings > API Keys.`,
      { status: 400 }
    );
  }

  const decryptedKey = decrypt(keyRow.encryptedKey, keyRow.iv);

  // 3. Create provider client
  const providerClient = createProviderClient(agent.provider, decryptedKey);

  // 4. Resolve or create conversation
  let convId = conversationId;
  if (!convId) {
    const firstUserMsg = chatMessages.find((m: any) => m.role === "user");
    const title = firstUserMsg?.content?.slice(0, 80) || "New conversation";
    const [conv] = await db.insert(conversations).values({
      agentId: agent.id,
      userId: session.user.id,
      title,
    }).returning();
    convId = conv.id;
  }

  // 5. Persist user message
  const lastUserMsg = chatMessages[chatMessages.length - 1];
  if (lastUserMsg?.role === "user") {
    await db.insert(messages).values({
      conversationId: convId,
      role: "user",
      content: lastUserMsg.content,
    });
  }

  // 6. Stream response
  const fullMessages = [
    { role: "system" as const, content: agent.systemPrompt },
    ...chatMessages,
  ];

  const result = streamText({
    model: providerClient(agent.model),
    messages: fullMessages,
    onFinish: async ({ usage, text }) => {
      const cost = calculateCost(agent.provider, agent.model, usage);

      // Persist assistant message
      await db.insert(messages).values({
        conversationId: convId,
        role: "assistant",
        content: text,
        tokenCountIn: usage.promptTokens,
        tokenCountOut: usage.completionTokens,
        costEstimate: cost,
        model: agent.model,
      });

      // Record usage
      await db.insert(usageRecords).values({
        userId: session.user.id,
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        conversationId: convId,
        provider: agent.provider,
        model: agent.model,
        tokensIn: usage.promptTokens,
        tokensOut: usage.completionTokens,
        cost,
      });

      // Update conversation timestamp
      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, convId));
    },
  });

  // Include conversationId in response headers for the frontend
  return result.toDataStreamResponse({
    headers: { "X-Conversation-Id": convId },
  });
}

function createProviderClient(provider: string, apiKey: string) {
  switch (provider) {
    case "openai": return createOpenAI({ apiKey });
    case "anthropic": return createAnthropic({ apiKey });
    case "google": return createGoogleGenerativeAI({ apiKey });
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}
```

### Step 5: Conversations tRPC Router

**`apps/web/src/server/trpc/routers/conversations.ts`**:
```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { conversations, messages } from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";

export const conversationsRouter = router({
  list: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(conversations)
        .where(and(
          eq(conversations.agentId, input.agentId),
          eq(conversations.userId, ctx.session.user.id),
        ))
        .orderBy(desc(conversations.updatedAt));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [conv] = await ctx.db.select().from(conversations)
        .where(and(
          eq(conversations.id, input.id),
          eq(conversations.userId, ctx.session.user.id),
        ));
      if (!conv) return null;

      const msgs = await ctx.db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(messages.createdAt);

      return { ...conv, messages: msgs };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(conversations).where(
        and(eq(conversations.id, input.id), eq(conversations.userId, ctx.session.user.id))
      );
    }),
});
```

Add `conversations: conversationsRouter` to `apps/web/src/server/trpc/root.ts`.

### Step 6: Chat UI Components

**`apps/web/src/components/chat/MessageBubble.tsx`**:
```tsx
interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
        isUser ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"
      }`}>
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
```

**`apps/web/src/components/chat/ChatInterface.tsx`**:
```tsx
"use client";
import { useChat } from "@ai-sdk/react";
import { MessageBubble } from "./MessageBubble";
import { useEffect, useRef } from "react";

interface ChatInterfaceProps {
  agentId: string;
  conversationId?: string;
  initialMessages?: Array<{ id: string; role: "user" | "assistant"; content: string }>;
}

export function ChatInterface({ agentId, conversationId, initialMessages }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: { agentId, conversationId },
    initialMessages,
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            Send a message to start the conversation.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role as "user" | "assistant"} content={m.content} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
        <textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="flex-1 resize-none border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as any);
            }
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

### Step 7: Chat Page

**`apps/web/src/app/(dashboard)/agents/[id]/chat/page.tsx`**:
```tsx
import { ChatInterface } from "@/components/chat/ChatInterface";

// Server component that loads agent + passes to client
export default async function ChatPage({ params }: { params: { id: string } }) {
  // Agent name could be fetched server-side for the header
  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Optional: ConversationSidebar on the left */}
      <div className="flex-1">
        <ChatInterface agentId={params.id} />
      </div>
    </div>
  );
}
```

Update the agent detail page (`/agents/[id]/page.tsx`) to include an "Open Chat" link to `/agents/[id]/chat`.

---

## Chat Flow Summary

```
User types message → useChat hook → POST /api/chat
                                       ↓
                              Load agent config
                              Decrypt BYOK key
                              Create provider client
                              streamText() → SSE stream → real-time rendering
                                       ↓ (onFinish)
                              Persist user message
                              Persist assistant message (with token counts)
                              Insert usage_record (tokens + cost)
                              Update conversation.updatedAt
```

---

## Acceptance Criteria

- [ ] Send message to GPT-4o agent → see streaming response character by character
- [ ] Send message to Claude agent → streaming works with Anthropic provider
- [ ] Send message to Gemini agent → streaming works with Google provider
- [ ] Conversation persisted in DB → reload page → history intact
- [ ] Token counts (in/out) recorded per message
- [ ] Cost estimate calculated and stored per message
- [ ] Usage record inserted per completion
- [ ] Enter key sends message, Shift+Enter adds newline
- [ ] Error shown when no API key configured for agent's provider
- [ ] "Thinking..." indicator shown during streaming
