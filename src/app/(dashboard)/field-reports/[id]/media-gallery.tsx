"use client";

// Evidence gallery for a field report — resolves short-lived signed download
// URLs per attachment and renders photos inline, audio/video with native
// controls. URLs expire in ~5 min; a refresh re-mints them.

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import type { AttachmentOut } from "@/lib/capture/types";
import { Card } from "@/components/ui/card";

export function MediaGallery({
  submissionId,
  attachments,
}: {
  submissionId: string;
  attachments: AttachmentOut[];
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        attachments.map(async (att) => {
          try {
            const res = await fetch(`/api/capture/submissions/${submissionId}/attachments/${att.id}/download`);
            if (!res.ok) return [att.id, ""] as const;
            const data = (await res.json()) as { url: string };
            return [att.id, data.url] as const;
          } catch {
            return [att.id, ""] as const;
          }
        }),
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId, attachments]);

  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">No media attached.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {attachments.map((att) => {
        const url = urls[att.id];
        return (
          <Card key={att.id} className="overflow-hidden rounded-md border bg-muted/30 shadow-none">
            {att.kind === "PHOTO" && url ? (
              <a href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={att.fileName} className="h-36 w-full object-cover" />
              </a>
            ) : att.kind === "VIDEO" && url ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={url} controls preload="metadata" className="h-36 w-full bg-black object-contain" />
            ) : att.kind === "VOICE" && url ? (
              <div className="flex h-36 flex-col items-center justify-center gap-2 p-3">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio src={url} controls className="w-full" />
                {att.durationSec ? <span className="text-xs text-muted-foreground">{Math.round(att.durationSec)}s voice note</span> : null}
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center">
                {url === "" && Object.keys(urls).length > 0 ? (
                  <span className="px-2 text-center text-xs text-muted-foreground">Unavailable</span>
                ) : (
                  <FileText className="h-8 w-8 animate-pulse text-muted-foreground" />
                )}
              </div>
            )}
            <p className="truncate border-t bg-card px-2 py-1.5 text-xs text-muted-foreground">
              {att.kind.toLowerCase()} · {(att.fileSize / 1024).toFixed(0)} KB
            </p>
          </Card>
        );
      })}
    </div>
  );
}
