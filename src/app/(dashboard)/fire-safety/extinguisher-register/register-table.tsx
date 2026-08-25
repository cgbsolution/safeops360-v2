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
import { useRouter } from "next/navigation";
import { ArrowUpDown, Eye, Pencil, QrCode, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BADGE_STYLE,
  Badge,
  BadgeStatus,
  MX,
  RegisterPayload,
  RegisterRow,
  fmtDate,
} from "../lib";
import { ExportButtons } from "../_components/export-buttons";
import { RegisterDialog } from "./register-dialog";
import { QrStickerDialog, QrTarget } from "../_components/qr-sticker-dialog";

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
  canDelete = false,
  canExport = true,
}: {
  payload: RegisterPayload;
  plants: { id: string; code: string; name: string }[];
  canWrite?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<BadgeStatus | null>(null);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("location");
  const [editing, setEditing] = React.useState<RegisterRow | null>(null);
  const [open, setOpen] = React.useState(false);
  const [qrFor, setQrFor] = React.useState<QrTarget | null>(null);

  // Removal is a soft delete behind a reason, exactly as the "All other fire
  // assets" tab does it — a cylinder is statutory evidence, so the row is
  // retained with who removed it and why rather than erased. Both tabs hit the
  // same DELETE /api/fire/equipment/{id}: an extinguisher is a FireEquipment row
  // like any other, and a second delete path onto one table is the duplication
  // this consolidated register exists to remove.
  const [removing, setRemoving] = React.useState<RegisterRow | null>(null);
  const [reason, setReason] = React.useState("");
  const [delError, setDelError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (removing) {
      setReason("");
      setDelError(null);
    }
  }, [removing]);

  function remove() {
    if (!removing) return;
    setDelError(null);
    if (reason.trim().length < 10) {
      setDelError("A deletion reason of at least 10 characters is required for a governed record.");
      return;
    }
    const target = removing;
    startTransition(async () => {
      const res = await fetch(`/api/fire/equipment/${target.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const raw = d?.detail ?? d?.error;
        setDelError(
          typeof raw === "string" ? raw : raw ? JSON.stringify(raw) : `Delete failed (${res.status})`,
        );
        return;
      }
      setRemoving(null);
      router.refresh();
    });
  }

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
          <ExportButtons
            pdfHref="/api/fire/register/extinguishers/export.pdf"
            xlsxHref="/api/fire/register/extinguishers/export.xlsx"
            allowed={canExport}
          />
          {/* The realistic flow is not "print one sticker" — it is registering
              twenty cylinders and wanting one sheet to cut and apply. 24 labels
              per A4 page on Avery L7160 pitch. */}
          {canExport && rows.length > 0 && (
            <a
              href="/api/fire/assets/qr-sheet.pdf?assetType=FIRE_EXTINGUISHER"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium"
              style={{ borderColor: MX.iceLine, color: MX.navy }}
              title="Printable sheet of QR labels for every extinguisher in this register"
            >
              <QrCode size={13} /> QR labels
            </a>
          )}
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
                  {/* View / Edit / Delete. The register shipped with Edit alone,
                      so a cylinder could be corrected but never opened for its
                      inspection history and never removed when it was condemned —
                      the two things a register is actually maintained for. */}
                  <td className="whitespace-nowrap border-b px-2 py-1.5 text-right" style={{ borderColor: MX.iceLine }}>
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        href={`/fire-safety/equipment/${r.id}`}
                        className="rounded p-1 hover:bg-slate-100"
                        title="View this cylinder — detail, certificates and inspection history"
                        aria-label={`View ${r.allottedSerialNo ?? r.equipmentCode}`}
                      >
                        <Eye size={13} style={{ color: MX.navy }} />
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setQrFor({
                            id: r.id,
                            equipmentCode: r.equipmentCode,
                            allottedSerialNo: r.allottedSerialNo,
                            location: r.location,
                            type: r.type,
                          })
                        }
                        className="rounded p-1 hover:bg-slate-100"
                        title="QR sticker — print and apply to this cylinder"
                        aria-label={`QR sticker for ${r.allottedSerialNo ?? r.equipmentCode}`}
                      >
                        <QrCode size={13} style={{ color: MX.navy }} />
                      </button>
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
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setRemoving(r)}
                          className="rounded p-1 hover:bg-rose-50"
                          title="Remove from the register (soft delete, reason required)"
                          aria-label={`Remove ${r.allottedSerialNo ?? r.equipmentCode}`}
                        >
                          <Trash2 size={13} style={{ color: MX.red }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RegisterDialog open={open} onOpenChange={setOpen} row={editing} plants={plants} />
      <QrStickerDialog target={qrFor} onClose={() => setQrFor(null)} />

      {/* ── Remove a cylinder ────────────────────────────────────────────── */}
      <Dialog open={Boolean(removing)} onOpenChange={(v) => !v && setRemoving(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Remove {removing?.allottedSerialNo ?? removing?.equipmentCode} from the register
            </DialogTitle>
            <DialogDescription>
              This is a soft delete. A fire extinguisher is statutory evidence, so the record is
              retained with your name and reason and hidden from the register — it is not erased.
              The backend refuses while open defects still reference the cylinder.
            </DialogDescription>
          </DialogHeader>
          {delError && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {delError}
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Reason * (min 10 characters)
            </label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cylinder condemned after hydrostatic test failure; replaced by FE-ACS-0031."
            />
            <p className="mt-1 text-[11px] text-slate-400">{reason.trim().length}/10</p>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRemoving(null)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending || reason.trim().length < 10}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {pending ? "Removing…" : "Remove cylinder"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
