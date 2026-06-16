// Mints a Python-compatible JWT for the given user. Used by:
//   - auth.ts (when login goes through the Prisma fallback path)
//   - Catch-all proxy + /api/auth/permissions (every server-side request
//     to the Python backend), so the proxy doesn't depend on the session
//     having a token cached at sign-in time. Even sessions created before
//     this code shipped get a valid bearer token automatically.
//
// Both Next.js and Python sign with the same JWT_SECRET. Python's
// `get_current_user` decodes with the same secret, so any token minted
// here will validate.

import { SignJWT } from "jose";

let cachedKey: Uint8Array | null = null;
function getKey(): Uint8Array | null {
  if (cachedKey) return cachedKey;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn(
      "[backend-token] JWT_SECRET not set — every backend call will be 401. " +
        "Set JWT_SECRET in safeops_360/.env (same value as safeops_360_bakend/.env)."
    );
    return null;
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function mintBackendToken(userId: string, role: string = "WORKER"): Promise<string | null> {
  const key = getKey();
  if (!key) return null;
  return await new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key);
}
