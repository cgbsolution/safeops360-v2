import type { NextRequest } from "next/server";

/**
 * Pull the versioning query params off an incoming request so they can be
 * forwarded to the FastAPI handler.
 *
 * These are query params on the backend, not body fields. Dropping them was a
 * real defect: `changeReason` is mandatory once a study is APPROVED/ACTIVE, so
 * the child sync calls 422'd; and without `skipVersion` each one filed its own
 * HiraVersion row for a save the PATCH had already versioned, which collided on
 * the (entryId, versionNumber) unique constraint and 500'd every later save.
 */
export function versioningQuery(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  return {
    changeReason: params.get("changeReason") ?? undefined,
    skipVersion: params.get("skipVersion") ?? undefined
  };
}
