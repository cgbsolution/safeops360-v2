import { notFound } from "next/navigation";
import Link from "next/link";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import {
  RcaSubmitForm,
  AddActionForm,
  ActionStatusControls,
  VerifySubmitForm,
  CloseCapaForm,
  RecurrenceCheckForm
} from "@/components/capa/lifecycle-actions";
import { CapaAssistantCard } from "@/components/capa/capa-assistant-card";
import { RcaEditor } from "@/components/incidents/rca-editor";
import { capaRcaMethodLabel, normaliseRcaMethod } from "@/lib/rca/types";

// Past these, the analysis is part of the record rather than work in hand.
const TERMINAL_STATES = new Set(["VERIFIED", "CLOSED", "CLOSED_RECURRED", "CANCELLED", "REJECTED"]);
import { PanelBoundary } from "@/components/ui/panel-boundary";
import { UserRefLabel, type UserDirectory } from "@/lib/users/user-ref";
import { markRecordTasksReadForViewer } from "@/lib/workflow/read-state";

export const dynamic = "force-dynamic";

const STATE_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  SUBMITTED: "bg-blue-100 text-blue-800 border-blue-200",
  UNDER_RCA: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ACTIONS_PLANNED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIONS_IN_PROGRESS: "bg-orange-100 text-orange-800 border-orange-200",
  PENDING_VERIFICATION: "bg-cyan-100 text-cyan-800 border-cyan-200",
  VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLOSED: "bg-emerald-200 text-emerald-900 border-emerald-300 font-semibold",
  CLOSED_RECURRED: "bg-rose-200 text-rose-900 border-rose-300",
  REJECTED: "bg-slate-200 text-slate-700 border-slate-300",
  CANCELLED: "bg-slate-200 text-slate-700 border-slate-300"
};

const SEVERITY_CHIP: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MODERATE: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICAL: "bg-rose-200 text-rose-900 border-rose-300 font-semibold"
};

type CapaOut = {
  id: string;
  capaNumber: string;
  aliasNumber: string | null;
  legacySource: string | null;
  title: string;
  sourceTypeCode: string;
  sourceReferenceId: string | null;
  sourceReferenceUrl: string | null;
  sourceReferenceSummary: string | null;
  sourceMetadata: Record<string, unknown> | null;
  problemDescription: string;
  problemImpact: string | null;
  detectionMethod: string | null;
  detectedAt: string;
  primaryCategory: string;
  actionType: string;
  severity: string;
  priority: string;
  isRecurring: boolean;
  rcaMethodology: string | null;
  rcaMethodologyRationale: string | null;
  rcaCompleted: boolean;
  rcaSummary: string | null;
  rcaRecordId: string | null;
  // The methodology-specific analysis, in the shape src/lib/rca/types.ts
  // defines for that method. Null for a narrative-only method and for a CAPA
  // whose analysis is governed by an RCA record.
  rcaAnalysisPayload: Record<string, unknown> | null;
  // Every Why except the last. The last one IS the root cause and is stored
  // as a CapaRootCause row, so rendering both together reconstructs the
  // ladder the auditee actually filled in.
  contributingFactors: string[] | null;
  rcaCompletedAt: string | null;
  rcaCompletedByUserId: string | null;
  verificationSuccessCriteria: string | null;
  verificationDueDate: string | null;
  verificationCompletedAt: string | null;
  verificationCompletedByUserId: string | null;
  verificationResult: string | null;
  verificationEvidence: string | null;
  recurrenceCheckDueDate: string | null;
  recurrenceDetected: boolean | null;
  state: string;
  rcaDueDate: string | null;
  closureTargetDate: string | null;
  raisedByUserId: string;
  primaryOwnerUserId: string;
  estimatedProblemCost: number | null;
  estimatedActionsCost: number | null;
  actualCost: number | null;
  createdAt: string;
  versionNumber: number;
  closedAt: string | null;
  closedByUserId: string | null;
  actions: {
    id: string;
    actionType: string;
    description: string;
    rationale: string | null;
    ownerUserId: string;
    dueDate: string;
    completedAt: string | null;
    status: string;
    evidenceOfCompletion: string | null;
    costEstimate: number | null;
  }[];
  rootCauses: { id: string; description: string; category: string; confidence: string }[];
  contributors: { id: string; userId: string; role: string | null; contributionType: string }[];
  attachments: { id: string; category: string; fileName: string; fileUrl: string; description: string | null }[];
  comments: { id: string; body: string; authorUserId: string; commentType: string; createdAt: string }[];
  userDirectory: UserDirectory;
};

