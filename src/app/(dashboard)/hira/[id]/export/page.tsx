import { notFound } from "next/navigation";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { requirePermission } from "@/lib/auth/server";
import { PrintButton } from "@/components/ui/print-button";

export const dynamic = "force-dynamic";

const RISK_COLOR: Record<string, string> = {
  LOW: "#10B981",
  MODERATE: "#F59E0B",
  HIGH: "#F97316",
  CRITICAL: "#EF4444"
};

// Print-ready HIRA report — pure 3-tier.
// Pulls the study + entries + matrix + denormalised names from one backend
// call, plus full entry details (with hazards + controls + recommendations
// + regulation refs) from a second batched fetch.

type StudyDetail = {
  study: {
    id: string;
    number: string;
    title: string;
    description: string | null;
    status: string;
    scopeType: string;
    processCode: string | null;
    initiatedAt: string;
    completedAt: string | null;
    approvedAt: string | null;
    effectiveFrom: string | null;
    nextScheduledReviewDate: string | null;
    reviewFrequency: string;
    teamLeaderId: string;
    team: { id: string; userId: string; teamRole: string; department: string | null; signedAt: string | null }[];
  };
  entries: { id: string; sequenceNumber: number }[];
  plantName: string | null;
  departmentName: string | null;
  areaName: string | null;
  teamLeaderName: string | null;
  approvedByName: string | null;
  teamMemberNames: Record<string, string>;
  riskMatrix: { name: string; code: string; likelihoodLevels: number; severityLevels: number } | null;
};

type EntryFull = {
  id: string;
  sequenceNumber: number;
  activityDescription: string;
  routine: string;
  frequency: string;
  areaId: string | null;
  initialLikelihoodScore: number;
  initialSeverityScore: number;
  initialRiskScore: number;
  initialRiskLevel: string;
  residualLikelihoodScore: number | null;
  residualSeverityScore: number | null;
  residualRiskScore: number | null;
  residualRiskLevel: string | null;
  residualAcceptable: boolean | null;
  hazards: {
    id: string;
    hazardId: string;
    contextualDescription: string | null;
    hazardCode: string | null;
    hazardCategory: string | null;
    hazardName: string | null;
  }[];
  existingControls: {
    id: string;
    hierarchy: string;
    description: string;
    effectiveness: string | null;
    verificationMethod: string | null;
    verificationFreq: string | null;
  }[];
  recommendedControls: {
    id: string;
    hierarchy: string;
    description: string;
    estimatedCostBand: string | null;
    proposedImplementationDate: string | null;
    status: string;
  }[];
  regulationRefs: { id: string; regulation: string; section: string | null; requirementSummary: string | null }[];
};

