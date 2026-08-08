// Fire asset detail — the drill-in the register never had.
//
// The register's code column was styled like a link but rendered as plain text,
// because there was no route behind it. This is that route: identity, the
// resolved inspection cadence and WHY it is that cadence, inspection history
// (CAMS engagements, sourceModule='FIRE'), open defects, and the QR payload.
//
// Server component: every panel is read-first. The only interactive piece is the
// inspection trigger, which is its own client island.

import Link from "next/link";
import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { TriggerInspectionButton } from "./trigger-inspection";

export const dynamic = "force-dynamic";

type Inspection = {
  id: string;
  engagementCode: string;
  title: string;
  status: string;
  plannedDate: string | null;
  scorePercent: number | null;
};

type Equipment = {
  id: string;
  equipmentCode: string;
  type: string;
  assetSubtype: string | null;
  location: string;
  plantId: string;
  zoneId: string | null;
  status: string;
  statusOverride: string | null;
  statusOverrideReason: string | null;
  make: string | null;
  model: string | null;
  serialNo: string | null;
  capacitySpec: string | null;
  qrCode: string | null;
  maintenanceContractor: string | null;
  amcContractId: string | null;
  lastInspectionDate: string | null;
  nextInspectionDueDate: string | null;
  inspectionFrequencyDays: number;
  frequencyOverrideReason: string | null;
  outOfServiceReason: string | null;
  inspectionHistory: Inspection[];
};

type Frequency = {
  days: number;
  frequency: string;
  source: string;
  regulatoryReference: string | null;
  resolved: boolean;
  overrideReason: string | null;
};

type Defect = {
  id: string;
  findingCode: string;
  title: string;
  severity: string;
  status: string;
  capaId: string | null;
  requiresCapa: boolean;
  dueDate: string | null;
};

const TILE = "rounded-xl border border-slate-200 bg-white p-4";

const STATUS_CHIP: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DUE_INSPECTION: "bg-amber-100 text-amber-800 border-amber-200",
  OVERDUE: "bg-rose-100 text-rose-800 border-rose-200",
  NON_COMPLIANT: "bg-rose-200 text-rose-900 border-rose-300",
  OUT_OF_SERVICE: "bg-slate-200 text-slate-700 border-slate-300",
  DECOMMISSIONED: "bg-slate-100 text-slate-500 border-slate-200",
};

const SEVERITY_CHIP: Record<string, string> = {
  CRITICAL_NC: "bg-rose-200 text-rose-900 border-rose-300",
  MAJOR_NC: "bg-amber-100 text-amber-800 border-amber-200",
  MINOR_NC: "bg-slate-100 text-slate-700 border-slate-200",
  OBSERVATION: "bg-slate-50 text-slate-500 border-slate-200",
};

// How the cadence was arrived at, in words. A due date whose origin nobody can
// explain is the thing an auditor pulls on.
const SOURCE_LABEL: Record<string, string> = {
  PLANT_SUBTYPE: "Site rule for this subtype",
  PLANT_TYPE: "Site rule for this asset type",
  REGION_SUBTYPE: "Regional rule for this subtype",
  REGION_TYPE: "Regional default for this asset type",
  ASSET_OVERRIDE: "Per-asset override",
  FALLBACK: "No rule configured — platform fallback",
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-IN") : "—";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-right text-xs font-medium text-slate-800">{value || "—"}</span>
    </div>
  );
}

