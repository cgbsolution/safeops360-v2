// Guided Field Capture — client media helpers.
// Photos are canvas-compressed before upload (cheap Android on 3G is the
// design target); everything then flows through the platform's two-phase
// signed-URL upload against /api/capture/submissions/:id/attachments.

import type { WizardMedia } from "@/lib/capture/types";

const MAX_PHOTO_EDGE = 1600;
const PHOTO_QUALITY = 0.8;
export const MAX_VIDEO_SECONDS = 30;
export const MAX_VOICE_SECONDS = 60;
export const MAX_FILE_BYTES = 60 * 1024 * 1024;

export function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Blob → base64 (no data: prefix) for the vision-suggest JSON body. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

/** Downscale + re-encode a camera photo. Falls back to the original file on
 *  any decode/canvas failure (never blocks submission on a broken codec). */
export async function compressPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size < 1.5 * 1024 * 1024) return file; // already small
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Read the duration of a recorded audio/video blob (seconds), or null. */
export function mediaDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(blob.type.startsWith("audio") ? "audio" : "video");
    const url = URL.createObjectURL(blob);
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      // Chrome bug: MediaRecorder blobs report Infinity until seeked
      if (el.duration === Infinity) {
        el.currentTime = 1e10;
        el.ontimeupdate = () => {
          el.ontimeupdate = null;
          done(Number.isFinite(el.duration) ? el.duration : null);
        };
      } else {
        done(Number.isFinite(el.duration) ? el.duration : null);
      }
    };
    el.onerror = () => done(null);
    el.src = url;
  });
}

/** Two-phase upload of one wizard media item to a created submission.
 *  Returns true on success; failures are non-fatal (the submission already
 *  exists server-side — media can be retried from My Reports later). */
export async function uploadMedia(submissionId: string, media: WizardMedia): Promise<boolean> {
  try {
    const initRes = await fetch(`/api/capture/submissions/${submissionId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: "init",
        kind: media.kind,
        fileName: media.fileName,
        fileSize: media.blob.size,
        mimeType: media.mimeType,
        durationSec: media.durationSec ?? null,
        clientMediaId: media.clientMediaId,
      }),
    });
    if (!initRes.ok) return false;
    const init = (await initRes.json()) as { attachmentId: string; uploadUrl: string };

    const put = await fetch(init.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": media.mimeType },
      body: media.blob,
    });
    if (!put.ok) return false;

    const complete = await fetch(`/api/capture/submissions/${submissionId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: "complete",
        attachmentId: init.attachmentId,
        durationSec: media.durationSec ?? null,
      }),
    });
    return complete.ok;
  } catch {
    return false;
  }
}
