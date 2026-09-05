"use client";

import * as React from "react";
import { Pencil, Plus, Search, Save, RotateCcw, X, ChevronDown, RefreshCw, Check, ShieldCheck, Lock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WIDGET_CATALOG,
  WIDGET_BY_ID,
  WIDGET_CATEGORIES,
  type WidgetSpan,
  type WidgetMeta,
} from "@/lib/dashboard/widget-catalog";
import { DASHBOARD_PRESETS, PRESET_KEYS, presetLayout } from "@/lib/dashboard/presets";
import { DashboardWidget } from "./widgets/dashboard-widget";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────────────────────────────────
// ConfigurableDashboard (UI Depth sprint, Deliverable 3).
//
// The interactive shell: a 3-column responsive grid the user can edit —
// drag to reorder (native HTML5 DnD, no dependency), resize 1/2/3-col,
// remove, add from a widget gallery, apply persona presets, and save a
// layout that persists server-side (survives device + reload). Admins get
// a lock panel (mandatory widgets + editing lock). Each widget fetches its
// own data independently via DashboardWidget.
// ─────────────────────────────────────────────────────────────────────

export interface LayoutItem {
  widgetId: string;
  span: WidgetSpan;
}

export interface ConfigurableDashboardProps {
  initialItems: LayoutItem[];
  basedOnPreset: string | null;
  lockedWidgetIds: string[];
  editingLocked: boolean;
  isAdmin: boolean;
  canPickPlant: boolean;
  plants: { id: string; name: string }[];
  today: string;
}

const SPAN_CLASS: Record<WidgetSpan, string> = {
  1: "lg:col-span-1",
  2: "col-span-2 lg:col-span-2",
  3: "col-span-2 lg:col-span-4",
};

// ── Date range selector ───────────────────────────────────────────────
type DatePreset = "1y" | "6m" | "last-month" | "1m" | "30d" | "custom";
const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "1y",         label: "1 Year"     },
  { key: "6m",         label: "6 Months"   },
  { key: "last-month", label: "Last Month" },
  { key: "1m",         label: "1 Month"    },
  { key: "30d",        label: "30 Days"    },
  { key: "custom",     label: "Custom"     },
];

function fmt(d: Date) { return d.toISOString().split("T")[0]; }

function resolveRange(preset: DatePreset, cFrom: string, cTo: string): { from: string; to: string } {
  const today = new Date();
  const to = fmt(today);
  if (preset === "1y")         { const d = new Date(today); d.setFullYear(d.getFullYear() - 1); return { from: fmt(d), to }; }
  if (preset === "6m")         { const d = new Date(today); d.setMonth(d.getMonth() - 6);       return { from: fmt(d), to }; }
  if (preset === "1m")         { const d = new Date(today); d.setMonth(d.getMonth() - 1);       return { from: fmt(d), to }; }
  if (preset === "30d")        { const d = new Date(today); d.setDate(d.getDate() - 30);        return { from: fmt(d), to }; }
  if (preset === "last-month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(first.getTime() - 86400000);
    const firstDay = new Date(lastDay.getFullYear(), lastDay.getMonth(), 1);
    return { from: fmt(firstDay), to: fmt(lastDay) };
  }
  return { from: cFrom, to: cTo };
}

