// Facilities module — shared types + chip maps.
// Mirrors app/schemas/factory.py (the API contract). camelCase throughout.

export type FactoryStatus =
  | "OPERATIONAL"
  | "UNDER_CONSTRUCTION"
  | "PARTIAL_OPERATION"
  | "SHUTDOWN"
  | "DECOMMISSIONED";

export type OwnershipType = "OWNED" | "LEASED" | "CONTRACT_MANUFACTURING" | "JOINT_VENTURE";
export type ProfileStatus = "DRAFT" | "ACTIVE" | "REVIEW_DUE";

export type BuildingType =
  | "PRODUCTION"
  | "WAREHOUSE"
  | "ADMIN_OFFICE"
  | "UTILITY"
  | "CANTEEN"
  | "DORMITORY"
  | "ETP_PLANT"
  | "BOILER_HOUSE"
  | "STORE"
  | "OTHER";

export type RegistrationNo = { type: string; number: string };

export type FactoryProfile = {
  id: string;
  siteId: string;
  siteName: string | null;
  factoryCode: string;
  factoryName: string;
  status: FactoryStatus;
  ownershipType: OwnershipType;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  establishedYear: number | null;
  factoryLicenseNo: string | null;
  factoryLicenseValidUntil: string | null;
  registrationNos: RegistrationNo[];
  applicableActs: string[];
  pollutionControlBoard: string | null;
  totalLandAreaSqm: number | null;
  builtUpAreaSqm: number | null;
  buildingCount: number;
  totalEmployees: number;
  primaryIndustry: string;
  profileStatus: ProfileStatus;
  lastReviewedAt: string | null;
  nextReviewDate: string | null;
  // lifecycle workflow (governance approval state)
  lifecycleStage: LifecycleStage;
  lifecycleStageOwnerRole: string | null;
  lifecycleUpdatedAt: string | null;
  certCount: number;
  certsExpiringCount: number;
  metrics: SnapshotMetrics | null;
  updatedAt: string | null;
};

export type Building = {
  id: string;
  factoryProfileId: string;
  siteId: string;
  buildingName: string;
  buildingType: BuildingType;
  floors: number;
  areaSqm: number | null;
  maxOccupancy: number | null;
  currentOccupancy: number | null;
  yearBuilt: number | null;
  assemblyPoint: string | null;
  emergencyExits: number | null;
  occupancyCertificateNo: string | null;
  isActive: boolean;
  updatedAt: string | null;
};

export type WorkforceComposition = {
  id: string;
  factoryProfileId: string;
  siteId: string;
  asOfDate: string;
  isCurrent: boolean;
  permanentCount: number;
  contractCount: number;
  apprenticeTraineeCount: number;
  maleCount: number;
  femaleCount: number;
  otherGenderCount: number;
  migrantWorkerCount: number | null;
  differentlyAbledCount: number | null;
  totalCount: number;
  // child-labour evidence (SA8000 Element 1)
  youngestWorkerAge: number | null;
  workersUnder18Count: number;
  minHiringAgePolicy: number | null;
  // derived (persisted)
  contractPct: number;
  femalePct: number;
  migrantPct: number | null;
  // computed enrichment
  genderTotal: number;
  genderMismatch: boolean;
  childLabourFlag: boolean;
  notes: string | null;
  updatedAt: string | null;
};

// SA8000 social-compliance flag — used across the social-compliance profile,
// the W-01 register chips, and the exports.
export type ComplianceFlag = "COMPLIANT" | "ATTENTION" | "NON_COMPLIANT" | "NOT_ASSESSED";

export type SocialComplianceProfile = {
  id: string;
  factoryProfileId: string;
  siteId: string;
  asOfDate: string;
  minimumWageCompliant: ComplianceFlag;
  lowestMonthlyWageInr: number | null;
  statutoryMinimumWageInr: number | null;
  wagesPaidOnTime: ComplianceFlag;
  standardWeeklyHours: number | null;
  maxWeeklyOvertimeHours: number | null;
  overtimeVoluntary: ComplianceFlag;
  weeklyRestDayProvided: ComplianceFlag;
  unionOrWorkerCommitteePresent: ComplianceFlag;
  collectiveBargainingAgreement: boolean;
  noDepositOrDocumentRetention: ComplianceFlag;
  grievanceMechanismPresent: ComplianceFlag;
  antiDiscriminationPolicy: ComplianceFlag;
  sa8000AwarenessTrainingPct: number | null;
  socialComplianceOwnerId: string | null;
  lastSocialAuditDate: string | null;
  nextReviewDate: string | null;
  overallSocialComplianceFlag: ComplianceFlag;
  updatedAt: string | null;
};

