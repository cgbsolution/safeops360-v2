"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, ExternalLink } from "lucide-react";

type Pattern = {
  type: "candidate";
  plantId: string;
  primaryCategory: string;
  sourceTypeCode: string;
  capaCount: number;
  capaIds: string[];
  rationale: string;
};

export function PatternConfirmCard({ pattern }: { pattern: Pattern }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actioned, setActioned] = useState<"confirmed" | "dismissed" | null>(null);

  function act(action: "CONFIRM" | "DISMISS") {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/capa/patterns/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          plantId: pattern.plantId,
          primaryCategory: pattern.primaryCategory,
          sourceTypeCode: pattern.sourceTypeCode,
          capaIds: pattern.capaIds
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setActioned(action === "CONFIRM" ? "confirmed" : "dismissed");
      router.refresh();
    });
  }

  if (actioned) {
    return (
      <div
        className={`rounded-lg border px-3 py-2 text-xs ${
          actioned === "confirmed"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-slate-50 border-slate-200 text-slate-600"
        }`}
      >
        Pattern {actioned}.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-medium text-amber-900">
            {pattern.primaryCategory.replace(/_/g, " ")} · {pattern.sourceTypeCode.replace(/_/g, " ")}
          </div>
          <div className="text-slate-700 mt-1">{pattern.rationale}</div>
          <details className="mt-1">
            <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-700">
              {pattern.capaCount} CAPA IDs
            </summary>
            <ul className="mt-1 space-y-0.5 pl-2 border-l border-slate-200">
              {pattern.capaIds.slice(0, 10).map((id) => (
                <li key={id}>
                  <Link
                    href={`/capa/${id}`}
                    className="text-primary-700 hover:underline inline-flex items-center gap-1"
                  >
                    {id.slice(0, 12)}…
                    <ExternalLink size={9} />
                  </Link>
                </li>
              ))}
              {pattern.capaIds.length > 10 && (
                <li className="text-slate-400">… and {pattern.capaIds.length - 10} more</li>
              )}
            </ul>
          </details>
        </div>
      </div>
      {error && <div className="text-rose-700 mt-1.5">{error}</div>}
      <div className="flex gap-1.5 mt-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => act("CONFIRM")}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check size={11} /> Confirm pattern
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("DISMISS")}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          <X size={11} /> Dismiss
        </button>
      </div>
    </div>
  );
}
