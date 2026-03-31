import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "dev-secret-change-in-prod"
);

export interface SyncTokenPayload {
  userId: string;
  deviceId: string;
  deviceName: string;
  iat: number;
  exp: number;
}

/**
 * Generate a sync token for extension device authentication.
 * Token is valid for 24 hours by default.
 */
export async function generateSyncToken(
  userId: string,
  deviceId: string,
  deviceName: string,
  expiresInSeconds: number = 86400 // 24 hours
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    userId,
    deviceId,
    deviceName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(SECRET);
}

/**
 * Verify and decode a sync token.
 * Returns payload if valid, throws error if invalid/expired.
 */
export async function verifySyncToken(token: string): Promise<SyncTokenPayload> {
  try {
    const verified = await jwtVerify(token, SECRET);
    return verified.payload as unknown as SyncTokenPayload;
  } catch (error) {
    throw new Error(`Invalid sync token: ${error instanceof Error ? error.message : "unknown"}`);
  }
}
