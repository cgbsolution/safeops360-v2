"use client";

// Ownership of record — the `DisciplineOwner` config the own-work guard reads.
//
// **Why it lives here now.** It used to sit as a tab on the Independence screen,
// next to the impartiality evidence. That pairing is what made both halves read
// half-empty: one is configuration you maintain, the other is evidence you hand
// to a certification body, and putting a "＋ Add owner" button beside an
// evidence register invites the reader to ask who edited it. Separating them
// fixes the impression regardless of how much data either side has.
//
// The guard's behaviour is unchanged — it reads this table exactly as before.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Globe2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { UserPicker } from "@/components/ui/user-picker";
import { readApiError } from "@/lib/client-errors";
import type { DisciplineOwnerRow } from "../../lib-assurance";
import type { PlantOption } from "@/lib/plant-context";

export function OwnershipOfRecord({
  owners, canConfig, plants,
}: {
  owners: DisciplineOwnerRow[];
  canConfig: boolean;
  plants: PlantOption[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Discipline ownership</h3>
            <p className="mt-1 max-w-prose text-xs text-slate-500">
              Who is accountable for each discipline. The own-work independence guard reads this:
              a person who owns Fire Safety at a site cannot be assigned to audit Fire Safety
              there, and every block it produces appears in the{" "}
              <a href="/cams/assurance" className="text-violet-800 hover:underline">
                Independence Register
              </a>
              . An owner marked <strong>estate-wide</strong> conflicts at every site.
            </p>
          </div>
          {canConfig && (
            <Button type="button" size="sm" onClick={() => setAdding(true)}>
              <Plus size={14} /> Add owner
            </Button>
          )}
        </div>
      </Card>

      {owners.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">No discipline ownership recorded yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
            Without ownership records the own-work guard can still block on declared auditees,
            checkpoint ownership and area ownership — but it cannot see discipline-level conflicts.
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden rounded-xl border border-slate-200 sm:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Discipline</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Scope</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  {canConfig && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {owners.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">
                        {o.disciplineLabel || o.disciplineCode}
                      </div>
                      <div className="text-[11px] text-slate-400">{o.disciplineCode}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{o.ownerName ?? o.ownerUserId}</td>
                    <td className="px-3 py-2">
                      <ScopeChip estateWide={o.estateWide} plantName={o.plantName} />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {o.ownershipType === "ACCOUNTABLE" ? "Accountable" : "Responsible"}
                    </td>
                    {canConfig && (
                      <td className="px-3 py-2 text-right">
                        <RemoveOwner id={o.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* 390px card list — no horizontal-scroll tables */}
          <div className="space-y-2 sm:hidden">
            {owners.map((o) => (
              <Card key={o.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {o.disciplineLabel || o.disciplineCode}
                    </div>
                    <div className="truncate text-xs text-slate-600">
                      {o.ownerName ?? o.ownerUserId}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <ScopeChip estateWide={o.estateWide} plantName={o.plantName} />
                      <span className="text-[10px] text-slate-500">
                        {o.ownershipType === "ACCOUNTABLE" ? "Accountable" : "Responsible"}
                      </span>
                    </div>
                  </div>
                  {canConfig && <RemoveOwner id={o.id} />}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {adding && <AddOwnerDialog onClose={() => setAdding(false)} plants={plants} />}
    </div>
  );
}

function ScopeChip({
  estateWide,
  plantName,
}: {
  estateWide: boolean;
  plantName: string | null | undefined;
}) {
  return estateWide ? (
    <span className="inline-flex items-center gap-1 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-800">
      <Globe2 size={10} /> Estate-wide
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-700">
      {/* Resolved by the backend. "Unknown site" beats a cuid when the plant
          row has gone — the reader can act on the former. */}
      <Building2 size={10} /> {plantName ?? "Unknown site"}
    </span>
  );
}

function RemoveOwner({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Remove this ownership record? The independence guard will stop reading it.")) return;
    setBusy(true);
    const res = await fetch(`/api/assurance/discipline-owners/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="text-slate-400 hover:text-rose-600 disabled:opacity-50"
      aria-label="Remove ownership record"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
    </button>
  );
}

function AddOwnerDialog({
  onClose,
  plants,
}: {
  onClose: () => void;
  plants: PlantOption[];
}) {
  const router = useRouter();
  const [disciplineCode, setDisciplineCode] = useState("");
  const [disciplineLabel, setDisciplineLabel] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [plantId, setPlantId] = useState("");
  const [ownershipType, setOwnershipType] = useState("ACCOUNTABLE");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/assurance/discipline-owners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        plantId: plantId || null,
        disciplineCode: disciplineCode.trim(),
        disciplineLabel: disciplineLabel.trim(),
        ownerUserId,
        ownershipType,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not save the ownership record"));
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-900">Add discipline ownership</h3>
        <p className="mt-1 text-xs text-slate-500">
          Recording ownership makes the own-work guard stronger. Leave the site blank for an
          estate-wide owner — they will conflict at every factory.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="disc-code" className="text-xs">
              Discipline code <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="disc-code"
              value={disciplineCode}
              onChange={(e) => setDisciplineCode(e.target.value)}
              placeholder="e.g. FIRE-LIFE-SAFETY"
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Must match the checkpoint library&rsquo;s category code — that is the value the
              guard joins on.
            </p>
          </div>
          <div>
            <Label htmlFor="disc-label" className="text-xs">Display name</Label>
            <Input
              id="disc-label"
              value={disciplineLabel}
              onChange={(e) => setDisciplineLabel(e.target.value)}
              placeholder="e.g. Fire Safety"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">
              Owner <span className="text-rose-600">*</span>
            </Label>
            <div className="mt-1">
              <UserPicker
                value={ownerUserId || null}
                onChange={(id) => setOwnerUserId(id ?? "")}
                placeholder="Select the accountable person…"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="plant" className="text-xs">Site (blank = estate-wide)</Label>
            {/* Was a free-text box asking the admin to paste a plant cuid — the
                one place on the platform that made a person handle an id. */}
            <Select
              id="plant"
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
              className="mt-1"
            >
              <option value="">Estate-wide — conflicts at every site</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="own-type" className="text-xs">Ownership type</Label>
            <Select
              id="own-type"
              value={ownershipType}
              onChange={(e) => setOwnershipType(e.target.value)}
              className="mt-1"
            >
              <option value="ACCOUNTABLE">Accountable — owns the outcome</option>
              <option value="RESPONSIBLE">Responsible — runs it day to day</option>
            </Select>
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {err}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={busy || !disciplineCode.trim() || !ownerUserId}
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Save
          </Button>
        </div>
      </div>
    </div>
  );
}
