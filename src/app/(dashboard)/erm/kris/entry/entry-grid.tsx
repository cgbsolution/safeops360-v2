"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save } from "lucide-react";
import { KRI_STATUS_CHIP, type KriOut } from "@/app/(dashboard)/erm/lib-p2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

// Compute a traffic-light status client-side, mirroring the spec rules.
export function computeStatus(
  value: number | null,
  direction: string,
  thresholdGreen: number,
  thresholdAmber: number,
): string {
  if (value == null || Number.isNaN(value)) return "NO_DATA";
  if (direction === "HIGHER_IS_WORSE") {
    if (value <= thresholdGreen) return "GREEN";
    if (value <= thresholdAmber) return "AMBER";
    return "RED";
  }
  // LOWER_IS_WORSE
  if (value >= thresholdGreen) return "GREEN";
  if (value >= thresholdAmber) return "AMBER";
  return "RED";
}

// Build last-3-periods + current month as "YYYY-MM" labels (today ~2026-06).
function periodLabels(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let back = 3; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

type CellKey = string; // `${kriId}|${period}`

export function KriEntryGrid({ items }: { items: KriOut[] }) {
  const router = useRouter();
  const periods = useMemo(() => periodLabels(), []);

  // Seed grid from each KRI's sparkline (periodLabel → value) where available.
  const initial = useMemo(() => {
    const m: Record<CellKey, string> = {};
    for (const k of items) {
      for (const p of k.sparkline ?? []) {
        if (periods.includes(p.periodLabel)) m[`${k.id}|${p.periodLabel}`] = String(p.value);
      }
    }
    return m;
  }, [items, periods]);

  const [values, setValues] = useState<Record<CellKey, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  function setCell(kriId: string, period: string, v: string) {
    setValues((prev) => ({ ...prev, [`${kriId}|${period}`]: v }));
    setSavedMsg(null);
  }

  // Changed cells = those that differ from the seeded initial value.
  const changed = useMemo(() => {
    const list: { kriId: string; periodLabel: string; value: number }[] = [];
    for (const [key, raw] of Object.entries(values)) {
      if (raw === "" || raw == null) continue;
      if (initial[key] === raw) continue;
      const num = Number(raw);
      if (Number.isNaN(num)) continue;
      const [kriId, periodLabel] = key.split("|");
      list.push({ kriId, periodLabel, value: num });
    }
    return list;
  }, [values, initial]);

  async function saveAll() {
    if (changed.length === 0) return;
    setBusy(true);
    setRowErrors({});
    setSavedMsg(null);
    const res = await fetch(`/api/erm/kris/readings/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(changed),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || j?.ok === false) {
      if (j?.errors && typeof j.errors === "object") {
        // errors keyed by kriId (or generic). Surface per-row.
        const errs: Record<string, string> = {};
        for (const [k, msg] of Object.entries(j.errors as Record<string, unknown>)) {
          errs[k] = String(msg);
        }
        setRowErrors(errs);
      } else {
        alert(j.detail || j.error || `Failed (${res.status})`);
      }
      return;
    }
    setSavedMsg(`Saved ${changed.length} reading${changed.length === 1 ? "" : "s"}.`);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <Card className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-none">
        No manually-fed KRIs to enter.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {changed.length > 0 ? (
            <span className="font-medium text-primary-700">{changed.length} unsaved change{changed.length === 1 ? "" : "s"}</span>
          ) : (
            "No unsaved changes"
          )}
          {savedMsg && <span className="ml-2 text-emerald-600">{savedMsg}</span>}
        </div>
        <Button type="button" onClick={saveAll} disabled={busy || changed.length === 0} className="gap-1.5">
          <Save size={14} /> {busy ? "Saving…" : "Save all"}
        </Button>
      </div>

      <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-2 py-2">KRI</TableHead>
              <TableHead className="px-2 py-2">Thresholds</TableHead>
              {periods.map((p, i) => (
                <TableHead key={p} className="px-2 py-2 text-center">
                  {p}
                  {i === periods.length - 1 && (
                    <span className="ml-1 rounded bg-primary-50 px-1 text-[9px] font-semibold text-primary-700">CURRENT</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((k) => {
              const err = rowErrors[k.id];
              return (
                <TableRow key={k.id}>
                  <TableCell className="px-2 py-2">
                    <Link href={`/erm/kris/${k.id}`} className="block text-xs font-medium text-primary-700 hover:underline">
                      {k.kriCode}
                    </Link>
                    <span className="block max-w-[200px] truncate text-[11px] text-slate-500">{k.name}</span>
                    {k.unit && <span className="text-[10px] text-slate-400">{k.unit}</span>}
                    {err && <div className="mt-1 text-[10px] font-medium text-rose-600">{err}</div>}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-[11px] text-slate-500">
                    <div>{k.direction === "HIGHER_IS_WORSE" ? "↑ worse" : "↓ worse"}</div>
                    <div className="tabular-nums">
                      G ≤ {k.thresholdGreen} · A ≤ {k.thresholdAmber}
                    </div>
                  </TableCell>
                  {periods.map((p) => {
                    const key = `${k.id}|${p}`;
                    const raw = values[key] ?? "";
                    const num = raw === "" ? null : Number(raw);
                    const status = computeStatus(num, k.direction, k.thresholdGreen, k.thresholdAmber);
                    const missing = raw === "";
                    return (
                      <TableCell key={p} className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Input
                            type="number"
                            value={raw}
                            onChange={(e) => setCell(k.id, p, e.target.value)}
                            className={cn(
                              "w-20 text-center tabular-nums",
                              missing
                                ? "border-amber-300 bg-amber-50"
                                : initial[key] !== raw
                                  ? "border-primary-300 bg-primary-50/40"
                                  : "border-slate-300"
                            )}
                          />
                          <span
                            className={
                              "rounded border px-1.5 py-0.5 text-[9px] font-semibold " +
                              (KRI_STATUS_CHIP[status] ?? KRI_STATUS_CHIP.NO_DATA)
                            }
                          >
                            {status === "NO_DATA" ? "—" : status}
                          </span>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <p className="text-[11px] text-slate-400">
        Amber-tinted cells are missing data for that period. Status chips are live previews computed from each KRI's direction and thresholds.
      </p>
    </div>
  );
}
