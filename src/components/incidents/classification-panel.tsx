"use client";

// Phase 2 — HSE Manager Classification panel.
//
// Shown on the incident detail page when the current pending task assigned
// to the HSE Manager is the "HSE Manager Classification" CHECKER step.
// Replaces the generic ApprovalPanel for that specific step.
//
// Sections:
//   1. Classification         — type, severity, rationale
//   2. Statutory Assessment   — reportable Y/N, regulations, deadline countdown
//   3. Investigation Team     — lead picker + team members
//   4. Initial Cost           — property damage + lost production estimates
//
// Submitting calls POST /api/incidents/:id/classify which (a) updates all
// classification fields and (b) approves the workflow CHECKER step in one
// transaction. The page refreshes; the workflow advances to "Investigation
// Team RCA + CAPA Definition" assigned to the picked Investigation Lead.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/ui/user-picker";
import { useToast } from "@/components/ui/toast";
import { AlertCircle, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

const TYPES = [
  { value: "FIRST_AID", label: "First Aid Case (FAC)" },
  { value: "MTC", label: "Medical Treatment Case (MTC)" },
  { value: "RWC", label: "Restricted Work Case (RWC)" },
  { value: "LTI", label: "Lost Time Injury (LTI)" },
  { value: "FATALITY", label: "Fatality" },
  { value: "PROPERTY_DAMAGE", label: "Property Damage" },
  { value: "ENVIRONMENTAL", label: "Environmental Release" },
  { value: "FIRE", label: "Fire / Explosion" },
  { value: "PROCESS_SAFETY", label: "Process Safety" },
  { value: "HIPO_NEAR_MISS", label: "High-Potential Near Miss" }
];

// Mirrors the backend _STATUTORY_DEADLINE_HOURS for live deadline preview.
// Keep in sync with app/routers/incidents.py.
const DEADLINE_HOURS_BY_TYPE: Record<string, number | null> = {
  FIRST_AID: null,
  MTC: null,
  RWC: null,
  LTI: 24,
  FATALITY: 24,
  PROPERTY_DAMAGE: null,
  ENVIRONMENTAL: 72,
  FIRE: 24,
  PROCESS_SAFETY: 24,
  HIPO_NEAR_MISS: null
};

// Default reportableUnder per type (server is canonical; this is just UI hint).
const REPORTABLE_DEFAULT: Record<string, string[]> = {
  LTI: ["FACTORIES_ACT", "DGFASLI"],
  FATALITY: ["FACTORIES_ACT", "DGFASLI"],
  FIRE: ["FACTORIES_ACT"],
  ENVIRONMENTAL: ["CPCB"],
  PROCESS_SAFETY: ["DGFASLI"]
};

const REGULATIONS = [
  { code: "FACTORIES_ACT", label: "Factories Act 1948 — Form 18" },
  { code: "DGFASLI", label: "DGFASLI" },
  { code: "CPCB", label: "CPCB (Environmental)" },
  { code: "STATE_FACTORY_RULES", label: "State Factory Rules" }
];

type Initial = {
  type: string;
  severity: string | null;
  isReportable: boolean;
  reportableUnder: string[] | null;
  occurredAt: string | null;
  plantId: string;
  costPropertyDamage: number | null;
  costLostProduction: number | null;
};

export function ClassificationPanel({
  incidentId,
  taskId,
  initial
}: {
  incidentId: string;
  taskId: string;
  initial: Initial;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [type, setType] = useState(initial.type);
  const [severity, setSeverity] = useState<string>(initial.severity ?? "MEDIUM");
  const [rationale, setRationale] = useState("");
  const [isReportable, setIsReportable] = useState(initial.isReportable);
  const [reportableUnder, setReportableUnder] = useState<string[]>(initial.reportableUnder ?? []);
  const [investigationLeadId, setInvestigationLeadId] = useState<string | null>(null);
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [costPropertyDamage, setCostPropertyDamage] = useState(initial.costPropertyDamage?.toString() ?? "");
  const [costLostProduction, setCostLostProduction] = useState(initial.costLostProduction?.toString() ?? "");
  // Feature 5 — numeric 5×5 scoring. Consequence 1-5 set here; likelihood
  // defaults to "auto" (derived from the trend matcher's recurrence count) but
  // can be overridden. The final severity band is derived from L×C.
  const [consequenceScore, setConsequenceScore] = useState<string>("3");
  const [likelihood, setLikelihood] = useState<string>(""); // "" = auto from recurrence

  const scorePreview = useMemo(() => {
    const c = Number(consequenceScore) || 0;
    const l = likelihood ? Number(likelihood) : null;
    if (!c || l == null) return null;
    const score = l * c;
    return { score, band: bandOf(score) };
  }, [consequenceScore, likelihood]);

  // When the user changes type, default-suggest severity, reportability,
  // and the regulations list. They can override before submit.
  useEffect(() => {
    const inferred = inferSeverity(type);
    setSeverity(inferred);
    const isRep = !!REPORTABLE_DEFAULT[type];
    setIsReportable(isRep);
    setReportableUnder(REPORTABLE_DEFAULT[type] ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Live statutory deadline preview based on occurredAt + type.
  const deadlinePreview = useMemo(() => {
    if (!isReportable || !initial.occurredAt) return null;
    const hrs = DEADLINE_HOURS_BY_TYPE[type];
    if (hrs == null) return null;
    const occ = new Date(initial.occurredAt).getTime();
    const deadline = new Date(occ + hrs * 3_600_000);
    const now = Date.now();
    const remainingHours = Math.floor((deadline.getTime() - now) / 3_600_000);
    return {
      deadline,
      remainingHours,
      overdue: remainingHours < 0
    };
  }, [type, isReportable, initial.occurredAt]);

  function toggleRegulation(code: string) {
    setReportableUnder((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (rationale.trim().length < 10) {
      setError("Classification rationale is required (10+ chars)."); return;
    }
    if (!investigationLeadId) {
      setError("Pick an investigation team lead before approving."); return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          severity,
          classificationRationale: rationale,
          isReportable,
          reportableUnder: isReportable ? reportableUnder : null,
          investigationTeamLead: investigationLeadId,
          investigationTeamMemberIds: teamMemberIds.filter((id) => id !== investigationLeadId),
          investigationCharterDate: new Date().toISOString(),
          costPropertyDamage: costPropertyDamage ? Number(costPropertyDamage) : null,
          costLostProduction: costLostProduction ? Number(costLostProduction) : null,
          consequenceScore: consequenceScore ? Number(consequenceScore) : null,
          likelihoodOfRecurrence: likelihood ? Number(likelihood) : null,
          classificationTaskId: taskId,
          comments: rationale
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.detail ?? j.error ?? `Classification failed (${res.status})`);
        setBusy(false); return;
      }
      toast({
        variant: "success",
        title: "Classification confirmed",
        description: "Investigation lead has been notified to begin investigation."
      });
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Network error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Card className="border-primary-300 ring-2 ring-primary-100">
        <CardHeader className="bg-primary-50 rounded-t-xl">
          <CardTitle className="flex items-center gap-2 text-primary-900">
            <ShieldAlert size={18} /> Phase 2 — Classification & Investigation Team
          </CardTitle>
          <CardDescription className="text-primary-700">
            Confirm or refine the incident type and severity, declare statutory obligations, and constitute the investigation team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {/* Section 1 — Classification */}
          <section className="space-y-3">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">1. Classification</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Incident Type <span className="text-rose-600">*</span></Label>
                <Select value={type} onChange={(e) => setType(e.target.value)} required>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </div>
              <div>
                <Label>Severity <span className="text-rose-600">*</span></Label>
                <Select value={severity} onChange={(e) => setSeverity(e.target.value)} required>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Classification Rationale <span className="text-rose-600">*</span></Label>
              <Textarea rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)}
                placeholder="Why this type and severity? Cite injury detail, property damage extent, etc." />
            </div>
          </section>

          {/* Section 1b — Risk Scoring (Feature 5) */}
          <section className="space-y-3 pt-3 border-t border-slate-200">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">1b. Risk Scoring (5×5)</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Consequence (1–5) <span className="text-rose-600">*</span></Label>
                <Select value={consequenceScore} onChange={(e) => setConsequenceScore(e.target.value)}>
                  <option value="1">1 — Insignificant</option>
                  <option value="2">2 — Minor</option>
                  <option value="3">3 — Moderate</option>
                  <option value="4">4 — Major</option>
                  <option value="5">5 — Severe</option>
                </Select>
              </div>
              <div>
                <Label>Likelihood of Recurrence</Label>
                <Select value={likelihood} onChange={(e) => setLikelihood(e.target.value)}>
                  <option value="">Auto (from recurrence trend)</option>
                  <option value="1">1 — Rare</option>
                  <option value="2">2 — Unlikely</option>
                  <option value="3">3 — Possible</option>
                  <option value="4">4 — Likely</option>
                  <option value="5">5 — Almost certain</option>
                </Select>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm flex items-center gap-2">
              <ShieldAlert size={14} className="text-slate-500" />
              {scorePreview ? (
                <span>
                  Risk score <span className="font-mono font-semibold">{scorePreview.score}</span>/25 →{" "}
                  <span className={cn(
                    "font-semibold",
                    scorePreview.band === "CRITICAL" ? "text-rose-700" :
                    scorePreview.band === "HIGH" ? "text-orange-700" :
                    scorePreview.band === "MEDIUM" ? "text-amber-700" : "text-emerald-700"
                  )}>{scorePreview.band}</span>
                  {scorePreview.score >= 15 && <span className="text-rose-700 text-xs ml-1">· auto-escalates to Corporate HSE</span>}
                </span>
              ) : (
                <span className="text-slate-500 text-xs">Likelihood is auto-derived from the recurrence trend; the severity band is set to Likelihood × Consequence on submit.</span>
              )}
            </div>
          </section>

          {/* Section 2 — Statutory */}
          <section className="space-y-3 pt-3 border-t border-slate-200">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">2. Statutory Assessment</div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isReportable" checked={isReportable}
                onChange={(e) => setIsReportable(e.target.checked)} />
              <Label htmlFor="isReportable" className="!mb-0">This incident is statutorily reportable</Label>
            </div>
            {isReportable && (
              <>
                <div>
                  <Label className="block mb-1.5">Under which regulations</Label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {REGULATIONS.map((r) => (
                      <label key={r.code} className="flex items-start gap-2 text-sm cursor-pointer rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50">
                        <input type="checkbox" checked={reportableUnder.includes(r.code)}
                          onChange={() => toggleRegulation(r.code)} className="mt-0.5" />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {deadlinePreview && (
                  <div className={cn(
                    "rounded-md border px-3 py-2.5 text-sm flex items-start gap-2",
                    deadlinePreview.overdue
                      ? "border-rose-300 bg-rose-50 text-rose-900"
                      : deadlinePreview.remainingHours < 4
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-slate-300 bg-slate-50 text-slate-800"
                  )}>
                    <Clock size={14} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">
                        Statutory deadline: {formatDateTime(deadlinePreview.deadline)}
                      </div>
                      <div className="text-xs mt-0.5">
                        {deadlinePreview.overdue
                          ? `OVERDUE by ${Math.abs(deadlinePreview.remainingHours)}h — prepare retroactive submission.`
                          : `${deadlinePreview.remainingHours}h remaining from now.`}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Section 3 — Investigation Team */}
          <section className="space-y-3 pt-3 border-t border-slate-200">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">3. Investigation Team</div>
            <div>
              <Label>Investigation Lead <span className="text-rose-600">*</span></Label>
              <UserPicker value={investigationLeadId} onChange={(id) => setInvestigationLeadId(id)}
                filter={{ plantId: initial.plantId }} placeholder="Search & select investigation lead…" required />
              <p className="text-xs text-slate-500 mt-1">
                The lead receives the next workflow task and drives the investigation through to report submission.
              </p>
            </div>
            <div>
              <Label>Team Members</Label>
              <UserPicker value={null} onChange={(id) => { if (id && !teamMemberIds.includes(id)) setTeamMemberIds([...teamMemberIds, id]); }}
                filter={{ plantId: initial.plantId }} placeholder="Add a team member…" />
              {teamMemberIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {teamMemberIds.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 border border-slate-300 rounded">
                      {id.slice(0, 8)}…
                      <button type="button" onClick={() => setTeamMemberIds((prev) => prev.filter((x) => x !== id))}
                        className="text-slate-500 hover:text-rose-600 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              )}
              {(severity === "HIGH" || severity === "CRITICAL") && (
                <p className="text-xs text-amber-700 mt-1.5">
                  ⓘ For LTI / Fatality, Plant Head and Corporate HSE will be added automatically as observers when classification is confirmed.
                </p>
              )}
            </div>
          </section>

          {/* Section 4 — Initial Cost */}
          <section className="space-y-3 pt-3 border-t border-slate-200">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">4. Initial Cost Estimates</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Property Damage (₹)</Label>
                <Input type="number" min={0} value={costPropertyDamage}
                  onChange={(e) => setCostPropertyDamage(e.target.value)} />
              </div>
              <div>
                <Label>Lost Production (₹)</Label>
                <Input type="number" min={0} value={costLostProduction}
                  onChange={(e) => setCostLostProduction(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Refined during investigation. Lost production = tonnes lost × margin per tonne.
            </p>
          </section>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="submit" disabled={busy}>
              <CheckCircle2 size={14} />
              {busy ? "Confirming…" : "Confirm Classification & Approve"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

// Mirrors the ERM 5×5 bands reused by the backend (erm.band_for_score:
// LOW 1-4, MEDIUM 5-9, HIGH 10-15, CRITICAL 16-25).
function bandOf(score: number): string {
  if (score >= 16) return "CRITICAL";
  if (score >= 10) return "HIGH";
  if (score >= 5) return "MEDIUM";
  return "LOW";
}

// Mirrors backend _INITIAL_SEVERITY for type-driven default
function inferSeverity(type: string): string {
  switch (type) {
    case "FIRST_AID": return "LOW";
    case "MTC":
    case "RWC":
    case "PROPERTY_DAMAGE": return "MEDIUM";
    case "LTI":
    case "ENVIRONMENTAL":
    case "FIRE":
    case "HIPO_NEAR_MISS": return "HIGH";
    case "FATALITY":
    case "PROCESS_SAFETY": return "CRITICAL";
    default: return "MEDIUM";
  }
}
