"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { BandBadge } from "@/components/erm/shared";
import {
  BREACH_STATUS_CHIP,
  KRI_STATUS_CHIP,
  KRI_STATUS_HEX,
  type KriBreach,
  type KriDetail,
  type Reading,
} from "@/app/(dashboard)/erm/lib-p2";
import { fmtDate } from "@/app/(dashboard)/erm/lib";

const FEED_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  MODULE_FED: "Module-fed",
  API: "API",
};

function StatusChip({ status, sm }: { status: string; sm?: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center rounded border font-semibold " +
        (sm ? "px-1.5 py-0.5 text-[10px] " : "px-2 py-0.5 text-[11px] ") +
        (KRI_STATUS_CHIP[status] ?? KRI_STATUS_CHIP.NO_DATA)
      }
    >
      {status === "NO_DATA" ? "NO DATA" : status}
    </span>
  );
}

export function KriDetailView({ kri }: { kri: KriDetail }) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "reading" | { ack: KriBreach }>(null);

  const higherIsWorse = kri.direction === "HIGHER_IS_WORSE";

  // Readings ascending by period for the trend chart.
  const asc = useMemo(
    () => [...kri.readings].sort((a, b) => a.periodLabel.localeCompare(b.periodLabel)),
    [kri.readings],
  );
  const chartData = asc.map((r) => ({ period: r.periodLabel, value: r.value, status: r.status }));

  // Y-domain from readings + thresholds, padded.
  const { yMin, yMax } = useMemo(() => {
    const vals = asc.map((r) => r.value);
    const all = [...vals, kri.thresholdGreen, kri.thresholdAmber];
    let lo = all.length ? Math.min(...all) : 0;
    let hi = all.length ? Math.max(...all) : 1;
    if (lo === hi) {
      hi = lo + 1;
      lo = lo - 1;
    }
    const pad = (hi - lo) * 0.1 || 1;
    return { yMin: lo - pad, yMax: hi + pad };
  }, [asc, kri.thresholdGreen, kri.thresholdAmber]);

  // Threshold zone bands (ReferenceArea) derived from green/amber + direction.
  // HIGHER_IS_WORSE: green = [min, tG], amber = (tG, tA], red = (tA, max]
  // LOWER_IS_WORSE:  green = [tG, max], amber = [tA, tG), red = [min, tA)
  const zones = useMemo(() => {
    const g = kri.thresholdGreen;
    const a = kri.thresholdAmber;
    if (higherIsWorse) {
      return [
        { y1: yMin, y2: g, fill: KRI_STATUS_HEX.GREEN },
        { y1: g, y2: a, fill: KRI_STATUS_HEX.AMBER },
        { y1: a, y2: yMax, fill: KRI_STATUS_HEX.RED },
      ];
    }
    return [
      { y1: g, y2: yMax, fill: KRI_STATUS_HEX.GREEN },
      { y1: a, y2: g, fill: KRI_STATUS_HEX.AMBER },
      { y1: yMin, y2: a, fill: KRI_STATUS_HEX.RED },
    ];
  }, [higherIsWorse, kri.thresholdGreen, kri.thresholdAmber, yMin, yMax]);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {kri.kriCode}
              </span>
              <h1 className="text-lg font-bold text-slate-900">{kri.name}</h1>
              <StatusChip status={kri.currentStatus} />
              {kri.categoryName && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ backgroundColor: kri.categoryColor ?? "#64748b" }}
                >
                  {kri.categoryName}
                </span>
              )}
            </div>
            {kri.description && <p className="mt-1 text-sm text-slate-600">{kri.description}</p>}
            <p className="mt-1 text-xs text-slate-500">
              Owner <b>{kri.ownerName ?? "—"}</b> · Direction{" "}
              {higherIsWorse ? "Higher is worse" : "Lower is worse"} · Frequency {kri.frequency}
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {FEED_LABEL[kri.feedType] ?? kri.feedType}
              </span>
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-3xl font-bold tabular-nums text-slate-900">
                {kri.currentValue != null ? kri.currentValue : "—"}
              </span>
              {kri.unit && <span className="text-sm text-slate-400">{kri.unit}</span>}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              green ≤ {kri.thresholdGreen} · amber ≤ {kri.thresholdAmber}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <Button onClick={() => setModal("reading")}>
            Enter reading
          </Button>
        </div>
      </div>

      {/* Trend chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Trend vs thresholds</h2>
        {chartData.length === 0 ? (
          <p className="py-12 text-center text-xs text-slate-400">No readings yet — enter one to build the trend.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ left: -10, right: 12, top: 8 }}>
              {zones.map((z, i) => (
                <ReferenceArea
                  key={i}
                  y1={z.y1}
                  y2={z.y2}
                  fill={z.fill}
                  fillOpacity={0.1}
                  ifOverflow="extendDomain"
                  strokeOpacity={0}
                />
              ))}
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#64748b" />
              <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#1f2937"
                strokeWidth={2}
                dot={{ r: 3 }}
                name={kri.unit || "value"}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Shaded bands are the traffic-light thresholds (green / amber / red) for this {higherIsWorse ? "higher-is-worse" : "lower-is-worse"} KRI.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Readings table */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Readings</h2>
          {kri.readings.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No readings recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...kri.readings]
                    .sort((a, b) => b.periodLabel.localeCompare(a.periodLabel))
                    .map((r: Reading) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.periodLabel}
                          {r.isCurrent && (
                            <span className="ml-1 rounded bg-primary-50 px-1 text-[9px] font-semibold text-primary-700">
                              CURRENT
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums font-semibold">{r.value}</TableCell>
                        <TableCell>
                          <StatusChip status={r.status} sm />
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{r.source}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-slate-500">{r.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Linked risks */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Linked risks</h2>
          {kri.linkedRisks.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No linked risks.</p>
          ) : (
            <ul className="space-y-2">
              {kri.linkedRisks.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="min-w-0">
                    <Link
                      href={`/erm/register/${r.id}`}
                      className="block truncate text-xs font-medium text-primary-700 hover:underline"
                    >
                      {r.riskCode}
                    </Link>
                    <span className="block truncate text-[11px] text-slate-500">{r.title}</span>
                  </div>
                  <BandBadge band={r.residualBand} score={r.residualScore} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Breach history */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Breach history</h2>
        {kri.breaches.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No breaches recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acknowledged by</TableHead>
                  <TableHead>Resolution notes</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kri.breaches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <span
                        className={
                          "rounded border px-2 py-0.5 text-[11px] font-medium " +
                          (b.breachType === "RED"
                            ? KRI_STATUS_CHIP.RED
                            : b.breachType === "AMBER"
                              ? KRI_STATUS_CHIP.AMBER
                              : "bg-slate-100 text-slate-600 border-slate-200")
                        }
                      >
                        {b.breachType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          "rounded border px-2 py-0.5 text-[11px] font-medium " +
                          (BREACH_STATUS_CHIP[b.status] ?? "bg-slate-100 text-slate-600 border-slate-200")
                        }
                      >
                        {b.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {b.acknowledgedByName ?? "—"}
                      {b.acknowledgedAt && (
                        <span className="ml-1 text-[10px] text-slate-400">{fmtDate(b.acknowledgedAt)}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-slate-500">
                      {b.resolutionNotes || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{fmtDate(b.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {b.status === "OPEN" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setModal({ ack: b })}
                          className="text-slate-700 hover:border-primary-500"
                        >
                          Acknowledge
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {modal === "reading" && (
        <ReadingModal
          kriId={kri.id}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {modal && typeof modal === "object" && "ack" in modal && (
        <AckModal
          kriId={kri.id}
          breach={modal.ack}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ReadingModal({ kriId, onClose, onDone }: { kriId: string; onClose: () => void; onDone: () => void }) {
  const [periodLabel, setPeriodLabel] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const body: any = { periodLabel, value: Number(value), notes };
    if (periodEnd) body.periodEnd = periodEnd;
    const res = await fetch(`/api/erm/kris/${kriId}/readings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.detail || j.error || `Failed (${res.status})`);
      return;
    }
    onDone();
  }

  return (
    <Modal title="Enter reading" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Period label (required)</label>
          <Input
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="e.g. 2026-06"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Period end (optional)</label>
          <Input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Value (required)</label>
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
        <Button
          type="button"
          disabled={busy || !periodLabel.trim() || value === ""}
          onClick={submit}
          className="w-full"
        >
          {busy ? "Saving…" : "Save reading"}
        </Button>
      </div>
    </Modal>
  );
}

function AckModal({
  kriId,
  breach,
  onClose,
  onDone,
}: {
  kriId: string;
  breach: KriBreach;
  onClose: () => void;
  onDone: () => void;
}) {
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolve, setResolve] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await fetch(`/api/erm/kris/${kriId}/breaches/${breach.id}/ack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolutionNotes, resolve }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.detail || j.error || `Failed (${res.status})`);
      return;
    }
    onDone();
  }

  return (
    <Modal title={`Acknowledge ${breach.breachType} breach`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Acknowledge this breach with a note. Tick “resolve” to close it out if the indicator is back within tolerance.
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Resolution / response notes</label>
          <Textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={3}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox checked={resolve} onChange={(e) => setResolve(e.target.checked)} />
          Resolve this breach
        </label>
        <Button
          type="button"
          disabled={busy || !resolutionNotes.trim()}
          onClick={submit}
          className="w-full"
        >
          {busy ? "Saving…" : resolve ? "Acknowledge & resolve" : "Acknowledge"}
        </Button>
      </div>
    </Modal>
  );
}
