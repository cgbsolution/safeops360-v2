"use client";

// Change 4 — "Trigger Audit" from a Facility's Compliance & Audit tab.
//
// Rather than fork a parallel half-working "initiate audit" path, this reuses
// the canonical CAMS ScheduleModal (which already POSTs to /api/audit-compliance,
// materializes checkpoints, toasts, and redirects to /cams/audits/:id). The
// facility's site IS the audit's plant, so we pre-scope plantId = profile.siteId
// and pre-fill a suggested title + a facility-named dialog header. The three
// scheduling datasets (discipline library, templates, plant users) are fetched
// client-side on click via the same endpoints the CAMS page uses.

import { useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { usePermission } from "@/components/auth/can";
import { useToast } from "@/components/ui/toast";
import { ScheduleModal } from "../../cams/audits/schedule-modal";
import type { AuditCategory, AuditLibrary, AuditTemplate, PlantUser } from "../../cams/audits/lib";
import type { FactoryProfileDetail } from "../lib";
import { Button } from "@/components/ui/button";

type SchedulerData = {
  templates: AuditTemplate[];
  libraries: AuditLibrary[];
  users: PlantUser[];
  auditCategories: AuditCategory[];
};

export function TriggerAuditButton({ profile }: { profile: FactoryProfileDetail }) {
  // Same gate as the audit register's Schedule Audit button — this launches
  // the identical modal, so the two must not disagree on who may raise one.
  const canCreate = usePermission("AUDIT_COMPLIANCE.SCHEDULE");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SchedulerData | null>(null);

  if (!canCreate) return null;

  async function open() {
    setLoading(true);
    try {
      const [libR, tplR, usrR] = await Promise.all([
        fetch("/api/audit-compliance/library").then((r) => r.json()),
        fetch("/api/audit-compliance/templates").then((r) => r.json()),
        fetch(`/api/audit-compliance/users?plantId=${encodeURIComponent(profile.siteId)}`).then((r) => r.json()),
      ]);
      setData({
        libraries: libR?.libraries ?? [],
        auditCategories: libR?.auditCategories ?? [],
        templates: tplR?.templates ?? [],
        users: usrR?.users ?? [],
      });
    } catch (e: any) {
      toast({ variant: "error", title: "Couldn't open audit scheduler", description: e?.message ?? "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  // Suggested, editable title — e.g. "Internal HSE & Social Compliance Audit — MAG-GJ-02 FY26".
  const fy = new Date().getFullYear() % 100;
  const suggestedTitle = `Internal HSE & Social Compliance Audit — ${profile.factoryCode} FY${fy}`;

  return (
    <>
      <Button variant="default"
        type="button"
        onClick={open}
        disabled={loading} className="shrink-0 gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white">
        {loading ? <Loader2 size={15} className="animate-spin" /> : <ClipboardList size={15} />} Trigger Audit
      </Button>
      {data && (
        <ScheduleModal
          plantId={profile.siteId}
          templates={data.templates}
          libraries={data.libraries}
          users={data.users}
          auditCategories={data.auditCategories}
          defaultTitle={suggestedTitle}
          dialogTitle={`Initiate Audit — ${profile.factoryName}`}
          onClose={() => setData(null)}
        />
      )}
    </>
  );
}
