import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { Item } from "../../page";

export const dynamic = "force-dynamic";

type Detail = {
  item: Item & { manufacturer: string; batchLotNumber: string; manufactureDate: string | null; commissionedAt: string | null; versionNumber: number };
  holderName: string | null;
  stateHistory: { from_status: string; to_status: string; changed_at: string; changed_by_user_id: string; reason: string }[];
  type: {
    code: string; name: string; category: string | null; serviceLifeYears: number | null;
    applicableStandards: { standard: string; clause: string }[]; requiresCompetencyToUse: string | null;
    inspectionSchedule: { inspection_type: string; interval_days: number | null }[];
  } | null;
  issuances: { id: string; issuanceNumber: string; issuedToName: string; issuedByName: string; issuedAt: string | null; purpose: string; status: string; returnedAt: string | null; conditionAtIssuance: string; conditionAtReturn: string | null }[];
  inspections: { id: string; inspectionType: string; trigger: string; conductedAt: string | null; inspectorName: string; overallResult: string; defectsFound: { defect_description: string; severity: string }[]; itemStatusAfterInspection: string }[];
};

function fmt(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PpeItemDetail(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const detail = await backendFetch<Detail>(`/api/ppe/items/${id}`).catch(() => null);

  if (!detail) {
    return (
      <div>
        <PageHeader title="PPE Item" />
        <div className="rounded-xl border bg-white p-8 text-sm text-slate-600">Item not found or you don’t have access.</div>
      </div>
    );
  }

  const it = detail.item;
  const lifePct = it.serviceLifeExceeded ? 100 : Math.max(0, Math.min(100, 100 - (it.serviceLifeRemainingDays / Math.max(1, (detail.type?.serviceLifeYears ?? 5) * 365)) * 100));

  return (
    <div>
      <Link href="/ppe" className="mb-3 inline-flex items-center gap-1 text-sm text-cyan-700 hover:underline">
        <ChevronLeft size={14} /> Back to PPE Management
      </Link>
      <PageHeader
        title={it.itemNumber}
        description={`${it.ppeTypeName} · Serial ${it.serialNumber}`}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-1">
          <Card title="Identity">
            <Row k="Type" v={`${it.ppeTypeName} (${it.ppeTypeCode})`} />
            <Row k="Manufacturer" v={it.manufacturer || "—"} />
            <Row k="Batch / lot" v={it.batchLotNumber || "—"} />
            <Row k="Manufactured" v={fmt(it.manufactureDate)} />
            <Row k="Commissioned" v={fmt(it.commissionedAt)} />
            <Row k="Status" v={it.status.replace(/_/g, " ")} />
            <Row k="Condition" v={it.condition.replace(/_/g, " ")} />
            {detail.holderName && <Row k="Current holder" v={detail.holderName} />}
            <Row k="Version" v={`v${it.versionNumber}`} />
          </Card>

          <Card title="Service life">
            <div className="mb-2 flex justify-between text-xs text-slate-500">
              <span>Commissioned</span><span>{fmt(it.serviceLifeEndDate)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className={it.serviceLifeExceeded ? "h-full bg-rose-500" : it.serviceLifeRemainingDays <= 90 ? "h-full bg-amber-400" : "h-full bg-emerald-500"} style={{ width: `${lifePct}%` }} />
            </div>
            <div className="mt-2 text-xs font-medium text-slate-600">
              {it.serviceLifeExceeded ? <span className="text-rose-600">Service life exceeded</span> : `${it.serviceLifeRemainingDays} days remaining`}
            </div>
          </Card>

          {detail.type && (
            <Card title="Specification">
              <Row k="Category" v={(detail.type.category ?? "").replace(/_/g, " ")} />
              <Row k="Service life" v={`${detail.type.serviceLifeYears ?? "—"} years`} />
              {detail.type.requiresCompetencyToUse && <Row k="Competency" v={detail.type.requiresCompetencyToUse} />}
              {detail.type.applicableStandards.length > 0 && <Row k="Standards" v={detail.type.applicableStandards.map((s) => s.standard).join(", ")} />}
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5 lg:col-span-2">
          <Card title="Inspection history">
            {detail.inspections.length === 0 ? <Muted>No inspections recorded.</Muted> : (
              <Table className="w-full text-sm">
                <TableHeader className="text-[10px] uppercase tracking-wider text-slate-400">
                  <TableRow><TableHead className="py-1 text-left">Date</TableHead><TableHead className="py-1 text-left">Type</TableHead><TableHead className="py-1 text-left">Inspector</TableHead><TableHead className="py-1 text-left">Result</TableHead><TableHead className="py-1 text-left">Outcome</TableHead></TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {detail.inspections.map((ins) => (
                    <TableRow key={ins.id}>
                      <TableCell className="py-1.5 text-slate-600">{fmt(ins.conductedAt)}</TableCell>
                      <TableCell className="py-1.5 text-slate-600 capitalize">{ins.inspectionType.replace(/_/g, " ")}</TableCell>
                      <TableCell className="py-1.5 text-slate-600">{ins.inspectorName}</TableCell>
                      <TableCell className="py-1.5">
                        <span className={ins.overallResult === "pass" ? "text-emerald-700" : ins.overallResult === "fail" ? "text-rose-700" : "text-amber-700"}>{ins.overallResult.replace(/_/g, " ")}</span>
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-slate-500 capitalize">{ins.itemStatusAfterInspection.replace(/_/g, " ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card title="Issuance history">
            {detail.issuances.length === 0 ? <Muted>Never issued.</Muted> : (
              <Table className="w-full text-sm">
                <TableHeader className="text-[10px] uppercase tracking-wider text-slate-400">
                  <TableRow><TableHead className="py-1 text-left">Issuance</TableHead><TableHead className="py-1 text-left">Holder</TableHead><TableHead className="py-1 text-left">Issued</TableHead><TableHead className="py-1 text-left">Returned</TableHead><TableHead className="py-1 text-left">Status</TableHead></TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {detail.issuances.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="py-1.5 font-medium text-slate-700">{i.issuanceNumber}</TableCell>
                      <TableCell className="py-1.5 text-slate-600">{i.issuedToName}</TableCell>
                      <TableCell className="py-1.5 text-slate-600">{fmt(i.issuedAt)}</TableCell>
                      <TableCell className="py-1.5 text-slate-600">{fmt(i.returnedAt)}</TableCell>
                      <TableCell className="py-1.5 text-xs capitalize text-slate-500">{i.status.replace(/_/g, " ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card title="Audit trail">
            <ol className="relative space-y-3 border-l border-slate-200 pl-4">
              {detail.stateHistory.map((h, idx) => (
                <li key={idx} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-cyan-600 ring-2 ring-white" />
                  <div className="text-sm text-slate-800">
                    <span className="capitalize">{h.from_status.replace(/_/g, " ")}</span> → <span className="font-medium capitalize">{h.to_status.replace(/_/g, " ")}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{fmt(h.changed_at)} · {h.reason}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b px-4 py-2.5 text-sm font-semibold text-slate-800">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-slate-500">{k}</span>
      <span className="text-right font-medium text-slate-800">{v}</span>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div className="py-4 text-center text-sm text-slate-400">{children}</div>;
}
