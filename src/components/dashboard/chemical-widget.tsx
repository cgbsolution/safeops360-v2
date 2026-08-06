// Screen 8 — Command Centre widget (§7 #8).
//
// Interactive/clickable per the spec: every number is a link into the screen
// that lets you act on it. A dashboard tile you cannot drill into is a number,
// not a tool — and this module's whole premise is that information nobody acts
// on is the same as information nobody has.
//
// Server component. Drop into the Command Centre grid:
//   <ChemicalWidget />
// It fails soft on its own — one module's backend being unreachable must not
// blank the whole Command Centre — but it says so rather than rendering zeros,
// because a widget showing "0 failed triggers" when it could not load is
// exactly the false reassurance this module exists to eliminate.

import Link from "next/link";
import { AlertTriangle, FlaskConical, FileWarning, Layers } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import type { ChemicalDashboard } from "@/lib/chemicals/types";
import { fmtQty } from "@/lib/chemicals/types";

function Row({
  href,
  icon,
  label,
  value,
  tone,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "critical" | "warn" | "neutral";
  detail?: string;
}) {
  const color =
    tone === "critical" && value > 0 ? "text-rose-600"
    : tone === "warn" && value > 0 ? "text-amber-600"
    : "text-slate-400";
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50"
    >
      <span className={color}>{icon}</span>
      <span className="flex-1">
        <span className="block text-sm text-slate-700">{label}</span>
        {detail && <span className="block text-[11px] text-slate-400">{detail}</span>}
      </span>
      <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
    </Link>
  );
}

export async function ChemicalWidget({ plantId }: { plantId?: string }) {
  let d: ChemicalDashboard | null = null;
  let error: string | null = null;
  try {
    d = await backendFetch<ChemicalDashboard>(
      `/api/chemicals/dashboard${plantId ? `?plantId=${plantId}` : ""}`
    );
  } catch (e: any) {
    error = e?.message ?? "unavailable";
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FlaskConical size={15} className="text-slate-400" />
          Chemical & Hazmat
        </h3>
        <Link href="/chemicals" className="text-[11px] font-medium text-slate-500 hover:text-slate-800">
          Open →
        </Link>
      </div>

      {error || !d ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700">
          Could not load chemical signals ({error}). This is a load failure — do not read it as
          &ldquo;nothing outstanding&rdquo;.
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100">
            <Row
              href="/chemicals/trigger-log?status=FAILED"
              icon={<AlertTriangle size={16} />}
              label="Failed MOC triggers"
              detail="obligation not raised — needs manual action"
              value={d.failedTriggers.count}
              tone="critical"
            />
            <Row
              href="/chemicals/thresholds"
              icon={<Layers size={16} />}
              label="Thresholds breached"
              detail="statutory obligation engaged"
              value={d.thresholds.breached}
              tone="critical"
            />
            <Row
              href="/chemicals/thresholds"
              icon={<Layers size={16} />}
              label="Approaching threshold"
              detail="still avoidable"
              value={d.thresholds.approaching}
              tone="warn"
            />
            <Row
              href="/chemicals?sdsOverdue=1"
              icon={<FileWarning size={16} />}
              label="SDS reviews overdue"
              detail="chemical stays usable — compliance signal only"
              value={d.sdsOverdue.count}
              tone="warn"
            />
            <Row
              href="/chemicals/storage"
              icon={<AlertTriangle size={16} />}
              label="Co-storage overrides"
              detail="accepted risk awaiting review"
              value={d.pendingStorageOverrides}
              tone="warn"
            />
          </div>

          {/* The single most urgent item, spelled out. A count tells you there is
              a problem; this tells you which one to open first. */}
          {d.failedTriggers.items[0] && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5">
              <div className="text-[11px] font-semibold text-rose-800">
                Most recent failure — {d.failedTriggers.items[0].scheduleReference ?? "threshold trigger"}
              </div>
              <div className="mt-0.5 text-[11px] text-rose-700">
                {d.failedTriggers.items[0].failureReason}
              </div>
            </div>
          )}
          {!d.failedTriggers.items.length && d.thresholds.items[0] && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <div className="text-[11px] font-semibold text-slate-700">
                Closest to a limit — {d.thresholds.items[0].scheduleReference}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {fmtQty(d.thresholds.items[0].currentQuantity, d.thresholds.items[0].unit)} of{" "}
                {fmtQty(d.thresholds.items[0].thresholdQuantity, d.thresholds.items[0].unit)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ChemicalWidget;
