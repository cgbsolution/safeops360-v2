// Guided Field Capture — background sync engine (spec 1.4).
// On connectivity regain: create the submission (server is idempotent on
// clientSubmissionId — retries can never duplicate), then upload its media
// (chunked + resumable above the threshold, two-phase signed-URL below it),
// then drop the outbox entry. Auth/permission failures keep entries queued;
// permanent 4xx failures mark them "failed" but keep the data.

import type { SubmissionOut, WizardMedia } from "@/lib/capture/types";
import { captureDb, notifyOutboxChanged, type OutboxEntry } from "./db";
import { uploadMedia } from "@/components/capture/upload";
import { chunkedUpload } from "./chunk-upload";

const CHUNK_THRESHOLD = 3 * 1024 * 1024; // >3 MB → resumable chunked path
const SYNC_INTERVAL_MS = 45_000;

let running = false;
let engineStarted = false;

export async function enqueueSubmission(
  payload: Record<string, unknown>,
  media: WizardMedia[],
  summary: OutboxEntry["summary"],
): Promise<void> {
  await captureDb.transaction("rw", captureDb.outbox, captureDb.media, async () => {
    for (const item of media) {
      await captureDb.media.put({
        clientMediaId: item.clientMediaId,
        kind: item.kind,
        fileName: item.fileName,
        mimeType: item.mimeType,
        durationSec: item.durationSec,
        blob: item.blob,
      });
    }
    await captureDb.outbox.put({
      clientSubmissionId: String(payload.clientSubmissionId),
      payload,
      mediaIds: media.map((m) => m.clientMediaId),
      status: "queued",
      attempts: 0,
      createdAt: Date.now(),
      summary,
    });
  });
  notifyOutboxChanged();
}

/** One sync pass. Returns how many entries fully synced. */
export async function syncOutbox(): Promise<number> {
  if (running) return 0;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  running = true;
  let synced = 0;
  try {
    const entries = await captureDb.outbox.orderBy("createdAt").toArray();
    for (const entry of entries) {
      if (entry.status === "syncing") continue;
      await captureDb.outbox.update(entry.clientSubmissionId, { status: "syncing" });
      notifyOutboxChanged();
      try {
        const res = await fetch("/api/capture/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry.payload),
        });
        if (res.status === 401 || res.status === 403) {
          // session expired / no grant — keep queued, stop the pass
          await captureDb.outbox.update(entry.clientSubmissionId, {
            status: "queued",
            lastError: `auth ${res.status}`,
          });
          break;
        }
        if (!res.ok) {
          await captureDb.outbox.update(entry.clientSubmissionId, {
            status: "failed",
            attempts: entry.attempts + 1,
            lastError: `HTTP ${res.status}`,
          });
          continue;
        }
        const created = (await res.json()) as SubmissionOut;

        // media next — server dedupes on clientMediaId, so partial retries are safe
        let allMediaOk = true;
        for (const mediaId of entry.mediaIds) {
          const stored = await captureDb.media.get(mediaId);
          if (!stored) continue;
          const wizardMedia: WizardMedia = {
            clientMediaId: stored.clientMediaId,
            kind: stored.kind,
            blob: stored.blob,
            fileName: stored.fileName,
            mimeType: stored.mimeType,
            durationSec: stored.durationSec,
          };
          const ok =
            stored.blob.size > CHUNK_THRESHOLD
              ? await chunkedUpload(created.id, wizardMedia)
              : await uploadMedia(created.id, wizardMedia);
          if (ok) {
            await captureDb.media.delete(mediaId);
          } else {
            allMediaOk = false;
          }
        }

        if (allMediaOk) {
          await captureDb.outbox.delete(entry.clientSubmissionId);
          synced += 1;
        } else {
          // submission exists; retry remaining media next pass (idempotent)
          await captureDb.outbox.update(entry.clientSubmissionId, {
            status: "queued",
            attempts: entry.attempts + 1,
            lastError: "media pending",
          });
        }
      } catch {
        // network dropped mid-pass — keep queued, stop
        await captureDb.outbox.update(entry.clientSubmissionId, { status: "queued" });
        break;
      } finally {
        notifyOutboxChanged();
      }
    }
  } finally {
    running = false;
    notifyOutboxChanged();
  }
  return synced;
}

/** Wire the engine once per page: immediate pass + on 'online' + interval. */
export function startSyncEngine(): void {
  if (engineStarted || typeof window === "undefined") return;
  engineStarted = true;
  void syncOutbox();
  window.addEventListener("online", () => void syncOutbox());
  window.setInterval(() => void syncOutbox(), SYNC_INTERVAL_MS);
}

// ── boot-data cache (bootstrap + taxonomy survive offline relaunch) ──────────
export async function fetchWithBootCache<T>(url: string, cacheKey: string): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = (await res.json()) as T;
    await captureDb.bootCache.put({ key: cacheKey, value, savedAt: Date.now() }).catch(() => undefined);
    return value;
  } catch (err) {
    const cached = await captureDb.bootCache.get(cacheKey).catch(() => undefined);
    if (cached) return cached.value as T;
    throw err;
  }
}
