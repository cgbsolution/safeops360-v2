"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Image as ImageIcon, FileText, Film, Download, X, AlertTriangle, MapPin, Loader2,
  FileVideo, FileSpreadsheet
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

type AttachmentRow = {
  id: string;
  category: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  caption: string | null;
  exifData: any;
  uploadedAt: string;
  uploadedBy: { id: string; name: string; designation: string | null };
};

const CATEGORY_LABELS: Record<string, string> = {
  INITIAL_PHOTO: "Site Photos",
  WITNESS_STATEMENT: "Witness Statements",
  CCTV: "CCTV / Video",
  EQUIPMENT_DATA: "Equipment Data",
  DOCUMENT: "Documents",
  SKETCH: "Sketches & Diagrams",
  EXTERNAL_REPORT: "External Reports",
  CAPA_EVIDENCE: "CAPA Evidence",
  CLOSURE_DOC: "Closure Documents"
};

export function AttachmentGallery({
  incidentId,
  filterCategories,
  refreshKey
}: {
  incidentId: string;
  filterCategories?: string[];
  refreshKey?: number;
}) {
  const [items, setItems] = useState<AttachmentRow[] | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [lightbox, setLightbox] = useState<{ url: string; mimeType: string; fileName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    fetch(`/api/incidents/${incidentId}/attachments`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (cancelled) return;
        let rows: AttachmentRow[] = j.items ?? [];
        if (filterCategories && filterCategories.length) {
          rows = rows.filter((it) => filterCategories.includes(it.category));
        }
        setItems(rows);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [incidentId, refreshKey, filterCategories?.join(",")]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded">
          Failed to load attachments: {error}
        </CardContent>
      </Card>
    );
  }
  if (items === null) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-slate-500">
          <Loader2 size={16} className="mx-auto animate-spin mb-2" /> Loading attachments…
        </CardContent>
      </Card>
    );
  }
  if (items.length === 0) {
    return null;
  }

  const categories = Array.from(new Set(items.map((i) => i.category)));
  const visible = activeCategory === "ALL" ? items : items.filter((it) => it.category === activeCategory);

  async function openInline(att: AttachmentRow) {
    try {
      const r = await fetch(`/api/incidents/${incidentId}/attachments/${att.id}/download?inline=1`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to load");
      setLightbox({ url: j.url, mimeType: att.mimeType, fileName: att.fileName });
    } catch (e: any) {
      alert(e?.message ?? "Failed to load preview");
    }
  }

  async function downloadFile(att: AttachmentRow) {
    try {
      const r = await fetch(`/api/incidents/${incidentId}/attachments/${att.id}/download`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to load");
      window.location.href = j.url;
    } catch (e: any) {
      alert(e?.message ?? "Failed to download");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence &amp; Attachments</CardTitle>
        <CardDescription>{items.length} item{items.length === 1 ? "" : "s"} attached</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Category filter chips */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setActiveCategory("ALL")}
              className={cn(
                "chip text-xs",
                activeCategory === "ALL" ? "bg-primary-700 text-white border-primary-700" : "bg-white text-slate-700 border-slate-300"
              )}
            >
              All <span className="opacity-70 ml-1">({items.length})</span>
            </button>
            {categories.map((c) => {
              const count = items.filter((i) => i.category === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCategory(c)}
                  className={cn(
                    "chip text-xs",
                    activeCategory === c ? "bg-primary-700 text-white border-primary-700" : "bg-white text-slate-700 border-slate-300"
                  )}
                >
                  {CATEGORY_LABELS[c] ?? c} <span className="opacity-70 ml-1">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {visible.map((att) => (
            <AttachmentTile
              key={att.id}
              incidentId={incidentId}
              att={att}
              onPreview={() => openInline(att)}
              onDownload={() => downloadFile(att)}
            />
          ))}
        </div>
      </CardContent>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white hover:text-slate-300"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-w-5xl max-h-[90vh] overflow-auto">
            {lightbox.mimeType.startsWith("image/") ? (
              <img src={lightbox.url} alt={lightbox.fileName} className="max-w-full max-h-[85vh]" />
            ) : lightbox.mimeType.startsWith("video/") ? (
              <video src={lightbox.url} controls className="max-w-full max-h-[85vh]" />
            ) : (
              <iframe src={lightbox.url} title={lightbox.fileName} className="w-[90vw] h-[80vh] bg-white" />
            )}
            <div className="text-white text-xs mt-2 text-center">{lightbox.fileName}</div>
          </div>
        </div>
      )}
    </Card>
  );
}

function AttachmentTile({
  incidentId,
  att,
  onPreview,
  onDownload
}: {
  incidentId: string;
  att: AttachmentRow;
  onPreview: () => void;
  onDownload: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const isImage = att.mimeType.startsWith("image/");
  const isVideo = att.mimeType.startsWith("video/");

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    fetch(`/api/incidents/${incidentId}/attachments/${att.id}/download?inline=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.url) setThumbUrl(j.url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [att.id, incidentId, isImage]);

  const Icon = isVideo ? FileVideo : att.mimeType === "text/csv" || att.mimeType.includes("spreadsheet") ? FileSpreadsheet : att.mimeType.includes("pdf") || att.mimeType.includes("word") ? FileText : ImageIcon;

  const sizeKb = Math.round(att.fileSize / 1024);
  const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

  return (
    <div className="rounded-lg border bg-white overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={onPreview}
        className="aspect-square bg-slate-100 flex items-center justify-center relative hover:bg-slate-200 transition group"
      >
        {isImage && thumbUrl ? (
          <img src={thumbUrl} alt={att.fileName} className="w-full h-full object-cover" />
        ) : isVideo ? (
          <div className="flex flex-col items-center text-slate-500">
            <Film size={28} />
            <span className="text-[10px] mt-1">Video</span>
          </div>
        ) : (
          <Icon size={28} className="text-slate-500" />
        )}
        <Badge className="absolute top-1.5 left-1.5 bg-black/60 text-white border-0 text-[10px]">
          {CATEGORY_LABELS[att.category] ?? att.category}
        </Badge>
      </button>
      <div className="p-2 text-xs space-y-1">
        <div className="font-medium text-slate-800 truncate" title={att.fileName}>{att.fileName}</div>
        <div className="text-[10px] text-slate-500">{sizeLabel} · {att.uploadedBy.name}</div>
        {att.caption && <div className="text-[11px] text-slate-700 italic line-clamp-2">{att.caption}</div>}
        {att.exifData?.gps && (
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <MapPin size={10} /> {att.exifData.gps.lat.toFixed(4)}, {att.exifData.gps.lng.toFixed(4)}
          </div>
        )}
        <div className="flex items-center gap-1 pt-1">
          <Button size="sm" variant="outline" onClick={onDownload} className="h-6 text-[11px] px-2">
            <Download size={11} /> Download
          </Button>
        </div>
      </div>
    </div>
  );
}

// Banner shown on the detail page when severity ≥ MTC and no INITIAL_PHOTO
// has been attached yet. Wraps MultiFileUpload so users can fix it inline.
export function MissingInitialPhotosBanner({
  show
}: {
  show: boolean;
}) {
  if (!show) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-center gap-2">
      <AlertTriangle size={14} />
      No site photos attached yet. Photos are mandatory for incidents at MTC severity and above — add at least one below.
    </div>
  );
}