export default async function CapaDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ tab?: string }>;
  }
) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const tab = sp.tab ?? "overview";

  let capa: CapaOut;
  try {
    capa = await backendFetch<CapaOut>(`/api/capa/${id}`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    // Row-level scope denial (e.g. a CAPA on a plant outside the viewer's
    // OWN_PLANT scope). Render a calm "no access" panel rather than letting the
    // 403 bubble up into the generic full-page crash. The list is already
    // scope-filtered, so this only fires on direct URL / stale link navigation.
    if (e instanceof BackendError && e.status === 403) return <CapaAccessDenied />;
    throw e;
  }

  // Opening the record clears its Inbox unread state, however the viewer got
  // here. No-op unless they're the action owner.
  await markRecordTasksReadForViewer({ module: "CAPA", recordId: id });

  // Fetch the data the lifecycle forms need (verification methods + users).
  // Failures are tolerated — forms degrade gracefully without owner picker.
  const [verificationMethods, wizardOpts] = await Promise.all([
    backendFetch<{ id: string; code: string; name: string }[]>("/api/capa/verification-methods").catch(
      () => []
    ),
    backendFetch<{ users: { id: string; name: string; email: string; plantId: string | null }[] }>(
      "/api/hira/wizard/study-options"
    ).catch(() => ({ users: [] }))
  ]);
  const users = wizardOpts.users
    .filter((u) => !u.plantId || u.plantId === (capa as any).plantId)
    .map((u) => ({ id: u.id, name: u.name }));

  const TABS = [
    { code: "overview", label: "Overview" },
    { code: "source", label: "Source" },
    { code: "rca", label: "Root Cause Analysis" },
    { code: "actions", label: `Actions (${capa.actions.length})` },
    { code: "execution", label: "Execution" },
    { code: "verification", label: "Verification" },
    { code: "closure", label: "Closure" },
    { code: "linkages", label: "Linkages" },
    { code: "cost", label: "Cost" },
    { code: "audit", label: "Audit Trail" }
  ];

  return (
    <div>
      <PageHeader
        title={`${capa.capaNumber} — ${capa.title}`}
        description={
          capa.aliasNumber && capa.aliasNumber !== capa.capaNumber
            ? `Legacy ref: ${capa.aliasNumber} · v${capa.versionNumber}`
            : `v${capa.versionNumber}`
        }
        breadcrumbs={[
          { label: "CAPA", href: "/capa" },
          { label: capa.capaNumber }
        ]}
        action={
          <div className="flex gap-2 items-center">
            <Link
              href={`/capa/${id}/print`}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded border border-slate-300 bg-white hover:border-primary-500"
            >
              Print / PDF
            </Link>
            <span className={`inline-block px-2.5 py-0.5 text-xs rounded border ${SEVERITY_CHIP[capa.severity] ?? ""}`}>
              {capa.severity}
            </span>
            <span className={`inline-block px-2.5 py-0.5 text-xs rounded border ${STATE_CHIP[capa.state] ?? ""}`}>
              {capa.state.replace(/_/g, " ")}
            </span>
          </div>
        }
      />

      <nav className="flex border-b mb-6 gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.code}
            href={`/capa/${id}?tab=${t.code}`}
            className={`px-4 py-2 text-sm border-b-2 transition whitespace-nowrap ${
              tab === t.code
                ? "border-primary-600 text-primary-700 font-medium"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab capa={capa} />}
      {tab === "source" && <SourceTab capa={capa} />}
      {tab === "rca" && (
        <div className="space-y-4">
          <RcaTab capa={capa} />
          {/* The assistant DRAFTS root-cause candidates. Once the analysis is
              complete it has nothing to offer, and on a closed record it is an
              invitation to overwrite a signed-off conclusion. */}
          {!capa.rcaCompleted && !TERMINAL_STATES.has(capa.state) && (
            <PanelBoundary label="CAPA Assistant">
              <CapaAssistantCard capaId={capa.id} />
            </PanelBoundary>
          )}
          {/* Free-text RCA entry. Hidden for a CAPA whose analysis is owned by a
              governed RootCauseAnalysis — that endpoint returns 409 for these,
              so the form could only ever fail. Those are edited on the NC
              report, which enforces the form's own rules. */}
          {!capa.rcaRecordId && !TERMINAL_STATES.has(capa.state) && (
            <RcaSubmitForm capaId={capa.id} currentState={capa.state} />
          )}
          {capa.rcaRecordId && (
            <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
              This analysis is governed by {capa.rcaMethodology === "FIVE_WHY"
                ? "PIL/MR/F04-R1" : "a root cause analysis record"} and is edited
              on the NC report, not here — which is what keeps the minimum Why
              depth and the auditor/auditee split enforceable.
              {capa.sourceReferenceUrl && (
                <>
                  {" "}
                  <Link href={capa.sourceReferenceUrl} className="font-medium underline">
                    Open the NC report
                  </Link>
                  .
                </>
              )}
            </p>
          )}
        </div>
      )}
      {tab === "actions" && <ActionsTab capa={capa} users={users} />}
      {tab === "execution" && <ExecutionTab capa={capa} capaId={capa.id} />}
      {tab === "verification" && (
        <>
          <VerificationTab capa={capa} />
          <VerifySubmitForm
            capaId={capa.id}
            currentState={capa.state}
            verificationMethods={verificationMethods}
          />
        </>
      )}
      {tab === "closure" && (
        <>
          <ClosureTab capa={capa} />
          <div className="mt-4 flex flex-wrap gap-3">
            <CloseCapaForm capaId={capa.id} currentState={capa.state} />
            <RecurrenceCheckForm
              capaId={capa.id}
              currentState={capa.state}
              dueDate={capa.recurrenceCheckDueDate}
            />
          </div>
        </>
      )}
      {tab === "linkages" && <LinkagesTab capa={capa} />}
      {tab === "cost" && <CostTab capa={capa} />}
      {tab === "audit" && <AuditTrailTab capa={capa} />}
    </div>
  );
}

function ExecutionTab({ capa, capaId }: { capa: CapaOut; capaId: string }) {
  // Kanban-style: group actions by status
  const groups = [
    { status: "PROPOSED", label: "Proposed", color: "bg-slate-100" },
    { status: "APPROVED", label: "Approved", color: "bg-blue-100" },
    { status: "IN_PROGRESS", label: "In Progress", color: "bg-amber-100" },
    { status: "COMPLETED", label: "Completed", color: "bg-emerald-100" }
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {groups.map((g) => {
        const items = capa.actions.filter((a) => a.status === g.status);
        return (
          <div key={g.status} className={`rounded-xl border p-3 ${g.color}`}>
            <div className="text-xs uppercase tracking-wider text-slate-700 font-semibold mb-2">
              {g.label} ({items.length})
            </div>
            {items.length === 0 ? (
              <div className="text-xs text-slate-500 italic py-2">None</div>
            ) : (
              <ul className="space-y-2">
                {items.map((a) => (
                  <li key={a.id} className="rounded-md bg-white p-2 shadow-sm">
                    <div className="text-xs font-medium text-slate-800 line-clamp-2">
                      {a.description}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {a.actionType.replace(/_/g, " ")} · due {new Date(a.dueDate).toLocaleDateString()}
                    </div>
                    {a.evidenceOfCompletion && (
                      <div className="text-[10px] text-slate-600 mt-1 pl-2 border-l-2 border-emerald-300">
                        {a.evidenceOfCompletion.slice(0, 80)}…
                      </div>
                    )}
                    <ActionStatusControls capaId={capaId} actionId={a.id} currentStatus={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClosureTab({ capa }: { capa: CapaOut }) {
  return (
    <div className="space-y-4">
      <Card title="Closure Status">
        <DefList
          items={[
            ["Current state", capa.state.replace(/_/g, " ")],
            ["Closed at", capa.closedAt ? new Date(capa.closedAt).toLocaleString() : "Not closed yet"]
          ]}
        />
        {capa.state === "VERIFIED" && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            CAPA is verified and ready for closure. The closure authority must sign off.
          </div>
        )}
      </Card>
      <Card title="Recurrence Check">
        <DefList
          items={[
            ["Due", capa.recurrenceCheckDueDate ? new Date(capa.recurrenceCheckDueDate).toLocaleDateString() : "—"],
            ["Completed", capa.recurrenceCheckDueDate && capa.recurrenceDetected !== null ? "Yes" : "Not yet"],
            ["Recurred?", capa.recurrenceDetected === null ? "—" : capa.recurrenceDetected ? "YES — see linked recurrence CAPA" : "No"]
          ]}
        />
        {capa.state === "CLOSED" && capa.recurrenceCheckDueDate && new Date(capa.recurrenceCheckDueDate) < new Date() && capa.recurrenceDetected === null && (
          <div className="mt-3 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            Recurrence check is overdue. Run the check to confirm whether the issue has recurred.
          </div>
        )}
      </Card>
    </div>
  );
}

function LinkagesTab({ capa }: { capa: CapaOut }) {
  return (
    <div className="space-y-4">
      <Card title="Related Records">
        <div className="text-sm text-slate-700">
          {capa.legacySource ? (
            <div className="mb-2">
              <span className="text-slate-500 text-xs">Legacy backfill from</span>{" "}
              <code className="px-1 rounded bg-slate-100">{capa.legacySource}</code>
            </div>
          ) : null}
          {capa.sourceReferenceId ? (
            <div className="text-xs">
              <span className="text-slate-500">Source record</span>{" "}
              {capa.sourceReferenceUrl ? (
                <a href={capa.sourceReferenceUrl} className="font-medium text-primary-700 hover:underline">
                  {capa.sourceReferenceSummary ?? capa.sourceReferenceId} →
                </a>
              ) : (
                <span className="font-medium text-slate-800">{capa.sourceReferenceSummary ?? capa.sourceReferenceId}</span>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">No source record reference.</div>
          )}
        </div>
      </Card>
      <Card title="Contributors">
        {capa.contributors.length === 0 ? (
          <div className="text-xs text-slate-500">No contributors added.</div>
        ) : (
          <ul className="text-sm space-y-1">
            {capa.contributors.map((c) => (
              <li key={c.id} className="flex justify-between">
                <UserRefLabel dir={capa.userDirectory} id={c.userId} />
                <span className="text-xs text-slate-500">{c.contributionType.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Attachments">
        {capa.attachments.length === 0 ? (
          <div className="text-xs text-slate-500">No attachments.</div>
        ) : (
          <ul className="text-sm space-y-1.5">
            {capa.attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <a href={a.fileUrl} className="text-primary-700 hover:underline text-xs" target="_blank" rel="noreferrer">
                  {a.fileName}
                </a>
                <span className="text-[10px] text-slate-500">{a.category.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CostTab({ capa }: { capa: CapaOut }) {
  const actionCostSum = capa.actions.reduce((sum, a) => sum + (a.costEstimate ?? 0), 0);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Cost Summary">
        <DefList
          items={[
            ["Estimated problem cost", capa.estimatedProblemCost?.toLocaleString() ?? "—"],
            ["Estimated action cost (CAPA level)", capa.estimatedActionsCost?.toLocaleString() ?? "—"],
            ["Estimated action cost (sum of actions)", actionCostSum.toLocaleString()],
            ["Actual cost (recorded at closure)", capa.actualCost?.toLocaleString() ?? "Not yet recorded"]
          ]}
        />
      </Card>
      <Card title="Per-Action Cost Breakdown">
        {capa.actions.length === 0 ? (
          <div className="text-xs text-slate-500">No actions.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b">
              <tr className="text-left text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-1">Action</th>
                <th className="py-1 text-right">Est. cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {capa.actions.map((a) => (
                <tr key={a.id}>
                  <td className="py-1.5 pr-2 line-clamp-1">{a.description}</td>
                  <td className="py-1.5 text-right font-mono">{a.costEstimate?.toLocaleString() ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function AuditTrailTab({ capa }: { capa: CapaOut }) {
  // v1: synthesise from comments + key state-changing timestamps. A future
  // version will hit a dedicated /api/capa/[id]/audit endpoint.
  const events: { at: string; label: string; detail?: string; who?: string | null }[] = [];
  events.push({ at: capa.createdAt, label: "CAPA created", who: capa.raisedByUserId });
  if (capa.rcaCompletedAt) {
    events.push({
      at: capa.rcaCompletedAt,
      label: "RCA completed",
      who: capa.rcaCompletedByUserId,
      detail: capa.rcaMethodology ?? undefined
    });
  }
  for (const a of capa.actions) {
    if (a.completedAt) {
      events.push({
        at: a.completedAt,
        label: `Action completed: ${a.actionType.replace(/_/g, " ")}`,
        who: a.ownerUserId,
        detail: a.description.slice(0, 80)
      });
    }
  }
  if (capa.verificationCompletedAt) {
    events.push({
      at: capa.verificationCompletedAt,
      label: "Verification completed",
      who: capa.verificationCompletedByUserId,
      detail: capa.verificationResult ?? undefined
    });
  }
  if (capa.closedAt) {
    events.push({ at: capa.closedAt, label: "CAPA closed", who: capa.closedByUserId });
  }
  for (const c of capa.comments) {
    events.push({ at: c.createdAt, label: `Comment (${c.commentType})`, detail: c.body.slice(0, 100), who: c.authorUserId });
  }
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <Card title={`Audit Trail (${events.length} events)`}>
      {events.length === 0 ? (
        <div className="text-xs text-slate-500">No events recorded.</div>
      ) : (
        <ul className="divide-y">
          {events.map((e, i) => (
            <li key={i} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">{e.label}</div>
                <div className="text-[10px] text-slate-500 whitespace-nowrap">
                  {new Date(e.at).toLocaleString()}
                </div>
              </div>
              {e.detail && <div className="text-xs text-slate-600 mt-0.5">{e.detail}</div>}
              {e.who && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  by <UserRefLabel dir={capa.userDirectory} id={e.who} className="text-[10px]" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OverviewTab({ capa }: { capa: CapaOut }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Problem Statement" className="lg:col-span-2">
        <p className="text-sm text-slate-800 whitespace-pre-wrap">{capa.problemDescription}</p>
        {capa.problemImpact && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs uppercase text-slate-500 mb-1">Impact</div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{capa.problemImpact}</p>
          </div>
        )}
      </Card>
      <Card title="Classification">
        <DefList
          items={[
            ["Source type", capa.sourceTypeCode.replace(/_/g, " ")],
            ["Primary category", capa.primaryCategory.replace(/_/g, " ")],
            ["Action type", capa.actionType.replace(/_/g, " ")],
            ["Priority", capa.priority],
            ["Recurring?", capa.isRecurring ? "Yes" : "No"]
          ]}
        />
      </Card>
      <Card title="Key Dates">
        <DefList
          items={[
            ["Detected", new Date(capa.detectedAt).toLocaleDateString()],
            ["Created", new Date(capa.createdAt).toLocaleDateString()],
            ["RCA due", capa.rcaDueDate ? new Date(capa.rcaDueDate).toLocaleDateString() : "—"],
            ["Closure target", capa.closureTargetDate ? new Date(capa.closureTargetDate).toLocaleDateString() : "—"],
            ["Verification due", capa.verificationDueDate ? new Date(capa.verificationDueDate).toLocaleDateString() : "—"],
            ["Recurrence check due", capa.recurrenceCheckDueDate ? new Date(capa.recurrenceCheckDueDate).toLocaleDateString() : "—"]
          ]}
        />
      </Card>
      <Card title="Ownership">
        <DefList
          items={[
            ["Raised by", <UserRefLabel key="raised" dir={capa.userDirectory} id={capa.raisedByUserId} />],
            ["Primary owner", <UserRefLabel key="owner" dir={capa.userDirectory} id={capa.primaryOwnerUserId} />],
            ["Contributors", String(capa.contributors.length)]
          ]}
        />
      </Card>
      {(capa.estimatedProblemCost || capa.estimatedActionsCost || capa.actualCost) && (
        <Card title="Cost">
          <DefList
            items={[
              ["Estimated problem cost", capa.estimatedProblemCost?.toLocaleString() ?? "—"],
              ["Estimated action cost", capa.estimatedActionsCost?.toLocaleString() ?? "—"],
              ["Actual cost", capa.actualCost?.toLocaleString() ?? "—"]
            ]}
          />
        </Card>
      )}
    </div>
  );
}

function humanizeMetaKey(k: string): string {
  return k
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\bInr\b/gi, "(INR)")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
function formatMetaValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleString();
  }
  return String(v);
}

function SourceTab({ capa }: { capa: CapaOut }) {
  const meta = (capa.sourceMetadata ?? {}) as Record<string, unknown>;
  // Prefer the human code (e.g. ERM-2026-0027) over the raw cuid.
  const refCode =
    (typeof meta.riskCode === "string" && meta.riskCode) ||
    (typeof meta.sourceCode === "string" && meta.sourceCode) ||
    capa.sourceReferenceSummary?.split(" — ")[0]?.trim() ||
    null;
  const reference =
    refCode ? (
      capa.sourceReferenceUrl ? (
        <a href={capa.sourceReferenceUrl} className="font-medium text-primary-700 hover:underline">
          {refCode} →
        </a>
      ) : (
        <span className="font-medium">{refCode}</span>
      )
    ) : (
      capa.sourceReferenceId ?? "—"
    );

  type ProgressEntry = { at?: string; pct?: number; note?: string; by?: string };
  const progressLog: ProgressEntry[] = Array.isArray(meta.progressLog) ? (meta.progressLog as ProgressEntry[]) : [];
  const metaEntries = Object.entries(meta).filter(
    ([k, v]) => k !== "riskCode" && k !== "progressLog" && v !== null && v !== undefined && v !== "" && typeof v !== "object"
  );

  return (
    <div className="space-y-4">
      <Card title="Source Context">
        <DefList
          items={[
            ["Source type", capa.sourceTypeCode.replace(/_/g, " ")],
            ["Reference", reference],
            ["Reference summary", capa.sourceReferenceSummary ?? "—"]
          ]}
        />
      </Card>
      {(metaEntries.length > 0 || progressLog.length > 0) && (
        <Card title="Source Metadata">
          {metaEntries.length > 0 && (
            <DefList items={metaEntries.map(([k, v]) => [humanizeMetaKey(k), formatMetaValue(v)])} />
          )}
          {progressLog.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Progress log</div>
              <ul className="space-y-1">
                {progressLog.map((p, i) => (
                  <li key={i} className="flex justify-between gap-3 text-xs text-slate-700">
                    <span>
                      {typeof p?.pct === "number" ? <span className="font-medium tabular-nums">{p.pct}% </span> : null}
                      {p?.note ?? ""}
                    </span>
                    <span className="shrink-0 text-slate-400">{p?.at ? new Date(p.at).toLocaleDateString() : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
      {capa.legacySource && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          This CAPA was backfilled from the legacy <code className="px-1 rounded bg-amber-100">{capa.legacySource}</code> table.
          The original record is preserved at the parent module&apos;s detail page.
        </div>
      )}
    </div>
  );
}

function RcaTab({ capa }: { capa: CapaOut }) {
  const analysisMethod = normaliseRcaMethod(capa.rcaMethodology);
  return (
    <div className="space-y-4">
      <Card title="Methodology">
        {/* Three chips rather than a definition list. The list rendered each
            label hard left and its value hard right across the full card, so
            "Methodology ......... FIVE_WHY" read as two unrelated columns. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-800">
            {/* Legacy rows hold 5_WHY / FAULT_TREE / TAP_ROOT, which rendered
                as "5-WHY" and "FAULT-TREE" — codes, not the name of the
                technique the analyst actually used. */}
            {capaRcaMethodLabel(capa.rcaMethodology)}
          </span>
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
              (capa.rcaCompleted
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800")
            }
          >
            {capa.rcaCompleted ? "Analysis complete" : "Analysis outstanding"}
          </span>
          {capa.rcaCompletedAt && (
            <span className="text-xs text-slate-500">
              {new Date(capa.rcaCompletedAt).toLocaleString()}
            </span>
          )}
        </div>
        {capa.rcaMethodologyRationale && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs uppercase text-slate-500 mb-1">Rationale</div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{capa.rcaMethodologyRationale}</p>
          </div>
        )}
      </Card>
      {capa.rcaSummary && (
        <Card title="RCA Summary">
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{capa.rcaSummary}</p>
        </Card>
      )}
      {/* The analysis as it was drawn. Read-only: this tab is the record, and
          the form below is where it gets written. RcaEditor renders every
          method's own template, so a fishbone reads as a fishbone here rather
          than as a flattened list of strings. */}
      {analysisMethod && capa.rcaAnalysisPayload && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-slate-700 font-semibold">
            {capaRcaMethodLabel(capa.rcaMethodology)} — analysis as recorded
          </div>
          <RcaEditor method={analysisMethod} value={capa.rcaAnalysisPayload} readOnly />
        </div>
      )}
      {(capa.contributingFactors?.length ?? 0) > 0 && (
        <Card title={`Why-Why Analysis (${(capa.contributingFactors?.length ?? 0) + capa.rootCauses.length} levels)`}>
          {/* The chain, in order, ending on the root cause. Showing only the
              conclusion — as this page used to — presents an answer with no
              reasoning behind it, on a record whose entire revision was
              "preventive action is replaced with Root Cause Analysis". */}
          <ol className="space-y-2">
            {(capa.contributingFactors ?? []).map((f, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
                  {i + 1}
                </span>
                <span className="text-slate-800">{f}</span>
              </li>
            ))}
            {capa.rootCauses.map((rc, i) => (
              <li key={rc.id} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-medium text-white">
                  {(capa.contributingFactors?.length ?? 0) + i + 1}
                </span>
                <span className="font-medium text-slate-900">
                  {rc.description}
                  <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                    root cause
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t pt-2 text-[11px] text-slate-500">
            Each level answers Why of the one above it. The final level is the
            system failure the NC report asks for.
          </p>
        </Card>
      )}
      <Card title={`Identified Root Causes (${capa.rootCauses.length})`}>
        {capa.rootCauses.length === 0 ? (
          <div className="text-sm text-slate-500">No root causes recorded yet.</div>
        ) : (
          <ul className="divide-y">
            {capa.rootCauses.map((rc) => (
              <li key={rc.id} className="py-2">
                <div className="flex items-start justify-between">
                  <div className="text-sm font-medium">{rc.description}</div>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 ml-2 flex-shrink-0">
                    {rc.category}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Confidence: {rc.confidence}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ActionsTab({ capa, users }: { capa: CapaOut; users: { id: string; name: string }[] }) {
  const containment = capa.actions.filter((a) => a.actionType === "IMMEDIATE_CONTAINMENT");
  const corrective = capa.actions.filter((a) => a.actionType === "CORRECTIVE");
  const preventive = capa.actions.filter((a) => a.actionType === "PREVENTIVE");

  // A CAPA bound to a governed RootCauseAnalysis is a PIL/MR/F04-R1 non-
  // conformity. Its actions were written on that form, in that form's words,
  // by an auditee working under its custody rules — so the tab uses the form's
  // vocabulary and does not invite edits that would bypass them.
  const isNcReport = !!capa.rcaRecordId;
  const locked = isNcReport || TERMINAL_STATES.has(capa.state);
  return (
    <div className="space-y-4">
      <ActionGroup
        title={isNcReport ? "Correction — what is done to solve this problem" : "Immediate Containment"}
        readOnly={locked}
        actions={containment}
        capaId={capa.id}
        defaultActionType="IMMEDIATE_CONTAINMENT"
        users={users}
        dir={capa.userDirectory}
      />
      <ActionGroup
        title="Corrective Actions"
        readOnly={locked}
        hidden={isNcReport && corrective.length === 0}
        actions={corrective}
        capaId={capa.id}
        defaultActionType="CORRECTIVE"
        users={users}
        dir={capa.userDirectory}
      />
      <ActionGroup
        title={isNcReport ? "Preventive Action — what is done to prevent reoccurrence" : "Preventive Actions"}
        readOnly={locked}
        actions={preventive}
        capaId={capa.id}
        defaultActionType="PREVENTIVE"
        users={users}
        dir={capa.userDirectory}
      />
    </div>
  );
}

function ActionGroup({
  title,
  actions,
  capaId,
  defaultActionType,
  users,
  dir,
  readOnly,
  hidden
}: {
  title: string;
  actions: CapaOut["actions"];
  capaId: string;
  defaultActionType: string;
  users: { id: string; name: string }[];
  dir: UserDirectory;
  readOnly?: boolean;
  hidden?: boolean;
}) {
  // The form has no corrective-action box; an empty section carrying an
  // "+ Add action" button is an invitation to record something the issued
  // report cannot show.
  if (hidden) return null;
  return (
    <Card title={`${title} (${actions.length})`}>
      {actions.length === 0 ? (
        <div className="text-sm text-slate-500 mb-3">None.</div>
      ) : (
        <ul className="divide-y mb-3">
          {actions.map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex items-start justify-between">
                <div className="text-sm font-medium flex-1">{a.description}</div>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded border ml-2 flex-shrink-0 ${
                    a.status === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : a.status === "IN_PROGRESS"
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  }`}
                >
                  {a.status.replace(/_/g, " ")}
                </span>
              </div>
              {a.rationale && <div className="text-xs text-slate-600 mt-1">{a.rationale}</div>}
              <div className="text-xs text-slate-500 mt-1">
                Owner: <UserRefLabel dir={dir} id={a.ownerUserId} className="text-xs" /> · Due:{" "}
                {new Date(a.dueDate).toLocaleDateString()}
                {a.completedAt && ` · Completed: ${new Date(a.completedAt).toLocaleDateString()}`}
                {a.costEstimate && ` · Cost est: ${a.costEstimate.toLocaleString()}`}
              </div>
              {a.evidenceOfCompletion && (
                <div className="text-xs text-slate-700 mt-1 pl-2 border-l-2 border-slate-200">
                  {a.evidenceOfCompletion}
                </div>
              )}
              {!readOnly && (
                <ActionStatusControls capaId={capaId} actionId={a.id} currentStatus={a.status} />
              )}
            </li>
          ))}
        </ul>
      )}
      {readOnly ? (
        <p className="text-[11px] text-slate-500">
          Recorded on the NC report, which enforces who may write each section
          and when. Edit it there rather than here.
        </p>
      ) : (
        <AddActionForm capaId={capaId} defaultActionType={defaultActionType} users={users} />
      )}
    </Card>
  );
}

