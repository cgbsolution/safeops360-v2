"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SEVERITY_LABEL } from "@/app/(dashboard)/erm/lib-p3";

export type ActivatablePlan = {
  id: string;
  planCode: string;
  title: string;
  planType: string;
  siteId: string | null;
  siteName: string | null;
  activationCriteria: string[];
};

export type ActivatableSite = { id: string; name: string };

const SEVERITY_DESC: Record<number, string> = {
  1: "Single site impacted — handled by the site crisis team.",
  2: "Multi-site / corporate exposure — corporate crisis team engaged.",
  3: "Enterprise-threatening — board and executive crisis management.",
};

export function ActivateFlow({ plans, sites }: { plans: ActivatablePlan[]; sites: ActivatableSite[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState("");
  const [siteId, setSiteId] = useState<string>("");
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [severity, setSeverity] = useState<1 | 2 | 3 | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Plans relevant to the chosen site (site plans + corporate plans). If no site
  // chosen yet, show all approved plans.
  const visiblePlans = siteId ? plans.filter((p) => p.siteId === siteId || p.siteId === null) : plans;

  function togglePlan(id: string) {
    setPlanIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  const step1Valid = title.trim().length >= 3;
  const step2Valid = severity != null;

  async function activate() {
    if (!severity) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/erm/bcm/crisis/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          siteId: siteId || null,
          activatedPlanIds: planIds,
          severityLevel: severity,
          linkedRiskIds: [],
          linkedIncidentId: null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.detail || j.error || `Activation failed (${res.status})`);
        return;
      }
      router.push(`/erm/bcm/crisis/${j.id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Activation failed");
      setBusy(false);
    }
  }

  const siteName = siteId ? sites.find((s) => s.id === siteId)?.name ?? "Site" : "Corporate (no single site)";
  const selectedPlans = plans.filter((p) => planIds.includes(p.id));

  return (
    <div className="mx-auto max-w-xl">
      {/* Step indicator */}
      <div className="mb-5 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold " +
                (step >= s ? "bg-rose-600 text-white" : "bg-slate-200 text-slate-500")
              }
            >
              {step > s ? <Check size={16} /> : s}
            </div>
            {s < 3 && <div className={"h-1 flex-1 rounded " + (step > s ? "bg-rose-600" : "bg-slate-200")} />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: site + plans ─────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">What is happening, and where?</h2>
            <p className="text-sm text-slate-500">Name the crisis and choose the affected site and the plan(s) to activate.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Crisis title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-h-12 rounded-xl px-4 text-base"
              placeholder="e.g. Chlorine leak — North Works Unit 2"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Affected site</label>
            <Select
              value={siteId}
              onChange={(e) => { setSiteId(e.target.value); setPlanIds([]); }}
              className="min-h-12 rounded-xl px-3 text-base"
            >
              <option value="">Corporate (no single site)</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Activate plan(s) <span className="font-normal text-slate-400">— approved continuity plans</span>
            </label>
            {visiblePlans.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                No approved plans for this site. You can still activate a crisis without a plan.
              </p>
            ) : (
              <div className="space-y-2">
                {visiblePlans.map((p) => {
                  const on = planIds.includes(p.id);
                  return (
                    <Button
                      key={p.id}
                      type="button"
                      variant="ghost"
                      onClick={() => togglePlan(p.id)}
                      className={cn(
                        "flex h-auto w-full flex-col items-stretch gap-0 whitespace-normal rounded-xl border-2 p-3 text-left transition-colors",
                        on ? "border-rose-500 bg-rose-50" : "border-slate-200 bg-white hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-500">{p.planCode}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{p.siteName ?? "Corporate"}</span>
                          </div>
                          <div className="text-base font-semibold text-slate-900">{p.title}</div>
                        </div>
                        <div
                          className={
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 " +
                            (on ? "border-rose-600 bg-rose-600 text-white" : "border-slate-300")
                          }
                        >
                          {on && <Check size={14} />}
                        </div>
                      </div>
                      {p.activationCriteria.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                          {p.activationCriteria.map((c, i) => (
                            <li key={i} className="flex gap-1.5"><span className="text-slate-300">•</span><span>{c}</span></li>
                          ))}
                        </ul>
                      )}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          <StickyBar>
            <Button
              disabled={!step1Valid}
              onClick={() => setStep(2)}
              className="flex min-h-12 w-full gap-2 rounded-xl text-base font-semibold"
            >
              Next: severity <ArrowRight size={18} />
            </Button>
            {!step1Valid && <p className="mt-1 text-center text-[11px] text-slate-400">A title of at least 3 characters is required.</p>}
          </StickyBar>
        </div>
      )}

      {/* ── STEP 2: severity ─────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">How severe is it?</h2>
            <p className="text-sm text-slate-500">This sets the escalation tier and who is notified.</p>
          </div>

          <div className="space-y-3">
            {[1, 2, 3].map((lvl) => {
              const on = severity === lvl;
              return (
                <Button
                  key={lvl}
                  type="button"
                  variant="ghost"
                  onClick={() => setSeverity(lvl as 1 | 2 | 3)}
                  className={cn(
                    "h-auto flex min-h-16 w-full gap-4 rounded-2xl border-2 p-4 text-left transition-colors",
                    on ? "border-rose-600 bg-rose-50" : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <span className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-extrabold " + (on ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600")}>
                    {lvl}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-bold text-slate-900">{SEVERITY_LABEL[lvl]}</span>
                    <span className="block text-sm text-slate-500">{SEVERITY_DESC[lvl]}</span>
                  </span>
                </Button>
              );
            })}
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>Plant HSE Heads can activate Severity 1 only. Higher severities require corporate crisis authority — the system will block it.</span>
          </div>

          <StickyBar>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex min-h-12 gap-2 rounded-xl text-base text-slate-700">
                <ArrowLeft size={18} /> Back
              </Button>
              <Button
                disabled={!step2Valid}
                onClick={() => setStep(3)}
                className="flex min-h-12 flex-1 gap-2 rounded-xl text-base font-semibold"
              >
                Review <ArrowRight size={18} />
              </Button>
            </div>
          </StickyBar>
        </div>
      )}

      {/* ── STEP 3: confirm ──────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Confirm activation</h2>
            <p className="text-sm text-slate-500">Review and declare. This opens the live crisis workspace and notifies the team.</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <SummaryRow label="Crisis" value={title} />
            <SummaryRow label="Site" value={siteName} />
            <SummaryRow label="Severity" value={severity ? SEVERITY_LABEL[severity] : "—"} />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Plans</div>
              {selectedPlans.length === 0 ? (
                <div className="text-sm text-slate-500">None selected</div>
              ) : (
                <ul className="mt-1 space-y-1">
                  {selectedPlans.map((p) => (
                    <li key={p.id} className="text-sm text-slate-700"><span className="font-mono text-xs text-slate-500">{p.planCode}</span> — {p.title}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{err}</span>
            </div>
          )}

          <StickyBar>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={busy} className="flex min-h-14 gap-2 rounded-xl text-base text-slate-700">
                <ArrowLeft size={18} /> Back
              </Button>
              <Button
                variant="destructive"
                onClick={activate}
                disabled={busy}
                className="flex min-h-14 flex-1 gap-2 rounded-xl text-base font-extrabold uppercase tracking-wide"
              >
                {busy ? <Loader2 size={20} className="animate-spin" /> : <Siren size={20} />}
                {busy ? "Activating…" : "Activate crisis"}
              </Button>
            </div>
          </StickyBar>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value || "—"}</div>
    </div>
  );
}

function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-white via-white to-transparent pb-2 pt-4">
      {children}
    </div>
  );
}
