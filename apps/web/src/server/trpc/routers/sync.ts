import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { extensionSyncs } from "../../db/schema";
import { generateSyncToken, verifySyncToken } from "@/lib/jwt";
import { eq, and } from "drizzle-orm";
import type { SessionStats } from "@wai/shared";

export const syncRouter = router({
  /**
   * Query: Get sync status for current user's devices.
   * Returns list of registered devices with last sync times.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    const devices = await ctx.db
      .select({
        id: extensionSyncs.id,
        deviceId: extensionSyncs.deviceId,
        deviceName: extensionSyncs.deviceName,
        extensionVersion: extensionSyncs.extensionVersion,
        lastSyncAt: extensionSyncs.lastSyncAt,
        createdAt: extensionSyncs.createdAt,
      })
      .from(extensionSyncs)
      .where(eq(extensionSyncs.userId, ctx.session.user.id));

    return {
      devices,
      totalDevices: devices.length,
    };
  }),

  /**
   * Mutation: Generate a sync token for extension to use.
   * Extension calls this once during setup or token refresh.
   * Token is valid for 24 hours.
   */
  generateToken: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().uuid(),
        deviceName: z.string().min(1).max(100),
        extensionVersion: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { deviceId, deviceName, extensionVersion } = input;

      // Generate JWT token
      const token = await generateSyncToken(userId, deviceId, deviceName);

      // Upsert device record
      const existing = await ctx.db
        .select()
        .from(extensionSyncs)
        .where(
          and(
            eq(extensionSyncs.userId, userId),
            eq(extensionSyncs.deviceId, deviceId)
          )
        );

      if (existing.length > 0) {
        // Update existing device
        await ctx.db
          .update(extensionSyncs)
          .set({
            deviceName,
            extensionVersion,
            syncToken: token,
            updatedAt: new Date(),
          })
          .where(eq(extensionSyncs.id, existing[0].id));
      } else {
        // Create new device record
        await ctx.db.insert(extensionSyncs).values({
          userId,
          deviceId,
          deviceName,
          extensionVersion,
          syncToken: token,
          statsSnapshot: {} as SessionStats, // Empty initially
          lastSyncAt: new Date(),
        });
      }

      return {
        token,
        expiresIn: 86400, // seconds
        deviceId,
      };
    }),

  /**
   * Mutation: Revoke/delete a device.
   * Called when user removes a device from settings page.
   */
  revokeDevice: protectedProcedure
    .input(z.object({ deviceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(extensionSyncs)
        .where(
          and(
            eq(extensionSyncs.userId, ctx.session.user.id),
            eq(extensionSyncs.deviceId, input.deviceId)
          )
        );

      return { success: true };
    }),

  /**
   * Query: Get stats for a specific device.
   * Returns last synced stats snapshot.
   */
  getDeviceStats: protectedProcedure
    .input(z.object({ deviceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [device] = await ctx.db
        .select()
        .from(extensionSyncs)
        .where(
          and(
            eq(extensionSyncs.userId, ctx.session.user.id),
            eq(extensionSyncs.deviceId, input.deviceId)
          )
        );

      if (!device) return null;

      return {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        extensionVersion: device.extensionVersion,
        statsSnapshot: device.statsSnapshot,
        lastSyncAt: device.lastSyncAt,
      };
    }),
});
