// Single source of truth for the structured demo users matrix + industry tenants.
// Used by:
//   - prisma/seed.ts                    (creates User rows + plant/department fields)
//   - prisma/seed-rbac.ts               (parses email to assign correct UserRole)
//   - prisma/seed-industry-tenants.ts   (creates 10 industry vertical tenants)
//   - src/app/login/page.tsx            (filter UI + industry picker)
//
// Meridian pattern:  {role-slug}.{dept-slug}.{plant-slug}@safeops360.in   /   demo123
// Industry pattern:  {firstname}.{lastname}@safeops360.in                 /   demo123

export const DEMO_PASSWORD = "demo123";

// ─── Plants — Meridian Manufacturing Limited ──────────────────────────────
export type DemoPlant = { code: string; slug: string };
export const DEMO_PLANTS: DemoPlant[] = [
  { code: "NW", slug: "nw" },   // North Works, Bharatpur, Rajasthan — primary demo plant
  { code: "SW", slug: "sw" }    // South Works, Nellore, Andhra Pradesh — secondary / comparison plant
];

// ─── Departments ─────────────────────────────────────────────────────────
export type DemoDept = { name: string; slug: string };
export const DEMO_DEPARTMENTS: DemoDept[] = [
  { name: "IT", slug: "it" },
  { name: "HR", slug: "hr" }
];

// ─── Roles ───────────────────────────────────────────────────────────────
// roleCode      → the canonical Role.code (matches RBAC seed taxonomy)
// emailSlug     → safe URL-friendly slug used in the email
// legacyRole    → mapped to one of the 9 ROLE_CODES from seed.ts so the
//                 legacy User.role string column stays valid (UserRole layer
//                 is the source of truth — this column is back-compat).
// label         → human label for the login filter UI
export type DemoRole = {
  roleCode: string;
  emailSlug: string;
  legacyRole: string;
  label: string;
};

export const DEMO_ROLES: DemoRole[] = [
  // Operational core
  { roleCode: "WORKER",                          emailSlug: "worker",                legacyRole: "WORKER",        label: "Worker" },
  { roleCode: "CONTRACTOR_WORKMAN",              emailSlug: "contractor-workman",    legacyRole: "WORKER",        label: "Contractor Workman" },
  { roleCode: "SUPERVISOR",                      emailSlug: "supervisor",            legacyRole: "WORKER",        label: "Supervisor" },
  { roleCode: "DEPARTMENT_HEAD",                 emailSlug: "dept-head",             legacyRole: "PLANT_HEAD",    label: "Department Head" },
  { roleCode: "PERMIT_ISSUER",                   emailSlug: "permit-issuer",         legacyRole: "WORKER",        label: "Permit Issuer" },
  { roleCode: "SAFETY_OFFICER",                  emailSlug: "safety-officer",        legacyRole: "HSE_MANAGER",   label: "Safety Officer" },
  { roleCode: "HSE_MANAGER",                     emailSlug: "hse-manager",           legacyRole: "HSE_MANAGER",   label: "HSE Manager" },
  { roleCode: "PLANT_HEAD",                      emailSlug: "plant-head",            legacyRole: "PLANT_HEAD",    label: "Plant Head" },
  { roleCode: "MAINTENANCE_HEAD",                emailSlug: "maintenance-head",      legacyRole: "WORKER",        label: "Maintenance Head" },
  { roleCode: "TRAINER",                         emailSlug: "trainer",               legacyRole: "WORKER",        label: "Trainer" },
  { roleCode: "LD_MANAGER",                      emailSlug: "ld-manager",            legacyRole: "HSE_MANAGER",   label: "L&D Manager" },
  // Specialist / advisory
  { roleCode: "ENVIRONMENT_MANAGER",             emailSlug: "env-manager",           legacyRole: "ENVIRONMENT_MANAGER",             label: "Environment Manager" },
  { roleCode: "CONTRACTOR_COORDINATOR",          emailSlug: "contractor-coord",      legacyRole: "CONTRACTOR_COORDINATOR",          label: "Contractor Coordinator" },
  { roleCode: "OCCUPATIONAL_HEALTH_OFFICER",     emailSlug: "ohs-officer",           legacyRole: "OCCUPATIONAL_HEALTH_OFFICER",     label: "Occupational Health Officer" },
  { roleCode: "EMERGENCY_RESPONSE_COORDINATOR",  emailSlug: "emergency-coord",       legacyRole: "EMERGENCY_RESPONSE_COORDINATOR",  label: "Emergency Response Coordinator" },
  { roleCode: "INDUSTRIAL_HYGIENIST",            emailSlug: "hygienist",             legacyRole: "INDUSTRIAL_HYGIENIST",            label: "Industrial Hygienist" },
  // Cross-plant / system
  { roleCode: "CORPORATE_HSE",                   emailSlug: "corporate-hse",         legacyRole: "HSE_MANAGER",   label: "Corporate HSE" },
  { roleCode: "ADMIN",                           emailSlug: "admin",                 legacyRole: "ADMIN",         label: "Admin" },
];

