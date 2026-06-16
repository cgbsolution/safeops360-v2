"use client";

// Inline trash icon for the PTW list row. Permission-gated so only the
// roles holding PTW.DELETE per the RBAC matrix see it:
//   • PERMIT_ISSUER (OWN — own draft permits)
//   • HSE_MANAGER   (PLANT)
//   • SYSTEM_ADMIN  (ALL)

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Can } from "@/components/auth/can";
import { useToast } from "@/components/ui/toast";

export function DeletePermitIconButton({
  permitId,
  permitNumber
}: {
  permitId: string;
  permitNumber: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const ok = confirm(
      `Permanently delete ${permitNumber}?\n\nThis removes the permit, its workflow history, isolations, gas readings, suspensions, extensions, approvals, and any linked FLRA references. This cannot be undone.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ptw/${permitId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        toast({ variant: "success", title: "Deleted", description: `${permitNumber} has been removed.` });
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
    <Can permission="PTW.DELETE">
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        title={`Delete ${permitNumber}`}
        className="text-rose-600 hover:text-rose-800 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      </button>
    </Can>
  );
}
