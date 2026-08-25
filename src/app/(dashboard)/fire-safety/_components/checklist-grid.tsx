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
//
// SIGN-OFF IS PER COLUMN, NOT PER PAGE
// ------------------------------------
// Saving cells records answers. It does not sign the sheet — the record stays
// DRAFT until someone takes the Prepared / Reviewed / Approved chain the paper
// original prints a box for. On a form sheet that block sits under the one
// record it belongs to; here a page covers twelve months or thirty-one days, and
// each is its own run with its own stage, so one block at the foot of the page
// could not say which period it was signing.
//
// So the sign-off stage strip IS the control: click a period's stage badge and
// that period's block opens beneath the grid. Without this the grid had no
// sign-off route at all — every column a grid sheet ever recorded sat at DRAFT
// permanently, because the panel was only ever wired into the form runner.

import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2, Lock, Save, X } from "lucide-react";
import {
  ANSWER_STYLE,
  Answer,
  ChecklistGrid,
  ChecklistRun,
  MX,
  STAGE_STYLE,
  Stage,
  cycleAnswer,
  fireFetch,
  fmtWindow,
} from "../lib";
import { ExportButtons } from "./export-buttons";
import { SignOffPanel, SignaturePayload } from "./sign-off-panel";

type CellKey = `${string}::${string}`; // periodLabel::itemKey
const key = (period: string, item: string): CellKey => `${period}::${item}`;

/** Which cells the Remarks panel offers a box for.
 *
 *  Not every cell: 21 checks x 12 months is 252 textareas nobody wants. The
 *  source sheet's own footnote — 'write comments on the back side of this page'
 *  — is attached to the No/NA instruction, because those are the answers that
 *  need explaining. So the panel lists exactly the cells that are NO or NA, plus
 *  any cell that already carries a remark (so an existing note stays reachable
 *  even after its answer is corrected to Yes, rather than becoming invisible
 *  text still attached to the record). */
function needsRemark(value: string | null, note: string): boolean {
  return value === "NO" || value === "NA" || note.trim().length > 0;
}