export type ProductionProcess = {
  id: string;
  factoryProfileId: string;
  siteId: string;
  processName: string;
  processCategory: string | null;
  description: string | null;
  sequenceOrder: number | null;
  shiftPattern: string | null;
  installedCapacity: string | null;
  keyHazards: string[];
  isActive: boolean;
  updatedAt: string | null;
};

export type CertificationType =
  | "SA8000"
  | "ISO_9001"
  | "ISO_14001"
  | "ISO_45001"
  | "WRAP"
  | "BSCI"
  | "OEKO_TEX"
  | "GOTS"
  | "SEDEX_SMETA"
  | "OTHER";

export type CertStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "UNDER_RENEWAL" | "SUSPENDED";

export type ContactRole =
  | "FACTORY_MANAGER"
  | "SAFETY_OFFICER"
  | "COMPLIANCE_OFFICER"
  | "HR_HEAD"
  | "ENVIRONMENT_OFFICER"
  | "OTHER";

export type FactoryCertification = {
  id: string;
  factoryProfileId: string;
  siteId: string;
  certificationType: CertificationType;
  certificateNo: string | null;
  issuingBody: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  renewalLeadDays: number;
  status: CertStatus;
  daysToExpiry: number | null;
  scopeNotes: string | null;
  attachmentIds: string[];
  updatedAt: string | null;
};

export type FactoryContact = {
  id: string;
  factoryProfileId: string;
  siteId: string;
  role: ContactRole;
  name: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  updatedAt: string | null;
};

export type SnapshotMetrics = {
  auditComplianceScorePct: number | null;
  openFindings: number;
  criticalFindings: number;
  openCapas: number;
  overdueCapas: number;
  openObligations: number;
  overdueObligations: number;
  certsExpiringCount: number;
  incidentCount12m: number;
  lastAuditDate: string | null;
  computedAt: string | null;
};

// ── Facility rollup blocks (live read-model projections — P1) ───────────────
export type TileState = "good" | "watch" | "breach" | "neutral";
export type DeltaDirection = "up" | "down" | "flat";
export type RowTone = "positive" | "warning" | "critical" | "muted";

export type ModuleDeepLink = { module: string; route: string; query: Record<string, string> };

export type KpiDelta = {
  priorValue: number | string | null;
  direction: DeltaDirection;
  isImprovement: boolean | null; // null = neutral metric (no RAG tint on the delta)
  displayPct: number | null;
};

export type FacilityTile = {
  id: string;
  label: string;
  value: number | string | null;
  unit?: string | null;
  state: TileState;
  delta?: KpiDelta | null;
  drillTo?: ModuleDeepLink | null;
};

export type FacilityRollupRow = {
  id: string;
  primaryText: string;
  secondaryText?: string | null;
  statusLabel?: string | null;
  statusTone: RowTone;
  trailingText?: string | null;
  drillTo?: ModuleDeepLink | null;
};

export type FacilityMetricBlock = {
  domainKey: string;
  enabled: boolean;
  degraded: boolean;
  title: string;
  caption: string;
  tiles: FacilityTile[];
  rows: FacilityRollupRow[];
  emptyText?: string | null;
  notEnabledText?: string | null;
  lastRefreshedAt?: string | null;
  drillTo?: ModuleDeepLink | null;
};

