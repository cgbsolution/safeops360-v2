"use client";

import { FileSpreadsheet, FileText, Paperclip, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  attachmentExt, attachmentLabel, isImageAttachment, type StoredAttachment,
} from "./lib";

/**
 * One piece of checkpoint evidence, rendered as itself.
 *
 * There are four places evidence appears — the conduct screen, the audit
 * detail's finding strip, the auditee's response widget and the iteration
 * thread — and every one of them used to render an unconditional `<img>`. That
 * was already wrong for the PDFs the backend accepted: a reviewer looking for a
 * factory licence got a broken-image icon, which reads as "the evidence is
 * missing" rather than "this is a document, click it". Widening uploads to Word
 * and Excel would have multiplied that bug by four, so the decision of how to
 * draw an attachment lives here once.
 *
 * A photograph shows its thumbnail; a document shows a named chip with its
 * format, because a document's IDENTITY is its name — "Factory_Licence_2026.pdf"
 * is the evidence, a grey rectangle is not.
 */
export function AttachmentTile({
  attachment, index, size = 14, kindLabel = "Evidence", onRemove, className,
}: {
  attachment: StoredAttachment;
  /** Position in the strip, used for accessible alt text only. */
  index?: number;
  /** Thumbnail edge in Tailwind size units (14 = 3.5rem). */
  size?: 12 | 14 | 16;
  /**
   * Whose evidence this is — "Auditor evidence" / "Auditee evidence".
   * The report's checkpoint register renders both strips one under the other,
   * and on a photograph the tile itself cannot say which is which, so the
   * distinction only survives if it reaches the tooltip and the alt text.
   */
  kindLabel?: string;
  /** Omit to render read-only — reports and closed audits have no remove. */
  onRemove?: () => void;
  className?: string;
}) {
  const box = size === 12 ? "size-12" : size === 16 ? "size-16" : "size-14";
  const isImage = isImageAttachment(attachment);
  const name = attachmentLabel(attachment);
  const ext = attachmentExt(attachment);
  const n = index != null ? index + 1 : 1;

  return (
    <div className={cn("relative", isImage ? box : "max-w-[11rem]", className)}>
      {isImage ? (
        <a
          href={attachment.url} target="_blank" rel="noreferrer"
          title={attachment.caption || `${kindLabel} — photo ${n}, open full size`}
          className={cn(box, "block overflow-hidden rounded-lg border border-slate-200 hover:ring-2 hover:ring-violet-300")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.url} alt={attachment.caption || `${kindLabel} photo ${n}`} className="size-full object-cover" />
        </a>
      ) : (
        <a
          href={attachment.url} target="_blank" rel="noreferrer"
          title={`${kindLabel} — ${name} (open)`}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 hover:border-violet-300 hover:bg-violet-50"
        >
          <DocIcon ext={ext} />
          <span className="min-w-0 flex-1">
            {/* Truncated, not wrapped: a strip of evidence tiles must stay one
                row high whatever an auditor named the file. The full name is on
                the tooltip and in the download. */}
            <span className="block truncate text-[11px] font-medium leading-tight text-slate-700">{name}</span>
            <span className="block text-[10px] uppercase tracking-wide text-slate-400">{ext}</span>
          </span>
        </a>
      )}
      {onRemove && (
        <Button
          type="button" variant="destructive" size="icon" onClick={onRemove}
          title={`Remove ${isImage ? "photo" : name}`}
          className="absolute right-0.5 top-0.5 size-4 rounded-full shadow ring-1 ring-white"
        >
          <Trash2 size={9} />
        </Button>
      )}
    </div>
  );
}

/** Format-specific mark, so a spreadsheet is distinguishable from a report at a
 *  glance rather than only by reading the filename. */
function DocIcon({ ext }: { ext: string }) {
  if (ext === "XLSX" || ext === "XLS" || ext === "CSV") {
    return <FileSpreadsheet size={16} className="shrink-0 text-emerald-600" />;
  }
  if (ext === "PDF" || ext === "DOC" || ext === "DOCX" || ext === "TXT") {
    return <FileText size={16} className="shrink-0 text-rose-600" />;
  }
  return <Paperclip size={16} className="shrink-0 text-slate-400" />;
}

/**
 * A row of evidence tiles. Nothing renders when there is none — an empty strip
 * with a heading reads as "evidence was expected and is absent", which is a
 * different claim from "this checkpoint needed none".
 */
export function AttachmentStrip({
  attachments, size = 14, kindLabel, onRemove, className,
}: {
  attachments: StoredAttachment[];
  size?: 12 | 14 | 16;
  kindLabel?: string;
  onRemove?: (index: number) => void;
  className?: string;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-start gap-2", className)}>
      {attachments.map((a, i) => (
        <AttachmentTile
          key={a.storagePath ?? a.url ?? i}
          attachment={a} index={i} size={size} kindLabel={kindLabel}
          onRemove={onRemove ? () => onRemove(i) : undefined}
        />
      ))}
    </div>
  );
}
