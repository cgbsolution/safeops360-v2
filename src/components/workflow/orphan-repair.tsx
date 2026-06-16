"use client";

// Self-heal client. When the detail page renders a workflow instance that
// has currentStepId set but no PENDING task (the symptom of past
// task-creation bugs), this component fires a one-shot POST to
// /api/workflow/repair-orphan and refreshes the page. Renders nothing.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function OrphanWorkflowRepair({
  module,
  recordId
}: {
  module: string;
  recordId: string;
}) {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    (async () => {
      try {
        const res = await fetch("/api/workflow/repair-orphan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module, recordId })
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.repaired) {
          router.refresh();
        }
      } catch {
        /* swallow — best-effort repair */
      }
    })();
  }, [module, recordId, router]);

  return null;
}
