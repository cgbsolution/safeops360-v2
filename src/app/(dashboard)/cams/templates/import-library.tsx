"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

// Bulk-import / replace a per-industry checkpoint library — the source the audit
// flow materializes from. Paste the discipline→checkpoint JSON (this is how a
// ~1500-checkpoint library is authored in one shot).
const SAMPLE = `{
  "industryCode": "MY_INDUSTRY",
  "industryName": "My Industry",
  "version": "2026.1",
  "categories": [
    {
      "category_code": "FIRE-LIFE-SAFETY",
      "category_name": "Fire & Life Safety",
      "category_color": "#ef4444",
      "checkpoints": [
        { "code": "FLS-001", "question": "Are fire exits unobstructed?", "criticality": "critical",
          "guidance": "Walk every exit route.", "standard": "NFPA 101", "requires_photo_on_fail": true }
      ]
    }
  ]
}`;

export function ImportLibraryButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      toast({ variant: "error", title: "Invalid JSON", description: "Check the structure and try again." });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/audit-compliance/library/import", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Import failed", description: j.detail ?? j.error ?? "Please check the payload." });
      return;
    }
    const j = await res.json();
    toast({ variant: "success", title: `Library ${j.created ? "created" : "updated"}`, description: `${j.industryCode} · ${j.checkpointCount} checkpoints across ${j.disciplines} disciplines.` });
    setOpen(false);
    setJson("");
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload size={14} /> Import audit library
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Import / replace audit checkpoint library</DialogTitle>
            <DialogDescription>
              Paste the discipline → checkpoint JSON. This is the source the audit flow materializes from — the way a large (≈1500-checkpoint) library is authored. Upserts by industryCode.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Library JSON</Label>
            <Textarea value={json} onChange={(e) => setJson(e.target.value)} rows={14} placeholder={SAMPLE} className="font-mono text-[11px]" />
            <Button type="button" variant="ghost" className="h-auto p-0 text-[11px] text-primary-700 hover:underline" onClick={() => setJson(SAMPLE)}>Insert sample structure</Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={submit} disabled={busy || !json.trim()}>
              {busy && <Loader2 size={14} className="animate-spin" />} Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
