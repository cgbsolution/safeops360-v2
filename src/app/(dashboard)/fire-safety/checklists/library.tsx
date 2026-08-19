"use client";

// The Checklist Library — view, add, revise, publish, retire and delete the
// controlled fire checklists.
//
// The eleven Page Industries sheets arrived as seed data, which made "the client
// sent us CL/029" a developer ticket. This is the screen that makes it not one.
//
// WHAT THE BUTTONS ACTUALLY DO, AND WHY THEY DIFFER
// ------------------------------------------------
// Edit    only while nothing has been recorded against the sheet. Once an
//         inspection exists, editing the items would change what a signed record
//         was answering, so the button is replaced by Revise.
// Revise  clone to a new DRAFT revision. The old one keeps serving the
//         inspections filed against it.
// Publish DRAFT -> APPROVED, retiring the previous revision of the same sheet.
//         A separate permission from Edit on purpose: publishing a controlled
//         document is a document-control act, and the person who transcribed it
//         should not also rule it fit to publish.
// Retire  stop offering it; existing records stay readable.
// Delete  only when nothing was ever recorded. Otherwise the backend retires it
//         instead and says so — which this screen shows rather than swallowing.
//
// Controls are driven by /api/fire/checklists/capabilities, not by guessing from
// a role name, so a screen never offers an action that will 403.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Copy, FileText, Loader2, Lock, Pencil, Plus, Send, Trash2, XCircle,
} from "lucide-react";
import { DISPLAY_FONT, MX, fmtDate } from "../lib";
import { ChecklistEditor } from "./editor";
import { ChecklistSummary, Caps, fireApi } from "./types";

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: MX.ice, fg: MX.muted },
  IN_REVIEW: { bg: MX.amberSoft, fg: MX.amber },
  APPROVED: { bg: MX.greenSoft, fg: MX.green },
  RETIRED: { bg: MX.redSoft, fg: MX.red },
};

const FREQ_LABEL: Record<string, string> = {
  DAILY: "Daily", MONTHLY: "Monthly", QUARTERLY: "Quarterly", ANNUAL: "Annually",
};

const ASSET_LABEL: Record<string, string> = {
  FIRE_ALARM_PANEL: "Fire alarm panel",
  BEAM_DETECTOR: "Beam detector",
  FIRE_HYDRANT_SYSTEM: "Hydrant & sprinkler",
  FIRE_EXTINGUISHER: "Fire extinguisher",
};

