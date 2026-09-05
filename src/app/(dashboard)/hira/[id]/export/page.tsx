import { notFound } from "next/navigation";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { requirePermission } from "@/lib/auth/server";
import { PrintButton } from "@/components/ui/print-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
    consequence: string | null;
    regulationRef: string | null;
    regulationSection: string | null;
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
    evidenceAttached: boolean;
    documentReference: string | null;
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

        <Table className="w-full text-sm mb-6">
          <TableBody>
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
              <TableRow key={k} className="border-b border-slate-200">
                <TableCell className="py-1.5 pr-4 text-slate-500 w-48">{k}</TableCell>
                <TableCell className="py-1.5 font-medium text-slate-900">{v}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-700 mt-6 mb-2">Team Composition</h2>
        <Table className="w-full text-sm border">
          <TableHeader className="bg-slate-50 text-xs uppercase">
            <TableRow>
              <TableHead className="text-left px-2 py-1.5">Name</TableHead>
              <TableHead className="text-left px-2 py-1.5">Role</TableHead>
              <TableHead className="text-left px-2 py-1.5">Signed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-t">
              <TableCell className="px-2 py-1.5 font-medium">{detail.teamLeaderName ?? "—"}</TableCell>
              <TableCell className="px-2 py-1.5">Study Leader</TableCell>
              <TableCell className="px-2 py-1.5">{study.approvedAt ? new Date(study.approvedAt).toLocaleDateString() : "Pending"}</TableCell>
            </TableRow>
            {study.team.map((m) => (
              <TableRow key={m.id} className="border-t">
                <TableCell className="px-2 py-1.5 font-medium">{detail.teamMemberNames[m.userId] ?? m.userId}</TableCell>
                <TableCell className="px-2 py-1.5">{m.teamRole.replace(/_/g, " ")}</TableCell>
                <TableCell className="px-2 py-1.5">{m.signedAt ? new Date(m.signedAt).toLocaleDateString() : "Pending"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-700 mt-6 mb-2">Aggregate Risk Distribution</h2>
        <Table className="w-full text-sm border">
          <TableHeader className="bg-slate-50 text-xs uppercase">
            <TableRow>
              <TableHead className="text-left px-2 py-1.5">Level</TableHead>
              <TableHead className="text-right px-2 py-1.5">Initial</TableHead>
              <TableHead className="text-right px-2 py-1.5">Residual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(["LOW", "MODERATE", "HIGH", "CRITICAL"] as const).map((lvl) => (
              <TableRow key={lvl} className="border-t">
                <TableCell className="px-2 py-1.5">
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: RISK_COLOR[lvl] }} />
                  {lvl}
                </TableCell>
                <TableCell className="px-2 py-1.5 text-right font-mono">{counts.initial[lvl] ?? 0}</TableCell>
                <TableCell className="px-2 py-1.5 text-right font-mono">{counts.residual[lvl] ?? 0}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t font-semibold bg-slate-50">
              <TableCell className="px-2 py-1.5">Total</TableCell>
              <TableCell className="px-2 py-1.5 text-right font-mono">{fullEntries.length}</TableCell>
              <TableCell className="px-2 py-1.5 text-right font-mono">
                {Object.values(counts.residual).reduce((a, b) => a + b, 0)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

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
                  {/* Consequence prints unconditionally — an auditor needs to see
                      that it is missing, not have it quietly omitted. */}
                  <div className="text-xs mt-0.5 pl-2 border-l-2 border-slate-200">
                    <span className="font-medium text-slate-700">Consequence: </span>
                    {h.consequence?.trim() ? (
                      <span className="text-slate-600">{h.consequence}</span>
                    ) : (
                      <span className="text-slate-400 italic">not recorded</span>
                    )}
                  </div>
                  {(h.regulationRef || h.regulationSection) && (
                    <div className="text-xs mt-0.5 pl-2 border-l-2 border-slate-200">
                      <span className="font-medium text-slate-700">Regulation: </span>
                      <span className="text-slate-600">
                        {[h.regulationRef, h.regulationSection].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <h4 className="text-xs uppercase font-semibold text-slate-700 mt-3 mb-1">Risk Assessment</h4>
          <Table className="w-full text-sm border">
            <TableHeader className="bg-slate-50 text-xs uppercase">
              <TableRow>
                <TableHead className="text-left px-2 py-1.5"></TableHead>
                <TableHead className="text-center px-2 py-1.5">L</TableHead>
                <TableHead className="text-center px-2 py-1.5">S</TableHead>
                <TableHead className="text-center px-2 py-1.5">Score</TableHead>
                <TableHead className="text-center px-2 py-1.5">Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-t">
                <TableCell className="px-2 py-1.5 font-medium">Initial</TableCell>
                <TableCell className="px-2 py-1.5 text-center">{e.initialLikelihoodScore}</TableCell>
                <TableCell className="px-2 py-1.5 text-center">{e.initialSeverityScore}</TableCell>
                <TableCell className="px-2 py-1.5 text-center font-mono">{e.initialRiskScore}</TableCell>
                <TableCell
                  className="px-2 py-1.5 text-center font-semibold"
                  style={{ color: RISK_COLOR[e.initialRiskLevel], backgroundColor: RISK_COLOR[e.initialRiskLevel] + "20" }}
                >
                  {e.initialRiskLevel}
                </TableCell>
              </TableRow>
              {e.residualRiskLevel && (
                <TableRow className="border-t">
                  <TableCell className="px-2 py-1.5 font-medium">Residual</TableCell>
                  <TableCell className="px-2 py-1.5 text-center">{e.residualLikelihoodScore}</TableCell>
                  <TableCell className="px-2 py-1.5 text-center">{e.residualSeverityScore}</TableCell>
                  <TableCell className="px-2 py-1.5 text-center font-mono">{e.residualRiskScore}</TableCell>
                  <TableCell
                    className="px-2 py-1.5 text-center font-semibold"
                    style={{
                      color: RISK_COLOR[e.residualRiskLevel],
                      backgroundColor: RISK_COLOR[e.residualRiskLevel] + "20"
                    }}
                  >
                    {e.residualRiskLevel}
                    {e.residualAcceptable === false && <span className="ml-1 text-rose-600">⚠</span>}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <h4 className="text-xs uppercase font-semibold text-slate-700 mt-3 mb-1">Existing Controls</h4>
          {e.existingControls.length === 0 ? (
            <p className="text-sm italic text-slate-500">None recorded.</p>
          ) : (
            <Table className="w-full text-sm border">
              <TableHeader className="bg-slate-50 text-xs uppercase">
                <TableRow>
                  <TableHead className="text-left px-2 py-1">Hierarchy</TableHead>
                  <TableHead className="text-left px-2 py-1">Description</TableHead>
                  <TableHead className="text-left px-2 py-1">Effectiveness</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {e.existingControls.map((c) => (
                  <TableRow key={c.id} className="border-t">
                    <TableCell className="px-2 py-1 font-medium">{c.hierarchy}</TableCell>
                    <TableCell className="px-2 py-1">{c.description}</TableCell>
                    <TableCell className="px-2 py-1">{c.effectiveness?.replace(/_/g, " ") ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {e.recommendedControls.length > 0 && (
            <>
              <h4 className="text-xs uppercase font-semibold text-slate-700 mt-3 mb-1">Recommended Additional Controls</h4>
              <Table className="w-full text-sm border">
                <TableHeader className="bg-slate-50 text-xs uppercase">
                  <TableRow>
                    <TableHead className="text-left px-2 py-1">Hierarchy</TableHead>
                    <TableHead className="text-left px-2 py-1">Description</TableHead>
                    <TableHead className="text-left px-2 py-1">Status</TableHead>
                    <TableHead className="text-left px-2 py-1">Evidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {e.recommendedControls.map((c) => (
                    <TableRow key={c.id} className="border-t">
                      <TableCell className="px-2 py-1 font-medium">{c.hierarchy}</TableCell>
                      <TableCell className="px-2 py-1">{c.description}</TableCell>
                      <TableCell className="px-2 py-1 text-xs">{c.status.replace(/_/g, " ")}</TableCell>
                      <TableCell className="px-2 py-1 text-xs">
                        {c.documentReference || (c.evidenceAttached ? "On file" : "—")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {e.regulationRefs.length > 0 && (
            <>
              {/* Activity-level citations. Hazard-specific ones print against
                  their hazard above — the two are not interchangeable. */}
              <h4 className="text-xs uppercase font-semibold text-slate-700 mt-3 mb-1">
                Regulatory References (activity)
              </h4>
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
        <Table className="w-full text-sm border">
          <TableHeader className="bg-slate-50 text-xs uppercase">
            <TableRow>
              <TableHead className="text-left px-2 py-1.5">Role</TableHead>
              <TableHead className="text-left px-2 py-1.5">Name</TableHead>
              <TableHead className="text-left px-2 py-1.5">Date</TableHead>
              <TableHead className="text-left px-2 py-1.5">Signature</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-t h-14">
              <TableCell className="px-2 py-1.5">Study Leader</TableCell>
              <TableCell className="px-2 py-1.5">{detail.teamLeaderName ?? "—"}</TableCell>
              <TableCell className="px-2 py-1.5">{study.completedAt ? new Date(study.completedAt).toLocaleDateString() : "—"}</TableCell>
              <TableCell className="px-2 py-1.5"></TableCell>
            </TableRow>
            <TableRow className="border-t h-14">
              <TableCell className="px-2 py-1.5">Plant Head</TableCell>
              <TableCell className="px-2 py-1.5">{detail.approvedByName ?? "—"}</TableCell>
              <TableCell className="px-2 py-1.5">{study.approvedAt ? new Date(study.approvedAt).toLocaleDateString() : "—"}</TableCell>
              <TableCell className="px-2 py-1.5"></TableCell>
            </TableRow>
            <TableRow className="border-t h-14">
              <TableCell className="px-2 py-1.5">Corporate HSE</TableCell>
              <TableCell className="px-2 py-1.5">—</TableCell>
              <TableCell className="px-2 py-1.5"></TableCell>
              <TableCell className="px-2 py-1.5"></TableCell>
            </TableRow>
          </TableBody>
        </Table>

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