export type ComplianceTab = {
  metrics: SnapshotMetrics;
  priorMetrics?: SnapshotMetrics | null;
  periodRef?: string | null;
  priorPeriodRef?: string | null;
  audits: Record<string, any>[];
  findings: Record<string, any>[];
  capas: Record<string, any>[];
  obligations: Record<string, any>[];
  incidents: Record<string, any>[];
  // New live rollup blocks (P1)
  environment?: FacilityMetricBlock | null;
  training?: FacilityMetricBlock | null;
  certifications?: FacilityMetricBlock | null;
  // P2
  socialCompliance?: FacilityMetricBlock | null; // null when omitted (non-garment site)
  operationalRisk?: FacilityMetricBlock | null; // live / point-in-time
  degraded?: boolean;
};

export type FactoryProfileDetail = FactoryProfile & {
  buildings: Building[];
  currentWorkforce: WorkforceComposition | null;
  workforceHistory: WorkforceComposition[];
  processes: ProductionProcess[];
  certifications: FactoryCertification[];
  contacts: FactoryContact[];
  socialCompliance: SocialComplianceProfile | null;
  // extension layer (Facilities build spec)
  equipment: FactoryEquipment[];
  hazardousMaterials: HazardousMaterial[];
  regulatoryRegistrations: RegulatoryRegistration[];
  lifecycleEvents: FactoryLifecycleEvent[];
};

// ════════════════════════════════════════════════════════════════════════════
// FACILITIES — Extension layer types (Equipment / Hazmat / Regulatory / Lifecycle)
// Mirrors app/schemas/factory_ext.py.
// ════════════════════════════════════════════════════════════════════════════

// ── Lifecycle workflow ──
export type LifecycleStage = "INITIATED" | "EXECUTION" | "VALIDATION" | "ACTIVE" | "ARCHIVED";

export type FactoryLifecycleEvent = {
  id: string;
  factoryProfileId: string;
  siteId: string;
  fromStage: string | null;
  toStage: string;
  action: string; // INITIATE | ADVANCE | REQUEST_REVISIONS | REJECT | NOTIFY
  performedBy: string | null;
  performedByRole: string | null;
  comment: string | null;
  validations: Record<string, boolean>;
  issues: { section?: string; issue?: string }[];
  createdAt: string | null;
};

export type LifecycleStatus = {
  factoryProfileId: string;
  lifecycleStage: LifecycleStage;
  lifecycleStageOwnerRole: string | null;
  lifecycleUpdatedAt: string | null;
  allowedNextStages: LifecycleStage[];
  canRequestRevisions: boolean;
  events: FactoryLifecycleEvent[];
};

// ── Equipment ──
export type EquipmentStatus = "ACTIVE" | "IDLE" | "DOWN" | "RETIRED";
export type HazardLevel = "LOW" | "MEDIUM" | "HIGH";
export type EquipmentComplianceStatus = "OK" | "ATTENTION" | "OVERDUE" | "NA";

export type CertifiedOperator = { name?: string; certifiedOn?: string | null; expiresOn?: string | null };
export type SparePart = { partName?: string; quantityInStock?: number; reorderLevel?: number; vendor?: string };

export type FactoryEquipment = {
  id: string;
  factoryProfileId: string;
  siteId: string;
  buildingId: string | null;
  equipmentName: string;
  assetCode: string | null;
  category: string | null;
  manufacturer: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  installationDate: string | null;
  warrantyExpiryDate: string | null;
  capacity: number | null;
  capacityUnit: string | null;
  status: EquipmentStatus;
  operatingHoursPerDay: number | null;
  hazardLevel: HazardLevel;
  puwerRequired: boolean;
  puwerLastInspection: string | null;
  puwerNextDue: string | null;
  lolerRequired: boolean;
  lolerLastInspection: string | null;
  lolerNextDue: string | null;
  electricalSafetyRequired: boolean;
  electricalLastCheck: string | null;
  electricalNextDue: string | null;
  noiseAssessmentRequired: boolean;
  noiseLastTest: string | null;
  noiseMeasurementDb: number | null;
  lastMaintenanceDate: string | null;
  lastMaintenanceType: string | null;
  nextScheduledDate: string | null;
  downtimeHoursYtd: number;
  certifiedOperators: CertifiedOperator[];
  spareParts: SparePart[];
  notes: string | null;
  updatedAt: string | null;
  // computed on read
  complianceStatus: EquipmentComplianceStatus;
  nextComplianceDue: string | null;
  overdueRegimes: string[];
  operatorCertGapFlag: boolean;
};

