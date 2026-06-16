import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function buildUrl() {
  const base = process.env.DATABASE_URL ?? "";
  // We run on Vercel serverless against Supabase Free tier — pgbouncer's
  // pool ceiling is ~15 connections total. Each Lambda creates its own
  // Prisma client, so the per-client limit must be SMALL or concurrent
  // Lambdas blow past the ceiling and every request fails until idle
  // Lambdas die (the "suddenly works, suddenly doesn't" symptom).
  //
  //   connection_limit=1 → up to 15 concurrent Lambdas before exhaustion
  //   connection_limit=10 → only ~1-2 concurrent Lambdas before exhaustion
  //
  // The dashboard's 7 parallel queries serialise inside the single
  // connection but Prisma queues them efficiently — slower than parallel,
  // but vastly more reliable. The real fix for dashboard latency is to
  // (a) cache the page (revalidate=30) and (b) eventually move heavy
  // aggregations to the Python backend.
  //
  // pool_timeout=20 — give queued queries enough time to complete on a
  // cold Lambda. The default of 10s was tripping on cold starts.
  //
  // statement_timeout is NOT a libpq / Prisma connection-string parameter
  // (it's a server-side GUC). Including it has caused URL-parse failures
  // against the Supabase pooler in production. Leave it off.
  const [baseNoQuery, baseQuery] = base.split("?");
  const params = new URLSearchParams(baseQuery || "");
  params.set("connection_limit", "1");
  params.set("pool_timeout", "20");
  if (!params.has("pgbouncer")) params.set("pgbouncer", "true");
  params.delete("statement_timeout");
  return `${baseNoQuery}?${params.toString()}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: buildUrl() } },
    log: ["error"]
  });

// Always store on globalThis — the original code only did this in dev,
// which meant production created a new PrismaClient on every module import.
globalForPrisma.prisma = prisma;
