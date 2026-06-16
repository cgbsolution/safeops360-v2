"use client";

// Near-miss attachments gallery. Mirrors ObservationAttachmentGallery
// shape, talks to Python's /api/near-miss/{id}/attachments endpoints.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, FileText, Film, Trash2, Camera, X } from "lucide-react";
import { uploadNearMissAttachment } from "@/components/near-miss/upload-helper";

type Attachment = {
  id: string;
  category: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  caption: string | null;
  uploadedAt: string;
  uploadedById?: string;
  uploadedBy?: { id: string; name: string; designation: string | null } | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  INITIAL_PHOTO: "Site photos at submission",
  WITNESS_STATEMENT: "Witness statements",
  EVIDENCE: "Evidence",
  CAPA_EVIDENCE: "CAPA evidence",
  VERIFICATION_PHOTO: "Verification photos"
};

const CATEGORY_ORDER = ["INITIAL_PHOTO", "EVIDENCE", "CAPA_EVIDENCE", "VERIFICATION_PHOTO", "WITNESS_STATEMENT"];

export function NearMissAttachmentGallery({
  nearMissId,
  uploadCategory = "INITIAL_PHOTO",
  canUpload = true,
  currentUserId
}: {
  nearMissId: string;
  uploadCategory?: "INITIAL_PHOTO" | "WITNESS_STATEMENT" | "EVIDENCE" | "CAPA_EVIDENCE" | "VERIFICATION_PHOTO";
  canUpload?: boolean;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Attachment[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/near-miss/${nearMissId}/attachments`);
      const j = await res.json();
      const list: Attachment[] = res.ok ? j.items ?? [] : [];
      setItems(list);
      const map: Record<string, string> = {};
      await Promise.all(
        list.filter((a) => a.mimeType.startsWith("image/")).map(async (a) => {
          try {
            const r = await fetch(`/api/near-miss/${nearMissId}/attachments/${a.id}/download?inline=1`);
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

  useEffect(() => { void load(); }, [nearMissId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      const r = await uploadNearMissAttachment(nearMissId, f, uploadCategory);
      if (!r.ok) alert(`Upload failed: ${r.fileName} — ${r.error}`);
    }
    setUploading(false);
    setShowUpload(false);
    await load();
    router.refresh();
  }

  async function handleDelete(att: Attachment) {
    if (!confirm(`Remove "${att.fileName}"?`)) return;
    const res = await fetch(`/api/near-miss/${nearMissId}/attachments/${att.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== att.id));
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? j.detail ?? "Failed to remove");
    }
  }

  const grouped: Record<string, Attachment[]> = {};
  for (const a of items) {
    (grouped[a.category] = grouped[a.category] ?? []).push(a);
  }
  const cats = CATEGORY_ORDER.filter((c) => grouped[c]?.length);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Photos &amp; Evidence</CardTitle>
        {canUpload && (
          <Button size="sm" variant="outline" onClick={() => setShowUpload((v) => !v)}>
            {showUpload ? <><X size={13} /> Close</> : <><Camera size={13} /> Add photos</>}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showUpload && canUpload && (
          <div className="border rounded-md p-3 bg-slate-50/50">
            <input
              type="file"
              multiple
              accept="image/*,video/*,application/pdf"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
              className="text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Uploaded as: <strong>{CATEGORY_LABEL[uploadCategory]}</strong>
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-500 py-8 text-center">Loading…</div>
        ) : cats.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">No photos or evidence attached yet.</div>
        ) : (
          cats.map((cat) => (
            <div key={cat}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {CATEGORY_LABEL[cat] ?? cat} ({grouped[cat].length})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {grouped[cat].map((a) => {
                  const isImage = a.mimeType.startsWith("image/");
                  const isVideo = a.mimeType.startsWith("video/");
                  const isMine = (a.uploadedBy?.id ?? a.uploadedById) === currentUserId;
                  return (
                    <div key={a.id} className="group relative border rounded-md overflow-hidden bg-slate-100 aspect-square">
                      {isImage && thumbs[a.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbs[a.id]} alt={a.caption ?? a.fileName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {isVideo ? <Film size={28} className="text-slate-400" /> :
                           a.mimeType === "application/pdf" ? <FileText size={28} className="text-slate-400" /> :
                           <ImageIcon size={28} className="text-slate-400" />}
                        </div>
                      )}
                      {isMine && (
                        <button
                          type="button"
                          onClick={() => handleDelete(a)}
                          className="absolute top-1 right-1 bg-white/95 hover:bg-rose-50 rounded p-1 shadow text-rose-600 opacity-0 group-hover:opacity-100 transition"
                          title="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <div className="text-[10px] text-white truncate">{a.uploadedBy?.name ?? "Unknown"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