export default async function HiraReportPage(
  props: { params: Promise<{ id: string }> }
) {
  await requirePermission("HIRA.READ");
  const { id } = await props.params;

  let detail: StudyDetail;
  try {
    detail = await backendFetch<StudyDetail>(`/api/hira/studies/${id}/detail`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  // Fetch full entry data in parallel — the detail endpoint only returns
  // compact rows, but the PDF needs full hazards/controls/recommendations.
  const fullEntries = await Promise.all(
    detail.entries.map((e) => backendFetch<EntryFull>(`/api/hira/entries/${e.id}`))
  );

  const counts = {
    initial: { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>,
    residual: { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>
  };
  for (const e of fullEntries) {
    counts.initial[e.initialRiskLevel] = (counts.initial[e.initialRiskLevel] ?? 0) + 1;
    if (e.residualRiskLevel) {
      counts.residual[e.residualRiskLevel] = (counts.residual[e.residualRiskLevel] ?? 0) + 1;
    }
  }

  const study = detail.study;

  return (
    <div className="hira-print-root max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden mb-4">
        <h1 className="text-lg font-medium text-slate-700">Print-ready HIRA report</h1>
        <div className="flex gap-2">
          <a
            href={`/api/hira/studies/${id}/export?format=csv`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-slate-300 bg-white hover:border-primary-500"
          >
            Download CSV
          </a>
          <PrintButton label="Print / Save as PDF" />
        </div>
      </div>

      <section className="page-break-after">
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="text-xs uppercase tracking-widest text-slate-500">SafeOps360 · HIRA Register</div>
          <h1 className="text-3xl font-bold mt-1 text-slate-900">{study.title}</h1>
          <div className="text-lg text-slate-700 mt-1">{study.number}</div>
        </div>

        <table className="w-full text-sm mb-6">
          <tbody>
            {[
              ["Plant", detail.plantName ?? "—"],
              ["Department", detail.departmentName ?? "—"],
              ["Area", detail.areaName ?? "—"],
              ["Scope type", study.scopeType.replace(/_/g, " ")],
              ["Process code", study.processCode ?? "—"],
              ["Methodology", detail.riskMatrix ? `${detail.riskMatrix.name} (${detail.riskMatrix.code})` : "—"],
              ["Review frequency", study.reviewFrequency.replace(/_/g, " ")],
              ["Initiated", new Date(study.initiatedAt).toLocaleDateString()],
              ["Effective from", study.effectiveFrom ? new Date(study.effectiveFrom).toLocaleDateString() : "—"],
              ["Next scheduled review", study.nextScheduledReviewDate ? new Date(study.nextScheduledReviewDate).toLocaleDateString() : "—"],
              ["Status", study.status]
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-slate-200">
                <td className="py-1.5 pr-4 text-slate-500 w-48">{k}</td>
                <td className="py-1.5 font-medium text-slate-900">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-700 mt-6 mb-2">Team Composition</h2>
        <table className="w-full text-sm border">
          <thead className="bg-slate-50 text-xs uppercase">
            <tr>
              <th className="text-left px-2 py-1.5">Name</th>
              <th className="text-left px-2 py-1.5">Role</th>
              <th className="text-left px-2 py-1.5">Signed</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="px-2 py-1.5 font-medium">{detail.teamLeaderName ?? "—"}</td>
              <td className="px-2 py-1.5">Study Leader</td>
              <td className="px-2 py-1.5">{study.approvedAt ? new Date(study.approvedAt).toLocaleDateString() : "Pending"}</td>
            </tr>
            {study.team.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-2 py-1.5 font-medium">{detail.teamMemberNames[m.userId] ?? m.userId}</td>
                <td className="px-2 py-1.5">{m.teamRole.replace(/_/g, " ")}</td>
                <td className="px-2 py-1.5">{m.signedAt ? new Date(m.signedAt).toLocaleDateString() : "Pending"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-700 mt-6 mb-2">Aggregate Risk Distribution</h2>
        <table className="w-full text-sm border">
          <thead className="bg-slate-50 text-xs uppercase">
            <tr>
              <th className="text-left px-2 py-1.5">Level</th>
              <th className="text-right px-2 py-1.5">Initial</th>
              <th className="text-right px-2 py-1.5">Residual</th>
            </tr>
          </thead>
          <tbody>
            {(["LOW", "MODERATE", "HIGH", "CRITICAL"] as const).map((lvl) => (
              <tr key={lvl} className="border-t">
                <td className="px-2 py-1.5">
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: RISK_COLOR[lvl] }} />
                  {lvl}
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{counts.initial[lvl] ?? 0}</td>
                <td className="px-2 py-1.5 text-right font-mono">{counts.residual[lvl] ?? 0}</td>
              </tr>
            ))}
            <tr className="border-t font-semibold bg-slate-50">
              <td className="px-2 py-1.5">Total</td>
              <td className="px-2 py-1.5 text-right font-mono">{fullEntries.length}</td>
              <td className="px-2 py-1.5 text-right font-mono">
                {Object.values(counts.residual).reduce((a, b) => a + b, 0)}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs text-slate-500 mt-6 italic">
          This document is a HIRA register generated by SafeOps360 on {new Date().toLocaleString()}.
        </p>
      </section>

      {fullEntries.map((e) => (
        <section key={e.id} className="page-break-before pt-4">
          <div className="border-b-2 border-slate-300 pb-2 mb-3">
            <div className="text-xs uppercase tracking-wider text-slate-500">Entry {e.sequenceNumber}</div>
            <h3 className="text-lg font-semibold text-slate-900 mt-0.5">{e.activityDescription}</h3>
            <div className="text-xs text-slate-500 mt-0.5">{e.routine} · {e.frequency}</div>
          </div>

          <h4 className="text-xs uppercase font-semibold text-slate-700 mt-3 mb-1">Hazards Identified</h4>
          {e.hazards.length === 0 ? (
            <p className="text-sm italic text-slate-500">None recorded.</p>
          ) : (
            <ul className="text-sm space-y-1.5">
              {e.hazards.map((h) => (
                <li key={h.id}>
                  <span className="font-medium">{h.hazardName ?? h.hazardId}</span>
                  {h.hazardCategory && <span className="text-xs text-slate-500 ml-2">[{h.hazardCategory}]</span>}
                  {h.contextualDescription && (
                    <div className="text-xs text-slate-600 mt-0.5 pl-2 border-l-2 border-slate-200">
                      {h.contextualDescription}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <h4 className="text-xs uppercase font-semibold text-slate-700 mt-3 mb-1">Risk Assessment</h4>
          <table className="w-full text-sm border">
            <thead className="bg-slate-50 text-xs uppercase">
              <tr>
                <th className="text-left px-2 py-1.5"></th>
                <th className="text-center px-2 py-1.5">L</th>
                <th className="text-center px-2 py-1.5">S</th>
                <th className="text-center px-2 py-1.5">Score</th>
                <th className="text-center px-2 py-1.5">Level</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-2 py-1.5 font-medium">Initial</td>
                <td className="px-2 py-1.5 text-center">{e.initialLikelihoodScore}</td>
                <td className="px-2 py-1.5 text-center">{e.initialSeverityScore}</td>
                <td className="px-2 py-1.5 text-center font-mono">{e.initialRiskScore}</td>
                <td
                  className="px-2 py-1.5 text-center font-semibold"
                  style={{ color: RISK_COLOR[e.initialRiskLevel], backgroundColor: RISK_COLOR[e.initialRiskLevel] + "20" }}
                >
                  {e.initialRiskLevel}
                </td>
              </tr>
              {e.residualRiskLevel && (
                <tr className="border-t">
                  <td className="px-2 py-1.5 font-medium">Residual</td>
                  <td className="px-2 py-1.5 text-center">{e.residualLikelihoodScore}</td>
                  <td className="px-2 py-1.5 text-center">{e.residualSeverityScore}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{e.residualRiskScore}</td>
                  <td
                    className="px-2 py-1.5 text-center font-semibold"
                    style={{
                      color: RISK_COLOR[e.residualRiskLevel],
                      backgroundColor: RISK_COLOR[e.residualRiskLevel] + "20"
                    }}
                  >
                    {e.residualRiskLevel}
                    {e.residualAcceptable === false && <span className="ml-1 text-rose-600">⚠</span>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h4 className="text-xs uppercase font-semibold text-slate-700 mt-3 mb-1">Existing Controls</h4>
          {e.existingControls.length === 0 ? (
            <p className="text-sm italic text-slate-500">None recorded.</p>
          ) : (
            <table className="w-full text-sm border">
              <thead className="bg-slate-50 text-xs uppercase">
                <tr>
                  <th className="text-left px-2 py-1">Hierarchy</th>
                  <th className="text-left px-2 py-1">Description</th>
                  <th className="text-left px-2 py-1">Effectiveness</th>
                </tr>
              </thead>
              <tbody>
                {e.existingControls.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-2 py-1 font-medium">{c.hierarchy}</td>
                    <td className="px-2 py-1">{c.description}</td>
                    <td className="px-2 py-1">{c.effectiveness?.replace(/_/g, " ") ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {e.recommendedControls.length > 0 && (
            <>
              <h4 className="text-xs uppercase font-semibold text-slate-700 mt-3 mb-1">Recommended Additional Controls</h4>
              <table className="w-full text-sm border">
                <thead className="bg-slate-50 text-xs uppercase">
                  <tr>
                    <th className="text-left px-2 py-1">Hierarchy</th>
                    <th className="text-left px-2 py-1">Description</th>
                    <th className="text-left px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {e.recommendedControls.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-2 py-1 font-medium">{c.hierarchy}</td>
                      <td className="px-2 py-1">{c.description}</td>
                      <td className="px-2 py-1 text-xs">{c.status.replace(/_/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {e.regulationRefs.length > 0 && (
            <>
              <h4 className="text-xs uppercase font-semibold text-slate-700 mt-3 mb-1">Regulatory References</h4>
              <ul className="text-xs space-y-0.5">
                {e.regulationRefs.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium">{r.regulation}</span>
                    {r.section && <span className="text-slate-700"> · {r.section}</span>}
                    {r.requirementSummary && <span className="text-slate-500"> — {r.requirementSummary}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ))}

      <section className="page-break-before pt-6">
        <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-700 mb-4">Approval</h2>
        <table className="w-full text-sm border">
          <thead className="bg-slate-50 text-xs uppercase">
            <tr>
              <th className="text-left px-2 py-1.5">Role</th>
              <th className="text-left px-2 py-1.5">Name</th>
              <th className="text-left px-2 py-1.5">Date</th>
              <th className="text-left px-2 py-1.5">Signature</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t h-14">
              <td className="px-2 py-1.5">Study Leader</td>
              <td className="px-2 py-1.5">{detail.teamLeaderName ?? "—"}</td>
              <td className="px-2 py-1.5">{study.completedAt ? new Date(study.completedAt).toLocaleDateString() : "—"}</td>
              <td className="px-2 py-1.5"></td>
            </tr>
            <tr className="border-t h-14">
              <td className="px-2 py-1.5">Plant Head</td>
              <td className="px-2 py-1.5">{detail.approvedByName ?? "—"}</td>
              <td className="px-2 py-1.5">{study.approvedAt ? new Date(study.approvedAt).toLocaleDateString() : "—"}</td>
              <td className="px-2 py-1.5"></td>
            </tr>
            <tr className="border-t h-14">
              <td className="px-2 py-1.5">Corporate HSE</td>
              <td className="px-2 py-1.5">—</td>
              <td className="px-2 py-1.5"></td>
              <td className="px-2 py-1.5"></td>
            </tr>
          </tbody>
        </table>

        <p className="text-[10px] text-slate-400 mt-8 text-center">
          CONFIDENTIAL — {detail.plantName ?? ""} · {study.number} · Generated {new Date().toISOString().slice(0, 19)}
        </p>
      </section>

      <style>{`
        @media print {
          @page { margin: 18mm 14mm; size: A4 portrait; }
          .page-break-before { page-break-before: always; }
          .page-break-after { page-break-after: always; }
          .hira-print-root { max-width: none; }
          body { background: white; }
        }
        @media screen {
          .hira-print-root { padding: 24px; background: white; min-height: 100vh; }
        }
      `}</style>
    </div>
  );
}
