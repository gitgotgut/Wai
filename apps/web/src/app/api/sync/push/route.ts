import { NextRequest, NextResponse } from "next/server";
import { verifySyncToken } from "@/lib/jwt";
import { extensionSyncs } from "@/server/db/schema";
import { getDb } from "@/server/db";
import { eq, and } from "drizzle-orm";
import type { SyncPayload } from "@wai/shared";

/**
 * POST /api/sync/push
 *
 * Extension calls this endpoint to push stats.
 *
 * Authorization: Bearer <JWT_TOKEN>
 * Body: {
 *   deviceId: string,
 *   statsSnapshot: SessionStats
 * }
 *
 * Response: {
 *   ok: boolean,
 *   error?: string,
 *   nextSyncAt: number (Unix timestamp)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Extract and verify JWT token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7); // Remove "Bearer "
    let payload;
    try {
      payload = await verifySyncToken(token);
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Token verification failed",
        },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = (await req.json()) as SyncPayload;
    const { deviceId, statsSnapshot } = body;

    // 3. Validate device matches token
    if (deviceId !== payload.deviceId) {
      return NextResponse.json(
        { ok: false, error: "Device ID mismatch" },
        { status: 400 }
      );
    }

    // 4. Update or create sync record
    const db = getDb();
    const existing = await db
      .select()
      .from(extensionSyncs)
      .where(
        and(
          eq(extensionSyncs.userId, payload.userId),
          eq(extensionSyncs.deviceId, deviceId)
        )
      );

    const now = new Date();
    if (existing.length > 0) {
      await db
        .update(extensionSyncs)
        .set({
          statsSnapshot,
          lastSyncAt: now,
          updatedAt: now,
        })
        .where(eq(extensionSyncs.id, existing[0].id));
    } else {
      // Should not happen if device was registered via tRPC first
      // But handle gracefully
      await db.insert(extensionSyncs).values({
        userId: payload.userId,
        deviceId,
        deviceName: payload.deviceName,
        extensionVersion: "unknown",
        statsSnapshot,
        syncToken: token,
        lastSyncAt: now,
      });
    }

    // 5. Calculate next sync time (30 minutes from now)
    const nextSyncMs = Date.now() + 30 * 60 * 1000;

    return NextResponse.json({
      ok: true,
      nextSyncAt: nextSyncMs,
    });
  } catch (error) {
    console.error("[/api/sync/push] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
