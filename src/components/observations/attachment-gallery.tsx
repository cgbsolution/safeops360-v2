"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ObservationMultiFileUpload } from "./multi-file-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, FileText, Film, Trash2, Download, Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  INITIAL_PHOTO: "Site photos",
  ACTION_EVIDENCE: "Action evidence",
  VERIFICATION_PHOTO: "Verification photos",
  DOCUMENT: "Documents"
};

export function ObservationAttachmentGallery({
  observationId,
  uploadCategory = "INITIAL_PHOTO",
  canUpload = true,
  canDelete = true,
  currentUserId
}: {
  observationId: string;
  uploadCategory?: "INITIAL_PHOTO" | "ACTION_EVIDENCE" | "VERIFICATION_PHOTO" | "DOCUMENT";
  canUpload?: boolean;
  canDelete?: boolean;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/observations/${observationId}/attachments`);
      const j = await res.json();
      if (res.ok) setItems(j.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [observationId]);

  async function handleDelete(att: Attachment) {
    if (!confirm(`Remove "${att.fileName}"?`)) return;
    const res = await fetch(`/api/observations/${observationId}/attachments/${att.id}`, {
      method: "DELETE"
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== att.id));
      router.refresh();
    }
  }

  async function handleDownload(att: Attachment, inline = false) {
    const res = await fetch(
      `/api/observations/${observationId}/attachments/${att.id}/download${inline ? "?inline=1" : ""}`
    );
    const j = await res.json();
    if (res.ok && j.url) {
      window.open(j.url, "_blank", "noopener");
    } else {
      alert(j.error ?? "Could not generate download link");
    }
  }

  // Group by category. ACTION_EVIDENCE is rendered separately by the
  // <ActionEvidencePanel> callout above, so exclude it here to avoid
  // showing the same photos twice on the page.
  const grouped = items.reduce<Record<string, Attachment[]>>((acc, a) => {
    if (a.category === "ACTION_EVIDENCE") return acc;
    (acc[a.category] = acc[a.category] ?? []).push(a);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Photos & Evidence</CardTitle>
        {canUpload && (
          <Button size="sm" variant="outline" onClick={() => setShowUpload((v) => !v)}>
            {showUpload ? <><X size={13} /> Close</> : <><Camera size={13} /> Add photos</>}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showUpload && canUpload && (
          <Card className="border rounded-md p-3 bg-slate-50/50 shadow-none">
            <ObservationMultiFileUpload
              observationId={observationId}
              category={uploadCategory}
              accept="image/*,video/*,application/pdf"
              buttonLabel="Choose files"
              helpText="Photos, short videos, or PDFs that document the observation"
              onUploaded={() => {
                void load();
                router.refresh();
              }}
            />
          </Card>
        )}

        {loading ? (
          <div className="text-sm text-slate-500 py-8 text-center">Loading…</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">
            No photos or evidence attached yet.
            {canUpload && <> Click <strong>Add photos</strong> above to upload.</>}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {CATEGORY_LABEL[cat] ?? cat} ({list.length})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {list.map((att) => (
                  <Thumb
                    key={att.id}
                    observationId={observationId}
                    att={att}
                    onLightbox={() => setLightboxId(att.id)}
                    onDownload={() => handleDownload(att)}
                    onDelete={() => handleDelete(att)}
                    canDelete={canDelete && ((att.uploadedBy?.id ?? att.uploadedById) === currentUserId)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>

      {lightboxId && (
        <Lightbox
          observationId={observationId}
          attachment={items.find((i) => i.id === lightboxId)!}
          onClose={() => setLightboxId(null)}
        />
      )}
    </Card>
  );
}

function Thumb({
  observationId,
  att,
  onLightbox,
  onDownload,
  onDelete,
  canDelete
}: {
  observationId: string;
  att: Attachment;
  onLightbox: () => void;
  onDownload: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const isImage = att.mimeType.startsWith("image/");
  const isVideo = att.mimeType.startsWith("video/");

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/observations/${observationId}/attachments/${att.id}/download?inline=1`);
        const j = await res.json();
        if (!cancelled && res.ok && j.url) setThumbUrl(j.url);
      } catch {
        /* swallow */
      }
    })();
    return () => { cancelled = true; };
  }, [att.id, observationId, isImage]);

  return (
    <Card className="group relative border rounded-md overflow-hidden bg-slate-100 aspect-square shadow-none">
      <button
        type="button"
        onClick={isImage ? onLightbox : onDownload}
        className="w-full h-full flex items-center justify-center"
      >
        {isImage && thumbUrl ? (
          <img src={thumbUrl} alt={att.caption ?? att.fileName} className="w-full h-full object-cover" />
        ) : isVideo ? (
          <Film size={28} className="text-slate-400" />
        ) : att.mimeType === "application/pdf" ? (
          <FileText size={28} className="text-slate-400" />
        ) : (
          <ImageIcon size={28} className="text-slate-400" />
        )}
      </button>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
        <div className="text-[11px] text-white truncate">{att.caption ?? att.fileName}</div>
      </div>

      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          type="button"
          onClick={onDownload}
          className="bg-white/90 hover:bg-white rounded p-1 shadow"
          title="Download"
        >
          <Download size={12} />
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="bg-white/90 hover:bg-white rounded p-1 shadow text-rose-600"
            title="Remove"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </Card>
  );
}

function Lightbox({
  observationId,
  attachment,
  onClose
}: {
  observationId: string;
  attachment: Attachment;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/observations/${observationId}/attachments/${attachment.id}/download?inline=1`);
      const j = await res.json();
      if (!cancelled && res.ok && j.url) setUrl(j.url);
    })();
    return () => { cancelled = true; };
  }, [attachment.id, observationId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white"
        aria-label="Close"
      >
        <X size={28} />
      </button>
      <div className={cn("max-w-5xl max-h-full")} onClick={(e) => e.stopPropagation()}>
        {url ? (
          <img src={url} alt={attachment.caption ?? attachment.fileName} className="max-w-full max-h-[85vh] object-contain rounded" />
        ) : (
          <div className="text-white">Loading…</div>
        )}
        {attachment.caption && (
          <div className="text-white/80 text-sm mt-3 text-center">{attachment.caption}</div>
        )}
      </div>
    </div>
  );
}
