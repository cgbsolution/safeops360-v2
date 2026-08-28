"use client";

// The CAMS-side Compliance Snapshot.
//
// Read-only context for an auditor conducting a Fire Safety engagement: how much
// of the site's routine checklist programme has actually been completed, next to
// the engagement they are running.
//
// It fetches `/api/fire/compliance/engagement/{id}` — the SAME aggregation the
// Operations-side panel uses, addressed by the engagement so this component
// never has to map an engagement to a plant and cannot get that mapping subtly
// different from the other surface.
//
// SCOPE, DELIBERATELY
// -------------------
// This panel lives inside CAMS and is visible within CAMS's own permission
// scope. The endpoint behind it is gated on FIRE.READ and, since Build 2, on the
// FIRE licence — so a CAMS user at a tenant without the Fire licence sees
// nothing rather than numbers describing access their organisation does not
// have. That is the correct failure: the snapshot degrades to absent, not to a
// misleading zero.
//
// It renders NOTHING on failure rather than an error box. An auditor's
// engagement workspace must not sprout a red banner because a context panel
// could not load — the engagement itself is unaffected, and a panel that shouts
// about its own absence is worse than one that is quietly not there.

import { useEffect, useState } from "react";
import { CompletionPanel, CompliancePayload } from "./completion-panel";

export function ComplianceSnapshot({ engagementId }: { engagementId: string }) {
  const [data, setData] = useState<CompliancePayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fire/compliance/engagement/${encodeURIComponent(engagementId)}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as CompliancePayload;
        if (!cancelled) setData(json);
      } catch {
        // 403 (no FIRE licence / no grant) and 404 are both "this panel does not
        // apply here", not "something is broken".
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  if (failed || !data) return null;

  return (
    <CompletionPanel
      data={data}
      title="Compliance snapshot"
      subtitle="Routine checklist completion at this site"
      maxAssets={6}
      footer="Read-only context. Routine checklists are maintained in Operations — this panel does not change them."
    />
  );
}