// Build the Cartesian email for a (role × dept × plant) cell.
export function buildDemoEmail(roleSlug: string, deptSlug: string, plantSlug: string): string {
  return `${roleSlug}.${deptSlug}.${plantSlug}@safeops360.in`;
}

// Parse an email of the form {role}.{dept}.{plant}@safeops360.in.
// Returns the matching role/dept/plant or null if the email isn't structured.
export function parseDemoEmail(email: string): {
  role: DemoRole;
  dept: DemoDept;
  plant: DemoPlant;
} | null {
  const m = email.toLowerCase().match(/^([a-z0-9-]+)\.([a-z0-9]+)\.([a-z0-9]+)@safeops360\.in$/);
  if (!m) return null;
  const [, roleSlug, deptSlug, plantSlug] = m;
  const role = DEMO_ROLES.find((r) => r.emailSlug === roleSlug);
  const dept = DEMO_DEPARTMENTS.find((d) => d.slug === deptSlug);
  const plant = DEMO_PLANTS.find((p) => p.slug === plantSlug);
  if (!role || !dept || !plant) return null;
  return { role, dept, plant };
}

// First-name pool used to give each demo user a plausible name. Picked
// deterministically by index so re-seeding produces stable identities.
const NAME_POOL = [
  "Rajesh", "Priya", "Amit", "Suresh", "Anil", "Vikram", "Kavita", "Manoj",
  "Ramesh", "Deepak", "Sanjay", "Pooja", "Arun", "Naveen", "Kiran", "Sunil",
  "Rohit", "Mahesh", "Ajay", "Harish", "Bhaskar", "Tarun", "Lalit", "Nitin",
  "Pankaj", "Ravi", "Mohan", "Vinod", "Ashok", "Praveen", "Gaurav", "Shyam",
  "Hari", "Jagdish", "Chandan", "Bhavesh", "Rohan", "Sandeep", "Vivek", "Yogesh",
  "Imran", "Farooq", "Salman", "Suraj", "Ganesh", "Mukesh", "Dilip", "Ashish",
  "Tushar", "Anjali", "Bishnu", "Vijay", "Karan", "Nikhil", "Sachin", "Sumit"
];
const SURNAME_POOL = [
  "Sharma", "Mehta", "Kumar", "Reddy", "Patel", "Singh", "Iyer", "Verma",
  "Nair", "Joshi", "Gupta", "Desai", "Pillai", "Rao", "Malhotra", "Agarwal",
  "Saxena", "Yadav", "Chauhan", "Bhatt", "Das", "Mukherjee", "Kapoor", "Bansal",
  "Tiwari", "Choudhary", "Lal", "Khanna", "Tripathi", "Roy", "Tomar", "Thakur",
  "Prasad", "Solanki", "Mishra"
];

export function nameForCell(roleIndex: number, deptIndex: number, plantIndex: number): string {
  const seed = roleIndex * 13 + deptIndex * 7 + plantIndex * 3;
  return `${NAME_POOL[seed % NAME_POOL.length]} ${SURNAME_POOL[seed % SURNAME_POOL.length]}`;
}