// ── Hazardous Material ──
export type HazmatClass = "LOW" | "MEDIUM" | "HIGH";
export type ShelfLifeStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NA";
export type TrainingStatus = "ALL_TRAINED" | "PARTIALLY_TRAINED" | "NOT_TRAINED" | "NA";
export type PcbStatus = "REGISTERED" | "PENDING" | "NOT_REGISTERED";

export type HazardousMaterial = {
  id: string;
  factoryProfileId: string;
  siteId: string;
  chemicalName: string;
  casNumber: string | null;
  regulatoryClassification: string | null;
  hazmatClassification: HazmatClass;
  ghsSignalWord: string | null;
  ghsHazardClasses: string[];
  ghsPictograms: string[];
  quantityStored: number;
  unit: string | null;
  maxAllowableQty: number | null;
  reorderLevel: number | null;
  storageBuilding: string | null;
  storageRoom: string | null;
  containerType: string | null;
  containerCount: number | null;
  secondaryContainmentPresent: boolean;
  secondaryContainmentVolume: number | null;
  ventilationAvailable: boolean;
  signagePresent: boolean;
  issueDate: string | null;
  expiryDate: string | null;
  batchLotNumber: string | null;
  sdsDocId: string | null;
  sdsVersion: string | null;
  sdsGhsCompliant: boolean;
  ppeRequired: string[];
  incompatibleSubstances: string[];
  spillKitLocation: string | null;
  emergencyContact: string | null;
  handlersTrainedCount: number;
  handlersTotalCount: number;
  pcbNotificationRequired: boolean;
  pcbRegistrationStatus: PcbStatus;
  notes: string | null;
  updatedAt: string | null;
  // computed on read
  shelfLifeStatus: ShelfLifeStatus;
  daysToExpiry: number | null;
  utilisationPct: number | null;
  overCapacity: boolean;
  reorderReached: boolean;
  containmentRequiredVolume: number | null;
  containmentOk: boolean | null;
  trainingStatus: TrainingStatus;
  sdsMissingFlag: boolean;
};

// ── Regulatory Registration ──
export type RegistrationType =
  | "FACTORY_ACT"
  | "ESI"
  | "PF"
  | "GST"
  | "FIRE_LICENSE"
  | "PCB"
  | "BOILER"
  | "BUILDING_CERT"
  | "OTHER";
export type RenewalFrequency = "ANNUAL" | "BIENNIAL" | "TRIENNIAL" | "ONEOFF" | "ONGOING";
export type RegStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "PENDING_RENEWAL" | "SUSPENDED";
export type ComplianceImpact = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type RegulatoryRegistration = {
  id: string;
  factoryProfileId: string;
  siteId: string;
  registrationType: RegistrationType;
  registrationName: string;
  registrationNumber: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  renewalFrequency: RenewalFrequency;
  lastRenewedDate: string | null;
  nextRenewalDue: string | null;
  status: RegStatus;
  renewalInProgress: boolean;
  renewalAgencyContact: string | null;
  renewalEstimatedCost: number | null;
  renewalNotes: string | null;
  alertThresholdDays: number;
  complianceImpactIfExpired: ComplianceImpact;
  documentationIds: string[];
  updatedAt: string | null;
  // computed on read
  daysToExpiry: number | null;
};

