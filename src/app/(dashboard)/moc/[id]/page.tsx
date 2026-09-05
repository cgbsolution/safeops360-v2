import Link from "next/link";
import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Circle, Clock, XCircle, AlertTriangle, Paperclip } from "lucide-react";
import {
  CLASSIFICATION_CHIP,
  STATUS_CHIP,
  STATUS_LABEL,
  CATEGORY_LABEL,
  ORIGIN_LABEL,
  RISK_CHIP,
  HAZARD_LABEL,
  IMPACT_DEPT_LABEL,
  URGENCY_LABEL
} from "../_meta";
import { markRecordTasksReadForViewer } from "@/lib/workflow/read-state";
import { MocActions } from "./moc-actions";
import { DependentRecords } from "./dependent-records";
import { MocAttachments } from "./moc-attachments";
import { PssrPanel, EffectivenessPanel } from "./moc-lifecycle";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type RiskMatrix = { likelihood: number; severity: number; score: number; band: string };
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
  urgency: string;
  emergencyRetroApprovalDueAt: string | null;
  emergencyPendingRetro: boolean;
  linkedMocIds: string[];
  psmApplicable: boolean;
  psmDetails: { coveredProcess?: string; affectedSafeguards?: string } | null;
  riskMatrixPre: RiskMatrix | null;
  riskMatrixResidual: RiskMatrix | null;
  hazardCategories: string[];
  mitigations: string | null;
  departmentImpact: {
    departments?: Record<string, { affected: boolean; reviewerUserId?: string }>;
    communicationPlan?: string;
  } | null;
  trainingRequired: boolean;
  trainingCertificateId: string | null;
  pssrChecklist: { items: { label: string; verdict: string; note?: string }[]; outcome: string; completedAt: string | null; completedBy?: string | null } | null;
  effectivenessReview: { effective: boolean; newRisks: boolean; notes: string | null; cadenceDays: number | null; reviewedAt: string | null } | null;
  attachments: { id: string; category: string; fileName: string; fileSize: number; mimeType: string; caption: string | null; uploadedAt: string | null; uploadedById: string }[];
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
    <Card className="rounded-xl border bg-white p-5 shadow-none">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">{title}</h2>
      {children}
    </Card>
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

  // Opening the record clears its Inbox unread state, however the viewer got
  // here. No-op unless they're the action owner.
  await markRecordTasksReadForViewer({ module: "MOC", recordId: id });

  const deps = cr.dependentRecords;
  const CLOSED = ["closed_successful", "closed_aborted", "closed_rejected", "withdrawn", "expired", "rolled_back"];
  const closed = CLOSED.includes(cr.status);
  const deptImpactRows = Object.entries(cr.departmentImpact?.departments ?? {})
    .filter(([, v]) => v?.affected)
    .map(([k]) => k);
  const showEffectiveness =
    ["implementation_complete_pending_verification", "under_post_implementation_review", "closed_successful"].includes(
      cr.status
    ) || !!cr.effectivenessReview;

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
            {cr.emergencyPendingRetro && (
              <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                <AlertTriangle size={12} /> Emergency — pending retroactive approval
              </span>
            )}
            {cr.urgency === "emergency" && !cr.emergencyPendingRetro && (
              <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                {URGENCY_LABEL.emergency}
              </span>
            )}
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
        <MocActions crId={cr.id} status={cr.status} urgency={cr.urgency} />
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

          <Section title="Risk & hazard assessment">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Pre-change risk</div>
                {cr.riskMatrixPre ? (
                  <span className={cn("inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize", RISK_CHIP[cr.riskMatrixPre.band] ?? "")}>
                    {cr.riskMatrixPre.band} · L{cr.riskMatrixPre.likelihood}×S{cr.riskMatrixPre.severity} = {cr.riskMatrixPre.score}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Residual risk</div>
                {cr.riskMatrixResidual ? (
                  <span className={cn("inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize", RISK_CHIP[cr.riskMatrixResidual.band] ?? "")}>
                    {cr.riskMatrixResidual.band} · L{cr.riskMatrixResidual.likelihood}×S{cr.riskMatrixResidual.severity} = {cr.riskMatrixResidual.score}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </div>
            </div>
            {cr.hazardCategories.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Hazard categories</div>
                <div className="flex flex-wrap gap-1.5">
                  {cr.hazardCategories.map((h) => (
                    <span key={h} className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-800">
                      {HAZARD_LABEL[h] ?? h}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {cr.psmApplicable && (
              <Alert variant="warning" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div className="font-semibold">Process Safety Management applies</div>
                {cr.psmDetails?.coveredProcess && <div>Covered process: {cr.psmDetails.coveredProcess}</div>}
                {cr.psmDetails?.affectedSafeguards && <div>Affected safeguards: {cr.psmDetails.affectedSafeguards}</div>}
              </Alert>
            )}
            {cr.mitigations && <Field label="Mitigations / controls">{cr.mitigations}</Field>}
          </Section>

          <Section title="Impact & stakeholders">
            {deptImpactRows.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {deptImpactRows.map((d) => (
                  <span key={d} className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-800">
                    {IMPACT_DEPT_LABEL[d] ?? d}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-3">No departments flagged as affected.</p>
            )}
            {cr.departmentImpact?.communicationPlan && (
              <Field label="Communication / training plan">{cr.departmentImpact.communicationPlan}</Field>
            )}
            <div className="mt-3 grid grid-cols-2 gap-4">
              <Field label="Training required">
                {cr.trainingRequired
                  ? cr.trainingCertificateId
                    ? `Yes — certificate linked`
                    : "Yes — not yet linked"
                  : "No"}
              </Field>
              <Field label="Linked MOCs">{cr.linkedMocIds.length ? cr.linkedMocIds.join(", ") : "—"}</Field>
            </div>
          </Section>

          <Section title="Supporting documents">
            <MocAttachments crId={cr.id} canEdit={!closed} />
          </Section>

          {(cr.pssrRequired || cr.pssrChecklist) && (
            <Section title="Pre-startup safety review (PSSR)">
              <PssrPanel
                crId={cr.id}
                pssrRequired={cr.pssrRequired}
                pssrChecklist={cr.pssrChecklist}
                hazardCategories={cr.hazardCategories}
                readOnly={closed}
              />
            </Section>
          )}

          {showEffectiveness && (
            <Section title="Post-implementation effectiveness review">
              <EffectivenessPanel crId={cr.id} effectivenessReview={cr.effectivenessReview} readOnly={false} />
            </Section>
          )}

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
