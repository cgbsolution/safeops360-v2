"use client";

// Delete button shown only to roles with OBSERVATION.DELETE per the RBAC
// matrix (HSE Manager / Corporate HSE / System Admin). The Python
// endpoint re-enforces the same permission server-side — this is just
// progressive disclosure so users without the permission don't see a
// button they can't use.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { Can } from "@/components/auth/can";
import { Alert } from "@/components/ui/alert";

export function DeleteObservationButton({
  observationId,
  observationNumber
}: {
  observationId: string;
  observationNumber: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const ok = confirm(
      `Permanently delete ${observationNumber}?\n\nThis removes the observation, its workflow history, and all photos. This cannot be undone.`
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/observations/${observationId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        router.push("/observations");
        router.refresh();
        return;
      }
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? j.detail ?? `Delete failed (${res.status})`);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Can permission="OBSERVATION.DELETE">
      <div className="space-y-2">
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Delete observation
        </Button>
        {error && (
          <Alert variant="destructive" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
            {error}
          </Alert>
        )}
      </div>
    </Can>
  );
}