// ── Group registers (W-01 view + the three Reports-tile exports) ────────────
export type SocialComplianceRegisterRow = {
  factoryProfileId: string;
  factoryCode: string;
  factoryName: string;
  state: string;
  city: string;
  asOfDate: string | null;
  totalWorkforce: number;
  permanentCount: number;
  permanentPct: number;
  contractCount: number;
  contractPct: number;
  apprenticeTraineeCount: number;
  maleCount: number;
  femaleCount: number;
  femalePct: number;
  otherGenderCount: number;
  migrantWorkerCount: number | null;
  migrantPct: number | null;
  differentlyAbledCount: number | null;
  youngestWorkerAge: number | null;
  workersUnder18Count: number;
  minHiringAgePolicy: number | null;
  childLabourFlag: boolean;
  hasSocialProfile: boolean;
  minimumWageCompliant: ComplianceFlag;
  lowestMonthlyWageInr: number | null;
  statutoryMinimumWageInr: number | null;
  wagesPaidOnTime: ComplianceFlag;
  standardWeeklyHours: number | null;
  maxWeeklyOvertimeHours: number | null;
  overtimeVoluntary: ComplianceFlag;
  weeklyRestDayProvided: ComplianceFlag;
  unionOrWorkerCommitteePresent: ComplianceFlag;
  collectiveBargainingAgreement: boolean;
  noDepositOrDocumentRetention: ComplianceFlag;
  grievanceMechanismPresent: ComplianceFlag;
  antiDiscriminationPolicy: ComplianceFlag;
  sa8000AwarenessTrainingPct: number | null;
  lastSocialAuditDate: string | null;
  overallSocialComplianceFlag: ComplianceFlag;
  wageFlag: boolean;
  overtimeFlag: boolean;
  foaFlag: boolean;
  effectiveFlag: ComplianceFlag;
};

export type SocialComplianceRollup = {
  factoryCount: number;
  totalWorkforce: number;
  permanentCount: number;
  contractCount: number;
  apprenticeTraineeCount: number;
  maleCount: number;
  femaleCount: number;
  otherGenderCount: number;
  migrantWorkerCount: number;
  differentlyAbledCount: number;
  contractPct: number;
  femalePct: number;
  migrantPct: number;
  flagCounts: Record<string, number>;
  childLabourFlagCount: number;
  overtimeFlagCount: number;
  wageFlagCount: number;
  foaFlagCount: number;
};

export type SocialComplianceRegisterResponse = {
  items: SocialComplianceRegisterRow[];
  rollup: SocialComplianceRollup;
};

export type BuildingRegisterRow = {
  factoryCode: string;
  factoryName: string;
  state: string;
  buildingName: string;
  buildingType: string;
  floors: number;
  areaSqm: number | null;
  maxOccupancy: number | null;
  currentOccupancy: number | null;
  assemblyPoint: string | null;
  emergencyExits: number | null;
  yearBuilt: number | null;
  occupancyCertificateNo: string | null;
};

export type BuildingRegisterResponse = {
  items: BuildingRegisterRow[];
  buildingCount: number;
  totalAreaSqm: number;
};

export type CertificationRegisterRow = {
  certId: string;
  factoryProfileId: string;
  factoryCode: string;
  factoryName: string;
  state: string;
  certificationType: string;
  certificateNo: string | null;
  issuingBody: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: CertStatus;
  daysToExpiry: number | null;
  scopeNotes: string | null;
};

export type CertificationRegisterResponse = {
  items: CertificationRegisterRow[];
  certCount: number;
  expiringWithin90Days: number;
  expiredCount: number;
};

export type FactoryProfileListResponse = {
  items: FactoryProfile[];
  total: number;
  totalBuildings: number;
  totalEmployees: number;
  certsExpiring: number;
  groupComplianceScore: number | null;
  groupOpenCapas: number;
  groupOverdueCapas: number;
  statusCounts: Record<string, number>;
  stateCounts: Record<string, number>;
};

export type ComplianceBand = "green" | "amber" | "red" | "none";

export function complianceBand(score: number | null | undefined): ComplianceBand {
  if (score == null) return "none";
  if (score >= 85) return "green";
  if (score >= 75) return "amber";
  return "red";
}

export const BAND_HEX: Record<ComplianceBand, string> = {
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  none: "#94a3b8",
};

export const BAND_CHIP: Record<ComplianceBand, string> = {
  green: "bg-emerald-100 text-emerald-800 border-emerald-200",
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  red: "bg-rose-100 text-rose-800 border-rose-200",
  none: "bg-slate-100 text-slate-500 border-slate-200",
};

// Equirectangular projection of India's bounding box → 0..1 (x,y) for the SVG map.
export const INDIA_BBOX = { latMin: 6, latMax: 37.5, lonMin: 67.5, lonMax: 98 };
export function projectIndia(lat: number, lon: number): { x: number; y: number } {
  const x = (lon - INDIA_BBOX.lonMin) / (INDIA_BBOX.lonMax - INDIA_BBOX.lonMin);
  const y = (INDIA_BBOX.latMax - lat) / (INDIA_BBOX.latMax - INDIA_BBOX.latMin);
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}

