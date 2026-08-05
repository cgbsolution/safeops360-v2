"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  HardHat,
  LayoutDashboard,
  Package,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UserCheck,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import type {
  CatalogType,
  DashboardData,
  DueRow,
  InspectionsDue,
  Issuance,
  Item,
  PeopleCompliance,
  Person,
  Recipient,
} from "./page";

type TabKey = "dashboard" | "items" | "people" | "due" | "issuances" | "catalog";

type Modal =
  | { kind: "issue"; item?: Item; recipient?: Person; typeCode?: string }
  | { kind: "return"; issuance: Issuance }
  | { kind: "inspect"; item: Item }
  | { kind: "retire"; item: Item }
  | { kind: "commission" }
  | null;

export function PpeTabs(props: {
  plantId: string;
  dashboard: DashboardData | null;
  items: Item[];
  issuances: Issuance[];
  due: InspectionsDue | null;
  people: PeopleCompliance | null;
  catalog: CatalogType[];
  recipients: Recipient[];
  initialTab?: string;
}) {
  const { plantId, dashboard, items, issuances, due, people, catalog, recipients } = props;
  const isTabKey = (v: string | undefined): v is TabKey =>
    v === "dashboard" || v === "items" || v === "people" || v === "due" || v === "issuances" || v === "catalog";
  const [tab, setTab] = useState<TabKey>(isTabKey(props.initialTab) ? props.initialTab : "dashboard");
  const [modal, setModal] = useState<Modal>(null);

  const TABS: { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={14} /> },
    { key: "items", label: "Items", icon: <Boxes size={14} />, badge: items.length },
    { key: "people", label: "People Compliance", icon: <UserCheck size={14} />, badge: people?.summary.criticalGaps || undefined },
    { key: "due", label: "Inspections Due", icon: <Clock size={14} />, badge: due?.counts.overdue || undefined },
    { key: "issuances", label: "Issuances", icon: <ClipboardCheck size={14} /> },
    { key: "catalog", label: "Catalog", icon: <HardHat size={14} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5">
          {TABS.map((t) => (
            <Button
              key={t.key}
              type="button"
              variant="ghost"
              onClick={() => setTab(t.key)}
              className={cn(
                "h-auto inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition",
                tab === t.key ? "bg-cyan-700 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {t.icon}
              {t.label}
              {t.badge ? (
                <span className={cn("ml-1 rounded-full px-1.5 text-[10px] font-semibold",
                  tab === t.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
                  {t.badge}
                </span>
              ) : null}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => setModal({ kind: "issue" })} className="gap-1.5">
            <UserCheck size={14} /> Issue PPE
          </Button>
          <Button type="button" variant="outline" onClick={() => setModal({ kind: "commission" })} className="gap-1.5 text-slate-700">
            <Plus size={14} /> Add Item
          </Button>
          <a href={`/api/ppe/reports/people-compliance.csv?plantId=${plantId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Export
          </a>
        </div>
      </div>

      {tab === "dashboard" && <DashboardView d={dashboard} onJump={setTab} />}
      {tab === "items" && <ItemsView items={items} onAct={setModal} />}
      {tab === "people" && <PeopleView people={people} onIssue={(p, code) => setModal({ kind: "issue", recipient: p, typeCode: code })} />}
      {tab === "due" && <DueView due={due} onInspect={(id) => {
        const it = items.find((x) => x.id === id);
        if (it) setModal({ kind: "inspect", item: it });
      }} />}
      {tab === "issuances" && <IssuancesView issuances={issuances} onReturn={(i) => setModal({ kind: "return", issuance: i })} />}
      {tab === "catalog" && <CatalogView catalog={catalog} plantId={plantId} />}

      {modal && (
        <ActionModal
          plantId={plantId}
          modal={modal}
          items={items}
          people={recipients}
          catalog={catalog}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── Chips ───────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, string> = {
  in_stock: "bg-slate-100 text-slate-700",
  issued: "bg-sky-100 text-sky-800",
  under_inspection: "bg-indigo-100 text-indigo-800",
  under_repair: "bg-amber-100 text-amber-800",
  quarantined: "bg-amber-100 text-amber-900",
  retired: "bg-slate-100 text-slate-400",
  lost: "bg-rose-100 text-rose-700",
  stolen: "bg-rose-100 text-rose-700",
  recalled: "bg-rose-100 text-rose-700",
};
const VALIDITY_CHIP: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-900",
  block: "bg-rose-100 text-rose-700",
  recommended: "bg-slate-100 text-slate-500",
};
const OVERALL_CHIP: Record<string, { c: string; label: string; icon: React.ReactNode }> = {
  compliant: { c: "bg-emerald-100 text-emerald-800", label: "Compliant", icon: <CheckCircle2 size={12} /> },
  gaps: { c: "bg-amber-100 text-amber-900", label: "Gaps", icon: <AlertTriangle size={12} /> },
  critical: { c: "bg-rose-100 text-rose-700", label: "Critical", icon: <XCircle size={12} /> },
};

function Chip({ map, value, label }: { map: Record<string, string>; value: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", map[value] ?? "bg-slate-100 text-slate-600")}>
      {(label ?? value).replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Dashboard ───────────────────────────────────────────────────────────

function DashboardView({ d, onJump }: { d: DashboardData | null; onJump: (t: TabKey) => void }) {
  if (!d) return <Empty>Dashboard unavailable.</Empty>;
  const c = d.cards;
  const cards = [
    { label: "Items in service", value: c.itemsInService, tone: "slate", icon: <Package size={18} />, to: "items" as TabKey },
    { label: "Inspection overdue", value: c.inspectionOverdue, tone: c.inspectionOverdue > 0 ? "rose" : "slate", icon: <Clock size={18} />, to: "due" as TabKey },
    { label: "Approaching service-life (90d)", value: c.approachingServiceLife, tone: c.approachingServiceLife > 0 ? "amber" : "slate", icon: <AlertTriangle size={18} />, to: "items" as TabKey },
    { label: "People with compliance gaps", value: c.complianceGaps, tone: c.complianceGaps > 0 ? "rose" : "slate", icon: <UserCheck size={18} />, to: "people" as TabKey },
    { label: "Active recalls", value: c.activeRecalls, tone: c.activeRecalls > 0 ? "rose" : "slate", icon: <ShieldAlert size={18} />, to: "items" as TabKey },
    { label: "Under repair / quarantine", value: c.underRepairQuarantine, tone: "amber", icon: <Wrench size={18} />, to: "items" as TabKey },
    { label: "Overdue returns", value: c.overdueReturns, tone: c.overdueReturns > 0 ? "amber" : "slate", icon: <RotateCcw size={18} />, to: "issuances" as TabKey },
  ];
  const tone: Record<string, string> = {
    slate: "border-slate-200 bg-white text-slate-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };
  const s = d.compliance;
  const total = Math.max(1, s.totalPeople);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => (
          <Button key={card.label} type="button" variant="ghost" onClick={() => onJump(card.to)}
            className={cn("flex h-auto flex-col items-stretch gap-0 whitespace-normal rounded-xl border p-4 text-left transition hover:shadow-sm", tone[card.tone])}>
            <div className="flex items-center justify-between">
              <span className="opacity-70">{card.icon}</span>
              <span className="text-2xl font-extrabold tabular-nums">{card.value}</span>
            </div>
            <div className="mt-2 text-xs font-medium opacity-80">{card.label}</div>
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <BadgeCheck size={16} className="text-cyan-700" /> Workforce PPE compliance
          <span className="ml-auto text-xs font-normal text-slate-500">{s.totalPeople} people with PPE requirements</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="bg-emerald-500" style={{ width: `${(s.compliant / total) * 100}%` }} />
          <div className="bg-amber-400" style={{ width: `${(s.gaps / total) * 100}%` }} />
          <div className="bg-rose-500" style={{ width: `${(s.criticalGaps / total) * 100}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <Legend color="bg-emerald-500" label="Compliant" value={s.compliant} />
          <Legend color="bg-amber-400" label="Gaps" value={s.gaps} />
          <Legend color="bg-rose-500" label="Critical gaps" value={s.criticalGaps} />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} /> {label} <span className="font-semibold text-slate-900">{value}</span>
    </span>
  );
}

// ─── Items ───────────────────────────────────────────────────────────────

function ItemsView({ items, onAct }: { items: Item[]; onAct: (m: Modal) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const filtered = useMemo(() => {
    return items.filter((i) =>
      (!status || i.status === status) &&
      (!q || `${i.itemNumber} ${i.serialNumber} ${i.ppeTypeName}`.toLowerCase().includes(q.toLowerCase()))
    );
  }, [items, q, status]);
  const statuses = Array.from(new Set(items.map((i) => i.status)));

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item / serial / type…" className="w-64" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </Select>
        <span className="ml-auto text-xs text-slate-500">{filtered.length} items</span>
      </div>
      <div className="overflow-x-auto">
        <Table className="w-full text-sm">
          <TableHeader className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <TableRow>
              <TableHead className="px-3 py-2 text-left">Item</TableHead>
              <TableHead className="px-3 py-2 text-left">Type</TableHead>
              <TableHead className="px-3 py-2 text-left">Status</TableHead>
              <TableHead className="px-3 py-2 text-left">Validity</TableHead>
              <TableHead className="px-3 py-2 text-left">Inspection</TableHead>
              <TableHead className="px-3 py-2 text-left">Service life</TableHead>
              <TableHead className="px-3 py-2 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {filtered.map((i) => (
              <TableRow key={i.id} className="hover:bg-slate-50">
                <TableCell className="px-3 py-2">
                  <Link href={`/ppe/items/${i.id}`} className="font-medium text-cyan-800 hover:underline">{i.itemNumber}</Link>
                  <div className="text-[11px] text-slate-400">{i.serialNumber}</div>
                </TableCell>
                <TableCell className="px-3 py-2 text-slate-700">{i.ppeTypeName}</TableCell>
                <TableCell className="px-3 py-2"><Chip map={STATUS_CHIP} value={i.status} /></TableCell>
                <TableCell className="px-3 py-2"><Chip map={VALIDITY_CHIP} value={i.validity} label={i.validity === "pass" ? "valid" : i.validityReason} /></TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  <Chip map={VALIDITY_CHIP} value={i.inspectionStatus === "overdue" ? "block" : i.inspectionStatus === "due_soon" ? "warn" : "pass"}
                    label={i.inspectionStatus === "overdue" ? `overdue ${i.inspectionOverdueDays}d` : i.inspectionStatus.replace(/_/g, " ")} />
                  <div className="mt-0.5 text-[11px] text-slate-400">{fmtDate(i.nextInspectionDueDate)}</div>
                </TableCell>
                <TableCell className="px-3 py-2 text-xs text-slate-600">
                  {i.serviceLifeExceeded ? <span className="text-rose-600 font-medium">exceeded</span> : `${i.serviceLifeRemainingDays}d left`}
                  <div className="text-[11px] text-slate-400">{fmtDate(i.serviceLifeEndDate)}</div>
                </TableCell>
                <TableCell className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    {i.status === "in_stock" && (
                      <IconBtn title="Issue" onClick={() => onAct({ kind: "issue", item: i })}><UserCheck size={14} /></IconBtn>
                    )}
                    {i.status !== "retired" && (
                      <IconBtn title="Inspect" onClick={() => onAct({ kind: "inspect", item: i })}><ClipboardCheck size={14} /></IconBtn>
                    )}
                    {i.status !== "retired" && (
                      <IconBtn title="Retire" onClick={() => onAct({ kind: "retire", item: i })}><Trash2 size={14} /></IconBtn>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="p-8 text-center text-sm text-slate-400">No items.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── People Compliance ───────────────────────────────────────────────────

function PeopleView({ people, onIssue }: { people: PeopleCompliance | null; onIssue: (p: Person, typeCode?: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  if (!people) return <Empty>People compliance unavailable.</Empty>;
  const rows = filter ? people.people.filter((p) => p.overall === filter) : people.people;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["", "critical", "gaps", "compliant"] as const).map((f) => (
          <Button key={f || "all"} type="button" variant="ghost" onClick={() => setFilter(f)}
            className={cn("h-auto rounded-full px-3 py-1 text-xs font-medium transition",
              filter === f ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
            {f === "" ? `All (${people.summary.totalPeople})` : f === "critical" ? `Critical (${people.summary.criticalGaps})` : f === "gaps" ? `Gaps (${people.summary.gaps})` : `Compliant (${people.summary.compliant})`}
          </Button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {rows.map((p) => {
          const o = OVERALL_CHIP[p.overall];
          const open = expanded === p.userId;
          return (
            <div key={p.userId}>
              <Button type="button" variant="ghost" onClick={() => setExpanded(open ? null : p.userId)}
                className="h-auto w-full items-center justify-start gap-3 rounded-none px-4 py-3 text-left font-normal hover:bg-slate-50">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", o.c)}>{o.icon}{o.label}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900">{p.name}</div>
                  <div className="text-[11px] text-slate-500">{p.role?.replace(/_/g, " ")} · {p.department}</div>
                </div>
                <div className="hidden gap-1 sm:flex">
                  {p.requirements.map((r) => (
                    <span key={r.ppeTypeCode} title={`${r.ppeTypeName}: ${r.reason}`}
                      className={cn("h-2.5 w-2.5 rounded-full",
                        r.status === "pass" ? "bg-emerald-500" : r.status === "warn" ? "bg-amber-400" : r.status === "block" ? "bg-rose-500" : "bg-slate-300")} />
                  ))}
                </div>
              </Button>
              {open && (
                <div className="bg-slate-50/60 px-4 pb-3">
                  <Table className="w-full text-sm">
                    <TableBody className="divide-y divide-slate-100">
                      {p.requirements.map((r) => (
                        <TableRow key={r.ppeTypeCode}>
                          <TableCell className="py-1.5 text-slate-700">{r.ppeTypeName}
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">{r.requirementLevel}</span>
                          </TableCell>
                          <TableCell className="py-1.5 text-xs text-slate-500">{r.held ? `${r.itemNumber} · ${r.serialNumber}` : "—"}</TableCell>
                          <TableCell className="py-1.5"><Chip map={VALIDITY_CHIP} value={r.status} label={r.status === "pass" ? "valid" : r.reason} /></TableCell>
                          <TableCell className="py-1.5 text-right">
                            {!r.held && r.status !== "recommended" && (
                              <Button type="button" size="sm" onClick={() => onIssue(p, r.ppeTypeCode)} className="text-[11px]">Issue</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No people in this filter.</div>}
      </div>
    </div>
  );
}

// ─── Inspections Due ─────────────────────────────────────────────────────

function DueView({ due, onInspect }: { due: InspectionsDue | null; onInspect: (id: string) => void }) {
  if (!due) return <Empty>Inspections-due data unavailable.</Empty>;
  const groups: { key: keyof InspectionsDue["buckets"]; label: string; tone: string }[] = [
    { key: "overdue", label: "Overdue", tone: "border-rose-200 bg-rose-50" },
    { key: "this_week", label: "Due this week", tone: "border-amber-200 bg-amber-50" },
    { key: "this_month", label: "Due this month", tone: "border-yellow-200 bg-yellow-50" },
    { key: "upcoming", label: "Coming up (90d)", tone: "border-slate-200 bg-slate-50" },
  ];
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const rows = due.buckets[g.key];
        if (rows.length === 0) return null;
        return (
          <div key={g.key} className={cn("rounded-xl border", g.tone)}>
            <div className="border-b border-black/5 px-4 py-2 text-sm font-semibold text-slate-800">{g.label} <span className="text-slate-400">({rows.length})</span></div>
            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableBody className="divide-y divide-black/5">
                  {rows.map((r: DueRow) => (
                    <TableRow key={r.id} className="hover:bg-white/40">
                      <TableCell className="px-4 py-2">
                        <Link href={`/ppe/items/${r.id}`} className="font-medium text-cyan-800 hover:underline">{r.itemNumber}</Link>
                        <span className="ml-2 text-slate-600">{r.ppeTypeName}</span>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-xs text-slate-500">{r.serialNumber}</TableCell>
                      <TableCell className="px-4 py-2 text-xs text-slate-600">{fmtDate(r.nextInspectionDueDate)}</TableCell>
                      <TableCell className="px-4 py-2 text-xs font-medium text-slate-700">
                        {r.overdueDays != null ? <span className="text-rose-600">{r.overdueDays}d overdue</span> : `in ${r.daysUntilDue}d`}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => onInspect(r.id)} className="text-[11px] text-slate-700">Inspect</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
      {Object.values(due.counts).every((n) => n === 0) && <Empty>No inspections due in the next 90 days. 🎉</Empty>}
    </div>
  );
}

// ─── Issuances ───────────────────────────────────────────────────────────

function IssuancesView({ issuances, onReturn }: { issuances: Issuance[]; onReturn: (i: Issuance) => void }) {
  const [showReturned, setShowReturned] = useState(false);
  const rows = showReturned ? issuances : issuances.filter((i) => i.status === "active");
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b p-3">
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <Checkbox checked={showReturned} onChange={(e) => setShowReturned(e.target.checked)} /> Include closed
        </label>
        <span className="ml-auto text-xs text-slate-500">{rows.length} issuances</span>
      </div>
      <div className="overflow-x-auto">
        <Table className="w-full text-sm">
          <TableHeader className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <TableRow>
              <TableHead className="px-3 py-2 text-left">Issuance</TableHead>
              <TableHead className="px-3 py-2 text-left">Item</TableHead>
              <TableHead className="px-3 py-2 text-left">Holder</TableHead>
              <TableHead className="px-3 py-2 text-left">Purpose</TableHead>
              <TableHead className="px-3 py-2 text-left">Issued</TableHead>
              <TableHead className="px-3 py-2 text-left">Status</TableHead>
              <TableHead className="px-3 py-2 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {rows.map((i) => (
              <TableRow key={i.id} className="hover:bg-slate-50">
                <TableCell className="px-3 py-2 font-medium text-slate-800">{i.issuanceNumber}</TableCell>
                <TableCell className="px-3 py-2 text-slate-700">{i.ppeTypeName}<div className="text-[11px] text-slate-400">{i.serialNumber}</div></TableCell>
                <TableCell className="px-3 py-2 text-slate-700">{i.issuedToName}<div className="text-[11px] text-slate-400">{i.issuedToDepartment}</div></TableCell>
                <TableCell className="px-3 py-2 text-xs text-slate-600">{i.purpose.replace(/_/g, " ")}</TableCell>
                <TableCell className="px-3 py-2 text-xs text-slate-500">{fmtDate(i.issuedAt)}</TableCell>
                <TableCell className="px-3 py-2">
                  {i.overdueReturn
                    ? <Chip map={{ x: "bg-amber-100 text-amber-900" }} value="x" label="return overdue" />
                    : <Chip map={{ active: "bg-sky-100 text-sky-800", returned: "bg-slate-100 text-slate-500", damaged_return: "bg-rose-100 text-rose-700", lost: "bg-rose-100 text-rose-700", stolen: "bg-rose-100 text-rose-700" }} value={i.status} />}
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  {i.status === "active" && (
                    <Button type="button" variant="outline" size="sm" onClick={() => onReturn(i)} className="gap-1 text-[11px] text-slate-700">
                      <RotateCcw size={12} /> Return
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="p-8 text-center text-sm text-slate-400">No issuances.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Catalog ─────────────────────────────────────────────────────────────

function CatalogView({ catalog, plantId }: { catalog: CatalogType[]; plantId: string }) {
  const byCat = useMemo(() => {
    const m: Record<string, CatalogType[]> = {};
    for (const t of catalog) (m[t.category] ??= []).push(t);
    return m;
  }, [catalog]);
  return (
    <div className="space-y-5">
      {Object.entries(byCat).map(([cat, types]) => (
        <div key={cat}>
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-700">{cat.replace(/_/g, " ")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((t) => (
              <Link key={t.code} href={`/ppe/catalog/${encodeURIComponent(t.code)}?plantId=${plantId}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">{t.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{t.code}</div>
                  </div>
                  {t.statutoryProvisionRequired && <span className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">Statutory</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span>Life {t.serviceLifeYears}y</span>
                  <span>{t.itemsInService} in service</span>
                  {t.itemsOverdue > 0 && <span className="text-rose-600">{t.itemsOverdue} overdue</span>}
                  {t.requiresCompetencyToUse && <span className="text-amber-700">Needs {t.requiresCompetencyToUse}</span>}
                </div>
                {t.enablesPermitTypes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.enablesPermitTypes.map((p) => <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{p.replace(/_/g, " ")}</span>)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
      {catalog.length === 0 && <Empty>Catalog is empty.</Empty>}
    </div>
  );
}

// ─── Action modal ────────────────────────────────────────────────────────

function ActionModal({
  plantId, modal, items, people, catalog, onClose,
}: {
  plantId: string;
  modal: Exclude<Modal, null>;
  items: Item[];
  // Every person at the plant — recipients must not depend on the (possibly
  // empty) People Compliance result.
  people: Recipient[];
  catalog: CatalogType[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Non-blocking warning returned by a SUCCESSFUL request (e.g. commissioned
  // stock already past its service life) — keep the modal open so it's seen.
  const [notice, setNotice] = useState<string | null>(null);

  // form state
  const [itemId, setItemId] = useState(modal.kind === "issue" ? modal.item?.id ?? "" : modal.kind === "inspect" || modal.kind === "retire" ? modal.item.id : "");
  const [toUserId, setToUserId] = useState(modal.kind === "issue" ? modal.recipient?.userId ?? "" : "");
  const [purpose, setPurpose] = useState("personal_assignment");
  const [condition, setCondition] = useState("good");
  const [result, setResult] = useState("pass");
  const [reason, setReason] = useState("");
  // commission
  const [typeId, setTypeId] = useState(catalog[0] ? "" : "");
  const [qty, setQty] = useState(1);
  const [manufacturer, setManufacturer] = useState("");
  const [batch, setBatch] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [storage, setStorage] = useState("");

  const inStock = useMemo(() => {
    const base = items.filter((i) => i.status === "in_stock");
    if (modal.kind === "issue" && modal.typeCode) return base.filter((i) => i.ppeTypeCode === modal.typeCode);
    return base;
  }, [items, modal]);

  async function submit() {
    setError(null);
    let path = "";
    let body: Record<string, unknown> = {};
    if (modal.kind === "issue") {
      if (!itemId || !toUserId) { setError("Select an item and a recipient."); return; }
      path = `/api/ppe/items/${itemId}/issue`;
      body = { toUserId, purpose };
    } else if (modal.kind === "return") {
      path = `/api/ppe/issuances/${modal.issuance.id}/return`;
      body = { conditionAtReturn: condition };
    } else if (modal.kind === "inspect") {
      path = `/api/ppe/items/${modal.item.id}/inspect`;
      body = { overallResult: result, inspectionType: "periodic", trigger: "scheduled" };
    } else if (modal.kind === "retire") {
      if (!reason.trim()) { setError("A retirement reason is required."); return; }
      path = `/api/ppe/items/${modal.item.id}/retire`;
      body = { reason };
    } else if (modal.kind === "commission") {
      const t = catalog.find((c) => c.id === typeId);
      if (!t) { setError("Select a PPE type."); return; }
      if (!mfgDate) { setError("Manufacture date is required."); return; }
      path = `/api/ppe/items/commission`;
      body = {
        plantId, ppeTypeId: t.id, quantity: qty, manufacturer, batchLotNumber: batch,
        manufactureDate: new Date(mfgDate).toISOString(), storageLocation: storage,
      };
    }
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.detail || j.error || `Request failed (${res.status})`);
        return;
      }
      const j = await res.json().catch(() => ({} as { warning?: string }));
      if (j.warning) {
        setNotice(j.warning);
        startTransition(() => router.refresh());
        return;
      }
      startTransition(() => { router.refresh(); onClose(); });
    } catch (e) {
      setError(String(e));
    }
  }

  const titles: Record<string, string> = {
    issue: "Issue PPE", return: "Record Return", inspect: "Record Inspection", retire: "Retire Item", commission: "Commission Items (Goods Receipt)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{titles[modal.kind]}</h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-slate-400"><X size={16} /></Button>
        </div>

        <div className="space-y-3 text-sm">
          {modal.kind === "issue" && (
            <>
              <Field label="PPE item (in stock)">
                <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
                  <option value="">Select an item…</option>
                  {inStock.map((i) => <option key={i.id} value={i.id}>{i.itemNumber} — {i.ppeTypeName}</option>)}
                </Select>
              </Field>
              <Field label="Issue to">
                <Select value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
                  <option value="">Select a person…</option>
                  {people.map((p) => <option key={p.userId} value={p.userId}>{p.name} — {p.role?.replace(/_/g, " ")}</option>)}
                </Select>
              </Field>
              <Field label="Purpose">
                <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                  {["personal_assignment", "permit_task", "training", "temporary_loan"].map((p) => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
                </Select>
              </Field>
            </>
          )}

          {modal.kind === "return" && (
            <>
              <p className="text-slate-600">Returning <span className="font-medium">{modal.issuance.serialNumber}</span> from {modal.issuance.issuedToName}.</p>
              <Field label="Condition at return">
                <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
                  {["good", "fair", "damaged", "destroyed"].map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </>
          )}

          {modal.kind === "inspect" && (
            <>
              <p className="text-slate-600">Inspecting <span className="font-medium">{modal.item.itemNumber}</span> — {modal.item.ppeTypeName}.</p>
              <Field label="Overall result">
                <Select value={result} onChange={(e) => setResult(e.target.value)}>
                  <option value="pass">Pass — return to service</option>
                  <option value="conditional_pass">Conditional pass</option>
                  <option value="fail">Fail — quarantine</option>
                </Select>
              </Field>
            </>
          )}

          {modal.kind === "retire" && (
            <>
              <p className="text-slate-600">Retiring <span className="font-medium">{modal.item.itemNumber}</span>. This is permanent.</p>
              <Field label="Reason">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. service life reached" />
              </Field>
            </>
          )}

          {modal.kind === "commission" && (
            <>
              <Field label="PPE type">
                <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                  <option value="">Select a type…</option>
                  {catalog.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity"><Input type="number" min={1} max={200} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
                <Field label="Manufacture date"><Input type="date" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Manufacturer"><Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} /></Field>
                <Field label="Batch / lot"><Input value={batch} onChange={(e) => setBatch(e.target.value)} /></Field>
              </div>
              <Field label="Storage location"><Input value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="Safety Store — Rack…" /></Field>
            </>
          )}

          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
          {notice && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Saved — {notice}</div>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {notice ? (
            <Button type="button" onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose} className="text-slate-600">Cancel</Button>
              <Button type="button" onClick={submit} disabled={pending}>
                {pending ? "Saving…" : "Confirm"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Small shared bits ───────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="outline" size="icon" title={title} onClick={onClick}
      className="h-7 w-7 text-slate-500 hover:text-slate-700">{children}</Button>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{children}</div>;
}
