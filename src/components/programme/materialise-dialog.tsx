"use client";

// Materialise a slot into a real engagement.
//
// docs/cams/08 §6.1: the schedule flow is *pre-filled from the plan* — site,
// scope units → disciplines, standards, intended lead, sampling approach,
// estimated duration — and the engagement it produces links back to the slot
// automatically.
//
// **What this replaces.** The old flow was a text box asking for an
// "engagement id", hard-coded to `engagementKind: "AUDIT"`. It required the
// user to go and create an engagement somewhere else, copy a UUID out of a URL
// and paste it back; it could not link an inspection at all despite the pointer
// being polymorphic; and nothing checked the pasted id was for the right site
// or covered the planned scope. A typo produced a slot whose coverage and
// variance were computed against a stranger's audit.
//
// The form below asks only for what the plan cannot decide: which engine, who
// leads, and the date inside the window. Everything else is derived
// server-side — the client renders the plan, it never computes it, so a stale
// tab cannot schedule against scope that has since changed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap, AlertTriangle, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { UserPicker } from "@/components/ui/user-picker";
import { readApiError } from "@/lib/client-errors";
import { fmtDate, type SlotPlan } from "@/app/(dashboard)/cams/programme/lib-programme";
import { Alert } from "@/components/ui/alert";

