import { streamText, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db";
import { agents, apiKeys, messages, usageRecords, conversations } from "@/server/db/schema";
import { decrypt } from "@/lib/encryption";
import { calculateCost } from "@/lib/cost";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const { messages: chatMessages, agentId, conversationId } = body;

  const db = getDb();

  // 1. Load agent
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) return new Response("Agent not found", { status: 404 });

  // 2. Load user's API key for agent's provider
  const [keyRow] = await db.select().from(apiKeys).where(
    and(eq(apiKeys.userId, userId), eq(apiKeys.provider, agent.provider))
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

  // 4. Extract text content from UIMessage parts (v6 format)
  function getTextContent(msg: { parts?: Array<{ type: string; text?: string }> }): string {
    if (!msg.parts) return "";
    return msg.parts.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
  }

  // 5. Resolve or create conversation
  let convId = conversationId;
  if (!convId) {
    const firstUserMsg = chatMessages.find((m: { role: string }) => m.role === "user");
    const title = getTextContent(firstUserMsg).slice(0, 80) || "New conversation";
    const [conv] = await db.insert(conversations).values({
      agentId: agent.id,
      userId: userId,
      title,
    }).returning();
    convId = conv.id;
  }

  // 6. Persist user message
  const lastUserMsg = chatMessages[chatMessages.length - 1];
  if (lastUserMsg?.role === "user") {
    await db.insert(messages).values({
      conversationId: convId,
      role: "user",
      content: getTextContent(lastUserMsg),
    });
  }

  // 7. Stream response — convert UIMessage[] → CoreMessage[] for streamText
  const coreMessages = await convertToModelMessages(chatMessages);
  const fullMessages = [
    { role: "system" as const, content: agent.systemPrompt },
    ...coreMessages,
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
        tokenCountIn: usage.inputTokens ?? 0,
        tokenCountOut: usage.outputTokens ?? 0,
        costEstimate: cost,
        model: agent.model,
      });

      // Record usage
      await db.insert(usageRecords).values({
        userId: userId,
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        conversationId: convId,
        provider: agent.provider,
        model: agent.model,
        tokensIn: usage.inputTokens ?? 0,
        tokensOut: usage.outputTokens ?? 0,
        cost,
      });

      // Update conversation timestamp
      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, convId));
    },
  });

  return result.toTextStreamResponse({
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