function VerificationTab({ capa }: { capa: CapaOut }) {
  return (
    <div className="space-y-4">
      <Card title="Verification Plan">
        <DefList
          items={[
            ["Success criteria", capa.verificationSuccessCriteria ?? "—"],
            ["Due date", capa.verificationDueDate ? new Date(capa.verificationDueDate).toLocaleDateString() : "—"],
            ["Completed", capa.verificationCompletedAt ? new Date(capa.verificationCompletedAt).toLocaleString() : "—"],
            ["Result", capa.verificationResult ?? "Not yet verified"]
          ]}
        />
        {capa.verificationEvidence && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs uppercase text-slate-500 mb-1">Evidence</div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{capa.verificationEvidence}</p>
          </div>
        )}
      </Card>
      <Card title="Recurrence Check">
        <DefList
          items={[
            ["Due", capa.recurrenceCheckDueDate ? new Date(capa.recurrenceCheckDueDate).toLocaleDateString() : "—"],
            ["Recurred?", capa.recurrenceDetected === null ? "Not yet checked" : capa.recurrenceDetected ? "Yes" : "No"]
          ]}
        />
      </Card>
    </div>
  );
}

function CapaAccessDenied() {
  return (
    <div>
      <PageHeader
        title="CAPA — Access Restricted"
        description="This record is outside your access scope"
        breadcrumbs={[{ label: "CAPA", href: "/capa" }, { label: "Restricted" }]}
      />
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-6 text-sm text-amber-900 max-w-2xl">
        <div className="font-semibold mb-1">You don&apos;t have access to this CAPA.</div>
        <p className="text-amber-800">
          It belongs to a plant or scope your role isn&apos;t permitted to view. If you believe
          you should have access, ask an administrator to review your CAPA permissions.
        </p>
        <Link
          href="/capa"
          className="inline-flex items-center gap-1 mt-4 px-3 py-1.5 text-xs rounded border border-amber-400 bg-white hover:border-amber-500"
        >
          ← Back to CAPA list
        </Link>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  className
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-white ${className ?? ""}`}>
      <div className="px-4 py-2.5 border-b text-xs uppercase tracking-wider text-slate-600 font-medium">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DefList({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-1.5 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-slate-500 text-xs">{k}</dt>
          <dd className="text-slate-800 text-right text-xs">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
