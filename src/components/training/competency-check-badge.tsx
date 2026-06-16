"use client";

// Pre-flight competency check badge. Used in:
//   • PTW crew selector — shows "User has all required certs" or
//     "Missing: Hot Work Holder, Fire Watch" before submission
//   • FLRA sign-off — same check, gives the worker a heads-up before
//     they tap Sign
//   • Future role-assignment UI — gates manager from assigning roles
//     to under-trained users
//
// Calls the canonical /api/training/competency/check endpoint which
// reads TrainingProgram.isMandatoryFor* arrays and returns blockers
// + warnings + satisfied list.

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Blocker = {
  programCode: string;
  programName: string;
  code: string;
  message: string;
};

type Warning = {
  programCode: string;
  programName: string;
  code: string;
  message: string;
  daysUntilExpiry: number | null;
};

type CheckResult = {
  ok: boolean;
  userId: string;
  userName: string;
  blockers: Blocker[];
  warnings: Warning[];
  satisfied: string[];
};

type Mode =
  | { kind: "permitType"; permitType: string }
  | { kind: "role"; roleCode: string }
  | { kind: "contractor" };

export function CompetencyCheckBadge({
  userId,
  mode,
  compact = false,
}: {
  userId: string;
  mode: Mode;
  compact?: boolean;
}) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ user_id: userId });
    if (mode.kind === "permitType") params.set("permit_type", mode.permitType);
    else if (mode.kind === "role") params.set("role_code", mode.roleCode);
    else params.set("contractor_onboarding", "true");

    fetch(`/api/training/competency/check?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`status ${r.status}`);
        }
        return r.json();
      })
      .then((j: CheckResult) => {
        if (!cancelled) setResult(j);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "check failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    mode.kind,
    (mode as any).permitType,
    (mode as any).roleCode,
  ]);

  if (loading) {
    return (
      <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
        <Loader2 size={10} className="animate-spin" /> checking…
      </Badge>
    );
  }

  if (error || !result) {
    return (
      <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">
        check unavailable
      </Badge>
    );
  }

  if (result.ok && result.warnings.length === 0 && result.satisfied.length === 0) {
    // No requirements — silent (e.g. for permit types without mandatory training)
    return null;
  }

  if (compact) {
    if (!result.ok) {
      return (
        <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">
          <XCircle size={10} /> {result.blockers.length} blocker
          {result.blockers.length === 1 ? "" : "s"}
        </Badge>
      );
    }
    if (result.warnings.length > 0) {
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
          <AlertTriangle size={10} /> expires soon
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
        <CheckCircle2 size={10} /> competent
      </Badge>
    );
  }

  // Full panel
  return (
    <div
      className={[
        "rounded-md border p-2 text-xs space-y-1",
        result.ok
          ? result.warnings.length > 0
            ? "border-amber-200 bg-amber-50"
            : "border-emerald-200 bg-emerald-50"
          : "border-rose-200 bg-rose-50",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5 font-medium">
        {result.ok ? (
          result.warnings.length > 0 ? (
            <>
              <AlertTriangle size={12} className="text-amber-700" />
              <span className="text-amber-900">
                Eligible — {result.warnings.length} warning
                {result.warnings.length === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 size={12} className="text-emerald-700" />
              <span className="text-emerald-900">Competent — all certifications valid</span>
            </>
          )
        ) : (
          <>
            <XCircle size={12} className="text-rose-700" />
            <span className="text-rose-900">
              Cannot proceed — {result.blockers.length} blocker
              {result.blockers.length === 1 ? "" : "s"}
            </span>
          </>
        )}
      </div>

      {result.blockers.map((b) => (
        <div key={b.programCode} className="flex items-start gap-1.5">
          <ShieldAlert size={10} className="mt-0.5 text-rose-600 shrink-0" />
          <span className="text-rose-800">{b.message}</span>
        </div>
      ))}

      {result.warnings.map((w) => (
        <div key={w.programCode} className="flex items-start gap-1.5">
          <AlertTriangle size={10} className="mt-0.5 text-amber-600 shrink-0" />
          <span className="text-amber-800">{w.message}</span>
        </div>
      ))}

      {result.satisfied.length > 0 && (
        <details className="text-slate-600">
          <summary className="cursor-pointer">
            {result.satisfied.length} certification
            {result.satisfied.length === 1 ? "" : "s"} valid
          </summary>
          <div className="flex flex-wrap gap-1 mt-1">
            {result.satisfied.map((code) => (
              <Badge
                key={code}
                className="bg-white text-slate-700 border-slate-200 text-[9px] font-mono"
              >
                <CheckCircle2 size={9} className="text-emerald-600" /> {code}
              </Badge>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
