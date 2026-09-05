"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, PenLine, Lock, AlertCircle, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

type CrewRow = {
  id: string;
  userId: string;
  name: string;
  designation: string | null;
  signed: boolean;
  signedAt: Date | null;
  trainingValid: boolean;
  trainingExpiresAt: Date | null;
};

// Per-crew sign-off table. Each row is one crew member; the row for the
// currently logged-in user shows a "Sign Now" button that POSTs to
// /api/flra/[id]/sign. When all rows are signed the FLRA flips to COMPLETED
// (server-side) and the linked permit becomes activatable.
//
// The component is read-only when:
//   - FLRA is COMPLETED / SUPERSEDED / CANCELLED
//   - Linked permit is locked (SUSPENDED / EXPIRED / CLOSED)
//
// Training expiry is shown inline on each signed row for audit transparency.
export function CrewSignoffPanel({
  flraId,
  flraNumber,
  flraStatus,
  permitLocked,
  currentUserId,
  crew
}: {
  flraId: string;
  flraNumber: string;
  flraStatus: "IN_PROGRESS" | "COMPLETED" | "SUPERSEDED" | "CANCELLED";
  permitLocked: boolean;
  currentUserId: string;
  crew: CrewRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCrew = crew.length;
  const signedCount = crew.filter((c) => c.signed).length;
  const allSigned = totalCrew > 0 && signedCount === totalCrew;

  async function sign() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/flra/${flraId}/sign`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "Sign-off failed");
      } else {
        router.refresh();
      }
    } catch (e: any) {
      setError(e?.message ?? "Sign-off failed");
    } finally {
      setBusy(false);
    }
  }

  // Read-only modes
  const isReadOnly =
    flraStatus !== "IN_PROGRESS" || permitLocked;

  return (
    <Card className={allSigned ? "border-emerald-200" : "border-amber-200"}>
      <CardHeader className={allSigned ? "bg-emerald-50/60" : "bg-amber-50/60"}>
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <PenLine size={18} />
          Crew Sign-Off
          <Badge
            className={
              allSigned
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-amber-100 text-amber-700 border-amber-200"
            }
          >
            {signedCount} of {totalCrew} signed
          </Badge>
        </CardTitle>
        <CardDescription>
          {totalCrew === 0
            ? "No crew sign-off rows recorded for this FLRA. Add crew via the linked permit."
            : allSigned
              ? `All crew have signed. ${flraStatus === "COMPLETED" ? "FLRA complete." : "Refresh to see updated status."}`
              : "Each crew member must sign individually before the linked permit can become ACTIVE."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {permitLocked && (
          <Alert variant="warning" className="mb-3 p-3">
            <Lock size={14} />
            <AlertDescription>Linked permit is paused. Sign-off actions are locked until the permit is resumed.</AlertDescription>
          </Alert>
        )}

        {totalCrew === 0 ? (
          <div className="text-sm text-slate-500 italic">No crew rows to display.</div>
        ) : (
          <div className="space-y-2">
            {crew.map((row) => {
              const isMe = row.userId === currentUserId;
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {row.signed ? (
                      <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Clock size={18} className="text-slate-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {row.name}
                        {isMe && <span className="ml-2 text-[11px] text-primary-700">(you)</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {row.designation ?? "—"}
                        {row.signed && row.signedAt && (
                          <> · Signed {formatDateTime(row.signedAt)}</>
                        )}
                        {row.signed && row.trainingExpiresAt && (
                          <> · Training valid until {formatDateTime(row.trainingExpiresAt).split(",")[0]}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {row.signed ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                        Signed
                      </Badge>
                    ) : isMe && !isReadOnly ? (
                      <Button size="sm" onClick={sign} disabled={busy}>
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />}
                        Sign Now
                      </Button>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <Alert variant="destructive" size="lg" className="mt-3 p-3">
            <AlertCircle className="mt-0.5" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
