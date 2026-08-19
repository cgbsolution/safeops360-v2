"use client";

// Register of Fire Extinguishers — PIL/EHSD/CL/028-R1, on screen.
//
// The sixteen columns of the source sheet, in the sheet's own order, so an
// auditor reading the screen and an auditor reading the paper are reading the
// same document.
//
// THREE BADGES, NOT ONE
// ---------------------
// Cylinder life, HP test and refill expire independently, and a single roll-up
// per row would hide which of them is the problem — which is the only question
// worth asking of a due-date register. So each date carries its own badge, and
// the row-level `worstBadge` is used only for filtering and the header counts.
//
// "Not recorded" is deliberately not green. A cylinder with no refill date on
// file is a gap in the register, and a register that paints its own gaps as
// compliance is worse than no register at all.

import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, FileDown, Pencil } from "lucide-react";
import {
  BADGE_STYLE,
  Badge,
  BadgeStatus,
  MX,
  RegisterPayload,
  RegisterRow,
  fmtDate,
} from "../lib";
import { RegisterDialog } from "./register-dialog";

function DueCell({ badge, iso }: { badge: Badge; iso: string | null }) {
  const st = BADGE_STYLE[badge.status];
  const days = badge.daysRemaining;
  const hint =
    badge.status === "NOT_RECORDED"
      ? "No date on file"
      : days === null
        ? ""
        : days < 0
          ? `${Math.abs(days)} day(s) overdue`
          : `${days} day(s) remaining`;
  return (
    <td className="whitespace-nowrap border-b px-2 py-1.5" style={{ borderColor: MX.iceLine }} title={hint}>
      <span
        className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
        style={{ background: st.bg, color: st.fg }}
      >
        {badge.status === "NOT_RECORDED" ? "not recorded" : fmtDate(iso)}
      </span>
    </td>
  );
}

const SORTS = {
  location: (a: RegisterRow, b: RegisterRow) => a.location.localeCompare(b.location),
  tag: (a: RegisterRow, b: RegisterRow) => (a.allottedSerialNo ?? "").localeCompare(b.allottedSerialNo ?? ""),
  // Most-urgent-first, which is the order the register is actually used in when
  // someone is working a due list rather than reading it as a document.
  urgency: (a: RegisterRow, b: RegisterRow) => {
    const rank: Record<BadgeStatus, number> = { OVERDUE: 0, DUE_SOON: 1, NOT_RECORDED: 2, OK: 3 };
    return rank[a.worstBadge] - rank[b.worstBadge] || a.location.localeCompare(b.location);
  },
} as const;

type SortKey = keyof typeof SORTS;