export function MaterialiseDialog({
  plan, sites, onClose,
}: {
  plan: SlotPlan;
  sites: { id: string; code: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"AUDIT" | "INSPECTION">(
    // An audit needs disciplines that a checkpoint library can materialise;
    // without one, the honest default is the inspection engine.
    plan.industryCode ? "AUDIT" : "INSPECTION",
  );
  const [siteId, setSiteId] = useState(plan.siteId ?? "");
  const [lead, setLead] = useState(plan.intendedLeadUserId ?? "");
  const [title, setTitle] = useState(plan.suggestedTitle);
  const [scheduledOn, setScheduledOn] = useState(plan.windowStart.slice(0, 10));
  const [engagementType, setEngagementType] = useState("INSPECTION");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const outsideWindow =
    scheduledOn < plan.windowStart.slice(0, 10) || scheduledOn > plan.windowEnd.slice(0, 10);
  const noLibrary = kind === "AUDIT" && !plan.industryCode;
  const invalid = !siteId || !lead || title.trim().length < 4 || noLibrary;

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/programme/slots/${plan.slotId}/materialise`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        engagementKind: kind,
        leadAuditorUserId: lead,
        siteId,
        title: title.trim(),
        scheduledOn,
        engagementType: kind === "INSPECTION" ? engagementType : "INTERNAL_AUDIT",
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not materialise this slot"));
      return;
    }
    const created = await res.json();
    onClose();
    router.push(created.href);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Zap size={15} className="text-violet-700" /> Materialise {plan.slotCode}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Creates the engagement this slot planned and links it back automatically. The scope,
          standards and estimate below come from the plan.
        </p>

        {/* What the plan already decided — read-only, so it is obvious the user
            is scheduling THIS slot and not filling a blank form. */}
        <Alert variant="brand" className="mt-3 space-y-1.5 rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-[11px] text-violet-900">
          <div className="flex items-center gap-1.5">
            <CalendarRange size={12} />
            Window {fmtDate(plan.windowStart)} – {fmtDate(plan.windowEnd)} · P{plan.periodIndex + 1}
            · {plan.estimatedAuditorDays}d estimated
          </div>
          {plan.disciplineCodes.length > 0 && (
            <div>
              <span className="font-medium">Scope:</span>{" "}
              {plan.scopeUnits.map((u) => u.dimensionLabel).join(", ")}
            </div>
          )}
          {plan.standardRefs.length > 0 && (
            <div><span className="font-medium">Standards:</span> {plan.standardRefs.join(", ")}</div>
          )}
          {plan.samplingApproach !== "FULL" && (
            <div>
              <span className="font-medium">Sampling:</span>{" "}
              {plan.samplingApproach.replace(/_/g, " ").toLowerCase()} — carried into the
              engagement&rsquo;s scope statement.
            </div>
          )}
        </Alert>

        {kind === "AUDIT" && plan.unmatchedDisciplineCodes.length > 0 && (
          <Alert variant="warning" className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              {plan.unmatchedDisciplineCodes.length} planned discipline(s) —{" "}
              {plan.unmatchedDisciplineCodes.join(", ")} — are not in the matching checkpoint
              library and will not be materialised. That gap will show as scope variance, which is
              correct: the audit really will not cover them.
            </span>
          </Alert>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-xs">Which engine</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <KindCard
                on={kind === "AUDIT"}
                disabled={!plan.industryCode}
                onClick={() => setKind("AUDIT")}
                title="Audit"
                sub={
                  plan.industryCode
                    ? `Checkpoint audit — ${plan.matchedDisciplineCodes.length} discipline(s)`
                    : "No matching checkpoint library for this scope"
                }
              />
              <KindCard
                on={kind === "INSPECTION"}
                onClick={() => setKind("INSPECTION")}
                title="Inspection"
                sub="Checklist engagement against the declared standards"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              The slot&rsquo;s engagement pointer is polymorphic — the programme sits above both
              engines, so either is a legitimate way to discharge this plan.
            </p>
          </div>

          {kind === "INSPECTION" && (
            <div>
              <Label htmlFor="ms-type" className="text-xs">Engagement type</Label>
              <SelectField id="ms-type" value={engagementType} className="mt-1"
                onChange={setEngagementType}
                options={[
                { value: "INSPECTION", label: "Inspection" },
                { value: "INTERNAL_AUDIT", label: "Internal audit" },
                { value: "COMPLIANCE_AUDIT", label: "Compliance audit" },
                { value: "SUPPLIER_AUDIT", label: "Supplier audit" },
                { value: "LAYERED_PROCESS_AUDIT", label: "Layered process audit" }
              ]}
              />
            </div>
          )}

          <div>
            <Label htmlFor="ms-title" className="text-xs">Title</Label>
            <Input id="ms-title" value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ms-site" className="text-xs">
                Site <span className="text-rose-600">*</span>
              </Label>
              <SelectField id="ms-site" value={siteId} onChange={setSiteId}
                className="mt-1"
                placeholder="— select —"
                options={sites.map((s) => ({ value: s.id, label: s.name }))}
              />
              {plan.multiSite && (
                <p className="mt-1 text-[11px] text-amber-700">
                  This slot spans {plan.siteIds.length} sites; an engagement runs at one. Pick the
                  site this one covers.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="ms-date" className="text-xs">Scheduled date</Label>
              <Input id="ms-date" type="date" value={scheduledOn} className="mt-1"
                min={plan.windowStart.slice(0, 10)} max={plan.windowEnd.slice(0, 10)}
                onChange={(e) => setScheduledOn(e.target.value)} />
              {outsideWindow && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Outside the planned window — it will be clamped into it, and any real slip
                  belongs in an amendment.
                </p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs">
              Lead auditor <span className="text-rose-600">*</span>
            </Label>
            <div className="mt-1">
              <UserPicker value={lead || null} onChange={(id) => setLead(id ?? "")}
                placeholder="Who leads this engagement?" />
            </div>
            {plan.intendedLeadUserId && (
              <p className="mt-1 text-[11px] text-slate-500">
                Pre-filled from the slot&rsquo;s intended lead. Independence is checked when the
                engagement is created, and refuses a conflicted team.
              </p>
            )}
          </div>
        </div>

        {err && (
          <Alert variant="destructive" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {err}
          </Alert>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={busy || invalid}>
            {busy && <Loader2 size={14} className="animate-spin" />} Create &amp; link
          </Button>
        </div>
      </div>
    </div>
  );
}

function KindCard({
  on, disabled, onClick, title, sub,
}: {
  on: boolean; disabled?: boolean; onClick: () => void; title: string; sub: string;
}) {
  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={disabled} aria-pressed={on}
      className={cn(
        "justify-start h-auto flex-col items-start rounded-lg p-2.5 text-left",
        on && "border-violet-500 bg-violet-50 hover:bg-violet-100",
      )}>
      <div className={cn("text-sm font-medium", on ? "text-violet-900" : "text-slate-700")}>
        {title}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>
    </Button>
  );
}
