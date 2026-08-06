// Shared types + presentation helpers for the Chemical / Hazmat module.
//
// The API is the source of truth for shape; these mirror it. Kept in one file
// so the eight screens agree on what a hazard-class chip looks like — a hazard
// classification rendered differently on the register and the storage map is a
// hazard classification people stop trusting.

export type ChemicalStatus = "PENDING_SDS" | "ACTIVE" | "INACTIVE" | "RESTRICTED";
export type InventoryStatus = "IN_STOCK" | "LOW" | "EXPIRED" | "DISPOSED";
export type ThresholdStatus = "BELOW" | "APPROACHING" | "BREACHED";
export type TriggerStatus = "FIRED" | "FAILED" | "SKIPPED";

export type Chemical = {
  id: string;
  name: string;
  commonName: string | null;
  casNumber: string | null;
  unNumber: string | null;
  hazardClasses: string[];
  physicalState: "SOLID" | "LIQUID" | "GAS";
  flashPointCelsius: number | null;
  boilingPointCelsius: number | null;
  nfpa: { health: number | null; flammability: number | null; reactivity: number | null; special: string | null };
  hazardClassificationSource: string;
  sdsAttachmentId: string | null;
  sdsRevisionDate: string | null;
  sdsReviewDueDate: string | null;
  sdsReviewOverdue: boolean;
  status: ChemicalStatus;
  restrictionReason: string | null;
  regulatoryReference: string | null;
  approvedAt: string | null;
};

export type InventoryItem = {
  id: string;
  chemicalId: string;
  chemicalName: string | null;
  hazardClasses: string[];
  plantId: string;
  storageLocationId: string | null;
  storageLocationName: string | null;
  batchLotNumber: string;
  quantity: number;
  unit: string;
  currentStatus: InventoryStatus;
  lowStockThreshold: number | null;
  receiptDate: string | null;
  expiryDate: string | null;
  supplierName: string | null;
};

export type StorageLocation = {
  id: string;
  plantId: string;
  zoneId: string | null;
  code: string;
  name: string;
  storageType: string;
  maxCapacity: number | null;
  capacityUnit: string | null;
  currentOccupancy: number;
  ventilated: boolean;
  bunded: boolean;
  temperatureControlled: boolean;
  itemCount: number;
  items: InventoryItem[];
};

export type ThresholdRow = {
  ruleId: string;
  scheduleReference: string;
  hazardClass: string | null;
  chemicalId: string | null;
  triggerObligation: string;
  autoMocOnBreach: boolean;
  currentQuantity: number;
  thresholdQuantity: number;
  unit: string;
  status: ThresholdStatus;
  percentOfThreshold: number | null;
  activeMocId?: string | null;
  lastEvaluatedAt?: string | null;
  lastBreachedAt?: string | null;
  evaluationCaveat?: string | null;
  contributors?: { chemicalId: string; chemicalName: string; quantity: number; unit: string }[];
};

export type TriggerLogEntry = {
  id: string;
  triggeredAt: string;
  triggerType: string;
  plantId: string | null;
  sourceEntityType: string | null;
  sourceEntityId: string;
  mocId: string | null;
  mocNumber: string | null;
  status: TriggerStatus;
  reason: string | null;
  failureReason: string | null;
  scheduleReference: string | null;
  observedQuantity: number | null;
  thresholdQuantity: number | null;
  unit: string | null;
  acknowledgedByUserId: string | null;
  acknowledgedAt: string | null;
};

export type DisposalRow = {
  id: string;
  plantId: string;
  chemicalId: string;
  chemicalName: string;
  quantity: number;
  unit: string;
  disposalDate: string;
  manifestReference: string;
  disposalVendor: string;
  vendorAuthorisationNo: string | null;
  wasteCategory: string | null;
  disposalMethod: string | null;
  manifestAttachmentId: string | null;
  eaiEntryId: string | null;
};

export type ChemicalDashboard = {
  sdsOverdue: { count: number; items: { id: string; name: string; dueDate: string | null }[] };
  sdsExpiringSoon: { count: number; items: { id: string; name: string; dueDate: string | null }[] };
  thresholds: {
    breached: number;
    approaching: number;
    items: {
      plantId: string;
      scheduleReference: string;
      hazardClass: string | null;
      status: ThresholdStatus;
      currentQuantity: number;
      thresholdQuantity: number;
      unit: string;
      activeMocId: string | null;
    }[];
  };
  failedTriggers: { count: number; items: TriggerLogEntry[] };
  pendingStorageOverrides: number;
};

// ── presentation ──────────────────────────────────────────────────────────────

/** Hazard-class chip colours. Deliberately conventional (GHS/NFPA-adjacent):
 *  red for fire, orange for oxidiser, purple for health, so someone who has
 *  read a placard can read this table. */
export const HAZARD_TONE: Record<string, string> = {
  FLAMMABLE: "bg-rose-50 text-rose-700 border-rose-200",
  PYROPHORIC: "bg-rose-100 text-rose-800 border-rose-300",
  EXPLOSIVE: "bg-orange-100 text-orange-800 border-orange-300",
  OXIDIZER: "bg-amber-50 text-amber-800 border-amber-200",
  REACTIVE: "bg-amber-100 text-amber-900 border-amber-300",
  WATER_REACTIVE: "bg-sky-50 text-sky-800 border-sky-200",
  CORROSIVE: "bg-lime-50 text-lime-800 border-lime-200",
  TOXIC: "bg-purple-50 text-purple-700 border-purple-200",
  CARCINOGEN: "bg-purple-100 text-purple-900 border-purple-300",
  COMPRESSED_GAS: "bg-cyan-50 text-cyan-800 border-cyan-200",
  ENVIRONMENTAL_HAZARD: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IRRITANT: "bg-slate-100 text-slate-700 border-slate-300",
};

export function hazardTone(cls: string): string {
  return HAZARD_TONE[cls] ?? "bg-slate-100 text-slate-700 border-slate-300";
}

export const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING_SDS: "bg-amber-50 text-amber-800 border-amber-200",
  RESTRICTED: "bg-rose-50 text-rose-700 border-rose-200",
  INACTIVE: "bg-slate-100 text-slate-600 border-slate-300",
  IN_STOCK: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOW: "bg-amber-50 text-amber-800 border-amber-200",
  EXPIRED: "bg-rose-50 text-rose-700 border-rose-200",
  DISPOSED: "bg-slate-100 text-slate-600 border-slate-300",
  BELOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  APPROACHING: "bg-amber-50 text-amber-800 border-amber-200",
  BREACHED: "bg-rose-50 text-rose-700 border-rose-200",
  FIRED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200",
  SKIPPED: "bg-slate-100 text-slate-600 border-slate-300",
};

export function statusTone(s: string): string {
  return STATUS_TONE[s] ?? "bg-slate-100 text-slate-700 border-slate-300";
}

export function prettyLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function fmtQty(n: number | null | undefined, unit?: string | null): string {
  if (n === null || n === undefined) return "—";
  const s = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${s} ${unit}` : s;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.round((d - Date.now()) / 86_400_000);
}
