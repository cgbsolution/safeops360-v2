"use client";

// Create a programme, its first cycle, and its scope — in one pass.
//
// docs/cams/08 §6.1. The endpoints behind this existed and had no caller
// anywhere in the UI, so "Audit Programme" in the nav was a permanent dead end
// regardless of how good the engine underneath was.
//
// Three steps, in the order ISO 19011 clause 5 asks for them:
//
//   1. the programme  — objectives (§5.2, mandatory and enforced at approval),
//                       the standards it discharges, and its owner
//   2. the cycle      — the period, and how many sub-periods coverage is
//                       measured over
//   3. the scope      — site × discipline, expanded in bulk, each row carrying
//                       the required frequency `approval_blockers` checks
//
// Step 3 is bulk on purpose: a 16-factory group defining 10 disciplines is 160
// scope units, and a one-at-a-time form is why nobody would ever finish it.
//
// A programme is per MANAGEMENT SYSTEM, not per site (§1 Decision 3). Sites
// enter here, as scope units — which is why the site picker lives in step 3 and
// not in step 1.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, ShieldCheck, CalendarRange, Grid3x3, Check, ArrowRight, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserPicker } from "@/components/ui/user-picker";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { readApiError } from "@/lib/client-errors";

export type WizardSite = { id: string; code: string; name: string };
export type WizardDiscipline = { code: string; name: string; checkpointCount: number };
/**
 * A discipline taxonomy the programme can be scoped against.
 *
 * On this instance each one IS an audit category — Internal, QMS/EMS/OHS,
 * Social Compliance — resolved by the page from the same
 * `resolveAuditCategories` the audit scheduler uses, so the programme cannot
 * plan against a taxonomy the scheduler is unable to materialise.
 *
 * The category fields are OPTIONAL because this component must not assume the
 * categories exist: an instance with only plain industry libraries hands over
 * a list with no `categoryCode`, and gets the plain dropdown instead of the
 * category cards. Rendering is driven by the data, not by a flag.
 */
export type WizardLibrary = {
  industryCode: string;
  industryName: string;
  categories: WizardDiscipline[];
  /** INTERNAL | MANAGEMENT_SYSTEMS | SOCIAL_COMPLIANCE, when this taxonomy is
   *  one of the audit categories. */
  categoryCode?: string;
  /** Short name for the card — "QMS, EMS, OHS" rather than the library's own
   *  "Page Industries — QMS, EMS & OHS". */
  categoryLabel?: string;
  categoryDescription?: string;
  /** Total across every discipline, shown before one is ticked. */
  checkpointCount?: number;
};

// The standards a programme typically discharges. Free text is still allowed —
// a buyer or social-compliance programme will not be on this list.
const STANDARD_SUGGESTIONS = [
  "ISO 45001", "ISO 14001", "ISO 9001", "ISO 50001",
  "SA8000", "SMETA / Sedex", "BRCGS", "Factories Act 1948",
];

type Step = 1 | 2 | 3;

