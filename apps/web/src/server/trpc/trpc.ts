import { initTRPC, TRPCError } from "@trpc/server";
import { type Session } from "next-auth";
import superjson from "superjson";
import { getDb } from "../db";

interface CreateContextOptions {
  session: Session | null;
}

export const createTRPCContext = async (opts: CreateContextOptions) => {
  return { session: opts.session, db: getDb() };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: {
        ...ctx.session,
        user: { ...ctx.session.user, id: ctx.session.user.id },
      },
    },
  });
});