export default async function FireEquipmentDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let eq: Equipment | null = null;
  let error: string | null = null;
  try {
    eq = await backendFetch<Equipment>(`/api/fire/equipment/${id}`);
  } catch (e: any) {
    if (e?.status === 404) notFound();
    error = e?.message ?? "Failed to load asset";
  }

  // Cadence provenance and defects are supplementary — a failure on either must
  // not blank the whole asset page, so each degrades to null independently.
  const [freq, defects] = await Promise.all([
    eq
      ? backendFetch<Frequency>(`/api/fire/equipment/${id}/frequency`).catch(() => null)
      : Promise.resolve(null),
    eq
      ? backendFetch<{ items: Defect[] }>(`/api/fire/defects`, { query: { assetId: id } })
          .then((d) => d.items)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  if (error || !eq) {
    return (
      <div>
        <PageHeader
          title="Fire Asset"
          breadcrumbs={[
            { label: "Operational Safety" },
            { label: "Fire Safety", href: "/fire-safety" },
            { label: "Equipment", href: "/fire-safety/equipment" },
          ]}
        />
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      </div>
    );
  }

  const openDefects = (defects ?? []).filter((d) => d.status === "OPEN" || d.status === "IN_PROGRESS");

  return (
    <div>
      <PageHeader
        title={`${eq.equipmentCode} — ${eq.type.replace(/_/g, " ")}`}
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Fire Safety", href: "/fire-safety" },
          { label: "Equipment", href: "/fire-safety/equipment" },
          { label: eq.equipmentCode },
        ]}
        description={eq.location}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className={
            "inline-block rounded border px-2 py-0.5 text-[11px] font-medium " +
            (STATUS_CHIP[eq.status] ?? "border-slate-200 bg-slate-100 text-slate-600")
          }
        >
          {eq.status.replace(/_/g, " ")}
        </span>
        {eq.statusOverride && (
          <span className="text-[11px] text-slate-500">
            Manually set — {eq.statusOverrideReason ?? "no reason recorded"}
          </span>
        )}
        <div className="ml-auto">
          <TriggerInspectionButton equipmentId={eq.id} code={eq.equipmentCode} />
        </div>
      </div>

      {/* An open CRITICAL defect is the single most important fact about an
          asset, so it sits above the fold rather than in the defects panel. */}
      {openDefects.some((d) => d.severity === "CRITICAL_NC") && (
        <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-4">
          <div className="text-sm font-semibold text-rose-900">Open CRITICAL defect</div>
          <div className="mt-0.5 text-xs text-rose-800">
            This asset is NON_COMPLIANT until the defect is closed with a verification inspection.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={TILE}>
          <div className="mb-2 text-sm font-semibold text-slate-800">Identity</div>
          <Row label="Code" value={eq.equipmentCode} />
          <Row label="Type" value={eq.type.replace(/_/g, " ")} />
          <Row label="Subtype" value={eq.assetSubtype} />
          <Row label="Make / model" value={[eq.make, eq.model].filter(Boolean).join(" ")} />
          <Row label="Serial no." value={eq.serialNo} />
          <Row label="Capacity / spec" value={eq.capacitySpec} />
          <Row label="Location" value={eq.location} />
          <Row
            label="Zone"
            value={
              eq.zoneId ? (
                <Link className="text-primary-700 hover:underline" href={`/fire-safety/zones`}>
                  {eq.zoneId.slice(0, 8)}…
                </Link>
              ) : (
                <span className="text-amber-600">Unzoned</span>
              )
            }
          />
        </div>

        <div className={TILE}>
          <div className="mb-2 text-sm font-semibold text-slate-800">Inspection cadence</div>
          <Row label="Last inspected" value={fmt(eq.lastInspectionDate)} />
          <Row label="Next due" value={fmt(eq.nextInspectionDueDate)} />
          {freq ? (
            <>
              <Row label="Frequency" value={`${freq.frequency.replace(/_/g, " ")} (${freq.days} days)`} />
              <Row label="Rule applied" value={SOURCE_LABEL[freq.source] ?? freq.source} />
              <Row label="Regulatory basis" value={freq.regulatoryReference} />
              {!freq.resolved && (
                <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                  No frequency rule covers this asset type. It is on the platform fallback and reads
                  as compliant on every dashboard — configure a rule in the Inspection Frequency
                  Master.
                </p>
              )}
              {freq.overrideReason && (
                <p className="mt-2 text-[11px] text-slate-500">Override: {freq.overrideReason}</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">Cadence provenance unavailable.</p>
          )}
        </div>

        <div className={TILE}>
          <div className="mb-2 text-sm font-semibold text-slate-800">Service & tagging</div>
          <Row label="Contractor" value={eq.maintenanceContractor} />
          <Row
            label="AMC contract"
            value={
              eq.amcContractId ? (
                <Link className="text-primary-700 hover:underline" href="/fire-safety/amc">
                  Linked
                </Link>
              ) : (
                <span className="text-slate-400">No contract</span>
              )
            }
          />
          <Row label="QR payload" value={<code className="text-[10px]">{eq.qrCode}</code>} />
          {eq.outOfServiceReason && <Row label="Out-of-service reason" value={eq.outOfServiceReason} />}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={TILE}>
          <div className="mb-2 text-sm font-semibold text-slate-800">
            Inspection history{" "}
            <span className="font-normal text-slate-400">
              — CAMS engagements, one engine
            </span>
          </div>
          {!eq.inspectionHistory?.length ? (
            <p className="py-6 text-center text-xs text-slate-400">
              Never inspected. Trigger the first inspection above.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1.5">Engagement</th>
                  <th className="py-1.5">Planned</th>
                  <th className="py-1.5">Status</th>
                  <th className="py-1.5 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {eq.inspectionHistory.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="py-1.5">
                      <Link href={`/cams/engagements/${i.id}`} className="text-primary-700 hover:underline">
                        {i.engagementCode}
                      </Link>
                    </td>
                    <td className="py-1.5 text-slate-500">{fmt(i.plannedDate)}</td>
                    <td className="py-1.5 text-slate-600">{i.status}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-600">
                      {i.scorePercent != null ? `${i.scorePercent}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={TILE}>
          <div className="mb-2 text-sm font-semibold text-slate-800">Defects</div>
          {defects === null ? (
            <p className="py-6 text-center text-xs text-slate-400">Defect list unavailable.</p>
          ) : !defects.length ? (
            <p className="py-6 text-center text-xs text-slate-400">No defects raised against this asset.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1.5">Code</th>
                  <th className="py-1.5">Title</th>
                  <th className="py-1.5">Severity</th>
                  <th className="py-1.5">Status</th>
                  <th className="py-1.5">CAPA</th>
                </tr>
              </thead>
              <tbody>
                {defects.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="py-1.5 font-medium text-slate-700">{d.findingCode}</td>
                    <td className="py-1.5 text-slate-600">{d.title}</td>
                    <td className="py-1.5">
                      <span
                        className={
                          "rounded border px-1.5 py-0.5 text-[10px] " +
                          (SEVERITY_CHIP[d.severity] ?? "border-slate-200 bg-slate-100 text-slate-600")
                        }
                      >
                        {d.severity.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-1.5 text-slate-600">{d.status}</td>
                    <td className="py-1.5">
                      {d.capaId ? (
                        <Link href={`/capa/${d.capaId}`} className="text-primary-700 hover:underline">
                          Linked
                        </Link>
                      ) : d.requiresCapa ? (
                        // Should be unreachable — the deferred DB constraint
                        // refuses this state. Rendered loudly rather than blank
                        // so that if it ever appears, it is not mistaken for
                        // "CAPA not needed".
                        <span className="font-semibold text-rose-700">MISSING</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
