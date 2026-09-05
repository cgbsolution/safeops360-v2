"use client";

// Per-factory module allocation (admin). Pick a factory, turn each LICENSED
// module on/off for it, and optionally grant it for a period (From / Until) or
// leave Until blank for "never expires". The licence is the hard ceiling — only
// modules the licence grants appear here, and the API rejects anything outside
// it, so this can only RESTRICT within the licence, never expand it.

import { useEffect, useMemo, useState } from "react";
import { Factory, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";

// `orgDisabled` = the Super Admin has switched this module off for the whole
// organisation. It still appears here (so the per-factory setting is visible
// and editable) but has no effect until the organisation re-enables it.
type MatrixModule = { code: string; name: string; group: string; orgDisabled?: boolean };
type Override = { enabled: boolean; validFrom: string | null; validUntil: string | null };
type MatrixFactory = {
  id: string;
  code: string;
  name: string;
  overrides: Record<string, Override>;
};

type Row = { enabled: boolean; from: string; until: string };

// ISO datetime (or null) → YYYY-MM-DD for the date input.
const toDateInput = (iso: string | null): string => (iso ? iso.slice(0, 10) : "");

export function FactoryModuleMatrix({ onSaved }: { onSaved?: () => void | Promise<void> }) {
  const [modules, setModules] = useState<MatrixModule[]>([]);
  const [factories, setFactories] = useState<MatrixFactory[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/licensing/factory-matrix", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setModules(j.modules ?? []);
      setFactories(j.factories ?? []);
      if (!selected && (j.factories ?? []).length) setSelected(j.factories[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-seed rows whenever the selected factory (or data) changes.
  useEffect(() => {
    const f = factories.find((x) => x.id === selected);
    const ov = f?.overrides ?? {};
    const next: Record<string, Row> = {};
    for (const m of modules) {
      const o = ov[m.code];
      next[m.code] = o
        ? { enabled: o.enabled, from: toDateInput(o.validFrom), until: toDateInput(o.validUntil) }
        : { enabled: true, from: "", until: "" }; // no row → on, no window
    }
    setRows(next);
    setMsg(null);
  }, [selected, factories, modules]);

  const grouped = useMemo(() => {
    const g: Record<string, MatrixModule[]> = {};
    for (const m of modules) (g[m.group] ??= []).push(m);
    return g;
  }, [modules]);

  function setRow(code: string, patch: Partial<Row>) {
    setRows((p) => ({ ...p, [code]: { ...p[code], ...patch } }));
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, any> = {};
      for (const m of modules) {
        const r = rows[m.code];
        payload[m.code] = {
          enabled: r.enabled,
          validFrom: r.from || null,
          validUntil: r.until || null,
        };
      }
      const res = await fetch("/api/licensing/factory-matrix", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId: selected, modules: payload }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Saved. Access for this factory updated." });
        await load();
        await onSaved?.();
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j?.detail?.message ?? j?.detail ?? j?.error ?? `Save failed (${res.status})` });
      }
    } finally {
      setSaving(false);
    }
  }

  const enabledCount = Object.values(rows).filter((r) => r?.enabled).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Factory className="text-primary-700" size={18} />
        <CardTitle>Per-factory module access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Turn licensed modules on/off for a factory and optionally grant each one for a period.
          Leave <span className="font-medium">Until</span> blank for no expiry. The licence is the
          ceiling — only modules it includes appear here.
        </p>

        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : factories.length === 0 ? (
          <div className="text-sm text-slate-500">No factories found.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-sm text-slate-600">Factory</Label>
              <SelectField
                value={selected}
                onChange={(value) => setSelected(value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                options={factories.map((f) => ({ value: String(f.id), label: `${f.name} (${f.code})` }))}
              />
              <span className="text-xs text-slate-500">{enabledCount}/{modules.length} enabled</span>
            </div>

            <div className="space-y-4">
              {Object.entries(grouped).map(([group, mods]) => (
                <div key={group}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                    {group}
                  </div>
                  <div className="space-y-1.5">
                    {mods.map((m) => {
                      const r = rows[m.code] ?? { enabled: true, from: "", until: "" };
                      return (
                        <Card
                          key={m.code}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-slate-200 px-3 py-2 text-sm shadow-none">
                          <Label className="flex items-center gap-2 cursor-pointer min-w-[16rem]">
                            <Checkbox
                             
                              checked={r.enabled}
                              onChange={(e) => setRow(m.code, { enabled: e.target.checked })}
                              className="size-4 accent-primary-700" />
                            <span className={r.enabled ? "text-slate-800" : "text-slate-400"}>
                              {m.name}
                            </span>
                          </Label>
                          {/* Already off for the whole organisation — this row's
                              setting is real but inert until the Super Admin
                              turns the module back on. Say so rather than let an
                              admin toggle it and wonder why nothing changed. */}
                          {m.orgDisabled && (
                            <span
                              className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800 border border-amber-200"
                              title="Switched off org-wide by the Super Admin. This factory setting has no effect until it is re-enabled."
                            >
                              Off org-wide
                            </span>
                          )}
                          {r.enabled && !m.orgDisabled && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 ml-auto">
                              <span>From</span>
                              <Input
                                type="date"
                                value={r.from}
                                onChange={(e) => setRow(m.code, { from: e.target.value })}
                                className="rounded border border-slate-300 px-2 py-1" />
                              <span>Until</span>
                              <Input
                                type="date"
                                value={r.until}
                                onChange={(e) => setRow(m.code, { until: e.target.value })}
                                className="rounded border border-slate-300 px-2 py-1" />
                              {r.until ? (
                                <Button variant="link"
                                  type="button"
                                  onClick={() => setRow(m.code, { until: "" })} className="underline"
                                  title="Clear end date (never expires)">
                                  no expiry
                                </Button>
                              ) : (
                                <span className="text-emerald-600">∞ no expiry</span>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={save} disabled={saving}>
                <Save size={16} className="mr-1" /> {saving ? "Saving…" : "Save factory access"}
              </Button>
              <Button variant="link"
                type="button" className="text-xs underline"
                onClick={() =>
                  setRows(Object.fromEntries(modules.map((m) => [m.code, { enabled: true, from: "", until: "" }])))
                }>
                Enable all (no expiry)
              </Button>
              <Button variant="link"
                type="button" className="text-xs underline"
                onClick={() =>
                  setRows((p) =>
                    Object.fromEntries(modules.map((m) => [m.code, { ...p[m.code], enabled: false }]))
                  )
                }>
                Disable all
              </Button>
              {msg && (
                <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>
                  {msg.text}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