// ─── Named all-plant accounts (outside the demo matrix) ──────────────────────
// Real-person logins on their own company domain — NOT part of the
// {role}.{dept}.{plant} matrix, so parseDemoEmail() ignores them and their role
// comes from this list instead.
//
// The distinguishing property is reach: a matrix HSE Manager holds UserRole rows
// for their own plant (+ the NW↔SW pair), so getAccessiblePlantIds() returns two
// plants. These accounts get one PLANT-scoped UserRole row per plant that
// exists, so the same HSE_MANAGER permission set applies group-wide.
//
// Used by:
//   - prisma/named-users-sync.ts  (creates the users + the per-plant role rows)
//   - prisma/seed-rbac.ts         (re-grants the rows after it rebuilds UserRole)
export type NamedUser = {
  email: string;
  name: string;
  roleCode: string;      // Role.code — also written to the legacy User.role column
  designation: string;
  department: string;
  homePlantCode: string; // Plant.code used for User.plantId
};

export const NAMED_ALL_PLANT_USERS: NamedUser[] = [
  {
    email: "swapnil.bhamare@cgbsolution.com",
    name: "Swapnil Bhamare",
    roleCode: "HSE_MANAGER",
    designation: "HSE Manager",
    department: "HSE",
    homePlantCode: "NW"
  },

  // ── Jockey India / Page Industries — internal-audit PoC cast ────────────
  // One audit's worth of people: the process owner who oversees it, the team
  // that conducts it, and the two department owners who answer the findings.
  //
  // The roleCode is the PLATFORM role — what the person may do anywhere.
  // "Lead auditor", "co-auditor" and "auditee" are ENGAGEMENT seats, named per
  // audit on the audit itself. The two are related but not the same, and the
  // seat is what the calendar, routing and independence guard read:
  //   Narasimhan → LEAD_AUDITOR   → seat him as Lead auditor on the audit
  //   Sachin     → AUDITOR        → seat him as a Co-auditor
  //   Ramesh, Dhananjaya          → seat them as Auditees
  //
  // Auditees hold DEPARTMENT_HEAD because CAMS has no auditee role by design:
  // the audited party is an area owner who also answers findings, which is
  // AUDIT_COMPLIANCE READ+UPDATE at OWN_RECORDS — precisely what a routed
  // checkpoint gives them (`record={"routedToUserId": user.id}`).
  {
    email: "mervyn.davis@jockeyindia.com",
    name: "Mervyn Davis",
    roleCode: "HSE_MANAGER",
    designation: "HSE Manager · Process Owner",
    department: "HSE",
    homePlantCode: "NW"
  },
  // Second HSE Manager on the PoC. Same seat as Mervyn, deliberately: the role
  // already carries the whole audit lifecycle (AUDIT_COMPLIANCE CREATE→CLOSE +
  // SCHEDULE) and CAMS READ/TEMPLATE_AUTHOR/SCHEDULE/EXECUTE/CLOSE/
  // FINDING_MANAGE/ANALYTICS, and the per-plant UserRole rows this file grants
  // make every OWN_PLANT grant reach every site. CAMS.TYPE_CONFIG and
  // CAMS.TEMPLATE_APPROVE are NOT included — audit-type configuration and
  // publishing a template version stay with CAMS_ADMIN / AUDIT_MANAGER, which
  // is what keeps the author and the approver of a checklist different people.
  //
  // Lowercase, like every entry here: sign-in matches `email.lower()` exactly,
  // so a capitalised address would create an account nobody could log into.
  {
    email: "paila.padmanabham@jockeyindia.com",
    name: "Paila Padmanabham",
    roleCode: "HSE_MANAGER",
    designation: "HSE Manager",
    department: "HSE",
    homePlantCode: "NW"
  },
  {
    email: "narasimhan.rajan@jockeyindia.com",
    name: "Narasimhan Rajan",
    roleCode: "LEAD_AUDITOR",
    designation: "Internal Audit Manager",
    department: "Internal Audit",
    homePlantCode: "NW"
  },
  {
    email: "sachin.pampanna@jockeyindia.com",
    name: "Sachin Pampanna",
    roleCode: "AUDITOR",
    designation: "Audit Executive",
    department: "Internal Audit",
    homePlantCode: "NW"
  },
  {
    email: "ramesh.thimmappa@jockeyindia.com",
    name: "Ramesh Thimmappa",
    roleCode: "AUDITEE",
    designation: "Auditee · Department Owner",
    department: "Operations",
    homePlantCode: "NW"
  },
  {
    email: "dhananjaya.hp@jockeyindia.com",
    name: "Dhananjaya HP",
    roleCode: "AUDITEE",
    designation: "Auditee · Department Owner",
    department: "Operations",
    homePlantCode: "NW"
  }
];

