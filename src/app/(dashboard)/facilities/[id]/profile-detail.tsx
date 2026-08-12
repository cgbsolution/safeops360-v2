"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ClipboardCheck, MapPin, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { Can, usePermission } from "@/components/auth/can";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EvidenceAttachment } from "@/components/evidence/EvidenceAttachment";
import { TriggerAuditButton } from "./trigger-audit-button";
import { FloorMapping } from "./floor-mapping";
import { ProfileEditPanel } from "./profile-edit-panel";
import {
  BUILDING_TYPES,
  BUILDING_TYPE_LABEL,
  CERT_MANUAL_STATUSES,
  CERT_STATUS_CHIP,
  CERT_TYPE_LABEL,
  CERTIFICATION_TYPES,
  COMPLIANCE_FLAGS,
  CONTACT_ROLE_LABEL,
  CONTACT_ROLES,
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_CHIP,
  EQUIPMENT_COMPLIANCE_LABEL,
  HAZARD_LEVELS,
  HAZARD_LEVEL_CHIP,
  RAG_CHIP,
  HAZMAT_CLASSES,
  HAZMAT_CLASS_CHIP,
  SHELF_LIFE_CHIP,
  TRAINING_STATUS_CHIP,
  GHS_SIGNAL_CHIP,
  GHS_SIGNAL_WORDS,
  PCB_STATUSES,
  REGISTRATION_TYPES,
  REGISTRATION_TYPE_LABEL,
  RENEWAL_FREQUENCIES,
  RENEWAL_FREQUENCY_LABEL,
  REG_STATUS_CHIP,
  COMPLIANCE_IMPACTS,
  IMPACT_CHIP,
  LIFECYCLE_STAGES,
  LIFECYCLE_STAGE_LABEL,
  LIFECYCLE_STAGE_OWNER,
  LIFECYCLE_STAGE_CHIP,
  LIFECYCLE_ACTION_LABEL,
  fmtDate,
  fmtNum,
  OWNERSHIP_LABEL,
  pct,
  PROFILE_STATUS_CHIP,
  SOCIAL_FLAG_CHIP,
  SOCIAL_FLAG_LABEL,
  STATUS_CHIP,
  titleCase,
  UNITS,
  withUnit,
  type Building,
  type BuildingType,
  type CertificationType,
  type CertStatus,
  type ComplianceFlag,
  type ComplianceTab as ComplianceTabData,
  type ContactRole,
  type FactoryCertification,
  type FactoryContact,
  type FactoryProfileDetail,
  type FacilityMetricBlock,
  type FacilityTile,
  type FacilityRollupRow,
  type KpiDelta,
  type ModuleDeepLink,
  type ProductionProcess,
  type SnapshotMetrics,
  type SocialComplianceProfile,
} from "../lib";

const TABS = [
  "Overview",
  "Buildings",
  "Workforce",
  "Production Processes",
  "Equipment",
  "Hazmat",
  "Certifications",
  // Named for what it holds — the factory's statutory licences, certificates
  // and consents — rather than the abstract "Regulatory".
  "Factory Licences",
  "Contacts",
  "Compliance & Audit",
  "Audit Trail",
] as const;
type Tab = (typeof TABS)[number];

// Shared mutation helper: throws a useful message on any non-2xx so callers
// can surface it instead of silently calling router.refresh() on failure.
async function mutate(url: string, init?: RequestInit): Promise<void> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.detail ?? j?.error ?? msg;
    } catch {
      /* non-JSON body */
    }
    throw new Error(msg);
  }
}

