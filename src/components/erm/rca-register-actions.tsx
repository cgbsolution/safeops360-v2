"use client";

// Interactive cells for the RCA Register (server component) — a small
// linked-risks popover that lists each risk a given RCA links to, each row
// deep-linking into the risk register. Kept in a client component so the
// register page can stay a server component.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GitBranch } from "lucide-react";
import type { LinkedRiskRef } from "@/app/(dashboard)/erm/rca/lib";

export function LinkedRisksCell({ risks }: { risks?: LinkedRiskRef[] | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!risks || risks.length === 0) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors " +
          (open
            ? "border-indigo-300 bg-indigo-100 text-indigo-800"
            : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-400")
        }
        title="Linked risks"
      >
        <GitBranch size={11} />
        {risks.length} risk{risks.length === 1 ? "" : "s"}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Linked risks
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {risks.map((r) => (
              <li key={r.riskId}>
                <Link
                  href={`/erm/register/${r.riskId}`}
                  className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
                >
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">
                    {r.riskCode ?? "—"}
                  </span>
                  <span className="truncate text-xs text-slate-600" title={r.riskTitle ?? undefined}>
                    {r.riskTitle ?? ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
