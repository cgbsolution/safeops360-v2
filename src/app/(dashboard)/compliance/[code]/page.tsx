import Link from "next/link";
import { notFound } from "next/navigation";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { AccessRestricted } from "@/components/access-restricted";
import { resolvePlantContext } from "@/lib/plant-context";
import { PrintButton } from "@/components/ui/print-button";
import { ChevronLeft, FileDown, History } from "lucide-react";

export const dynamic = "force-dynamic";

type RegisterMeta = {
  registerCode: string;
  registerName: string;
  legalAct: string;
  sectionRule: string | null;
  submissionAuthority: string | null;
  authorisedSignatoryRole: string | null;
  entryCount: number;
};

type Entry = {
  id: string;
  sourceTransactionId: string;
  sourceModule: string;
  sourceRef: string | null;
  entryDate: string | null;
  fields: Record<string, any>;
  isManualCorrection: boolean;
  isVoided: boolean;
  auditTrail: { at: string; by: string; action: string; source?: string }[];
};

type RegisterDetail = { register: RegisterMeta; entries: Entry[] };

type Col = { key: string; label: string };

// Prescribed column layouts per register family.
const FORM18_COLS: Col[] = [
  { key: "srNo", label: "Sr. No." },
  { key: "injuredPersonName", label: "Name of Injured Person" },
  { key: "department", label: "Department / Section" },
  { key: "dateOfAccident", label: "Date of Accident" },
  { key: "timeOfAccident", label: "Time" },
  { key: "natureOfInjury", label: "Nature of Injury / Occurrence" },
  { key: "causeOfAccident", label: "Cause of Accident" },
  { key: "location", label: "Place of Accident" },
  { key: "daysLost", label: "Days Lost" },
  { key: "investigationReference", label: "Reference No." }
];
const PTW_COLS: Col[] = [
  { key: "srNo", label: "Sr. No." },
  { key: "permitNumber", label: "Permit No." },
  { key: "workLocation", label: "Work Location" },
  { key: "issuedTo", label: "Issued To" },
  { key: "issuedBy", label: "Issued By" },
  { key: "validFrom", label: "Valid From" },
  { key: "validTo", label: "Valid To" },
  { key: "status", label: "Status" },
  { key: "closedOn", label: "Closed On" }
];
const EQUIP_COLS: Col[] = [
  { key: "srNo", label: "Sr. No." },
  { key: "equipmentCode", label: "Equipment Code" },
  { key: "equipmentName", label: "Equipment / Machinery" },
  { key: "statutoryRegNo", label: "Statutory Reg. No." },
  { key: "examinationDate", label: "Date of Examination" },
  { key: "inspector", label: "Competent Person" },
  { key: "result", label: "Result" },
  { key: "nextDue", label: "Next Due" },
  { key: "reference", label: "Reference No." }
];
const TRAIN_COLS: Col[] = [
  { key: "srNo", label: "Sr. No." },
  { key: "employeeName", label: "Name of Employee" },
  { key: "programCode", label: "Programme" },
  { key: "programName", label: "Training Subject" },
  { key: "trainingDate", label: "Date of Training" },
  { key: "validUntil", label: "Valid Until" },
  { key: "status", label: "Status" },
  { key: "certificateNumber", label: "Certificate No." }
];
const CAPA_COLS: Col[] = [
  { key: "srNo", label: "Sr. No." },
  { key: "capaNumber", label: "CAPA No." },
  { key: "title", label: "Title" },
  { key: "source", label: "Source" },
  { key: "severity", label: "Severity" },
  { key: "status", label: "Status" },
  { key: "raisedOn", label: "Raised On" },
  { key: "dueOn", label: "Closure Target" },
  { key: "owner", label: "Owner" }
];

function pickColumns(code: string, rows: Entry[]): Col[] {
  if (code === "FORM18") return FORM18_COLS;
  if (code.startsWith("PTW-")) return PTW_COLS;
  if (["FORM10", "FORM11", "FORM13", "EQUIP-EXAM", "FIRE-EXT"].includes(code)) return EQUIP_COLS;
  if (code === "TRAIN-REGISTER") return TRAIN_COLS;
  if (code === "CAPA-REGISTER") return CAPA_COLS;
  return inferColumns(rows);
}

// Route a source-record link to the right module detail page.
function sourceHref(module: string, id: string): string | null {
  switch (module) {
    case "IncidentManagement":
      return `/incidents/${id}`;
    case "PermitToWork":
      return `/ptw/${id}`;
    case "Inspection":
      return `/inspections/${id}`;
    case "CAPA":
      return `/capa/${id}`;
    default:
      return null; // Training certs have no standalone detail page
  }
}

