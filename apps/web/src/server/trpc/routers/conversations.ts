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
