import type { SessionStats } from "./stats";

export interface SyncPayload {
  deviceId: string;
  statsSnapshot: SessionStats;
}

export interface SyncResponse {
  ok: boolean;
  error?: string;
}

export interface SyncStatus {
  deviceId: string;
  deviceName: string;
  lastSyncAt: number; // Unix timestamp
  nextSyncAt: number; // Unix timestamp
  syncIntervalMs: number; // typically 30 minutes = 1800000
  isOnline: boolean;
  lastError?: string;
}

export interface ExtensionDevice {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  extensionVersion: string;
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
