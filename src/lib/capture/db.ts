// Guided Field Capture — IndexedDB layer (dexie).
// Submissions are written locally FIRST (outbox) with the client-generated
// UUID; media blobs live alongside. The boot cache mirrors /bootstrap +
// /taxonomy so the wizard renders with zero network (spec 1.4).

import Dexie, { type Table } from "dexie";

export type OutboxStatus = "queued" | "syncing" | "failed";

export type OutboxEntry = {
  clientSubmissionId: string; // PK — server idempotency key
  payload: Record<string, unknown>; // SubmissionCreate body (capture.offline=true)
  mediaIds: string[];
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  // for the My Reports offline rows
  summary: {
    type: string;
    categoryLabels?: Record<string, string> | null;
    iconKey?: string | null;
    severity: string;
  };
};

export type OutboxMedia = {
  clientMediaId: string; // PK
  kind: "PHOTO" | "VIDEO" | "VOICE";
  fileName: string;
  mimeType: string;
  durationSec?: number;
  blob: Blob;
};

export type BootCacheEntry = {
  key: string; // "bootstrap" | "taxonomy:HAZARD" | ...
  value: unknown;
  savedAt: number;
};

class CaptureDB extends Dexie {
  outbox!: Table<OutboxEntry, string>;
  media!: Table<OutboxMedia, string>;
  bootCache!: Table<BootCacheEntry, string>;

  constructor() {
    super("safeops-capture");
    this.version(1).stores({
      outbox: "clientSubmissionId, status, createdAt",
      media: "clientMediaId",
      bootCache: "key",
    });
  }
}

// Singleton — module-scope is fine (client bundles only).
export const captureDb = new CaptureDB();

const OUTBOX_EVENT = "capture-outbox-changed";

export function notifyOutboxChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OUTBOX_EVENT));
}

export function onOutboxChanged(handler: () => void): () => void {
  window.addEventListener(OUTBOX_EVENT, handler);
  return () => window.removeEventListener(OUTBOX_EVENT, handler);
}

export async function outboxCount(): Promise<number> {
  try {
    return await captureDb.outbox.count();
  } catch {
    return 0;
  }
}