export function ProgrammeWizard({
  sites, libraries, onClose,
}: {
  sites: WizardSite[];
  libraries: WizardLibrary[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Step 1 — the programme
  const [name, setName] = useState("");
  const [programmeCode, setProgrammeCode] = useState("");
  const [objectives, setObjectives] = useState("");
  const [scopeStatement, setScopeStatement] = useState("");
  const [standards, setStandards] = useState<string[]>([]);
  const [customStandard, setCustomStandard] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [threshold, setThreshold] = useState("80");

  // Step 2 — the cycle
  const thisFY = fyStart();
  const [cycleLabel, setCycleLabel] = useState(`FY${String(thisFY.getFullYear() + 1).slice(2)}`);
  const [periodStart, setPeriodStart] = useState(iso(thisFY));
  const [periodEnd, setPeriodEnd] = useState(iso(addYear(thisFY)));
  const [periodsPerCycle, setPeriodsPerCycle] = useState(4);

  // Step 3 — the scope
  const [industryCode, setIndustryCode] = useState(libraries[0]?.industryCode ?? "");
  const [siteIds, setSiteIds] = useState<string[]>(sites.map((s) => s.id));
  const [disciplineCodes, setDisciplineCodes] = useState<string[]>([]);
  const [requiredPerCycle, setRequiredPerCycle] = useState("1");
  const [riskWeight, setRiskWeight] = useState("3");

  const library = libraries.find((l) => l.industryCode === industryCode);
  const unitCount = Math.max(1, siteIds.length) * disciplineCodes.length;

  const objectivesTooShort = objectives.trim().length < 20;
  const step1Invalid =
    name.trim().length < 4 || programmeCode.trim().length < 2 || !ownerUserId || objectivesTooShort;
  const periodInvalid = new Date(periodEnd) <= new Date(periodStart);
  const step2Invalid = cycleLabel.trim().length < 2 || periodInvalid;
  const step3Invalid = disciplineCodes.length === 0;

  const allStandards = useMemo(
    () => Array.from(new Set([...STANDARD_SUGGESTIONS, ...standards])),
    [standards],
  );

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function post(url: string, body: unknown, fallback: string, method = "POST") {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await readApiError(res, fallback));
    return res.json();
  }

  // Three sequential writes rather than one transaction, because the endpoints
  // are separate resources. If the cycle or scope call fails, the programme
  // still exists and the user lands on it with a message — the wizard does not
  // silently roll anything back, and nothing is lost.
  async function create() {
    setBusy(true);
    setErr(null);
    let programmeId: string | null = null;
    try {
      const p = await post(
        "/api/programme",
        {
          programmeCode: programmeCode.trim().toUpperCase(),
          name: name.trim(),
          objectives: objectives.trim(),
          scopeStatement: scopeStatement.trim(),
          standardRefs: standards,
          ownerUserId,
          fullCoverageThresholdPct: Number(threshold) || 80,
        },
        "Could not create the programme",
      );
      programmeId = p.id;

      const c = await post(
        "/api/programme/cycles",
        {
          programmeId,
          cycleLabel: cycleLabel.trim(),
          periodStart,
          periodEnd,
          periodsPerCycle,
        },
        "The programme was created, but its cycle was not",
      );

      await post(
        "/api/programme/scope-units/bulk",
        {
          cycleId: c.id,
          dimension: "DISCIPLINE",
          siteIds: siteIds.length ? siteIds : [null],
          dimensions: disciplineCodes.map((code) => ({
            key: code,
            label: library?.categories.find((d) => d.code === code)?.name ?? code,
          })),
          requiredPerCycle: Number(requiredPerCycle) || null,
          riskWeight: Number(riskWeight) || 3,
          rationale: `Derived from the ${library?.industryName ?? industryCode} checkpoint library at programme creation.`,
        },
        "The cycle was created, but its scope units were not",
      );

      onClose();
      router.push(`/cams/programme/${programmeId}?cycle=${c.id}`);
      router.refresh();
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Something went wrong");
      if (programmeId) {
        // Partial success. Sending the user to what DID get created beats
        // leaving an orphan they cannot see.
        router.push(`/cams/programme/${programmeId}`);
        router.refresh();
      }
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck size={18} className="text-violet-700" /> New audit programme
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            A programme is per management system, not per site — sites enter as scope units in
            step&nbsp;3.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b bg-slate-50/70 px-5 py-2">
          <StepChip n={1} active={step === 1} done={step > 1} icon={<ShieldCheck size={12} />}>
            Programme
          </StepChip>
          <StepChip n={2} active={step === 2} done={step > 2} icon={<CalendarRange size={12} />}>
            Cycle
          </StepChip>
          <StepChip n={3} active={step === 3} done={false} icon={<Grid3x3 size={12} />}>
            Scope
          </StepChip>
        </div>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <div>
                  <Label htmlFor="pw-name" className="text-xs">
                    Programme name <span className="text-rose-600">*</span>
                  </Label>
                  <Input id="pw-name" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Group Internal OH&S Audit Programme" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="pw-code" className="text-xs">
                    Code <span className="text-rose-600">*</span>
                  </Label>
                  <Input id="pw-code" value={programmeCode}
                    onChange={(e) => setProgrammeCode(e.target.value.toUpperCase())}
                    placeholder="PRG-OHS-01" className="mt-1 font-mono" />
                </div>
              </div>

              <div>
                <Label htmlFor="pw-obj" className="text-xs">
                  Objectives <span className="text-rose-600">*</span>
                </Label>
                <Textarea id="pw-obj" rows={3} value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  placeholder="What this programme is for — e.g. verify conformity of the OH&S management system across the estate, confirm the effectiveness of controls on high-risk activities, and provide input to management review."
                  className="mt-1 text-sm" />
                <p className={cn("mt-1 text-[11px]", objectivesTooShort ? "text-amber-700" : "text-slate-500")}>
                  ISO 19011 §5.2 makes these mandatory, and the approval guard refuses a cycle
                  whose programme has none. {objectives.trim().length}/20 characters minimum.
                </p>
              </div>

              <div>
                <Label htmlFor="pw-scope" className="text-xs">Scope statement</Label>
                <Textarea id="pw-scope" rows={2} value={scopeStatement}
                  onChange={(e) => setScopeStatement(e.target.value)}
                  placeholder="Extent and boundaries — which sites, functions and processes this programme covers."
                  className="mt-1 text-sm" />
              </div>

              <div>
                <Label className="text-xs">Standards this programme discharges</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {allStandards.map((s) => {
                    const on = standards.includes(s);
                    return (
                      <Button key={s} type="button" variant="ghost" aria-pressed={on}
                        onClick={() => setStandards((p) => toggle(p, s))}
                        className={cn(
                          "h-auto rounded-full border px-2.5 py-1 text-[12px] font-medium",
                          on ? "border-violet-500 bg-violet-50 text-violet-800"
                             : "border-slate-200 bg-white text-slate-500",
                        )}>
                        {on && <Check size={11} className="mr-1" />}{s}
                      </Button>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input value={customStandard} onChange={(e) => setCustomStandard(e.target.value)}
                    placeholder="Another standard or buyer code…" className="h-8 text-xs" />
                  <Button type="button" size="sm" variant="outline" disabled={!customStandard.trim()}
                    onClick={() => {
                      setStandards((p) => Array.from(new Set([...p, customStandard.trim()])));
                      setCustomStandard("");
                    }}>
                    Add
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <div>
                  <Label className="text-xs">
                    Programme owner <span className="text-rose-600">*</span>
                  </Label>
                  <div className="mt-1">
                    <UserPicker value={ownerUserId || null} onChange={(id) => setOwnerUserId(id ?? "")}
                      placeholder="Who owns this programme?" />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    The owner cannot approve their own cycle — that is the four-eyes guard.
                  </p>
                </div>
                <div>
                  <Label htmlFor="pw-thresh" className="text-xs">Full-coverage threshold</Label>
                  <div className="mt-1 flex items-center gap-1">
                    <Input id="pw-thresh" type="number" min={1} max={100} value={threshold}
                      onChange={(e) => setThreshold(e.target.value)} />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Proportion of a scope unit&rsquo;s checkpoints that must be assessed to count
                    as covered.
                  </p>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-xs text-slate-500">
                A cycle is one period instance — a financial year, or a three-year certification
                cycle. Coverage is measured <em>within</em> it.
              </p>
              <div className="grid gap-3 sm:grid-cols-[200px_1fr_1fr]">
                <div>
                  <Label htmlFor="pw-cl" className="text-xs">
                    Cycle label <span className="text-rose-600">*</span>
                  </Label>
                  <Input id="pw-cl" value={cycleLabel} onChange={(e) => setCycleLabel(e.target.value)}
                    placeholder="FY27" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="pw-ps" className="text-xs">Period starts</Label>
                  <Input id="pw-ps" type="date" value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="pw-pe" className="text-xs">Period ends</Label>
                  <Input id="pw-pe" type="date" value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1" />
                </div>
              </div>
              {periodInvalid && (
                <p className="text-[11px] text-rose-600">The period must end after it starts.</p>
              )}

              <div>
                <Label htmlFor="pw-pp" className="text-xs">Coverage measured over</Label>
                <Select id="pw-pp" value={String(periodsPerCycle)}
                  onChange={(e) => setPeriodsPerCycle(Number(e.target.value))}
                  className="mt-1 w-auto">
                  <option value="1">1 period — the whole cycle</option>
                  <option value="2">2 half-years</option>
                  <option value="4">4 quarters</option>
                  <option value="12">12 months</option>
                </Select>
                <p className="mt-1 text-[11px] text-slate-500">
                  These become the columns of the coverage matrix, and the denominator of the
                  required-frequency arithmetic.
                </p>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs text-slate-500">
                Scope units are the atomic covered thing — one row per site × discipline. Each
                carries a required frequency, which ISO 45001/9001/14001 cl.9.2.2 makes mandatory
                and the approval guard enforces.
              </p>

              {/* ── Audit category ────────────────────────────────────────
                  The same first choice the audit scheduler asks, in the same
                  shape, because the programme is what those audits discharge:
                  a cycle scoped against one category's disciplines is planning
                  that category's audits. Showing library NAMES here instead
                  ("Page Industries — QMS, EMS & OHS") put the retired industry
                  wording back in the one place it is hardest to notice — a
                  programme scopes a whole YEAR.

                  Switching clears the discipline ticks: the codes belong to the
                  previous taxonomy and mean nothing in this one. */}
              {libraries.length > 1 && libraries.some((l) => l.categoryCode) && (
                <div>
                  <Label className="text-xs">
                    Audit category <span className="text-rose-600">*</span>
                  </Label>
                  <div className={cn(
                    "mt-1 grid gap-1.5",
                    libraries.length === 2 ? "grid-cols-2" : "grid-cols-3",
                  )}>
                    {libraries.map((l) => {
                      const on = l.industryCode === industryCode;
                      return (
                        <Button
                          key={l.industryCode} type="button" variant="ghost" aria-pressed={on}
                          onClick={() => { setIndustryCode(l.industryCode); setDisciplineCodes([]); }}
                          title={l.categoryDescription ?? l.industryName}
                          className={cn(
                            "h-auto flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition",
                            on ? "border-violet-500 bg-violet-50 text-violet-900 shadow-sm"
                               : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                          )}
                        >
                          <span className="text-[12px] font-semibold leading-tight">
                            {l.categoryLabel ?? l.industryName}
                          </span>
                          <span className={cn(
                            "text-[10px] tabular-nums",
                            on ? "text-violet-700" : "text-slate-400",
                          )}>
                            {l.categories.length} disciplines
                            {l.checkpointCount != null && ` · ${l.checkpointCount} checkpoints`}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                  {library?.categoryDescription && (
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {library.categoryDescription}
                    </p>
                  )}
                </div>
              )}

              {/* No categories in the payload — a plain industry taxonomy, which
                  only a non-Page instance has. Kept so this component stays
                  usable there rather than silently offering nothing. */}
              {libraries.length > 1 && !libraries.some((l) => l.categoryCode) && (
                <div>
                  <Label htmlFor="pw-lib" className="text-xs">Discipline taxonomy</Label>
                  <Select id="pw-lib" value={industryCode} className="mt-1"
                    onChange={(e) => { setIndustryCode(e.target.value); setDisciplineCodes([]); }}>
                    {libraries.map((l) => (
                      <option key={l.industryCode} value={l.industryCode}>{l.industryName}</option>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Sites — {siteIds.length}/{sites.length}</Label>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                      onClick={() => setSiteIds(sites.map((s) => s.id))}>All</Button>
                    <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                      onClick={() => setSiteIds([])}>Estate-wide</Button>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {sites.map((s) => {
                    const on = siteIds.includes(s.id);
                    return (
                      <Button key={s.id} type="button" variant="ghost" aria-pressed={on}
                        onClick={() => setSiteIds((p) => toggle(p, s.id))}
                        className={cn(
                          "h-auto rounded-full border px-2.5 py-1 text-[12px]",
                          on ? "border-violet-500 bg-violet-50 text-violet-800"
                             : "border-slate-200 bg-white text-slate-500",
                        )}>
                        {on && <Check size={11} className="mr-1" />}{s.name}
                      </Button>
                    );
                  })}
                </div>
                {siteIds.length === 0 && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    No site selected — one estate-wide scope unit per discipline will be created.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    Disciplines — {disciplineCodes.length}/{library?.categories.length ?? 0}{" "}
                    <span className="text-rose-600">*</span>
                  </Label>
                  <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                    onClick={() =>
                      setDisciplineCodes(
                        disciplineCodes.length === (library?.categories.length ?? 0)
                          ? []
                          : (library?.categories ?? []).map((d) => d.code),
                      )
                    }>
                    {disciplineCodes.length === (library?.categories.length ?? 0) ? "None" : "All"}
                  </Button>
                </div>
                <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-slate-200">
                  {(library?.categories ?? []).map((d) => {
                    const on = disciplineCodes.includes(d.code);
                    return (
                      <button key={d.code} type="button"
                        onClick={() => setDisciplineCodes((p) => toggle(p, d.code))}
                        className={cn(
                          "flex w-full items-center gap-2 border-b border-slate-100 px-2.5 py-1.5 text-left text-xs last:border-0 hover:bg-slate-50",
                          on && "bg-violet-50/60",
                        )}>
                        <span className={cn(
                          "flex size-3.5 items-center justify-center rounded border text-[9px]",
                          on ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300",
                        )}>{on && "✓"}</span>
                        <span className="truncate text-slate-700">{d.name}</span>
                        <span className="ml-auto text-[10px] text-slate-400">
                          {d.checkpointCount} cp
                        </span>
                      </button>
                    );
                  })}
                  {!library?.categories.length && (
                    <p className="p-3 text-xs text-slate-400">
                      No checkpoint library is available to draw disciplines from.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pw-freq" className="text-xs">Required audits per cycle</Label>
                  <Input id="pw-freq" type="number" min={0} value={requiredPerCycle}
                    onChange={(e) => setRequiredPerCycle(e.target.value)} className="mt-1" />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Applied to every unit; tune per unit on the Scope tab afterwards. A unit with
                    neither a frequency nor a documented waiver blocks approval.
                  </p>
                </div>
                <div>
                  <Label htmlFor="pw-rw" className="text-xs">Risk weight</Label>
                  <Select id="pw-rw" value={riskWeight} onChange={(e) => setRiskWeight(e.target.value)}
                    className="mt-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}{n === 5 ? " — highest" : n === 1 ? " — lowest" : ""}</option>
                    ))}
                  </Select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Ranks the gap list: an uncovered weight-5 unit outranks three weight-1s.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 text-xs text-violet-900">
                This creates <strong>{unitCount}</strong> scope unit{unitCount === 1 ? "" : "s"}
                {siteIds.length > 0 && <> — {siteIds.length} site{siteIds.length === 1 ? "" : "s"} × {disciplineCodes.length} discipline{disciplineCodes.length === 1 ? "" : "s"}</>}.
              </div>
            </>
          )}

          {err && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {err}
            </div>
          )}
        </div>

        <DialogFooter className="items-center justify-between gap-2 border-t px-5 py-3 sm:justify-between">
          <Button type="button" variant="outline" size="sm" disabled={busy}
            onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as Step))}>
            {step === 1 ? "Cancel" : <><ArrowLeft size={14} /> Back</>}
          </Button>
          {step < 3 ? (
            <Button type="button" size="sm"
              disabled={(step === 1 && step1Invalid) || (step === 2 && step2Invalid)}
              onClick={() => setStep((s) => (s + 1) as Step)}>
              Next <ArrowRight size={14} />
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={busy || step3Invalid} onClick={create}>
              {busy && <Loader2 size={14} className="animate-spin" />} Create programme
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepChip({
  n, active, done, icon, children,
}: {
  n: number; active: boolean; done: boolean;
  icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
      active ? "bg-violet-600 text-white"
        : done ? "bg-emerald-50 text-emerald-700" : "text-slate-400",
    )}>
      {done ? <Check size={12} /> : icon}
      <span className="hidden sm:inline">{children}</span>
      <span className="sm:hidden">{n}</span>
    </span>
  );
}

/** 1 April of the current Indian financial year — the default a cycle opens on. */
function fyStart(): Date {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 3, 1);
}
function addYear(d: Date): Date {
  return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate() - 1);
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
