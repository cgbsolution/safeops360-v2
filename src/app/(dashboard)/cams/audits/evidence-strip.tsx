"use client";

import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { StoredPhoto } from "./lib";
import { viewAuditPhotoUrl } from "./upload-photo";

/**
 * Evidence photographs attached to an iteration, rendered as thumbnails.
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
      const signed = await Promise.all(missing.map((i) => viewAuditPhotoUrl(evidenceIds[i])));
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
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {urls.map((u, i) =>
        u ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a
            key={i}
            href={u}
            target="_blank"
            rel="noreferrer"
            className={`block ${box} overflow-hidden rounded-lg border border-slate-200 hover:ring-2 hover:ring-violet-300`}
            title={`${label} — open full size`}
          >
            <img src={u} alt={`${label} ${i + 1}`} className="size-full object-cover" />
          </a>
        ) : (
          // Named, not silent. "This file exists but could not be loaded" is a
          // different fact from "there is no evidence", and only one of them is
          // the reviewer's problem to chase.
          <span
            key={i}
            className={`flex ${box} items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400`}
            title={`Could not load ${evidenceIds[i]}`}
          >
            <Paperclip size={12} />
          </span>
        ),
      )}
    </div>
  );
}