// ── option lists (drive selects in the wizard) ──────────────────────────────
export const FACTORY_STATUSES: FactoryStatus[] = [
  "OPERATIONAL",
  "PARTIAL_OPERATION",
  "UNDER_CONSTRUCTION",
  "SHUTDOWN",
  "DECOMMISSIONED",
];

export const OWNERSHIP_TYPES: OwnershipType[] = ["OWNED", "LEASED", "CONTRACT_MANUFACTURING", "JOINT_VENTURE"];

export const BUILDING_TYPES: BuildingType[] = [
  "PRODUCTION",
  "WAREHOUSE",
  "ADMIN_OFFICE",
  "UTILITY",
  "CANTEEN",
  "DORMITORY",
  "ETP_PLANT",
  "BOILER_HOUSE",
  "STORE",
  "OTHER",
];

// ── label + chip maps ───────────────────────────────────────────────────────
export const STATUS_CHIP: Record<string, string> = {
  OPERATIONAL: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PARTIAL_OPERATION: "bg-amber-100 text-amber-800 border-amber-200",
  UNDER_CONSTRUCTION: "bg-sky-100 text-sky-800 border-sky-200",
  SHUTDOWN: "bg-slate-200 text-slate-600 border-slate-300",
  DECOMMISSIONED: "bg-slate-100 text-slate-400 border-slate-200 line-through",
};

export const PROFILE_STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REVIEW_DUE: "bg-amber-100 text-amber-800 border-amber-200",
};

export const OWNERSHIP_LABEL: Record<string, string> = {
  OWNED: "Owned",
  LEASED: "Leased",
  CONTRACT_MANUFACTURING: "Contract Mfg.",
  JOINT_VENTURE: "Joint Venture",
};

export const CERTIFICATION_TYPES: CertificationType[] = [
  "SA8000",
  "WRAP",
  "BSCI",
  "SEDEX_SMETA",
  "OEKO_TEX",
  "GOTS",
  "ISO_9001",
  "ISO_14001",
  "ISO_45001",
  "OTHER",
];

// Statuses a user may set manually (date-derived ones are computed server-side).
export const CERT_MANUAL_STATUSES: CertStatus[] = ["UNDER_RENEWAL", "SUSPENDED"];

export const CONTACT_ROLES: ContactRole[] = [
  "FACTORY_MANAGER",
  "SAFETY_OFFICER",
  "COMPLIANCE_OFFICER",
  "HR_HEAD",
  "ENVIRONMENT_OFFICER",
  "OTHER",
];

export const CERT_TYPE_LABEL: Record<string, string> = {
  SA8000: "SA8000",
  ISO_9001: "ISO 9001",
  ISO_14001: "ISO 14001",
  ISO_45001: "ISO 45001",
  WRAP: "WRAP",
  BSCI: "BSCI",
  OEKO_TEX: "OEKO-TEX",
  GOTS: "GOTS",
  SEDEX_SMETA: "SEDEX / SMETA",
  OTHER: "Other",
};

export const CERT_STATUS_CHIP: Record<string, string> = {
  VALID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EXPIRING_SOON: "bg-amber-100 text-amber-800 border-amber-200",
  EXPIRED: "bg-rose-100 text-rose-800 border-rose-200",
  UNDER_RENEWAL: "bg-sky-100 text-sky-800 border-sky-200",
  SUSPENDED: "bg-slate-200 text-slate-600 border-slate-300 line-through",
};

export const CONTACT_ROLE_LABEL: Record<string, string> = {
  FACTORY_MANAGER: "Factory Manager",
  SAFETY_OFFICER: "Safety Officer",
  COMPLIANCE_OFFICER: "Compliance Officer",
  HR_HEAD: "HR Head",
  ENVIRONMENT_OFFICER: "Environment Officer",
  OTHER: "Other",
};

// ── SA8000 social-compliance flags ──────────────────────────────────────────
export const COMPLIANCE_FLAGS: ComplianceFlag[] = ["COMPLIANT", "ATTENTION", "NON_COMPLIANT", "NOT_ASSESSED"];

