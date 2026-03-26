import { router } from "./trpc";
import { agentsRouter } from "./routers/agents";
import { apiKeysRouter } from "./routers/apiKeys";

export const appRouter = router({
  agents: agentsRouter,
  apiKeys: apiKeysRouter,
});

export type AppRouter = typeof appRouter;
