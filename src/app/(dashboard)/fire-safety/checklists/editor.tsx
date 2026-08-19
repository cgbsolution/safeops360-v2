"use client";

// The checklist authoring dialog — the document header, then its sections and items.
//
// Doubles as the read-only viewer, because "let me see exactly what this sheet
// asks" and "let me change it" want the same layout, and a separate viewer would
// be a second place for the two to drift.
//
// THE ITEM KEY IS THE POINT
// -------------------------
// Every stored answer is keyed to an item's `key`, not to its wording or its
// position. That is what lets a revision fix a typo, reorder rows or move an item
// under a different heading without orphaning the inspections already recorded.
// So the key is editable while an item is new and locked once it has been saved:
// renaming a key that answers exist under would silently lose that history, which
// is why the backend refuses to drop a key on a published sheet at all.

import * as React from "react";
import { GripVertical, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { DISPLAY_FONT, MX } from "../lib";
import {
  ASSET_TYPES,
  ChecklistDefinition,
  ChecklistDetail,
  ChecklistItemDef,
  DEFAULT_SIGN_OFF_ROLES,
  FREQUENCIES,
  ITEM_TYPES,
  LAYOUTS_FOR_FREQUENCY,
  fireApi,
  slugify,
} from "./types";

const LABEL = "block text-[10px] font-semibold uppercase tracking-wider";
const FIELD = "mt-1 w-full rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none disabled:bg-slate-50";

function blankDefinition(): ChecklistDefinition {
  return {
    name: "",
    documentNo: "",
    supersedesNo: "",
    revision: "R1",
    effectiveDate: "",
    reviewDate: "",
    department: "EHS",
    assetType: "FIRE_ALARM_PANEL",
    frequency: "MONTHLY",
    layout: "FORM",
    siteVariant: "",
    sourceSheet: "",
    signOffRoles: [...DEFAULT_SIGN_OFF_ROLES],
    footnotes: [],
    sections: [{ title: "Checks to be done", note: null, items: [] }],
  };
}

function blankItem(n: number): ChecklistItemDef {
  return { key: "", text: "", type: "YES_NO_NA", guidance: null, mandatory: true, triggersFinding: false };
}

export function ChecklistEditor({
  templateId,
  readOnly,
  onClose,
  onSaved,
}: {
  templateId: string | null;
  readOnly?: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [def, setDef] = React.useState<ChecklistDefinition | null>(templateId ? null : blankDefinition());
  const [meta, setMeta] = React.useState<ChecklistDetail | null>(null);
  const [loading, setLoading] = React.useState(Boolean(templateId));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Keys that came back from the server: locked, because answers are stored
  // against them.
  const [persistedKeys, setPersistedKeys] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    fireApi<ChecklistDetail>(`/api/fire/checklists/templates/${templateId}`)
      .then((d) => {
        if (cancelled) return;
        setMeta(d);
        setDef(d.definition);
        setPersistedKeys(new Set(d.definition.sections.flatMap((s) => s.items.map((i) => i.key))));
      })
      .catch((e) => !cancelled && setError(e?.message ?? "Could not load this checklist."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  // Frozen sheets and read-only viewers get the same treatment: everything
  // disabled and a line saying why, rather than inputs that reject on save.
  const frozen = Boolean(meta?.frozen) || meta?.status === "RETIRED";
  const disabled = Boolean(readOnly) || frozen;

  function patch(p: Partial<ChecklistDefinition>) {
    setDef((d) => (d ? { ...d, ...p } : d));
  }

  function patchSection(idx: number, p: Partial<ChecklistDefinition["sections"][number]>) {
    setDef((d) =>
      d ? { ...d, sections: d.sections.map((s, i) => (i === idx ? { ...s, ...p } : s)) } : d,
    );
  }

  function patchItem(sIdx: number, iIdx: number, p: Partial<ChecklistItemDef>) {
    setDef((d) =>
      d
        ? {
            ...d,
            sections: d.sections.map((s, i) =>
              i === sIdx ? { ...s, items: s.items.map((it, j) => (j === iIdx ? { ...it, ...p } : it)) } : s,
            ),
          }
        : d,
    );
  }

  function addItem(sIdx: number) {
    setDef((d) =>
      d
        ? {
            ...d,
            sections: d.sections.map((s, i) =>
              i === sIdx ? { ...s, items: [...s.items, blankItem(s.items.length + 1)] } : s,
            ),
          }
        : d,
    );
  }

  function removeItem(sIdx: number, iIdx: number) {
    setDef((d) =>
      d
        ? {
            ...d,
            sections: d.sections.map((s, i) =>
              i === sIdx ? { ...s, items: s.items.filter((_, j) => j !== iIdx) } : s,
            ),
          }
        : d,
    );
  }

  function moveItem(sIdx: number, iIdx: number, delta: number) {
    setDef((d) => {
      if (!d) return d;
      const items = [...d.sections[sIdx].items];
      const to = iIdx + delta;
      if (to < 0 || to >= items.length) return d;
      [items[iIdx], items[to]] = [items[to], items[iIdx]];
      return { ...d, sections: d.sections.map((s, i) => (i === sIdx ? { ...s, items } : s)) };
    });
  }

  async function save() {
    if (!def) return;
    setSaving(true);
    setError(null);
    try {
      // Auto-fill blank keys from the wording so an author is not forced to
      // invent slugs; explicit keys are always kept.
      const body: ChecklistDefinition = {
        ...def,
        sections: def.sections.map((s, si) => ({
          ...s,
          items: s.items.map((it, ii) => ({
            ...it,
            key: (it.key || "").trim() || slugify(it.text, `item_${si + 1}_${ii + 1}`),
          })),
        })),
      };
      if (templateId) {
        await fireApi(`/api/fire/checklists/templates/${templateId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await fireApi("/api/fire/checklists/templates", { method: "POST", body: JSON.stringify(body) });
      }
      await onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const layouts = def ? LAYOUTS_FOR_FREQUENCY[def.frequency] ?? [] : [];
  const itemTotal = def?.sections.reduce((n, s) => n + s.items.length, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl">
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-xl px-4 py-3"
          style={{ background: MX.navy }}
        >
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: MX.gold }}>
              {templateId ? meta?.document.documentNo ?? "Checklist" : "New controlled checklist"}
            </div>
            <div className="truncate text-[15px] font-semibold text-white" style={{ fontFamily: DISPLAY_FONT }}>
              {def?.name || def?.documentNo || "Untitled checklist"}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-white/80 hover:bg-white/10" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-[13px]" style={{ color: MX.muted }}>
              <Loader2 size={15} className="animate-spin" /> Loading…
            </div>
          ) : !def ? (
            <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: MX.redSoft, color: MX.red }}>
              {error ?? "Could not load this checklist."}
            </div>
          ) : (
            <>
              {frozen && (
                <div
                  className="mb-3 rounded-lg border px-3 py-2 text-[11.5px]"
                  style={{ borderColor: MX.gold, background: MX.amberSoft, color: MX.amber }}
                >
                  {meta?.status === "RETIRED" ? (
                    <>This revision is retired and read-only. Revise it from the library to make a new draft.</>
                  ) : (
                    <>
                      {meta?.runCount} inspection{meta?.runCount === 1 ? "" : "s"} recorded against this
                      sheet, so it is read-only — editing the items would change what a signed record was
                      answering. Use <strong>Revise</strong> in the library to make a new revision.
                    </>
                  )}
                </div>
              )}
              {readOnly && !frozen && (
                <div
                  className="mb-3 rounded-lg border px-3 py-2 text-[11.5px]"
                  style={{ borderColor: MX.iceLine, background: MX.ice, color: MX.muted }}
                >
                  Read-only. Changing a controlled checklist needs <code>FIRE.TEMPLATE_AUTHOR</code>.
                </div>
              )}

              {/* ── document header ─────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="col-span-2">
                  <label className={LABEL} style={{ color: MX.muted }}>
                    Checklist name
                  </label>
                  <input
                    disabled={disabled}
                    value={def.name ?? ""}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder="Monthly Fire Hydrant System Maintenance Checklist"
                    className={FIELD}
                    style={{ borderColor: MX.iceLine, color: MX.ink }}
                  />
                </div>
                <div>
                  <label className={LABEL} style={{ color: MX.muted }}>
                    Document No.
                  </label>
                  <input
                    disabled={disabled}
                    value={def.documentNo}
                    onChange={(e) => patch({ documentNo: e.target.value })}
                    placeholder="PIL/EHSD/CL/029-R1"
                    className={FIELD}
                    style={{ borderColor: MX.iceLine, color: MX.ink }}
                  />
                </div>
                <div>
                  <label className={LABEL} style={{ color: MX.muted }}>
                    Revision
                  </label>
                  <input
                    disabled={disabled}
                    value={def.revision}
                    onChange={(e) => patch({ revision: e.target.value })}
                    className={FIELD}
                    style={{ borderColor: MX.iceLine, color: MX.ink }}
                  />
                </div>
                <div>
                  <label className={LABEL} style={{ color: MX.muted }}>
                    Supersedes No.
                  </label>
                  <input
                    disabled={disabled}
                    value={def.supersedesNo ?? ""}
                    onChange={(e) => patch({ supersedesNo: e.target.value })}
                    className={FIELD}
                    style={{ borderColor: MX.iceLine, color: MX.ink }}
                  />
                </div>
                <div>
                  <label className={LABEL} style={{ color: MX.muted }}>
                    Effective date
                  </label>
                  <input
                    type="date"
                    disabled={disabled}
                    value={(def.effectiveDate ?? "").slice(0, 10)}
                    onChange={(e) => patch({ effectiveDate: e.target.value })}
                    className={FIELD}
                    style={{ borderColor: MX.iceLine, color: MX.ink }}
                  />
                </div>
                <div>
                  <label className={LABEL} style={{ color: MX.muted }}>
                    Review date
                  </label>
                  <input
                    type="date"
                    disabled={disabled}
                    value={(def.reviewDate ?? "").slice(0, 10)}
                    onChange={(e) => patch({ reviewDate: e.target.value })}
                    className={FIELD}
                    style={{ borderColor: MX.iceLine, color: MX.ink }}
                  />
                </div>
                <div>
                  <label className={LABEL} style={{ color: MX.muted }}>
                    Applies to
                  </label>
                  <select
                    disabled={disabled}
                    value={def.assetType}
                    onChange={(e) => patch({ assetType: e.target.value })}
                    className={FIELD}
                    style={{ borderColor: MX.iceLine, color: MX.ink }}
                  >
                    {ASSET_TYPES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL} style={{ color: MX.muted }}>
                    Frequency
                  </label>
                  <select
                    disabled={disabled}
                    value={def.frequency}
                    onChange={(e) => {
                      const frequency = e.target.value;
                      const allowed = LAYOUTS_FOR_FREQUENCY[frequency] ?? [];
                      // Snap the layout to one this cadence supports. An ANNUAL
                      // sheet has no grid, and leaving a stale DAY_GRID selected
                      // would fail validation on save with no visible cause.
                      const layout = allowed.some((l) => l.value === def.layout)
                        ? def.layout
                        : allowed[0]?.value ?? "FORM";
                      patch({ frequency, layout });
                    }}
                    className={FIELD}
                    style={{ borderColor: MX.iceLine, color: MX.ink }}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={LABEL} style={{ color: MX.muted }}>
                    Layout
                  </label>
                  <select
                    disabled={disabled}
                    value={def.layout}
                    onChange={(e) => patch({ layout: e.target.value })}
                    className={FIELD}
                    style={{ borderColor: MX.iceLine, color: MX.ink }}
                  >
                    {layouts.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={LABEL} style={{ color: MX.muted }}>
                    Unit variant <span className="font-normal normal-case">(only where two units&rsquo; sheets differ)</span>
                  </label>
                  <input
                    disabled={disabled}
                    value={def.siteVariant ?? ""}
                    onChange={(e) => patch({ siteVariant: e.target.value })}
                    placeholder="UNIT_21_A"
                    className={FIELD}
                    style={{ borderColor: MX.iceLine, color: MX.ink }}
                  />
                </div>
              </div>

              {/* ── sections + items ────────────────────────────────────── */}
              <div className="mt-4 flex items-center justify-between">
                <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: MX.navy }}>
                  Sections &amp; items
                  <span className="ml-1.5 font-normal normal-case" style={{ color: MX.muted }}>
                    {itemTotal} item{itemTotal === 1 ? "" : "s"}
                  </span>
                </h3>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() =>
                      patch({ sections: [...def.sections, { title: "", note: null, items: [] }] })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium"
                    style={{ borderColor: MX.iceLine, color: MX.navy }}
                  >
                    <Plus size={11} /> Add section
                  </button>
                )}
              </div>

              <div className="mt-2 space-y-3">
                {def.sections.map((sec, sIdx) => (
                  <div key={sIdx} className="rounded-xl border" style={{ borderColor: MX.iceLine }}>
                    <div
                      className="flex flex-wrap items-center gap-2 px-3 py-2"
                      style={{ background: MX.ice, borderBottom: `1px solid ${MX.iceLine}` }}
                    >
                      <input
                        disabled={disabled}
                        value={sec.title}
                        onChange={(e) => patchSection(sIdx, { title: e.target.value })}
                        placeholder="Section heading — e.g. Valves:"
                        className="flex-1 rounded border px-2 py-1 text-[12px] font-semibold outline-none"
                        style={{ borderColor: MX.iceLine, color: MX.navy, minWidth: 180 }}
                      />
                      <input
                        disabled={disabled}
                        value={sec.note ?? ""}
                        onChange={(e) => patchSection(sIdx, { note: e.target.value || null })}
                        placeholder="Note printed under the heading (optional)"
                        className="flex-1 rounded border px-2 py-1 text-[11.5px] outline-none"
                        style={{ borderColor: MX.iceLine, color: MX.ink, minWidth: 180 }}
                      />
                      {!disabled && def.sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            patch({ sections: def.sections.filter((_, i) => i !== sIdx) })
                          }
                          className="rounded p-1 hover:bg-white"
                          title="Remove section"
                        >
                          <Trash2 size={12} style={{ color: MX.red }} />
                        </button>
                      )}
                    </div>

                    <div className="divide-y" style={{ borderColor: MX.iceLine }}>
                      {sec.items.length === 0 && (
                        <div className="px-3 py-3 text-[11.5px]" style={{ color: MX.muted }}>
                          No items in this section yet.
                        </div>
                      )}
                      {sec.items.map((it, iIdx) => {
                        const keyLocked = disabled || persistedKeys.has(it.key);
                        return (
                          <div key={iIdx} className="flex flex-wrap items-start gap-2 px-3 py-2">
                            <div className="flex flex-col items-center pt-1.5" style={{ color: MX.iceLine }}>
                              <GripVertical size={12} />
                              {!disabled && (
                                <div className="flex flex-col">
                                  <button type="button" onClick={() => moveItem(sIdx, iIdx, -1)} className="text-[9px] leading-none hover:opacity-70" style={{ color: MX.muted }} title="Move up">
                                    ▲
                                  </button>
                                  <button type="button" onClick={() => moveItem(sIdx, iIdx, 1)} className="text-[9px] leading-none hover:opacity-70" style={{ color: MX.muted }} title="Move down">
                                    ▼
                                  </button>
                                </div>
                              )}
                            </div>

                            <span className="pt-1.5 text-[11px] tabular-nums" style={{ color: MX.muted, minWidth: 18 }}>
                              {iIdx + 1}.
                            </span>

                            <div className="min-w-0 flex-1 space-y-1.5">
                              <textarea
                                disabled={disabled}
                                value={it.text}
                                onChange={(e) => patchItem(sIdx, iIdx, { text: e.target.value })}
                                rows={2}
                                placeholder="The check, worded exactly as the source sheet prints it"
                                className="w-full rounded border px-2 py-1 text-[12px] outline-none"
                                style={{ borderColor: MX.iceLine, color: MX.ink }}
                              />
                              <input
                                disabled={disabled}
                                value={it.guidance ?? ""}
                                onChange={(e) => patchItem(sIdx, iIdx, { guidance: e.target.value || null })}
                                placeholder="Note / guidance printed with the item (optional)"
                                className="w-full rounded border px-2 py-1 text-[11px] outline-none"
                                style={{ borderColor: MX.iceLine, color: MX.muted }}
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  disabled={keyLocked}
                                  value={it.key}
                                  onChange={(e) => patchItem(sIdx, iIdx, { key: e.target.value })}
                                  placeholder="item_key"
                                  title={
                                    keyLocked && persistedKeys.has(it.key)
                                      ? "Locked: recorded answers are keyed to this. Renaming it would orphan them."
                                      : "Stable identity for this row. Leave blank to derive it from the wording."
                                  }
                                  className="rounded border px-2 py-0.5 font-mono text-[10.5px] outline-none disabled:bg-slate-50"
                                  style={{ borderColor: MX.iceLine, color: MX.muted, width: 150 }}
                                />
                                <select
                                  disabled={disabled}
                                  value={it.type}
                                  onChange={(e) => patchItem(sIdx, iIdx, { type: e.target.value as any })}
                                  className="rounded border px-1.5 py-0.5 text-[10.5px] outline-none"
                                  style={{ borderColor: MX.iceLine, color: MX.ink }}
                                >
                                  {ITEM_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                                <label className="flex items-center gap-1 text-[10.5px]" style={{ color: MX.muted }}>
                                  <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={it.mandatory}
                                    onChange={(e) => patchItem(sIdx, iIdx, { mandatory: e.target.checked })}
                                  />
                                  required to submit
                                </label>
                                <label
                                  className="flex items-center gap-1 text-[10.5px]"
                                  style={{ color: MX.muted }}
                                  title="A 'No' on this item raises a CAMS finding. Off by default — a daily grid would otherwise flood the findings register."
                                >
                                  <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={it.triggersFinding}
                                    onChange={(e) => patchItem(sIdx, iIdx, { triggersFinding: e.target.checked })}
                                  />
                                  &ldquo;No&rdquo; raises a finding
                                </label>
                              </div>
                            </div>

                            {!disabled && (
                              <button
                                type="button"
                                onClick={() => removeItem(sIdx, iIdx)}
                                className="rounded p-1 hover:bg-slate-100"
                                title={
                                  persistedKeys.has(it.key)
                                    ? "Removing a saved item is refused on a published sheet — answers are keyed to it"
                                    : "Remove item"
                                }
                              >
                                <Trash2 size={12} style={{ color: MX.red }} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {!disabled && (
                      <div className="px-3 py-2" style={{ borderTop: `1px solid ${MX.iceLine}` }}>
                        <button
                          type="button"
                          onClick={() => addItem(sIdx)}
                          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium"
                          style={{ borderColor: MX.iceLine, color: MX.navy }}
                        >
                          <Plus size={11} /> Add item
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-3 rounded-lg px-3 py-2 text-[12px] font-medium" style={{ background: MX.redSoft, color: MX.red }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div
          className="sticky bottom-0 flex items-center justify-end gap-2 rounded-b-xl px-4 py-3"
          style={{ background: MX.paper, borderTop: `1px solid ${MX.iceLine}` }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-[12.5px] font-medium"
            style={{ borderColor: MX.iceLine, color: MX.navy }}
          >
            {disabled ? "Close" : "Cancel"}
          </button>
          {!disabled && def && (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
              style={{ background: MX.navy }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {templateId ? "Save changes" : "Create as draft"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