export function RegisterTable({
  payload,
  plants,
  canWrite = true,
}: {
  payload: RegisterPayload;
  plants: { id: string; code: string; name: string }[];
  canWrite?: boolean;
}) {
  const [filter, setFilter] = React.useState<BadgeStatus | null>(null);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("location");
  const [editing, setEditing] = React.useState<RegisterRow | null>(null);
  const [open, setOpen] = React.useState(false);

  const rows = React.useMemo(() => {
    let out = payload.rows;
    if (filter) out = out.filter((r) => r.worstBadge === filter);
    const n = query.trim().toLowerCase();
    if (n) {
      out = out.filter(
        (r) =>
          (r.allottedSerialNo ?? "").toLowerCase().includes(n) ||
          (r.serialNo ?? "").toLowerCase().includes(n) ||
          r.location.toLowerCase().includes(n) ||
          (r.type ?? "").toLowerCase().includes(n),
      );
    }
    return [...out].sort(SORTS[sort]);
  }, [payload.rows, filter, query, sort]);

  const chips: { key: BadgeStatus; n: number }[] = [
    { key: "OVERDUE", n: payload.summary.overdue },
    { key: "DUE_SOON", n: payload.summary.dueSoon },
    { key: "NOT_RECORDED", n: payload.summary.notRecorded },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {chips.map((c) => {
          const st = BADGE_STYLE[c.key];
          const on = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(on ? null : c.key)}
              className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-opacity"
              style={{
                background: st.bg,
                color: st.fg,
                border: `1.5px solid ${on ? st.fg : "transparent"}`,
              }}
            >
              {st.label} · {c.n}
            </button>
          );
        })}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Serial, tag, type or location"
          className="rounded-lg border px-2.5 py-1.5 text-[12px] outline-none"
          style={{ borderColor: MX.iceLine, color: MX.ink, minWidth: 210 }}
        />

        <button
          type="button"
          onClick={() => setSort(sort === "location" ? "urgency" : sort === "urgency" ? "tag" : "location")}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px]"
          style={{ borderColor: MX.iceLine, color: MX.navy }}
          title="Cycle sort order"
        >
          <ArrowUpDown size={12} />
          {sort === "location" ? "Location" : sort === "urgency" ? "Most urgent" : "Allotted no."}
        </button>

        <span className="text-[11.5px]" style={{ color: MX.muted }}>
          {rows.length} of {payload.summary.total}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="/api/fire/register/extinguishers/export.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium"
            style={{ borderColor: MX.iceLine, color: MX.navy }}
          >
            <FileDown size={13} /> PDF
          </a>
          {canWrite && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white"
              style={{ background: MX.navy }}
            >
              Add extinguisher
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: MX.iceLine }}>
        <table className="w-full min-w-[1320px] border-collapse text-[12px]">
          <thead>
            <tr style={{ background: MX.ice }}>
              {[
                "Sl.",
                "Mfr Serial No.",
                "Type",
                "Capacity",
                "Yr Mfg",
                "Expiry Date",
                "Make",
                "Alloted Serial No.",
                "Location",
                "HP tested on",
                "HP Test due",
                "Discharged",
                "Refilled on",
                "Due for refilling",
                "Wt (kg)",
                "Remarks",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ borderColor: MX.iceLine, color: MX.navy }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={17} className="px-3 py-10 text-center text-[13px]" style={{ color: MX.muted }}>
                  No cylinder matches this filter.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className="border-b px-2 py-1.5 tabular-nums" style={{ borderColor: MX.iceLine, color: MX.muted }}>
                    {r.slNo}
                  </td>
                  <td className="border-b px-2 py-1.5" style={{ borderColor: MX.iceLine }}>
                    {r.serialNo ?? "—"}
                  </td>
                  <td className="border-b px-2 py-1.5 font-medium" style={{ borderColor: MX.iceLine, color: MX.navy }}>
                    {r.type || "—"}
                  </td>
                  <td className="border-b px-2 py-1.5" style={{ borderColor: MX.iceLine }}>
                    {r.capacity ?? "—"}
                  </td>
                  <td className="border-b px-2 py-1.5 tabular-nums" style={{ borderColor: MX.iceLine }}>
                    {r.yearOfManufacture ?? "—"}
                  </td>
                  <DueCell badge={r.badges.cylinderLife} iso={r.expiryDate} />
                  <td className="border-b px-2 py-1.5" style={{ borderColor: MX.iceLine }}>
                    {r.make ?? "—"}
                  </td>
                  <td className="border-b px-2 py-1.5 font-semibold" style={{ borderColor: MX.iceLine, color: MX.navy }}>
                    {/* The register's own click-through to that cylinder's
                        inspection history — the link the paper process cannot
                        have, since the two documents are unconnected on paper. */}
                    <Link href={`/fire-safety/fe-inspection?asset=${r.id}`} className="hover:underline">
                      {r.allottedSerialNo ?? r.equipmentCode}
                    </Link>
                  </td>
                  <td className="border-b px-2 py-1.5" style={{ borderColor: MX.iceLine }}>
                    {r.location}
                  </td>
                  <td className="whitespace-nowrap border-b px-2 py-1.5" style={{ borderColor: MX.iceLine, color: MX.muted }}>
                    {fmtDate(r.hpTestedOn)}
                  </td>
                  <DueCell badge={r.badges.hpTest} iso={r.hpTestDueDate} />
                  <td className="whitespace-nowrap border-b px-2 py-1.5" style={{ borderColor: MX.iceLine, color: MX.muted }}>
                    {fmtDate(r.dateOfDischarge)}
                  </td>
                  <td className="whitespace-nowrap border-b px-2 py-1.5" style={{ borderColor: MX.iceLine, color: MX.muted }}>
                    {fmtDate(r.refilledOn)}
                  </td>
                  <DueCell badge={r.badges.refill} iso={r.dueForRefilling} />
                  <td className="border-b px-2 py-1.5 tabular-nums" style={{ borderColor: MX.iceLine }}>
                    {r.weightKg ?? "—"}
                  </td>
                  <td className="max-w-[180px] truncate border-b px-2 py-1.5" style={{ borderColor: MX.iceLine, color: MX.muted }} title={r.remarks ?? ""}>
                    {r.remarks ?? "—"}
                  </td>
                  <td className="border-b px-2 py-1.5 text-right" style={{ borderColor: MX.iceLine }}>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                        className="rounded p-1 hover:bg-slate-100"
                        title="Edit register row"
                        aria-label={`Edit ${r.allottedSerialNo ?? r.equipmentCode}`}
                      >
                        <Pencil size={13} style={{ color: MX.navy }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RegisterDialog open={open} onOpenChange={setOpen} row={editing} plants={plants} />
    </div>
  );
}