export const SOCIAL_FLAG_LABEL: Record<ComplianceFlag, string> = {
  COMPLIANT: "Compliant",
  ATTENTION: "Attention",
  NON_COMPLIANT: "Non-Compliant",
  NOT_ASSESSED: "Not Assessed",
};

export const SOCIAL_FLAG_CHIP: Record<ComplianceFlag, string> = {
  COMPLIANT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ATTENTION: "bg-amber-100 text-amber-800 border-amber-200",
  NON_COMPLIANT: "bg-rose-100 text-rose-800 border-rose-200",
  NOT_ASSESSED: "bg-slate-100 text-slate-500 border-slate-200",
};

// Compact dot colour for the per-element mini-indicators in the register table.
export const SOCIAL_FLAG_DOT: Record<ComplianceFlag, string> = {
  COMPLIANT: "bg-emerald-500",
  ATTENTION: "bg-amber-500",
  NON_COMPLIANT: "bg-rose-500",
  NOT_ASSESSED: "bg-slate-300",
};

export function socialFlagBand(flag: ComplianceFlag): ComplianceBand {
  if (flag === "COMPLIANT") return "green";
  if (flag === "ATTENTION") return "amber";
  if (flag === "NON_COMPLIANT") return "red";
  return "none";
}

export const BUILDING_TYPE_LABEL: Record<string, string> = {
  PRODUCTION: "Production",
  WAREHOUSE: "Warehouse",
  ADMIN_OFFICE: "Admin / Office",
  UTILITY: "Utility",
  CANTEEN: "Canteen",
  DORMITORY: "Dormitory",
  ETP_PLANT: "ETP Plant",
  BOILER_HOUSE: "Boiler House",
  STORE: "Store",
  OTHER: "Other",
};

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-IN");
}

export function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

// ════════════════════════════════════════════════════════════════════════════
// FACILITIES — Extension layer: option lists + label / chip maps
// ════════════════════════════════════════════════════════════════════════════

// ── Lifecycle workflow ──
// The ordered forward path shown by the stepper (ARCHIVED is terminal, off-path).
export const LIFECYCLE_STAGES: LifecycleStage[] = ["INITIATED", "EXECUTION", "VALIDATION", "ACTIVE"];

export const LIFECYCLE_STAGE_LABEL: Record<string, string> = {
  INITIATED: "Initiated",
  EXECUTION: "Execution",
  VALIDATION: "Validation",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

export const LIFECYCLE_STAGE_OWNER: Record<string, string> = {
  INITIATED: "Plant Head",
  EXECUTION: "Plant Head",
  VALIDATION: "HSE Manager",
  ACTIVE: "HSE Manager",
  ARCHIVED: "—",
};

export const LIFECYCLE_STAGE_CHIP: Record<string, string> = {
  INITIATED: "bg-slate-100 text-slate-600 border-slate-200",
  EXECUTION: "bg-sky-100 text-sky-800 border-sky-200",
  VALIDATION: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ARCHIVED: "bg-slate-200 text-slate-400 border-slate-300 line-through",
};

export const LIFECYCLE_ACTION_LABEL: Record<string, string> = {
  INITIATE: "Initiated",
  ADVANCE: "Advanced",
  REQUEST_REVISIONS: "Revisions requested",
  REJECT: "Rejected",
  NOTIFY: "Notified",
};

// ── Equipment ──
export const EQUIPMENT_STATUSES: EquipmentStatus[] = ["ACTIVE", "IDLE", "DOWN", "RETIRED"];
export const HAZARD_LEVELS: HazardLevel[] = ["LOW", "MEDIUM", "HIGH"];

export const EQUIPMENT_STATUS_CHIP: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  IDLE: "bg-slate-100 text-slate-600 border-slate-200",
  DOWN: "bg-rose-100 text-rose-800 border-rose-200",
  RETIRED: "bg-slate-200 text-slate-400 border-slate-300 line-through",
};

export const HAZARD_LEVEL_CHIP: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-rose-100 text-rose-800 border-rose-200",
};