export function ConfigurableDashboard(props: ConfigurableDashboardProps) {
  const [items, setItems] = React.useState<LayoutItem[]>(props.initialItems);
  const [saved, setSaved] = React.useState<LayoutItem[]>(props.initialItems);
  const [basedOnPreset, setBasedOnPreset] = React.useState<string | null>(props.basedOnPreset);
  const [modified, setModified] = React.useState(false);
  const [locked, setLocked] = React.useState<string[]>(props.lockedWidgetIds);

  const [editing, setEditing] = React.useState(false);
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [presetsOpen, setPresetsOpen] = React.useState(false);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const [plant, setPlant] = React.useState<string>("");
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [datePreset, setDatePreset] = React.useState<DatePreset>("1y");
  const [customFrom, setCustomFrom] = React.useState<string>("");
  const [customTo,   setCustomTo]   = React.useState<string>("");
  const dateRange = React.useMemo(() => resolveRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo]);

  const dragIndex = React.useRef<number | null>(null);
  const [dragOver, setDragOver] = React.useState<number | null>(null);

  const activeIds = React.useMemo(() => new Set(items.map((i) => i.widgetId)), [items]);

  // ── Mutators ───────────────────────────────────────────────────────
  function markEdited(next: LayoutItem[]) {
    setItems(next);
    setModified(true);
  }
  function addWidget(id: string) {
    if (activeIds.has(id)) return;
    const meta = WIDGET_BY_ID[id];
    markEdited([...items, { widgetId: id, span: meta?.defaultSpan ?? 1 }]);
  }
  function removeWidget(id: string) {
    if (locked.includes(id)) return;
    markEdited(items.filter((i) => i.widgetId !== id));
  }
  function cycleSize(id: string) {
    const meta = WIDGET_BY_ID[id];
    if (!meta || meta.allowedSpans.length < 2) return;
    markEdited(
      items.map((i) => {
        if (i.widgetId !== id) return i;
        const idx = meta.allowedSpans.indexOf(i.span);
        const span = meta.allowedSpans[(idx + 1) % meta.allowedSpans.length];
        return { ...i, span };
      })
    );
  }
  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    markEdited(next);
  }

  // ── Persistence ────────────────────────────────────────────────────
  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/dashboard/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, basedOnPreset }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Save failed");
      const data = await res.json();
      setItems(data.items);
      setSaved(data.items);
      setModified(false);
      setEditing(false);
      setStatus("Layout saved");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }
  function cancel() {
    setItems(saved);
    setModified(false);
    setEditing(false);
    setGalleryOpen(false);
  }
  async function resetDefault() {
    if (!window.confirm("Reset to your role's default layout? This discards your customisations.")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/layout", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Reset failed");
      setItems(data.items);
      setSaved(data.items);
      setBasedOnPreset(data.basedOnPreset ?? null);
      setModified(false);
      setStatus("Reset to default");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }
  function applyPreset(key: string) {
    setPresetsOpen(false);
    if (!window.confirm(`Apply the "${DASHBOARD_PRESETS[key]?.label}" preset? This replaces your current layout (you can still customise and save).`)) return;
    markEdited(presetLayout(key) as LayoutItem[]);
    setBasedOnPreset(key);
    setEditing(true);
  }
  async function toggleLock(id: string) {
    const next = locked.includes(id) ? locked.filter((x) => x !== id) : [...locked, id];
    setLocked(next);
    try {
      await fetch("/api/dashboard/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockedWidgetIds: next }),
      });
    } catch {
      /* optimistic — non-fatal */
    }
  }

  React.useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const presetLabel = basedOnPreset ? DASHBOARD_PRESETS[basedOnPreset]?.label : null;

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">EHS Dashboard</h1>
          <p className="text-sm text-slate-500">
            {props.today} · Real-time safety performance across all plants
            {presetLabel && modified && (
              <>
                {" · "}
                <span className="text-slate-500 italic">Modified from: {presetLabel}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* LIVE indicator */}
          <Badge variant="success" className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </Badge>

          {props.canPickPlant && props.plants.length > 0 && (
            <SelectField value={plant} onChange={(value) => setPlant(value)} className="form-select h-9 w-auto py-0 text-sm" aria-label="Plant filter"
              placeholder="All Plants"
              options={props.plants.map((p) => ({ value: String(p.id), label: `${p.name}` }))}
            />
          )}
          <Button variant="outline" type="button" onClick={() => setRefreshKey((k) => k + 1)} className="h-9 gap-1.5 rounded-md px-3 text-sm" title="Refresh all widgets">
            <RefreshCw size={14} /> Refresh
          </Button>

          {!editing ? (
            <>
              <div className="relative">
                <Button variant="outline" type="button" onClick={() => setPresetsOpen((v) => !v)} className="h-9 gap-1.5 rounded-md px-3 text-sm">
                  Presets <ChevronDown size={14} />
                </Button>
                {presetsOpen && (
                  <Card className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                    <div className="px-2 py-1 text-overline text-slate-400">Apply preset</div>
                    {PRESET_KEYS.map((k) => (
                      <Button key={k} type="button" variant="ghost" onClick={() => applyPreset(k)}
                        aria-pressed={basedOnPreset === k}
                        className="h-auto w-full justify-between rounded px-2 py-1.5 text-left text-sm font-normal text-slate-700">
                        {DASHBOARD_PRESETS[k].label}
                        {basedOnPreset === k && <Check size={14} className="text-primary-600" />}
                      </Button>
                    ))}
                  </Card>
                )}
              </div>
              <Button variant="ghost" type="button" onClick={() => !props.editingLocked && setEditing(true)} disabled={props.editingLocked} className={cn("inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition", props.editingLocked ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-primary-600 text-white hover:bg-primary-700")} title={props.editingLocked ? "Editing locked by administrator" : undefined}>
                {props.editingLocked ? <Lock size={14} /> : <Pencil size={14} />} Edit Layout
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" type="button" onClick={() => setGalleryOpen(true)} className="h-9 gap-1.5 rounded-md px-3 text-sm">
                <Plus size={14} /> Add Widget
              </Button>
              {props.isAdmin && (
                <Button variant="outline" type="button" onClick={() => setAdminOpen(true)} className="h-9 gap-1.5 rounded-md px-3 text-sm">
                  <ShieldCheck size={14} /> Admin
                </Button>
              )}
              <Button variant="outline" type="button" onClick={resetDefault} className="h-9 gap-1.5 rounded-md px-3 text-sm">
                <RotateCcw size={14} /> Reset
              </Button>
              <Button variant="outline" type="button" onClick={cancel} className="h-9 gap-1.5 rounded-md px-3 text-sm">
                Cancel
              </Button>
              <Button type="button" onClick={save} disabled={saving} className="h-9 gap-1.5 rounded-md px-3 text-sm">
                <Save size={14} /> {saving ? "Saving…" : "Save Layout"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Date range filter bar ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Card className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <Calendar size={13} className="ml-1.5 text-slate-400 flex-shrink-0" />
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setDatePreset(p.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                datePreset === p.key
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {p.label}
            </button>
          ))}
        </Card>

        {datePreset === "custom" && (
          <Card className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
            <span className="text-xs text-slate-500">From</span>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-7 rounded border border-slate-200 px-2 text-xs text-slate-700 focus:border-primary-400 focus:outline-none" />
            <span className="text-xs text-slate-400">–</span>
            <span className="text-xs text-slate-500">To</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-7 rounded border border-slate-200 px-2 text-xs text-slate-700 focus:border-primary-400 focus:outline-none" />
          </Card>
        )}

        {datePreset !== "custom" && (
          <span className="text-xs text-slate-400 tabular-nums">
            {dateRange.from} → {dateRange.to}
          </span>
        )}
      </div>

      {status && <Alert variant="success" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{status}</Alert>}
      {editing && (
        <Card className="rounded-md border border-primary-200 bg-primary-50/60 px-3 py-2 text-xs text-primary-800 shadow-none">
          Edit mode — drag widgets to reorder, use the icons to resize or remove, and “Add Widget” to insert more. Changes are saved only when you click <strong>Save Layout</strong>.
        </Card>
      )}

      {/* ── Grid ───────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-none">
          <p className="text-slate-600">Your dashboard is empty.</p>
          {editing && (
            <Button variant="default" type="button" onClick={() => setGalleryOpen(true)} className="mt-3 gap-1.5 rounded-md px-3 py-2 text-sm text-white">
              <Plus size={14} /> Add a widget
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((it, i) => (
            <div
              key={it.widgetId}
              className={cn(SPAN_CLASS[it.span], editing && "cursor-move", dragOver === i && "rounded-xl ring-2 ring-primary-300")}
              draggable={editing}
              onDragStart={(e) => {
                dragIndex.current = i;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!editing) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== i) setDragOver(i);
              }}
              onDragLeave={(e) => {
                if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                  setDragOver((d) => (d === i ? null : d));
                }
              }}
              onDragEnd={() => {
                dragIndex.current = null;
                setDragOver(null);
              }}
              onDrop={(e) => {
                if (!editing) return;
                e.preventDefault();
                if (dragIndex.current !== null && dragIndex.current !== i) reorder(dragIndex.current, i);
                dragIndex.current = null;
                setDragOver(null);
              }}
            >
              <DashboardWidget
                id={it.widgetId}
                span={it.span}
                plant={plant || undefined}
                dateFrom={dateRange.from || undefined}
                dateTo={dateRange.to || undefined}
                editing={editing}
                locked={locked.includes(it.widgetId)}
                isAdmin={props.isAdmin}
                onRemove={() => removeWidget(it.widgetId)}
                onCycleSize={() => cycleSize(it.widgetId)}
                onToggleLock={() => toggleLock(it.widgetId)}
                refreshKey={refreshKey}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Gallery drawer ─────────────────────────────────────── */}
      {galleryOpen && <WidgetGallery activeIds={activeIds} onAdd={addWidget} onClose={() => setGalleryOpen(false)} />}

      {/* ── Admin panel ────────────────────────────────────────── */}
      {adminOpen && props.isAdmin && (
        <AdminPanel
          locked={locked}
          editingLocked={props.editingLocked}
          onToggleLock={toggleLock}
          onClose={() => setAdminOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Widget gallery (right drawer) ───────────────────────────────────

function WidgetGallery({ activeIds, onAdd, onClose }: { activeIds: Set<string>; onAdd: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const filtered = WIDGET_CATALOG.filter((w) => !query || w.title.toLowerCase().includes(query) || w.description.toLowerCase().includes(query));

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Button type="button" variant="ghost" aria-label="Close gallery" className="h-auto flex-1 rounded-none bg-slate-900/20 hover:bg-slate-900/30" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-heading-3 text-slate-800">Add a widget</h2>
            <p className="text-caption text-slate-500">{WIDGET_CATALOG.length} widgets available</p>
          </div>
          <Button variant="ghost" type="button" onClick={onClose} className="rounded p-1" aria-label="Close">
            <X size={18} />
          </Button>
        </div>
        <div className="border-b border-slate-100 p-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search widgets…" className="form-input h-9 pl-8" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {WIDGET_CATEGORIES.map((cat) => {
            const group = filtered.filter((w) => w.category === cat);
            if (group.length === 0) return null;
            return (
              <div key={cat} className="mb-4">
                <div className="mb-1.5 text-overline text-slate-400">{cat}</div>
                <div className="space-y-1.5">
                  {group.map((w) => (
                    <GalleryCard key={w.id} meta={w} active={activeIds.has(w.id)} onAdd={() => onAdd(w.id)} />
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="px-1 py-6 text-center text-caption text-slate-400">No widgets match “{q}”.</p>}
        </div>
      </div>
    </div>
  );
}

function GalleryCard({ meta, active, onAdd }: { meta: WidgetMeta; active: boolean; onAdd: () => void }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-3 transition", active ? "border-slate-100 bg-slate-50 opacity-60" : "border-slate-200 hover:border-primary-200")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-800">{meta.title}</span>
          {meta.existing && <span className="rounded bg-slate-100 px-1 text-[9px] uppercase text-slate-500">core</span>}
        </div>
        <p className="mt-0.5 line-clamp-2 text-caption text-slate-500" title={meta.description}>
          {meta.description}
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={active}
        className={cn("flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition", active ? "cursor-default bg-slate-100 text-slate-400" : "bg-primary-600 text-white hover:bg-primary-700")}
      >
        {active ? "Added" : "Add"}
      </button>
    </div>
  );
}

// ─── Admin panel ─────────────────────────────────────────────────────

function AdminPanel({ locked, editingLocked, onToggleLock, onClose }: { locked: string[]; editingLocked: boolean; onToggleLock: (id: string) => void; onClose: () => void }) {
  const [editLock, setEditLock] = React.useState(editingLocked);
  async function toggleEditLock() {
    const next = !editLock;
    setEditLock(next);
    try {
      await fetch("/api/dashboard/admin", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ editingLocked: next }) });
    } catch {
      /* non-fatal */
    }
  }
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Button type="button" variant="ghost" aria-label="Close admin" className="h-auto flex-1 rounded-none bg-slate-900/20 hover:bg-slate-900/30" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-heading-3 text-slate-800">Dashboard admin</h2>
          <Button variant="ghost" type="button" onClick={onClose} className="rounded p-1" aria-label="Close">
            <X size={18} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <Label className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <span>
              <span className="block text-sm font-medium text-slate-800">Lock editing</span>
              <span className="block text-caption text-slate-500">Prevent users from changing their layout.</span>
            </span>
            <Checkbox checked={editLock} onChange={toggleEditLock} className="h-4 w-4" />
          </Label>
          <div className="mb-1.5 text-overline text-slate-400">Mandatory widgets</div>
          <p className="mb-2 text-caption text-slate-500">Locked widgets are always shown and can’t be removed by users.</p>
          <div className="space-y-1">
            {WIDGET_CATALOG.map((w) => (
              <Label key={w.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-slate-50">
                <span className="truncate text-sm text-slate-700">{w.title}</span>
                <Checkbox checked={locked.includes(w.id)} onChange={() => onToggleLock(w.id)} className="h-4 w-4" />
              </Label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
