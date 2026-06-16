import Link from "next/link";
import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import {
  CLASSIFICATION_CHIP,
  STATUS_CHIP,
  STATUS_LABEL,
  CATEGORY_LABEL,
  ORIGIN_LABEL,
  RISK_CHIP
} from "../_meta";
import { MocActions } from "./moc-actions";
import { DependentRecords } from "./dependent-records";

export const dynamic = "force-dynamic";

type ApprovalStep = {
  id: string;
  sequence: number;
  role: string;
  isRequired: boolean;
  decision: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
  rationale: string | null;
  conditions: string | null;
};
type DependentRecord = {
  id: string;
  recordType: string;
  recordReference: string;
  impactType: string;
  impactDescription: string | null;
  updateStatus: string;
};
type StateHistory = {
  fromState: string | null;
  toState: string;
  transitionedAt: string | null;
  rationale: string | null;
};
type CRDetail = {
  id: string;
  number: string;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  classification: string;
  status: string;
  isTemporary: boolean;
  temporaryExpiryDate: string | null;
  origin: string;
  businessJustification: string | null;
  expectedBenefits: string | null;
  costEstimate: number | null;
  costCurrency: string;
  affectedDepartments: string[];
  affectedEquipmentIds: string[];
  affectedProcesses: string[];
  affectedRoles: string[];
  proposedImplementationDate: string | null;
  targetCompletionDate: string | null;
  riskLevels: {
    safety: string | null;
    environmental: string | null;
    quality: string | null;
    operational: string | null;
    overallResidual: string | null;
  };
  pssrRequired: boolean;
  pssrOutcome: string | null;
  spawnedFromCapaId: string | null;
  approvalSteps: ApprovalStep[];
  dependentRecords: DependentRecord[];
  stateHistory: StateHistory[];
  impactAssessment: {
    assessorRole: string | null;
    methodology: string | null;
    recommendedClassification: string | null;
    pssrRequired: boolean;
    rollbackPlanRequired: boolean;
  } | null;
};

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm text-slate-900 mt-0.5">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

const DECISION_ICON: Record<string, React.ReactNode> = {
  approved: <CheckCircle2 size={16} className="text-emerald-600" />,
  conditional: <CheckCircle2 size={16} className="text-amber-600" />,
  rejected: <XCircle size={16} className="text-rose-600" />,
  abstained: <Circle size={16} className="text-slate-400" />,
  pending: <Clock size={16} className="text-slate-400" />
};

