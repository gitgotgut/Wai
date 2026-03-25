import type { SessionStats } from "./stats";

export interface SyncPayload {
  deviceId: string;
  statsSnapshot: SessionStats;
}

export interface SyncResponse {
  ok: boolean;
  error?: string;
}
