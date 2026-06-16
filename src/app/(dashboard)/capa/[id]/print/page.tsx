import { notFound } from "next/navigation";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { requirePermission } from "@/lib/auth/server";
import { PrintButton } from "@/components/ui/print-button";

export const dynamic = "force-dynamic";

const SEVERITY_COLOR: Record<string, string> = {
  LOW: "#10B981",
  MODERATE: "#F59E0B",
  HIGH: "#F97316",
  CRITICAL: "#EF4444"
};

type CapaOut = {
  id: string;
  capaNumber: string;
  aliasNumber: string | null;
  title: string;
  sourceTypeCode: string;
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
  rcaMethodology: string | null;
  rcaSummary: string | null;
  rcaCompletedAt: string | null;
  verificationSuccessCriteria: string | null;
  verificationCompletedAt: string | null;
  verificationResult: string | null;
  verificationEvidence: string | null;
  state: string;
  closureTargetDate: string | null;
  closedAt: string | null;
  raisedByUserId: string;
  primaryOwnerUserId: string;
  actions: {
    id: string;
    actionType: string;
    description: string;
    ownerUserId: string;
    dueDate: string;
    status: string;
    completedAt: string | null;
    evidenceOfCompletion: string | null;
  }[];
  rootCauses: { id: string; description: string; category: string; confidence: string }[];
};

