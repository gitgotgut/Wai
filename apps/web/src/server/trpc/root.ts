import { router } from "./trpc";
import { agentsRouter } from "./routers/agents";
import { apiKeysRouter } from "./routers/apiKeys";
import { conversationsRouter } from "./routers/conversations";

export const appRouter = router({
  agents: agentsRouter,
  apiKeys: apiKeysRouter,
  conversations: conversationsRouter,
});

export type AppRouter = typeof appRouter;
