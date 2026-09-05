"use client";

// Reusable HIRA suggestions panel.
//
// Drops onto any module's form page that needs to surface relevant HIRA
// entries to the user filling out the form. Used by:
//   • FLRA — show entries for the activity/area so the leader can reuse
//     hazards + controls when authoring the FLRA hazard analysis.
//   • PTW — show entries that influence the permit risk level / type.
//
// Both modules call /api/hira/integrations/for-flra or /for-ptw with the
// caller's plantId + areaId. The panel polls when those props change so
// the suggestions stay in sync as the user picks the location.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ExternalLink, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

type HiraEntrySuggestion = {
  id: string;
  sequenceNumber: number;
  activityDescription: string;
  initialRiskLevel: string;
  residualRiskLevel: string | null;
  residualRiskScore: number | null;
  residualAcceptable?: boolean | null;
  // Backend (GET /api/hira/integrations/for-{ptw,flra}) serialises these as
  // FLAT fields — not a nested `study` object. Reading `e.study.id` here was
  // the crash that took down the whole Permit / FLRA detail page.
  studyId: string;
  studyNumber: string;
  studyTitle?: string;
  hazards: { id: string; hazard: { id: string; name: string; category: string } }[] |
           { id: string; contextualDescription: string | null; hazard: { id: string; name: string; category: string; code: string } }[];
  existingControls?: {
    id: string;
    hierarchy: string;
    description: string;
    effectiveness: string | null;
  }[];
};

const RISK_COLOR: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-300",
  MODERATE: "bg-amber-100 text-amber-800 border-amber-300",
  HIGH: "bg-orange-100 text-orange-900 border-orange-300",
  CRITICAL: "bg-rose-200 text-rose-900 border-rose-400 font-semibold"
};

export function HiraSuggestionsPanel({
  mode,
  plantId,
  areaId,
  activityKeyword,
  permitType,
  emptyHint
}: {
  mode: "flra" | "ptw";
  plantId: string | null | undefined;
  areaId?: string | null;
  activityKeyword?: string | null;
  permitType?: string | null;
  emptyHint?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<HiraEntrySuggestion[]>([]);
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [gatingBlockers, setGatingBlockers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // 403 = the caller's role has no HIRA.READ grant. This panel is advisory —
  // a role that can raise a permit but not read the HIRA register is a valid
  // configuration (contractor crew, for one), so we hide the panel entirely
  // rather than parking a red "HTTP 403" on an otherwise healthy permit page.
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!plantId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setForbidden(false);
    const params = new URLSearchParams({ plantId });
    if (areaId) params.set("areaId", areaId);
    if (mode === "flra" && activityKeyword) params.set("activityKeyword", activityKeyword);
    if (mode === "ptw" && permitType) params.set("permitType", permitType);
    fetch(`/api/hira/integrations/for-${mode}?${params.toString()}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          setForbidden(true);
          return null;
        }
        if (!r.ok) {
          // Surface the backend's own message when it sends one — "HTTP 500"
          // alone told nobody anything.
          const detail = await r
            .json()
            .then((b) => b?.detail ?? b?.error ?? null)
            .catch(() => null);
          throw new Error(detail ? String(detail) : `Could not load HIRA entries (HTTP ${r.status})`);
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setEntries(data.entries ?? []);
        setAdvisory(data.advisory ?? null);
        setGatingBlockers(data.gatingBlockers ?? 0);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [mode, plantId, areaId, activityKeyword, permitType]);

  if (forbidden) return null;

  if (!plantId) {
    return (
      <Card className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 shadow-none">
        Pick a plant to see HIRA entries for this work.
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border bg-white shadow-none">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-600 font-medium">
            HIRA — Relevant Entries
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {mode === "flra"
              ? "Activities matching this location and keyword from the active HIRA register"
              : "Entries influencing this permit's risk level"}
          </div>
        </div>
        {loading && <span className="text-xs text-slate-400">Loading…</span>}
      </div>

      {advisory && (
        <div
          className={`px-4 py-2.5 text-sm flex items-start gap-2 ${
            gatingBlockers > 0
              ? "bg-rose-50 text-rose-900 border-b border-rose-200"
              : "bg-amber-50 text-amber-900 border-b border-amber-200"
          }`}
        >
          {gatingBlockers > 0 ? (
            <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          )}
          <div>{advisory}</div>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 text-sm text-rose-700 bg-rose-50 border-b">{error}</div>
      )}

      {!loading && entries.length === 0 && !error && (
        <div className="px-4 py-4 text-sm text-slate-500">
          {emptyHint ?? "No HIRA entries match. The work either falls outside any active HIRA scope, or the register needs an entry for this activity."}
        </div>
      )}

      {entries.length > 0 && (
        <ul className="divide-y max-h-[480px] overflow-y-auto">
          {entries.slice(0, 12).map((e) => (
            <li key={e.id} className="px-4 py-3 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {e.studyId ? (
                      <Link
                        href={`/hira/${e.studyId}/entries/${e.id}`}
                        target="_blank"
                        className="text-xs font-mono text-primary-700 hover:underline inline-flex items-center gap-1"
                      >
                        {e.studyNumber} · #{e.sequenceNumber}
                        <ExternalLink size={10} />
                      </Link>
                    ) : (
                      <span className="text-xs font-mono text-slate-500">
                        {e.studyNumber ?? "HIRA"} · #{e.sequenceNumber}
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${RISK_COLOR[e.initialRiskLevel] ?? ""}`}>
                      Init {e.initialRiskLevel}
                    </span>
                    {e.residualRiskLevel && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${RISK_COLOR[e.residualRiskLevel] ?? ""}`}>
                        Resid {e.residualRiskLevel}
                        {e.residualAcceptable === false && <span className="ml-0.5">⚠</span>}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-800 mt-1 line-clamp-2">{e.activityDescription}</div>

                  {e.hazards.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {e.hazards.slice(0, 6).map((h: any) => (
                        <span
                          key={h.id}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                          title={h.hazard.category}
                        >
                          {h.hazard.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {e.existingControls && e.existingControls.length > 0 && (
                    <details className="mt-1.5">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                        {e.existingControls.length} existing controls in place
                      </summary>
                      <ul className="mt-1 space-y-0.5 pl-2 border-l-2 border-slate-200">
                        {e.existingControls.map((c) => (
                          <li key={c.id} className="text-xs text-slate-600">
                            <span className="font-medium">{c.hierarchy}:</span> {c.description}
                            {c.effectiveness && c.effectiveness !== "EFFECTIVE" && (
                              <span className="ml-1 text-amber-700">
                                ({c.effectiveness.replace(/_/g, " ").toLowerCase()})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