export default async function CapaPrintPage(
  props: { params: Promise<{ id: string }> }
) {
  await requirePermission("CAPA.READ");
  const { id } = await props.params;

  let capa: CapaOut;
  try {
    capa = await backendFetch<CapaOut>(`/api/capa/${id}`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="capa-print-root max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden mb-4">
        <h1 className="text-lg font-medium text-slate-700">Print-ready CAPA report</h1>
        <PrintButton label="Print / Save as PDF" />
      </div>

      <section>
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="text-xs uppercase tracking-widest text-slate-500">
            SafeOps360 · CAPA Report · ISO 9001 Clause 10.2 / ISO 45001 Clause 10.2
          </div>
          <h1 className="text-2xl font-bold mt-1 text-slate-900">{capa.title}</h1>
          <div className="text-base text-slate-700 mt-1">
            {capa.capaNumber}
            {capa.aliasNumber && capa.aliasNumber !== capa.capaNumber && (
              <span className="text-sm text-slate-500 ml-2">(alias: {capa.aliasNumber})</span>
            )}
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <tbody>
            {[
              ["Source type", capa.sourceTypeCode.replace(/_/g, " ")],
              ["Source reference", capa.sourceReferenceSummary ?? "—"],
              ["Primary category", capa.primaryCategory.replace(/_/g, " ")],
              ["Action type", capa.actionType.replace(/_/g, " ")],
              ["Severity", capa.severity],
              ["Priority", capa.priority],
              ["State", capa.state.replace(/_/g, " ")],
              ["Raised by", capa.raisedByUserId],
              ["Primary owner", capa.primaryOwnerUserId],
              ["Detected at", new Date(capa.detectedAt).toLocaleString()],
              ["Closure target", capa.closureTargetDate ? new Date(capa.closureTargetDate).toLocaleDateString() : "—"],
              ["Closed at", capa.closedAt ? new Date(capa.closedAt).toLocaleString() : "Not closed"]
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-slate-200">
                <td className="py-1.5 pr-4 text-slate-500 w-48">{k}</td>
                <td className="py-1.5 font-medium text-slate-900">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-700 mb-2">
          Problem Statement
        </h2>
        <p className="text-sm text-slate-800 whitespace-pre-wrap mb-4">{capa.problemDescription}</p>
        {capa.problemImpact && (
          <>
            <h3 className="text-xs uppercase font-semibold text-slate-600 mt-3">Impact</h3>
            <p className="text-sm text-slate-800 whitespace-pre-wrap mb-4">{capa.problemImpact}</p>
          </>
        )}

        <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-700 mt-6 mb-2">
          Root Cause Analysis
        </h2>
        <table className="w-full text-sm border mb-4">
          <tbody>
            <tr className="border-t">
              <td className="px-2 py-1.5 text-slate-500 w-48">Methodology</td>
              <td className="px-2 py-1.5">{capa.rcaMethodology ?? "Not selected"}</td>
            </tr>
            <tr className="border-t">
              <td className="px-2 py-1.5 text-slate-500">Completed</td>
              <td className="px-2 py-1.5">
                {capa.rcaCompletedAt ? new Date(capa.rcaCompletedAt).toLocaleDateString() : "—"}
              </td>
            </tr>
          </tbody>
        </table>
        {capa.rcaSummary && (
          <>
            <h3 className="text-xs uppercase font-semibold text-slate-600">Summary</h3>
            <p className="text-sm text-slate-800 whitespace-pre-wrap mb-3">{capa.rcaSummary}</p>
          </>
        )}
        {capa.rootCauses.length > 0 && (
          <>
            <h3 className="text-xs uppercase font-semibold text-slate-600 mt-3 mb-1">Identified Root Causes</h3>
            <ol className="list-decimal list-inside text-sm space-y-1 mb-4">
              {capa.rootCauses.map((rc) => (
                <li key={rc.id}>
                  {rc.description}
                  <span className="text-xs text-slate-500 ml-2">[{rc.category} · {rc.confidence}]</span>
                </li>
              ))}
            </ol>
          </>
        )}

        <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-700 mt-6 mb-2">
          Actions
        </h2>
        {capa.actions.length === 0 ? (
          <p className="text-sm italic text-slate-500">No actions recorded.</p>
        ) : (
          <table className="w-full text-sm border">
            <thead className="bg-slate-50 text-xs uppercase">
              <tr>
                <th className="text-left px-2 py-1.5">Type</th>
                <th className="text-left px-2 py-1.5">Description</th>
                <th className="text-left px-2 py-1.5">Owner</th>
                <th className="text-left px-2 py-1.5">Due</th>
                <th className="text-left px-2 py-1.5">Status</th>
                <th className="text-left px-2 py-1.5">Completed</th>
              </tr>
            </thead>
            <tbody>
              {capa.actions.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-2 py-1.5 text-xs">{a.actionType.replace(/_/g, " ")}</td>
                  <td className="px-2 py-1.5">{a.description}</td>
                  <td className="px-2 py-1.5 text-xs">{a.ownerUserId}</td>
                  <td className="px-2 py-1.5 text-xs">{new Date(a.dueDate).toLocaleDateString()}</td>
                  <td className="px-2 py-1.5 text-xs">{a.status.replace(/_/g, " ")}</td>
                  <td className="px-2 py-1.5 text-xs">
                    {a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-700 mt-6 mb-2">
          Effectiveness Verification
        </h2>
        <table className="w-full text-sm border">
          <tbody>
            <tr className="border-t">
              <td className="px-2 py-1.5 text-slate-500 w-48">Success criteria</td>
              <td className="px-2 py-1.5">{capa.verificationSuccessCriteria ?? "—"}</td>
            </tr>
            <tr className="border-t">
              <td className="px-2 py-1.5 text-slate-500">Completed at</td>
              <td className="px-2 py-1.5">
                {capa.verificationCompletedAt ? new Date(capa.verificationCompletedAt).toLocaleString() : "—"}
              </td>
            </tr>
            <tr className="border-t">
              <td className="px-2 py-1.5 text-slate-500">Result</td>
              <td
                className="px-2 py-1.5 font-semibold"
                style={{
                  color: capa.verificationResult === "EFFECTIVE" ? "#065F46" : "#92400E"
                }}
              >
                {capa.verificationResult ?? "Not yet verified"}
              </td>
            </tr>
          </tbody>
        </table>
        {capa.verificationEvidence && (
          <>
            <h3 className="text-xs uppercase font-semibold text-slate-600 mt-3">Evidence</h3>
            <p className="text-sm text-slate-800 whitespace-pre-wrap mb-3">{capa.verificationEvidence}</p>
          </>
        )}

        <div className="mt-8 grid grid-cols-3 gap-4 pt-4 border-t-2 border-slate-300">
          {["Primary Owner", "Verification Authority", "Closure Authority"].map((role) => (
            <div key={role} className="text-center">
              <div className="border-b-2 border-slate-700 h-12"></div>
              <div className="text-xs text-slate-600 mt-1">{role}</div>
              <div className="text-xs text-slate-400 mt-2">Signature / Date</div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-400 mt-8 text-center">
          CONFIDENTIAL · {capa.capaNumber} · Generated {new Date().toISOString().slice(0, 19)}
        </p>
      </section>

      <style>{`
        @media print {
          @page { margin: 18mm 14mm; size: A4 portrait; }
          .capa-print-root { max-width: none; }
          body { background: white; }
        }
        @media screen {
          .capa-print-root { padding: 24px; background: white; min-height: 100vh; }
        }
      `}</style>
    </div>
  );
}