// ─── Industry Tenants — 10 vertical demo companies ───────────────────────────
// Each has its own plant, named primary persona (HSE Manager), and 5 supporting
// users. Demo state: 17 months manhours, 3-4 LTI incidents, 2 active permits.
// Email pattern: {firstname}.{lastname}@safeops360.in  / demo123
// Supporting:    {role-slug}.{plant-code-lower}@safeops360.in / demo123

export type DemoIndustry = {
  vertical: string;       // display name: "Chemical"
  slug: string;           // url slug: "chemical"
  company: string;        // "Axiom Chemicals Ltd"
  plantCode: string;      // "AXM"
  plantName: string;      // full plant name
  location: string;
  state: string;
  persona: {
    name: string;
    email: string;
    designation: string;
  };
  ltifr: string;          // display value e.g. "0.29"
  daysLastLTI: number;
  activePermits: number;
};

/** The five supporting accounts provisioned per industry plant. */
export const SUPPORT_ROLES = [
  { emailKey: "plant-head",     role: "PLANT_HEAD",  designation: "Plant Head",       dept: "Management" },
  { emailKey: "safety-officer", role: "HSE_MANAGER", designation: "Safety Officer",   dept: "HSE" },
  { emailKey: "supervisor",     role: "WORKER",      designation: "Shift Supervisor", dept: "Operations" },
  { emailKey: "permit-issuer",  role: "WORKER",      designation: "Permit Issuer",    dept: "HSE" },
  { emailKey: "worker",         role: "WORKER",      designation: "Process Operator", dept: "Operations" },
];

/**
 * Real person names for the supporting users — one per SUPPORT_ROLES slot per
 * plant, in the same order.
 *
 * These accounts used to be named after their own designation ("Process
 * Operator (AGB)"), which made every workflow screen read as though a role
 * rather than a person owed the action: "Awaiting Action — Process Operator
 * (AGB) (Process Operator · Operations)" tells a reader nothing they can act
 * on. The UI now always renders name + designation + role + department + plant,
 * so the name slot has to actually carry a name.
 */
export const SUPPORT_NAMES: Record<string, string[]> = {
  AXM: ["Vikram Deshpande", "Anjali Iyer",     "Ramesh Pawar",     "Suresh Kulkarni",  "Mahesh Jadhav"],
  MCP: ["Arvind Nair",      "Deepa Menon",     "Prakash Shetty",   "Girish Bhat",      "Sunil Pillai"],
  APX: ["Harish Reddy",     "Kavya Rao",       "Naresh Gowda",     "Basavaraj Patil",  "Manjunath Hegde"],
  CCS: ["Devendra Chauhan", "Ritu Solanki",    "Bhanu Prakash",    "Jagdish Rathore",  "Kailash Meena"],
  ISL: ["Subrata Ghosh",    "Paromita Sen",    "Ranjan Mahato",    "Debashis Roy",     "Ashok Bhuyan"],
  PFI: ["Nitin Wagh",       "Shalini Joshi",   "Yogesh Sawant",    "Pravin Bhosale",   "Dattatray More"],
  PMB: ["Kamal Chatterjee", "Moushumi Das",    "Bikash Nandi",     "Tapan Bose",       "Sanjib Dutta"],
  VGP: ["Rajendra Prasad",  "Lakshmi Narayan", "Venkat Subbaiah",  "Srinivas Achari",  "Murali Krishnan"],
  AGB: ["Balram Yadav",     "Sneha Tiwari",    "Om Prakash Singh", "Dinesh Chaudhary", "Rakesh Verma"],
  ACS: ["Amit Khandelwal",  "Pooja Bansal",    "Sandeep Ahuja",    "Vinod Malhotra",   "Gaurav Saxena"],
};

/** Person name for a support slot. Falls back to the old designation-as-name
 *  label if a plant is added to DEMO_INDUSTRIES without a SUPPORT_NAMES entry,
 *  so a new vertical never lands with a blank name. */
export function supportName(plantCode: string, index: number, designation: string): string {
  return SUPPORT_NAMES[plantCode]?.[index] ?? `${designation} (${plantCode})`;
}

