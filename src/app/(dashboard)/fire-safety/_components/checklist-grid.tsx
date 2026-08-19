"use client";

// The grid runner: items down, periods across — the daily month page, the FE
// year page and the quarterly page.
//
// WHY A GRID AT ALL
// -----------------
// The record is one run per period (see services/fire_checklists.py). The grid
// is a view over a month or a year of those runs, and it exists because it is
// how the paper works: an inspector doing a daily round wants to see the last
// three weeks of ticks while adding today's, not open 21 separate forms.
//
// EDITING MODEL
// -------------
// Cells are edited locally and saved in one call. That is deliberate: a daily
// grid is filled a column at a time, but an inspector catching up after a
// weekend fills three columns before saving, and doing that as three round-trips
// is three chances to half-save. Dirty cells are outlined until the save lands.
//
// A column whose run is already signed off is read-only and says so — the
// backend rejects the write anyway, and letting someone type into a locked cell
// only to have it bounce is worse than not offering the edit.

import * as React from "react";
import { ChevronLeft, ChevronRight, FileDown, Loader2, Lock, Save } from "lucide-react";
import {
  ANSWER_STYLE,
  Answer,
  ChecklistGrid,
  MX,
  STAGE_STYLE,
  cycleAnswer,
  fireFetch,
  fmtWindow,
} from "../lib";

type CellKey = `${string}::${string}`; // periodLabel::itemKey
const key = (period: string, item: string): CellKey => `${period}::${item}`;

