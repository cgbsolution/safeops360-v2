"use client";

/**
 * Observation SLA matrix editor — severity × category group, edited as a
 * table (spec §1.1: "Table edit, not raw JSON").
 *
 * Behavioural vs Physical is derived from the observation's act/condition
 * axis, not from its STOP category — an Unsafe *Act* is behavioural, an Unsafe
 * *Condition* is physical, and the same STOP category (PPE, say) produces both.
 * The column headers say so, because an admin setting 2 vs 30 days needs to
 * know which records land in which column.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { readApiError } from "@/lib/client-errors";
import { AlertCircle, CheckCircle2, Info, Loader2, Save } from "lucide-react";

export type SlaRow = {
  id: string;
  plantId: string | null;
  severity: string;
  categoryGroup: string;
  slaDays: number;
  isActive: boolean;
  inherited: boolean;
};

export type CategoryGroupRow = {
  id: string;
  categoryCode: string;
  categoryLabel: string;
  stopReferenceCode: string;
  axis: string;
  categoryGroup: "BEHAVIORAL" | "PHYSICAL" | "PENDING_DECISION";
  pending: boolean;
  notes: string | null;
};

export type SlaConfig = {
  plantId: string | null;
  rows: SlaRow[];
  deroster: {
    reviewSlaHours: number;
    escalationContactUserId: string | null;
    escalationRoleCode: string;
    inherited: boolean;
  };
};

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const GROUPS = [
  {
    code: "BEHAVIORAL",
    label: "Behavioural",
    hint: "Person-driven deviations — corrected by coaching"
  },
  {
    code: "PHYSICAL",
    label: "Physical",
    hint: "Workplace / equipment deviations — corrected by engineering or supply"
  }
];

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-rose-50 text-rose-800 border-rose-200",
  HIGH: "bg-orange-50 text-orange-800 border-orange-200",
  MEDIUM: "bg-amber-50 text-amber-800 border-amber-200",
  LOW: "bg-slate-50 text-slate-700 border-slate-200"
};

function keyOf(severity: string, group: string) {
  return `${severity}|${group}`;
}

export function SlaMatrixEditor({
  initial,
  categoryGroups,
  plants,
  plantId
}: {
  initial: SlaConfig;
  categoryGroups: CategoryGroupRow[];
  plants: { id: string; name: string; code: string }[];
  plantId: string;
}) {
  const router = useRouter();
  const [groups, setGroups] = React.useState(categoryGroups);
  const [savingGroups, setSavingGroups] = React.useState(false);
  const [groupError, setGroupError] = React.useState("");
  const pendingCount = groups.filter((g) => g.categoryGroup === "PENDING_DECISION").length;

  async function onSaveGroups() {
    setGroupError("");
    setSavingGroups(true);
    try {
      const res = await fetch("/api/observations/sla-config/category-groups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: groups.map((g) => ({
            categoryCode: g.categoryCode,
            categoryGroup: g.categoryGroup,
            axis: g.axis,
            notes: g.notes
          }))
        })
      });
      if (!res.ok) {
        setGroupError(await readApiError(res, "Could not save the category mapping."));
        return;
      }
      setGroups(await res.json());
      router.refresh();
    } catch {
      setGroupError("Network error — nothing was saved.");
    } finally {
      setSavingGroups(false);
    }
  }

  const [days, setDays] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(initial.rows.map((r) => [keyOf(r.severity, r.categoryGroup), r.slaDays]))
  );
  const [active, setActive] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(initial.rows.map((r) => [keyOf(r.severity, r.categoryGroup), r.isActive]))
  );
  const [reviewHours, setReviewHours] = React.useState(initial.deroster.reviewSlaHours);
  const [escalationRole, setEscalationRole] = React.useState(initial.deroster.escalationRoleCode);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  const inheritedKeys = new Set(
    initial.rows.filter((r) => r.inherited).map((r) => keyOf(r.severity, r.categoryGroup))
  );

  async function onSave() {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const rows = SEVERITIES.flatMap((sev) =>
        GROUPS.map((g) => ({
          severity: sev,
          categoryGroup: g.code,
          slaDays: days[keyOf(sev, g.code)] ?? 30,
          isActive: active[keyOf(sev, g.code)] ?? true
        }))
      );
      const res = await fetch(
        `/api/observations/sla-config${plantId ? `?plantId=${encodeURIComponent(plantId)}` : ""}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows,
            reviewSlaHours: reviewHours,
            escalationRoleCode: escalationRole
          })
        }
      );
      if (!res.ok) {
        setError(await readApiError(res, "Could not save the SLA matrix."));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error — nothing was saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <Label htmlFor="scope">Scope</Label>
          <Select
            id="scope"
            className="mt-1 max-w-md"
            value={plantId}
            onChange={(e) => {
              const v = e.target.value;
              router.push(
                `/configuration/observation-sla${v ? `?plantId=${encodeURIComponent(v)}` : ""}`
              );
            }}
          >
            <option value="">Global default (applies to every plant)</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code}) — plant override
              </option>
            ))}
          </Select>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {plantId
              ? "Values shown in grey are inherited from the global default. Saving writes a plant-specific override for every cell."
              : "These values apply wherever a plant has no override of its own."}
          </p>
        </CardContent>
      </Card>

      {/* Upstream of the day-count matrix: this decides WHICH column an
          observation lands in. Global, not plant-scoped — it classifies the
          taxonomy itself, while the day counts are what a plant overrides. */}
      <Card className={pendingCount > 0 ? "border-amber-300" : undefined}>
        <CardContent className="p-4">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              STOP category → Behavioural / Physical
            </h2>
            {pendingCount > 0 && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {pendingCount} awaiting decision
              </span>
            )}
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Which SLA column each DuPont STOP category falls into. Applies to every plant.
            Categories left as <strong>Awaiting decision</strong> resolve no SLA at all — the
            reporter sets the closure date manually and is told why, rather than the system
            guessing a band.
          </p>

          {groups.length === 0 ? (
            <p className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              No mapping configured. Run{" "}
              <code className="font-mono">npm run db:seed-observation-category-groups</code> to
              seed the DuPont defaults. Until then every observation falls back to the
              act/condition axis.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2 pr-4 font-medium text-slate-600">STOP</th>
                    <th className="py-2 pr-4 font-medium text-slate-600">Category</th>
                    <th className="py-2 pr-4 font-medium text-slate-600">SLA group</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, i) => (
                    <tr key={g.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-slate-500">
                        {g.stopReferenceCode || "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-slate-800">{g.categoryLabel}</span>
                        {g.notes && (
                          <span className="block max-w-md text-[11px] text-slate-400">
                            {g.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <Select
                          value={g.categoryGroup}
                          onChange={(e) =>
                            setGroups((prev) =>
                              prev.map((r, j) =>
                                j === i
                                  ? { ...r, categoryGroup: e.target.value as CategoryGroupRow["categoryGroup"] }
                                  : r
                              )
                            )
                          }
                          className={`w-52 ${
                            g.categoryGroup === "PENDING_DECISION"
                              ? "border-amber-300 bg-amber-50 text-amber-900"
                              : ""
                          }`}
                        >
                          <option value="BEHAVIORAL">Behavioural</option>
                          <option value="PHYSICAL">Physical</option>
                          <option value="PENDING_DECISION">Awaiting decision — no SLA</option>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {groupError && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {groupError}
            </p>
          )}

          {groups.length > 0 && (
            <Button
              onClick={onSaveGroups}
              disabled={savingGroups}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              {savingGroups ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save category mapping
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Target closure days</h2>
          <p className="mb-3 text-xs text-slate-500">
            Calendar days from the observation date. Which column an observation lands in comes
            from the STOP category mapping above; observations with no STOP category (Safe Act /
            Safe Condition) fall back to the act/condition axis.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2 pr-4 font-medium text-slate-600">Severity</th>
                  {GROUPS.map((g) => (
                    <th key={g.code} className="py-2 pr-4 font-medium text-slate-600">
                      {g.label}
                      <span className="block text-xs font-normal text-slate-400">{g.hint}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SEVERITIES.map((sev) => (
                  <tr key={sev} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[sev]}`}
                      >
                        {sev.charAt(0) + sev.slice(1).toLowerCase()}
                      </span>
                    </td>
                    {GROUPS.map((g) => {
                      const k = keyOf(sev, g.code);
                      return (
                        <td key={g.code} className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={365}
                              value={days[k] ?? ""}
                              onChange={(e) =>
                                setDays((prev) => ({ ...prev, [k]: Number(e.target.value) }))
                              }
                              className={`w-20 ${inheritedKeys.has(k) ? "text-slate-500" : ""}`}
                            />
                            <span className="text-xs text-slate-500">days</span>
                            <label className="flex items-center gap-1 text-xs text-slate-500">
                              <input
                                type="checkbox"
                                checked={active[k] ?? true}
                                onChange={(e) =>
                                  setActive((prev) => ({ ...prev, [k]: e.target.checked }))
                                }
                              />
                              active
                            </label>
                          </div>
                          {inheritedKeys.has(k) && (
                            <span className="text-[11px] text-slate-400">inherited</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Deactivating a row does not block reporting — observations in that band fall back to a
            manually-entered closure date with a &ldquo;no SLA policy configured&rdquo; notice.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Deroster review</h2>
          <p className="mb-3 text-xs text-slate-500">
            A High or Critical severity Unsafe Act with a named worker starts a safety review. If
            nobody decides within this window the review is escalated — it is never auto-decided.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="reviewHours">Review SLA (hours)</Label>
              <Input
                id="reviewHours"
                type="number"
                min={1}
                max={720}
                value={reviewHours}
                onChange={(e) => setReviewHours(Number(e.target.value))}
                className="mt-1 w-28"
              />
            </div>
            <div>
              <Label htmlFor="escalationRole">Escalation contact role</Label>
              <Input
                id="escalationRole"
                value={escalationRole}
                onChange={(e) => setEscalationRole(e.target.value)}
                className="mt-1"
                placeholder="HSE_MANAGER"
              />
              <p className="mt-1 text-xs text-slate-500">
                Holders of this role are notified on timeout.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Saved. Applies to observations submitted from now on; existing records are unchanged.
        </div>
      )}

      <Button onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
        Save SLA matrix
      </Button>
    </div>
  );
}
