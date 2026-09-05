// Audit-grade read-only sections for the incident detail page.
// Each section is a self-contained card that renders one slice of the
// incident record. Layout is print-friendly: the page can be exported
// to PDF via the browser's print dialog and reads as a formal
// investigation report.
//
// All sections render even when their data is empty — empty cards show
// a muted placeholder so the audit trail is visually complete.

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RcaEditor } from "@/components/incidents/rca-editor";
import { normaliseRcaMethod } from "@/lib/rca/types";
import { formatDate, formatDateTime, formatINR, humanize } from "@/lib/utils";
import {
  Activity, AlertTriangle, ArrowUpRight, Award, Brain, Building2, Calendar,
  CheckCircle2, ClipboardList, Clock, FileText, IndianRupee, ListChecks,
  MapPin, Search, ShieldAlert, Sparkles, Users, User as UserIcon, Wrench,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";

// ─── Type imports for the props (Prisma row shapes) ──────────────────

type Person = {
  id: string;
  externalName: string | null;
  user?: { name: string; designation: string | null } | null;
  role: string;
  isContractor: boolean;
  contractorCompany?: { name: string } | null;
  isInjured: boolean;
  bodyPartAffected: string | null;
  natureOfInjury: string | null;
  injurySeverity: string | null;
  treatment: string | null;
  hospitalName: string | null;
  daysOff: number | null;
  daysRestricted: number | null;
  returnToWorkDate: Date | string | null;
  isFitForDuty: boolean | null;
};

type TimelineEvent = {
  id: string;
  sequence: number;
  timestamp: Date | string;
  description: string;
  source: string;
  sourceReference: string | null;
};

type Witness = {
  id: string;
  witnessName: string;
  witnessRole: string | null;
  statementText: string | null;
  statementFileUrl: string | null;
  audioRecordingUrl: string | null;
  takenAt: Date | string;
  language: string | null;
};

type Evidence = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  fileName: string | null;
  collectedAt: Date | string | null;
  preservedFor: string | null;
};

type Equipment = {
  id: string;
  equipment?: { code: string; name: string } | null;
  involvement: string;
  damageEstimate: number | string | null;
  repairStatus: string | null;
};

type Capa = {
  id: string;
  capaNumber: string;
  description: string;
  type: string;
  rootCauseAddressed: string | null;
  ownerId: string;
  owner?: { name: string } | null;
  targetDate: Date | string;
  status: string;
  completedAt: Date | string | null;
  effectivenessRating: number | null;
};

type Reclassification = {
  id: string;
  fromType: string;
  toType: string;
  fromSeverity: string | null;
  toSeverity: string | null;
  reason: string;
  reclassifiedAt: Date | string;
  reclassifiedBy?: { name: string } | null;
  triggersStatutoryUpdate: boolean;
};

// ─── Tiny helpers used across sections ───────────────────────────────

function SectionShell({
  title,
  icon: Icon,
  count,
  children,
  emptyHint,
  headerAction
}: {
  title: string;
  icon: LucideIcon;
  count?: number;
  children: React.ReactNode;
  emptyHint?: string;
  headerAction?: React.ReactNode;
}) {
  const isEmpty = count === 0;
  return (
    <Card className="break-inside-avoid">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon size={16} className="text-slate-500" /> {title}
          {count !== undefined && (
            <span className="text-xs text-slate-500 font-normal">({count})</span>
          )}
        </CardTitle>
        {headerAction}
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="text-sm text-slate-500 italic">{emptyHint ?? "Nothing recorded."}</div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 w-32 flex-shrink-0">{label}</div>
      <div className="text-slate-800 flex-1 min-w-0">{value || "—"}</div>
    </div>
  );
}

// ─── Section 2 — Incident Summary ────────────────────────────────────

