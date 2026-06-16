"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type PlantFlags = {
  plantId: string;
  plantCode: string;
  plantName: string;
  eaiRegisterEnabled: boolean;
  combinedRegisterEnabled: boolean;
  riskDashboardEnabled: boolean;
  hiraAssistantV2Enabled: boolean;
};

type FlagKey = Exclude<keyof PlantFlags, "plantId" | "plantCode" | "plantName">;

const FLAGS: { key: FlagKey; label: string; hint: string }[] = [
  { key: "eaiRegisterEnabled", label: "EAI Register", hint: "Environmental Aspect & Impact register (ISO 14001 §6.1.2)" },
  { key: "combinedRegisterEnabled", label: "Combined Register", hint: "Unified HIRA + EAI risk register" },
  { key: "riskDashboardEnabled", label: "Risk Dashboard", hint: "Risk Aggregation Dashboard (Phase 3)" },
  { key: "hiraAssistantV2Enabled", label: "HIRA Assistant v2", hint: "Next-gen HIRA AI assistant" }
];

export function FeatureFlagsGrid({
  rows,
  highlightPlantId
}: {
  rows: PlantFlags[];
  highlightPlantId: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<PlantFlags[]>(rows);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(plantId: string, key: FlagKey, next: boolean) {
    setError(null);
    const cellId = `${plantId}:${key}`;
    setBusy(cellId);
    // Optimistic update.
    setState((prev) =>
      prev.map((r) => (r.plantId === plantId ? { ...r, [key]: next } : r))
    );

    startTransition(async () => {
      const res = await fetch(`/api/eai/feature-flag/${plantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next })
      });
      if (!res.ok) {
        // Roll back on failure.
        setState((prev) =>
          prev.map((r) => (r.plantId === plantId ? { ...r, [key]: !next } : r))
        );
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error ?? `Failed to update (${res.status})`
        );
      } else {
        router.refresh();
      }
      setBusy(null);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-700">
            <tr>
              <th className="text-left px-4 py-3">Plant</th>
              {FLAGS.map((f) => (
                <th key={f.key} className="text-center px-4 py-3" title={f.hint}>
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.map((row) => (
              <tr
                key={row.plantId}
                className={
                  row.plantId === highlightPlantId ? "bg-primary-50/40" : "hover:bg-slate-50"
                }
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{row.plantCode}</div>
                  <div className="text-xs text-slate-500">{row.plantName}</div>
                </td>
                {FLAGS.map((f) => {
                  const cellId = `${row.plantId}:${f.key}`;
                  return (
                    <td key={f.key} className="px-4 py-3 text-center">
                      <Toggle
                        checked={row[f.key]}
                        disabled={pending && busy === cellId}
                        onChange={(next) => toggle(row.plantId, f.key, next)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Flags apply per plant and take effect immediately. Enabling a module
        also unlocks its sidebar entry and routes for that plant.
      </p>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
