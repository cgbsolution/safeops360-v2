"use client";

// Organisation-wide module access (Super Admin). One switch per licensed
// module, applying to the WHOLE organisation — every plant, every role.
//
// The licence is the hard ceiling: only modules the licence grants appear here,
// and the API rejects anything outside it, so this screen can only ever
// RESTRICT within the licence, never expand it. Turning a module off takes
// effect immediately; users who hit it get "Please contact your Super Admin to
// request access to this module."

import { useEffect, useMemo, useState } from "react";
import { Building2, Save, ShieldOff, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OrgModule = {
  code: string;
  name: string;
  group: string;
  enabled: boolean;
  /** False = outside the signed licence. Setting is stored but inert until a
   *  licence including the module is uploaded. */
  licensed: boolean;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

type Organisation = { name: string | null; edition: string | null; plantCount: number };

type Row = { enabled: boolean; note: string };

export function OrganisationModuleGrid({ onSaved }: { onSaved?: () => void | Promise<void> }) {
  const [org, setOrg] = useState<Organisation | null>(null);
  const [modules, setModules] = useState<OrgModule[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/licensing/organisation-modules", { cache: "no-store" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j?.detail?.message ?? j?.detail ?? `Could not load modules (${r.status})`);
        return;
      }
      const j = await r.json();
      setError(null);
      setOrg(j.organisation ?? null);
      setModules(j.modules ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Re-seed the editable rows whenever the server data changes.
  useEffect(() => {
    const next: Record<string, Row> = {};
    for (const m of modules) next[m.code] = { enabled: m.enabled, note: m.note ?? "" };
    setRows(next);
    setMsg(null);
  }, [modules]);

  // Groups A–Z, and modules A–Z by display name within each group, so the
  // catalogue reads predictably at 40+ entries.
  const grouped = useMemo(() => {
    const g: Record<string, OrgModule[]> = {};
    for (const m of modules) (g[m.group] ??= []).push(m);
    for (const list of Object.values(g)) list.sort((a, b) => a.name.localeCompare(b.name));
    return Object.fromEntries(
      Object.entries(g).sort(([a], [b]) => a.localeCompare(b))
    ) as Record<string, OrgModule[]>;
  }, [modules]);

  const unlicensed = useMemo(() => modules.filter((m) => !m.licensed), [modules]);

  // Only send what actually changed — a no-op save shouldn't rewrite every
  // row's updatedBy/updatedAt and destroy the audit trail of who turned what
  // off and when.
  const changed = useMemo(
    () =>
      modules.filter((m) => {
        const r = rows[m.code];
        if (!r) return false;
        return r.enabled !== m.enabled || (r.note || "") !== (m.note ?? "");
      }),
    [modules, rows]
  );

  const turningOff = changed.filter((m) => m.enabled && !rows[m.code]?.enabled);

  function setRow(code: string, patch: Partial<Row>) {
    setRows((p) => ({ ...p, [code]: { ...p[code], ...patch } }));
  }

  async function save() {
    if (!changed.length) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, { enabled: boolean; note: string | null }> = {};
      for (const m of changed) {
        const r = rows[m.code];
        // The note explains a disablement, so it goes with it — re-enabling a
        // module clears it rather than leaving "not purchased FY26" attached to
        // a module that is now live.
        payload[m.code] = { enabled: r.enabled, note: r.enabled ? null : r.note.trim() || null };
      }
      const res = await fetch("/api/licensing/organisation-modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: payload }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ ok: true, text: j?.message ?? "Saved." });
        await load();
        await onSaved?.();
      } else {
        setMsg({
          ok: false,
          text: j?.detail?.message ?? j?.detail ?? j?.error ?? `Save failed (${res.status})`,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-slate-500">Loading modules…</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <ShieldOff size={16} className="text-slate-400" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  const offCount = Object.values(rows).filter((r) => !r.enabled).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="text-primary-700" size={18} />
          <CardTitle>
            Organisation module access
            {org?.name ? <span className="text-slate-400 font-normal"> — {org.name}</span> : null}
          </CardTitle>
        </div>
        <div className="text-xs text-slate-500">
          {modules.length - offCount} of {modules.length} on
          {unlicensed.length ? ` · ${unlicensed.length} not in licence` : ""}
          {org?.plantCount ? ` · applies to all ${org.plantCount} plant(s)` : ""}
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-slate-600 mb-4">
          Every module this portal ships, {modules.length} in total. Switching one off removes it
          across the entire organisation — every plant, every role — and users who try to open it
          are told to contact you.
        </p>

        {unlicensed.length > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              <strong>{unlicensed.length}</strong> module(s) are not part of your current licence
              {org?.edition ? ` (${org.edition} edition)` : ""} and are already unavailable
              organisation-wide. They are listed for completeness — you can set them now, and the
              setting applies the moment a licence including them is uploaded.
            </span>
          </div>
        )}

        {turningOff.length > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Saving will switch off <strong>{turningOff.map((m) => m.name).join(", ")}</strong> for
              the whole organisation. Existing records are kept — the module simply becomes
              unreachable until you turn it back on.
            </span>
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(grouped).map(([group, mods]) => (
            <div key={group}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                {group}
              </div>
              <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {mods.map((m) => {
                  const row = rows[m.code] ?? { enabled: true, note: "" };
                  return (
                    <div key={m.code} className="flex items-start gap-3 px-3 py-2.5">
                      <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-primary-700"
                          checked={row.enabled}
                          onChange={(e) => setRow(m.code, { enabled: e.target.checked })}
                        />
                        <span className="min-w-0">
                          <span
                            className={`flex items-center gap-2 text-sm font-medium ${
                              row.enabled ? "text-slate-900" : "text-slate-400 line-through"
                            }`}
                          >
                            {m.name}
                            {/* Outside the licence: already unreachable, so the
                                toggle records intent rather than taking effect. */}
                            {!m.licensed && (
                              <span
                                className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-slate-500 no-underline"
                                title="Not included in the current licence. This setting is stored but has no effect until a licence including this module is uploaded."
                              >
                                not in licence
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-slate-400">{m.code}</span>
                        </span>
                      </label>

                      {/* The note is internal — it explains the decision to the
                          next Super Admin, and is never shown to end users. */}
                      <input
                        type="text"
                        value={row.note}
                        disabled={row.enabled}
                        placeholder={row.enabled ? "" : "Internal note (optional)"}
                        onChange={(e) => setRow(m.code, { note: e.target.value })}
                        className="w-56 shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder:text-slate-300 disabled:bg-slate-50 disabled:border-transparent"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={save} disabled={saving || !changed.length}>
            <Save size={16} className="mr-2" />
            {saving ? "Saving…" : changed.length ? `Save ${changed.length} change(s)` : "No changes"}
          </Button>
          {msg && (
            <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
              {msg.text}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
