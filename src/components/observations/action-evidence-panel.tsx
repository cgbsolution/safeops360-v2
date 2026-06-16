"use client";

// Prominent callout for the corrective-action photos the action owner
// uploaded when completing the ASSIGNEE_TASK step. Shown ABOVE the main
// "Photos & Evidence" gallery so reviewers can immediately see the proof
// of action without scrolling through site photos / verification photos.
//
// Hides itself when no ACTION_EVIDENCE attachments exist. The uploader of
// each photo can remove their own (mistaken upload, or after a rework
// rejection); the delete button hides for everyone else.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Image as ImageIcon, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Attachment = {
  id: string;
  category: string;
  fileName: string;
  mimeType: string;
  caption: string | null;
  uploadedAt: string;
  uploadedById?: string;
  uploadedBy?: { id: string; name: string; designation: string | null } | null;
};

export function ActionEvidencePanel({
  observationId,
  currentUserId
}: {
  observationId: string;
  /** When set, photos uploaded by this user show a delete button. */
  currentUserId?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Attachment[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/observations/${observationId}/attachments`);
      const j = await res.json();
      const list: Attachment[] = (res.ok ? j.items ?? [] : []).filter(
        (a: Attachment) => a.category === "ACTION_EVIDENCE"
      );
      setItems(list);
      const imageItems = list.filter((a) => a.mimeType.startsWith("image/"));
      const map: Record<string, string> = {};
      await Promise.all(
        imageItems.map(async (a) => {
          try {
            const r = await fetch(`/api/observations/${observationId}/attachments/${a.id}/download?inline=1`);
            const dj = await r.json();
            if (r.ok && dj.url) map[a.id] = dj.url;
          } catch { /* ignore */ }
        })
      );
      setThumbs(map);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observationId]);

  async function handleRemove(att: Attachment) {
    if (!confirm(`Remove "${att.fileName}"?`)) return;
    setRemovingId(att.id);
    try {
      const res = await fetch(
        `/api/observations/${observationId}/attachments/${att.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== att.id));
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? j.detail ?? "Failed to remove");
      }
    } finally {
      setRemovingId(null);
    }
  }

  if (loading || items.length === 0) return null;

  return (
    <Card className="border-emerald-300 ring-2 ring-emerald-100 bg-emerald-50/30">
      <CardHeader className="bg-emerald-50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <CardTitle className="text-emerald-900 flex items-center gap-2 text-base">
            <CheckCircle2 size={18} /> Corrective Action Evidence
          </CardTitle>
          <span className="text-xs text-emerald-700 font-medium">{items.length} photo{items.length === 1 ? "" : "s"}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((a) => {
            const uploaderId = a.uploadedBy?.id ?? a.uploadedById;
            const isMine = !!currentUserId && uploaderId === currentUserId;
            return (
              <div key={a.id} className="group relative border rounded-md overflow-hidden bg-white">
                <div className="aspect-square bg-slate-100 flex items-center justify-center">
                  {thumbs[a.id] ? (
                    <img src={thumbs[a.id]} alt={a.caption ?? a.fileName} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={24} className="text-slate-400" />
                  )}
                </div>
                {isMine && (
                  <button
                    type="button"
                    onClick={() => handleRemove(a)}
                    disabled={removingId === a.id}
                    title="Remove this photo"
                    className="absolute top-1 right-1 bg-white/95 hover:bg-rose-50 rounded p-1 shadow text-rose-600 opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <div className="p-2 text-[11px]">
                  <div className="font-medium text-slate-800 truncate">{a.uploadedBy?.name ?? "Unknown"}</div>
                  <div className="text-slate-500">{formatDateTime(a.uploadedAt)}</div>
                  {a.caption && <div className="text-slate-600 mt-1 italic truncate">"{a.caption}"</div>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
