"use client";

// View / Edit / Delete for one row of the Fire Equipment Register.
//
// The register shipped with no actions at all — not even a link on the code
// column. This is the missing action set. Edit and Delete are dialogs rather
// than separate routes so an operator correcting a location does not lose their
// filter and scroll position over a two-field change.
//
// Delete is a SOFT delete: FireEquipment is a governed entity, so the ORM guard
// blocks a hard delete outright and the row survives with who removed it and
// why. The dialog says so, because "Delete" that does not delete is worse than
// no button if the user is not told.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Can } from "@/components/auth/can";

// The FIRE module borrows the HSE permission codes until dedicated FIRE.* grants
// are seeded — same constant the backend router enforces (_WRITE). Named here so
// the swap is one edit on each side rather than a search for string literals.
const WRITE_PERMISSION = "INCIDENT.UPDATE";

export type EquipmentRow = {
  id: string;
  equipmentCode: string;
  type: string;
  assetSubtype: string | null;
  location: string;
  zoneId: string | null;
  status: string;
  make: string | null;
  model: string | null;
  serialNo: string | null;
  capacitySpec: string | null;
  maintenanceContractor: string | null;
};

type Zone = { id: string; zoneCode: string; name: string; plantId: string };

const ASSET_TYPES = [
  "FIRE_EXTINGUISHER",
  "HYDRANT",
  "HOSE_REEL",
  "SPRINKLER_HEAD",
  "FIRE_PUMP",
  "FIRE_WATER_TANK",
  "PANEL",
  "DETECTOR",
  "HEAT_DETECTOR",
  "PA_SYSTEM",
  "SMOKE_CURTAIN",
  "EMERGENCY_LIGHT",
  "OTHER",
];

const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-slate-500";
const FIELD =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 " +
  "focus:border-slate-400 focus:outline-none";

