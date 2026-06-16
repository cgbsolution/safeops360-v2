import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { resolvePlantContext } from "@/lib/plant-context";
import type { Item } from "../../page";

export const dynamic = "force-dynamic";

type Detail = {
  type: {
    code: string;
    name: string;
    description: string;
    category: string;
    subcategory: string;
    serviceLifeYears: number;
    serviceLifeHours: number | null;
    applicableStandards: { standard: string; clause?: string; requirement?: string }[];
    minimumSpecification: string;
    controlsHazards: string[];
    enablesPermitTypes: string[];
    inspectionSchedule: { inspection_type: string; interval_days: number | null; third_party?: boolean }[];
    requiresCompetencyToUse: string | null;
    requiredTrainingPrograms: string[];
    requiresFitTest: boolean;
    isPersonalIssue: boolean;
    statutoryProvisionRequired: boolean;
    regulatoryReferences: { reference?: string; act?: string; section?: string }[];
  };
  items: (Item & { currentHolderUserId: string | null })[];
};

function fmt(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PpeCatalogDetail(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ plantId?: string }>;
}) {
  const { code } = await props.params;
  const sp = await props.searchParams;
  const { plantId } = await resolvePlantContext(sp.plantId);

  const detail = plantId
    ? await backendFetch<Detail>(`/api/ppe/catalog/${encodeURIComponent(code)}`, {
        query: { plantId },
      }).catch(() => null)
    : null;

  if (!detail) {
    return (
      <div>
        <PageHeader title="PPE Type" />
        <div className="rounded-xl border bg-white p-8 text-sm text-slate-600">
          PPE type not found or you don’t have access.
        </div>
      </div>
    );
  }

  const t = detail.type;
  const inService = detail.items.filter((i) =>
    ["in_stock", "issued", "under_inspection"].includes(i.status)
  ).length;
  const issued = detail.items.filter((i) => i.status === "issued").length;
  const blocked = detail.items.filter((i) => i.validity === "block").length;

  return (
    <div>
      <Link
        href={`/ppe?plantId=${plantId}&tab=catalog`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-cyan-700 hover:underline"
      >
        <ChevronLeft size={14} /> Back to Catalog
      </Link>
      <PageHeader title={t.name} description={`${t.code} · ${t.category.replace(/_/g, " ")}`} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column — specification */}
        <div className="space-y-5 lg:col-span-1">
          <Card title="Specification">
            {t.description && <p className="mb-2 text-sm text-slate-600">{t.description}</p>}
            <Row k="Category" v={t.category.replace(/_/g, " ")} />
            {t.subcategory && <Row k="Subcategory" v={t.subcategory.replace(/_/g, " ")} />}
            <Row k="Service life" v={`${t.serviceLifeYears} years${t.serviceLifeHours ? ` / ${t.serviceLifeHours}h` : ""}`} />
            <Row k="Personal issue" v={t.isPersonalIssue ? "Yes" : "No"} />
            <Row k="Statutory provision" v={t.statutoryProvisionRequired ? "Yes" : "No"} />
            {t.requiresFitTest && <Row k="Fit test" v="Required" />}
            {t.requiresCompetencyToUse && <Row k="Competency" v={t.requiresCompetencyToUse} />}
            {t.minimumSpecification && <Row k="Min. spec" v={t.minimumSpecification} />}
          </Card>

          {t.applicableStandards.length > 0 && (
            <Card title="Standards">
              <ul className="space-y-1 text-sm text-slate-700">
                {t.applicableStandards.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium">{s.standard}</span>
                    {s.requirement && <span className="text-slate-500"> — {s.requirement}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {t.enablesPermitTypes.length > 0 && (
            <Card title="Enables permit types">
              <div className="flex flex-wrap gap-1.5">
                {t.enablesPermitTypes.map((p) => (
                  <span key={p} className="rounded bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-700">
                    {p.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Crew on these permits must hold this PPE (or a variant) before the permit can activate.
              </p>
            </Card>
          )}

          {t.inspectionSchedule.length > 0 && (
            <Card title="Inspection schedule">
              {t.inspectionSchedule.map((s, i) => (
                <Row
                  key={i}
                  k={s.inspection_type.replace(/_/g, " ")}
                  v={s.interval_days ? `every ${s.interval_days}d${s.third_party ? " · third-party" : ""}` : "before each use"}
                />
              ))}
            </Card>
          )}
        </div>

        {/* Right column — items at this plant */}
        <div className="space-y-5 lg:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="In service" value={inService} />
            <Stat label="Issued" value={issued} />
            <Stat label="Blocked" value={blocked} tone={blocked > 0 ? "bad" : "ok"} />
          </div>

          <Card title={`Items at this plant (${detail.items.length})`}>
            {detail.items.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                No items of this type at this plant yet. Use “Add Item” on the PPE page to commission stock.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-1 text-left">Item</th>
                    <th className="py-1 text-left">Serial</th>
                    <th className="py-1 text-left">Status</th>
                    <th className="py-1 text-left">Validity</th>
                    <th className="py-1 text-left">Next inspection</th>
                    <th className="py-1 text-left">Life left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.items.map((i) => (
                    <tr key={i.id}>
                      <td className="py-1.5">
                        <Link href={`/ppe/items/${i.id}`} className="font-medium text-cyan-700 hover:underline">
                          {i.itemNumber}
                        </Link>
                      </td>
                      <td className="py-1.5 font-mono text-xs text-slate-500">{i.serialNumber}</td>
                      <td className="py-1.5 capitalize text-slate-600">{i.status.replace(/_/g, " ")}</td>
                      <td className="py-1.5">
                        <span
                          className={
                            i.validity === "pass"
                              ? "text-emerald-700"
                              : i.validity === "warn"
                                ? "text-amber-700"
                                : "text-rose-700"
                          }
                        >
                          {i.validityReason}
                        </span>
                      </td>
                      <td className="py-1.5 text-slate-600">{fmt(i.nextInspectionDueDate)}</td>
                      <td className="py-1.5 text-slate-600">
                        {i.serviceLifeExceeded ? (
                          <span className="text-rose-600">exceeded</span>
                        ) : (
                          `${i.serviceLifeRemainingDays}d`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
      <span className="text-right font-medium capitalize text-slate-800">{v}</span>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-2xl font-semibold ${tone === "bad" ? "text-rose-600" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}