export function IncidentSummarySection({ incident, reclassifications }: {
  incident: any;
  reclassifications: Reclassification[];
}) {
  return (
    <Card className="break-inside-avoid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks size={16} className="text-slate-500" /> Incident Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-slate-800 whitespace-pre-wrap text-sm leading-relaxed">
          {incident.initialDescription || incident.description}
        </p>
        {incident.classificationRationale && (
          <Card className="rounded-md border-slate-200 bg-slate-50 p-3 shadow-none">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
              Classification Rationale
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{incident.classificationRationale}</p>
          </Card>
        )}
        {reclassifications.length > 0 && (
          <Alert variant="warning" size="lg" className="p-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-900 mb-1.5">
              Reclassification History ({reclassifications.length})
            </div>
            <ul className="space-y-1 text-xs text-amber-900">
              {reclassifications.map((r) => (
                <li key={r.id}>
                  <span className="font-medium">{r.fromType}</span>
                  {r.fromSeverity && <span className="text-amber-700"> ({r.fromSeverity})</span>}
                  {" → "}
                  <span className="font-medium">{r.toType}</span>
                  {r.toSeverity && <span className="text-amber-700"> ({r.toSeverity})</span>}
                  <span className="text-amber-700"> · {formatDateTime(r.reclassifiedAt)} · {r.reclassifiedBy?.name ?? "—"}</span>
                  {r.triggersStatutoryUpdate && <span className="ml-2 px-1.5 py-0.5 bg-rose-200 text-rose-900 rounded text-[10px] font-bold uppercase">Statutory urgent</span>}
                  <div className="text-amber-800 mt-0.5 italic">"{r.reason}"</div>
                </li>
              ))}
            </ul>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 3 — Persons Involved ────────────────────────────────────

export function PersonsInvolvedSection({ persons }: { persons: Person[] }) {
  return (
    <SectionShell title="Persons Involved" icon={Users} count={persons.length}
      emptyHint="No persons were captured.">
      <div className="grid sm:grid-cols-2 gap-3">
        {persons.map((p) => (
          <div key={p.id} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">
                  {p.user?.name ?? p.externalName ?? "Unnamed"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {p.role.replace(/_/g, " ")}
                  {p.user?.designation && ` · ${p.user.designation}`}
                  {p.isContractor && ` · ${p.contractorCompany?.name ?? "Contractor"}`}
                </div>
              </div>
              {p.isInjured && p.injurySeverity && (
                <Badge className={
                  p.injurySeverity === "FATAL"
                    ? "bg-rose-200 text-rose-900 border-rose-300"
                    : p.injurySeverity === "MAJOR"
                      ? "bg-orange-100 text-orange-800 border-orange-200"
                      : "bg-amber-100 text-amber-800 border-amber-200"
                }>{p.injurySeverity}</Badge>
              )}
            </div>
            {p.isInjured && (
              <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-700 space-y-0.5">
                {p.bodyPartAffected && <div><span className="text-slate-500">Body part:</span> {p.bodyPartAffected}</div>}
                {p.natureOfInjury && <div><span className="text-slate-500">Nature:</span> {p.natureOfInjury}</div>}
                {p.treatment && <div><span className="text-slate-500">Treatment:</span> {p.treatment}</div>}
                {p.hospitalName && <div><span className="text-slate-500">Hospital:</span> {p.hospitalName}</div>}
                {p.daysOff != null && <div><span className="text-slate-500">Days off:</span> {p.daysOff}{p.daysRestricted != null && ` · restricted ${p.daysRestricted}`}</div>}
                {p.returnToWorkDate && <div><span className="text-slate-500">Returned:</span> {formatDateTime(p.returnToWorkDate).split(",")[0]}</div>}
                {p.isFitForDuty != null && (
                  <div className={p.isFitForDuty ? "text-emerald-700" : "text-rose-700"}>
                    {p.isFitForDuty ? "✓ Fit for duty" : "✗ Not fit for duty"}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

// ─── Section 4 — Timeline ─────────────────────────────────────────────

export function TimelineSection({ events }: { events: TimelineEvent[] }) {
  return (
    <SectionShell title="Timeline of Events" icon={Clock} count={events.length}
      emptyHint="No timeline events recorded.">
      <ol className="relative border-l-2 border-slate-200 ml-3 space-y-3 pl-4">
        {events.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-primary-600 border-2 border-white" />
            <Card className="rounded-md border-slate-200 p-2.5 shadow-none">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold">#{e.sequence}</span>
                <span>·</span>
                <span>{formatDateTime(e.timestamp)}</span>
                <span>·</span>
                <span className="font-medium text-slate-700">{e.source.replace(/_/g, " ")}</span>
                {e.sourceReference && <span className="text-slate-500">({e.sourceReference})</span>}
              </div>
              <div className="text-sm text-slate-800 mt-1">{e.description}</div>
            </Card>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

// ─── Section 5 — Witness Statements ──────────────────────────────────

export function WitnessStatementsSection({ witnesses }: { witnesses: Witness[] }) {
  return (
    <SectionShell title="Witness Statements" icon={UserIcon} count={witnesses.length}
      emptyHint="No witness statements taken.">
      <div className="space-y-3">
        {witnesses.map((w) => (
          <div key={w.id} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-800">{w.witnessName}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {w.witnessRole ?? "—"} · taken {formatDateTime(w.takenAt)} · {w.language ?? "English"}
            </div>
            {w.statementText && (
              <Card className="mt-2 whitespace-pre-wrap rounded-md border-slate-200 bg-slate-50 p-2.5 text-sm italic text-slate-700 shadow-none">
                "{w.statementText}"
              </Card>
            )}
            {(w.statementFileUrl || w.audioRecordingUrl) && (
              <div className="mt-2 flex gap-3 text-xs print:hidden">
                {w.statementFileUrl && (
                  <a href={w.statementFileUrl} target="_blank" rel="noopener" className="text-primary-700 underline">Signed PDF</a>
                )}
                {w.audioRecordingUrl && (
                  <a href={w.audioRecordingUrl} target="_blank" rel="noopener" className="text-primary-700 underline">Audio recording</a>
                )}
              </div>
            )}
            {!w.statementText && (
              <div className="text-xs text-slate-500 italic mt-2">No statement text recorded.</div>
            )}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

// ─── Section 6 — Evidence Collection ─────────────────────────────────

export function EvidenceSection({ evidence }: { evidence: Evidence[] }) {
  // Group by category for the gallery view
  const grouped = evidence.reduce((acc, e) => {
    (acc[e.category] = acc[e.category] || []).push(e);
    return acc;
  }, {} as Record<string, Evidence[]>);

  return (
    <SectionShell title="Evidence Collection" icon={Search} count={evidence.length}
      emptyHint="No evidence items collected.">
      <div className="space-y-3">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">
              {category.replace(/_/g, " ")} ({items.length})
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {items.map((e) => (
                <div key={e.id} className="rounded-md border border-slate-200 bg-white p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">{e.title}</div>
                      {e.description && <div className="text-xs text-slate-600 mt-1">{e.description}</div>}
                      {e.fileUrl && (
                        <a href={e.fileUrl} target="_blank" rel="noopener" className="text-xs text-primary-700 underline mt-1 inline-block print:hidden">
                          {e.fileName || "View file"}
                        </a>
                      )}
                      {e.collectedAt && (
                        <div className="text-[10px] text-slate-400 mt-1">collected {formatDateTime(e.collectedAt)}</div>
                      )}
                    </div>
                    {e.preservedFor && (
                      <span className={cn(
                        "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold",
                        e.preservedFor === "legal" ? "bg-rose-100 text-rose-800" :
                        e.preservedFor === "regulatory" ? "bg-amber-100 text-amber-800" :
                        "bg-slate-100 text-slate-700"
                      )}>{e.preservedFor}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

// ─── Section 8 — Equipment Involvement ───────────────────────────────

export function EquipmentSection({ equipment }: { equipment: Equipment[] }) {
  const totalDamage = equipment.reduce((sum, e) => sum + (Number(e.damageEstimate) || 0), 0);
  return (
    <SectionShell title="Equipment Involvement" icon={Wrench} count={equipment.length}
      emptyHint="No equipment recorded as involved.">
      <div className="space-y-2">
        {equipment.map((e) => (
          <div key={e.id} className="rounded-md border border-slate-200 bg-white p-2.5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {e.equipment?.name ?? "Unknown"}
                  {e.equipment?.code && <span className="text-xs text-slate-500 font-mono ml-2">({e.equipment.code})</span>}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {e.involvement.replace(/_/g, " ")}
                  {e.repairStatus && <span> · {e.repairStatus.replace(/_/g, " ").toLowerCase()}</span>}
                </div>
              </div>
              {e.damageEstimate != null && Number(e.damageEstimate) > 0 && (
                <div className="text-sm font-semibold text-slate-700 font-mono">
                  {formatINR(Number(e.damageEstimate))}
                </div>
              )}
            </div>
          </div>
        ))}
        {totalDamage > 0 && (
          <div className="text-xs text-slate-600 text-right pt-1.5 border-t border-slate-200 mt-2">
            Total equipment damage: <span className="font-bold">{formatINR(totalDamage)}</span>
          </div>
        )}
      </div>
    </SectionShell>
  );
}

// ─── Section 9 — Cause Analysis (two-part) ───────────────────────────

export function CauseAnalysisSection({ incident }: { incident: any }) {
  const has = (arr: string[] | null | undefined) => Array.isArray(arr) && arr.length > 0;
  const nothing = !has(incident.immediateCauses) && !has(incident.underlyingCauses)
    && !has(incident.rootCauses) && !has(incident.contributingFactors)
    && !incident.rootCauseData;

  return (
    <Card className="break-inside-avoid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain size={16} className="text-slate-500" /> Cause Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nothing ? (
          <div className="text-sm text-slate-500 italic">Cause analysis not yet completed.</div>
        ) : (
          <>
            {/* Part A — Cause Hierarchy */}
            <div className="grid sm:grid-cols-2 gap-3">
              <CauseList title="Immediate Causes" tone="default" items={incident.immediateCauses} />
              <CauseList title="Underlying Causes" tone="default" items={incident.underlyingCauses} />
              <CauseList title="Root Causes" tone="primary" items={incident.rootCauses} />
              <CauseList title="Contributing Factors" tone="default" items={incident.contributingFactors} />
            </div>

            {incident.rootCauseSummary && (
              <Card className="rounded-md border-violet-200 bg-violet-50 p-3 shadow-none">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-violet-800 mb-1">
                  Plain-English Summary
                </div>
                <p className="text-sm text-violet-900">{incident.rootCauseSummary}</p>
              </Card>
            )}

            {/* Part B — Methodology Visualization (read-only) */}
            {incident.rootCauseMethod && incident.rootCauseData && (
              <div className="pt-3 border-t border-slate-200">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
                  Methodology: {incident.rootCauseMethod.replace(/_/g, " ")}
                </div>
                <RcaEditor
                  method={normaliseRcaMethod(incident.rootCauseMethod)}
                  value={incident.rootCauseData}
                  readOnly
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CauseList({ title, items, tone }: { title: string; items?: string[] | null; tone: "default" | "primary" }) {
  if (!items || items.length === 0) {
    return (
      <div className={cn(
        "rounded-md border p-3",
        tone === "primary" ? "border-primary-200 bg-primary-50/40" : "border-slate-200 bg-slate-50/60"
      )}>
        <div className={cn(
          "text-[11px] uppercase tracking-wider font-semibold mb-1.5",
          tone === "primary" ? "text-primary-800" : "text-slate-600"
        )}>{title}</div>
        <div className="text-xs text-slate-500 italic">none recorded</div>
      </div>
    );
  }
  return (
    <div className={cn(
      "rounded-md border p-3",
      tone === "primary" ? "border-primary-300 bg-primary-50" : "border-slate-200 bg-slate-50/60"
    )}>
      <div className={cn(
        "text-[11px] uppercase tracking-wider font-semibold mb-1.5",
        tone === "primary" ? "text-primary-900" : "text-slate-600"
      )}>{title}</div>
      <ul className="text-sm text-slate-800 space-y-1">
        {items.map((c, i) => <li key={i} className="flex gap-2"><span className="text-slate-400">•</span><span>{c}</span></li>)}
      </ul>
    </div>
  );
}

// ─── Section 10 — CAPAs ──────────────────────────────────────────────

export function CapasSection({ capas, incidentId }: { capas: Capa[]; incidentId?: string }) {
  return (
    <SectionShell
      title="CAPAs"
      icon={ClipboardList}
      count={capas.length}
      emptyHint="No CAPAs defined."
      headerAction={
        incidentId ? (
          <a
            href={`/capa?source=SAFETY`}
            className="text-xs text-primary-700 hover:underline"
          >
            View in CAPA register →
          </a>
        ) : null
      }
    >
      <ul className="space-y-2">
        {capas.map((c) => (
          <li key={c.id} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <a
                href={`/capa?q=${encodeURIComponent(c.capaNumber)}`}
                className="font-mono font-semibold text-primary-700 hover:underline"
                title="Open in unified CAPA register"
              >
                {c.capaNumber}
              </a>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                c.type === "CORRECTIVE" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"
              )}>{c.type}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                c.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800" :
                c.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                c.status === "OVERDUE" ? "bg-rose-100 text-rose-800" :
                c.status === "NOT_EFFECTIVE" ? "bg-rose-100 text-rose-800" :
                "bg-slate-100 text-slate-700"
              )}>{c.status.replace(/_/g, " ")}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-500">Owner: {c.owner?.name ?? c.ownerId.slice(0, 8)}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-500">Due {formatDateTime(c.targetDate).split(",")[0]}</span>
              {c.effectivenessRating != null && (
                <span className="ml-1 text-amber-700">{"★".repeat(c.effectivenessRating)}{"☆".repeat(5 - c.effectivenessRating)}</span>
              )}
            </div>
            <div className="text-sm text-slate-800 mt-1.5">{c.description}</div>
            {c.rootCauseAddressed && (
              <div className="text-xs text-slate-600 mt-1 italic">↳ addresses: {c.rootCauseAddressed}</div>
            )}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

// ─── Section 11 — Cost of Incident ───────────────────────────────────

export function CostBreakdownSection({ incident }: { incident: any }) {
  const rows = [
    { label: "Medical", val: incident.costMedical },
    { label: "Property Damage", val: incident.costPropertyDamage ?? incident.propertyDamageCost },
    { label: "Lost Production", val: incident.costLostProduction },
    { label: "Insurance Claim", val: incident.costInsurance },
    { label: "Legal / Regulatory", val: incident.costLegalRegulatory },
    { label: "Other", val: incident.costOther }
  ].filter((r) => r.val != null && Number(r.val) > 0);

  const total = incident.costTotal ?? rows.reduce((s, r) => s + Number(r.val || 0), 0);

  return (
    <SectionShell title="Cost of Incident" icon={IndianRupee} count={rows.length || (total > 0 ? 1 : 0)}
      emptyHint="No costs recorded.">
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-b-0">
            <span className="text-slate-600">{r.label}</span>
            <span className="font-mono font-medium text-slate-800">{formatINR(Number(r.val))}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 mt-2 border-t-2 border-slate-300">
          <span className="text-sm font-semibold text-slate-900">Total</span>
          <span className="font-mono font-bold text-base text-slate-900">{formatINR(Number(total) || 0)}</span>
        </div>
      </div>
    </SectionShell>
  );
}

// ─── Section 12 — Statutory & Compliance ─────────────────────────────

export function StatutorySection({ incident }: { incident: any }) {
  const reportable = incident.isReportable;
  if (!reportable) {
    return (
      <SectionShell title="Statutory & Compliance" icon={ShieldAlert}>
        <div className="text-sm text-slate-600">
          This incident has been classified as <span className="font-medium">not statutorily reportable</span>.
        </div>
      </SectionShell>
    );
  }

  const submissions = [
    { regulation: "Form 18 (Factories Act)", submitted: incident.form18Submitted, date: incident.form18SubmissionDate, ref: incident.form18SubmissionRef },
    { regulation: "DGFASLI", submitted: incident.dgfasliSubmitted, date: incident.dgfasliSubmissionDate, ref: null },
    { regulation: "CPCB (Environmental)", submitted: incident.cpcbSubmitted, date: incident.cpcbSubmissionDate, ref: null }
  ].filter((s) => incident.reportableUnder?.includes(
    s.regulation.startsWith("Form 18") ? "FACTORIES_ACT" :
    s.regulation === "DGFASLI" ? "DGFASLI" : "CPCB"
  ));

  const deadline = incident.statutoryDeadline ? new Date(incident.statutoryDeadline) : null;
  const deadlineState = deadline
    ? deadline.getTime() < Date.now()
      ? "overdue"
      : deadline.getTime() - Date.now() < 4 * 3_600_000 ? "imminent" : "ok"
    : null;

  return (
    <SectionShell title="Statutory & Compliance" icon={ShieldAlert}>
      <div className="space-y-3">
        {deadline && (
          <div className={cn(
            "rounded-md border px-3 py-2 text-sm flex items-start gap-2",
            deadlineState === "overdue" ? "border-rose-300 bg-rose-50 text-rose-900" :
            deadlineState === "imminent" ? "border-amber-300 bg-amber-50 text-amber-900" :
            "border-slate-300 bg-slate-50 text-slate-800"
          )}>
            <Clock size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Statutory deadline: {formatDateTime(deadline)}</div>
              {deadlineState === "overdue" && <div className="text-xs">Submission window has lapsed — retroactive filing required.</div>}
            </div>
          </div>
        )}
        <ul className="space-y-1.5">
          {submissions.map((s) => (
            <li key={s.regulation} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{s.regulation}</span>
              {s.submitted ? (
                <span className="text-emerald-700 text-xs flex items-center gap-1">
                  <CheckCircle2 size={12} /> Submitted
                  {s.date && <span className="text-slate-500"> · {formatDateTime(s.date).split(",")[0]}</span>}
                  {s.ref && <span className="text-slate-500 font-mono ml-1">({s.ref})</span>}
                </span>
              ) : (
                <span className="text-slate-500 text-xs">Pending</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}

// ─── Section 13 — Investigation Team ─────────────────────────────────

export function InvestigationTeamSection({ team }: {
  team: { id: string; role: string; user: { name: string; designation: string | null } }[];
}) {
  return (
    <SectionShell title="Investigation Team" icon={Users} count={team.length}
      emptyHint="No team constituted yet.">
      <div className="grid sm:grid-cols-2 gap-2">
        {team.map((m) => (
          <div key={m.id} className={cn(
            "rounded-md border p-2.5 flex items-center gap-2",
            m.role === "LEAD" ? "border-primary-300 bg-primary-50" : "border-slate-200 bg-white"
          )}>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate">{m.user.name}</div>
              <div className="text-xs text-slate-500 truncate">{m.user.designation ?? "—"}</div>
            </div>
            {m.role === "LEAD" && (
              <Badge className="bg-primary-100 text-primary-800 border-primary-200 text-[10px]">LEAD</Badge>
            )}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

// ─── Section 14 — Lessons Learned ────────────────────────────────────

export function LessonsLearnedSection({ incident }: { incident: any }) {
  if (!incident.lessonsLearned) {
    return null;  // hide section entirely if empty
  }
  return (
    <Card className="break-inside-avoid border-violet-200 bg-violet-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-violet-900">
          <Sparkles size={16} /> Lessons Learned
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-violet-900 whitespace-pre-wrap">{incident.lessonsLearned}</p>
        {incident.lessonsDistributedTo && Array.isArray(incident.lessonsDistributedTo) && (
          <div className="text-xs text-violet-700 mt-2 print:hidden">
            Distributed to {incident.lessonsDistributedTo.length} plant{incident.lessonsDistributedTo.length === 1 ? "" : "s"}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 7 — Documents Reviewed ─────────────────────────────────

type DocumentReview = {
  id: string;
  documentType: string;
  documentReference: string;
  documentLinkId: string | null;
  reviewNotes: string | null;
  complianceFinding: string | null;
};

export function DocumentsReviewedSection({ documents }: { documents: DocumentReview[] }) {
  return (
    <SectionShell title="Documents Reviewed" icon={FileText} count={documents.length}
      emptyHint="No internal documents (SOPs / permits / training records) reviewed.">
      <ul className="space-y-2">
        {documents.map((d) => (
          <li key={d.id} className="rounded-md border border-slate-200 bg-white p-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono font-semibold text-slate-700 text-[10px] uppercase">
                {d.documentType.replace(/_/g, " ")}
              </span>
              {d.complianceFinding && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                  d.complianceFinding === "COMPLIANT" ? "bg-emerald-100 text-emerald-800" :
                  d.complianceFinding === "NON_COMPLIANT" ? "bg-rose-100 text-rose-800" :
                  "bg-slate-100 text-slate-700"
                )}>{d.complianceFinding.replace(/_/g, " ")}</span>
              )}
            </div>
            <div className="text-sm font-semibold text-slate-800 mt-1">{d.documentReference}</div>
            {d.reviewNotes && <div className="text-xs text-slate-600 mt-1">{d.reviewNotes}</div>}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}


// ─── Section 15 — 90-Day Effectiveness Review ────────────────────────

export function EffectivenessReviewSection({ incident }: { incident: any }) {
  if (!incident.effectivenessReviewDueAt && !incident.effectivenessReviewedAt) {
    return null;
  }
  const due = incident.effectivenessReviewDueAt ? new Date(incident.effectivenessReviewDueAt) : null;
  const reviewed = incident.effectivenessReviewedAt ? new Date(incident.effectivenessReviewedAt) : null;
  const overdue = due && !reviewed && due.getTime() < Date.now();

  return (
    <Card className="break-inside-avoid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 size={16} className="text-slate-500" /> 90-Day Effectiveness Review
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reviewed ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-emerald-700 font-medium">✓ Reviewed</span>
              <span className="text-slate-500">on {formatDateTime(reviewed)}</span>
            </div>
            {incident.effectivenessRating != null && (
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Rating:</span>
                <span className="text-amber-700 text-base">
                  {"★".repeat(incident.effectivenessRating)}{"☆".repeat(5 - incident.effectivenessRating)}
                </span>
                <span className="text-slate-600 text-xs">({incident.effectivenessRating}/5)</span>
              </div>
            )}
            {incident.effectivenessNotes && (
              <p className="text-sm text-slate-700 whitespace-pre-wrap pt-1">{incident.effectivenessNotes}</p>
            )}
          </div>
        ) : due ? (
          <div className={cn(
            "text-sm flex items-start gap-2",
            overdue ? "text-rose-800" : "text-slate-700"
          )}>
            <Clock size={14} className={cn("mt-0.5 flex-shrink-0", overdue ? "text-rose-600" : "text-slate-500")} />
            <div>
              <div className="font-medium">
                {overdue ? "OVERDUE for review" : "Scheduled for review"}: {formatDate(due)}
              </div>
              <div className="text-xs mt-0.5 text-slate-500">
                HSE Manager confirms each CAPA's continued effectiveness 90 days after closure. Re-opening allowed if any CAPA marked Not Effective.
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}


// ─── Section 16 — Comments & Discussion ──────────────────────────────

type Comment = {
  id: string;
  authorId: string;
  author?: { name: string; designation: string | null } | null;
  content: string;
  isPrivilegedLegal: boolean;
  createdAt: Date | string;
};

export function CommentsSection({ comments, currentUserCanSeePrivileged }: {
  comments: Comment[];
  currentUserCanSeePrivileged: boolean;
}) {
  // Server-side already filtered out privileged comments for non-authorized
  // users, but we double-check here to defend against any leak. UI shows
  // a "privileged" badge only when the viewer is allowed to see them.
  const visible = currentUserCanSeePrivileged
    ? comments
    : comments.filter((c) => !c.isPrivilegedLegal);

  return (
    <SectionShell title="Comments & Discussion" icon={Activity} count={visible.length}
      emptyHint="No comments posted.">
      <ul className="space-y-2">
        {visible.map((c) => (
          <li key={c.id} className={cn(
            "rounded-md border p-3",
            c.isPrivilegedLegal
              ? "border-rose-200 bg-rose-50/50"
              : "border-slate-200 bg-white"
          )}>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">
                {c.author?.name ?? c.authorId.slice(0, 8)}
              </span>
              {c.author?.designation && <span>· {c.author.designation}</span>}
              <span>· {formatDateTime(c.createdAt)}</span>
              {c.isPrivilegedLegal && (
                <span className="ml-auto px-1.5 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800 text-[10px] uppercase font-bold">
                  Privileged · Legal
                </span>
              )}
            </div>
            <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{c.content}</p>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}


// ─── Section 17 — Related Items ──────────────────────────────────────

export function RelatedItemsSection({ incident }: { incident: any }) {
  const items: { href: string; label: string; value: string }[] = [];
  if (incident.fromNearMiss) {
    items.push({ href: `/near-miss/${incident.fromNearMiss.id}`, label: "Source Near Miss", value: incident.fromNearMiss.number });
  }
  for (const id of incident.linkedObservationIds ?? []) {
    items.push({ href: `/observations/${id}`, label: "Linked Observation (missed warning)", value: id.slice(0, 8) + "…" });
  }
  for (const id of incident.linkedNearMissIds ?? []) {
    items.push({ href: `/near-miss/${id}`, label: "Linked Near Miss", value: id.slice(0, 8) + "…" });
  }
  for (const id of incident.linkedIncidentIds ?? []) {
    items.push({ href: `/incidents/${id}`, label: "Related Incident", value: id.slice(0, 8) + "…" });
  }
  if (items.length === 0) return null;

  return (
    <SectionShell title="Related Items" icon={ArrowUpRight} count={items.length}>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i}>
            <Link href={it.href} className="flex items-center gap-2 text-sm hover:bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
              <ArrowUpRight size={12} className="text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-500 uppercase tracking-wider mr-1 flex-shrink-0">{it.label}</span>
              <span className="font-mono text-primary-700 truncate">{it.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

// ─── Sidebar — incident metadata ─────────────────────────────────────

export function IncidentMetadataSidebar({ incident, canSeeScore = false }: { incident: any; canSeeScore?: boolean }) {
  const occurred = incident.occurredAt ?? incident.date;
  const reported = incident.reportedAt;
  const delayMin = incident.reportingDelayMinutes;
  // Feature 5 — numeric 5×5 severity score (visible to Plant Head and above).
  const sd = incident.severityDetail as
    | { score?: number; likelihoodOfRecurrence?: number; consequenceScore?: number; band?: string;
        escalationTriggered?: boolean; escalationLog?: any[] }
    | null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
      <CardContent className="space-y-2.5 text-sm">
        <MetaRow label="Number" value={<span className="font-mono">{incident.number}</span>} />
        <MetaRow label="Occurred" value={formatDateTime(occurred)} />
        {reported && <MetaRow label="Reported" value={formatDateTime(reported)} />}
        {delayMin != null && (
          <MetaRow label="Reporting Delay" value={
            <span className={delayMin > 60 ? "text-amber-700" : "text-slate-800"}>
              {delayMin} min
            </span>
          } />
        )}
        <MetaRow label="Plant" value={incident.plant.name} />
        {incident.department?.name && <MetaRow label="Department" value={incident.department.name} />}
        <MetaRow label="Area" value={incident.area?.name ?? "—"} />
        <MetaRow label="Specific Location" value={incident.specificLocation ?? incident.location} />
        <MetaRow label="Reporter" value={incident.reporter.name} />
        {incident.reporterRole && <MetaRow label="Reporter Role" value={incident.reporterRole.replace(/_/g, " ")} />}
        {(incident.shiftLabel || incident.shiftId) && <MetaRow label="Shift" value={incident.shiftLabel ?? incident.shiftId} />}
        {incident.weatherConditions && <MetaRow label="Weather" value={incident.weatherConditions} />}
        <div className="pt-2 mt-2 border-t border-slate-200">
          <MetaRow label="Type" value={humanize(incident.type)} />
          {incident.severity && <MetaRow label="Severity" value={
            <Badge className={
              incident.severity === "CRITICAL" ? "bg-rose-100 text-rose-800 border-rose-200" :
              incident.severity === "HIGH" ? "bg-orange-100 text-orange-800 border-orange-200" :
              incident.severity === "MEDIUM" ? "bg-amber-100 text-amber-800 border-amber-200" :
              "bg-emerald-100 text-emerald-800 border-emerald-200"
            }>{incident.severity}</Badge>
          } />}
          <MetaRow label="Reportable" value={incident.isReportable ? "Yes" : "No"} />
          {canSeeScore && sd?.score != null && (
            <MetaRow label="Risk Score" value={
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono font-semibold tabular-nums">{sd.score}</span>
                <span className="text-xs text-slate-500">/25</span>
                <span className="text-xs text-slate-400">
                  (L{sd.likelihoodOfRecurrence}×C{sd.consequenceScore})
                </span>
              </span>
            } />
          )}
          {sd?.escalationTriggered && (
            <Alert variant="destructive" className="mt-2 px-2.5 py-2">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert size={13} /> Escalated to Corporate HSE
              </div>
              {canSeeScore && (sd.escalationLog ?? []).slice(-2).map((e: any, idx: number) => (
                <div key={idx} className="mt-1 text-[11px] text-rose-700 leading-snug">
                  {e.reason}
                  {e.triggeredAt ? ` · ${formatDateTime(e.triggeredAt)}` : ""}
                </div>
              ))}
            </Alert>
          )}
        </div>
        {incident.classifiedAt && (
          <div className="pt-2 mt-2 border-t border-slate-200">
            <MetaRow label="Classified" value={formatDateTime(incident.classifiedAt)} />
          </div>
        )}
        {incident.closedAt && (
          <div className="pt-2 mt-2 border-t border-slate-200">
            <MetaRow label="Closed" value={formatDateTime(incident.closedAt)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
