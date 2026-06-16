// Single source of truth for the structured demo users matrix + industry tenants.
// Used by:
//   - prisma/seed.ts                    (creates User rows + plant/department fields)
//   - prisma/seed-rbac.ts               (parses email to assign correct UserRole)
//   - prisma/seed-industry-tenants.ts   (creates 10 industry vertical tenants)
//   - src/app/login/page.tsx            (filter UI + industry picker)
//
// Page Industries pattern:  {role-slug}.{dept-slug}.{plant-slug}@safeops360.in   /   demo123
// Industry pattern:         {firstname}.{lastname}@safeops360.in                 /   demo123

export const DEMO_PASSWORD = "demo123";

// ─── Plants — Page Industries Limited — Pulp & Paper ───────────────────────
export type DemoPlant = { code: string; slug: string };
export const DEMO_PLANTS: DemoPlant[] = [
  { code: "NW", slug: "nw" },   // North Paper Mill, Bharatpur, Rajasthan — primary demo plant
  { code: "SW", slug: "sw" }    // South Kraft & Board Mill, Nellore, Andhra Pradesh — secondary / comparison plant
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
  { roleCode: "SYSTEM_ADMIN",                    emailSlug: "system-admin",          legacyRole: "ADMIN",         label: "System Admin" }
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

export const DEMO_INDUSTRIES: DemoIndustry[] = [
  {
    vertical: "Pulp Mill",
    slug: "chemical",
    company: "Page Pulp & Fibre Ltd",
    plantCode: "AXM",
    plantName: "Page Pulp & Fibre — Market Pulp Mill",
    location: "Special Economic Zone, Dahej, Bharuch",
    state: "Gujarat",
    persona: { name: "Rahul Sharma", email: "rahul.sharma@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.29",
    daysLastLTI: 21,
    activePermits: 2
  },
  {
    vertical: "Tissue",
    slug: "pharma",
    company: "Page Tissue & Hygiene Ltd",
    plantCode: "MCP",
    plantName: "Page Tissue & Hygiene — Tissue Mill",
    location: "Pharma City, Genome Valley, Hyderabad",
    state: "Telangana",
    persona: { name: "Preethi Menon", email: "preethi.menon@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.22",
    daysLastLTI: 45,
    activePermits: 2
  },
  {
    vertical: "Packaging Board",
    slug: "tyre",
    company: "Page Packaging Board Ltd",
    plantCode: "APX",
    plantName: "Page Packaging Board — Duplex & FBB Mill",
    location: "MIDC Industrial Area, Pune",
    state: "Maharashtra",
    persona: { name: "Suresh Patil", email: "suresh.patil@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.33",
    daysLastLTI: 18,
    activePermits: 2
  },
  {
    vertical: "Kraft Paper",
    slug: "cement",
    company: "Page Kraft Papers Ltd",
    plantCode: "CCS",
    plantName: "Page Kraft Papers — Kraft & Liner Mill",
    location: "NH-44 Industrial Corridor, Gulbarga",
    state: "Karnataka",
    persona: { name: "Vikram Singh", email: "vikram.singh@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.38",
    daysLastLTI: 12,
    activePermits: 2
  },
  {
    vertical: "Newsprint",
    slug: "steel",
    company: "Page Newsprint Ltd",
    plantCode: "ISL",
    plantName: "Page Newsprint — Newsprint Mill",
    location: "Kalinganagar Industrial Complex, Jajpur",
    state: "Odisha",
    persona: { name: "Amit Verma", email: "amit.verma@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.41",
    daysLastLTI: 9,
    activePermits: 2
  },
  {
    vertical: "Specialty Paper",
    slug: "food",
    company: "Page Specialty Papers Ltd",
    plantCode: "PFI",
    plantName: "Page Specialty Papers — Coated & Specialty Paper Mill",
    location: "Food Park, Tumkur Industrial Area",
    state: "Karnataka",
    persona: { name: "Kavitha Nair", email: "kavitha.nair@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.25",
    daysLastLTI: 33,
    activePermits: 2
  },
  {
    vertical: "Writing & Printing",
    slug: "paper",
    company: "Page Industries Bharat Paper Ltd",
    plantCode: "PMB",
    plantName: "Page Industries Bharat — Integrated Pulp & Paper Mill",
    location: "River Bank Industrial Estate, Bhadrachalam",
    state: "Telangana",
    persona: { name: "Rajan Pillai", email: "rajan.pillai@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.30",
    daysLastLTI: 27,
    activePermits: 2
  },
  {
    vertical: "Recycled Paper",
    slug: "power",
    company: "Page Recycled Fibre Ltd",
    plantCode: "VGP",
    plantName: "Page Recycled Fibre — Waste-Paper Recycling Mill",
    location: "Power Grid Industrial Zone, Korba",
    state: "Chhattisgarh",
    persona: { name: "Deepa Krishnan", email: "deepa.krishnan@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.31",
    daysLastLTI: 16,
    activePermits: 2
  },
  {
    vertical: "Paper Chemicals",
    slug: "fertiliser",
    company: "Page Paper Chemicals Ltd",
    plantCode: "AGB",
    plantName: "Page Paper Chemicals — Sizing & Coating Chemicals Plant",
    location: "GIDC Industrial Estate, Hazira",
    state: "Gujarat",
    persona: { name: "Mohan Reddy", email: "mohan.reddy@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.35",
    daysLastLTI: 22,
    activePermits: 2
  },
  {
    vertical: "Paper Converting",
    slug: "auto",
    company: "Page Paper Converters Ltd",
    plantCode: "ACS",
    plantName: "Page Paper Converters — Notebook & Reel-to-Sheet Plant",
    location: "Chakan Automotive Hub, Pune",
    state: "Maharashtra",
    persona: { name: "Rajesh Gupta", email: "rajesh.gupta@safeops360.in", designation: "HSE Manager" },
    ltifr: "0.36",
    daysLastLTI: 19,
    activePermits: 2
  }
];
