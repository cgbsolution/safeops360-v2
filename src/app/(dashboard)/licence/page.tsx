"use client";

// Licence Management screen (build prompt §8.1). Admin-facing: status,
// entitlements (modules + limits with usage vs cap + feature flags),
// installation identity (for binding), upload/renew, and diagnostics.
// Entitlements are READ-ONLY — they come only from the signed licence.

import { useMemo } from "react";
import {
  BadgeCheck,
  Boxes,
  Fingerprint,
  Gauge,
  Stethoscope,
  UploadCloud,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLicence } from "@/components/licensing/licence-provider";
import { LicenceUpload } from "@/components/licensing/licence-upload";
import { FactoryModuleMatrix } from "@/components/licensing/factory-module-matrix";

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EXPIRING_SOON: "bg-amber-100 text-amber-800 border-amber-200",
  GRACE: "bg-orange-100 text-orange-800 border-orange-200",
  EXPIRED_LOCKED: "bg-rose-100 text-rose-800 border-rose-200",
  INVALID: "bg-rose-100 text-rose-800 border-rose-200",
  MISSING: "bg-slate-100 text-slate-700 border-slate-200",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[status] ?? STATUS_TONE.MISSING}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value ?? "—"}</div>
    </div>
  );
}

export default function LicencePage() {
  const { view, loading, refresh } = useLicence();

  const grouped = useMemo(() => {
    const g: Record<string, { code: string; name: string }[]> = {};
    for (const m of view?.enabledModules ?? []) {
      (g[m.group] ??= []).push({ code: m.code, name: m.name });
    }
    return g;
  }, [view]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Licence Management" description="Edition, entitlements & status" />
        <div className="text-sm text-slate-500">Loading licence status…</div>
      </div>
    );
  }

  if (!view) {
    return (
      <div>
        <PageHeader title="Licence Management" description="Edition, entitlements & status" />
        <Card><CardContent className="py-6 text-sm text-slate-600">
          Could not load licence status. The API may be unreachable — module access is still
          enforced server-side.
        </CardContent></Card>
      </div>
    );
  }

  const dateFmt = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "—");
  const usage = view.usage;
  const limits = view.limits;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Licence Management"
        description="Edition, entitlements & status — read-only; entitlements come only from the signed licence"
        action={<StatusChip status={view.status} />}
      />

      {/* ── Status ── */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <BadgeCheck className="text-primary-700" size={18} />
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Customer" value={view.customerName} />
          <Field label="Edition" value={view.editionName ?? view.edition} />
          <Field label="Type" value={view.licenceType} />
          <Field label="Deployment" value={view.deploymentMode} />
          <Field label="Valid from" value={dateFmt(view.validFrom)} />
          <Field label="Valid until" value={dateFmt(view.validUntil)} />
          <Field
            label="Days remaining"
            value={
              typeof view.daysToExpiry === "number" ? (
                <span className={view.daysToExpiry <= (view.warnDaysWindow ?? 14) ? "text-amber-700" : ""}>
                  {view.daysToExpiry}
                </span>
              ) : "—"
            }
          />
          <Field label="Grace period" value={view.gracePeriodDays != null ? `${view.gracePeriodDays} day(s)` : "—"} />
        </CardContent>
      </Card>

      {/* ── Entitlements ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2">
            <Boxes className="text-primary-700" size={18} />
            <CardTitle>Enabled modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(grouped).length === 0 && (
              <div className="text-sm text-slate-500">No product modules enabled.</div>
            )}
            {Object.entries(grouped).map(([group, mods]) => (
              <div key={group}>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{group}</div>
                <div className="flex flex-wrap gap-2">
                  {mods.map((m) => (
                    <span key={m.code} className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700" title={m.code}>
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Gauge className="text-primary-700" size={18} />
            <CardTitle>Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <LimitRow label="Sites" cap={limits.maxSites} current={usage?.sites} />
            <LimitRow label="Users" cap={limits.maxUsers} current={usage?.users} />
            <LimitRow label="Factories" cap={limits.maxFactories} current={usage?.factories} />
            {Object.keys(view.featureFlags ?? {}).length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Feature flags</div>
                {Object.entries(view.featureFlags).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs text-slate-600">
                    <span>{k}</span>
                    <span className={v ? "text-emerald-700" : "text-slate-400"}>{v ? "on" : "off"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Installation + diagnostics (admin) ── */}
      {view.isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Fingerprint className="text-primary-700" size={18} />
              <CardTitle>Installation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Installation ID (give to ops for binding)" value={
                <span className="font-mono text-xs break-all">{view.installationId ?? "—"}</span>
              } />
              {view.bindingWarning && (
                <div className="text-xs text-amber-700">⚠ This licence is bound to a different installation (soft mode — still operational).</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Stethoscope className="text-primary-700" size={18} />
              <CardTitle>Diagnostics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label="Last validated" value={view.lastValidatedAt ? new Date(view.lastValidatedAt).toLocaleString() : "—"} />
              {view.clockTamperWarning && (
                <div className="text-xs text-rose-700">⚠ Clock rollback detected — validity enforced against last-seen time.</div>
              )}
              {view.validationError && (
                <pre className="text-[11px] bg-slate-100 rounded p-2 text-slate-600 whitespace-pre-wrap">{view.validationError}</pre>
              )}
              {!view.validationError && !view.clockTamperWarning && (
                <div className="text-xs text-emerald-700">No issues detected.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Per-factory module access (admin) ── */}
      {view.isAdmin && <FactoryModuleMatrix onSaved={refresh} />}

      {/* ── Upload / renew (admin) ── */}
      {view.isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <UploadCloud className="text-primary-700" size={18} />
            <CardTitle>Upload / renew licence</CardTitle>
          </CardHeader>
          <CardContent>
            <LicenceUpload onApplied={refresh} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LimitRow({ label, cap, current }: { label: string; cap: number | null; current?: number }) {
  const pct = cap && current != null ? Math.min(100, Math.round((current / cap) * 100)) : 0;
  const near = cap != null && current != null && current >= cap;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className={`font-medium ${near ? "text-rose-700" : "text-slate-800"}`}>
          {current ?? "—"}{cap != null ? ` / ${cap}` : " / ∞"}
        </span>
      </div>
      {cap != null && (
        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
          <div className={`h-1.5 rounded-full ${near ? "bg-rose-500" : "bg-primary-600"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
