"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCcw, Loader2, AlertCircle, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Re-do FLRA action panel.
// Triggered when conditions change at site (weather, scope shift, equipment).
// Marks the current FLRA SUPERSEDED, auto-suspends the linked permit if
// ACTIVE, and creates a fresh FLRA carrying the same crew.
export function RedoFlraPanel({
  flraId,
  permitLocked
}: {
  flraId: string;
  permitLocked: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trigger() {
    if (reason.trim().length < 5) {
      setError("Reason must be at least 5 characters.");
      return;
    }
    if (!confirm("This will mark the current FLRA superseded and (if ACTIVE) suspend the linked permit. Continue?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/flra/${flraId}/redo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "Re-do failed");
        return;
      }
      router.push(`/flra/${j.newFlraId}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Re-do failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-amber-300">
      <CardHeader className="bg-amber-50/60 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <RefreshCcw size={18} /> Re-do FLRA
        </CardTitle>
        <CardDescription className="text-amber-800">
          Use this if conditions have changed materially since the FLRA was last signed — weather, adjacent operation,
          equipment issue, scope change, or crew change. The current FLRA will be marked superseded and an active
          permit will be auto-suspended until the new FLRA is signed.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {permitLocked && (
          <Alert variant="warning" className="p-3">
            <Lock size={14} />
            <AlertDescription>Linked permit is already paused. Re-do is still possible — it will create a fresh FLRA you can sign once the permit is resumed.</AlertDescription>
          </Alert>
        )}
        <Textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you re-doing this FLRA? (e.g., 'Strong wind gusts started — height work paused', 'Scope expanded to second platform')"
        />
        {error && (
          <Alert variant="destructive" size="lg" className="p-3">
            <AlertCircle className="mt-0.5" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button onClick={trigger} disabled={busy} variant="outline" className="border-amber-400 text-amber-900 hover:bg-amber-100">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
          Trigger Re-do FLRA
        </Button>
      </CardContent>
    </Card>
  );
}
