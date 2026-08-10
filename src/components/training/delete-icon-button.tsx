"use client";

// Inline trash icon for the Training list row. Permission-gated to:
//   • LD_MANAGER   (OWN — own draft training records)
//   • HSE_MANAGER  (PLANT)
//   • ADMIN (ALL)

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Can } from "@/components/auth/can";
import { useToast } from "@/components/ui/toast";

export function DeleteTrainingIconButton({
  recordId,
  label
}: {
  recordId: string;
  label: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const ok = confirm(
      `Permanently delete training record for ${label}?\n\nThis cannot be undone.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/training/${recordId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        toast({ variant: "success", title: "Deleted", description: `Record for ${label} has been removed.` });
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
    <Can permission="TRAINING.DELETE">
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        title={`Delete training record for ${label}`}
        className="text-rose-600 hover:text-rose-800 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      </button>
    </Can>
  );
}
