# Phase E: Extension Sync

> Self-contained implementation prompt. Copy into a Claude conversation to execute.

---

## Context

You are working on **Wai Platform** (`https://github.com/gitgotgut/Wai`). Phases A-D are complete: auth, API keys, agent CRUD, streaming chat, usage dashboard. The platform is fully functional as a standalone web app.

### What This Phase Delivers

- Cloud sync between the VS Code extension and the platform
- Extension pushes `SessionStats` to the platform every 30 minutes
- Platform generates auth tokens for extension authentication
- Settings page showing sync status per device
- Shared types extracted to `packages/shared/`

This closes the loop: IDE coding analytics flow into the same platform as agent usage.

---

## Prerequisites

Phases A-D complete. The existing extension lives at `packages/extension/`.

### Key Existing Files

- `packages/extension/src/extension/collectors/EventCollector.ts` — contains `SessionStats`, `DailySnapshot`, `LanguageStats`
- `packages/extension/src/extension/storage/StateManager.ts` — wrapper over VS Code globalState + SecretStorage
- `packages/extension/src/extension/extension.ts` — entry point where new sync module must be registered

---

## Step-by-Step Implementation

### Step 1: Extract Shared Types

Move type definitions from the extension's `EventCollector.ts` into `packages/shared/src/types/stats.ts`. Then update extension imports to use `@wai/shared`.

**`packages/shared/src/types/stats.ts`**:
```typescript
export interface DailySnapshot {
  date: string;
  aiGenerated: number;
  humanTyping: number;
  pastes: number;
  aiLinesGenerated: number;
  humanLinesTyped: number;
}

export interface LanguageStats {
  ai: number;
  human: number;
  aiLines: number;
  humanLines: number;
}

export interface SessionStats {
  startTime: number;
  humanTyping: number;
  aiGenerated: number;
  pastes: number;
  sessions: number;
  uniqueDaysActive: string[];
  commandUsageCount: Record<string, number>;
  aiLinesGenerated: number;
  humanLinesTyped: number;
  dailyHistory: DailySnapshot[];
  byLanguage: Record<string, LanguageStats>;
  totalTokensUsed?: number;
  apiCostEstimate?: number;
}
```

**`packages/shared/src/types/sync.ts`**:
```typescript
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
  lastSyncedAt: string;
  hostname?: string;
}
```

**Update extension imports**: In `EventCollector.ts` and `SessionTracker.ts`, change:
```typescript
// Before
export interface SessionStats { ... }

// After
import type { SessionStats, DailySnapshot, LanguageStats } from "@wai/shared";
export type { SessionStats, DailySnapshot, LanguageStats };
```

**Update `packages/extension/package.json`**: Add `"@wai/shared": "workspace:*"` to dependencies.

### Step 2: Add DB Table

Add to `apps/web/src/server/db/schema.ts`:

```typescript
export const extensionSyncs = pgTable("extension_syncs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  statsSnapshot: jsonb("stats_snapshot").notNull(),
  syncedAt: timestamp("synced_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("extension_syncs_user_idx").on(t.userId),
  index("extension_syncs_device_idx").on(t.userId, t.deviceId),
]);
```

Run `drizzle-kit push`.

### Step 3: Sync Token Generation

Extension auth uses a simple JWT. The platform generates long-lived tokens from the settings page.

**`apps/web/src/lib/extension-token.ts`**:
```typescript
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

export async function generateExtensionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, purpose: "extension-sync" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(SECRET);
}

export async function verifyExtensionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.purpose !== "extension-sync") return null;
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
```

Install: `cd apps/web && npm install jose`

### Step 4: Sync REST Endpoint

**`apps/web/src/app/api/sync/push/route.ts`**:
```typescript
import { db } from "@/server/db";
import { extensionSyncs } from "@/server/db/schema";
import { verifyExtensionToken } from "@/lib/extension-token";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request) {
  // 1. Verify Bearer token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const userId = await verifyExtensionToken(token);
  if (!userId) {
    return Response.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }

  // 2. Parse payload
  const body = await req.json();
  const { deviceId, statsSnapshot } = body;

  if (!deviceId || !statsSnapshot) {
    return Response.json({ ok: false, error: "Missing deviceId or statsSnapshot" }, { status: 400 });
  }

  // 3. Upsert sync record (keep latest per device)
  // Delete previous sync for this device, insert new one
  await db.delete(extensionSyncs).where(
    and(eq(extensionSyncs.userId, userId), eq(extensionSyncs.deviceId, deviceId))
  );

  await db.insert(extensionSyncs).values({
    userId,
    deviceId,
    statsSnapshot,
  });

  return Response.json({ ok: true });
}
```