export function ChecklistLibrary({
  initial,
  caps,
  loadError,
}: {
  initial: ChecklistSummary[];
  caps: Caps;
  loadError: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [showRetired, setShowRetired] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<{ id: string | null } | null>(null);

  React.useEffect(() => setItems(initial), [initial]);

  async function reload(includeRetired = showRetired) {
    const d = await fireApi<{ items: ChecklistSummary[] }>(
      `/api/fire/checklists/templates?includeRetired=${includeRetired}`,
    );
    setItems(d.items ?? []);
  }

  async function act(id: string, label: string, run: () => Promise<any>) {
    setBusy(`${id}:${label}`);
    setError(null);
    setNotice(null);
    try {
      const res = await run();
      await reload();
      router.refresh();
      if (res?.retiredTemplates?.length) {
        setNotice(`Published. Retired the previous revision: ${res.retiredTemplates.join(", ")}.`);
      } else if (res?.reason) {
        setNotice(res.reason);
      } else {
        setNotice(`${label} done.`);
      }
    } catch (e: any) {
      setError(e?.message ?? `${label} failed.`);
    } finally {
      setBusy(null);
    }
  }

  const visible = React.useMemo(
    () => (showRetired ? items : items.filter((t) => t.status !== "RETIRED")),
    [items, showRetired],
  );

  if (loadError) {
    return (
      <div
        className="rounded-xl border p-6 text-[13px]"
        style={{ borderColor: MX.red, background: MX.redSoft, color: MX.red }}
      >
        {loadError}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[12px]" style={{ color: MX.muted }}>
          <input
            type="checkbox"
            checked={showRetired}
            onChange={(e) => {
              setShowRetired(e.target.checked);
              reload(e.target.checked).catch(() => {});
            }}
          />
          Show retired revisions
        </label>
        <span className="text-[11.5px]" style={{ color: MX.muted }}>
          {visible.length} checklist{visible.length === 1 ? "" : "s"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {notice && (
            <span className="max-w-md text-[11px]" style={{ color: MX.muted }}>
              {notice}
            </span>
          )}
          {error && (
            <span className="max-w-md text-[11px] font-medium" style={{ color: MX.red }}>
              {error}
            </span>
          )}
          {caps.templateAuthor && (
            <button
              type="button"
              onClick={() => setEditing({ id: null })}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white"
              style={{ background: MX.navy }}
            >
              <Plus size={13} /> Add checklist
            </button>
          )}
        </div>
      </div>

      {!caps.templateAuthor && (
        <div
          className="mb-3 rounded-lg border px-3 py-2 text-[11.5px]"
          style={{ borderColor: MX.iceLine, background: MX.ice, color: MX.muted }}
        >
          You can view the checklist library but not change it. Adding or revising a controlled
          checklist needs <code>FIRE.TEMPLATE_AUTHOR</code>; publishing one needs{" "}
          <code>FIRE.TEMPLATE_APPROVE</code>.
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {visible.length === 0 ? (
          <div
            className="rounded-xl border p-8 text-center text-[13px] lg:col-span-2"
            style={{ borderColor: MX.iceLine, color: MX.muted }}
          >
            No checklists yet. Run <code>python seed_fire_checklists.py</code> for the eleven Page
            Industries sheets, or add one here.
          </div>
        ) : (
          visible.map((t) => {
            const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.DRAFT;
            const frozen = Boolean(t.frozen);
            const b = (label: string) => busy === `${t.id}:${label}`;
            return (
              <div
                key={t.id}
                className="rounded-xl border bg-white p-3"
                style={{ borderColor: t.status === "RETIRED" ? MX.iceLine : MX.iceLine, opacity: t.status === "RETIRED" ? 0.72 : 1 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold tracking-wide" style={{ color: MX.gold }}>
                      {t.document.documentNo} · {t.document.revision}
                    </div>
                    <div
                      className="truncate text-[13px] font-semibold"
                      style={{ color: MX.navy, fontFamily: DISPLAY_FONT }}
                      title={t.name}
                    >
                      {t.name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: MX.muted }}>
                      <span>{ASSET_LABEL[t.document.assetType ?? ""] ?? t.document.assetType}</span>
                      <span>·</span>
                      <span>{FREQ_LABEL[t.document.frequency ?? ""] ?? t.document.frequency}</span>
                      {t.document.siteVariant && (
                        <>
                          <span>·</span>
                          <span>{t.document.siteVariant.replace(/_/g, "-")}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {t.itemCount} item{t.itemCount === 1 ? "" : "s"} in {t.sectionCount} section
                        {t.sectionCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10.5px]" style={{ color: MX.muted }}>
                      Effective {fmtDate(t.document.effectiveDate)} · review {fmtDate(t.document.reviewDate)}
                      {t.document.supersedesNo ? ` · supersedes ${t.document.supersedesNo}` : ""}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    {t.status}
                  </span>
                </div>

                {(frozen || t.seeded) && (
                  <div className="mt-2 space-y-1">
                    {frozen && (
                      <div className="flex items-start gap-1.5 text-[10.5px]" style={{ color: MX.muted }}>
                        <Lock size={11} className="mt-0.5 shrink-0" />
                        <span>
                          {t.runCount} inspection{t.runCount === 1 ? "" : "s"} recorded — items are frozen.
                          Revise to change the wording; the old revision keeps serving those records.
                        </span>
                      </div>
                    )}
                    {t.seeded && (
                      <div className="flex items-start gap-1.5 text-[10.5px]" style={{ color: MX.amber }}>
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                        <span>
                          Transcribed client sheet. A direct edit is overwritten next time
                          <code className="mx-1">seed_fire_checklists.py</code> runs — revise instead to
                          keep your change.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditing({ id: t.id })}
                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium"
                    style={{ borderColor: MX.iceLine, color: MX.navy }}
                  >
                    <FileText size={11} /> View
                  </button>

                  {caps.templateAuthor && !frozen && t.status !== "RETIRED" && (
                    <button
                      type="button"
                      onClick={() => setEditing({ id: t.id })}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium"
                      style={{ borderColor: MX.iceLine, color: MX.navy }}
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  )}

                  {caps.templateAuthor && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        act(t.id, "Revise", () =>
                          fireApi(`/api/fire/checklists/templates/${t.id}/clone`, { method: "POST", body: "{}" }),
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium disabled:opacity-50"
                      style={{ borderColor: MX.iceLine, color: MX.navy }}
                      title="Clone to a new DRAFT revision"
                    >
                      {b("Revise") ? <Loader2 size={11} className="animate-spin" /> : <Copy size={11} />} Revise
                    </button>
                  )}

                  {caps.templateApprove && (t.status === "DRAFT" || t.status === "IN_REVIEW") && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        act(t.id, "Publish", () =>
                          fireApi(`/api/fire/checklists/templates/${t.id}/publish`, { method: "POST" }),
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                      style={{ background: MX.green }}
                    >
                      {b("Publish") ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Publish
                    </button>
                  )}

                  {caps.templateApprove && t.status === "APPROVED" && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        act(t.id, "Retire", () =>
                          fireApi(`/api/fire/checklists/templates/${t.id}/retire`, { method: "POST" }),
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium disabled:opacity-50"
                      style={{ borderColor: MX.iceLine, color: MX.muted }}
                    >
                      {b("Retire") ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />} Retire
                    </button>
                  )}

                  {caps.delete && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => {
                        const msg = frozen
                          ? `${t.runCount} inspection(s) are recorded against "${t.name}", so it will be RETIRED rather than deleted — those records must stay readable. Continue?`
                          : `Delete "${t.name}"? Nothing has been recorded against it, so it will be removed permanently.`;
                        if (!confirm(msg)) return;
                        act(t.id, "Delete", () =>
                          fireApi(`/api/fire/checklists/templates/${t.id}`, { method: "DELETE" }),
                        );
                      }}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium disabled:opacity-50"
                      style={{ borderColor: MX.iceLine, color: MX.red }}
                    >
                      {b("Delete") ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <ChecklistEditor
          templateId={editing.id}
          readOnly={!caps.templateAuthor}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
