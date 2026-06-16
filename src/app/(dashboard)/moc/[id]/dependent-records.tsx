"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { DEP_STATUS_CHIP } from "../_meta";

type Dep = {
  id: string;
  recordType: string;
  recordReference: string;
  impactType: string;
  impactDescription: string | null;
  updateStatus: string;
};

const DONE = new Set(["completed", "not_applicable_confirmed"]);

export function DependentRecords({ crId, deps }: { crId: string; deps: Dep[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const done = deps.filter((d) => DONE.has(d.updateStatus)).length;
  const pct = deps.length > 0 ? Math.round((done / deps.length) * 100) : 100;

  async function update(depId: string, updateStatus: string) {
    setBusy(depId);
    try {
      const res = await fetch(`/api/moc/change-requests/${crId}/dependent-records/${depId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updateStatus })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({ variant: "error", title: "Update failed", description: j.error });
        setBusy(null);
        return;
      }
      toast({ variant: "success", title: "Dependent record updated" });
      router.refresh();
      setBusy(null);
    } catch {
      toast({ variant: "error", title: "Network error" });
      setBusy(null);
    }
  }

  if (deps.length === 0) {
    return <p className="text-sm text-slate-500">No dependent records identified.</p>;
  }

  return (
    <>
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
          <span>
            {done} of {deps.length} updated
          </span>
          <span className={cn("font-semibold", pct === 100 ? "text-emerald-700" : "text-amber-700")}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={cn("h-full", pct === 100 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
        </div>
        {pct < 100 && (
          <div className="text-[11px] text-amber-700 mt-1">
            Closure is blocked until every must-update / must-review record is completed or confirmed N/A.
          </div>
        )}
      </div>
      <div className="divide-y">
        {deps.map((d) => {
          const settled = DONE.has(d.updateStatus);
          return (
            <div key={d.id} className="py-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-slate-900">{d.recordReference}</div>
                <div className="text-xs text-slate-500">
                  {d.recordType.replace(/_/g, " ")} · {d.impactType.replace(/_/g, " ")}
                  {d.impactDescription ? ` — ${d.impactDescription}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("rounded border px-2 py-0.5 text-xs", DEP_STATUS_CHIP[d.updateStatus] ?? "")}>
                  {d.updateStatus.replace(/_/g, " ")}
                </span>
                {!settled && (
                  <>
                    <Button size="sm" disabled={busy === d.id} onClick={() => update(d.id, "completed")}>
                      Mark updated
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === d.id}
                      onClick={() => update(d.id, "not_applicable_confirmed")}
                    >
                      N/A
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
