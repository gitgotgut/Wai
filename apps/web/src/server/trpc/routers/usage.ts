import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { usageRecords, agents, conversations } from "../../db/schema";
import { eq, gte, sql, desc } from "drizzle-orm";

const periodSchema = z.enum(["7d", "30d", "all"]).default("30d");

function getPeriodCutoff(period: "7d" | "30d" | "all"): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

export const usageRouter = router({
  summary: protectedProcedure
    .input(z.object({ period: periodSchema }))
    .query(async ({ ctx, input }) => {
      const cutoff = getPeriodCutoff(input.period);
      const whereClause = cutoff
        ? sql`${usageRecords.userId} = ${ctx.session.user.id} AND ${usageRecords.createdAt} >= ${cutoff}`
        : sql`${usageRecords.userId} = ${ctx.session.user.id}`;

      const [result] = await ctx.db
        .select({
          totalCost: sql<number>`COALESCE(SUM(${usageRecords.cost}), 0)`,
          totalTokensIn: sql<number>`COALESCE(SUM(${usageRecords.tokensIn}), 0)`,
          totalTokensOut: sql<number>`COALESCE(SUM(${usageRecords.tokensOut}), 0)`,
          messageCount: sql<number>`COUNT(*)`,
        })
        .from(usageRecords)
        .where(whereClause);

      return {
        totalCost: Number(result?.totalCost ?? 0),
        totalTokensIn: Number(result?.totalTokensIn ?? 0),
        totalTokensOut: Number(result?.totalTokensOut ?? 0),
        messageCount: Number(result?.messageCount ?? 0),
      };
    }),

  byAgent: protectedProcedure
    .input(z.object({ period: periodSchema }))
    .query(async ({ ctx, input }) => {
      const cutoff = getPeriodCutoff(input.period);
      const whereClause = cutoff
        ? sql`${usageRecords.userId} = ${ctx.session.user.id} AND ${usageRecords.createdAt} >= ${cutoff}`
        : sql`${usageRecords.userId} = ${ctx.session.user.id}`;

      const rows = await ctx.db
        .select({
          agentId: usageRecords.agentId,
          agentName: agents.name,
          cost: sql<number>`COALESCE(SUM(${usageRecords.cost}), 0)`,
          tokensIn: sql<number>`COALESCE(SUM(${usageRecords.tokensIn}), 0)`,
          tokensOut: sql<number>`COALESCE(SUM(${usageRecords.tokensOut}), 0)`,
          messageCount: sql<number>`COUNT(*)`,
        })
        .from(usageRecords)
        .leftJoin(agents, eq(usageRecords.agentId, agents.id))
        .where(whereClause)
        .groupBy(usageRecords.agentId, agents.name)
        .orderBy(sql`SUM(${usageRecords.cost}) DESC`);

      return rows.map((r) => ({
        agentId: r.agentId,
        agentName: r.agentName ?? "Unknown",
        cost: Number(r.cost),
        tokensIn: Number(r.tokensIn),
        tokensOut: Number(r.tokensOut),
        messageCount: Number(r.messageCount),
      }));
    }),

  daily: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.days);

      const rows = await ctx.db
        .select({
          date: sql<string>`TO_CHAR(${usageRecords.createdAt}, 'YYYY-MM-DD')`,
          cost: sql<number>`COALESCE(SUM(${usageRecords.cost}), 0)`,
        })
        .from(usageRecords)
        .where(
          sql`${usageRecords.userId} = ${ctx.session.user.id} AND ${usageRecords.createdAt} >= ${cutoff}`
        )
        .groupBy(sql`TO_CHAR(${usageRecords.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${usageRecords.createdAt}, 'YYYY-MM-DD') ASC`);

      return rows.map((r) => ({ date: r.date, cost: Number(r.cost) }));
    }),

  recentConversations: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: conversations.id,
        agentId: conversations.agentId,
        agentName: agents.name,
        title: conversations.title,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .leftJoin(agents, eq(conversations.agentId, agents.id))
      .where(eq(conversations.userId, ctx.session.user.id))
      .orderBy(desc(conversations.updatedAt))
      .limit(10);

    return rows.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      agentName: r.agentName ?? "Unknown",
      title: r.title,
      updatedAt: r.updatedAt,
    }));
  }),
});