export function ChecklistGridRunner({
  initial,
  canWrite = true,
}: {
  initial: ChecklistGrid;
  canWrite?: boolean;
}) {
  const [grid, setGrid] = React.useState<ChecklistGrid>(initial);
  const [dirty, setDirty] = React.useState<Map<CellKey, string | null>>(new Map());
  // Remarks are tracked separately from answers because they change
  // independently: correcting the wording of a note must not re-write the answer,
  // and clearing one must reach the server as "" rather than as an omission the
  // merge would read as "leave it alone".
  const [notes, setNotes] = React.useState<Map<CellKey, string>>(new Map());
  const [busy, setBusy] = React.useState<"load" | "save" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // The period whose sign-off block is open, and that period's full record. The
  // grid payload carries only each column's stage — names, timestamps and the
  // captured signatures live on the run, so it is fetched when a period is picked
  // rather than shipping twelve of them with every page.
  const [signPeriod, setSignPeriod] = React.useState<string | null>(null);
  const [signRun, setSignRun] = React.useState<ChecklistRun | null>(null);
  const [signBusy, setSignBusy] = React.useState(false);
  const [signError, setSignError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setGrid(initial);
    setDirty(new Map());
    setNotes(new Map());
    setSignPeriod(null);
    setSignRun(null);
  }, [initial]);

  const colByPeriod = React.useMemo(
    () => new Map(grid.columns.map((c) => [c.periodLabel, c])),
    [grid.columns],
  );

  /** Cells with something unsaved — an answer, a remark, or both. Counted as
   *  cells rather than edits so the Save badge matches what is outlined on the
   *  grid instead of double-counting a cell whose answer and note both moved. */
  const pendingCount = React.useMemo(
    () => new Set<CellKey>([...dirty.keys(), ...notes.keys()]).size,
    [dirty, notes],
  );

  function cellValue(period: string, row: ChecklistGrid["rows"][number]): string | null {
    const k = key(period, row.itemKey ?? row.questionId);
    if (dirty.has(k)) return dirty.get(k) ?? null;
    return row.cells?.[period]?.value ?? null;
  }

  /** The "back of the page": every cell on this window that wants a comment.
   *  Ordered by period then item, so it reads down the sheet the way the grid
   *  reads across it. */
  const remarkRows = React.useMemo(() => {
    const out: {
      k: CellKey;
      periodLabel: string;
      periodHeader: string;
      locked: boolean;
      index: number;
      text: string;
      value: string | null;
      note: string;
      row: ChecklistGrid["rows"][number];
    }[] = [];
    for (const col of grid.columns) {
      grid.rows.forEach((row, i) => {
        const item = row.itemKey ?? row.questionId;
        const k = key(col.periodLabel, item);
        const value = dirty.has(k) ? dirty.get(k) ?? null : row.cells?.[col.periodLabel]?.value ?? null;
        const note = notes.has(k) ? notes.get(k) ?? "" : row.cells?.[col.periodLabel]?.note ?? "";
        if (!needsRemark(value, note)) return;
        out.push({
          k,
          periodLabel: col.periodLabel,
          periodHeader: String(col.header ?? col.periodLabel),
          locked: col.locked,
          index: i + 1,
          text: row.text,
          value,
          note,
          row,
        });
      });
    }
    return out;
  }, [grid.columns, grid.rows, dirty, notes]);

  function cellNote(period: string, row: ChecklistGrid["rows"][number]): string {
    const k = key(period, row.itemKey ?? row.questionId);
    // `has`, not `||` — an edit that empties the box is a deletion the user
    // means, and falling back to the stored text would undo it on every render.
    if (notes.has(k)) return notes.get(k) ?? "";
    return row.cells?.[period]?.note ?? "";
  }

  function setNote(period: string, row: ChecklistGrid["rows"][number], text: string) {
    setNotes((prev) => {
      const m = new Map(prev);
      m.set(key(period, row.itemKey ?? row.questionId), text);
      return m;
    });
    setNotice(null);
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

  /** Re-read a page. No confirm — the caller decides whether anything is at risk.
   *
   *  Split out of `load` because `save` used to call `load` to refresh the stage
   *  strip, and `load`'s guard fired on the very cells that had just been written:
   *  pressing Save asked "Discard unsaved cells and change period?" about the
   *  edits it had already saved, and Cancel then left the strip stale. A save is
   *  not a period change and must never ask. */
  async function fetchWindow(window: string) {
    setBusy("load");
    setError(null);
    try {
      const next = await fireFetch<ChecklistGrid>(
        `/api/fire/checklists/grid?templateCode=${encodeURIComponent(grid.templateCode)}` +
          `&assetId=${encodeURIComponent(grid.assetId)}&window=${encodeURIComponent(window)}`,
      );
      setGrid(next);
      setDirty(new Map());
      setNotes(new Map());
      return next;
    } catch (e: any) {
      setError(e?.message ?? "Could not load that period.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  /** Page to another month/year. This one DOES confirm — unsaved cells would be
   *  thrown away, which is the case the prompt was written for. */
  async function load(window: string) {
    if (pendingCount && !confirm("Discard unsaved cells and change period?")) return;
    setSignPeriod(null);
    setSignRun(null);
    await fetchWindow(window);
  }

  async function save() {
    if (!pendingCount) return;
    setBusy("save");
    setError(null);
    setNotice(null);
    // One entry per touched cell, whether the answer moved, the remark did, or
    // both. `value` is resolved from the stored grid when only the remark
    // changed — the backend re-coerces it, and omitting it would blank the
    // answer to record a comment about it.
    const touched = new Set<CellKey>([...dirty.keys(), ...notes.keys()]);
    const storedValue = new Map<CellKey, string | null>();
    for (const row of grid.rows) {
      const item = row.itemKey ?? row.questionId;
      for (const [period, cell] of Object.entries(row.cells ?? {})) {
        storedValue.set(key(period, item), cell?.value ?? null);
      }
    }
    const cells = [...touched].map((k) => {
      const [periodLabel, itemKey] = k.split("::");
      return {
        periodLabel,
        itemKey,
        value: dirty.has(k) ? dirty.get(k) ?? null : storedValue.get(k) ?? null,
        // null = untouched, "" = cleared. The backend merge reads it exactly
        // that way, so an emptied box actually deletes the remark.
        note: notes.has(k) ? notes.get(k) ?? "" : null,
      };
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
      await fetchWindow(grid.window);
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

  /** Open one period's Prepared / Reviewed / Approved block. */
  async function openSignOff(period: string) {
    const col = colByPeriod.get(period);
    if (signPeriod === period) {
      setSignPeriod(null);
      setSignRun(null);
      return;
    }
    setSignPeriod(period);
    setSignRun(null);
    setSignError(null);
    if (!col?.runId) {
      // Nothing recorded for this period yet. There is no record to sign, and
      // conjuring an empty one so the block has something to attach to would put
      // a signature against a sheet nobody filled in.
      setSignError(
        `Nothing is recorded for ${period} yet. Fill the column and press Save — that creates the record, which is then what gets signed.`,
      );
      return;
    }
    setSignBusy(true);
    try {
      setSignRun(await fireFetch<ChecklistRun>(`/api/fire/checklists/run/${col.runId}`));
    } catch (e: any) {
      setSignError(e?.message ?? "Could not open this period's sign-off.");
    } finally {
      setSignBusy(false);
    }
  }

  async function advance(to: Stage, signature?: SignaturePayload) {
    if (!signRun) return;
    // Unsaved cells must land before the stage moves, or the submit gate reads
    // the stored answers and rejects on items the inspector can see filled in.
    if (pendingCount) await save();
    const path = to === "SUBMITTED" ? "submit" : to === "REVIEWED" ? "review" : "approve";
    const next = await fireFetch<ChecklistRun>(
      `/api/fire/checklists/run/${signRun.runId}/${path}`,
      {
        method: "POST",
        // The signature travels with the transition, not as a second call — two
        // calls means a window where the stage has moved and nothing is signed.
        body: JSON.stringify(
          signature
            ? {
                signatureKind: signature.signatureKind,
                signaturePayload: signature.signaturePayload ?? null,
                typedName: signature.typedName ?? null,
              }
            : {},
        ),
      },
    );
    setSignRun(next);
    // The strip is what tells the rest of the page this column moved, and a
    // freshly APPROVED column also becomes read-only — both come from the grid.
    await fetchWindow(grid.window);
    if (next.outcomeMessage) setNotice(next.outcomeMessage);
  }

  const wide = grid.columns.length > 12;
  const cellW = wide ? 30 : 62;
  // Both formats export the page currently on screen, not today's — someone who
  // paged back to August and then exported means August.
  const exportQuery =
    `?templateCode=${encodeURIComponent(grid.templateCode)}` +
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
          <ExportButtons
            pdfHref={`/api/fire/checklists/grid/export.pdf${exportQuery}`}
            xlsxHref={`/api/fire/checklists/grid/export.xlsx${exportQuery}`}
          />
          {canWrite && (
            <button
              type="button"
              onClick={save}
              disabled={!pendingCount || busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-45"
              style={{ background: MX.navy }}
            >
              {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save{pendingCount ? ` (${pendingCount})` : ""}
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
                      const note = cellNote(c.periodLabel, row);
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
                              // The remark leads when there is one — a cell
                              // showing NO is a question, and the answer is the
                              // note somebody typed about it.
                              note
                                ? `${c.periodLabel} · ${row.text}\nRemark: ${note}`
                                : c.locked
                                  ? `${c.periodLabel} is ${c.stage} — locked`
                                  : `${c.periodLabel} · ${row.text}`
                            }
                            className="relative h-7 w-full text-[10.5px] font-bold transition-colors disabled:cursor-not-allowed"
                            style={{
                              background: style?.bg ?? "transparent",
                              color: style?.fg ?? MX.muted,
                              outline: isDirty ? `2px solid ${MX.gold}` : undefined,
                              outlineOffset: "-2px",
                            }}
                          >
                            {v ?? (c.nonWorkingDay ? "" : "·")}
                            {/* A corner fold, the way a spreadsheet flags a
                                comment: the grid keeps its one-glance shape and
                                a cell that carries a remark still says so. */}
                            {note && (
                              <span
                                aria-hidden
                                className="absolute right-0 top-0"
                                style={{
                                  borderTop: `5px solid ${MX.navy}`,
                                  borderLeft: "5px solid transparent",
                                }}
                              />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}

            {/* Per-period stage strip — and the way into sign-off. A grid page
                covers many runs, each with its own sign-off state, so one foot
                block cannot speak for all of them: this row answers "which days
                are approved?", and clicking a cell opens that period's block. */}
            <tr>
              <td
                className="sticky left-0 z-10 border-r px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: MX.ice, borderColor: MX.iceLine, color: MX.navy }}
              >
                Sign-off stage
              </td>
              {grid.columns.map((c) => {
                const st = c.stage ? STAGE_STYLE[c.stage] : null;
                const on = signPeriod === c.periodLabel;
                return (
                  <td
                    key={c.periodLabel}
                    className="border-r px-0.5 py-1 text-center"
                    style={{
                      borderColor: MX.iceLine,
                      background: on ? MX.goldSoft : MX.ice,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openSignOff(c.periodLabel)}
                      title={
                        c.stage
                          ? `${c.periodLabel} — ${c.stage}. Click to open the sign-off block.`
                          : `${c.periodLabel} — nothing recorded yet. Click for what to do.`
                      }
                      aria-label={`Sign-off for ${c.periodLabel}`}
                      className="w-full rounded px-0.5 py-0.5 transition-colors hover:brightness-95"
                    >
                      {c.stage ? (
                        <span
                          className="inline-flex items-center justify-center rounded px-1 py-0.5 text-[8.5px] font-bold"
                          style={{ background: st!.bg, color: st!.fg }}
                        >
                          {c.locked ? <Lock size={8} /> : c.stage.slice(0, 3)}
                        </span>
                      ) : (
                        <span className="text-[9px]" style={{ color: MX.muted }}>
                          —
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Remarks — "comments on the back side of this page" ─────────── */}
      {remarkRows.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border bg-white" style={{ borderColor: MX.iceLine }}>
          <div
            className="px-4 py-2"
            style={{ background: MX.ice, borderBottom: `1px solid ${MX.iceLine}` }}
          >
            <div className="text-[12px] font-semibold" style={{ color: MX.navy }}>
              Remarks — {remarkRows.length} check{remarkRows.length === 1 ? "" : "s"} to comment on
            </div>
            <div className="text-[11px]" style={{ color: MX.muted }}>
              The sheet says to write comments for any &ldquo;No&rdquo; or &ldquo;NA&rdquo;. A remark
              on a &ldquo;No&rdquo; is carried onto the defect and its CAPA, so whoever fixes it reads
              what you saw — not just which check failed.
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: MX.iceLine }}>
            {remarkRows.map((r) => {
              const st = ANSWER_STYLE[r.value as Answer];
              return (
                <div key={r.k} className="flex flex-wrap items-start gap-2 px-4 py-2">
                  <span
                    className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: MX.ice, color: MX.navy }}
                  >
                    {r.periodHeader}
                  </span>
                  {r.value && st && (
                    <span
                      className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      {r.value}
                    </span>
                  )}
                  <span className="min-w-[180px] flex-1 text-[12px]" style={{ color: MX.ink }}>
                    {r.index}. {r.text}
                  </span>
                  <textarea
                    value={r.note}
                    onChange={(e) => setNote(r.periodLabel, r.row, e.target.value)}
                    disabled={!canWrite || r.locked}
                    rows={1}
                    placeholder={
                      r.locked
                        ? "Signed off — remarks are part of the record"
                        : "What did you observe? e.g. Number plate painted over during last repaint."
                    }
                    className="min-w-[240px] flex-1 rounded-lg border px-2.5 py-1.5 text-[12px] outline-none disabled:bg-slate-50"
                    style={{
                      borderColor: notes.has(r.k) ? MX.gold : MX.iceLine,
                      color: MX.ink,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── the selected period's sign-off block ───────────────────────── */}
      {signPeriod && (
        <div className="mt-3 rounded-xl border" style={{ borderColor: MX.gold }}>
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-2"
            style={{ background: MX.goldSoft, borderBottom: `1px solid ${MX.gold}` }}
          >
            <span className="text-[12px] font-semibold" style={{ color: MX.navy }}>
              Sign-off — {signPeriod}
            </span>
            <span className="text-[11px]" style={{ color: MX.muted }}>
              {colByPeriod.get(signPeriod)?.stage ?? "not recorded"}
            </span>
            <button
              type="button"
              onClick={() => {
                setSignPeriod(null);
                setSignRun(null);
              }}
              className="ml-auto rounded p-1 hover:bg-white/60"
              aria-label="Close sign-off"
            >
              <X size={13} style={{ color: MX.navy }} />
            </button>
          </div>

          {signBusy && (
            <div className="flex items-center gap-2 px-4 py-5 text-[12.5px]" style={{ color: MX.muted }}>
              <Loader2 size={14} className="animate-spin" /> Opening this period&rsquo;s record…
            </div>
          )}
          {signError && !signBusy && (
            <div className="px-4 py-4 text-[12.5px]" style={{ color: MX.red }}>
              {signError}
            </div>
          )}
          {signRun && !signBusy && (
            <div className="px-4 pb-4">
              <SignOffPanel
                stage={signRun.stage}
                signOff={signRun.signOff}
                roles={signRun.document.signOffRoles ?? grid.document.signOffRoles}
                canWrite={canWrite}
                signatureRequired={signRun.signOff.signatureRequired !== false}
                onAdvance={advance}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px]" style={{ color: MX.muted }}>
        <span>Tap a cell to cycle Yes → No → NA → blank.</span>
        {/* Saving and signing are different acts and the screen has to say so —
            "I pressed Save, why does it still say DRAFT?" is the question this
            line answers before it gets asked. */}
        <span>
          Saving records the answers; a period stays <strong>DRAFT</strong> until it is signed. Click
          its cell in the <strong>Sign-off stage</strong> row to sign it.
        </span>
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