export default async function MocDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const cr = await backendFetch<CRDetail>(`/api/moc/change-requests/${id}`).catch(() => null);
  if (!cr) notFound();

  const deps = cr.dependentRecords;

  return (
    <div>
      <Link href="/moc" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-2">
        <ArrowLeft size={14} /> Back to register
      </Link>

      <PageHeader
        title={cr.title}
        description={cr.number}
        action={
          <div className="flex items-center gap-2">
            <span className={cn("rounded border px-2 py-1 text-xs font-medium capitalize", CLASSIFICATION_CHIP[cr.classification])}>
              {cr.classification}
            </span>
            <span className={cn("rounded border px-2 py-1 text-xs font-medium", STATUS_CHIP[cr.status])}>
              {STATUS_LABEL[cr.status] ?? cr.status}
            </span>
          </div>
        }
      />

      <div className="mb-4">
        <MocActions crId={cr.id} status={cr.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Section title="Overview">
            <p className="text-sm text-slate-700 whitespace-pre-wrap mb-4">{cr.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Category">
                {CATEGORY_LABEL[cr.category] ?? cr.category}
                {cr.subcategory ? ` · ${cr.subcategory}` : ""}
              </Field>
              <Field label="Origin">{ORIGIN_LABEL[cr.origin] ?? cr.origin}</Field>
              <Field label="Temporary">
                {cr.isTemporary ? `Yes — expires ${fmt(cr.temporaryExpiryDate)}` : "No"}
              </Field>
              <Field label="Proposed impl.">{fmt(cr.proposedImplementationDate)}</Field>
              <Field label="Target completion">{fmt(cr.targetCompletionDate)}</Field>
              <Field label="Cost estimate">
                {cr.costEstimate != null ? `${cr.costCurrency} ${cr.costEstimate.toLocaleString()}` : "—"}
              </Field>
            </div>
            {cr.businessJustification && (
              <div className="mt-4">
                <Field label="Business justification">{cr.businessJustification}</Field>
              </div>
            )}
            {cr.expectedBenefits && (
              <div className="mt-3">
                <Field label="Expected benefits">{cr.expectedBenefits}</Field>
              </div>
            )}
          </Section>

          <Section title="Affected scope">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Departments">{cr.affectedDepartments.length || "—"}</Field>
              <Field label="Equipment">{cr.affectedEquipmentIds.length || "—"}</Field>
              <Field label="Processes">
                {cr.affectedProcesses.length ? cr.affectedProcesses.join(", ") : "—"}
              </Field>
              <Field label="Roles">{cr.affectedRoles.length || "—"}</Field>
            </div>
          </Section>

          <Section title={`Approval chain (${cr.approvalSteps.length})`}>
            {cr.approvalSteps.length === 0 ? (
              <p className="text-sm text-slate-500">No approval chain assigned yet.</p>
            ) : (
              <ol className="space-y-2">
                {cr.approvalSteps.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="mt-0.5">{DECISION_ICON[s.decision] ?? DECISION_ICON.pending}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-900">
                          {s.sequence}. {s.role}
                          {!s.isRequired && <span className="ml-1 text-xs text-slate-400">(informational)</span>}
                        </span>
                        <span className="text-xs capitalize text-slate-500">{s.decision}</span>
                      </div>
                      {s.rationale && <div className="text-xs text-slate-600 mt-1">{s.rationale}</div>}
                      {s.conditions && (
                        <div className="text-xs text-amber-700 mt-1">Conditions: {s.conditions}</div>
                      )}
                      {s.decidedAt && (
                        <div className="text-[11px] text-slate-400 mt-1">Decided {fmt(s.decidedAt)}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Dependent records — keep the registers honest">
            <DependentRecords crId={cr.id} deps={deps} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Risk assessment">
            <div className="space-y-2">
              {[
                ["Safety", cr.riskLevels.safety],
                ["Environmental", cr.riskLevels.environmental],
                ["Quality", cr.riskLevels.quality],
                ["Operational", cr.riskLevels.operational],
                ["Overall residual", cr.riskLevels.overallResidual]
              ].map(([label, level]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{label}</span>
                  {level ? (
                    <span className={cn("rounded border px-2 py-0.5 text-xs font-medium capitalize", RISK_CHIP[level] ?? "")}>
                      {level}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {cr.impactAssessment && (
            <Section title="Impact assessment">
              <div className="space-y-2">
                <Field label="Methodology">{cr.impactAssessment.methodology ?? "—"}</Field>
                <Field label="Assessor role">{cr.impactAssessment.assessorRole ?? "—"}</Field>
                <Field label="Recommended class">
                  {cr.impactAssessment.recommendedClassification ?? "—"}
                </Field>
                <Field label="PSSR required">{cr.impactAssessment.pssrRequired ? "Yes" : "No"}</Field>
                <Field label="Rollback plan">{cr.impactAssessment.rollbackPlanRequired ? "Required" : "Not required"}</Field>
              </div>
            </Section>
          )}

          {cr.spawnedFromCapaId && (
            <Section title="Cross-references">
              <Field label="Spawned from CAPA">{cr.spawnedFromCapaId}</Field>
            </Section>
          )}

          <Section title="State history">
            <ol className="space-y-2">
              {cr.stateHistory.map((h, i) => (
                <li key={i} className="text-xs">
                  <span className="text-slate-400">{fmt(h.transitionedAt)}</span>{" "}
                  <span className="text-slate-700">
                    {h.fromState ? `${STATUS_LABEL[h.fromState] ?? h.fromState} → ` : ""}
                    <span className="font-medium">{STATUS_LABEL[h.toState] ?? h.toState}</span>
                  </span>
                  {h.rationale && <div className="text-slate-500">{h.rationale}</div>}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
