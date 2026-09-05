"use client";

// Inline trash icon for the Inspection list row. Permission-gated to
// HSE_MANAGER (own plant) and ADMIN (all plants) — the only roles
// holding INSPECTION.DELETE per the RBAC matrix.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Can } from "@/components/auth/can";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

export function DeleteInspectionIconButton({
  inspectionId,
  inspectionNumber
}: {
  inspectionId: string;
  inspectionNumber: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const ok = confirm(
      `Permanently delete ${inspectionNumber}?\n\nThis removes the inspection and its checklist results. This cannot be undone.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        toast({ variant: "success", title: "Deleted", description: `${inspectionNumber} has been removed.` });
        router.refresh();
        return;
      }
      const j = await res.json().catch(() => ({}));
      toast({
        variant: "error",
        title: "Delete failed",
        description: j.error ?? j.detail ?? `The server returned status ${res.status}.`
      });
    } catch (err: any) {
      toast({
        variant: "error",
        title: "Network error",
        description: err?.message ?? "Could not reach the server. Check your connection and retry."
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Can permission="INSPECTION.DELETE">
      <Button variant="ghost"
        type="button"
        onClick={handleDelete}
        disabled={busy}
        title={`Delete ${inspectionNumber}`}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      </Button>
    </Can>
  );
}