export function ChecklistGridRunner({
  initial,
  canWrite = true,
}: {
  initial: ChecklistGrid;
  canWrite?: boolean;
}) {
  const [grid, setGrid] = React.useState<ChecklistGrid>(initial);
  const [dirty, setDirty] = React.useState<Map<CellKey, string | null>>(new Map());
  const [busy, setBusy] = React.useState<"load" | "save" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setGrid(initial);
    setDirty(new Map());
  }, [initial]);

  const colByPeriod = React.useMemo(
    () => new Map(grid.columns.map((c) => [c.periodLabel, c])),
    [grid.columns],
  );

  function cellValue(period: string, row: ChecklistGrid["rows"][number]): string | null {
    const k = key(period, row.itemKey ?? row.questionId);
    if (dirty.has(k)) return dirty.get(k) ?? null;
    return row.cells?.[period]?.value ?? null;
  }

  function toggle(period: string, row: ChecklistGrid["rows"][number]) {
    const col = colByPeriod.get(period);
    if (!canWrite || col?.locked) return;
    // A non-working day is still editable — the plant being shut is the usual
    // reason a cell is blank, but a skeleton crew genuinely inspecting on a
    // holiday must be able to record it. The tint is information, not a lock.
    const next = cycleAnswer(cellValue(period, row));
    setDirty((prev) => {
      const m = new Map(prev);
      m.set(key(period, row.itemKey ?? row.questionId), next);
      return m;
    });
    setNotice(null);
  }

  async function load(window: string) {
    if (dirty.size && !confirm("Discard unsaved cells and change period?")) return;
    setBusy("load");
    setError(null);
    try {
      const next = await fireFetch<ChecklistGrid>(
        `/api/fire/checklists/grid?templateCode=${encodeURIComponent(grid.templateCode)}` +
          `&assetId=${encodeURIComponent(grid.assetId)}&window=${encodeURIComponent(window)}`,
      );
      setGrid(next);
      setDirty(new Map());
    } catch (e: any) {
      setError(e?.message ?? "Could not load that period.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!dirty.size) return;
    setBusy("save");
    setError(null);
    setNotice(null);
    const cells = [...dirty.entries()].map(([k, value]) => {
      const [periodLabel, itemKey] = k.split("::");
      return { periodLabel, itemKey, value };
    });
    try {
      const res = await fireFetch<{ saved: string[]; rejected: { periodLabel: string; reason: string }[] }>(
        "/api/fire/checklists/grid",
        {
          method: "PUT",
          body: JSON.stringify({ templateCode: grid.templateCode, assetId: grid.assetId, cells }),
        },
      );
      // Reload rather than trusting the local map: saving creates runs that did
      // not exist, and their ids and stages are what the column strip renders.
      await load(grid.window);
      if (res.rejected?.length) {
        setNotice(
          `${res.saved.length} period(s) saved. Rejected: ${res.rejected
            .map((r) => r.periodLabel)
            .join(", ")} — already signed off.`,
        );
      } else {
        setNotice(`${res.saved.length} period(s) saved.`);
      }
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  const wide = grid.columns.length > 12;
  const cellW = wide ? 30 : 62;
  const pdfHref =
    `/api/fire/checklists/grid/export.pdf?templateCode=${encodeURIComponent(grid.templateCode)}` +
    `&assetId=${encodeURIComponent(grid.assetId)}&window=${encodeURIComponent(grid.window)}`;

  let lastSection: string | null = null;

  return (
    <div>
      {/* ── period pager + actions ─────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => load(grid.prevWindow)}
          disabled={busy !== null}
          className="rounded-lg border px-2 py-1.5 text-[12px] disabled:opacity-50"
          style={{ borderColor: MX.iceLine, color: MX.navy }}
          aria-label="Previous period"
        >
          <ChevronLeft size={14} />
        </button>
        <div
          className="rounded-lg px-3 py-1.5 text-[13px] font-semibold"
          style={{ background: MX.ice, color: MX.navy }}
        >
          {fmtWindow(grid.layout, grid.window)}
        </div>
        <button
          type="button"
          onClick={() => load(grid.nextWindow)}
          disabled={busy !== null}
          className="rounded-lg border px-2 py-1.5 text-[12px] disabled:opacity-50"
          style={{ borderColor: MX.iceLine, color: MX.navy }}
          aria-label="Next period"
        >
          <ChevronRight size={14} />
        </button>

        <div className="ml-auto flex items-center gap-2">
          {notice && (
            <span className="text-[11px]" style={{ color: MX.muted }}>
              {notice}
            </span>
          )}
          {error && (
            <span className="text-[11px] font-medium" style={{ color: MX.red }}>
              {error}
            </span>
          )}
          <a
            href={pdfHref}
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
              onClick={save}
              disabled={!dirty.size || busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-45"
              style={{ background: MX.navy }}
            >
              {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save{dirty.size ? ` (${dirty.size})` : ""}
            </button>
          )}
        </div>
      </div>

      {/* ── the grid ───────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: MX.iceLine }}>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr style={{ background: MX.ice }}>
              <th
                className="sticky left-0 z-10 border-b border-r px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: MX.ice, borderColor: MX.iceLine, color: MX.navy, minWidth: 260 }}
              >
                Checks to be done
              </th>
              {grid.columns.map((c) => (
                <th
                  key={c.periodLabel}
                  title={c.nonWorkingDay ? `${c.periodLabel} — ${c.nonWorkingDay}` : c.periodLabel}
                  className="border-b border-r px-1 py-2 text-center text-[10px] font-semibold"
                  style={{
                    borderColor: MX.iceLine,
                    // A greyed column is the sheet's pre-printed SUNDAY /
                    // HOLIDAY label, so an empty column reads as "plant shut"
                    // rather than "8 missed inspections".
                    background: c.nonWorkingDay ? MX.goldSoft : MX.ice,
                    color: c.nonWorkingDay ? MX.navy : MX.navy,
                    minWidth: cellW,
                    width: cellW,
                  }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, idx) => {
              const showSection = row.sectionTitle !== lastSection;
              lastSection = row.sectionTitle;
              return (
                <React.Fragment key={row.questionId}>
                  {showSection && grid.rows.some((r) => r.sectionTitle !== grid.rows[0].sectionTitle) && (
                    <tr>
                      <td
                        colSpan={grid.columns.length + 1}
                        className="border-b px-2 py-1 text-[11px] font-semibold"
                        style={{ background: MX.ice, borderColor: MX.iceLine, color: MX.navy }}
                      >
                        {row.sectionTitle}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td
                      className="sticky left-0 z-10 border-b border-r px-2 py-1.5 align-top"
                      style={{ background: MX.paper, borderColor: MX.iceLine, color: MX.ink, minWidth: 260 }}
                    >
                      <span className="mr-1.5 tabular-nums" style={{ color: MX.muted }}>
                        {idx + 1}.
                      </span>
                      {row.text}
                      {row.guidance && (
                        <div className="mt-0.5 text-[10.5px] italic" style={{ color: MX.muted }}>
                          Note: {row.guidance}
                        </div>
                      )}
                    </td>
                    {grid.columns.map((c) => {
                      const v = cellValue(c.periodLabel, row);
                      const k = key(c.periodLabel, row.itemKey ?? row.questionId);
                      const isDirty = dirty.has(k);
                      const style = v ? ANSWER_STYLE[v as Answer] : null;
                      return (
                        <td
                          key={c.periodLabel}
                          className="border-b border-r p-0 text-center"
                          style={{ borderColor: MX.iceLine, background: c.nonWorkingDay && !v ? MX.goldSoft : undefined }}
                        >
                          <button
                            type="button"
                            onClick={() => toggle(c.periodLabel, row)}
                            disabled={!canWrite || c.locked}
                            title={
                              c.locked
                                ? `${c.periodLabel} is ${c.stage} — locked`
                                : `${c.periodLabel} · ${row.text}`
                            }
                            className="h-7 w-full text-[10.5px] font-bold transition-colors disabled:cursor-not-allowed"
                            style={{
                              background: style?.bg ?? "transparent",
                              color: style?.fg ?? MX.muted,
                              outline: isDirty ? `2px solid ${MX.gold}` : undefined,
                              outlineOffset: "-2px",
                            }}
                          >
                            {v ?? (c.nonWorkingDay ? "" : "·")}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}

            {/* Per-period stage strip. A grid page covers many runs, each with
                its own sign-off state, so one foot block cannot speak for all
                of them — this row answers "which days are approved?". */}
            <tr>
              <td
                className="sticky left-0 z-10 border-r px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: MX.ice, borderColor: MX.iceLine, color: MX.navy }}
              >
                Sign-off stage
              </td>
              {grid.columns.map((c) => {
                const st = c.stage ? STAGE_STYLE[c.stage] : null;
                return (
                  <td
                    key={c.periodLabel}
                    className="border-r px-0.5 py-1 text-center"
                    style={{ borderColor: MX.iceLine, background: MX.ice }}
                  >
                    {c.stage ? (
                      <span
                        className="inline-flex items-center justify-center rounded px-1 py-0.5 text-[8.5px] font-bold"
                        style={{ background: st!.bg, color: st!.fg }}
                        title={c.stage}
                      >
                        {c.locked ? <Lock size={8} /> : c.stage.slice(0, 3)}
                      </span>
                    ) : (
                      <span className="text-[9px]" style={{ color: MX.iceLine }}>
                        —
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px]" style={{ color: MX.muted }}>
        <span>Tap a cell to cycle Yes → No → NA → blank.</span>
        {(["YES", "NO", "NA"] as Answer[]).map((a) => (
          <span key={a} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-3 w-5 rounded"
              style={{ background: ANSWER_STYLE[a].bg, border: `1px solid ${ANSWER_STYLE[a].border}` }}
            />
            {a}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded" style={{ background: MX.goldSoft }} />
          Sunday / holiday
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded" style={{ outline: `2px solid ${MX.gold}`, outlineOffset: -2 }} />
          unsaved
        </span>
      </div>
    </div>
  );
}
