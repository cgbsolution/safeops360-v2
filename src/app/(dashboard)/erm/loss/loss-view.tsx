"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, X, Zap, Pencil, ArrowUpRight } from "lucide-react";
import { KpiTile, BandBadge } from "@/components/erm/shared";
import { RcaLossPanel } from "@/components/erm/rca-loss-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtDate, type Category, type RiskListItem } from "@/app/(dashboard)/erm/lib";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  LOSS_STATUS_CHIP,
  LOSS_TYPES,
  fmtInr,
  type LossEvent,
  type LossListResponse,
  type LossAnalytics,
  type CalibrationRow,
} from "@/app/(dashboard)/erm/lib-p2";

type Tab = "register" | "analytics";
type Filters = { category: string | null; status: string | null; source: string | null };

const STATUS_OPTIONS = ["DRAFT", "QUANTIFIED", "CLOSED"] as const;
const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "INCIDENT_AUTO", label: "From incident" },
  { value: "MANUAL", label: "Manual" },
];

function lossTypeLabel(t: string) {
  return t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LossView({
  tab,
  filters,
  list,
  analytics,
  categories,
  risks,
}: {
  tab: Tab;
  filters: Filters;
  list: LossListResponse;
  analytics: LossAnalytics | null;
  categories: Category[];
  risks: RiskListItem[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<LossEvent | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<LossEvent | null>(null);

  function tabHref(t: Tab) {
    const sp = new URLSearchParams();
    if (t !== "register") sp.set("tab", t);
    if (t === "register") {
      if (filters.category) sp.set("category", filters.category);
      if (filters.status) sp.set("status", filters.status);
      if (filters.source) sp.set("source", filters.source);
    }
    const q = sp.toString();
    return `/erm/loss${q ? `?${q}` : ""}`;
  }

  return (
    <div className="space-y-5">
      {/* Tab strip + action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex gap-1">
          {(["register", "analytics"] as const).map((t) => (
            <Link
              key={t}
              href={tabHref(t)}
              className={
                "border-b-2 px-4 py-2 text-sm font-medium transition-colors " +
                (tab === t
                  ? "border-primary-700 text-primary-700"
                  : "border-transparent text-slate-500 hover:text-slate-700")
              }
            >
              {t === "register" ? "Register" : "Analytics & Calibration"}
            </Link>
          ))}
        </div>
        {tab === "register" && (
          <Button type="button" onClick={() => setShowNew(true)} className="mb-1 gap-1.5">
            <Plus size={16} /> New Loss Event
          </Button>
        )}
      </div>

      {tab === "register" ? (
        <RegisterTab
          list={list}
          filters={filters}
          onRowClick={setSelected}
        />
      ) : (
        <AnalyticsTab analytics={analytics} />
      )}

      {selected && (
        <DetailDrawer
          ev={selected}
          risks={risks}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
          onDone={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      )}

      {showNew && (
        <LossFormModal
          mode="create"
          categories={categories}
          risks={risks}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}

      {editing && (
        <LossFormModal
          mode="edit"
          ev={editing}
          categories={categories}
          risks={risks}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ── Register tab ──────────────────────────────────────────────────────────────
function RegisterTab({
  list,
  filters,
  onRowClick,
}: {
  list: LossListResponse;
  filters: Filters;
  onRowClick: (ev: LossEvent) => void;
}) {
  const draftCount = list.statusCounts.DRAFT ?? 0;

  function toggleHref(key: "status" | "source", value: string) {
    const sp = new URLSearchParams();
    if (filters.category) sp.set("category", filters.category);
    if (filters.status) sp.set("status", filters.status);
    if (filters.source) sp.set("source", filters.source);
    if (sp.get(key) === value) sp.delete(key);
    else sp.set(key, value);
    const q = sp.toString();
    return `/erm/loss${q ? `?${q}` : ""}`;
  }

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Total events" value={list.total} />
        <KpiTile label="Net loss (total)" value={fmtInr(list.netLossTotal)} tone="critical" />
        <KpiTile
          label="Near-miss potential"
          value={fmtInr(list.nearMissPotentialTotal)}
          tone="warn"
          sub="what could have been lost"
        />
        <KpiTile label="Draft events" value={draftCount} tone="warn" sub="awaiting quantification" />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
        {STATUS_OPTIONS.map((s) => (
          <FilterChip
            key={s}
            label={s.charAt(0) + s.slice(1).toLowerCase()}
            active={filters.status === s}
            count={list.statusCounts[s]}
            href={toggleHref("status", s)}
          />
        ))}
        <span className="ml-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Source</span>
        {SOURCE_OPTIONS.map((s) => (
          <FilterChip
            key={s.value}
            label={s.label}
            active={filters.source === s.value}
            href={toggleHref("source", s.value)}
          />
        ))}
        <span className="ml-auto text-xs text-slate-500">{list.total} event(s)</span>
      </div>

      {/* Table */}
      <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead className="px-3 py-2.5">Code</TableHead>
              <TableHead className="px-3 py-2.5">Date</TableHead>
              <TableHead className="px-3 py-2.5">Title</TableHead>
              <TableHead className="px-3 py-2.5">Category</TableHead>
              <TableHead className="px-3 py-2.5">Site</TableHead>
              <TableHead className="px-3 py-2.5">Src</TableHead>
              <TableHead className="px-3 py-2.5 text-right">Gross</TableHead>
              <TableHead className="px-3 py-2.5 text-right">Recovered</TableHead>
              <TableHead className="px-3 py-2.5 text-right">Net</TableHead>
              <TableHead className="px-3 py-2.5">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="px-3 py-10 text-center text-sm text-slate-400">
                  No loss events match the current filter.
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((e) => (
                <TableRow
                  key={e.id}
                  onClick={() => onRowClick(e)}
                  className="cursor-pointer"
                >
                  <TableCell className="px-3 py-2.5 font-medium text-primary-700">{e.eventCode}</TableCell>
                  <TableCell className="px-3 py-2.5 text-xs text-slate-500">{fmtDate(e.eventDate)}</TableCell>
                  <TableCell className="max-w-[260px] px-3 py-2.5">
                    <span className="text-slate-700">{e.title}</span>
                    {e.isNearMiss && (
                      <span className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        NEAR MISS
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                      style={{ backgroundColor: e.categoryColor ?? "#64748b" }}
                    >
                      {e.categoryCode ?? e.categoryName ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-xs text-slate-600">{e.siteName ?? "—"}</TableCell>
                  <TableCell
                    className="px-3 py-2.5 text-center text-base text-slate-500"
                    title={e.source === "INCIDENT_AUTO" ? "From incident" : "Manual"}
                  >
                    {e.source === "INCIDENT_AUTO" ? "⚡" : "✎"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtInr(e.grossLossInr)}</TableCell>
                  <TableCell className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtInr(e.recoveredInr)}</TableCell>
                  <TableCell className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">{fmtInr(e.netLossInr)}</TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span className={"inline-block rounded border px-2 py-0.5 text-[11px] font-medium " + (LOSS_STATUS_CHIP[e.status] ?? "")}>
                      {e.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function FilterChip({
  label,
  active,
  count,
  href,
}: {
  label: string;
  active: boolean;
  count?: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
        (active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
      }
    >
      {label}
      {count != null && <span className="ml-1 tabular-nums opacity-70">{count}</span>}
    </Link>
  );
}

// ── Detail drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({
  ev,
  risks,
  onClose,
  onEdit,
  onDone,
}: {
  ev: LossEvent;
  risks: RiskListItem[];
  onClose: () => void;
  onEdit: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closureNotes, setClosureNotes] = useState("");

  const linkedRisks = risks.filter((r) => ev.linkedRiskIds?.includes(r.id));

  async function action(path: string, body?: any) {
    setBusy(true);
    try {
      const res = await fetch(`/api/erm/loss/events/${ev.id}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.detail || j.error || `Failed (${res.status})`);
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-slate-500">{ev.eventCode}</span>
                <span className={"rounded border px-2 py-0.5 text-[11px] font-medium " + (LOSS_STATUS_CHIP[ev.status] ?? "")}>
                  {ev.status}
                </span>
                {ev.isNearMiss && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">NEAR MISS</span>
                )}
                {ev.source === "INCIDENT_AUTO" ? (
                  <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200">
                    <Zap size={11} /> from incident
                  </span>
                ) : (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">✎ manual</span>
                )}
                {ev.sourceUpdatedFlag && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-300">
                    source updated
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{ev.title}</h2>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-700">
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 px-6 py-5">
          {/* Money tiles */}
          <div className="grid grid-cols-3 gap-3">
            <Money label="Gross" value={fmtInr(ev.grossLossInr)} />
            <Money label="Recovered" value={fmtInr(ev.recoveredInr)} />
            <Money label="Net loss" value={fmtInr(ev.netLossInr)} strong />
          </div>
          {ev.potentialLossInr != null && (
            <Alert variant="warning" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Potential loss (near-miss exposure): <b>{fmtInr(ev.potentialLossInr)}</b>
            </Alert>
          )}

          {ev.description && (
            <div>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Description</h3>
              <p className="text-sm text-slate-700">{ev.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Meta label="Event date" value={fmtDate(ev.eventDate)} />
            <Meta label="Site" value={ev.siteName ?? "—"} />
            <Meta label="Category" value={ev.categoryName ?? ev.categoryCode ?? "—"} />
            <Meta label="Last updated" value={fmtDate(ev.updatedAt)} />
            {ev.sourceIncidentId && <Meta label="Source incident" value={ev.sourceIncidentId} />}
          </div>

          {/* Loss types */}
          <div>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Loss types</h3>
            {ev.lossTypes?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {ev.lossTypes.map((t) => (
                  <span key={t} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {lossTypeLabel(t)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </div>

          {/* Linked risks */}
          <div>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Linked risks</h3>
            {linkedRisks.length ? (
              <ul className="space-y-1.5">
                {linkedRisks.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <Link href={`/erm/register/${r.id}`} className="font-medium text-primary-700 hover:underline">
                      {r.riskCode}
                    </Link>
                    <span className="truncate text-slate-600">{r.title}</span>
                    <span className="ml-auto">
                      <BandBadge band={r.residualBand} score={r.residualScore} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-slate-400">No risks linked.</span>
            )}
          </div>

          <RcaLossPanel lossEventId={ev.id} eventCode={ev.eventCode} title={ev.title} />

          {ev.closureNotes && (
            <div>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Closure notes</h3>
              <p className="text-sm text-slate-700">{ev.closureNotes}</p>
            </div>
          )}

          {/* Close form */}
          {closing && (
            <Card className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-none">
              <Label className="mb-1 block text-xs font-medium text-slate-600">Closure notes</Label>
              <Textarea
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                rows={3}
                placeholder="How was this loss event resolved / what was learned…"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => action("close", { closureNotes })}
                >
                  {busy ? "Closing…" : "Confirm close"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setClosing(false)}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Action bar */}
        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-slate-200 bg-white px-6 py-3">
          {ev.status === "DRAFT" && (
            <ActionBtn primary disabled={busy} onClick={() => action("quantify")}>
              Quantify
            </ActionBtn>
          )}
          {ev.status === "QUANTIFIED" && (
            <ActionBtn primary disabled={busy} onClick={() => setClosing(true)}>
              Close
            </ActionBtn>
          )}
          <ActionBtn disabled={busy} onClick={onEdit}>
            <span className="inline-flex items-center gap-1">
              <Pencil size={13} /> Edit
            </span>
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-auto rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
        primary
          ? "bg-primary-700 text-white hover:bg-primary-800"
          : "border border-slate-300 bg-white text-slate-700 hover:border-primary-500"
      )}
    >
      {children}
    </Button>
  );
}

function Money({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Card className="rounded-lg border border-slate-200 bg-white p-3 shadow-none">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={"mt-0.5 tabular-nums " + (strong ? "text-base font-bold text-slate-900" : "text-sm text-slate-700")}>
        {value}
      </div>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm text-slate-700">{value}</div>
    </div>
  );
}

// ── New / Edit modal ──────────────────────────────────────────────────────────
function LossFormModal({
  mode,
  ev,
  categories,
  risks,
  onClose,
  onDone,
}: {
  mode: "create" | "edit";
  ev?: LossEvent;
  categories: Category[];
  risks: RiskListItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(ev?.title ?? "");
  const [description, setDescription] = useState(ev?.description ?? "");
  const [eventDate, setEventDate] = useState(ev?.eventDate ? ev.eventDate.slice(0, 10) : "");
  const [siteId, setSiteId] = useState(ev?.siteId ?? "");
  const [categoryId, setCategoryId] = useState(ev?.categoryId ?? "");
  const [subCategoryId, setSubCategoryId] = useState(ev?.subCategoryId ?? "");
  const [linkedRiskIds, setLinkedRiskIds] = useState<string[]>(ev?.linkedRiskIds ?? []);
  const [isNearMiss, setIsNearMiss] = useState(ev?.isNearMiss ?? false);
  const [grossLossInr, setGrossLossInr] = useState(ev ? String(ev.grossLossInr) : "");
  const [recoveredInr, setRecoveredInr] = useState(ev ? String(ev.recoveredInr) : "");
  const [potentialLossInr, setPotentialLossInr] = useState(
    ev?.potentialLossInr != null ? String(ev.potentialLossInr) : "",
  );
  const [lossTypes, setLossTypes] = useState<string[]>(ev?.lossTypes ?? []);
  const [busy, setBusy] = useState(false);

  const subCategories = categories.find((c) => c.id === categoryId)?.subCategories ?? [];
  const gross = Number(grossLossInr || 0);
  const recovered = Number(recoveredInr || 0);
  const net = Math.max(0, gross - recovered);

  function toggleRisk(id: string) {
    setLinkedRiskIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function toggleLossType(t: string) {
    setLossTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  }

  async function submit() {
    setBusy(true);
    const body: any = {
      title,
      description,
      eventDate,
      siteId: siteId || null,
      categoryId,
      subCategoryId: subCategoryId || null,
      linkedRiskIds,
      isNearMiss,
      grossLossInr: gross,
      recoveredInr: recovered,
      potentialLossInr: potentialLossInr ? Number(potentialLossInr) : null,
      lossTypes,
    };
    try {
      const res =
        mode === "create"
          ? await fetch("/api/erm/loss/events", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            })
          : await fetch(`/api/erm/loss/events/${ev!.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.detail || j.error || `Failed (${res.status})`);
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const valid = title.trim() && eventDate && categoryId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {mode === "create" ? "New loss event" : `Edit ${ev?.eventCode}`}
          </h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </Button>
        </div>

        <div className="space-y-4">
          <Field label="Title (required)">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Boiler tube failure — Unit 2"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Event date (required)">
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </Field>
            <Field label="Site ID (optional)">
              <Input
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                placeholder="Plant / site identifier"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category (required)">
              <SelectField
                value={categoryId}
                onChange={(value) => {
                  setCategoryId(value);
                  setSubCategoryId("");
                }}
                placeholder="Select category…"
                options={categories.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
              />
            </Field>
            <Field label="Sub-category (optional)">
              <SelectField
                value={subCategoryId}
                onChange={setSubCategoryId}
                disabled={!subCategories.length}
                className="disabled:bg-slate-50"
                placeholder={subCategories.length ? "None" : "—"}
                options={subCategories.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
              />
            </Field>
          </div>

          <Label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={isNearMiss} onChange={(e) => setIsNearMiss(e.target.checked)} />
            This was a near miss (no / minimal realised loss, but real potential)
          </Label>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Gross loss (₹)">
              <Input
                type="number"
                min={0}
                value={grossLossInr}
                onChange={(e) => setGrossLossInr(e.target.value)}
              />
            </Field>
            <Field label="Recovered (₹)">
              <Input
                type="number"
                min={0}
                value={recoveredInr}
                onChange={(e) => setRecoveredInr(e.target.value)}
              />
            </Field>
            <Field label="Potential (₹)">
              <Input
                type="number"
                min={0}
                value={potentialLossInr}
                onChange={(e) => setPotentialLossInr(e.target.value)}
                placeholder="near-miss"
              />
            </Field>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Net = gross − recovered ={" "}
            <span className="font-semibold tabular-nums text-slate-900">{fmtInr(net)}</span>
            {recovered > gross && <span className="text-rose-600">recovered exceeds gross — server caps at gross</span>}
          </div>

          <Field label="Loss types (multi-select)">
            <div className="flex flex-wrap gap-1.5">
              {LOSS_TYPES.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant="ghost"
                  onClick={() => toggleLossType(t)}
                  className={cn(
                    "h-auto rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    lossTypes.includes(t)
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-400"
                  )}
                >
                  {lossTypeLabel(t)}
                </Button>
              ))}
            </div>
          </Field>

          <Field label="Linked risks (multi-select)">
            <Card className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2 shadow-none">
              {risks.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-400">No risks available.</p>
              ) : (
                risks.map((r) => (
                  <Label key={r.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                    <Checkbox
                      checked={linkedRiskIds.includes(r.id)}
                      onChange={() => toggleRisk(r.id)}
                    />
                    <span className="font-medium text-primary-700">{r.riskCode}</span>
                    <span className="truncate text-slate-600">{r.title}</span>
                  </Label>
                ))
              )}
            </Card>
          </Field>

          <Button
            type="button"
            disabled={busy || !valid}
            onClick={submit}
            className="w-full"
          >
            {busy ? "Saving…" : mode === "create" ? "Create loss event" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ analytics }: { analytics: LossAnalytics | null }) {
  if (!analytics) {
    return <p className="py-10 text-center text-sm text-slate-400">Analytics unavailable.</p>;
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Net loss by category */}
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Net loss by category</h2>
          {analytics.netLossByCategory.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">No quantified losses yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, analytics.netLossByCategory.length * 34)}>
              <BarChart data={analytics.netLossByCategory} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => fmtInr(v)} />
                <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 11 }} stroke="#64748b" width={120} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: any) => [fmtInr(Number(v)), "Net loss"]}
                />
                <Bar dataKey="netLoss" radius={[0, 4, 4, 0]}>
                  {analytics.netLossByCategory.map((c, i) => (
                    <Cell key={i} fill={c.colorHex || "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Loss trend by quarter */}
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Loss trend by quarter</h2>
          {analytics.lossTrendByQuarter.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">No trend data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={analytics.lossTrendByQuarter} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => fmtInr(v)} width={70} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: any) => [fmtInr(Number(v)), "Net loss"]}
                />
                <Line type="monotone" dataKey="netLoss" stroke="#C0392B" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Top 10 losses */}
        <Card className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2 shadow-none">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Top 10 losses</h2>
          {analytics.topLosses.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No losses recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 py-2">#</TableHead>
                  <TableHead className="px-2 py-2">Code</TableHead>
                  <TableHead className="px-2 py-2">Title</TableHead>
                  <TableHead className="px-2 py-2">Category</TableHead>
                  <TableHead className="px-2 py-2 text-right">Net loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topLosses.map((l, i) => (
                  <TableRow key={l.eventCode}>
                    <TableCell className="px-2 py-2 font-semibold tabular-nums text-slate-400">{i + 1}</TableCell>
                    <TableCell className="px-2 py-2 font-medium text-slate-700">{l.eventCode}</TableCell>
                    <TableCell className="max-w-[280px] truncate px-2 py-2 text-slate-700">{l.title}</TableCell>
                    <TableCell className="px-2 py-2 text-xs text-slate-500">{l.categoryCode ?? "—"}</TableCell>
                    <TableCell className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">{fmtInr(l.netLoss)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Near-miss potential lane */}
        <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Near-miss potential</h2>
          <p className="mb-3 text-xs text-slate-500">What these near misses could have cost.</p>
          {analytics.nearMissPotential.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No near misses recorded.</p>
          ) : (
            <div className="space-y-2">
              {analytics.nearMissPotential.map((n) => (
                <Alert variant="warning" key={n.eventCode} className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-amber-700">{n.eventCode}</span>
                    <span className="text-sm font-bold tabular-nums text-amber-800">{fmtInr(n.potentialLoss)}</span>
                  </div>
                  <p className="truncate text-xs text-slate-600">{n.title}</p>
                </Alert>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Calibration View */}
      <CalibrationView rows={analytics.calibration} />
    </div>
  );
}

// ── Calibration View (centerpiece) ───────────────────────────────────────────
function CalibrationView({ rows }: { rows: CalibrationRow[] }) {
  const flagRank = (f: string | null) => (f === "UNDERSCORED" ? 0 : f === "WATCH" ? 1 : 2);
  const sorted = [...rows].sort((a, b) => flagRank(a.flag) - flagRank(b.flag));

  return (
    <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-none">
      <h2 className="text-sm font-semibold text-slate-900">Calibration — losses vs residual scoring</h2>
      <p className="mb-3 mt-1 text-xs text-slate-500">
        Underscored = real losses ≥ ₹1 Cr against a LOW/MEDIUM residual; Watch = CRITICAL residual with zero recorded
        losses.
      </p>
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-400">No calibration data yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-3 py-2">Risk</TableHead>
                <TableHead className="px-3 py-2">Title</TableHead>
                <TableHead className="px-3 py-2">Residual</TableHead>
                <TableHead className="px-3 py-2 text-right">Actual net loss (12m)</TableHead>
                <TableHead className="px-3 py-2 text-center">Events</TableHead>
                <TableHead className="px-3 py-2">Calibration</TableHead>
                <TableHead className="px-3 py-2"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => {
                const flagged = r.flag === "UNDERSCORED" || r.flag === "WATCH";
                return (
                  <TableRow
                    key={r.riskId}
                    className={flagged ? "bg-rose-50/30" : ""}
                  >
                    <TableCell className="px-3 py-2 font-medium text-primary-700">{r.riskCode}</TableCell>
                    <TableCell className="max-w-[260px] truncate px-3 py-2 text-slate-700">{r.title}</TableCell>
                    <TableCell className="px-3 py-2">
                      <BandBadge band={r.residualBand} score={r.residualScore} />
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {fmtInr(r.actualNetLoss12m)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center tabular-nums text-slate-600">{r.lossEventCount}</TableCell>
                    <TableCell className="px-3 py-2">
                      {r.flag === "UNDERSCORED" ? (
                        <span className="inline-block rounded border border-rose-300 bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                          Underscored — review
                        </span>
                      ) : r.flag === "WATCH" ? (
                        <span className="inline-block rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          Watch
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Aligned</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      {flagged && (
                        <Link
                          href={`/erm/register/${r.riskId}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-primary-500"
                        >
                          Review risk <ArrowUpRight size={12} />
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
