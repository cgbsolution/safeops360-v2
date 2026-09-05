import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  HardHat,
  Users,
  Star,
  FileText,
  Phone,
  Mail,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
} from "lucide-react";

export const dynamic = "force-dynamic";

type ContractorDetail = {
  id: string;
  companyCode: string;
  companyName: string;
  tradeName: string | null;
  registrationNumber: string | null;
  panNumber: string | null;
  gstNumber: string | null;
  sizeCategory: string | null;
  tradeCategories: string[];
  representativeName: string | null;
  representativePhone: string | null;
  representativeEmail: string | null;
  safetyOfficerName: string | null;
  safetyOfficerPhone: string | null;
  prequalificationStatus: string;
  prequalificationScore: number | null;
  complianceDocuments: {
    documentType: string;
    documentNumber: string | null;
    validUpto: string | null;
    status: string;
  }[];
};

type Worker = {
  id: string;
  workerCode: string;
  fullName: string;
  primaryTrade: string;
  status: string;
  activeMobilizations: number;
};

function humanizeStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "conditionally_approved") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "not_applied") return "bg-slate-100 text-slate-600 border-slate-200";
  if (s === "suspended") return "bg-rose-100 text-rose-800 border-rose-200";
  if (s === "blacklisted") return "bg-rose-200 text-rose-900 border-rose-300";
  if (s === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function workerStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "suspended") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "blacklisted") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function docStatusIcon(status: string) {
  const s = status.toLowerCase();
  if (s === "valid" || s === "active") return <CheckCircle2 size={13} className="text-emerald-500" />;
  if (s === "expiring_soon" || s === "expiring") return <AlertTriangle size={13} className="text-amber-500" />;
  return <XCircle size={13} className="text-rose-500" />;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function tierInfo(score: number | null): { label: string; cls: string; barCls: string } {
  if (score === null) return { label: "Unrated", cls: "bg-slate-100 text-slate-600 border-slate-200", barCls: "bg-slate-300" };
  if (score >= 80) return { label: "Gold", cls: "bg-yellow-100 text-yellow-800 border-yellow-200", barCls: "bg-yellow-400" };
  if (score >= 60) return { label: "Silver", cls: "bg-slate-100 text-slate-700 border-slate-200", barCls: "bg-slate-400" };
  if (score >= 40) return { label: "Bronze", cls: "bg-orange-100 text-orange-800 border-orange-200", barCls: "bg-orange-400" };
  return { label: "Watch", cls: "bg-rose-100 text-rose-800 border-rose-200", barCls: "bg-rose-400" };
}

export default async function ContractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [contractorData, workersData] = await Promise.all([
    backendFetch<{ contractor: ContractorDetail } | ContractorDetail>(`/api/epc/contractors/${id}`).catch(() => null),
    backendFetch<{ workers: Worker[] }>(`/api/epc/workers?contractorCompanyId=${id}`).catch(() => null),
  ]);

  const contractor = contractorData
    ? ("contractor" in contractorData ? contractorData.contractor : contractorData)
    : null;
  const workers = workersData?.workers ?? [];

  if (!contractor) {
    return (
      <Card className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500 shadow-none">
        Contractor not found or failed to load.
      </Card>
    );
  }

  const tier = tierInfo(contractor.prequalificationScore);
  const docs = contractor.complianceDocuments ?? [];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center text-xs text-slate-500 mb-2 gap-1">
        <Link href="/epc" className="hover:text-cyan-700">EPC</Link>
        <span>/</span>
        <Link href="/epc/contractors" className="hover:text-cyan-700">Contractors</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{contractor.companyCode}</span>
      </div>

      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HardHat size={22} className="text-cyan-700" />
            {contractor.companyName}
          </h1>
          {contractor.tradeName && (
            <p className="text-sm text-slate-500 mt-0.5">Trade name: {contractor.tradeName}</p>
          )}
        </div>
        <Link href="/epc/contractors" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mt-1">
          <ArrowLeft size={14} /> Back
        </Link>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Left: Company identity */}
        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <FileText size={15} /> Company Identity
          </h2>
          <dl className="space-y-2.5 text-sm">
            <InfoRow label="Company Code" value={contractor.companyCode} />
            <InfoRow label="Registration No." value={contractor.registrationNumber ?? "—"} />
            <InfoRow label="PAN" value={contractor.panNumber ?? "—"} />
            <InfoRow label="GST" value={contractor.gstNumber ?? "—"} />
            <InfoRow label="Size Category" value={contractor.sizeCategory ? humanizeStatus(contractor.sizeCategory) : "—"} />
          </dl>

          <div className="mt-4 pt-4 border-t">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Representatives</h3>
            <dl className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Users size={13} className="text-slate-400 flex-shrink-0" />
                <span className="text-slate-600">{contractor.representativeName ?? "—"}</span>
              </div>
              {contractor.representativePhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={13} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-600">{contractor.representativePhone}</span>
                </div>
              )}
              {contractor.representativeEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={13} className="text-slate-400 flex-shrink-0" />
                  <span className="text-slate-600">{contractor.representativeEmail}</span>
                </div>
              )}
              {contractor.safetyOfficerName && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs text-slate-500 mb-1">Safety Officer</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Shield size={13} className="text-slate-400" />
                    <span className="text-slate-600">{contractor.safetyOfficerName}</span>
                    {contractor.safetyOfficerPhone && (
                      <span className="text-slate-500">{contractor.safetyOfficerPhone}</span>
                    )}
                  </div>
                </div>
              )}
            </dl>
          </div>

          {/* Trade categories */}
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Trade Categories</h3>
            <div className="flex flex-wrap gap-1.5">
              {(contractor.tradeCategories ?? []).map((t) => (
                <span key={t} className="rounded-full bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 text-[11px] font-medium text-cyan-700">
                  {t}
                </span>
              ))}
              {(contractor.tradeCategories ?? []).length === 0 && (
                <span className="text-xs text-slate-400">None specified</span>
              )}
            </div>
          </div>
        </Card>

        {/* Right: Prequalification */}
        <Card className="rounded-xl border bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Star size={15} /> Pre-Qualification Status
          </h2>

          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold ${statusBadgeClass(contractor.prequalificationStatus)}`}>
              {humanizeStatus(contractor.prequalificationStatus)}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold ${tier.cls}`}>
              <Star size={12} /> {tier.label}
            </span>
          </div>

          {contractor.prequalificationScore !== null ? (
            <div className="mb-6">
              <div className="flex items-end justify-between mb-1">
                <span className="text-xs text-slate-500">Prequalification Score</span>
                <span className="text-2xl font-bold tabular-nums text-slate-900">{contractor.prequalificationScore}<span className="text-sm font-normal text-slate-400">/100</span></span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${tier.barCls}`}
                  style={{ width: `${contractor.prequalificationScore}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Watch (&lt;40)</span>
                <span>Bronze (40–59)</span>
                <span>Silver (60–79)</span>
                <span>Gold (≥80)</span>
              </div>
            </div>
          ) : (
            <Card className="mb-6 rounded-lg bg-slate-50 border border-dashed p-4 text-center text-sm text-slate-500 shadow-none">
              No prequalification score assigned yet.
            </Card>
          )}
        </Card>
      </div>

      {/* Compliance Documents */}
      {docs.length > 0 && (
        <Card className="rounded-xl border bg-white shadow-sm overflow-hidden mb-6">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <FileText size={15} /> Compliance Documents
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Type</TableHead>
                <TableHead>Document No.</TableHead>
                <TableHead>Valid Upto</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-slate-900">{humanizeStatus(doc.documentType)}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">{doc.documentNumber ?? "—"}</TableCell>
                  <TableCell className="text-slate-600">{fmtDate(doc.validUpto)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs font-medium">
                      {docStatusIcon(doc.status)}
                      {humanizeStatus(doc.status)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Workers table */}
      <Card className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Users size={15} /> Workers ({workers.length})
          </h2>
          <Link href={`/epc/workers/new`} className="text-xs text-cyan-700 hover:underline">+ Register Worker</Link>
        </div>
        {workers.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            <Users size={32} className="mx-auto mb-2 text-slate-300" />
            No workers registered under this company.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Trade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Mobilizations</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono text-xs text-slate-500">{w.workerCode}</TableCell>
                  <TableCell className="font-medium text-slate-900">{w.fullName}</TableCell>
                  <TableCell className="text-slate-600">{w.primaryTrade}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${workerStatusClass(w.status)}`}>
                      {humanizeStatus(w.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-700">{w.activeMobilizations}</TableCell>
                  <TableCell>
                    <Link href={`/epc/workers/${w.id}`} className="text-xs text-cyan-700 hover:underline">View</Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-500 text-xs flex-shrink-0 w-36">{label}</dt>
      <dd className="text-slate-900 font-medium text-right break-all">{value}</dd>
    </div>
  );
}