export default async function RegisterViewPage(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ plantId?: string }>;
}) {
  const { code } = await props.params;
  const sp = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(sp.plantId);
  if (!plantId) return notFound();

  let data: RegisterDetail;
  try {
    data = await backendFetch<RegisterDetail>(`/api/scr/registers/${code}`, { query: { plantId } });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    if (e instanceof BackendError && e.status === 403)
      return <AccessRestricted backHref="/compliance" backLabel="← Back to statutory registers" />;
    throw e;
  }

  const reg = data.register;
  const plant = plants.find((p) => p.id === plantId);
  const rows = data.entries.filter((e) => !e.isVoided);
  const cols = pickColumns(reg.registerCode, rows);

  return (
    <div className="scr-print-root max-w-6xl">
      {/* Screen-only toolbar */}
      <div className="print:hidden mb-4">
        <Link
          href={`/compliance?plantId=${plantId}`}
          className="inline-flex items-center gap-1 text-sm text-primary-700 hover:underline mb-3"
        >
          <ChevronLeft size={14} /> Back to registers
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-medium text-slate-700">{reg.registerName}</h1>
          <div className="flex gap-2">
            <a
              href={`/api/scr/registers/${code}/export?plantId=${plantId}`}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-primary-500"
            >
              <FileDown size={14} /> CSV
            </a>
            <PrintButton label="Print / Save as PDF" />
          </div>
        </div>
      </div>

      {/* Statutory header */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4">
        <div className="text-[11px] uppercase tracking-widest text-slate-500">{reg.legalAct}{reg.sectionRule ? ` · ${reg.sectionRule}` : ""}</div>
        <h2 className="text-2xl font-bold text-slate-900 mt-0.5">{reg.registerName}</h2>
        <table className="mt-2 text-sm">
          <tbody>
            <tr>
              <td className="pr-4 text-slate-500">Factory / Plant</td>
              <td className="font-medium text-slate-900">{plant ? `${plant.name} (${plant.code})` : plantId}</td>
              <td className="pl-8 pr-4 text-slate-500">Factory Licence No.</td>
              <td className="font-medium text-slate-900">____________________</td>
            </tr>
            <tr>
              <td className="pr-4 text-slate-500">Total entries</td>
              <td className="font-medium text-slate-900">{rows.length}</td>
              <td className="pl-8 pr-4 text-slate-500">Generated</td>
              <td className="font-medium text-slate-900">{new Date().toLocaleDateString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Prescribed-format register table */}
      {rows.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
          No entries. This register populates automatically from {reg.registerName.includes("Accident") ? "the Incident module" : "its source module"}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-300">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-800">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className="border border-slate-300 px-2 py-2 text-left font-semibold">
                    {c.label}
                  </th>
                ))}
                <th className="border border-slate-300 px-2 py-2 text-left font-semibold print:hidden">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="even:bg-slate-50/60">
                  {cols.map((c) => (
                    <td key={c.key} className="border border-slate-200 px-2 py-1.5 align-top text-slate-700">
                      {formatCell(e.fields[c.key])}
                      {c.key === "injuredPersonName" && e.isManualCorrection && (
                        <span title="Manually corrected" className="ml-1 text-amber-600">✎</span>
                      )}
                    </td>
                  ))}
                  <td className="border border-slate-200 px-2 py-1.5 print:hidden">
                    {sourceHref(e.sourceModule, e.sourceTransactionId) ? (
                      <Link
                        href={sourceHref(e.sourceModule, e.sourceTransactionId)!}
                        className="text-primary-700 hover:underline font-mono"
                      >
                        {e.sourceRef}
                      </Link>
                    ) : (
                      <span className="font-mono text-slate-500">{e.sourceRef}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Statutory footer — signatory block */}
      <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <div className="text-xs text-slate-500">Prepared by SafeOps360 (auto-populated)</div>
          <div className="mt-6 border-t border-slate-400 pt-1 text-slate-700">Date: {new Date().toLocaleDateString()}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Authorised Signatory — {reg.authorisedSignatoryRole ?? "Factory Manager"}</div>
          <div className="mt-6 border-t border-slate-400 pt-1 text-slate-700">Name &amp; Signature</div>
        </div>
      </div>
      <p className="mt-4 text-[10px] text-slate-400 print:mt-8">
        Entries are auto-populated from source records and immutable (void, never delete). Submission authority:{" "}
        {reg.submissionAuthority ?? "—"}. Generated by SafeOps360 on {new Date().toISOString().slice(0, 19)}.
      </p>

      {/* Audit trail (screen only) */}
      <details className="print:hidden mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <History size={14} /> Audit trail ({rows.length} entries)
        </summary>
        <ul className="mt-3 space-y-1.5 text-xs">
          {rows.slice(0, 50).map((e) => (
            <li key={e.id} className="flex gap-2 text-slate-600">
              <span className="font-mono text-primary-700 w-36 shrink-0">{e.sourceRef}</span>
              <span>
                {(e.auditTrail ?? []).map((a, i) => (
                  <span key={i}>
                    {a.action.replace(/_/g, " ").toLowerCase()} by {a.by} on {new Date(a.at).toLocaleString()}
                    {i < (e.auditTrail?.length ?? 0) - 1 ? " · " : ""}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <style>{`
        @media print {
          @page { margin: 14mm 10mm; size: A4 landscape; }
          .scr-print-root { max-width: none; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function inferColumns(rows: Entry[]): { key: string; label: string }[] {
  const keys = rows.length ? Object.keys(rows[0].fields) : [];
  return keys.map((k) => ({ key: k, label: k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) }));
}
