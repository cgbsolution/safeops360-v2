import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { PlantSwitcher } from "@/components/plant-switcher";
import { resolvePlantContext } from "@/lib/plant-context";
import { ScrollText, ArrowRight, Activity } from "lucide-react";
import { ScrSyncButton } from "./sync-button";

export const dynamic = "force-dynamic";

type RegisterRow = {
  registerCode: string;
  registerName: string;
  legalAct: string;
  sectionRule: string | null;
  sourceModule: string;
  submissionFrequency: string;
  submissionAuthority: string | null;
  complianceStatus: string;
  entryCount: number;
  lastEntryDate: string | null;
};

type Dashboard = {
  plantId: string;
  complianceHealth: number;
  registerCount: number;
  totalEntries: number;
  registers: RegisterRow[];
  activityFeed: {
    registerName: string;
    sourceRef: string | null;
    sourceModule: string;
    entryDate: string | null;
    createdAt: string | null;
  }[];
};

const STATUS_PILL: Record<string, string> = {
  COMPLIANT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  AT_RISK: "bg-amber-100 text-amber-800 border-amber-200",
  NON_COMPLIANT: "bg-rose-100 text-rose-800 border-rose-200"
};

export default async function ComplianceDashboardPage(props: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const sp = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(sp.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader title="Statutory Compliance Register" description="Auto-populated statutory registers — single source of truth for legally mandated registers." />
        <div className="rounded-xl border bg-white p-8 text-sm text-slate-600">Select a plant to view its registers.</div>
      </div>
    );
  }

  const data = await backendFetch<Dashboard>("/api/scr/dashboard", { query: { plantId } }).catch(
    () =>
      ({ plantId, complianceHealth: 0, registerCount: 0, totalEntries: 0, registers: [], activityFeed: [] }) as Dashboard
  );

  const healthTone =
    data.complianceHealth >= 90 ? "text-emerald-700" : data.complianceHealth >= 70 ? "text-amber-700" : "text-rose-700";

  return (
    <div>
      <PageHeader
        title="Statutory Compliance Register"
        description="Always-current statutory registers, auto-populated from source modules. Export inspection-ready forms on demand."
        breadcrumbs={[{ label: "Risk Management" }, { label: "Statutory Registers" }]}
        action={
          <div className="flex items-center gap-2">
            <ScrSyncButton plantId={plantId} />
            <PlantSwitcher plants={plants} currentPlantId={plantId} />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">Compliance health</div>
          <div className={`text-3xl font-bold mt-1 ${healthTone}`}>{data.complianceHealth}%</div>
        </div>
        <Stat label="Registers" value={data.registerCount} />
        <Stat label="Total entries" value={data.totalEntries} />
        <Stat label="Sources feeding" value={new Set(data.registers.map((r) => r.sourceModule)).size} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">Register status</h2>
          {data.registers.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white py-12 text-center">
              <ScrollText className="mx-auto text-slate-300 mb-2" size={32} />
              <div className="text-sm text-slate-600 font-medium">No registers populated yet</div>
              <div className="text-xs text-slate-500 mt-1">
                Click <strong>Sync from sources</strong> to auto-populate registers from your existing records.
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.registers.map((r) => (
                <Link
                  key={r.registerCode}
                  href={`/compliance/${r.registerCode}?plantId=${plantId}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-primary-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{r.registerName}</span>
                        <span className={`text-[10px] rounded border px-1.5 py-0.5 ${STATUS_PILL[r.complianceStatus] ?? STATUS_PILL.COMPLIANT}`}>
                          {r.complianceStatus.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {r.legalAct}{r.sectionRule ? ` · ${r.sectionRule}` : ""} · fed by{" "}
                        <span className="font-medium text-slate-600">{r.sourceModule}</span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-slate-300 mt-1 shrink-0" />
                  </div>
                  <div className="mt-2.5 flex items-center gap-4 text-xs text-slate-600">
                    <span><span className="font-semibold text-slate-900">{r.entryCount}</span> entries</span>
                    <span className="text-slate-400">·</span>
                    <span>Submission: {r.submissionFrequency.replace(/_/g, " ").toLowerCase()}</span>
                    {r.lastEntryDate && (
                      <>
                        <span className="text-slate-400">·</span>
                        <span>last entry {new Date(r.lastEntryDate).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
            <Activity size={14} className="text-primary-600" /> Recent auto-entries
          </h2>
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {data.activityFeed.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">No entries yet.</div>
            ) : (
              data.activityFeed.map((a, i) => (
                <div key={i} className="px-3 py-2 text-xs">
                  <div className="font-mono text-primary-700">{a.sourceRef ?? a.sourceModule}</div>
                  <div className="text-slate-500 mt-0.5 line-clamp-1">{a.registerName}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {a.entryDate ? new Date(a.entryDate).toLocaleDateString() : "—"} · {a.sourceModule}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-3xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
