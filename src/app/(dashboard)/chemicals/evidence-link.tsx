"use client";

// Opens an evidence document (SDS, disposal manifest).
//
// Downloads are signed, short-lived Supabase URLs minted per request — there is
// no static file path to link to. So this asks the API for a URL and opens it.
// My first version linked straight to `/api/attachments/{id}/download`, an
// endpoint that does not exist; the real route is
// `/api/evidence/{entityType}/{entityId}/{attachmentId}/download` and returns
// `{url}` rather than the bytes.

import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export function EvidenceLink({
  entityType,
  entityId,
  attachmentId,
  label = "View document",
  className,
}: {
  entityType: string;
  entityId: string;
  attachmentId: string;
  label?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function open() {
    setBusy(true);
    try {
      const r = await fetch(
        `/api/evidence/${entityType}/${entityId}/${attachmentId}/download?inline=1`
      );
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.url) {
        throw new Error(j?.detail ?? `Could not open the document (${r.status})`);
      }
      window.open(j.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({
        variant: "error",
        title: "Could not open the document",
        description: e?.message ?? "The signed link could not be created.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      }
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
      {busy ? "Opening…" : label}
    </button>
  );
}
