// Checklist completion rate — the one panel, rendered on two surfaces.
//
// The CAMS Compliance Snapshot (inside a Fire Safety engagement) and the
// Operations-side register panel both render THIS component against THIS
// payload, which comes from one backend aggregation. Two panels computing their
// own numbers would drift, and the first anyone notices is an auditor being
// shown 82% on one screen and 91% on another for the same asset.
//
// What differs between the two surfaces is the frame — heading, whether asset
// rows are listed, which permission got you here — not the arithmetic.
//
// "CANNOT BE COMPUTED" IS NOT ZERO
// --------------------------------
// `rate: null` means nothing was owed in the window: no assets, no applicable
// checklist, or a window before the register existed. It renders as "No data",
// never as 0%. A site with no fire assets has neither passed nor failed its fire
// compliance, and showing it a red 0% would send someone to fix a problem that
// does not exist — while showing 100% would hide one that does.

import { AlertTriangle, CheckCircle2, CircleDashed, HelpCircle } from "lucide-react";

export type Completion = {
  owed: number;
  completed: number;
  inProgress: number;
  missing: number;
  /** Null when nothing was owed. NEVER 0 for "no data". */
  rate: number | null;
  computable: boolean;
};

export type CompliancePayload = {
  window: { start: string; end: string };
  modules: string[];
  overall: Completion;
  byPlant: Record<string, Completion>;
  byAsset: Record<
    string,
    Completion & {
      equipmentCode?: string;
      location?: string;
      assetType?: string;
      plantId?: string;
    }
  >;
};

const BAND = [
  { min: 95, bg: "#ECFDF5", fg: "#047857", label: "On track" },
  { min: 85, bg: "#F7FEE7", fg: "#4D7C0F", label: "Slipping" },
  { min: 70, bg: "#FFFBEB", fg: "#B45309", label: "Behind" },
  { min: 0, bg: "#FEF2F2", fg: "#B91C1C", label: "Critical" },
];

function band(rate: number) {
  return BAND.find((b) => rate >= b.min) ?? BAND[BAND.length - 1];
}

function fmtWindow(w: { start: string; end: string }) {
  const d = (s: string) => s.split("-").reverse().join(".");
  return `${d(w.start)} – ${d(w.end)}`;
}

/** The headline figure. Deliberately a separate component from the rows so both
 *  surfaces show the same number in the same shape even when one of them omits
 *  the per-asset breakdown. */
export function CompletionHeadline({ c }: { c: Completion }) {
  if (!c.computable || c.rate === null) {
    return (
      <div className="flex items-center gap-2">
        <HelpCircle size={22} className="shrink-0 text-slate-400" />
        <div>
          <div className="text-[22px] font-semibold leading-none text-slate-400">No data</div>
          <div className="mt-1 text-[11px] text-slate-500">
            No checklist was due in this window — nothing to measure.
          </div>
        </div>
      </div>
    );
  }
  const b = band(c.rate);
  return (
    <div className="flex items-baseline gap-3">
      <div className="text-[28px] font-semibold leading-none" style={{ color: b.fg }}>
        {c.rate.toFixed(1)}%
      </div>
      <span
        className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
        style={{ background: b.bg, color: b.fg }}
      >
        {b.label}
      </span>
      <span className="text-[11.5px] text-slate-500">
        {c.completed} of {c.owed} due
      </span>
    </div>
  );
}

export function CompletionPanel({
  data,
  title = "Checklist compliance",
  subtitle,
  showAssets = true,
  maxAssets = 8,
  footer,
}: {
  data: CompliancePayload;
  title?: string;
  subtitle?: string;
  showAssets?: boolean;
  maxAssets?: number;
  footer?: React.ReactNode;
}) {
  const { overall } = data;
  // Worst first: a compliance panel is read to find what needs attention, and
  // an alphabetical list buries it. Assets with nothing owed sort last —
  // they are not failing, they are not applicable.
  const assets = Object.entries(data.byAsset)
    .sort((a, b) => (a[1].rate ?? 999) - (b[1].rate ?? 999))
    .slice(0, maxAssets);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-800">{title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {subtitle ?? `${data.modules.join(" + ")} checklists`} · {fmtWindow(data.window)}
          </p>
        </div>
        <CompletionHeadline c={overall} />
      </header>

      {overall.computable && (
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
          <Stat icon={<CheckCircle2 size={13} className="text-emerald-600" />} label="Completed" value={overall.completed} />
          <Stat icon={<CircleDashed size={13} className="text-amber-600" />} label="Started" value={overall.inProgress} />
          <Stat icon={<AlertTriangle size={13} className="text-rose-600" />} label="Never filled" value={overall.missing} />
        </div>
      )}

      {showAssets && assets.length > 0 && (
        <ul className="divide-y divide-slate-50">
          {assets.map(([id, a]) => (
            <li key={id} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium text-slate-700">
                  {a.equipmentCode ?? id}
                </div>
                <div className="truncate text-[10.5px] text-slate-500">{a.location ?? "—"}</div>
              </div>
              {a.rate === null ? (
                <span className="shrink-0 text-[11px] text-slate-400">No data</span>
              ) : (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ background: band(a.rate).bg, color: band(a.rate).fg }}
                  title={`${a.completed} of ${a.owed} due`}
                >
                  {a.rate.toFixed(0)}%
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {footer && <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">{footer}</div>}
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-slate-800">{value}</div>
    </div>
  );
}