export function RowActions({ row, zones }: { row: EquipmentRow; zones: Zone[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Edit state, seeded from the row each time the dialog opens so a cancelled
  // edit followed by a reopen does not show the abandoned values.
  const [form, setForm] = React.useState(row);
  React.useEffect(() => {
    if (editOpen) {
      setForm(row);
      setError(null);
    }
  }, [editOpen, row]);

  const [reason, setReason] = React.useState("");
  React.useEffect(() => {
    if (delOpen) {
      setReason("");
      setError(null);
    }
  }, [delOpen]);

  function set<K extends keyof EquipmentRow>(k: K, v: EquipmentRow[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Both derived from the STORED row, so they stay stable while the user edits.
  const typeOptions = React.useMemo(
    () => (ASSET_TYPES.includes(row.type) ? ASSET_TYPES : [row.type, ...ASSET_TYPES]),
    [row.type],
  );
  const orphanZoneId =
    form.zoneId && !zones.some((z) => z.id === form.zoneId) ? form.zoneId : null;

  // Fields this dialog is allowed to change, and how each is normalised for the
  // wire. Driving the diff off one list keeps the payload and the form in step.
  const EDITABLE: (keyof EquipmentRow)[] = [
    "type", "assetSubtype", "location", "zoneId", "make", "model",
    "serialNo", "capacitySpec", "maintenanceContractor",
  ];

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.location.trim().length < 2) return setError("Location is required.");

    // Send ONLY what changed. The backend PATCH is exclude_unset, so an omitted
    // key is left alone — whereas sending the whole row means any column the
    // list serializer stops returning arrives as null and is silently erased.
    // Correcting a typo in Location must not be able to wipe make/model/serial.
    const patch: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      const next = typeof form[k] === "string" ? (form[k] as string).trim() || null : form[k] ?? null;
      const prev = typeof row[k] === "string" ? (row[k] as string).trim() || null : row[k] ?? null;
      if (next !== prev) patch[k] = next;
    }
    if (Object.keys(patch).length === 0) {
      setEditOpen(false);
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/fire/equipment/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(detailOf(d) ?? `Update failed (${res.status})`);
        return;
      }
      setEditOpen(false);
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    if (reason.trim().length < 10) {
      return setError("A deletion reason of at least 10 characters is required for a governed record.");
    }
    startTransition(async () => {
      const res = await fetch(`/api/fire/equipment/${row.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(detailOf(d) ?? `Delete failed (${res.status})`);
        return;
      }
      setDelOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Actions for ${row.equipmentCode}`}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ⋯
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem asChild>
            <Link href={`/fire-safety/equipment/${row.id}`}>View details</Link>
          </DropdownMenuItem>
          {/* Both mutating actions are permission-gated. Without this a viewer
              with INCIDENT.READ but not INCIDENT.UPDATE — six roles hold exactly
              that — is offered Edit and Delete and only learns otherwise from a
              403 after filling in the form. */}
          <Can permission={WRITE_PERMISSION}>
            {/* No preventDefault: in Radix that KEEPS the menu open, so the
                dialog would mount over a still-open modal menu — two body scroll
                locks and two focus scopes fighting each other. Letting the menu
                close and deferring a tick lets Radix finish restoring focus to
                the trigger first; opening synchronously races that restore and
                the dialog loses focus the instant it appears. */}
            <DropdownMenuItem onSelect={() => setTimeout(() => setEditOpen(true), 0)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-700 focus:text-rose-800"
              onSelect={() => setTimeout(() => setDelOpen(true), 0)}
            >
              Delete
            </DropdownMenuItem>
          </Can>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Edit ─────────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {row.equipmentCode}</DialogTitle>
            <DialogDescription>
              Status, inspection dates and the QR code are derived and cannot be edited here —
              status changes go through Out of Service, and due dates come from the frequency rule.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Type</label>
                <select className={FIELD} value={form.type} onChange={(e) => set("type", e.target.value)}>
                  {/* The STORED value may predate this list (seed data uses its
                      own vocabulary), so it is offered rather than silently
                      reset. Keyed on row.type, not form.type — keying on the
                      latter made the legacy option vanish the moment the user
                      picked anything else, with no way back to the original. */}
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Subtype</label>
                <input className={FIELD} value={form.assetSubtype ?? ""} onChange={(e) => set("assetSubtype", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Location *</label>
                <input className={FIELD} value={form.location} onChange={(e) => set("location", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Zone</label>
                <select className={FIELD} value={form.zoneId ?? ""} onChange={(e) => set("zoneId", e.target.value)}>
                  <option value="">— Unzoned —</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.zoneCode} — {z.name}</option>
                  ))}
                  {/* The asset's current zone, when the fetched list does not
                      contain it — the list is empty until the Fire & Life Safety
                      DDL runs. Without this the select falls back to the only
                      option present, "Unzoned", and saving quietly unlinks a zone
                      the user never touched. */}
                  {orphanZoneId && (
                    <option value={orphanZoneId}>Current zone ({orphanZoneId.slice(0, 8)}…)</option>
                  )}
                </select>
                {orphanZoneId && (
                  <p className="mt-1 text-[11px] text-amber-600">
                    Zone list unavailable — the current zone is preserved unless you change it.
                  </p>
                )}
              </div>
              <div>
                <label className={LABEL}>Capacity / spec</label>
                <input className={FIELD} value={form.capacitySpec ?? ""} onChange={(e) => set("capacitySpec", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Make</label>
                <input className={FIELD} value={form.make ?? ""} onChange={(e) => set("make", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Model</label>
                <input className={FIELD} value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Serial no.</label>
                <input className={FIELD} value={form.serialNo ?? ""} onChange={(e) => set("serialNo", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Maintenance contractor</label>
                <input className={FIELD} value={form.maintenanceContractor ?? ""} onChange={(e) => set("maintenanceContractor", e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">
                {pending ? "Saving…" : "Save changes"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete ───────────────────────────────────────────────────────── */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Remove {row.equipmentCode} from the register</DialogTitle>
            <DialogDescription>
              This is a soft delete. A fire asset is statutory evidence, so the record is retained
              with your name and reason and hidden from the register — it is not erased. It can be
              restored within 30 days.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </div>
          )}
          <div>
            <label className={LABEL}>Reason * (min 10 characters)</label>
            <textarea
              className={FIELD}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cylinder condemned after hydrostatic test failure; replaced by FE-ACS-0031."
            />
            <p className="mt-1 text-[11px] text-slate-400">{reason.trim().length}/10</p>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setDelOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400">
              Cancel
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending || reason.trim().length < 10}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {pending ? "Removing…" : "Remove asset"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** FastAPI returns `{detail: ...}`; `detail` may be a string, an object (our
 *  gate payloads) or a Pydantic 422 error array. Flattened to one line rather
 *  than rendering "[object Object]" at the user. */
function detailOf(d: any): string | null {
  const raw = d?.detail ?? d?.error;
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw.map((x) => x?.msg ?? JSON.stringify(x)).join("; ");
  }
  if (Array.isArray(raw?.blockers)) {
    return raw.blockers.map((b: any) => b.message).join(" ");
  }
  return JSON.stringify(raw);
}
