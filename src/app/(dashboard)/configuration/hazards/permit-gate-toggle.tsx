"use client";

// Library-level permit gate for one hazard. Flagging a hazard here is what
// makes the "Create PTW" prompt appear on that hazard's row inside a HIRA
// entry — the entry side reads this flag, it is not set per entry.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Check } from "lucide-react";

// Mirrors PermitType in the backend enum.
const PERMIT_TYPES = [
  "HOT_WORK",
  "CONFINED_SPACE",
  "WORK_AT_HEIGHT",
  "EXCAVATION",
  "ELECTRICAL_LOTO",
  "LIFTING",
  "GENERAL_COLD"
];

export function PermitGateToggle({
  hazardId,
  requiresPermit,
  permitTypes
}: {
  hazardId: string;
  requiresPermit: boolean;
  permitTypes: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [required, setRequired] = useState(requiresPermit);
  const [types, setTypes] = useState<string[]>(permitTypes ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function persist(nextRequired: boolean, nextTypes: string[]) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/hira/hazards/${hazardId}/permit-gate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requiresPermit: nextRequired,
          permitTypes: nextRequired ? nextTypes : null
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Save failed (${res.status})`);
        // Roll the optimistic state back so the toggle never shows a value
        // the database rejected.
        setRequired(requiresPermit);
        setTypes(permitTypes ?? []);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function toggleRequired(next: boolean) {
    setRequired(next);
    if (!next) setTypes([]);
    persist(next, next ? types : []);
  }

  function toggleType(t: string) {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    setTypes(next);
    persist(required, next);
  }

  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={required}
          disabled={pending}
          onChange={(e) => toggleRequired(e.target.checked)}
        />
        <ShieldAlert size={13} className={required ? "text-amber-600" : "text-slate-400"} />
        Requires a work permit
        {saved && !pending && <Check size={13} className="text-emerald-600" />}
      </label>

      {required && (
        <div className="mt-2">
          <div className="text-[10px] uppercase text-slate-500 mb-1">
            Permit type (blank = originator picks)
          </div>
          <div className="flex flex-wrap gap-1">
            {PERMIT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                disabled={pending}
                onClick={() => toggleType(t)}
                className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                  types.includes(t)
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-white text-slate-600 border-slate-300 hover:border-amber-300"
                }`}
              >
                {t.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="mt-1.5 text-[11px] text-rose-700">{error}</div>}
    </div>
  );
}
