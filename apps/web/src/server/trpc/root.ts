import { router } from "./trpc";
import { agentsRouter } from "./routers/agents";
import { apiKeysRouter } from "./routers/apiKeys";
import { conversationsRouter } from "./routers/conversations";
import { usageRouter } from "./routers/usage";
import { syncRouter } from "./routers/sync";

export const appRouter = router({
  agents: agentsRouter,
  apiKeys: apiKeysRouter,
  conversations: conversationsRouter,
  usage: usageRouter,
  sync: syncRouter,
});

export type AppRouter = typeof appRouter;
