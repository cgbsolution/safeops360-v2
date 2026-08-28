"use client";

// The one register table. Every branded fire register renders through this.
//
// WHY THIS EXISTS
// ---------------
// `FireRegisterViewConfig` was seeded with all three registers — extinguishers,
// alarm panels, hydrant & sprinkler — and read by nothing. The extinguisher
// register rendered from a hand-built table with seventeen hardcoded <td>s in
// sheet order, and the other two had no screen at all. So the table's stated
// purpose ("adding the next register is a seed entry, not a screen") was not
// true: adding one meant forking a component.
//
// Here the columns, their order and their labels all come from
// `document.columns`, which comes from the config row. A new register is a seed
// entry and this component renders it.
//
// WHAT IS STILL PER-REGISTER, AND WHY THAT IS NOT A FORK
// ------------------------------------------------------
// The extinguisher sheet has three date columns that are not dates — they are
// due-date badges (red / amber-within-30-days / green), because "is this
// cylinder due" is the only question the register exists to answer. A generic
// cell renderer cannot know that.
//
// So `renderCell` is an override keyed by column: a caller supplies a renderer
// for the columns that mean something special and inherits the default for the
// rest. That is parameterisation, not a fork — there is one table, one header
// row, one empty state, one sort behaviour, and the extinguisher supplies three
// cells rather than a second implementation of all seventeen.

import * as React from "react";
import { MX } from "../lib";

export type RegisterDocument = {
  documentNo?: string | null;
  supersedesNo?: string | null;
  revision?: string | null;
  effectiveDate?: string | null;
  reviewDate?: string | null;
  title?: string | null;
  department?: string | null;
  /** [key, label] pairs, in the order the client's sheet prints them.
   *  Optional so a caller can pass a payload whose header predates the config
   *  wiring; the table falls back rather than crashing on a register that is
   *  mid-migration. */
  columns?: [string, string][];
  pdfTemplateKey?: string | null;
  assetType?: string | null;
  routeSlug?: string | null;
};

export type RegisterRow = Record<string, unknown> & {
  id: string;
  worstBadge?: string;
  /** Set by the backend when this asset has an open overdue checklist. Platform
   *  state, not part of the client's transcribed sheet — see the Checklist
   *  column below for why that distinction decides where it renders. */
  overdueChecklist?: {
    state: "PENDING" | "NOTIFIED" | "ESCALATED";
    period: string;
    frequency: string;
    dueDate: string | null;
    escalatedAt: string | null;
    unassigned: boolean;
    openCount: number;
  } | null;
};

const OVERDUE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: MX.amberSoft, fg: MX.amber, label: "Overdue" },
  NOTIFIED: { bg: MX.amberSoft, fg: MX.amber, label: "Overdue — notified" },
  ESCALATED: { bg: MX.redSoft, fg: MX.red, label: "Overdue — escalated" },
};

/** The escalation, on the asset. Without this the only trace of a three-week-old
 *  escalation is an email in one manager's inbox — indistinguishable, from
 *  inside the product, from one that was never sent. */
function OverdueBadge({ info }: { info: NonNullable<RegisterRow["overdueChecklist"]> }) {
  const st = OVERDUE_STYLE[info.state] ?? OVERDUE_STYLE.PENDING;
  const due = info.dueDate ? info.dueDate.slice(0, 10).split("-").reverse().join(".") : "—";
  const hint =
    `${info.frequency.toLowerCase()} checklist for ${info.period}, due ${due}` +
    (info.openCount > 1 ? ` · ${info.openCount} periods outstanding` : "") +
    (info.unassigned ? " · no technician assigned" : "");
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: st.bg, color: st.fg }}
      title={hint}
    >
      {st.label}
      {info.openCount > 1 ? ` ×${info.openCount}` : ""}
    </span>
  );
}

/** An ISO timestamp rendered as the date a register shows. Anything else is
 *  passed through — a register column may legitimately hold a code or a count. */
export function registerCellText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split("-");
    return `${d}.${m}.${y}`;
  }
  return String(value);
}

export function ConfigRegisterTable({
  document: doc,
  rows,
  renderCell,
  rowActions,
  actionsLabel = "",
  emptyMessage = "No assets in this register yet.",
}: {
  document: RegisterDocument;
  rows: RegisterRow[];
  /** Return undefined to fall through to the default cell. */
  renderCell?: (key: string, row: RegisterRow) => React.ReactNode | undefined;
  rowActions?: (row: RegisterRow) => React.ReactNode;
  actionsLabel?: string;
  emptyMessage?: string;
}) {
  const columns = doc.columns ?? [];
  // The overdue column is rendered only when something is actually overdue, and
  // it sits OUTSIDE `doc.columns` on purpose: those columns are transcribed from
  // the client's controlled document, and the PDF/Excel exports render exactly
  // them. Adding platform state to that list would put a column on a statutory
  // sheet that the client's own document does not have.
  const anyOverdue = rows.some((r) => r.overdueChecklist);
  const span = columns.length + (anyOverdue ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: MX.iceLine }}>
      <table className="w-full min-w-[900px] border-collapse text-[11.5px]">
        <thead>
          <tr>
            {columns.map(([key, label]) => (
              <th
                key={key}
                scope="col"
                className="whitespace-nowrap border-b px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide"
                style={{ borderColor: MX.iceLine, background: MX.ice, color: MX.navy }}
              >
                {label || key}
              </th>
            ))}
            {anyOverdue && (
              <th
                scope="col"
                className="whitespace-nowrap border-b px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide"
                style={{ borderColor: MX.iceLine, background: MX.ice, color: MX.navy }}
                title="Not part of the controlled document — SafeOps360 checklist status"
              >
                Checklist
              </th>
            )}
            {rowActions && (
              <th
                scope="col"
                className="border-b px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide"
                style={{ borderColor: MX.iceLine, background: MX.ice, color: MX.navy }}
              >
                {actionsLabel}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={span} className="px-3 py-10 text-center text-[13px]" style={{ color: MX.muted }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {columns.map(([key]) => {
                  const custom = renderCell?.(key, row);
                  if (custom !== undefined) return <React.Fragment key={key}>{custom}</React.Fragment>;
                  return (
                    <td
                      key={key}
                      className="border-b px-2 py-1.5 align-top"
                      style={{
                        borderColor: MX.iceLine,
                        color: key === "remarks" ? MX.muted : MX.ink,
                      }}
                    >
                      {registerCellText(row[key])}
                    </td>
                  );
                })}
                {anyOverdue && (
                  <td className="whitespace-nowrap border-b px-2 py-1.5" style={{ borderColor: MX.iceLine }}>
                    {row.overdueChecklist ? <OverdueBadge info={row.overdueChecklist} /> : null}
                  </td>
                )}
                {rowActions && (
                  <td className="whitespace-nowrap border-b px-2 py-1.5 text-right" style={{ borderColor: MX.iceLine }}>
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