// OK | ATTENTION | OVERDUE | NA — used for both equipment compliance + generic RAG.
export const RAG_CHIP: Record<string, string> = {
  OK: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ATTENTION: "bg-amber-100 text-amber-800 border-amber-200",
  OVERDUE: "bg-rose-100 text-rose-800 border-rose-200",
  NA: "bg-slate-100 text-slate-500 border-slate-200",
};

export const EQUIPMENT_COMPLIANCE_LABEL: Record<string, string> = {
  OK: "Compliant",
  ATTENTION: "Due soon",
  OVERDUE: "Overdue",
  NA: "N/A",
};

// ── Hazardous materials ──
export const HAZMAT_CLASSES: HazmatClass[] = ["LOW", "MEDIUM", "HIGH"];
export const GHS_SIGNAL_WORDS = ["DANGER", "WARNING", "NONE"] as const;
export const REG_CLASSIFICATIONS = ["SCHEDULED_SUBSTANCE", "HIGH_HAZARD", "NOTIFIED", "OTHER"] as const;
export const PCB_STATUSES: PcbStatus[] = ["REGISTERED", "PENDING", "NOT_REGISTERED"];

export const HAZMAT_CLASS_CHIP = HAZARD_LEVEL_CHIP; // same LOW/MEDIUM/HIGH palette

export const SHELF_LIFE_CHIP: Record<string, string> = {
  VALID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EXPIRING_SOON: "bg-amber-100 text-amber-800 border-amber-200",
  EXPIRED: "bg-rose-100 text-rose-800 border-rose-200",
  NA: "bg-slate-100 text-slate-500 border-slate-200",
};

export const TRAINING_STATUS_CHIP: Record<string, string> = {
  ALL_TRAINED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PARTIALLY_TRAINED: "bg-amber-100 text-amber-800 border-amber-200",
  NOT_TRAINED: "bg-rose-100 text-rose-800 border-rose-200",
  NA: "bg-slate-100 text-slate-500 border-slate-200",
};

export const GHS_SIGNAL_CHIP: Record<string, string> = {
  DANGER: "bg-rose-100 text-rose-800 border-rose-200",
  WARNING: "bg-amber-100 text-amber-800 border-amber-200",
  NONE: "bg-slate-100 text-slate-500 border-slate-200",
};

// ── Regulatory registrations ──
export const REGISTRATION_TYPES: RegistrationType[] = [
  "FACTORY_ACT",
  "FIRE_LICENSE",
  "PCB",
  "BOILER",
  "ESI",
  "PF",
  "GST",
  "BUILDING_CERT",
  "OTHER",
];
export const RENEWAL_FREQUENCIES: RenewalFrequency[] = ["ANNUAL", "BIENNIAL", "TRIENNIAL", "ONEOFF", "ONGOING"];
export const COMPLIANCE_IMPACTS: ComplianceImpact[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const REGISTRATION_TYPE_LABEL: Record<string, string> = {
  FACTORY_ACT: "Factory Act",
  ESI: "ESI",
  PF: "Provident Fund",
  GST: "GST",
  FIRE_LICENSE: "Fire Licence",
  PCB: "Pollution Control (PCB)",
  BOILER: "Boiler",
  BUILDING_CERT: "Building / Occupancy",
  OTHER: "Other",
};

export const RENEWAL_FREQUENCY_LABEL: Record<string, string> = {
  ANNUAL: "Annual",
  BIENNIAL: "2-yearly",
  TRIENNIAL: "3-yearly",
  ONEOFF: "One-off",
  ONGOING: "Ongoing",
};

export const REG_STATUS_CHIP: Record<string, string> = {
  VALID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EXPIRING_SOON: "bg-amber-100 text-amber-800 border-amber-200",
  EXPIRED: "bg-rose-100 text-rose-800 border-rose-200",
  PENDING_RENEWAL: "bg-sky-100 text-sky-800 border-sky-200",
  SUSPENDED: "bg-slate-200 text-slate-600 border-slate-300 line-through",
};

export const IMPACT_CHIP: Record<string, string> = {
  CRITICAL: "bg-rose-100 text-rose-800 border-rose-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  LOW: "bg-slate-100 text-slate-500 border-slate-200",
};
