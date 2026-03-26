import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { agents, workspaces, workspaceMembers } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";

type Db = ReturnType<typeof getDb>;

async function getOrCreateWorkspace(db: Db, userId: string) {
  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .limit(1);
  if (existing.length > 0) return existing[0];

  const [ws] = await db
    .insert(workspaces)
    .values({
      name: "Personal",
      slug: `user-${userId.slice(0, 8)}`,
      ownerId: userId,
    })
    .returning();

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
      const [agent] = await ctx.db
        .select()
        .from(agents)
        .where(eq(agents.id, input.id));
      return agent ?? null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        systemPrompt: z.string().max(10000).default("You are a helpful assistant."),
        model: z.string().default("gpt-4o"),
        provider: z.enum(["openai", "anthropic", "google"]).default("openai"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = await getOrCreateWorkspace(ctx.db, ctx.session.user.id);
      const [agent] = await ctx.db
        .insert(agents)
        .values({
          workspaceId: ws.id,
          createdBy: ctx.session.user.id,
          ...input,
        })
        .returning();
      return agent;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        systemPrompt: z.string().max(10000).optional(),
        model: z.string().optional(),
        provider: z.enum(["openai", "anthropic", "google"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db
        .update(agents)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(agents.id, id));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(agents).where(eq(agents.id, input.id));
    }),
});