function ErrorNote({ err }: { err: string | null }) {
  if (!err) return null;
  return <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

export function ProfileDetail({ profile, initialTab }: { profile: FactoryProfileDetail; initialTab?: string }) {
  // Deep-link support: ?tab=Workforce (case-insensitive) opens that tab — used by
  // the group Workforce & Social-Compliance register's row links (W-01 §3).
  const startTab = (TABS.find((t) => t.toLowerCase() === (initialTab ?? "").toLowerCase()) ?? "Overview") as Tab;
  const [tab, setTab] = useState<Tab>(startTab);

  return (
    <div>
      {/* Header band */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <span className={"rounded border px-2 py-0.5 text-[11px] font-medium " + (STATUS_CHIP[profile.status] ?? "")}>
          {titleCase(profile.status)}
        </span>
        <span className={"rounded border px-2 py-0.5 text-[11px] font-medium " + (PROFILE_STATUS_CHIP[profile.profileStatus] ?? "")}>
          {titleCase(profile.profileStatus)}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <MapPin size={12} /> {[profile.city, profile.state].filter(Boolean).join(", ") || "—"}
        </span>
        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">{profile.primaryIndustry}</span>
        {/* Never the raw `siteId` — a cuid says nothing, and the 1:1 Plant link
            is exactly what would be broken if the name failed to resolve. */}
        <span className="text-xs text-slate-400">Site: {profile.siteName ?? "Unknown site"}</span>
        <div className="ml-auto grid grid-cols-3 gap-2">
          <Tile label="Buildings" value={fmtNum(profile.buildingCount)} />
          <Tile label="Employees" value={fmtNum(profile.totalEmployees)} />
          <Tile label="Ownership" value={OWNERSHIP_LABEL[profile.ownershipType] ?? profile.ownershipType} />
        </div>
      </div>

      {/* Edit the profile itself + the approval trail governing that edit */}
      <ProfileEditPanel profile={profile} />

      {/* Lifecycle workflow stepper */}
      <LifecycleStepper profile={profile} />

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Button
            key={t}
            type="button"
            variant="ghost"
            onClick={() => setTab(t)}
            className={cn(
              "h-auto px-3 py-2 text-sm font-medium transition-colors",
              tab === t ? "border-b-2 border-primary-700 text-primary-700" : "text-slate-500 hover:text-slate-800"
            )}
          >
            {t}
          </Button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab profile={profile} />}
      {tab === "Buildings" && <BuildingsTab profile={profile} />}
      {tab === "Workforce" && <WorkforceTab profile={profile} />}
      {tab === "Production Processes" && <ProcessesTab profile={profile} />}
      {tab === "Equipment" && <EquipmentTab profile={profile} />}
      {tab === "Hazmat" && <HazmatTab profile={profile} />}
      {tab === "Certifications" && <CertificationsTab profile={profile} />}
      {tab === "Factory Licences" && <RegulatoryTab profile={profile} />}
      {tab === "Contacts" && <ContactsTab profile={profile} />}
      {tab === "Compliance & Audit" && <ComplianceAuditTab profile={profile} />}
      {tab === "Audit Trail" && <AuditTrailTab profile={profile} />}
    </div>
  );
}

function OverviewTab({ profile }: { profile: FactoryProfileDetail }) {
  const canEdit = usePermission("FACILITY.UPDATE");
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Identity & Statutory</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Factory licence">{profile.factoryLicenseNo ?? "—"}</Row>
          <Row label="Licence valid until">{fmtDate(profile.factoryLicenseValidUntil)}</Row>
          <Row label="Pollution Control Board">{profile.pollutionControlBoard ?? "—"}</Row>
          <Row label="Established">{profile.establishedYear ? String(profile.establishedYear) : "—"}</Row>
          <Row label={withUnit("Land area", "area")}>{profile.totalLandAreaSqm != null ? fmtNum(profile.totalLandAreaSqm) : "—"}</Row>
          <Row label={withUnit("Built-up area", "area")}>{profile.builtUpAreaSqm != null ? fmtNum(profile.builtUpAreaSqm) : "—"}</Row>
        </dl>
        <div className="mt-3">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Applicable acts</div>
          <div className="flex flex-wrap gap-1">
            {profile.applicableActs.length === 0 ? (
              <span className="text-sm text-slate-400">—</span>
            ) : (
              profile.applicableActs.map((a) => (
                <span key={a} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{a}</span>
              ))
            )}
          </div>
        </div>
        {profile.registrationNos.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Registrations</div>
            <div className="space-y-1">
              {profile.registrationNos.map((r, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-500">{r.type}</span>
                  <span className="font-medium text-slate-700">{r.number}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Summary</h3>
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Buildings" value={fmtNum(profile.buildingCount)} />
          <Tile label="Employees" value={fmtNum(profile.totalEmployees)} />
          <Tile label="Processes" value={fmtNum(profile.processes.length)} />
          <Tile label="Certifications" value={fmtNum(profile.certifications.length)} />
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Address">{profile.addressLine || "—"}</Row>
          <Row label="City / State">{[profile.city, profile.state].filter(Boolean).join(", ") || "—"}</Row>
          <Row label="Pincode">{profile.pincode || "—"}</Row>
          <Row label="Geo">{profile.latitude != null && profile.longitude != null ? `${profile.latitude}, ${profile.longitude}` : "—"}</Row>
          <Row label="Next review">{fmtDate(profile.nextReviewDate)}</Row>
        </dl>
      </div>

      {/* Documents belonging to the factory as a whole, rather than to one
          licence — the plot plan, the occupancy certificate, land records.
          Per-licence documents live on each row of the Factory Licences tab. */}
      <div className="lg:col-span-2">
        <EvidenceAttachment
          entityType="factory_profile"
          entityId={profile.id}
          canManage={canEdit}
          title="Factory documents"
          help="Site layout / plot plan, occupancy certificate, land records. PDF or image, up to 25 MB."
          categories={[
            { value: "SITE_LAYOUT", label: "Site layout / plot plan" },
            { value: "OCCUPANCY_CERTIFICATE", label: "Occupancy certificate" },
            { value: "LAND_RECORD", label: "Land record" },
            { value: "LICENSE", label: "Licence" },
            { value: "CERTIFICATE", label: "Certificate" },
            { value: "REPORT", label: "Report" },
            { value: "OTHER", label: "Other" },
          ]}
        />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  );
}

const EMPTY_BUILDING_EDIT: Record<string, any> = {
  buildingName: "", buildingType: "PRODUCTION", floors: "1", areaSqm: "", assemblyPoint: "", emergencyExits: "",
};

function BuildingsTab({ profile }: { profile: FactoryProfileDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const canEdit = usePermission("FACILITY.UPDATE");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<BuildingType>("PRODUCTION");
  const [floors, setFloors] = useState("1");
  // Inline per-row edit (matches the Certifications tab pattern).
  const [editId, setEditId] = useState<string | null>(null);
  const [ef, setEf] = useState<Record<string, any>>(EMPTY_BUILDING_EDIT);

  const breakdown = profile.buildings.reduce<Record<string, number>>((acc, b) => {
    acc[b.buildingType] = (acc[b.buildingType] ?? 0) + 1;
    return acc;
  }, {});

  async function addBuilding() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/profiles/${profile.id}/buildings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ buildingName: name, buildingType: type, floors: Math.max(1, Number(floors) || 1) }),
      });
      setName("");
      setFloors("1");
      setAdding(false);
      toast({ variant: "success", title: "Building added", description: name });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Add failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(b: Building) {
    setErr(null);
    setEditId(b.id);
    setEf({
      buildingName: b.buildingName,
      buildingType: b.buildingType,
      floors: String(b.floors ?? 1),
      areaSqm: b.areaSqm != null ? String(b.areaSqm) : "",
      assemblyPoint: b.assemblyPoint ?? "",
      emergencyExits: b.emergencyExits != null ? String(b.emergencyExits) : "",
    });
  }

  async function saveEdit() {
    if (!editId || !ef.buildingName.trim()) {
      setErr("Building name is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/buildings/${editId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          buildingName: ef.buildingName.trim(),
          buildingType: ef.buildingType,
          floors: Math.max(1, Number(ef.floors) || 1),
          areaSqm: ef.areaSqm === "" ? null : Number(ef.areaSqm),
          assemblyPoint: ef.assemblyPoint.trim() || null,
          emergencyExits: ef.emergencyExits === "" ? null : Math.max(0, Number(ef.emergencyExits) || 0),
        }),
      });
      setEditId(null);
      toast({ variant: "success", title: "Building updated", description: ef.buildingName });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeBuilding(b: Building) {
    if (!confirm(`Delete “${b.buildingName}”?\n\nThis removes the building from the register. This cannot be undone.`)) return;
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/buildings/${b.id}`, { method: "DELETE" });
      toast({ variant: "success", title: "Building deleted", description: b.buildingName });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
      toast({ variant: "error", title: "Delete failed", description: e?.message ?? "Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const editField = (k: string, label: string, opts?: { type?: string; w?: string; ph?: string }) => (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">{label}</label>
      <Input
        type={opts?.type ?? "text"}
        className={opts?.w}
        placeholder={opts?.ph}
        value={ef[k]}
        onChange={(e) => setEf({ ...ef, [k]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <ErrorNote err={err} />
      {/* breakdown */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(breakdown).map(([t, n]) => (
          <span key={t} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
            {BUILDING_TYPE_LABEL[t] ?? t} <span className="font-semibold tabular-nums">{n}</span>
          </span>
        ))}
        <span className="ml-auto text-xs text-slate-400">buildingCount: {profile.buildingCount}</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow>
              <TableHead>Building</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Floors</TableHead>
              <TableHead className="text-right">{withUnit("Area", "area")}</TableHead>
              <TableHead>Assembly point</TableHead>
              <TableHead className="text-right">Exits</TableHead>
              {canEdit && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {profile.buildings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6} className="py-8 text-center text-slate-400">
                  No buildings in the register yet.
                </TableCell>
              </TableRow>
            ) : (
              profile.buildings.map((b) =>
                editId === b.id ? (
                  <TableRow key={b.id} className="bg-primary-50/40">
                    <TableCell colSpan={canEdit ? 7 : 6}>
                      <div className="flex flex-wrap items-end gap-2">
                        {editField("buildingName", "Building name", { ph: "Block A — Stitching" })}
                        <div>
                          <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">Type</label>
                          <Select value={ef.buildingType} onChange={(e) => setEf({ ...ef, buildingType: e.target.value })}>
                            {BUILDING_TYPES.map((t) => <option key={t} value={t}>{BUILDING_TYPE_LABEL[t]}</option>)}
                          </Select>
                        </div>
                        {editField("floors", "Floors", { type: "number", w: "w-16" })}
                        {editField("areaSqm", withUnit("Area", "area"), { type: "number", w: "w-24" })}
                        {editField("assemblyPoint", "Assembly point", { ph: "AP-1 (East gate)" })}
                        {editField("emergencyExits", "Exits", { type: "number", w: "w-16" })}
                        <Button type="button" size="sm" onClick={saveEdit} disabled={busy || !ef.buildingName.trim()}>Save</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditId(null)} disabled={busy}>Cancel</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <Fragment key={b.id}>
                    <TableRow>
                      <TableCell className="font-medium text-slate-700">{b.buildingName}</TableCell>
                      <TableCell className="text-xs text-slate-500">{BUILDING_TYPE_LABEL[b.buildingType] ?? b.buildingType}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.floors}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.areaSqm != null ? fmtNum(b.areaSqm) : "—"}</TableCell>
                      <TableCell className="text-xs text-slate-500">{b.assemblyPoint ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.emergencyExits ?? "—"}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(b)} disabled={busy} title="Edit building" className="h-auto w-auto text-slate-400 hover:text-primary-700 disabled:opacity-40">
                              <Pencil size={15} />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeBuilding(b)} disabled={busy} title="Delete building" className="h-auto w-auto text-slate-400 hover:text-rose-600 disabled:opacity-40">
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    {/* Floors and what each one actually carries — collapsed by
                        default so the register stays scannable. */}
                    <TableRow>
                      <TableCell colSpan={canEdit ? 7 : 6} className="p-0">
                        <FloorMapping building={b} processes={profile.processes} onError={setErr} />
                      </TableCell>
                    </TableRow>
                  </Fragment>
                )
              )
            )}
          </TableBody>
        </Table>
      </div>

      <Can permission="FACILITY.UPDATE">
        {adding ? (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Building name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Block A — Stitching"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <Select value={type} onChange={(e) => setType(e.target.value as BuildingType)}>
                {BUILDING_TYPES.map((t) => (
                  <option key={t} value={t}>{BUILDING_TYPE_LABEL[t]}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Floors</label>
              <Input className="w-20" value={floors} onChange={(e) => setFloors(e.target.value)} />
            </div>
            <Button type="button" onClick={addBuilding} disabled={busy || !name.trim()}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add building
          </Button>
        )}
      </Can>
    </div>
  );
}

// ── Workforce (SA8000 welfare lens) ─────────────────────────────────────────
function Bar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
      {segments.map((s) => (
        <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
      ))}
    </div>
  );
}

function Legend({ items }: { items: { label: string; value: number; pctOf: number; dot: string }[] }) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
      {items.map((i) => (
        <div key={i.label}>
          <div className="flex items-center gap-1 text-slate-500">
            <span className={"inline-block h-2 w-2 rounded-full " + i.dot} /> {i.label}
          </div>
          <div className="font-semibold text-slate-800">
            {fmtNum(i.value)} <span className="font-normal text-slate-400">· {i.pctOf}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkforceTab({ profile }: { profile: FactoryProfileDetail }) {
  const router = useRouter();
  const canEdit = usePermission("FACILITY.WORKFORCE_UPDATE");
  const w = profile.currentWorkforce;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    permanentCount: w?.permanentCount ?? 0,
    contractCount: w?.contractCount ?? 0,
    apprenticeTraineeCount: w?.apprenticeTraineeCount ?? 0,
    maleCount: w?.maleCount ?? 0,
    femaleCount: w?.femaleCount ?? 0,
    otherGenderCount: w?.otherGenderCount ?? 0,
    migrantWorkerCount: w?.migrantWorkerCount ?? 0,
    differentlyAbledCount: w?.differentlyAbledCount ?? 0,
    youngestWorkerAge: w?.youngestWorkerAge ?? 0,
    workersUnder18Count: w?.workersUnder18Count ?? 0,
    minHiringAgePolicy: w?.minHiringAgePolicy ?? 18,
  });

  const total = f.permanentCount + f.contractCount + f.apprenticeTraineeCount;
  const genderTotal = f.maleCount + f.femaleCount + f.otherGenderCount;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/factory/profiles/${profile.id}/workforce`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(f),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail ?? j?.error ?? "Update failed");
      }
      setEditing(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const numField = (k: keyof typeof f, label: string) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <Input
        type="number"
        min={0}
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: Math.max(0, Number(e.target.value) || 0) })}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {!w && !editing && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          No workforce composition recorded yet. {canEdit && "Use “Update composition” to add one."}
        </div>
      )}

      {w && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Employment type */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Employment type</h3>
              <span className="text-xs text-slate-400">as of {fmtDate(w.asOfDate)}</span>
            </div>
            <Bar
              segments={[
                { label: "Permanent", value: w.permanentCount, color: "bg-emerald-500" },
                { label: "Contract", value: w.contractCount, color: "bg-amber-500" },
                { label: "Apprentice", value: w.apprenticeTraineeCount, color: "bg-sky-500" },
              ]}
            />
            <Legend
              items={[
                { label: "Permanent", value: w.permanentCount, pctOf: pct(w.permanentCount, w.totalCount), dot: "bg-emerald-500" },
                { label: "Contract", value: w.contractCount, pctOf: pct(w.contractCount, w.totalCount), dot: "bg-amber-500" },
                { label: "Apprentice", value: w.apprenticeTraineeCount, pctOf: pct(w.apprenticeTraineeCount, w.totalCount), dot: "bg-sky-500" },
              ]}
            />
            <div className="mt-3 text-right text-sm text-slate-500">
              Total workforce <span className="font-bold text-slate-900">{fmtNum(w.totalCount)}</span>
            </div>
          </div>

          {/* Gender split */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Gender split (SA8000)</h3>
            <Bar
              segments={[
                { label: "Female", value: w.femaleCount, color: "bg-violet-500" },
                { label: "Male", value: w.maleCount, color: "bg-blue-500" },
                { label: "Other", value: w.otherGenderCount, color: "bg-slate-400" },
              ]}
            />
            <Legend
              items={[
                { label: "Female", value: w.femaleCount, pctOf: pct(w.femaleCount, w.genderTotal), dot: "bg-violet-500" },
                { label: "Male", value: w.maleCount, pctOf: pct(w.maleCount, w.genderTotal), dot: "bg-blue-500" },
                { label: "Other", value: w.otherGenderCount, pctOf: pct(w.otherGenderCount, w.genderTotal), dot: "bg-slate-400" },
              ]}
            />
            {w.genderMismatch && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                Gender split ({fmtNum(w.genderTotal)}) doesn’t reconcile to total headcount ({fmtNum(w.totalCount)}) — soft warning only.
              </div>
            )}
          </div>

          {/* Welfare lens */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">SA8000 welfare lens</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Contract %" value={`${pct(w.contractCount, w.totalCount)}%`} />
              <Tile label="Female %" value={`${pct(w.femaleCount, w.genderTotal)}%`} />
              <Tile label="Migrant workers" value={w.migrantWorkerCount != null ? fmtNum(w.migrantWorkerCount) : "—"} />
              <Tile label="Differently-abled" value={w.differentlyAbledCount != null ? fmtNum(w.differentlyAbledCount) : "—"} />
            </div>
            {/* Child-labour evidence (SA8000 Element 1) */}
            <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Child-labour evidence (Element 1)</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Youngest worker age" value={w.youngestWorkerAge != null ? String(w.youngestWorkerAge) : "—"} />
              <Tile label="Workers under 18" value={fmtNum(w.workersUnder18Count)} />
              <Tile label="Min hiring-age policy" value={w.minHiringAgePolicy != null ? String(w.minHiringAgePolicy) : "—"} />
            </div>
            {w.childLabourFlag && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                <strong>Child-labour attention flag</strong> — under-18 workers present and the youngest ({w.youngestWorkerAge ?? "?"}) is below the
                hiring-age policy ({w.minHiringAgePolicy ?? "?"}). This is the most-scrutinised SA8000 item and surfaces on the group register & export.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Headcount trend */}
      {profile.workforceHistory.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Headcount trend</h3>
          <div className="flex flex-wrap gap-3 text-xs">
            {[...profile.workforceHistory].reverse().map((h) => (
              <div key={h.id} className={"rounded-lg border px-3 py-1.5 " + (h.isCurrent ? "border-primary-300 bg-primary-50" : "border-slate-200")}>
                <div className="text-slate-400">{fmtDate(h.asOfDate)}</div>
                <div className="font-semibold text-slate-800">{fmtNum(h.totalCount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social-compliance profile (SA8000 policy/standing) */}
      <SocialComplianceCard profile={profile} />

      {/* Update form */}
      <Can permission="FACILITY.WORKFORCE_UPDATE">
        {editing ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Update composition (creates a new dated record)</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {numField("permanentCount", "Permanent")}
              {numField("contractCount", "Contract")}
              {numField("apprenticeTraineeCount", "Apprentice")}
              <div className="flex items-end text-sm text-slate-500">= total {fmtNum(total)}</div>
              {numField("maleCount", "Male")}
              {numField("femaleCount", "Female")}
              {numField("otherGenderCount", "Other")}
              <div className="flex items-end text-sm text-slate-500">gender {fmtNum(genderTotal)}</div>
              {numField("migrantWorkerCount", "Migrant workers")}
              {numField("differentlyAbledCount", "Differently-abled")}
              {numField("youngestWorkerAge", "Youngest worker age")}
              {numField("workersUnder18Count", "Workers under 18")}
              {numField("minHiringAgePolicy", "Min hiring-age policy")}
            </div>
            {f.workersUnder18Count > 0 && f.youngestWorkerAge > 0 && f.youngestWorkerAge < f.minHiringAgePolicy && (
              <div className="mt-2 text-[11px] text-rose-600">
                Note: under-18 workers below the hiring-age policy will raise a child-labour attention flag (SA8000 Element 1).
              </div>
            )}
            {genderTotal !== total && (
              <div className="mt-2 text-[11px] text-amber-600">Note: gender split won’t reconcile to total — allowed (soft warning).</div>
            )}
            {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
            <div className="mt-3 flex gap-2">
              <Button type="button" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save composition"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // Re-seed the form from the (possibly just-refreshed) current
              // record so a re-open never shows stale typed values.
              setF({
                permanentCount: w?.permanentCount ?? 0,
                contractCount: w?.contractCount ?? 0,
                apprenticeTraineeCount: w?.apprenticeTraineeCount ?? 0,
                maleCount: w?.maleCount ?? 0,
                femaleCount: w?.femaleCount ?? 0,
                otherGenderCount: w?.otherGenderCount ?? 0,
                migrantWorkerCount: w?.migrantWorkerCount ?? 0,
                differentlyAbledCount: w?.differentlyAbledCount ?? 0,
                youngestWorkerAge: w?.youngestWorkerAge ?? 0,
                workersUnder18Count: w?.workersUnder18Count ?? 0,
                minHiringAgePolicy: w?.minHiringAgePolicy ?? 18,
              });
              setErr(null);
              setEditing(true);
            }}
          >
            <Plus size={16} /> Update composition
          </Button>
        )}
      </Can>
    </div>
  );
}

// ── Social-Compliance Profile (SA8000 policy/standing) ───────────────────────
const SOCIAL_ELEMENTS: { key: keyof SocialComplianceProfile; label: string }[] = [
  { key: "minimumWageCompliant", label: "Minimum wage compliant" },
  { key: "wagesPaidOnTime", label: "Wages paid on time" },
  { key: "overtimeVoluntary", label: "Overtime voluntary" },
  { key: "weeklyRestDayProvided", label: "Weekly rest day" },
  { key: "unionOrWorkerCommitteePresent", label: "Union / worker committee" },
  { key: "noDepositOrDocumentRetention", label: "No deposit / doc retention" },
  { key: "grievanceMechanismPresent", label: "Grievance mechanism" },
  { key: "antiDiscriminationPolicy", label: "Anti-discrimination policy" },
];

function SocialFlagChip({ flag }: { flag: ComplianceFlag }) {
  return (
    <span className={"inline-block rounded border px-2 py-0.5 text-[11px] font-medium " + SOCIAL_FLAG_CHIP[flag]}>
      {SOCIAL_FLAG_LABEL[flag]}
    </span>
  );
}

function SocialComplianceCard({ profile }: { profile: FactoryProfileDetail }) {
  const router = useRouter();
  const canEdit = usePermission("FACILITY.SOCIAL_UPDATE");
  const s = profile.socialCompliance;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const blankFlags = Object.fromEntries(SOCIAL_ELEMENTS.map((e) => [e.key, "NOT_ASSESSED"])) as Record<string, ComplianceFlag>;
  const [f, setF] = useState({
    ...blankFlags,
    collectiveBargainingAgreement: s?.collectiveBargainingAgreement ?? false,
    lowestMonthlyWageInr: s?.lowestMonthlyWageInr ?? 0,
    statutoryMinimumWageInr: s?.statutoryMinimumWageInr ?? 0,
    standardWeeklyHours: s?.standardWeeklyHours ?? 48,
    maxWeeklyOvertimeHours: s?.maxWeeklyOvertimeHours ?? 12,
    sa8000AwarenessTrainingPct: s?.sa8000AwarenessTrainingPct ?? 0,
  });

  function openEdit() {
    const flags = Object.fromEntries(
      SOCIAL_ELEMENTS.map((e) => [e.key, (s?.[e.key] as ComplianceFlag) ?? "NOT_ASSESSED"]),
    ) as Record<string, ComplianceFlag>;
    setF({
      ...flags,
      collectiveBargainingAgreement: s?.collectiveBargainingAgreement ?? false,
      lowestMonthlyWageInr: s?.lowestMonthlyWageInr ?? 0,
      statutoryMinimumWageInr: s?.statutoryMinimumWageInr ?? 0,
      standardWeeklyHours: s?.standardWeeklyHours ?? 48,
      maxWeeklyOvertimeHours: s?.maxWeeklyOvertimeHours ?? 12,
      sa8000AwarenessTrainingPct: s?.sa8000AwarenessTrainingPct ?? 0,
    });
    setErr(null);
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/profiles/${profile.id}/social-compliance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(f),
      });
      setEditing(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const flagSelect = (key: keyof typeof f, label: string) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <Select
        value={String(f[key])}
        onChange={(e) => setF({ ...f, [key]: e.target.value as ComplianceFlag })}
      >
        {COMPLIANCE_FLAGS.map((c) => (
          <option key={c} value={c}>{SOCIAL_FLAG_LABEL[c]}</option>
        ))}
      </Select>
    </div>
  );

  const numField = (key: keyof typeof f, label: string) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <Input
        type="number"
        min={0}
        value={Number(f[key])}
        onChange={(e) => setF({ ...f, [key]: Math.max(0, Number(e.target.value) || 0) })}
      />
    </div>
  );

  const otBreach = s?.maxWeeklyOvertimeHours != null && s.maxWeeklyOvertimeHours > 12;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Social-compliance profile (SA8000)</h3>
        {s && <SocialFlagChip flag={s.overallSocialComplianceFlag} />}
      </div>

      {!s && !editing && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          No social-compliance profile recorded yet. {canEdit && "Use “Edit social-compliance” to add one."}
        </div>
      )}

      {s && !editing && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {SOCIAL_ELEMENTS.map((e) => (
              <div key={e.key as string} className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">{e.label}</span>
                <SocialFlagChip flag={s[e.key] as ComplianceFlag} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Lowest monthly wage" value={s.lowestMonthlyWageInr != null ? `₹${fmtNum(s.lowestMonthlyWageInr)}` : "—"} />
            <Tile label="Statutory min wage" value={s.statutoryMinimumWageInr != null ? `₹${fmtNum(s.statutoryMinimumWageInr)}` : "—"} />
            <Tile label="Standard weekly hrs" value={s.standardWeeklyHours != null ? String(s.standardWeeklyHours) : "—"} />
            <Tile label="Max weekly OT" value={s.maxWeeklyOvertimeHours != null ? `${s.maxWeeklyOvertimeHours} h` : "—"} />
            <Tile label="Collective bargaining" value={s.collectiveBargainingAgreement ? "Yes" : "No"} />
            <Tile label="SA8000 training" value={s.sa8000AwarenessTrainingPct != null ? `${s.sa8000AwarenessTrainingPct}%` : "—"} />
            <Tile label="Last social audit" value={fmtDate(s.lastSocialAuditDate)} />
            <Tile label="Next review" value={fmtDate(s.nextReviewDate)} />
          </div>
          {otBreach && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              Max weekly overtime ({s.maxWeeklyOvertimeHours}h) exceeds the SA8000 cap of 12h — Working Hours flagged for attention.
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SOCIAL_ELEMENTS.map((e) => flagSelect(e.key as keyof typeof f, e.label))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {numField("lowestMonthlyWageInr", "Lowest monthly wage (₹)")}
            {numField("statutoryMinimumWageInr", "Statutory min wage (₹)")}
            {numField("standardWeeklyHours", "Standard weekly hours")}
            {numField("maxWeeklyOvertimeHours", "Max weekly overtime")}
            {numField("sa8000AwarenessTrainingPct", "SA8000 training %")}
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <Checkbox
                  checked={f.collectiveBargainingAgreement}
                  onChange={(e) => setF({ ...f, collectiveBargainingAgreement: e.target.checked })}
                />
                Collective bargaining
              </label>
            </div>
          </div>
          {f.maxWeeklyOvertimeHours > 12 && (
            <div className="text-[11px] text-amber-600">Note: max OT &gt; 12h will flag the Working Hours element (SA8000 cap).</div>
          )}
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex gap-2">
            <Button type="button" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save social-compliance"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!editing && canEdit && (
        <div className="mt-3">
          <Button type="button" variant="outline" onClick={openEdit}>
            <Plus size={16} /> {s ? "Edit social-compliance" : "Add social-compliance"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Production Processes ─────────────────────────────────────────────────────
function ProcessesTab({ profile }: { profile: FactoryProfileDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const canEdit = usePermission("FACILITY.UPDATE");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ processName: "", installedCapacity: "", shiftPattern: "", keyHazards: "" });
  // Inline per-card edit.
  const [editId, setEditId] = useState<string | null>(null);
  const [ef, setEf] = useState({ processName: "", installedCapacity: "", shiftPattern: "", keyHazards: "" });

  async function add() {
    if (!f.processName.trim()) return;
    setBusy(true);
    setErr(null);
    // Next sequence = max existing + 1 (length+1 collides after a middle delete).
    const nextSeq = profile.processes.reduce((mx, p) => Math.max(mx, p.sequenceOrder ?? 0), 0) + 1;
    try {
      await mutate(`/api/factory/profiles/${profile.id}/processes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          processName: f.processName,
          installedCapacity: f.installedCapacity || null,
          shiftPattern: f.shiftPattern || null,
          sequenceOrder: nextSeq,
          keyHazards: f.keyHazards.split(",").map((h) => h.trim()).filter(Boolean),
        }),
      });
      setF({ processName: "", installedCapacity: "", shiftPattern: "", keyHazards: "" });
      setAdding(false);
      toast({ variant: "success", title: "Process added", description: f.processName });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Add failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: ProductionProcess) {
    setErr(null);
    setEditId(p.id);
    setEf({
      processName: p.processName,
      installedCapacity: p.installedCapacity ?? "",
      shiftPattern: p.shiftPattern ?? "",
      keyHazards: p.keyHazards.join(", "),
    });
  }

  async function saveEdit() {
    if (!editId || !ef.processName.trim()) {
      setErr("Process name is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/processes/${editId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          processName: ef.processName.trim(),
          installedCapacity: ef.installedCapacity.trim() || null,
          shiftPattern: ef.shiftPattern.trim() || null,
          keyHazards: ef.keyHazards.split(",").map((h) => h.trim()).filter(Boolean),
        }),
      });
      setEditId(null);
      toast({ variant: "success", title: "Process updated", description: ef.processName });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: ProductionProcess) {
    if (!confirm(`Delete process “${p.processName}”?\n\nThis cannot be undone.`)) return;
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/processes/${p.id}`, { method: "DELETE" });
      toast({ variant: "success", title: "Process deleted", description: p.processName });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
      toast({ variant: "error", title: "Delete failed", description: e?.message ?? "Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const efField = (k: keyof typeof ef, label: string, ph = "") => (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">{label}</label>
      <Input placeholder={ph} value={ef[k]} onChange={(e) => setEf({ ...ef, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-4">
      <ErrorNote err={err} />
      {profile.processes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          No production processes recorded yet.
        </div>
      ) : (
        <div className="flex flex-wrap items-stretch gap-2">
          {profile.processes.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              {editId === p.id ? (
                <div className="w-72 space-y-2 rounded-xl border border-primary-200 bg-primary-50/40 p-3">
                  {efField("processName", "Process name", "Stitching")}
                  <div className="flex gap-2">
                    <div className="flex-1">{efField("installedCapacity", withUnit("Installed capacity", "production"), "12000")}</div>
                    <div className="w-24">{efField("shiftPattern", "Shifts", "2 shifts")}</div>
                  </div>
                  {efField("keyHazards", "Key hazards (comma)", "Needle injury, Noise")}
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={saveEdit} disabled={busy || !ef.processName.trim()}>Save</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditId(null)} disabled={busy}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="group relative w-56 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700">
                        {p.sequenceOrder ?? i + 1}
                      </span>
                      <span className="font-semibold text-slate-800">{p.processName}</span>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(p)} disabled={busy} title="Edit process" className="h-auto w-auto text-slate-300 hover:text-primary-700">
                          <Pencil size={13} />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(p)} disabled={busy} title="Delete process" className="h-auto w-auto text-slate-300 hover:text-rose-600">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                    {p.installedCapacity && <div>Installed capacity: {p.installedCapacity} {UNITS.production}</div>}
                    {p.shiftPattern && <div>Shifts: {p.shiftPattern}</div>}
                  </div>
                  {p.keyHazards.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.keyHazards.map((h) => (
                        <span key={h} className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-600">{h}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {i < profile.processes.length - 1 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>
      )}

      <Can permission="FACILITY.UPDATE">
        {adding ? (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Process name</label>
              <Input value={f.processName} onChange={(e) => setF({ ...f, processName: e.target.value })} placeholder="Stitching" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{withUnit("Installed capacity", "production")}</label>
              <Input value={f.installedCapacity} onChange={(e) => setF({ ...f, installedCapacity: e.target.value })} placeholder="12000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Shifts</label>
              <Input value={f.shiftPattern} onChange={(e) => setF({ ...f, shiftPattern: e.target.value })} placeholder="2 shifts" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Key hazards (comma)</label>
              <Input value={f.keyHazards} onChange={(e) => setF({ ...f, keyHazards: e.target.value })} placeholder="Needle injury, Noise" />
            </div>
            <Button type="button" onClick={add} disabled={busy || !f.processName.trim()}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add process
          </Button>
        )}
      </Can>
    </div>
  );
}

// ── Certifications (status engine) ──────────────────────────────────────────
function CertificationsTab({ profile }: { profile: FactoryProfileDetail }) {
  const router = useRouter();
  const search = useSearchParams();
  const canEdit = usePermission("FACILITY.CERT_MANAGE");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Which certificate's document drawer is open — one at a time, so opening a
  // row doesn't fetch attachment lists nobody is looking at.
  const [docsFor, setDocsFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<{ certificationType: CertificationType; certificateNo: string; issuingBody: string; expiryDate: string; renewalLeadDays: number; status: "" | CertStatus }>({
    certificationType: "SA8000",
    certificateNo: "",
    issuingBody: "",
    expiryDate: "",
    renewalLeadDays: 60,
    status: "",
  });

  const BLANK = { certificationType: "SA8000" as CertificationType, certificateNo: "", issuingBody: "", expiryDate: "", renewalLeadDays: 60, status: "" as "" | CertStatus };

  function startEdit(c: FactoryCertification) {
    setF({
      certificationType: c.certificationType,
      certificateNo: c.certificateNo ?? "",
      issuingBody: c.issuingBody ?? "",
      expiryDate: c.expiryDate ? c.expiryDate.slice(0, 10) : "",
      renewalLeadDays: c.renewalLeadDays ?? 60,
      // Only the manual overrides round-trip; date-derived statuses show as "Auto".
      status: c.status === "UNDER_RENEWAL" || c.status === "SUSPENDED" ? c.status : "",
    });
    setErr(null);
    setEditingId(c.id);
    setAdding(true);
  }

  function closeForm() {
    setAdding(false);
    setEditingId(null);
    setF(BLANK);
  }

  // Deep-link from the Certifications Register ("Edit in Factory Profile") opens
  // the matching cert straight into the edit form.
  useEffect(() => {
    const editCert = search.get("editCert");
    if (!editCert) return;
    const c = profile.certifications.find((x) => x.id === editCert);
    if (c) startEdit(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        certificationType: f.certificationType,
        certificateNo: f.certificateNo || null,
        issuingBody: f.issuingBody || null,
        expiryDate: f.expiryDate ? new Date(f.expiryDate).toISOString() : null,
        renewalLeadDays: Math.max(0, f.renewalLeadDays ?? 60),
      };
      if (editingId) {
        // PATCH: send status ONLY to set a manual override; omitting it makes the
        // backend recompute the status from the dates (i.e. clears an override).
        if (f.status) payload.status = f.status;
        await mutate(`/api/factory/certifications/${editingId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        payload.status = f.status || null;
        await mutate(`/api/factory/profiles/${profile.id}/certifications`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      closeForm();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: FactoryCertification) {
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/certifications/${c.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ErrorNote err={err} />
      <div className="rounded-xl border border-slate-200 bg-white">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Certification</TableHead>
              <TableHead>Certificate No.</TableHead>
              <TableHead>Issuing body</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {profile.certifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="py-8 text-center text-slate-400">
                  No certifications recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              profile.certifications.map((c) => (
                <Fragment key={c.id}>
                <TableRow>
                  <TableCell className="font-medium">
                    <Link
                      href={`/facilities/certifications?facility=${encodeURIComponent(profile.factoryCode)}&type=${encodeURIComponent(c.certificationType)}`}
                      className="text-primary-700 hover:underline"
                      title="Open in the group Certifications Register"
                    >
                      {CERT_TYPE_LABEL[c.certificationType] ?? c.certificationType}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{c.certificateNo ?? "—"}</TableCell>
                  <TableCell className="text-xs text-slate-500">{c.issuingBody ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    <span className="text-slate-600">{fmtDate(c.expiryDate)}</span>
                    {c.daysToExpiry != null && c.daysToExpiry >= 0 && c.status === "EXPIRING_SOON" && (
                      <span className="ml-1 text-[10px] text-amber-600">in {c.daysToExpiry}d</span>
                    )}
                    {c.daysToExpiry != null && c.daysToExpiry < 0 && (
                      <span className="ml-1 text-[10px] text-rose-600">{Math.abs(c.daysToExpiry)}d ago</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={"rounded border px-2 py-0.5 text-[10px] font-medium " + (CERT_STATUS_CHIP[c.status] ?? "")}>
                      {titleCase(c.status)}
                    </span>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button type="button" variant="ghost" onClick={() => setDocsFor(docsFor === c.id ? null : c.id)} title="Certificate documents" className="h-auto gap-1 text-[11px] font-medium text-primary-700 hover:underline">
                          <Paperclip size={12} /> Documents
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(c)} disabled={busy} title="Edit" className="h-auto w-auto text-slate-400 hover:text-primary-700 disabled:opacity-40">
                          <Pencil size={15} />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(c)} disabled={busy} title="Delete" className="h-auto w-auto text-slate-400 hover:text-rose-600 disabled:opacity-40">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                {docsFor === c.id && (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 6 : 5} className="bg-slate-50/60 p-3">
                      <EvidenceAttachment
                        entityType="factory_certification"
                        entityId={c.id}
                        canManage={canEdit}
                        title={`${CERT_TYPE_LABEL[c.certificationType] ?? c.certificationType} — documents`}
                        help="The certificate as issued, plus the audit report and scope document behind it."
                        categories={[
                          { value: "CERTIFICATE", label: "Certificate" },
                          { value: "AUDIT_REPORT", label: "Audit report" },
                          { value: "SCOPE_DOCUMENT", label: "Scope document" },
                          { value: "CORRESPONDENCE", label: "Correspondence" },
                          { value: "OTHER", label: "Other" },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Can permission="FACILITY.CERT_MANAGE">
        {adding ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-700">
              {editingId ? `Edit ${CERT_TYPE_LABEL[f.certificationType] ?? f.certificationType}` : "Add certification"}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Certification</label>
                <Select value={f.certificationType} onChange={(e) => setF({ ...f, certificationType: e.target.value as CertificationType })}>
                  {CERTIFICATION_TYPES.map((t) => (
                    <option key={t} value={t}>{CERT_TYPE_LABEL[t]}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Certificate No.</label>
                <Input value={f.certificateNo} onChange={(e) => setF({ ...f, certificateNo: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Issuing body</label>
                <Input value={f.issuingBody} onChange={(e) => setF({ ...f, issuingBody: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expiry date</label>
                <Input type="date" value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Renewal lead (days)</label>
                <Input type="number" className="w-24" value={f.renewalLeadDays} onChange={(e) => setF({ ...f, renewalLeadDays: Number(e.target.value) || 60 })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Override status</label>
                <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as "" | CertStatus })}>
                  <option value="">Auto (from dates)</option>
                  {CERT_MANUAL_STATUSES.map((s) => (
                    <option key={s} value={s}>{titleCase(s)}</option>
                  ))}
                </Select>
              </div>
              <Button type="button" onClick={save} disabled={busy}>
                {editingId ? "Save changes" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm} disabled={busy}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add certification
          </Button>
        )}
      </Can>
    </div>
  );
}

// ── Contacts ─────────────────────────────────────────────────────────────────
function ContactsTab({ profile }: { profile: FactoryProfileDetail }) {
  const router = useRouter();
  const canEdit = usePermission("FACILITY.CONTACT_MANAGE");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<{ role: ContactRole; name: string; phone: string; email: string; isPrimary: boolean }>({
    role: "FACTORY_MANAGER",
    name: "",
    phone: "",
    email: "",
    isPrimary: false,
  });

  async function add() {
    if (!f.name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/profiles/${profile.id}/contacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: f.role, name: f.name, phone: f.phone || null, email: f.email || null, isPrimary: f.isPrimary }),
      });
      setAdding(false);
      setF({ role: "FACTORY_MANAGER", name: "", phone: "", email: "", isPrimary: false });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: FactoryContact) {
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/contacts/${c.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ErrorNote err={err} />
      {profile.contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          No contacts recorded yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {profile.contacts.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    {c.name}
                    {c.isPrimary && <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[9px] font-medium text-primary-700">PRIMARY</span>}
                  </div>
                  <div className="text-[11px] text-slate-400">{CONTACT_ROLE_LABEL[c.role] ?? c.role}</div>
                </div>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(c)} disabled={busy} className="h-auto w-auto text-slate-300 hover:text-rose-600">
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                {c.phone && <div>{c.phone}</div>}
                {c.email && <div className="truncate">{c.email}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Can permission="FACILITY.CONTACT_MANAGE">
        {adding ? (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as ContactRole })}>
                {CONTACT_ROLES.map((r) => (
                  <option key={r} value={r}>{CONTACT_ROLE_LABEL[r]}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-600">
              <Checkbox checked={f.isPrimary} onChange={(e) => setF({ ...f, isPrimary: e.target.checked })} /> Primary
            </label>
            <Button type="button" onClick={add} disabled={busy || !f.name.trim()}>Save</Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add contact
          </Button>
        )}
      </Can>
    </div>
  );
}

// ── Compliance & Audit (live read from the existing engines) ────────────────
function MetricTile({ label, value, tone, delta }: { label: string; value: string; tone?: "rose" | "amber" | "emerald"; delta?: KpiDelta | null }) {
  const color = tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
      <div className={"text-lg font-bold " + color}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <DeltaBadge delta={delta} />
    </div>
  );
}

// Small QoQ delta affordance — arrow + prior value. RAG-tinted ONLY when
// isImprovement is decisively true/false (neutral metrics like obligations stay
// grey, per the §3.6 "direction is not meaning" rule).
function DeltaBadge({ delta }: { delta?: KpiDelta | null }) {
  if (!delta || delta.priorValue == null) return null;
  const prior = typeof delta.priorValue === "number" ? fmtNum(delta.priorValue) : delta.priorValue;
  if (delta.direction === "flat") {
    return <div className="mt-0.5 text-[10px] text-slate-400" title={`prior ${prior}`}>= prior</div>;
  }
  const arrow = delta.direction === "up" ? "↑" : "↓";
  const tint = delta.isImprovement === true ? "text-emerald-600" : delta.isImprovement === false ? "text-rose-600" : "text-slate-400";
  const pctTxt = delta.displayPct != null ? ` ${delta.displayPct > 0 ? "+" : ""}${delta.displayPct}%` : "";
  return (
    <div className={"mt-0.5 text-[10px] font-medium " + tint} title={`prior ${prior}`}>
      {arrow} from {prior}{pctTxt}
    </div>
  );
}

function linkHref(d?: ModuleDeepLink | null): string | null {
  if (!d) return null;
  const qs = new URLSearchParams(d.query ?? {}).toString();
  return qs ? `${d.route}?${qs}` : d.route;
}

// Generic mini KPI tile for the new rollup blocks (state-coloured + optional delta).
function SubTile({ tile }: { tile: FacilityTile }) {
  const color = tile.state === "breach" ? "text-rose-600" : tile.state === "watch" ? "text-amber-600" : tile.state === "neutral" ? "text-slate-400" : "text-slate-900";
  const val = tile.value == null ? "—" : typeof tile.value === "number" ? fmtNum(tile.value) : tile.value;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
      <div className={"text-base font-bold " + color}>
        {val}
        {tile.unit ? <span className="text-xs font-normal text-slate-400"> {tile.unit}</span> : null}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{tile.label}</div>
      <DeltaBadge delta={tile.delta} />
    </div>
  );
}

function RollupRow({ row }: { row: FacilityRollupRow }) {
  const tone =
    row.statusTone === "critical" ? "text-rose-600" : row.statusTone === "warning" ? "text-amber-600" : row.statusTone === "positive" ? "text-emerald-600" : "text-slate-500";
  const inner = (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <div className="truncate">
          {row.primaryText}
          {row.statusLabel && <span className={"ml-2 text-xs font-medium " + tone}>{row.statusLabel}</span>}
        </div>
        {row.secondaryText && <div className="truncate text-xs text-slate-400">{row.secondaryText}</div>}
      </div>
      {row.trailingText && <span className="shrink-0 text-xs text-slate-500">{row.trailingText}</span>}
    </div>
  );
  const href = linkHref(row.drillTo);
  return <li>{href ? <Link href={href} className="block hover:bg-slate-50">{inner}</Link> : inner}</li>;
}

// One rollup block = mini KPI sub-strip + its drill panel. Reused for every new
// domain (environment / training / certifications / social / operational-risk).
// Renders the neutral card when not enabled; a "data refreshing" badge when degraded.
function RollupBlock({ block, periodRef }: { block?: FacilityMetricBlock | null; periodRef?: string | null }) {
  if (!block) return null;
  if (!block.enabled) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-600">{block.title}</h3>
        <p className="mt-1 text-xs text-slate-400">{block.notEnabledText ?? "Module not enabled."}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">{block.title}</h3>
        {block.degraded && (
          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">data refreshing</span>
        )}
      </div>
      <p className="text-xs text-slate-400">
        {block.caption}
        {block.domainKey === "operationalRisk" && block.lastRefreshedAt
          ? ` · live as of ${new Date(block.lastRefreshedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : periodRef
          ? ` · as of ${periodRef}`
          : ""}
      </p>
      {block.tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {block.tiles.map((t) => (
            <SubTile key={t.id} tile={t} />
          ))}
        </div>
      )}
      {block.rows.length > 0 ? (
        <ul className="divide-y divide-slate-100 text-sm text-slate-700">
          {block.rows.map((r) => (
            <RollupRow key={r.id} row={r} />
          ))}
        </ul>
      ) : (
        block.emptyText && <p className="text-xs text-slate-400">{block.emptyText}</p>
      )}
    </div>
  );
}

function ComplianceAuditTab({ profile }: { profile: FactoryProfileDetail }) {
  const [data, setData] = useState<ComplianceTabData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/factory/profiles/${profile.id}/compliance`, { signal });
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const j = await res.json();
        if (!signal?.aborted) {
          setData(j);
          setErr(null);
        }
      } catch (e: any) {
        if (!signal?.aborted && e?.name !== "AbortError") setErr(e?.message ?? "Failed to load compliance data");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [profile.id]
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    // The operational-risk block is point-in-time — refresh it when the user
    // returns to the tab (refetch the whole tab on window focus; cheap).
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      ac.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Loading live compliance data…</div>;
  if (err || !data) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err ?? "No data"}</div>;
  const m = data.metrics;
  const pm = data.priorMetrics ?? null;

  // QoQ delta vs the prior-quarter snapshot. `improveWhenDown` encodes the §3.6
  // rule that direction ≠ meaning (lower findings/incidents = improvement);
  // `neutral` (obligations) carries no RAG verdict.
  function mkDelta(key: keyof SnapshotMetrics, improveWhenDown: boolean, neutral = false): KpiDelta | undefined {
    if (!pm) return undefined;
    const cur = m[key] as number | null;
    const prior = pm[key] as number | null;
    if (cur == null || prior == null) return undefined;
    const direction = cur > prior ? "up" : cur < prior ? "down" : "flat";
    let isImprovement: boolean | null = null;
    if (!neutral && direction !== "flat") isImprovement = (direction === "up") !== improveWhenDown;
    return { priorValue: prior, direction, isImprovement, displayPct: null };
  }

  const sevChip = (s: string) =>
    s === "CRITICAL_NC" ? "bg-rose-100 text-rose-800" : s === "MAJOR_NC" ? "bg-orange-100 text-orange-800" : "bg-amber-100 text-amber-800";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-slate-400">
          Live from the audit, CAPA, obligation &amp; incident engines — site-scoped, not a copy. Each row drills into its module.
        </p>
        <TriggerAuditButton profile={profile} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <MetricTile label="Compliance" value={m.auditComplianceScorePct != null ? `${m.auditComplianceScorePct}%` : "—"} delta={mkDelta("auditComplianceScorePct", false)} />
        <MetricTile label="Open findings" value={fmtNum(m.openFindings)} tone={m.openFindings ? "amber" : undefined} delta={mkDelta("openFindings", true)} />
        <MetricTile label="Critical" value={fmtNum(m.criticalFindings)} tone={m.criticalFindings ? "rose" : undefined} delta={mkDelta("criticalFindings", true)} />
        <MetricTile label="Open CAPAs" value={fmtNum(m.openCapas)} tone={m.openCapas ? "amber" : undefined} delta={mkDelta("openCapas", true)} />
        <MetricTile label="Overdue CAPAs" value={fmtNum(m.overdueCapas)} tone={m.overdueCapas ? "rose" : undefined} delta={mkDelta("overdueCapas", true)} />
        <MetricTile label="Obligations" value={`${m.openObligations}${m.overdueObligations ? ` / ${m.overdueObligations}⚠` : ""}`} tone={m.overdueObligations ? "rose" : undefined} delta={mkDelta("openObligations", true, true)} />
        <MetricTile label="Incidents 12m" value={fmtNum(m.incidentCount12m)} delta={mkDelta("incidentCount12m", true)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ComplianceList title="Audits & Inspections" empty="No audits at this site." items={data.audits} render={(a) => (
          <Link href={`/cams/engagements/${a.id}`} className="flex items-center justify-between gap-2 hover:bg-slate-50">
            <span className="truncate"><span className="text-primary-700">{a.code}</span> — {a.title}</span>
            <span className="shrink-0 text-xs text-slate-500">{a.score != null ? `${a.score}%` : a.status}</span>
          </Link>
        )} />
        <ComplianceList title="Findings" empty="No findings." items={data.findings} render={(f) => (
          <Link href="/cams/findings" className="flex items-center justify-between gap-2 hover:bg-slate-50">
            <span className="truncate">{f.title}</span>
            <span className={"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium " + sevChip(f.severity)}>{titleCase(f.severity)}</span>
          </Link>
        )} />
        <ComplianceList title="CAPAs" empty="No CAPAs." items={data.capas} render={(c) => (
          <Link href="/capa" className="flex items-center justify-between gap-2 hover:bg-slate-50">
            <span className="truncate"><span className="text-primary-700">{c.number}</span> — {c.title}</span>
            <span className="shrink-0 text-xs">{c.overdue ? <span className="text-rose-600">overdue</span> : <span className="text-slate-500">{titleCase(c.state ?? "")}</span>}</span>
          </Link>
        )} />
        <ComplianceList title="Statutory Obligations" empty="No obligations." items={data.obligations} render={(o) => (
          <Link href="/compliance" className="flex items-center justify-between gap-2 hover:bg-slate-50">
            <span className="truncate">{o.title}</span>
            <span className={"shrink-0 text-xs " + (o.status === "OVERDUE" ? "text-rose-600" : o.status === "COMPLIANT" ? "text-emerald-600" : "text-amber-600")}>{titleCase(o.status ?? "")}</span>
          </Link>
        )} />
      </div>
      {data.incidents.length > 0 && (
        <ComplianceList title="Incidents (12 months)" empty="" items={data.incidents} render={(i) => (
          <Link href={`/incidents/${i.id}`} className="flex items-center justify-between gap-2 hover:bg-slate-50">
            <span className="truncate"><span className="text-primary-700">{i.number}</span> — {i.type}</span>
            <span className="shrink-0 text-xs text-slate-500">{fmtDate(i.date)}</span>
          </Link>
        )} />
      )}

      {/* New IMS rollup blocks — each a live, site-scoped read from its engine.
          Order per §6: Environment → Training → Certifications → Social → Op-risk. */}
      <RollupBlock block={data.environment} periodRef={data.periodRef} />
      <RollupBlock block={data.training} periodRef={data.periodRef} />
      <RollupBlock block={data.certifications} periodRef={data.periodRef} />
      <RollupBlock block={data.socialCompliance} periodRef={data.periodRef} />
      <RollupBlock block={data.operationalRisk} periodRef={data.periodRef} />
      {data.degraded && (
        <p className="text-xs text-amber-600">Some rollup data is refreshing — showing the latest available numbers.</p>
      )}
    </div>
  );
}

function ComplianceList({ title, items, empty, render }: { title: string; items: Record<string, any>[]; empty: string; render: (x: any) => React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title} <span className="text-xs font-normal text-slate-400">({items.length})</span></h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{empty || "None."}</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm text-slate-700">
          {items.map((x, i) => (
            <li key={x.id ?? i} className="py-1.5">{render(x)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AuditTrailTab({ profile }: { profile: FactoryProfileDetail }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <dl className="space-y-2">
        <Row label="Profile ID">{profile.id}</Row>
        <Row label="Factory code">{profile.factoryCode}</Row>
        <Row label="Last reviewed">{fmtDate(profile.lastReviewedAt)}</Row>
        <Row label="Last updated">{fmtDate(profile.updatedAt)}</Row>
      </dl>
      <p className="mt-3 text-xs text-slate-400">
        The standard platform audit-trail component (full edit history) attaches here in a later phase.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Shared chip + lifecycle stepper
// ════════════════════════════════════════════════════════════════════════════
function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={"inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " + (className ?? "")}>
      {children}
    </span>
  );
}

function LifecycleStepper({ profile }: { profile: FactoryProfileDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "advance" | "revisions">(null);
  const [comment, setComment] = useState("");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");

  const stage = profile.lifecycleStage;
  const order = LIFECYCLE_STAGES;
  const idx = order.indexOf(stage);
  const nextStage = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  const canRequestRevisions = stage === "VALIDATION";

  async function act(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await mutate(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setPanel(null);
      setComment("");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Lifecycle workflow</h3>
        <span className="text-xs text-slate-400">
          Owner: {LIFECYCLE_STAGE_OWNER[stage] ?? "—"}
          {profile.lifecycleUpdatedAt ? ` · updated ${fmtDate(profile.lifecycleUpdatedAt)}` : ""}
        </span>
      </div>

      {/* stepper */}
      <div className="flex items-center gap-1">
        {order.map((s, i) => {
          const reached = idx >= 0 && i <= idx;
          const isCurrent = s === stage;
          return (
            <div key={s} className="flex flex-1 items-center">
              <div
                className={
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium " +
                  (isCurrent
                    ? LIFECYCLE_STAGE_CHIP[s]
                    : reached
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : "bg-slate-50 text-slate-400 border-slate-200")
                }
              >
                <span
                  className={
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] " +
                    (reached ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")
                  }
                >
                  {i + 1}
                </span>
                {LIFECYCLE_STAGE_LABEL[s]}
              </div>
              {i < order.length - 1 && <div className={"h-0.5 flex-1 " + (idx > i ? "bg-emerald-300" : "bg-slate-200")} />}
            </div>
          );
        })}
        {stage === "ARCHIVED" && <Chip className={LIFECYCLE_STAGE_CHIP.ARCHIVED}>Archived</Chip>}
      </div>

      <div className="mt-3">
        <ErrorNote err={err} />
      </div>

      {/* actions */}
      <Can permission="FACILITY.UPDATE">
        {!panel && (nextStage || canRequestRevisions) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {nextStage && (
              <Button
                type="button"
                size="sm"
                onClick={() => setPanel("advance")}
                disabled={busy}
              >
                Advance to {LIFECYCLE_STAGE_LABEL[nextStage]} →
              </Button>
            )}
            {canRequestRevisions && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPanel("revisions")}
                disabled={busy}
                className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
              >
                Request revisions
              </Button>
            )}
          </div>
        )}
        {panel === "advance" && nextStage && (
          <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-600">Advance to {LIFECYCLE_STAGE_LABEL[nextStage]}</div>
            <Textarea
              rows={2}
              placeholder="Comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => act(`/api/factory/profiles/${profile.id}/lifecycle/advance`, { toStage: nextStage, comment: comment || null })}
                disabled={busy}
              >
                Confirm advance
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setPanel(null); setComment(""); }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {panel === "revisions" && (
          <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs font-medium text-amber-800">Send back to Execution for fixes</div>
            <Textarea
              rows={2}
              placeholder="What needs to change? (required)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as "HIGH" | "MEDIUM" | "LOW")}
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={() => act(`/api/factory/profiles/${profile.id}/lifecycle/request-revisions`, { comment, priority, issues: [] })}
                disabled={busy || !comment.trim()}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                Request revisions
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setPanel(null); setComment(""); }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Can>

      {/* recent events */}
      {profile.lifecycleEvents.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
          {profile.lifecycleEvents.slice(0, 3).map((ev) => (
            <li key={ev.id} className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-slate-700">{LIFECYCLE_ACTION_LABEL[ev.action] ?? ev.action}</span>
              {ev.fromStage && <span className="text-slate-400">{LIFECYCLE_STAGE_LABEL[ev.fromStage] ?? ev.fromStage} →</span>}
              <span className="text-slate-600">{LIFECYCLE_STAGE_LABEL[ev.toStage] ?? ev.toStage}</span>
              <span className="text-slate-300">·</span>
              <span>{fmtDate(ev.createdAt)}</span>
              {ev.comment && <span className="max-w-md truncate italic text-slate-400">“{ev.comment}”</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Equipment tab
// ════════════════════════════════════════════════════════════════════════════
const EMPTY_EQUIPMENT: Record<string, any> = {
  equipmentName: "",
  category: "",
  manufacturer: "",
  status: "ACTIVE",
  hazardLevel: "LOW",
  capacity: "",
  capacityUnit: "",
  puwerRequired: false,
  puwerNextDue: "",
  lolerRequired: false,
  lolerNextDue: "",
  electricalSafetyRequired: false,
  electricalNextDue: "",
  noiseAssessmentRequired: false,
  noiseLastTest: "",
  notes: "",
};

function EquipmentTab({ profile }: { profile: FactoryProfileDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, any>>(EMPTY_EQUIPMENT);
  const [maintFor, setMaintFor] = useState<string | null>(null);
  const [maint, setMaint] = useState<Record<string, any>>({ maintenanceType: "", downtimeHours: "0", nextScheduledDate: "", notes: "" });
  // Trigger Inspection (Change 3).
  const [inspectFor, setInspectFor] = useState<string | null>(null);
  const [insp, setInsp] = useState<Record<string, any>>({ inspectionDate: "", inspectorName: "", result: "PASS", findings: "" });

  const rows = profile.equipment;
  const overdue = rows.filter((e) => e.complianceStatus === "OVERDUE").length;
  const attention = rows.filter((e) => e.complianceStatus === "ATTENTION").length;
  const opGaps = rows.filter((e) => e.operatorCertGapFlag).length;

  function reset() {
    setF(EMPTY_EQUIPMENT);
    setAdding(false);
  }

  async function add() {
    if (!f.equipmentName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, any> = {
        equipmentName: f.equipmentName,
        category: f.category || null,
        manufacturer: f.manufacturer || null,
        status: f.status,
        hazardLevel: f.hazardLevel,
        capacity: f.capacity ? Number(f.capacity) : null,
        capacityUnit: f.capacityUnit || null,
        puwerRequired: f.puwerRequired,
        puwerNextDue: f.puwerRequired && f.puwerNextDue ? f.puwerNextDue : null,
        lolerRequired: f.lolerRequired,
        lolerNextDue: f.lolerRequired && f.lolerNextDue ? f.lolerNextDue : null,
        electricalSafetyRequired: f.electricalSafetyRequired,
        electricalNextDue: f.electricalSafetyRequired && f.electricalNextDue ? f.electricalNextDue : null,
        noiseAssessmentRequired: f.noiseAssessmentRequired,
        noiseLastTest: f.noiseAssessmentRequired && f.noiseLastTest ? f.noiseLastTest : null,
        notes: f.notes || null,
      };
      await mutate(`/api/factory/profiles/${profile.id}/equipment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      reset();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/equipment/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveMaintenance(id: string) {
    if (!maint.maintenanceType.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/equipment/${id}/maintenance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maintenanceType: maint.maintenanceType,
          downtimeHours: Number(maint.downtimeHours) || 0,
          nextScheduledDate: maint.nextScheduledDate || null,
          notes: maint.notes || null,
        }),
      });
      setMaintFor(null);
      setMaint({ maintenanceType: "", downtimeHours: "0", nextScheduledDate: "", notes: "" });
      toast({ variant: "success", title: "Maintenance recorded", description: maint.maintenanceType });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function openInspect(id: string) {
    setErr(null);
    setInspectFor(inspectFor === id ? null : id);
    // Default the inspection date to today + pre-fill the inspector with the
    // logged-in user's name (build-spec §Change 3).
    setInsp({
      inspectionDate: new Date().toISOString().slice(0, 10),
      inspectorName: (session?.user as any)?.name ?? "",
      result: "PASS",
      findings: "",
    });
  }

  async function saveInspection(id: string) {
    if (!insp.inspectorName.trim()) {
      setErr("Inspector name is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/equipment/${id}/inspections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inspectionDate: insp.inspectionDate || null,
          inspectorName: insp.inspectorName.trim(),
          result: insp.result,
          findings: insp.findings.trim() || null,
        }),
      });
      setInspectFor(null);
      toast({ variant: "success", title: "Inspection recorded", description: `Result: ${insp.result.replace("_", " ")}` });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Inspection failed");
      toast({ variant: "error", title: "Inspection failed", description: e?.message ?? "Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const text = (k: string, label: string, ph = "") => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <Input placeholder={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  const regime = (reqKey: string, dateKey: string, label: string, dateLabel: string) => (
    <div className="rounded-lg border border-slate-200 p-2">
      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <Checkbox checked={f[reqKey]} onChange={(e) => setF({ ...f, [reqKey]: e.target.checked })} /> {label}
      </label>
      {f[reqKey] && (
        <div className="mt-1.5">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">{dateLabel}</label>
          <Input type="date" value={f[dateKey]} onChange={(e) => setF({ ...f, [dateKey]: e.target.value })} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <ErrorNote err={err} />

      <div className="flex flex-wrap items-center gap-2">
        <Chip className="bg-slate-100 text-slate-600 border-slate-200">{fmtNum(rows.length)} assets</Chip>
        {overdue > 0 && <Chip className={RAG_CHIP.OVERDUE}>{overdue} overdue inspection{overdue > 1 ? "s" : ""}</Chip>}
        {attention > 0 && <Chip className={RAG_CHIP.ATTENTION}>{attention} due soon</Chip>}
        {opGaps > 0 && <Chip className="bg-rose-100 text-rose-800 border-rose-200">{opGaps} operator-cert gap{opGaps > 1 ? "s" : ""}</Chip>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead>Equipment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Hazard</TableHead>
              <TableHead>Compliance</TableHead>
              <TableHead>Next due</TableHead>
              <TableHead>Last maint.</TableHead>
              <Can permission="FACILITY.UPDATE"><TableHead className="text-right">Actions</TableHead></Can>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-400">No equipment recorded yet.</TableCell></TableRow>
            ) : (
              rows.map((e) => (
                <TableRow key={e.id} className="align-top">
                  <TableCell>
                    <div className="font-medium text-slate-700">{e.equipmentName}</div>
                    <div className="text-xs text-slate-400">
                      {[e.category, e.manufacturer].filter(Boolean).join(" · ") || "—"}
                      {e.capacity != null ? ` · ${fmtNum(e.capacity)} ${e.capacityUnit ?? ""}` : ""}
                    </div>
                  </TableCell>
                  <TableCell><Chip className={EQUIPMENT_STATUS_CHIP[e.status]}>{titleCase(e.status)}</Chip></TableCell>
                  <TableCell>
                    <Chip className={HAZARD_LEVEL_CHIP[e.hazardLevel]}>{titleCase(e.hazardLevel)}</Chip>
                    {e.operatorCertGapFlag && <div className="mt-1 text-[10px] text-rose-600">operator cert gap</div>}
                  </TableCell>
                  <TableCell>
                    <Chip className={RAG_CHIP[e.complianceStatus]}>{EQUIPMENT_COMPLIANCE_LABEL[e.complianceStatus]}</Chip>
                    {e.overdueRegimes.length > 0 && <div className="mt-1 text-[10px] text-rose-600">{e.overdueRegimes.join(", ")}</div>}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{fmtDate(e.nextComplianceDue)}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {fmtDate(e.lastMaintenanceDate)}
                    {e.downtimeHoursYtd > 0 && <div className="text-[10px] text-slate-400">{fmtNum(e.downtimeHoursYtd)}h downtime YTD</div>}
                  </TableCell>
                  <Can permission="FACILITY.UPDATE">
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => openInspect(e.id)} className="h-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:underline"><ClipboardCheck size={13} /> Trigger Inspection</Button>
                        <Button type="button" variant="ghost" onClick={() => { setMaintFor(maintFor === e.id ? null : e.id); }} className="h-auto text-[11px] font-medium text-slate-500 hover:underline">Log maint.</Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(e.id)} disabled={busy} className="h-auto w-auto text-slate-400 hover:text-rose-600 disabled:opacity-40"><Trash2 size={16} /></Button>
                      </div>
                      {maintFor === e.id && (
                        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-left">
                          <Input placeholder="Maintenance type (e.g. Preventive)" value={maint.maintenanceType} onChange={(ev) => setMaint({ ...maint, maintenanceType: ev.target.value })} />
                          <div className="flex gap-2">
                            <Input type="number" min={0} className="w-24" placeholder="Downtime h" value={maint.downtimeHours} onChange={(ev) => setMaint({ ...maint, downtimeHours: ev.target.value })} />
                            <Input type="date" className="flex-1" value={maint.nextScheduledDate} onChange={(ev) => setMaint({ ...maint, nextScheduledDate: ev.target.value })} />
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" onClick={() => saveMaintenance(e.id)} disabled={busy || !maint.maintenanceType.trim()}>Save</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setMaintFor(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                      {inspectFor === e.id && (
                        <div className="mt-2 w-72 space-y-2 rounded-lg border border-primary-200 bg-primary-50/50 p-2.5 text-left">
                          {/* Read-only equipment context */}
                          <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-500">
                            <div className="mb-0.5 font-semibold text-slate-700">{e.equipmentName}</div>
                            <div className="flex justify-between"><span>Status</span><span className="font-medium text-slate-700">{titleCase(e.status)}</span></div>
                            <div className="flex justify-between"><span>Last maintenance</span><span className="font-medium text-slate-700">{fmtDate(e.lastMaintenanceDate)}</span></div>
                            <div className="flex justify-between"><span>Next due</span><span className="font-medium text-slate-700">{fmtDate(e.nextComplianceDue)}</span></div>
                          </div>
                          {/* Inspection input */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-400">Inspection date</label>
                              <Input type="date" value={insp.inspectionDate} onChange={(ev) => setInsp({ ...insp, inspectionDate: ev.target.value })} />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-400">Result</label>
                              <Select value={insp.result} onChange={(ev) => setInsp({ ...insp, result: ev.target.value })}>
                                <option value="PASS">Pass</option>
                                <option value="CONDITIONAL_PASS">Conditional Pass</option>
                                <option value="FAIL">Fail</option>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-400">Inspector name</label>
                            <Input placeholder="Inspector" value={insp.inspectorName} onChange={(ev) => setInsp({ ...insp, inspectorName: ev.target.value })} />
                          </div>
                          <Textarea rows={2} placeholder="Findings / remarks (optional)" value={insp.findings} onChange={(ev) => setInsp({ ...insp, findings: ev.target.value })} />
                          <div className="flex gap-2">
                            <Button type="button" size="sm" onClick={() => saveInspection(e.id)} disabled={busy || !insp.inspectorName.trim()}>Record inspection</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setInspectFor(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </Can>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Can permission="FACILITY.UPDATE">
        {adding ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {text("equipmentName", "Equipment name", "Boiler #2")}
              {text("category", "Category", "Utility")}
              {text("manufacturer", "Manufacturer")}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
                <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                  {EQUIPMENT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Hazard level</label>
                <Select value={f.hazardLevel} onChange={(e) => setF({ ...f, hazardLevel: e.target.value })}>
                  {HAZARD_LEVELS.map((h) => <option key={h} value={h}>{titleCase(h)}</option>)}
                </Select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">{text("capacity", "Capacity")}</div>
                <div className="flex-1">{text("capacityUnit", "Unit", "TPH")}</div>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-400">Statutory inspection regimes</div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {regime("puwerRequired", "puwerNextDue", "PUWER", "Next due")}
                {regime("lolerRequired", "lolerNextDue", "LOLER", "Next due")}
                {regime("electricalSafetyRequired", "electricalNextDue", "Electrical", "Next due")}
                {regime("noiseAssessmentRequired", "noiseLastTest", "Noise", "Last test")}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={add} disabled={busy || !f.equipmentName.trim()}>Save equipment</Button>
              <Button type="button" variant="outline" onClick={reset} disabled={busy}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add equipment
          </Button>
        )}
      </Can>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Hazmat tab
// ════════════════════════════════════════════════════════════════════════════
const EMPTY_HAZMAT: Record<string, any> = {
  chemicalName: "",
  casNumber: "",
  hazmatClassification: "LOW",
  ghsSignalWord: "WARNING",
  quantityStored: "",
  unit: "L",
  maxAllowableQty: "",
  storageBuilding: "",
  storageRoom: "",
  secondaryContainmentPresent: false,
  secondaryContainmentVolume: "",
  issueDate: "",
  expiryDate: "",
  sdsDocId: "",
  handlersTrainedCount: "",
  handlersTotalCount: "",
  pcbRegistrationStatus: "NOT_REGISTERED",
  notes: "",
};

function HazmatTab({ profile }: { profile: FactoryProfileDetail }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, any>>(EMPTY_HAZMAT);

  const rows = profile.hazardousMaterials;
  const expiring = rows.filter((h) => h.shelfLifeStatus === "EXPIRING_SOON" || h.shelfLifeStatus === "EXPIRED").length;
  const overCap = rows.filter((h) => h.overCapacity).length;
  const contIssues = rows.filter((h) => h.containmentOk === false).length;
  const sdsGaps = rows.filter((h) => h.sdsMissingFlag).length;

  function reset() {
    setF(EMPTY_HAZMAT);
    setAdding(false);
  }

  async function add() {
    if (!f.chemicalName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, any> = {
        chemicalName: f.chemicalName,
        casNumber: f.casNumber || null,
        hazmatClassification: f.hazmatClassification,
        ghsSignalWord: f.ghsSignalWord || null,
        quantityStored: f.quantityStored ? Number(f.quantityStored) : 0,
        unit: f.unit || null,
        maxAllowableQty: f.maxAllowableQty ? Number(f.maxAllowableQty) : null,
        storageBuilding: f.storageBuilding || null,
        storageRoom: f.storageRoom || null,
        secondaryContainmentPresent: f.secondaryContainmentPresent,
        secondaryContainmentVolume: f.secondaryContainmentPresent && f.secondaryContainmentVolume ? Number(f.secondaryContainmentVolume) : null,
        issueDate: f.issueDate || null,
        expiryDate: f.expiryDate || null,
        sdsDocId: f.sdsDocId || null,
        sdsGhsCompliant: !!f.sdsDocId,
        handlersTrainedCount: f.handlersTrainedCount ? Number(f.handlersTrainedCount) : 0,
        handlersTotalCount: f.handlersTotalCount ? Number(f.handlersTotalCount) : 0,
        pcbRegistrationStatus: f.pcbRegistrationStatus,
        notes: f.notes || null,
      };
      await mutate(`/api/factory/profiles/${profile.id}/hazmat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      reset();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/hazmat/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const text = (k: string, label: string, ph = "") => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <Input placeholder={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-4">
      <ErrorNote err={err} />

      <div className="flex flex-wrap items-center gap-2">
        <Chip className="bg-slate-100 text-slate-600 border-slate-200">{fmtNum(rows.length)} chemicals</Chip>
        {expiring > 0 && <Chip className={SHELF_LIFE_CHIP.EXPIRING_SOON}>{expiring} expiring / expired</Chip>}
        {overCap > 0 && <Chip className="bg-rose-100 text-rose-800 border-rose-200">{overCap} over max qty</Chip>}
        {contIssues > 0 && <Chip className="bg-rose-100 text-rose-800 border-rose-200">{contIssues} containment shortfall</Chip>}
        {sdsGaps > 0 && <Chip className="bg-rose-100 text-rose-800 border-rose-200">{sdsGaps} SDS missing</Chip>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table className="min-w-[920px]">
          <TableHeader>
            <TableRow>
              <TableHead>Chemical</TableHead>
              <TableHead>Class / GHS</TableHead>
              <TableHead className="text-right">Qty / max</TableHead>
              <TableHead>Shelf life</TableHead>
              <TableHead>Containment</TableHead>
              <TableHead>Training</TableHead>
              <Can permission="FACILITY.UPDATE"><TableHead></TableHead></Can>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-400">No hazardous materials recorded yet.</TableCell></TableRow>
            ) : (
              rows.map((h) => (
                <TableRow key={h.id} className="align-top">
                  <TableCell>
                    <div className="font-medium text-slate-700">{h.chemicalName}</div>
                    <div className="text-xs text-slate-400">
                      {h.casNumber ? `CAS ${h.casNumber}` : "—"}
                      {[h.storageBuilding, h.storageRoom].filter(Boolean).length > 0 ? ` · ${[h.storageBuilding, h.storageRoom].filter(Boolean).join("/")}` : ""}
                    </div>
                    {h.sdsMissingFlag && <div className="mt-1 text-[10px] text-rose-600">SDS missing (high hazard)</div>}
                  </TableCell>
                  <TableCell>
                    <Chip className={HAZMAT_CLASS_CHIP[h.hazmatClassification]}>{titleCase(h.hazmatClassification)}</Chip>
                    {h.ghsSignalWord && h.ghsSignalWord !== "NONE" && <div className="mt-1"><Chip className={GHS_SIGNAL_CHIP[h.ghsSignalWord] ?? GHS_SIGNAL_CHIP.NONE}>{titleCase(h.ghsSignalWord)}</Chip></div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNum(h.quantityStored)} {h.unit ?? ""}
                    {h.maxAllowableQty != null && <div className="text-[10px] text-slate-400">/ {fmtNum(h.maxAllowableQty)} {h.utilisationPct != null ? `· ${h.utilisationPct}%` : ""}</div>}
                    {h.overCapacity && <div className="text-[10px] font-semibold text-rose-600">over capacity</div>}
                  </TableCell>
                  <TableCell>
                    <Chip className={SHELF_LIFE_CHIP[h.shelfLifeStatus]}>{h.shelfLifeStatus === "NA" ? "N/A" : titleCase(h.shelfLifeStatus.replace("_", " "))}</Chip>
                    {h.daysToExpiry != null && <div className="mt-0.5 text-[10px] text-slate-400">{h.daysToExpiry}d</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {!h.secondaryContainmentPresent ? (
                      <span className="text-slate-400">none</span>
                    ) : h.containmentOk ? (
                      <span className="text-emerald-700">OK</span>
                    ) : (
                      <span className="font-semibold text-rose-600">&lt; 110%</span>
                    )}
                  </TableCell>
                  <TableCell><Chip className={TRAINING_STATUS_CHIP[h.trainingStatus]}>{h.handlersTrainedCount}/{h.handlersTotalCount}</Chip></TableCell>
                  <Can permission="FACILITY.UPDATE">
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(h.id)} disabled={busy} className="h-auto w-auto text-slate-400 hover:text-rose-600 disabled:opacity-40"><Trash2 size={16} /></Button>
                    </TableCell>
                  </Can>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Can permission="FACILITY.UPDATE">
        {adding ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {text("chemicalName", "Chemical name", "Sodium hydroxide")}
              {text("casNumber", "CAS number", "1310-73-2")}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Hazmat class</label>
                <Select value={f.hazmatClassification} onChange={(e) => setF({ ...f, hazmatClassification: e.target.value })}>
                  {HAZMAT_CLASSES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">GHS signal</label>
                <Select value={f.ghsSignalWord} onChange={(e) => setF({ ...f, ghsSignalWord: e.target.value })}>
                  {GHS_SIGNAL_WORDS.map((g) => <option key={g} value={g}>{titleCase(g)}</option>)}
                </Select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">{text("quantityStored", "Quantity")}</div>
                <div className="w-20">{text("unit", "Unit")}</div>
              </div>
              {text("maxAllowableQty", "Max allowable")}
              {text("storageBuilding", "Storage building")}
              {text("storageRoom", "Storage room")}
              {text("sdsDocId", "SDS document ref")}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Issue date</label>
                <Input type="date" value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Expiry date</label>
                <Input type="date" value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">{text("handlersTrainedCount", "Handlers trained")}</div>
                <div className="flex-1">{text("handlersTotalCount", "Handlers total")}</div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">PCB registration</label>
                <Select value={f.pcbRegistrationStatus} onChange={(e) => setF({ ...f, pcbRegistrationStatus: e.target.value })}>
                  {PCB_STATUSES.map((p) => <option key={p} value={p}>{titleCase(p.replace("_", " "))}</option>)}
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <Checkbox checked={f.secondaryContainmentPresent} onChange={(e) => setF({ ...f, secondaryContainmentPresent: e.target.checked })} /> Secondary containment present
              {f.secondaryContainmentPresent && (
                <Input className="ml-2 w-32" placeholder="Volume (≥110%)" value={f.secondaryContainmentVolume} onChange={(e) => setF({ ...f, secondaryContainmentVolume: e.target.value })} />
              )}
            </label>
            <div className="flex gap-2">
              <Button type="button" onClick={add} disabled={busy || !f.chemicalName.trim()}>Save chemical</Button>
              <Button type="button" variant="outline" onClick={reset} disabled={busy}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add hazardous material
          </Button>
        )}
      </Can>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Regulatory tab
// ════════════════════════════════════════════════════════════════════════════
const EMPTY_REG: Record<string, any> = {
  registrationType: "FACTORY_ACT",
  registrationName: "",
  registrationNumber: "",
  issuingAuthority: "",
  issueDate: "",
  expiryDate: "",
  renewalFrequency: "ANNUAL",
  alertThresholdDays: "90",
  complianceImpactIfExpired: "MEDIUM",
  renewalInProgress: false,
  renewalAgencyContact: "",
  renewalNotes: "",
};

function RegulatoryTab({ profile }: { profile: FactoryProfileDetail }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, any>>(EMPTY_REG);
  const [renewFor, setRenewFor] = useState<string | null>(null);
  const [renew, setRenew] = useState<Record<string, any>>({ newExpiryDate: "", renewalCost: "", notes: "" });
  // Which licence's document drawer is open. One at a time — each drawer loads
  // its own attachment list, so opening every row at once would be a burst of
  // requests for documents nobody is looking at.
  const [docsFor, setDocsFor] = useState<string | null>(null);
  const canEdit = usePermission("FACILITY.UPDATE");

  const rows = profile.regulatoryRegistrations;
  const expired = rows.filter((r) => r.status === "EXPIRED").length;
  const expiring = rows.filter((r) => r.status === "EXPIRING_SOON").length;
  const pending = rows.filter((r) => r.status === "PENDING_RENEWAL").length;

  function reset() {
    setF(EMPTY_REG);
    setAdding(false);
  }

  async function add() {
    if (!f.registrationName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, any> = {
        registrationType: f.registrationType,
        registrationName: f.registrationName,
        registrationNumber: f.registrationNumber || null,
        issuingAuthority: f.issuingAuthority || null,
        issueDate: f.issueDate || null,
        expiryDate: f.expiryDate || null,
        renewalFrequency: f.renewalFrequency,
        alertThresholdDays: Number(f.alertThresholdDays) || 90,
        complianceImpactIfExpired: f.complianceImpactIfExpired,
        renewalInProgress: f.renewalInProgress,
        renewalAgencyContact: f.renewalAgencyContact || null,
        renewalNotes: f.renewalNotes || null,
      };
      await mutate(`/api/factory/profiles/${profile.id}/regulatory`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      reset();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/regulatory/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function markRenewed(id: string) {
    if (!renew.newExpiryDate) return;
    setBusy(true);
    setErr(null);
    try {
      await mutate(`/api/factory/regulatory/${id}/mark-renewed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          newExpiryDate: renew.newExpiryDate,
          renewalCost: renew.renewalCost ? Number(renew.renewalCost) : null,
          notes: renew.notes || null,
        }),
      });
      setRenewFor(null);
      setRenew({ newExpiryDate: "", renewalCost: "", notes: "" });
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Renewal failed");
    } finally {
      setBusy(false);
    }
  }

  const text = (k: string, label: string, ph = "") => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <Input placeholder={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-4">
      <ErrorNote err={err} />

      <div className="flex flex-wrap items-center gap-2">
        <Chip className="bg-slate-100 text-slate-600 border-slate-200">{fmtNum(rows.length)} licences &amp; registrations</Chip>
        {expired > 0 && <Chip className={REG_STATUS_CHIP.EXPIRED}>{expired} expired</Chip>}
        {expiring > 0 && <Chip className={REG_STATUS_CHIP.EXPIRING_SOON}>{expiring} expiring soon</Chip>}
        {pending > 0 && <Chip className={REG_STATUS_CHIP.PENDING_RENEWAL}>{pending} renewal in progress</Chip>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table className="min-w-[880px]">
          <TableHeader>
            <TableRow>
              <TableHead>Registration</TableHead>
              <TableHead>Authority</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Impact</TableHead>
              <Can permission="FACILITY.UPDATE"><TableHead className="text-right">Actions</TableHead></Can>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-slate-400">No licences or registrations recorded yet.</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                <TableRow className="align-top">
                  <TableCell>
                    <div className="font-medium text-slate-700">{REGISTRATION_TYPE_LABEL[r.registrationType] ?? r.registrationType}</div>
                    <div className="text-xs text-slate-400">{r.registrationName}{r.registrationNumber ? ` · ${r.registrationNumber}` : ""}</div>
                    <div className="text-[10px] text-slate-400">{RENEWAL_FREQUENCY_LABEL[r.renewalFrequency] ?? r.renewalFrequency}</div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{r.issuingAuthority ?? "—"}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {fmtDate(r.expiryDate)}
                    {r.daysToExpiry != null && <div className={"text-[10px] " + (r.daysToExpiry < 0 ? "text-rose-600" : "text-slate-400")}>{r.daysToExpiry < 0 ? `${-r.daysToExpiry}d overdue` : `${r.daysToExpiry}d left`}</div>}
                  </TableCell>
                  <TableCell><Chip className={REG_STATUS_CHIP[r.status]}>{titleCase(r.status.replace(/_/g, " "))}</Chip></TableCell>
                  <TableCell><Chip className={IMPACT_CHIP[r.complianceImpactIfExpired]}>{titleCase(r.complianceImpactIfExpired)}</Chip></TableCell>
                  <Can permission="FACILITY.UPDATE">
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setDocsFor(docsFor === r.id ? null : r.id)} className="h-auto gap-1 text-[11px] font-medium text-primary-700 hover:underline"><Paperclip size={12} /> Documents</Button>
                        <Button type="button" variant="ghost" onClick={() => setRenewFor(renewFor === r.id ? null : r.id)} className="h-auto text-[11px] font-medium text-primary-700 hover:underline">Mark renewed</Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(r.id)} disabled={busy} className="h-auto w-auto text-slate-400 hover:text-rose-600 disabled:opacity-40"><Trash2 size={16} /></Button>
                      </div>
                      {renewFor === r.id && (
                        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-left">
                          <div>
                            <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">New expiry</label>
                            <Input type="date" value={renew.newExpiryDate} onChange={(ev) => setRenew({ ...renew, newExpiryDate: ev.target.value })} />
                          </div>
                          <Input placeholder="Renewal cost (optional)" value={renew.renewalCost} onChange={(ev) => setRenew({ ...renew, renewalCost: ev.target.value })} />
                          <div className="flex gap-2">
                            <Button type="button" size="sm" onClick={() => markRenewed(r.id)} disabled={busy || !renew.newExpiryDate}>Save</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setRenewFor(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </Can>
                </TableRow>
                {/* Licence documents — the statutory approval itself, stored
                    against the licence rather than in a shared drive. Uses the
                    platform-wide evidence store: signed-URL upload, permissioned
                    download, soft delete. No slotKey, because this drawer holds
                    several kinds of document at once (the licence, its renewal
                    application, the inspection report) and a shared slot would
                    make each new upload supersede an unrelated file. */}
                {docsFor === r.id && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-slate-50/60 p-3">
                      <EvidenceAttachment
                        entityType="factory_registration"
                        entityId={r.id}
                        canManage={canEdit}
                        title={`${REGISTRATION_TYPE_LABEL[r.registrationType] ?? r.registrationType} — documents`}
                        help="The licence / certificate / consent as issued, plus renewal applications and inspection reports. PDF or image, up to 25 MB."
                        categories={[
                          { value: "LICENSE", label: "Licence" },
                          { value: "CERTIFICATE", label: "Certificate" },
                          { value: "CONSENT", label: "Consent order" },
                          { value: "RENEWAL_APPLICATION", label: "Renewal application" },
                          { value: "INSPECTION_REPORT", label: "Inspection report" },
                          { value: "CORRESPONDENCE", label: "Correspondence" },
                          { value: "OTHER", label: "Other" },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Can permission="FACILITY.UPDATE">
        {adding ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
                <Select value={f.registrationType} onChange={(e) => setF({ ...f, registrationType: e.target.value })}>
                  {REGISTRATION_TYPES.map((t) => <option key={t} value={t}>{REGISTRATION_TYPE_LABEL[t]}</option>)}
                </Select>
              </div>
              {text("registrationName", "Name / description", "Structural Stability Certificate — Block A")}
              {text("registrationNumber", "Number")}
              {text("issuingAuthority", "Issuing authority")}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Issue date</label>
                <Input type="date" value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Expiry date</label>
                <Input type="date" value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Renewal frequency</label>
                <Select value={f.renewalFrequency} onChange={(e) => setF({ ...f, renewalFrequency: e.target.value })}>
                  {RENEWAL_FREQUENCIES.map((r) => <option key={r} value={r}>{RENEWAL_FREQUENCY_LABEL[r]}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Alert threshold (days)</label>
                <Input type="number" min={0} value={f.alertThresholdDays} onChange={(e) => setF({ ...f, alertThresholdDays: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Impact if expired</label>
                <Select value={f.complianceImpactIfExpired} onChange={(e) => setF({ ...f, complianceImpactIfExpired: e.target.value })}>
                  {COMPLIANCE_IMPACTS.map((i) => <option key={i} value={i}>{titleCase(i)}</option>)}
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <Checkbox checked={f.renewalInProgress} onChange={(e) => setF({ ...f, renewalInProgress: e.target.checked })} /> Renewal currently in progress
            </label>
            <div className="flex gap-2">
              <Button type="button" onClick={add} disabled={busy || !f.registrationName.trim()}>Save registration</Button>
              <Button type="button" variant="outline" onClick={reset} disabled={busy}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add registration
          </Button>
        )}
      </Can>
    </div>
  );
}
