"use client";

// The scope tab — where an approval blocker gets fixed.
//
// `approval_blockers` refuses a cycle whose scope unit carries neither a
// required frequency nor a documented waiver. Both of those are writes, and
// neither had a UI: the guard could name a requirement the product gave the
// user no way to satisfy, which is worse than no guard at all.
//
// A waiver is the ONLY legitimate alternative to a frequency (docs/cams/08 §2),
// so it is offered here as a peer of the frequency field rather than buried —
// and it forces a reason, because the waiver record IS the answer to "why was
// this scope never audited?".
//
// Rows carrying a blocker are marked, so the list and the approval panel agree
// about what is wrong without the user having to hold both in their head.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, ShieldOff, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { readApiError } from "@/lib/client-errors";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import {
  siteText,
  type ApprovalBlocker, type ProgrammeCycleRow, type ScopeUnitRow,
} from "@/app/(dashboard)/cams/programme/lib-programme";

export function ScopeUnitManager({
  cycle, scopeUnits, blockers, slotCountByUnit, canManage,
}: {
  cycle: ProgrammeCycleRow;
  scopeUnits: ScopeUnitRow[];
  blockers: ApprovalBlocker[];
  slotCountByUnit: Record<string, number>;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<ScopeUnitRow | null>(null);
  const editable = canManage && (cycle.status === "DRAFT" || cycle.status === "UNDER_REVIEW");

  const byUnit = new Map<string, ApprovalBlocker[]>();
  for (const b of blockers) {
    if (!b.scopeUnitId) continue;
    byUnit.set(b.scopeUnitId, [...(byUnit.get(b.scopeUnitId) ?? []), b]);
  }

  // Site first, then label — the order a reader scans an estate in. Sorted by
  // site NAME, since that is the column on screen; cuid order grouped the rows
  // correctly but arranged the groups arbitrarily.
  const rows = [...scopeUnits].sort(
    (a, b) =>
      siteText(a).localeCompare(siteText(b)) ||
      a.dimensionLabel.localeCompare(b.dimensionLabel),
  );

  return (
    <div className="space-y-3">
      <Card className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Scope units</h3>
        <p className="mt-1 max-w-prose text-xs text-slate-500">
          The atomic covered thing — one row per site × discipline, and the row the coverage
          matrix is built from. Each needs a <strong>required frequency</strong> (ISO
          45001/9001/14001 cl.9.2.2) or a <strong>documented waiver</strong>; the approval guard
          accepts nothing else.
        </p>
        {!editable && canManage && (
          <p className="mt-2 text-[11px] text-amber-700">
            This cycle is {cycle.status.replace(/_/g, " ").toLowerCase()} and frozen — changes are
            recorded as amendments, not edits.
          </p>
        )}
      </Card>

      {rows.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          No scope units in this cycle yet — there is nothing for the programme to cover.
        </Card>
      ) : (
        <>
          {/* Desktop */}
          <Card className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
            <Table className="w-full text-sm">
              <TableHeader className="bg-slate-50 text-left text-xs text-slate-500">
                <TableRow>
                  <TableHead className="px-3 py-2 font-medium">Scope unit</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Site</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Required / cycle</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Slots</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Risk</TableHead>
                  <TableHead className="px-3 py-2 font-medium" />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {rows.map((u) => {
                  const bs = byUnit.get(u.id) ?? [];
                  return (
                    <TableRow key={u.id} className={cn("hover:bg-slate-50/60", bs.length && "bg-amber-50/40")}>
                      <TableCell className="px-3 py-2">
                        <div className="font-medium text-slate-800">{u.dimensionLabel}</div>
                        <div className="text-[10px] text-slate-400">{u.dimensionKey}</div>
                        {bs.map((b) => (
                          <div key={b.code} className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-800">
                            <AlertTriangle size={10} /> {stripLabel(b.message, u.dimensionLabel)}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs text-slate-600">{siteText(u, { short: true })}</TableCell>
                      <TableCell className="px-3 py-2 text-xs">
                        {u.isWaived ? (
                          <span className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-700">
                            <ShieldOff size={10} /> waived
                          </span>
                        ) : u.requiredPerCycle ? (
                          <span className="font-medium text-slate-700">{u.requiredPerCycle}×</span>
                        ) : (
                          <span className="text-amber-700">not set</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs text-slate-600">
                        {slotCountByUnit[u.id] ?? 0}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs text-slate-600">{u.riskWeight}</TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        {editable && (
                          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]"
                            onClick={() => setEditing(u)}>
                            <Pencil size={11} /> Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* 390px card list */}
          <div className="space-y-2 lg:hidden">
            {rows.map((u) => {
              const bs = byUnit.get(u.id) ?? [];
              return (
                <Card key={u.id} className={cn("rounded-xl border border-slate-200 p-3", bs.length && "border-amber-300 bg-amber-50/40")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{u.dimensionLabel}</span>
                    {u.isWaived ? (
                      <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">
                        waived
                      </span>
                    ) : (
                      <span className={cn("rounded border px-1.5 py-0.5 text-[10px]",
                        u.requiredPerCycle ? "border-slate-200 bg-slate-50 text-slate-600"
                                           : "border-amber-200 bg-amber-50 text-amber-800")}>
                        {u.requiredPerCycle ? `${u.requiredPerCycle}× per cycle` : "no frequency"}
                      </span>
                    )}
                    {editable && (
                      <Button type="button" size="sm" variant="outline" className="ml-auto h-7 text-[11px]"
                        onClick={() => setEditing(u)}>
                        <Pencil size={11} /> Edit
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-600">
                    <span>{siteText(u, { short: true })}</span>
                    <span>risk {u.riskWeight}</span>
                    <span>{slotCountByUnit[u.id] ?? 0} slot(s)</span>
                  </div>
                  {bs.map((b) => (
                    <div key={b.code} className="mt-1 flex items-center gap-1 text-[11px] text-amber-800">
                      <AlertTriangle size={10} /> {stripLabel(b.message, u.dimensionLabel)}
                    </div>
                  ))}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {editing && (
        <EditScopeUnitDialog
          unit={editing}
          canDelete={cycle.status === "DRAFT"}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function stripLabel(message: string, label: string): string {
  return message.startsWith(`${label}: `) ? message.slice(label.length + 2) : message;
}

function EditScopeUnitDialog({
  unit, canDelete, onClose,
}: {
  unit: ScopeUnitRow;
  canDelete: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [freq, setFreq] = useState(unit.requiredPerCycle ? String(unit.requiredPerCycle) : "");
  const [risk, setRisk] = useState(String(unit.riskWeight));
  const [rationale, setRationale] = useState(unit.rationale ?? "");
  const [waiving, setWaiving] = useState(unit.isWaived);
  const [waiverReason, setWaiverReason] = useState(unit.waiverReason ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const waiverTooShort = waiving && waiverReason.trim().length < 10;
  const nothingSet = !waiving && !Number(freq);

  async function save() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/programme/scope-units/${unit.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requiredPerCycle: waiving ? 0 : Number(freq) || 0,
        riskWeight: Number(risk) || 3,
        rationale,
        ...(waiving ? { waiverReason: waiverReason.trim() } : { clearWaiver: true }),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not update the scope unit"));
      return;
    }
    onClose();
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/programme/scope-units/${unit.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not remove the scope unit"));
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-900">{unit.dimensionLabel}</h3>
        <p className="text-[11px] text-slate-400">
          {unit.dimensionKey} · {siteText(unit, { short: true })}
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="su-freq" className="text-xs">Required audits per cycle</Label>
              <Input id="su-freq" type="number" min={0} value={freq} disabled={waiving}
                onChange={(e) => setFreq(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="su-risk" className="text-xs">Risk weight</Label>
              <SelectField id="su-risk" value={risk} onChange={setRisk} className="mt-1"
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: n }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="su-rat" className="text-xs">Rationale</Label>
            <Textarea id="su-rat" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)}
              placeholder="Why this frequency — risk, regulatory driver, past performance…"
              className="mt-1 text-xs" />
          </div>

          <Card className="rounded-lg border border-slate-200 p-3 shadow-none">
            <Label className="flex items-start gap-2 text-xs">
              <Checkbox checked={waiving} onChange={(e) => setWaiving(e.target.checked)}
                className="mt-0.5" />
              <span>
                <span className="font-medium text-slate-800">Waive this scope unit</span>
                <span className="block text-[11px] text-slate-500">
                  The only legitimate alternative to a frequency. A waiver needs a reason and
                  carries your name as its approver — it is the answer when a certification body
                  asks why this scope was never audited.
                </span>
              </span>
            </Label>
            {waiving && (
              <>
                <Textarea rows={2} value={waiverReason} onChange={(e) => setWaiverReason(e.target.value)}
                  placeholder="e.g. Site mothballed for the whole cycle; no operations to audit."
                  className="mt-2 text-xs" />
                <p className="mt-1 text-[11px] text-slate-400">
                  {waiverReason.trim().length}/10 characters minimum.
                </p>
              </>
            )}
          </Card>

          {nothingSet && (
            <p className="text-[11px] text-amber-700">
              With neither a frequency nor a waiver, this unit will block the cycle&rsquo;s approval.
            </p>
          )}
        </div>

        {err && (
          <Alert variant="destructive" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {err}
          </Alert>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          {canDelete ? (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={remove}
              className="text-rose-700">
              <Trash2 size={13} /> Remove
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={busy || waiverTooShort}>
              {busy && <Loader2 size={14} className="animate-spin" />} Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