### Step 5: Sync tRPC Router

**`apps/web/src/server/trpc/routers/sync.ts`**:
```typescript
import { router, protectedProcedure } from "../trpc";
import { extensionSyncs } from "../../db/schema";
import { eq, desc } from "drizzle-orm";
import { generateExtensionToken } from "@/lib/extension-token";

export const syncRouter = router({
  // Get sync status for all devices
  status: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select({
      deviceId: extensionSyncs.deviceId,
      syncedAt: extensionSyncs.syncedAt,
      statsSnapshot: extensionSyncs.statsSnapshot,
    })
      .from(extensionSyncs)
      .where(eq(extensionSyncs.userId, ctx.session.user.id))
      .orderBy(desc(extensionSyncs.syncedAt));
  }),

  // Generate a new extension auth token
  generateToken: protectedProcedure.mutation(async ({ ctx }) => {
    const token = await generateExtensionToken(ctx.session.user.id);
    return { token };
  }),
});
```

Add `sync: syncRouter` to `apps/web/src/server/trpc/root.ts`.

### Step 6: Extension PlatformSync Module

**`packages/extension/src/extension/sync/PlatformSync.ts`**:
```typescript
import * as vscode from "vscode";
import * as os from "os";
import * as crypto from "crypto";
import type { StateManager } from "../storage/StateManager";
import type { SessionStats } from "@wai/shared";

const SYNC_INTERVAL_MS = 30 * 60 * 1_000; // 30 minutes
const DEVICE_ID_KEY = "wai.platform.deviceId";
const TOKEN_KEY = "wai.platform.token";

export class PlatformSync {
  private timer: ReturnType<typeof setInterval> | undefined;
  private deviceId: string | undefined;

  constructor(
    private readonly state: StateManager,
    private readonly output: vscode.OutputChannel,
    private readonly getStats: () => SessionStats,
  ) {}

  async start(): Promise<void> {
    const config = vscode.workspace.getConfiguration("wai.platform");
    if (!config.get<boolean>("enabled")) {
      this.output.appendLine("[wai] Platform sync disabled");
      return;
    }

    // Generate stable device ID
    this.deviceId = await this.state.getGlobalState<string>(DEVICE_ID_KEY);
    if (!this.deviceId) {
      this.deviceId = crypto.createHash("sha256")
        .update(os.hostname() + os.userInfo().username)
        .digest("hex")
        .slice(0, 16);
      await this.state.setGlobalState(DEVICE_ID_KEY, this.deviceId);
    }

    // Check for token
    const token = await this.state.getSecret(TOKEN_KEY);
    if (!token) {
      this.output.appendLine("[wai] Platform sync: no token configured");
      return;
    }

    this.output.appendLine(`[wai] Platform sync started (device: ${this.deviceId})`);
    this.sync(); // immediate
    this.timer = setInterval(() => this.sync(), SYNC_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async syncNow(): Promise<boolean> {
    return this.sync();
  }

  private async sync(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration("wai.platform");
    if (!config.get<boolean>("enabled")) return false;

    const token = await this.state.getSecret(TOKEN_KEY);
    if (!token) return false;

    const url = config.get<string>("url") ?? "https://wai.dev";

    try {
      const stats = this.getStats();
      const response = await fetch(`${url}/api/sync/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceId: this.deviceId,
          statsSnapshot: stats,
        }),
      });

      if (response.ok) {
        this.output.appendLine(`[wai] Platform sync: success`);
        return true;
      } else {
        this.output.appendLine(`[wai] Platform sync failed: ${response.status}`);
        return false;
      }
    } catch (err) {
      this.output.appendLine(`[wai] Platform sync error: ${err}`);
      return false;
    }
  }
}
```

### Step 7: Register in Extension Entry Point

Update `packages/extension/src/extension/extension.ts`:

```typescript
import { PlatformSync } from "./sync/PlatformSync";

// Inside activate():
const platformSync = new PlatformSync(
  stateManager,
  output,
  () => sessionTracker.getStats(),
);
await platformSync.start();

