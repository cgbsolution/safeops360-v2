// Resumable chunked upload (spec 1.4): big media from flaky networks goes up
// in <=2 MB base64 chunks (the Vercel proxy text-decodes request bodies, so
// raw binary can't transit it). The server staged-assembles, dedupes on
// content hash, and attaches to the submission. init → missing chunks →
// complete; every step is idempotent, so a dropped connection just resumes.

import type { WizardMedia } from "@/lib/capture/types";

const CHUNK_SIZE = 2 * 1024 * 1024;

async function sha256Hex(blob: Blob): Promise<string | null> {
  try {
    const buf = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null; // no WebCrypto (http on old Android) — server skips verification
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000; // avoid call-stack limits on large chunks
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export async function chunkedUpload(submissionId: string, media: WizardMedia): Promise<boolean> {
  try {
    const totalChunks = Math.max(1, Math.ceil(media.blob.size / CHUNK_SIZE));
    const sha256 = await sha256Hex(media.blob);

    const initRes = await fetch("/api/capture/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientMediaId: media.clientMediaId,
        fileName: media.fileName,
        mimeType: media.mimeType,
        kind: media.kind,
        totalSize: media.blob.size,
        chunkSize: CHUNK_SIZE,
        totalChunks,
        sha256,
      }),
    });
    if (!initRes.ok) return false;
    const init = (await initRes.json()) as {
      sessionId: string;
      receivedIndexes: number[];
      alreadyStored: boolean;
    };

    if (!init.alreadyStored) {
      const received = new Set(init.receivedIndexes);
      const buf = new Uint8Array(await media.blob.arrayBuffer());
      for (let index = 0; index < totalChunks; index++) {
        if (received.has(index)) continue; // resume: skip what the server has
        const slice = buf.subarray(index * CHUNK_SIZE, Math.min((index + 1) * CHUNK_SIZE, buf.length));
        const chunkRes = await fetch(`/api/capture/uploads/${init.sessionId}/chunk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index, dataB64: toBase64(slice) }),
        });
        if (!chunkRes.ok) return false;
      }
    }

    const completeRes = await fetch(`/api/capture/uploads/${init.sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, durationSec: media.durationSec ?? null }),
    });
    return completeRes.ok;
  } catch {
    return false;
  }
}
