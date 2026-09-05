"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Clock,
  Download,
  ExternalLink,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { usePermission } from "@/components/auth/can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { downloadCsv, stamp } from "../csv";
import { certificationRegisterCsv } from "../registers-csv";
import { Card } from "@/components/ui/card";
import {
  CERT_STATUS_CHIP,
  CERT_TYPE_LABEL,
  fmtDate,
  fmtNum,
  titleCase,
  type CertificationRegisterResponse,
  type CertificationRegisterRow,
} from "../lib";

// Expiry bands are derived from daysToExpiry (independent of each cert's
// renewalLeadDays) so the filter means the same thing across the whole estate.
type Band = "all" | "valid" | "expiring30" | "expiring90" | "expired" | "renewal";
type SortKey = "factoryName" | "state" | "certificationType" | "status" | "expiryDate" | "daysToExpiry";

// Worst-first ordering so the register surfaces what needs action at the top.
const STATUS_RANK: Record<string, number> = {
  EXPIRED: 0,
  UNDER_RENEWAL: 1,
  EXPIRING_SOON: 2,
  SUSPENDED: 3,
  VALID: 4,
};

const isExpired = (r: CertificationRegisterRow) =>
  r.status === "EXPIRED" || (r.daysToExpiry != null && r.daysToExpiry < 0);

function inBand(r: CertificationRegisterRow, band: Band): boolean {
  switch (band) {
    case "valid":
      return r.status === "VALID";
    case "expiring30":
      return r.daysToExpiry != null && r.daysToExpiry >= 0 && r.daysToExpiry <= 30;
    case "expiring90":
      return r.daysToExpiry != null && r.daysToExpiry >= 0 && r.daysToExpiry <= 90;
    case "expired":
      return isExpired(r);
    case "renewal":
      return r.status === "UNDER_RENEWAL";
    default:
      return true;
  }
}

