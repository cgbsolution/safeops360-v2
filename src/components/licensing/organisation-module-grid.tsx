"use client";

// Super Admin — Organisation module & screen access.
//
// Two levels, both switchable:
//   * SECTION  — the sidebar group ("Operational Safety"). Switching it off
//     switches off every screen inside it, which is what makes the section
//     itself disappear from the nav.
//   * SCREEN   — one nav entry ("Permit to Work", "Audit Calendar").
//
// The tree rendered here is the SAME `SECTIONS` the sidebar renders, imported
// rather than re-declared, so a screen added to the nav shows up here with no
// second catalogue to maintain. Sections are not stored as their own entity —
// a section checkbox cascades to its children — so adding a screen to a section
// later can't silently inherit an old decision.
//
// Everything is bounded by the licence: a screen belongs to a module, and a
// module the licence doesn't grant is already unreachable. Those are shown
// greyed with their reason rather than hidden, so the catalogue stays complete.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Save, ShieldOff, AlertTriangle, Info, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SECTIONS } from "@/components/layout/app-sidebar";
import { moduleForPath } from "@/lib/licensing/route-map";

type OrgModule = {
  code: string;
  name: string;
  group: string;
  enabled: boolean;
  licensed: boolean;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

type OrgResponse = {
  organisation: { name: string | null; edition: string | null; plantCount: number };
  modules: OrgModule[];
  disabledSubModules: string[];
};

/** Screens the Super Admin must never be able to switch off — the way back in.
 *  Mirrors the backend's core-module rule at screen granularity. */
const PROTECTED = new Set(["/organisation/modules", "/licence", "/configuration", "/dashboard", "/inbox"]);

export function OrganisationModuleGrid() {
  const [org, setOrg] = useState<OrgResponse["organisation"] | null>(null);
  const [modules, setModules] = useState<OrgModule[]>([]);
  /** href → enabled. Every non-protected nav screen has an entry. */
  const [screens, setScreens] = useState<Record<string, boolean>>({});
  const [baseline, setBaseline] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/licensing/organisation-modules", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail?.message ?? j?.detail ?? `Failed to load (${res.status})`);
      }
      const j = (await res.json()) as OrgResponse;
      const off = new Set(j.disabledSubModules ?? []);
      const next: Record<string, boolean> = {};
      for (const s of SECTIONS) {
        for (const it of s.items) {
          if (PROTECTED.has(it.href)) continue;
          next[it.href] = !off.has(it.href);
        }
      }
      setOrg(j.organisation);
      setModules(j.modules);
      setScreens(next);
      setBaseline(JSON.stringify(next));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load organisation modules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const moduleByCode = useMemo(
    () => Object.fromEntries(modules.map((m) => [m.code, m])),
    [modules],
  );

  /** The licence module gating a screen, if any. Unmatched = core, always on. */
  const licenceStateFor = useCallback(
    (href: string): { code: string | null; licensed: boolean } => {
      const code = moduleForPath(href);
      if (!code) return { code: null, licensed: true };
      return { code, licensed: moduleByCode[code]?.licensed ?? true };
    },
    [moduleByCode],
  );

  const sections = useMemo(
    () =>
      SECTIONS.map((s) => ({
        key: s.key,
        label: s.label,
        items: s.items.filter((it) => !PROTECTED.has(it.href)),
      })).filter((s) => s.items.length > 0),
    [],
  );

  const dirty = JSON.stringify(screens) !== baseline;
  const offCount = Object.values(screens).filter((v) => !v).length;
  const totalCount = Object.keys(screens).length;

  const setSection = (items: { href: string }[], enabled: boolean) =>
    setScreens((p) => {
      const n = { ...p };
      for (const it of items) n[it.href] = enabled;
      return n;
    });

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      // Send only what changed — a full-tree PUT would write 100+ rows on every
      // save and bury the actual change in the audit trail.
      const before = JSON.parse(baseline) as Record<string, boolean>;
      const subModules: Record<string, boolean> = {};
      for (const [href, on] of Object.entries(screens)) {
        if (before[href] !== on) subModules[href] = on;
      }
      const res = await fetch("/api/licensing/organisation-modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subModules }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.detail?.message ?? j?.detail ?? `Save failed (${res.status})`);
      setMessage(j.message ?? "Saved.");
      setBaseline(JSON.stringify(screens));
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading organisation modules…</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <Building2 size={18} className="text-primary-700" />
          Organisation module access
          {org?.name && <span className="text-sm font-normal text-slate-500">— {org.name}</span>}
        </CardTitle>
        <div className="shrink-0 text-xs text-slate-500">
          {totalCount - offCount} of {totalCount} screens on
          {org?.plantCount ? ` · applies to all ${org.plantCount} plant(s)` : ""}
        </div>
      </CardHeader>

      <CardContent>
        <p className="mb-4 text-sm text-slate-600">
          Every screen in the platform, grouped exactly as the sidebar groups them. Switching a
          section off switches off every screen inside it. Changes apply across the entire
          organisation — every plant, every role — and anyone who opens a hidden screen is told to
          contact you.
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <div className="space-y-3">
          {sections.map((section) => {
            const on = section.items.filter((it) => screens[it.href]).length;
            const all = on === section.items.length;
            const none = on === 0;
            const isCollapsed = collapsed[section.key] ?? false;
            return (
              <div key={section.key} className="overflow-hidden rounded-lg border border-slate-200">
                {/* ── Section row: the parent switch ── */}
                <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary-600"
                    checked={all}
                    // Partially-on reads as indeterminate rather than as a lie
                    // in either direction.
                    ref={(el) => {
                      if (el) el.indeterminate = !all && !none;
                    }}
                    onChange={(e) => setSection(section.items, e.target.checked)}
                    aria-label={`Toggle all screens in ${section.label ?? section.key}`}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() =>
                      setCollapsed((p) => ({ ...p, [section.key]: !isCollapsed }))
                    }
                  >
                    <ChevronRight
                      size={14}
                      className={`shrink-0 text-slate-400 transition-transform ${
                        isCollapsed ? "" : "rotate-90"
                      }`}
                    />
                    <span
                      className={`truncate text-sm font-semibold ${
                        none ? "text-slate-400 line-through" : "text-slate-800"
                      }`}
                    >
                      {section.label ?? "General"}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {on}/{section.items.length}
                    </span>
                  </button>
                  {none && (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-700">
                      <ShieldOff size={13} /> hidden
                    </span>
                  )}
                </div>

                {/* ── Screen rows ── */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100">
                    {section.items.map((item) => {
                      const enabled = !!screens[item.href];
                      const { code, licensed } = licenceStateFor(item.href);
                      return (
                        <label
                          key={item.href}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary-600"
                            checked={enabled}
                            onChange={(e) =>
                              setScreens((p) => ({ ...p, [item.href]: e.target.checked }))
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`flex items-center gap-2 text-sm ${
                                enabled ? "text-slate-900" : "text-slate-400 line-through"
                              }`}
                            >
                              {item.label}
                              {!licensed && (
                                <span
                                  className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-slate-500 no-underline"
                                  title={`The ${code} module is not in the current licence, so this screen is already unavailable. Your setting is saved and applies as soon as a licence including it is uploaded.`}
                                >
                                  not in licence
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-slate-400">
                              {item.href}
                              {code ? ` · ${code}` : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={save} disabled={!dirty || saving}>
            <Save size={16} className="mr-1.5" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
        </div>
      </CardContent>
    </Card>
  );
}
