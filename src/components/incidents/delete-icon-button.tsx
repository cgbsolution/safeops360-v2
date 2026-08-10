"use client";

// Inline trash icon for the incident list row + a header control on the detail
// page. Permission-gated so only the roles holding INCIDENT.DELETE per the RBAC
// matrix see it:
//   • HSE_MANAGER   (ALL_PLANTS — any originator, any plant)
//   • CORPORATE_HSE (ALL_PLANTS)
//   • ADMIN  (ALL_PLANTS)
//
// Incident is a *governed* entity, so the backend soft-deletes it (never a hard
// delete): it drops out of every view and its live workflow tasks are removed,
// but the full investigation record is retained and a system administrator can
// restore it within 30 days.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Can } from "@/components/auth/can";
import { useToast } from "@/components/ui/toast";

export function DeleteIncidentIconButton({
  incidentId,
  incidentNumber,
  redirectTo
}: {
  incidentId: string;
  incidentNumber: string;
  /** Where to go after a successful delete. When omitted the list is refreshed
   *  in place (list-row usage); pass "/incidents" from the detail page. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const ok = confirm(
      `Delete incident ${incidentNumber}?\n\nThis removes the incident and its full investigation record — timeline, evidence, witness statements, CAPAs, and workflow tasks — from all views. A system administrator can restore it within 30 days.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        toast({ variant: "success", title: "Deleted", description: `${incidentNumber} has been removed.` });
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
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
    <Can permission="INCIDENT.DELETE">
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        title={`Delete ${incidentNumber}`}
        className="text-rose-600 hover:text-rose-800 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      </button>
    </Can>
  );
}
