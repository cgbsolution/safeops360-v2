"use client";

// The form runner: one period, sectioned exactly as the source sheet prints it.
//
// Used by the monthly and annual sheets, which are not grids — they have named
// headings ("Valves:", "Hydrant Box:", "Visual Examination Of Battery"), mixed
// answer types (Yes/No/NA alongside battery voltages and detector serial
// numbers) and one signature block for the whole page.
//
// THE ZONE / LOOP VARIANT
// -----------------------
// There is no conditional rendering here for Unit-21 A vs Unit-21 B. The two
// unit sheets differ only in one item's wording ("Zone Number :" vs "Loop Number
// :") and their hooter location lists, and both of those are template *content*.
// So the variant is chosen when the run is created — by the panel's own
// assetSubtype — and this component renders whatever the template says. A branch
// in the UI would put the client's document structure in the frontend, where the
// next unit's panel would need a code change instead of a template.

import * as React from "react";
import { FileDown, Loader2, Lock, Save } from "lucide-react";
import {
  ANSWERS,
  ANSWER_STYLE,
  Answer,
  ChecklistRun,
  MX,
  Stage,
  fireFetch,
} from "../lib";
import { Footnotes } from "./document-header";
import { SignOffPanel } from "./sign-off-panel";

export function ChecklistFormRunner({
  initial,
  canWrite = true,
  onChanged,
}: {
  initial: ChecklistRun;
  canWrite?: boolean;
  onChanged?: (run: ChecklistRun) => void;
}) {
  const [run, setRun] = React.useState<ChecklistRun>(initial);
  const [draft, setDraft] = React.useState<Map<string, { value: string | null; note?: string }>>(new Map());
  const [busy, setBusy] = React.useState<"save" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRun(initial);
    setDraft(new Map());
  }, [initial]);

  const locked = run.locked || !canWrite;

  function valueOf(itemKey: string, stored: string | null): string | null {
    return draft.has(itemKey) ? draft.get(itemKey)!.value : stored;
  }
  function noteOf(itemKey: string, stored: string): string {
    const d = draft.get(itemKey);
    return d && d.note !== undefined ? d.note : stored;
  }

  function set(itemKey: string, patch: { value?: string | null; note?: string }) {
    setDraft((prev) => {
      const m = new Map(prev);
      const cur = m.get(itemKey) ?? { value: undefined as any, note: undefined };
      m.set(itemKey, { ...cur, ...patch } as any);
      return m;
    });
    setNotice(null);
  }

  // Mandatory items with nothing recorded. Computed live so the submit button
  // explains itself before it is pressed, rather than after the backend rejects
  // the transition — the backend still enforces it, this just stops the operator
  // finding out the hard way.
  const missing = React.useMemo(() => {
    const out: string[] = [];
    for (const sec of run.sections) {
      for (const it of sec.items) {
        if (!it.mandatory) continue;
        const k = it.itemKey ?? it.questionId;
        const v = valueOf(k, it.value);
        if (v === null || v === "") out.push(it.text);
      }
    }
    return out;
  }, [run, draft]);

  async function save() {
    if (!draft.size) return;
    setBusy("save");
    setError(null);
    try {
      const answers = [...draft.entries()].map(([itemKey, d]) => ({
        itemKey,
        value: d.value ?? null,
        note: d.note,
      }));
      const next = await fireFetch<ChecklistRun>(`/api/fire/checklists/run/${run.runId}/responses`, {
        method: "PUT",
        body: JSON.stringify({ answers }),
      });
      setRun(next);
      setDraft(new Map());
      setNotice("Saved.");
      onChanged?.(next);
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function advance(to: Stage) {
    // Unsaved edits must land before a stage moves, or the submit gate would
    // check the stored answers and reject on items the operator can see filled
    // in on screen.
    if (draft.size) await save();
    const path = to === "SUBMITTED" ? "submit" : to === "REVIEWED" ? "review" : "approve";
    const next = await fireFetch<ChecklistRun>(`/api/fire/checklists/run/${run.runId}/${path}`, {
      method: "POST",
    });
    setRun(next);
    setDraft(new Map());
    onChanged?.(next);
  }

  const dirty = draft.size;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px]" style={{ color: MX.muted }}>
          Period <strong style={{ color: MX.ink }}>{run.periodLabel}</strong> · {run.assetCode}
          {run.assetLocation ? ` · ${run.assetLocation}` : ""}
        </span>
        {run.locked && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: MX.greenSoft, color: MX.green }}
          >
            <Lock size={10} /> {run.stage}
          </span>
        )}
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
            href={`/api/fire/checklists/run/${run.runId}/export.pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium"
            style={{ borderColor: MX.iceLine, color: MX.navy }}
          >
            <FileDown size={13} /> PDF
          </a>
          {!locked && (
            <button
              type="button"
              onClick={save}
              disabled={!dirty || busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-45"
              style={{ background: MX.navy }}
            >
              {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save{dirty ? ` (${dirty})` : ""}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {run.sections.map((sec) => (
          <div key={sec.id} className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: MX.iceLine }}>
            <div
              className="px-3 py-2 text-[12px] font-semibold"
              style={{ background: MX.ice, color: MX.navy, borderBottom: `1px solid ${MX.iceLine}` }}
            >
              {sec.title}
            </div>
            {sec.note && (
              <div className="px-3 py-1.5 text-[11px] italic" style={{ color: MX.muted }}>
                {sec.note}
              </div>
            )}
            <div className="divide-y" style={{ borderColor: MX.iceLine }}>
              {sec.items.map((it, i) => {
                const k = it.itemKey ?? it.questionId;
                const v = valueOf(k, it.value);
                const isDirty = draft.has(k);
                return (
                  <div
                    key={it.questionId}
                    className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-start"
                    style={isDirty ? { boxShadow: `inset 3px 0 0 ${MX.gold}` } : undefined}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px]" style={{ color: MX.ink }}>
                        <span className="mr-1.5 tabular-nums" style={{ color: MX.muted }}>
                          {i + 1}.
                        </span>
                        {it.text}
                        {it.mandatory && (
                          <span className="ml-1" style={{ color: MX.red }} title="Required before submit">
                            *
                          </span>
                        )}
                      </div>
                      {it.guidance && (
                        <div className="mt-0.5 text-[11px] italic" style={{ color: MX.muted }}>
                          Note: {it.guidance}
                        </div>
                      )}
                      {/* Remarks are the "write comments on back side of this
                          page" the FE sheet asks for, brought to the front. */}
                      {!locked && (
                        <input
                          value={noteOf(k, it.note)}
                          onChange={(e) => set(k, { note: e.target.value })}
                          placeholder="Remark (optional)"
                          className="mt-1.5 w-full rounded border px-2 py-1 text-[11.5px] outline-none"
                          style={{ borderColor: MX.iceLine, color: MX.ink }}
                        />
                      )}
                      {locked && it.note && (
                        <div className="mt-1 text-[11px]" style={{ color: MX.muted }}>
                          Remark: {it.note}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 sm:w-56">
                      {it.type === "YES_NO_NA" ? (
                        <div className="flex gap-1">
                          {ANSWERS.map((a) => {
                            const on = v === a;
                            const st = ANSWER_STYLE[a as Answer];
                            return (
                              <button
                                key={a}
                                type="button"
                                disabled={locked}
                                onClick={() => set(k, { value: on ? null : a })}
                                className="flex-1 rounded-lg border px-2 py-1.5 text-[11.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                                style={{
                                  background: on ? st.bg : MX.paper,
                                  color: on ? st.fg : MX.muted,
                                  borderColor: on ? st.border : MX.iceLine,
                                }}
                              >
                                {a}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          type={it.type === "NUMERIC" ? "number" : "text"}
                          step="any"
                          disabled={locked}
                          value={v ?? ""}
                          onChange={(e) => set(k, { value: e.target.value || null })}
                          placeholder={it.type === "NUMERIC" ? "Reading" : "Enter"}
                          className="w-full rounded-lg border px-2.5 py-1.5 text-[12px] outline-none disabled:bg-slate-50"
                          style={{ borderColor: MX.iceLine, color: MX.ink }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Footnotes lines={run.document.footnotes} />

      <SignOffPanel
        stage={run.stage}
        signOff={run.signOff}
        roles={run.document.signOffRoles}
        canWrite={canWrite}
        disabledReason={
          run.stage === "DRAFT" && missing.length
            ? `${missing.length} required check${missing.length > 1 ? "s" : ""} not answered.`
            : null
        }
        onAdvance={advance}
      />
    </div>
  );
}
