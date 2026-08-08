"use client";

import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { StoredPhoto } from "./lib";
import { AttachmentTile } from "./attachment-tile";
import { viewAuditAttachmentUrl } from "./upload-attachment";

/**
 * Evidence attached to an iteration — photographs as thumbnails, documents as
 * named chips (see `AttachmentTile`).
 *
 * The thread used to print the words "1 evidence file(s)" — a count of
 * photographs nobody could look at. The auditor's own finding rendered
 * thumbnails directly above it, so the auditee's proof of remediation was the
 * one piece of evidence in the record you could not see. That is exactly
 * backwards: the auditor was on site, the reviewer reading the thread was not.
 *
 * Interactions persist storage paths only (`evidenceIds`), never URLs — a
 * signed URL expires, so writing one into the immutable thread would bake in a
 * dead link. Display therefore re-signs on demand. `known` is the photo set
 * from the checkpoint's current auditor/auditee response, which already carries
 * live URLs, so the common case renders with no round trip at all; only
 * evidence from an earlier, since-overwritten round has to be signed.
 *
 * Shared by the audit detail screen and the report's checkpoint register so the
 * two cannot drift into showing different evidence for the same interaction.
 */
export function EvidenceStrip({
  evidenceIds,
  known = [],
  label = "Evidence",
  size = 14,
}: {
  evidenceIds: string[];
  known?: StoredPhoto[];
  label?: string;
  /** Thumbnail edge in Tailwind size units (14 = 3.5rem). */
  size?: 12 | 14 | 16;
}) {
  const [urls, setUrls] = useState<(string | null)[]>(() =>
    evidenceIds.map((id) => known.find((p) => p.storagePath === id)?.url ?? null),
  );

  useEffect(() => {
    let alive = true;
    const seeded = evidenceIds.map((id) => known.find((p) => p.storagePath === id)?.url ?? null);
    setUrls(seeded);
    const missing = seeded.map((u, i) => (u ? -1 : i)).filter((i) => i >= 0);
    if (missing.length === 0) return;
    (async () => {
      const signed = await Promise.all(missing.map((i) => viewAuditAttachmentUrl(evidenceIds[i])));
      if (!alive) return;
      setUrls((prev) => {
        const next = [...prev];
        missing.forEach((idx, k) => {
          next[idx] = signed[k];
        });
        return next;
      });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidenceIds.join("|"), known.length]);

  if (evidenceIds.length === 0) return null;
  const box = size === 12 ? "size-12" : size === 16 ? "size-16" : "size-14";

  return (
    <div className="mt-1.5 flex flex-wrap items-start gap-2">
      {urls.map((u, i) => {
        // Named, not silent. "This file exists but could not be loaded" is a
        // different fact from "there is no evidence", and only one of them is
        // the reviewer's problem to chase.
        if (!u) {
          return (
            <span
              key={i}
              className={`flex ${box} items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400`}
              title={`${label} — could not load ${evidenceIds[i]}`}
            >
              <Paperclip size={12} />
            </span>
          );
        }
        // A thread records evidence as a bare storage path, so whether an entry
        // is a photograph or a document has to be read off the path — which is
        // what `AttachmentTile` infers. `storagePath` must therefore be passed
        // through: given only the signed URL, a PDF would render as a broken
        // image. Any metadata on the checkpoint's current response (mimeType,
        // fileName) is merged in when present, but the freshly signed URL always
        // wins — a stale one on the known record is the dead link this component
        // exists to avoid.
        const meta = known.find((p) => p.storagePath === evidenceIds[i]);
        return (
          <AttachmentTile
            key={i}
            size={size}
            index={i}
            kindLabel={label}
            attachment={{ ...meta, storagePath: evidenceIds[i], url: u }}
          />
        );
      })}
    </div>
  );
}
