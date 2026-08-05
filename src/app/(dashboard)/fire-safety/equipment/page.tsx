import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

type Eq = {
  id: string; equipmentCode: string; type: string; location: string; buildingId: string | null;
  status: string; capacitySpec: string | null; lastInspectionDate: string | null; nextInspectionDueDate: string | null;
};
type Resp = { items: Eq[]; total: number };

const STATUS_CHIP: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DUE_INSPECTION: "bg-amber-100 text-amber-800 border-amber-200",
  OVERDUE: "bg-rose-100 text-rose-800 border-rose-200",
  OUT_OF_SERVICE: "bg-slate-200 text-slate-700 border-slate-300",
  DECOMMISSIONED: "bg-slate-100 text-slate-500 border-slate-200",
};

export default async function FireEquipmentPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = (await props.searchParams) ?? {};
  const query: Record<string, string> = {};
  if (sp.status) query.status = sp.status;
  if (sp.type) query.type = sp.type;
  if (sp.dueOnly) query.dueOnly = "true";
  let data: Resp = { items: [], total: 0 };
  let error: string | null = null;
  try {
    data = await backendFetch<Resp>("/api/fire/equipment", { query });
  } catch (e: any) {
    error = e?.message ?? "Failed to load equipment";
  }

  const STATUSES = ["ACTIVE", "DUE_INSPECTION", "OVERDUE", "OUT_OF_SERVICE"];
  const chip = (val: string) => {
    const next = new URLSearchParams(sp as Record<string, string>);
    if (next.get("status") === val) next.delete("status"); else next.set("status", val);
    const active = sp.status === val;
    return (
      <a key={val} href={`/fire-safety/equipment?${next.toString()}`}
        className={"rounded-full border px-2.5 py-0.5 text-[11px] font-medium " + (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}>
        {val.replace(/_/g, " ")}
      </a>
    );
  };

  return (
    <div>
      <PageHeader title="Fire Equipment Register"
        breadcrumbs={[{ label: "Operational Safety" }, { label: "Fire Safety", href: "/fire-safety" }, { label: "Equipment" }]}
        description="Every extinguisher, hydrant, hose reel, detector and panel — with inspection due-dates and live status. Inspections run on the CAMS audit engine." />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
            {STATUSES.map(chip)}
            <a href={`/api/fire/equipment-due?days=30`} className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-400">Due-this-month report</a>
            <span className="text-xs text-slate-500">{data.total} item(s)</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">Capacity</th><th className="px-3 py-2.5">Last</th><th className="px-3 py-2.5">Next Due</th><th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-400">No equipment matches the filter.</td></tr>
                ) : data.items.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 font-medium text-primary-700">{e.equipmentCode}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{e.type.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{e.location}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{e.capacitySpec ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{e.lastInspectionDate ? new Date(e.lastInspectionDate).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-slate-600">{e.nextInspectionDueDate ? new Date(e.nextInspectionDueDate).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-3 py-2.5"><span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (STATUS_CHIP[e.status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>{e.status.replace(/_/g, " ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
