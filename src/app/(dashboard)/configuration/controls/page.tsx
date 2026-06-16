import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const HIERARCHY_ORDER = ["ELIMINATION", "SUBSTITUTION", "ENGINEERING", "ADMINISTRATIVE", "PPE"];
const HIERARCHY_COLOR: Record<string, string> = {
  ELIMINATION: "bg-emerald-100 text-emerald-800 border-emerald-300",
  SUBSTITUTION: "bg-teal-100 text-teal-800 border-teal-300",
  ENGINEERING: "bg-blue-100 text-blue-800 border-blue-300",
  ADMINISTRATIVE: "bg-amber-100 text-amber-800 border-amber-300",
  PPE: "bg-rose-100 text-rose-800 border-rose-300"
};

const HIERARCHY_DESCRIPTION: Record<string, string> = {
  ELIMINATION: "Remove the hazard entirely. Highest-tier control — preferred whenever feasible.",
  SUBSTITUTION: "Replace the hazardous material / process with a less hazardous one.",
  ENGINEERING: "Physical barriers, isolation, ventilation. Independent of human compliance.",
  ADMINISTRATIVE: "Procedures, training, signage. Reduces exposure but relies on people doing the right thing.",
  PPE: "Personal protective equipment. Last-line defence; protects the wearer only."
};

type Control = {
  id: string;
  code: string;
  hierarchy: string;
  description: string;
  verificationMethod: string | null;
  verificationFrequency: string | null;
  isGlobal: boolean;
};

export default async function ControlsAdminPage() {
  await requirePermission("HIRA.LIBRARY_MANAGE");
  const controls = await backendFetch<Control[]>("/api/hira/controls");

  const byHierarchy = new Map<string, Control[]>();
  for (const h of HIERARCHY_ORDER) byHierarchy.set(h, []);
  for (const c of controls) {
    if (!byHierarchy.has(c.hierarchy)) byHierarchy.set(c.hierarchy, []);
    byHierarchy.get(c.hierarchy)!.push(c);
  }

  return (
    <div>
      <PageHeader
        title="Control Library"
        description="Reusable controls organised by the hierarchy of controls. HIRA entries draw from this library to maintain consistency across the register."
      />

      <div className="rounded-xl border bg-slate-50 border-slate-200 p-4 mb-4 text-sm text-slate-700">
        <div className="font-medium">Hierarchy of Controls</div>
        <div className="mt-1 text-xs">
          When assessing a hazard, the team considers controls from top to bottom. Higher-tier controls (elimination, substitution)
          remove or reduce the hazard at source; lower-tier (administrative, PPE) rely on human compliance.
        </div>
      </div>

      <div className="space-y-4">
        {HIERARCHY_ORDER.map((h) => {
          const items = byHierarchy.get(h) ?? [];
          return (
            <div key={h} className="rounded-xl border bg-white overflow-hidden">
              <div className={`px-4 py-3 border-b ${HIERARCHY_COLOR[h]?.replace("bg-", "bg-opacity-30 bg-") ?? ""}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${HIERARCHY_COLOR[h]}`}>
                    {h}
                  </span>
                  <span className="text-sm text-slate-500">{items.length} controls</span>
                </div>
                <div className="text-xs text-slate-600 mt-1.5">{HIERARCHY_DESCRIPTION[h]}</div>
              </div>
              {items.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-500 italic">No controls in this tier yet.</div>
              ) : (
                <ul className="divide-y">
                  {items.map((c) => (
                    <li key={c.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-900">{c.description}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{c.code}</div>
                        </div>
                        {c.isGlobal && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 flex-shrink-0">
                            global
                          </span>
                        )}
                      </div>
                      {(c.verificationMethod || c.verificationFrequency) && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {c.verificationMethod && (
                            <div>
                              <span className="text-slate-500">Verification: </span>
                              <span className="text-slate-700">{c.verificationMethod}</span>
                            </div>
                          )}
                          {c.verificationFrequency && (
                            <div>
                              <span className="text-slate-500">Frequency: </span>
                              <span className="text-slate-700">{c.verificationFrequency}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
