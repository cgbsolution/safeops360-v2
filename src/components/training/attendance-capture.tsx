"use client";

// Mobile-first attendance capture for a single training session.
// Trainer-facing — designed for tablet use beside the participants.
// Three capture methods supported:
//   • Manual tick — fastest for small sessions
//   • Signature — each participant signs on the tablet (passed around)
//   • QR scan — each participant scans from their own phone
//
// Backend stores all three proof types on the same TrainingAttendance
// row, so a session can mix methods (e.g. signature for those present,
// manual for known absentees). Rows are upserted by (sessionId, regId).

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  PenTool,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { readApiError } from "@/lib/client-errors";
import { SignatureModal } from "@/components/ui/signature-pad";

type Roster = {
  registrationId: string;
  userId: string;
  userName: string;
  userDesignation: string | null;
  // Pre-existing attendance for this session (if any)
  existing?: {
    status: string;
    signatureCaptured: boolean;
  };
};

type Status = "PRESENT" | "ABSENT" | "LATE" | "LEFT_EARLY" | "MEDICAL_LEAVE";

type CapturedRow = {
  registrationId: string;
  status: Status;
  signatureUrl: string | null;
  notes: string;
};

const STATUS_COLOR: Record<Status, string> = {
  PRESENT: "bg-emerald-100 text-emerald-700 border-emerald-300",
  LATE: "bg-amber-100 text-amber-700 border-amber-300",
  LEFT_EARLY: "bg-amber-100 text-amber-700 border-amber-300",
  ABSENT: "bg-rose-100 text-rose-700 border-rose-300",
  MEDICAL_LEAVE: "bg-slate-100 text-slate-700 border-slate-300",
};

export function AttendanceCapture({
  sessionId,
  sessionTitle,
  roster,
  onClose,
}: {
  sessionId: string;
  sessionTitle: string;
  roster: Roster[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<CapturedRow[]>(() =>
    roster.map((r) => ({
      registrationId: r.registrationId,
      status: (r.existing?.status as Status) ?? "PRESENT",
      signatureUrl: null,
      notes: "",
    }))
  );
  const [signingFor, setSigningFor] = useState<string | null>(null); // regId
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function setStatus(regId: string, status: Status) {
    setRows((prev) => prev.map((r) => (r.registrationId === regId ? { ...r, status } : r)));
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/training/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          rows: rows.map((row) => ({
            sessionId,
            registrationId: row.registrationId,
            status: row.status,
            signatureCaptured: !!row.signatureUrl,
            signatureUrl: row.signatureUrl,
            qrScanned: false,
            notes: row.notes || null,
          })),
        }),
      });
      if (r.ok) {
        router.refresh();
        onClose();
        return;
      }
      setError(await readApiError(r, "Failed to save attendance"));
    } finally {
      setSubmitting(false);
    }
  }

  const presentCount = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-2">
      <Card className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Attendance — {sessionTitle}</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              {presentCount} of {rows.length} marked present
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"
            className="h-auto w-auto p-0 text-slate-500 hover:bg-transparent hover:text-slate-800">
            <X size={20} />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-2 p-3">
          {roster.map((person) => {
            const row = rows.find((r) => r.registrationId === person.registrationId);
            if (!row) return null;
            const sig = !!row.signatureUrl;
            return (
              <Card
                key={person.registrationId}
                className="rounded-md border border-slate-200 bg-white p-3 space-y-2 shadow-none">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{person.userName}</div>
                    {person.userDesignation && (
                      <div className="text-[11px] text-slate-500">{person.userDesignation}</div>
                    )}
                  </div>
                  {sig && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                      <PenTool size={10} /> Signed
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {(["PRESENT", "LATE", "LEFT_EARLY", "ABSENT", "MEDICAL_LEAVE"] as Status[]).map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(person.registrationId, s)}
                        className={[
                          "px-2 py-1.5 rounded text-[10px] font-semibold border",
                          row.status === s
                            ? STATUS_COLOR[s]
                            : "bg-white text-slate-500 border-slate-200",
                        ].join(" ")}
                      >
                        {s.replace("_", " ")}
                      </button>
                    )
                  )}
                </div>

                {(row.status === "PRESENT" || row.status === "LATE") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSigningFor(person.registrationId)}
                    className="w-full"
                  >
                    <PenTool size={12} /> {sig ? "Re-sign" : "Capture signature"}
                  </Button>
                )}
              </Card>
            );
          })}
        </CardContent>

        {error && (
          <div className="px-3 pb-2 text-xs text-rose-700 bg-rose-50 border-t border-rose-200">
            {error}
          </div>
        )}

        <div className="border-t p-3 flex items-center justify-between gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save attendance ({rows.length} rows)
          </Button>
        </div>
      </Card>

      {signingFor && (
        <SignatureModal
          onSave={(url) => {
            setRows((prev) =>
              prev.map((r) =>
                r.registrationId === signingFor ? { ...r, signatureUrl: url } : r
              )
            );
            setSigningFor(null);
          }}
          onClose={() => setSigningFor(null)}
        />
      )}
    </div>
  );
}

// Signature pad lifted to the shared component @/components/ui/signature-pad
// (PTW closed-loop panels reuse the same drawing surface).