export const DEMO_INDUSTRIES: DemoIndustry[] = [
  {
    vertical: "Chemical",
    slug: "chemical",
    company: "Axiom Chemicals Ltd",
    plantCode: "AXM",
    plantName: "Axiom Chemicals — Integrated Production Complex",
    location: "Special Economic Zone, Dahej, Bharuch",
    state: "Gujarat",
    persona: { name: "Rahul Sharma", email: "rahul.sharma@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.29",
    daysLastLTI: 21,
    activePermits: 2
  },
  {
    vertical: "Pharmaceutical",
    slug: "pharma",
    company: "MedCore Pharma Ltd",
    plantCode: "MCP",
    plantName: "MedCore Pharma — Formulations & API Manufacturing Unit",
    location: "Pharma City, Genome Valley, Hyderabad",
    state: "Telangana",
    persona: { name: "Preethi Menon", email: "preethi.menon@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.22",
    daysLastLTI: 45,
    activePermits: 2
  },
  {
    vertical: "Tyre",
    slug: "tyre",
    company: "Apex Tyres Ltd",
    plantCode: "APX",
    plantName: "Apex Tyres — Integrated Tyre Manufacturing Plant",
    location: "MIDC Industrial Area, Pune",
    state: "Maharashtra",
    persona: { name: "Suresh Patil", email: "suresh.patil@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.33",
    daysLastLTI: 18,
    activePermits: 2
  },
  {
    vertical: "Cement",
    slug: "cement",
    company: "Cornerstone Cement Ltd",
    plantCode: "CCS",
    plantName: "Cornerstone Cement — Integrated Cement Works",
    location: "NH-44 Industrial Corridor, Gulbarga",
    state: "Karnataka",
    persona: { name: "Vikram Singh", email: "vikram.singh@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.38",
    daysLastLTI: 12,
    activePermits: 2
  },
  {
    vertical: "Steel",
    slug: "steel",
    company: "IndoSteel Manufacturing Ltd",
    plantCode: "ISL",
    plantName: "IndoSteel — Integrated Steel Plant",
    location: "Kalinganagar Industrial Complex, Jajpur",
    state: "Odisha",
    persona: { name: "Amit Verma", email: "amit.verma@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.41",
    daysLastLTI: 9,
    activePermits: 2
  },
  {
    vertical: "Food Processing",
    slug: "food",
    company: "PureFoods Industries Ltd",
    plantCode: "PFI",
    plantName: "PureFoods Industries — Food Processing & Packaging Plant",
    location: "Food Park, Tumkur Industrial Area",
    state: "Karnataka",
    persona: { name: "Kavitha Nair", email: "kavitha.nair@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.25",
    daysLastLTI: 33,
    activePermits: 2
  },
  {
    vertical: "Paper",
    slug: "paper",
    company: "PaperMill Bharat Ltd",
    plantCode: "PMB",
    plantName: "PaperMill Bharat — Integrated Pulp & Paper Mill",
    location: "River Bank Industrial Estate, Bhadrachalam",
    state: "Telangana",
    persona: { name: "Rajan Pillai", email: "rajan.pillai@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.30",
    daysLastLTI: 27,
    activePermits: 2
  },
  {
    vertical: "Power",
    slug: "power",
    company: "VoltGen Power Ltd",
    plantCode: "VGP",
    plantName: "VoltGen Power — Thermal Power Station",
    location: "Power Grid Industrial Zone, Korba",
    state: "Chhattisgarh",
    persona: { name: "Deepa Krishnan", email: "deepa.krishnan@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.31",
    daysLastLTI: 16,
    activePermits: 2
  },
  {
    vertical: "Fertiliser",
    slug: "fertiliser",
    company: "AgroBase Fertilisers Ltd",
    plantCode: "AGB",
    plantName: "AgroBase Fertilisers — Urea & Complex Fertiliser Plant",
    location: "GIDC Industrial Estate, Hazira",
    state: "Gujarat",
    persona: { name: "Mohan Reddy", email: "mohan.reddy@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.35",
    daysLastLTI: 22,
    activePermits: 2
  },
  {
    vertical: "Automotive",
    slug: "auto",
    company: "AutoComp Systems Ltd",
    plantCode: "ACS",
    plantName: "AutoComp Systems — Component Manufacturing Complex",
    location: "Chakan Automotive Hub, Pune",
    state: "Maharashtra",
    persona: { name: "Rajesh Gupta", email: "rajesh.gupta@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.36",
    daysLastLTI: 19,
    activePermits: 2
  }
];