// Register new commands:
context.subscriptions.push(
  vscode.commands.registerCommand("wai.setPlatformToken", async () => {
    const token = await vscode.window.showInputBox({
      prompt: "Enter your Wai Platform sync token",
      password: true,
      placeHolder: "eyJhbGciOi...",
    });
    if (token) {
      await stateManager.setSecret("wai.platform.token", token);
      vscode.window.showInformationMessage("Wai Platform token saved. Sync will start on next activation.");
    }
  }),

  vscode.commands.registerCommand("wai.syncNow", async () => {
    const success = await platformSync.syncNow();
    if (success) {
      vscode.window.showInformationMessage("Synced to Wai Platform.");
    } else {
      vscode.window.showWarningMessage("Sync failed. Check output for details.");
    }
  }),
);

// In deactivate():
platformSync.stop();
```

### Step 8: Extension Package.json Updates

Add to `packages/extension/package.json` contributes:

```json
"configuration": {
  "title": "Wai",
  "properties": {
    "wai.platform.enabled": {
      "type": "boolean",
      "default": false,
      "description": "Enable syncing statistics to Wai Platform"
    },
    "wai.platform.url": {
      "type": "string",
      "default": "https://wai.dev",
      "description": "Wai Platform URL"
    }
  }
},
"commands": [
  // ... existing commands ...
  {
    "command": "wai.setPlatformToken",
    "title": "Wai: Set Platform Sync Token"
  },
  {
    "command": "wai.syncNow",
    "title": "Wai: Sync to Platform Now"
  }
]
```

### Step 9: Settings/Extensions Page

**`apps/web/src/app/(dashboard)/settings/extensions/page.tsx`**:
```tsx
"use client";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export default function ExtensionsPage() {
  const { data: syncStatus } = trpc.sync.status.useQuery();
  const generateToken = trpc.sync.generateToken.useMutation();
  const [token, setToken] = useState<string | null>(null);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Extension Sync</h1>

      {/* Token generation */}
      <section className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Sync Token</h2>
        <p className="text-sm text-gray-500 mb-4">
          Generate a token and paste it into your VS Code extension to enable cloud sync.
        </p>
        <button
          onClick={async () => {
            const result = await generateToken.mutateAsync();
            setToken(result.token);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Generate Token
        </button>
        {token && (
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs break-all">
            {token}
            <button onClick={() => navigator.clipboard.writeText(token)}
              className="ml-2 text-blue-500 hover:underline">Copy</button>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          <p>In VS Code/Antigravity, run:</p>
          <ol className="list-decimal list-inside mt-1 space-y-1">
            <li>Command Palette → <code>Wai: Set Platform Sync Token</code></li>
            <li>Paste the token above</li>
            <li>Enable <code>wai.platform.enabled</code> in settings</li>
          </ol>
        </div>
      </section>

      {/* Connected devices */}
      <section className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Connected Devices</h2>
        {(!syncStatus || syncStatus.length === 0) ? (
          <p className="text-gray-400">No devices synced yet.</p>
        ) : (
          <ul className="space-y-3">
            {syncStatus.map((s) => (
              <li key={s.deviceId} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <p className="font-mono text-sm">{s.deviceId}</p>
                  <p className="text-xs text-gray-500">
                    Last synced: {new Date(s.syncedAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-green-500 text-sm">Connected</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

---

## Sync Flow Summary

```
Platform: User generates JWT token from settings/extensions page
                        ↓
Extension: User pastes token via "Wai: Set Platform Sync Token" command
                        ↓
Extension: PlatformSync starts on activation
                        ↓
Every 30 min: POST /api/sync/push { deviceId, statsSnapshot }
                        ↓
Platform: Verify JWT → upsert extension_syncs row
                        ↓
Platform: Settings page shows device + last sync time
```

---

## Acceptance Criteria

- [ ] Generate token from platform → copy to clipboard
- [ ] Paste token into extension → stored in SecretStorage
- [ ] Enable `wai.platform.enabled` → sync starts on next activation
- [ ] Stats appear in platform settings/extensions page
- [ ] Multiple devices show separate entries
- [ ] "Sync Now" command triggers immediate sync
- [ ] Extension works normally when sync is disabled
- [ ] Invalid/expired token returns 401, extension logs error
- [ ] Shared types in `@wai/shared` used by both extension and platform
