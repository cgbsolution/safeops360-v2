"use client";

// Version diff display — renders field-by-field changes between two
// HiraVersion snapshots. Skips child arrays (hazards, controls, etc.)
// at the top level for legibility; child changes can be viewed by
// loading a single version (separate route, future).

const SKIP_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "updatedById",
  "hazards",
  "existingControls",
  "recommendedControls",
  "regulationRefs",
  "reviewCycles",
  "versions",
  "capas",
  "id",
  "studyId",
  "versionNumber",
  "isCurrentVersion",
  "parentVersionId"
]);

const FIELD_LABEL: Record<string, string> = {
  activityDescription: "Activity description",
  routine: "Routine type",
  frequency: "Frequency",
  typicalDurationMin: "Typical duration (min)",
  subLocation: "Sub-location",
  areaId: "Area",
  personsEmployees: "Persons — employees",
  personsContractors: "Persons — contractors",
  personsVisitors: "Persons — visitors",
  personsPublic: "Persons — public",
  equipmentUsed: "Equipment used",
  materialsUsed: "Materials used",
  energySourcesPresent: "Energy sources present",
  initialLikelihoodId: "Initial likelihood",
  initialLikelihoodScore: "Initial likelihood score",
  initialLikelihoodRationale: "Initial likelihood rationale",
  initialSeverityId: "Initial severity",
  initialSeverityScore: "Initial severity score",
  initialSeverityRationale: "Initial severity rationale",
  initialRiskScore: "Initial risk score",
  initialRiskLevel: "Initial risk level",
  initialRiskColor: "Initial risk color",
  residualLikelihoodId: "Residual likelihood",
  residualLikelihoodScore: "Residual likelihood score",
  residualLikelihoodRationale: "Residual likelihood rationale",
  residualSeverityId: "Residual severity",
  residualSeverityScore: "Residual severity score",
  residualSeverityRationale: "Residual severity rationale",
  residualRiskScore: "Residual risk score",
  residualRiskLevel: "Residual risk level",
  residualRiskColor: "Residual risk color",
  residualAcceptable: "Residual acceptable",
  residualAcceptanceRationale: "Residual acceptance rationale",
  triggersTrainingProgramIds: "Triggers training",
  triggersInspectionTypeIds: "Triggers inspection",
  influencesPtwRiskLevel: "Influences PTW risk",
  influencesPtwPermitTypes: "PTW permit types affected",
  linkedEmergencyProcIds: "Linked emergency procedures",
  linkedEnvironmentalAspects: "Linked environmental aspects",
  lastReviewedAt: "Last reviewed",
  lastReviewedById: "Last reviewed by",
  nextReviewDue: "Next review due",
  reviewCount: "Review count",
  lastReviewType: "Last review type",
  triggeredByRecordId: "Triggered by",
  status: "Status",
  groupLabel: "Group label",
  sequenceNumber: "Sequence",
  gpsLatitude: "GPS latitude",
  gpsLongitude: "GPS longitude"
};

export function VersionDiff({
  fromSnapshot,
  toSnapshot,
  fromLabel,
  toLabel
}: {
  fromSnapshot: Record<string, unknown>;
  toSnapshot: Record<string, unknown>;
  fromLabel: string;
  toLabel: string;
}) {
  const keys = new Set([...Object.keys(fromSnapshot), ...Object.keys(toSnapshot)]);
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  for (const k of keys) {
    if (SKIP_FIELDS.has(k)) continue;
    const f = fromSnapshot[k];
    const t = toSnapshot[k];
    if (JSON.stringify(f) !== JSON.stringify(t)) {
      changes.push({ field: k, from: f, to: t });
    }
  }

  return (
    <div className="rounded-xl border bg-white">
      <div className="px-4 py-3 border-b">
        <div className="text-xs uppercase tracking-wider text-slate-600">Field-by-field diff</div>
        <div className="text-sm font-medium mt-1">
          <span className="text-amber-700">{fromLabel}</span>
          <span className="mx-2 text-slate-400">→</span>
          <span className="text-emerald-700">{toLabel}</span>
        </div>
      </div>
      {changes.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">
          No top-level field differences between these versions. Children (hazards, controls, regulations) may still differ.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">Field</th>
              <th className="text-left px-4 py-2 bg-amber-50">Before ({fromLabel})</th>
              <th className="text-left px-4 py-2 bg-emerald-50">After ({toLabel})</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {changes.map((c) => (
              <tr key={c.field} className="align-top">
                <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">
                  {FIELD_LABEL[c.field] ?? c.field}
                </td>
                <td className="px-4 py-2 bg-amber-50/40">
                  <ValueDisplay v={c.from} />
                </td>
                <td className="px-4 py-2 bg-emerald-50/40">
                  <ValueDisplay v={c.to} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ValueDisplay({ v }: { v: unknown }) {
  if (v === null || v === undefined) {
    return <span className="text-slate-400 italic text-xs">empty</span>;
  }
  if (typeof v === "boolean") {
    return <span className="text-xs">{v ? "true" : "false"}</span>;
  }
  if (typeof v === "number") {
    return <span className="text-xs font-mono">{v}</span>;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-slate-400 italic text-xs">empty list</span>;
    return (
      <ul className="text-xs space-y-0.5">
        {v.map((x, i) => (
          <li key={i} className="font-mono">
            {typeof x === "string" ? x : JSON.stringify(x)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof v === "object") {
    return <pre className="text-[11px] whitespace-pre-wrap font-mono">{JSON.stringify(v, null, 2)}</pre>;
  }
  // Date string detection
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    try {
      return <span className="text-xs">{new Date(v).toLocaleString()}</span>;
    } catch {
      return <span className="text-xs">{v}</span>;
    }
  }
  return <span className="text-xs whitespace-pre-wrap">{String(v)}</span>;
}