function Kpi({
  label,
  value,
  sub,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "amber" | "rose" | "emerald" | "sky";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneCls =
    tone === "rose"
      ? "text-rose-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "emerald"
          ? "text-emerald-700"
          : tone === "sky"
            ? "text-sky-700"
            : "text-slate-900";
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={!onClick}
      className={
        "flex h-auto flex-col items-start gap-0 whitespace-normal rounded-xl border bg-white px-3 py-2.5 text-left transition disabled:opacity-100 " +
        (active ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200") +
        (onClick ? " hover:border-slate-300 cursor-pointer" : " cursor-default")
      }
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={"text-lg font-bold tabular-nums " + toneCls}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </Button>
  );
}

function DaysCell({ r }: { r: CertificationRegisterRow }) {
  if (r.daysToExpiry == null) return <span className="text-slate-400">—</span>;
  if (r.daysToExpiry < 0)
    return <span className="font-medium text-rose-600">{Math.abs(r.daysToExpiry)}d ago</span>;
  const tone = r.daysToExpiry <= 30 ? "text-rose-600" : r.daysToExpiry <= 90 ? "text-amber-600" : "text-slate-600";
  return <span className={tone}>in {fmtNum(r.daysToExpiry)}d</span>;
}

export function CertificationsRegisterView({ data }: { data: CertificationRegisterResponse }) {
  const canExport = usePermission("FACILITY.EXPORT");
  const allRows = data.items;

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Filters live in the URL so deep-links from the Factory Profile and the Audit
  // Calendar land pre-filtered, and the back/forward buttons restore the view.
  const q = sp.get("q") ?? "";
  const facility = sp.get("facility"); // factoryCode (from a Factory Profile drill-down)
  const band = (sp.get("band") as Band) || "all";
  const stateParam = sp.get("state") ?? "";
  const typeParam = sp.get("type") ?? "";

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "daysToExpiry", dir: "asc" });
  const [selected, setSelected] = useState<CertificationRegisterRow | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function update(mut: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(Array.from(sp.entries()));
    mut(p);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const setParam = (key: string, val: string | null) =>
    update((p) => (val ? p.set(key, val) : p.delete(key)));
  function toggleInSet(key: string, val: string) {
    const cur = new Set((sp.get(key) ?? "").split(",").filter(Boolean));
    cur.has(val) ? cur.delete(val) : cur.add(val);
    setParam(key, cur.size ? [...cur].join(",") : null);
  }
  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const states = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of allRows) m.set(r.state, (m.get(r.state) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [allRows]);

  const types = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of allRows) m.set(r.certificationType, (m.get(r.certificationType) ?? 0) + 1);
    return [...m.entries()].sort((a, b) =>
      (CERT_TYPE_LABEL[a[0]] ?? a[0]).localeCompare(CERT_TYPE_LABEL[b[0]] ?? b[0]),
    );
  }, [allRows]);

  // KPI counts are over the whole estate so the strip is a stable group overview
  // and a launcher for the expiry bands; the table/export reflect the filters.
  const kpis = useMemo(() => {
    let valid = 0, exp30 = 0, exp90 = 0, expired = 0, renewal = 0;
    for (const r of allRows) {
      if (r.status === "VALID") valid++;
      if (r.status === "UNDER_RENEWAL") renewal++;
      if (isExpired(r)) expired++;
      if (r.daysToExpiry != null && r.daysToExpiry >= 0 && r.daysToExpiry <= 30) exp30++;
      if (r.daysToExpiry != null && r.daysToExpiry >= 0 && r.daysToExpiry <= 90) exp90++;
    }
    return { total: allRows.length, valid, exp30, exp90, expired, renewal };
  }, [allRows]);

  const stateSel = useMemo(() => new Set(stateParam.split(",").filter(Boolean)), [stateParam]);
  const typeSel = useMemo(() => new Set(typeParam.split(",").filter(Boolean)), [typeParam]);

  const rows = useMemo(() => {
    let out = allRows;
    if (facility) out = out.filter((r) => r.factoryCode === facility);
    if (stateSel.size) out = out.filter((r) => stateSel.has(r.state));
    if (typeSel.size) out = out.filter((r) => typeSel.has(r.certificationType));
    if (band !== "all") out = out.filter((r) => inBand(r, band));
    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter(
        (r) =>
          r.factoryName.toLowerCase().includes(needle) ||
          r.factoryCode.toLowerCase().includes(needle) ||
          (r.certificateNo ?? "").toLowerCase().includes(needle) ||
          (r.issuingBody ?? "").toLowerCase().includes(needle) ||
          (CERT_TYPE_LABEL[r.certificationType] ?? r.certificationType).toLowerCase().includes(needle),
      );
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (r: CertificationRegisterRow): number | string => {
      switch (sort.key) {
        case "factoryName":
          return r.factoryName;
        case "state":
          return r.state;
        case "certificationType":
          return CERT_TYPE_LABEL[r.certificationType] ?? r.certificationType;
        case "status":
          return STATUS_RANK[r.status] ?? 9;
        case "expiryDate":
          return r.expiryDate ? new Date(r.expiryDate).getTime() : Number.POSITIVE_INFINITY;
        case "daysToExpiry":
          return r.daysToExpiry ?? Number.POSITIVE_INFINITY;
        default:
          return r.factoryName;
      }
    };
    return [...out].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
  }, [allRows, facility, stateSel, typeSel, band, q, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function exportCsv() {
    const res: CertificationRegisterResponse = {
      items: rows,
      certCount: rows.length,
      expiringWithin90Days: rows.filter((r) => r.daysToExpiry != null && r.daysToExpiry >= 0 && r.daysToExpiry <= 90)
        .length,
      expiredCount: rows.filter(isExpired).length,
    };
    const scope = facility ? `${facility.toLowerCase()}_` : "";
    downloadCsv(`certifications-register_${scope}${stamp()}.csv`, certificationRegisterCsv(res));
  }

  const hasFilters = !!facility || !!stateSel.size || !!typeSel.size || band !== "all" || !!q.trim();

  const bandTabs: { key: Band; label: string; n: number; tone?: string }[] = [
    { key: "all", label: "All", n: kpis.total },
    { key: "valid", label: "Valid", n: kpis.valid },
    { key: "expiring30", label: "Expiring ≤30d", n: kpis.exp30, tone: "amber" },
    { key: "expiring90", label: "Expiring ≤90d", n: kpis.exp90, tone: "amber" },
    { key: "expired", label: "Expired", n: kpis.expired, tone: "rose" },
    { key: "renewal", label: "Under renewal", n: kpis.renewal, tone: "sky" },
  ];

  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <TableHead className={"px-3 py-2.5 " + (className ?? "")}>
      <Button
        type="button"
        variant="ghost"
        onClick={() => toggleSort(k)}
        className="h-auto gap-0.5 p-0 hover:bg-transparent hover:text-slate-700"
      >
        {label}
        {sort.key === k && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </Button>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Roll-up strip — group overview + expiry-band launchers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Total Certifications" value={fmtNum(kpis.total)} sub={`${states.length} states`} />
        <Kpi
          label="Valid"
          value={fmtNum(kpis.valid)}
          tone="emerald"
          active={band === "valid"}
          onClick={() => setParam("band", band === "valid" ? null : "valid")}
        />
        <Kpi
          label="Expiring ≤30d"
          value={fmtNum(kpis.exp30)}
          tone="amber"
          active={band === "expiring30"}
          onClick={() => setParam("band", band === "expiring30" ? null : "expiring30")}
        />
        <Kpi
          label="Expiring ≤90d"
          value={fmtNum(kpis.exp90)}
          tone="amber"
          active={band === "expiring90"}
          onClick={() => setParam("band", band === "expiring90" ? null : "expiring90")}
        />
        <Kpi
          label="Expired"
          value={fmtNum(kpis.expired)}
          tone="rose"
          active={band === "expired"}
          onClick={() => setParam("band", band === "expired" ? null : "expired")}
        />
        <Kpi
          label="Under Renewal"
          value={fmtNum(kpis.renewal)}
          tone="sky"
          active={band === "renewal"}
          onClick={() => setParam("band", band === "renewal" ? null : "renewal")}
        />
      </div>

      {/* Expiry-band segmented control */}
      <div className="flex flex-wrap items-center gap-1.5">
        {bandTabs.map((t) => {
          const on = band === t.key;
          return (
            <Button
              key={t.key}
              type="button"
              variant="ghost"
              onClick={() => setParam("band", t.key === "all" ? null : t.key)}
              className={cn(
                "h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium",
                on
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
            >
              {t.label} <span className="tabular-nums opacity-70">{t.n}</span>
            </Button>
          );
        })}
      </div>

      {/* State + Cert-type multi-select chips */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">State</span>
          {states.map(([s, n]) => {
            const on = stateSel.has(s);
            return (
              <Button
                key={s}
                type="button"
                variant="ghost"
                onClick={() => toggleInSet("state", s)}
                className={cn(
                  "h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  on
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                )}
              >
                {s} <span className="tabular-nums opacity-70">{n}</span>
              </Button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Type</span>
          {types.map(([t, n]) => {
            const on = typeSel.has(t);
            return (
              <Button
                key={t}
                type="button"
                variant="ghost"
                onClick={() => toggleInSet("type", t)}
                className={cn(
                  "h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  on
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                )}
              >
                {CERT_TYPE_LABEL[t] ?? t} <span className="tabular-nums opacity-70">{n}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Search + active-filter chips + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setParam("q", e.target.value || null)}
              placeholder="Search factory, cert no., issuer…"
              className="w-64 pl-8 pr-3"
            />
          </div>
          {facility && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setParam("facility", null)}
              className="h-auto inline-flex items-center gap-1 rounded-full border border-primary-300 bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700 hover:border-primary-400"
              title="Clear the facility filter"
            >
              Facility: {facility} <X size={12} />
            </Button>
          )}
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              onClick={clearAll}
              className="h-auto p-0 text-[11px] font-medium text-slate-500 underline hover:bg-transparent hover:text-slate-700"
            >
              Clear all
            </Button>
          )}
        </div>
        {canExport && (
          <Button
            type="button"
            variant="outline"
            onClick={exportCsv}
            className="gap-1.5 text-slate-700 hover:border-primary-400 hover:text-primary-700"
          >
            <Download size={15} /> Export CSV
          </Button>
        )}
      </div>

      {/* Register table */}
      <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
        <Table className="w-full min-w-[920px] text-sm">
          <TableHeader className="bg-slate-50/95">
            <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <SortHead k="factoryName" label="Facility" />
              <SortHead k="state" label="State" />
              <SortHead k="certificationType" label="Certification" />
              <TableHead className="px-3 py-2.5">Certificate No.</TableHead>
              <TableHead className="px-3 py-2.5">Issued by</TableHead>
              <SortHead k="expiryDate" label="Valid until" />
              <SortHead k="status" label="Status" />
              <SortHead k="daysToExpiry" label="Days to expiry" className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow
                key={`${r.factoryProfileId}-${r.certificationType}-${r.certificateNo ?? i}`}
                onClick={() => setSelected(r)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/70"
              >
                <TableCell className="px-3 py-2.5">
                  <Link
                    href={`/facilities/${r.factoryProfileId}?tab=Certifications`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-primary-700 hover:underline"
                  >
                    {r.factoryName}
                  </Link>
                  <span className="block text-[10px] text-slate-400">{r.factoryCode}</span>
                </TableCell>
                <TableCell className="px-3 py-2.5 text-slate-600">{r.state}</TableCell>
                <TableCell className="px-3 py-2.5 font-medium text-slate-700">
                  {CERT_TYPE_LABEL[r.certificationType] ?? r.certificationType}
                </TableCell>
                <TableCell className="px-3 py-2.5 font-mono text-xs text-slate-500">{r.certificateNo ?? "—"}</TableCell>
                <TableCell className="px-3 py-2.5 text-xs text-slate-500">{r.issuingBody ?? "—"}</TableCell>
                <TableCell className="px-3 py-2.5 text-slate-600">{fmtDate(r.expiryDate)}</TableCell>
                <TableCell className="px-3 py-2.5">
                  <span className={"inline-block rounded border px-2 py-0.5 text-[11px] font-medium " + (CERT_STATUS_CHIP[r.status] ?? "")}>
                    {titleCase(r.status)}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2.5 text-right text-xs tabular-nums">
                  <DaysCell r={r} />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="px-3 py-10 text-center text-sm text-slate-400">
                  {hasFilters ? "No certifications match these filters." : "No certifications recorded yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Footer summary */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={13} /> Showing {fmtNum(rows.length)} of {fmtNum(allRows.length)} certifications
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={13} className="text-amber-600" /> {fmtNum(kpis.exp90)} expiring within 90 days
        </span>
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle size={13} className="text-rose-600" /> {fmtNum(kpis.expired)} expired
        </span>
      </div>

      {selected && <DetailPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

function DetailPanel({ row, onClose }: { row: CertificationRegisterRow; onClose: () => void }) {
  const daysLine =
    row.daysToExpiry == null
      ? "No expiry recorded"
      : row.daysToExpiry < 0
        ? `Expired ${Math.abs(row.daysToExpiry)} days ago`
        : `${fmtNum(row.daysToExpiry)} days remaining`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl sm:w-[40vw] sm:min-w-[420px] sm:max-w-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              {CERT_TYPE_LABEL[row.certificationType] ?? row.certificationType}
            </div>
            <div className="text-sm text-slate-500">
              {row.factoryName} <span className="text-slate-400">· {row.factoryCode}</span>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </Button>
        </div>

        <div className="px-5 py-3">
          <span className={"inline-block rounded border px-2 py-0.5 text-[11px] font-medium " + (CERT_STATUS_CHIP[row.status] ?? "")}>
            {titleCase(row.status)}
          </span>
        </div>

        <Section title="Identity & statutory">
          <PanelRow label="Certificate no.">
            <span className="font-mono text-xs">{row.certificateNo ?? "—"}</span>
          </PanelRow>
          <PanelRow label="Issued by">{row.issuingBody ?? "—"}</PanelRow>
          <PanelRow label="State">{row.state}</PanelRow>
          <PanelRow label="Scope">{row.scopeNotes ?? "—"}</PanelRow>
        </Section>

        <Section title="Validity">
          <PanelRow label="Valid from">{fmtDate(row.issueDate)}</PanelRow>
          <PanelRow label="Valid until">{fmtDate(row.expiryDate)}</PanelRow>
          <PanelRow label="Days remaining">
            <span
              className={
                row.daysToExpiry == null
                  ? "text-slate-400"
                  : row.daysToExpiry < 0
                    ? "font-medium text-rose-600"
                    : row.daysToExpiry <= 90
                      ? "font-medium text-amber-700"
                      : "text-slate-700"
              }
            >
              {daysLine}
            </span>
          </PanelRow>
        </Section>

        <Section title="Renewal">
          <Card className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500 shadow-none">
            <CalendarClock size={15} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              Linking renewals to a scheduled audit on the CAMS Audit Calendar is a planned follow-up. For now, renewal
              audits are scheduled from the CAMS module and this certificate is updated from the Factory Profile.
            </span>
          </Card>
        </Section>

        <div className="mt-auto border-t border-slate-100 px-5 py-4">
          <Link
            href={`/facilities/${row.factoryProfileId}?tab=Certifications&editCert=${encodeURIComponent(row.certId)}`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Edit in Factory Profile <ExternalLink size={15} />
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </div>
  );
}
