// ────────────────────────────────────────────────────────────────────────
// Seed — Enterprise Risk Management (ERM) — Phase 1
//
// Seeds the board-grade ERM layer for the Page Industries demo tenant
// (plants NW = North Paper Mill, SW = South Kraft & Board Mill — already created by seed.ts):
//   • 10 system risk categories + 31 sub-categories
//   • "Page Industries Standard 5x5" scoring matrix (5 likelihood × 25 impact × 4 bands)
//   • 4 review-cycle configs (LOW/MEDIUM/HIGH/CRITICAL)
//   • 10 ERM persona users + UserRole assignments (CRO / Champions / Owners / …)
//   • CAPA source category + type for risk treatments
//   • 24 enterprise risks with denormalised inherent/residual scores
//   • INHERENT + RESIDUAL current assessments per risk (48 rows)
//   • 3 HSE/environmental rollup rules + rollup linkages to real HIRA/EAI entries
//   • 6 inter-risk linkages
//   • 12 treatment CAPAs (TREAT / TRANSFER / TERMINATE, incl. 2 overdue)
//   • prior-quarter snapshots (Q4 FY26), risk reviews, 1 draft board pack
//
// Idempotent: deletes prior ERM demo rows (FK-safe) + the 10 persona users
// and their UserRole rows before recreating. Safe to re-run.
//
// Run AFTER: seed-hira-masters/eai-masters, seed (users), seed-rbac (roles),
//            seed-risk-management (HIRA studies), seed-eai-data (EAI entries).
//   npx tsx prisma/seed-erm.ts
// ────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_PASSWORD } from "./demo-users-config";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────
const NOW = new Date("2026-06-14T00:00:00.000Z");
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 3_600_000);
}
function daysFromNow(n: number): Date {
  return new Date(NOW.getTime() + n * 24 * 3_600_000);
}
function bandFor(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score <= 4) return "LOW";
  if (score <= 9) return "MEDIUM";
  if (score <= 15) return "HIGH";
  return "CRITICAL";
}
function reviewDaysForBand(band: string): number {
  switch (band) {
    case "CRITICAL": return 30;
    case "HIGH": return 90;
    case "MEDIUM": return 180;
    default: return 365;
  }
}
// Normalise HIRA/EAI residual levels to ERM bands.
function normBand(level: string | null | undefined): string {
  const l = (level ?? "").toUpperCase();
  if (l === "CRITICAL" || l === "MAJOR") return "CRITICAL";
  if (l === "HIGH" || l === "SIGNIFICANT") return "HIGH";
  if (l === "MODERATE" || l === "MEDIUM") return "MEDIUM";
  if (l === "LOW") return "LOW";
  return "MEDIUM";
}

async function main() {
  console.log("Seeding Enterprise Risk Management (ERM)…");

  // ── Resolve plants ────────────────────────────────────────────────────
  const nw = await prisma.plant.findFirst({ where: { code: "NW" } });
  const sw = await prisma.plant.findFirst({ where: { code: "SW" } });
  if (!nw) throw new Error("NW plant not found — run base seed (Step 9) first");
  if (!sw) throw new Error("SW plant not found — run base seed (Step 9) first");

  // ── ERM persona users ───────────────────────────────────────────────────
  type PersonaSpec = { name: string; email: string; roleCode: string; plantId: string; designation: string };
  const personas: PersonaSpec[] = [
    { name: "Anand Krishnan", email: "anand.krishnan@safeops360.in", roleCode: "CRO", plantId: nw.id, designation: "Chief Risk Officer" },
    { name: "Priya Deshmukh", email: "priya.deshmukh@safeops360.in", roleCode: "RISK_CHAMPION", plantId: nw.id, designation: "Risk Champion (Corporate)" },
    { name: "Vikram Sethi", email: "vikram.sethi@safeops360.in", roleCode: "RISK_CHAMPION", plantId: sw.id, designation: "Risk Champion (South Kraft & Board Mill)" },
    { name: "Rajesh Nair", email: "rajesh.nair@safeops360.in", roleCode: "RISK_OWNER", plantId: nw.id, designation: "CFO" },
    { name: "Meera Iyer", email: "meera.iyer@safeops360.in", roleCode: "RISK_OWNER", plantId: nw.id, designation: "Head Supply Chain" },
    { name: "Suresh Patel", email: "suresh.patel@safeops360.in", roleCode: "RISK_OWNER", plantId: nw.id, designation: "CHRO" },
    { name: "Kavita Rao", email: "kavita.rao@safeops360.in", roleCode: "RISK_OWNER", plantId: nw.id, designation: "CIO" },
    { name: "Devendra Kulkarni", email: "devendra.kulkarni@safeops360.in", roleCode: "PLANT_HSE_HEAD", plantId: nw.id, designation: "Plant HSE Head (North Paper Mill)" },
    { name: "Lakshmi Venkatesh", email: "lakshmi.venkatesh@safeops360.in", roleCode: "PLANT_HSE_HEAD", plantId: sw.id, designation: "Plant HSE Head (South Kraft & Board Mill)" },
    { name: "Arjun Mehta", email: "arjun.mehta@safeops360.in", roleCode: "EXECUTIVE_VIEWER", plantId: nw.id, designation: "Independent Director, RMC Chair" },
  ];
  const personaEmails = personas.map((p) => p.email);

  // ── Idempotent wipe (FK-safe order) ──────────────────────────────────────
  const ermRiskWhere = { riskCode: { startsWith: "ERM-2026-" } };
  const safeDelete = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { console.warn(`  (skip ${label}: ${(e as Error).message})`); }
  };

  // children of risks first
  await safeDelete("riskReview", () => prisma.riskReview.deleteMany({ where: { risk: ermRiskWhere } }));
  await safeDelete("riskAssessment", () => prisma.riskAssessment.deleteMany({ where: { risk: ermRiskWhere } }));
  await safeDelete("rollupLinkage", () => prisma.rollupLinkage.deleteMany({ where: { enterpriseRisk: ermRiskWhere } }));
  await safeDelete("riskLinkage", () => prisma.riskLinkage.deleteMany({ where: { OR: [{ sourceRisk: ermRiskWhere }, { targetRisk: ermRiskWhere }] } }));
  await safeDelete("capa(RISK_TREATMENT)", () => prisma.capa.deleteMany({ where: { sourceTypeCode: "RISK_TREATMENT" } }));
  await safeDelete("enterpriseRisk", () => prisma.enterpriseRisk.deleteMany({ where: ermRiskWhere }));
  await safeDelete("ermRiskSnapshot", () => prisma.ermRiskSnapshot.deleteMany({ where: { riskCode: { startsWith: "ERM-2026-" } } }));
  await safeDelete("ermBoardPack", () => prisma.ermBoardPack.deleteMany({}));
  await safeDelete("rollupRule", () => prisma.rollupRule.deleteMany({}));
  await safeDelete("riskSubCategory", () => prisma.riskSubCategory.deleteMany({}));
  await safeDelete("riskCategory", () => prisma.riskCategory.deleteMany({}));
  await safeDelete("scoringMatrixConfig", () => prisma.scoringMatrixConfig.deleteMany({}));
  await safeDelete("reviewCycleConfig", () => prisma.reviewCycleConfig.deleteMany({}));

  // persona users + their roles
  await safeDelete("userRole(personas)", () => prisma.userRole.deleteMany({ where: { user: { email: { in: personaEmails } } } }));
  await safeDelete("users(personas)", () => prisma.user.deleteMany({ where: { email: { in: personaEmails } } }));

  // ── Create persona users + UserRole rows ─────────────────────────────────
  const pwHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIdByEmail = new Map<string, string>();
  for (const p of personas) {
    const u = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name, role: p.roleCode, plantId: p.plantId, designation: p.designation, passwordHash: pwHash },
      create: { email: p.email, name: p.name, role: p.roleCode, plantId: p.plantId, designation: p.designation, passwordHash: pwHash },
    });
    userIdByEmail.set(p.email, u.id);
    const role = await prisma.role.findUnique({ where: { code: p.roleCode } });
    if (!role) { console.warn(`  (role ${p.roleCode} not found — skipping UserRole for ${p.email})`); continue; }
    const existing = await prisma.userRole.findFirst({
      where: { userId: u.id, roleId: role.id, scopeType: "PLANT", scopeValue: p.plantId },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: u.id, roleId: role.id, scopeType: "PLANT", scopeValue: p.plantId },
      });
    }
  }
  const uid = (email: string): string => {
    const id = userIdByEmail.get(email);
    if (!id) throw new Error(`persona user not found: ${email}`);
    return id;
  };
  // owner-name → email map (per §6)
  const ownerEmail: Record<string, string> = {
    "Anand K": "anand.krishnan@safeops360.in",
    "Rajesh N": "rajesh.nair@safeops360.in",
    "Meera I": "meera.iyer@safeops360.in",
    "Suresh P": "suresh.patel@safeops360.in",
    "Kavita R": "kavita.rao@safeops360.in",
    "Devendra K": "devendra.kulkarni@safeops360.in",
    "Lakshmi V": "lakshmi.venkatesh@safeops360.in",
  };
  const championNW = uid("priya.deshmukh@safeops360.in");
  const championSW = uid("vikram.sethi@safeops360.in");
  const croId = uid("anand.krishnan@safeops360.in");
  console.log(`  personas: ${personas.length} users + UserRole rows`);

  // ── Risk categories + sub-categories ──────────────────────────────────────
  const categories: { code: string; name: string; description: string; colorHex: string; displayOrder: number }[] = [
    { code: "STR", name: "Strategic", description: "Risks to the achievement of long-term strategic objectives and competitive position.", colorHex: "#6B4FA0", displayOrder: 1 },
    { code: "FIN", name: "Financial", description: "Risks to financial performance, liquidity, capital and earnings volatility.", colorHex: "#1E6FB8", displayOrder: 2 },
    { code: "OPS", name: "Operational", description: "Risks arising from people, processes, assets and safety in day-to-day operations.", colorHex: "#C0392B", displayOrder: 3 },
    { code: "CMP", name: "Compliance & Legal", description: "Risks of statutory, regulatory, contractual or legal non-compliance.", colorHex: "#B45309", displayOrder: 4 },
    { code: "REP", name: "Reputational", description: "Risks to brand, stakeholder trust and public perception.", colorHex: "#8E44AD", displayOrder: 5 },
    { code: "TEC", name: "Technology & Cyber", description: "Risks to IT/OT systems, cyber security, availability and data.", colorHex: "#16A085", displayOrder: 6 },
    { code: "ESG", name: "ESG & Climate", description: "Environmental, social, governance and climate-related risks.", colorHex: "#047857", displayOrder: 7 },
    { code: "SCM", name: "Supply Chain", description: "Risks to sourcing, vendor reliability and inbound/outbound logistics.", colorHex: "#D35400", displayOrder: 8 },
    { code: "PPL", name: "People & Talent", description: "Risks to workforce availability, capability, retention and relations.", colorHex: "#2C6E91", displayOrder: 9 },
    { code: "GEO", name: "Geopolitical & External", description: "Risks from external macro, trade, regulatory and force-majeure events.", colorHex: "#5D6D7E", displayOrder: 10 },
  ];
  const catIdByCode = new Map<string, string>();
  for (const c of categories) {
    const row = await prisma.riskCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description, colorHex: c.colorHex, displayOrder: c.displayOrder, isSystemCategory: true, isActive: true },
      create: { ...c, isSystemCategory: true, isActive: true },
    });
    catIdByCode.set(c.code, row.id);
  }

  const subCats: { code: string; name: string; cat: string }[] = [
    { code: "STR-MKT", name: "Market Demand", cat: "STR" }, { code: "STR-CMP", name: "Competition", cat: "STR" }, { code: "STR-EXP", name: "M&A/Expansion", cat: "STR" },
    { code: "FIN-FX", name: "Forex", cat: "FIN" }, { code: "FIN-CRD", name: "Credit/Receivables", cat: "FIN" }, { code: "FIN-LIQ", name: "Liquidity", cat: "FIN" }, { code: "FIN-CMD", name: "Commodity Prices", cat: "FIN" },
    { code: "OPS-HSE", name: "HSE", cat: "OPS" }, { code: "OPS-ENV", name: "Environment", cat: "OPS" }, { code: "OPS-QUA", name: "Quality", cat: "OPS" }, { code: "OPS-AST", name: "Asset/Equipment", cat: "OPS" }, { code: "OPS-CAP", name: "Capacity", cat: "OPS" },
    { code: "CMP-STA", name: "Statutory", cat: "CMP" }, { code: "CMP-LIT", name: "Litigation", cat: "CMP" }, { code: "CMP-LIC", name: "Licences & Consents", cat: "CMP" },
    { code: "REP-BRD", name: "Customer/Brand", cat: "REP" }, { code: "REP-MED", name: "Media/Social", cat: "REP" }, { code: "REP-COM", name: "Community", cat: "REP" },
    { code: "TEC-CYB", name: "Cyber Security", cat: "TEC" }, { code: "TEC-AVL", name: "System Availability", cat: "TEC" }, { code: "TEC-DAT", name: "Data Privacy", cat: "TEC" },
    { code: "ESG-PHY", name: "Climate Physical", cat: "ESG" }, { code: "ESG-TRN", name: "Climate Transition", cat: "ESG" }, { code: "ESG-RPT", name: "Reporting/Disclosure", cat: "ESG" },
    { code: "SCM-SRC", name: "Single-Source Dependency", cat: "SCM" }, { code: "SCM-LOG", name: "Logistics", cat: "SCM" }, { code: "SCM-VND", name: "Vendor Failure", cat: "SCM" },
    { code: "PPL-KEY", name: "Key-Person", cat: "PPL" }, { code: "PPL-IR", name: "Industrial Relations", cat: "PPL" }, { code: "PPL-SKL", name: "Skill Shortage", cat: "PPL" },
    { code: "GEO-TRD", name: "Trade/Tariff", cat: "GEO" }, { code: "GEO-REG", name: "Regulatory Change", cat: "GEO" }, { code: "GEO-FMJ", name: "Pandemic/Force Majeure", cat: "GEO" },
  ];
  const subCatIdByCode = new Map<string, string>();
  for (const s of subCats) {
    const catId = catIdByCode.get(s.cat)!;
    const row = await prisma.riskSubCategory.upsert({
      where: { code: s.code },
      update: { name: s.name, categoryId: catId, isActive: true },
      create: { code: s.code, name: s.name, categoryId: catId, description: `${s.name} risks within the ${s.cat} category.`, isActive: true },
    });
    subCatIdByCode.set(s.code, row.id);
  }
  console.log(`  taxonomy: ${categories.length} categories, ${subCats.length} sub-categories`);

  // ── Scoring matrix "Page Industries Standard 5x5" ────────────────────────────────
  const likelihoodLevels = [
    { level: 1, label: "Rare", probabilityGuide: "<5%", frequencyGuide: "not expected in 10 yrs" },
    { level: 2, label: "Unlikely", probabilityGuide: "5-20%", frequencyGuide: "once in 5-10 yrs" },
    { level: 3, label: "Possible", probabilityGuide: "20-50%", frequencyGuide: "once in 2-5 yrs" },
    { level: 4, label: "Likely", probabilityGuide: "50-80%", frequencyGuide: "once in 1-2 yrs" },
    { level: 5, label: "Almost Certain", probabilityGuide: ">80%", frequencyGuide: "expected this year" },
  ];
  const impactLabels = ["Insignificant", "Minor", "Moderate", "Major", "Catastrophic"];
  const dimDescriptors: Record<string, string[]> = {
    FINANCIAL: ["< ₹25 L", "₹25 L–₹1 Cr", "₹1–5 Cr", "₹5–25 Cr", "> ₹25 Cr"],
    SAFETY: ["First aid", "Medical treatment", "Lost-time injury", "Permanent disability / single fatality", "Multiple fatalities"],
    REPUTATIONAL: ["Internal only", "Local complaint", "Regional media", "National media / key customer concern", "Sustained national coverage / customer exit"],
    REGULATORY: ["Observation", "Notice", "Penalty/fine", "Licence condition / prosecution risk", "Licence suspension / plant closure"],
    BUSINESS_INTERRUPTION: ["< 4 hrs", "4–24 hrs", "1–7 days", "1–4 weeks", "> 1 month"],
  };
  const impactLevels: { level: number; dimension: string; label: string; descriptor: string }[] = [];
  for (const dim of Object.keys(dimDescriptors)) {
    for (let lvl = 1; lvl <= 5; lvl++) {
      impactLevels.push({ level: lvl, dimension: dim, label: impactLabels[lvl - 1], descriptor: dimDescriptors[dim][lvl - 1] });
    }
  }
  const ratingBands = [
    { name: "LOW", minScore: 1, maxScore: 4, colorHex: "#2E8B57" },
    { name: "MEDIUM", minScore: 5, maxScore: 9, colorHex: "#E6A817" },
    { name: "HIGH", minScore: 10, maxScore: 15, colorHex: "#E67E22" },
    { name: "CRITICAL", minScore: 16, maxScore: 25, colorHex: "#C0392B" },
  ];
  const matrix = await prisma.scoringMatrixConfig.create({
    data: {
      name: "Page Industries Standard 5x5", version: 1, isDefault: true, isActive: true,
      likelihoodLevels: likelihoodLevels as any,
      impactLevels: impactLevels as any,
      ratingBands: ratingBands as any,
      notes: "Default enterprise 5×5 likelihood × impact matrix (ISO 31000 aligned). Impact assessed across 5 dimensions; overall impact = max dimension level.",
      createdBy: croId,
    },
  });
  console.log(`  scoring matrix: "${matrix.name}" (5 likelihood, ${impactLevels.length} impact cells, ${ratingBands.length} bands)`);

  // ── Review cycle configs ──────────────────────────────────────────────────
  for (const b of ["LOW", "MEDIUM", "HIGH", "CRITICAL"]) {
    await prisma.reviewCycleConfig.upsert({
      where: { ratingBand: b },
      update: { reviewFrequencyDays: reviewDaysForBand(b) },
      create: { ratingBand: b, reviewFrequencyDays: reviewDaysForBand(b) },
    });
  }
  console.log("  review-cycle configs: 4 (LOW 365 / MEDIUM 180 / HIGH 90 / CRITICAL 30)");

  // ── CAPA source category + type ───────────────────────────────────────────
  const rtmCat = await prisma.capaSourceCategory.upsert({
    where: { code: "RISK_TREATMENT" },
    update: { name: "Risk Treatment", prefix: "RTM", sortOrder: 90, isActive: true },
    create: { code: "RISK_TREATMENT", name: "Risk Treatment", description: "CAPAs that execute enterprise-risk treatment plans.", prefix: "RTM", sortOrder: 90, isActive: true },
  });
  const rtmType = await prisma.capaSourceType.upsert({
    where: { code: "RISK_TREATMENT" },
    update: { name: "Risk Treatment", categoryId: rtmCat.id, parentModuleLive: true, parentModuleName: "ERM", isActive: true, sortOrder: 1 },
    create: { code: "RISK_TREATMENT", name: "Risk Treatment", categoryId: rtmCat.id, parentModuleLive: true, parentModuleName: "ERM", isActive: true, sortOrder: 1 },
  });
  console.log(`  CAPA source: category "${rtmCat.code}" + type "${rtmType.code}"`);

  // ── Rollup rules (created before risks so risks can reference rollupRuleId) ─
  const ruleNW = await prisma.rollupRule.create({
    data: {
      name: "North Paper Mill High-Band HSE Rollup",
      filterCriteria: { siteIds: [nw.id], minRiskBand: "HIGH", sourceModules: ["HIRA"] } as any,
      aggregationMode: "GROUPED", targetCategoryCode: "OPS", targetSubCategoryCode: "OPS-HSE", scoringMode: "MAX",
      lastRunAt: NOW, createdBy: croId,
    },
  });
  const ruleSW = await prisma.rollupRule.create({
    data: {
      name: "South Kraft & Board Mill High-Band HSE Rollup",
      filterCriteria: { siteIds: [sw.id], minRiskBand: "HIGH", sourceModules: ["HIRA"] } as any,
      aggregationMode: "GROUPED", targetCategoryCode: "OPS", targetSubCategoryCode: "OPS-HSE", scoringMode: "MAX",
      lastRunAt: NOW, createdBy: croId,
    },
  });
  const ruleENV = await prisma.rollupRule.create({
    data: {
      name: "Both-Plants Environmental Rollup",
      filterCriteria: { siteIds: [nw.id, sw.id], minRiskBand: "HIGH", sourceModules: ["EAI"] } as any,
      aggregationMode: "GROUPED", targetCategoryCode: "OPS", targetSubCategoryCode: "OPS-ENV", scoringMode: "MAX",
      lastRunAt: NOW, createdBy: croId,
    },
  });
  console.log("  rollup rules: 3 (NW HSE / SW HSE / both-plants ENV)");

  // ── The 24 enterprise risks ───────────────────────────────────────────────
  type RiskSpec = {
    code: string; title: string; subCode: string; il: number; ii: number; rl: number; ri: number;
    state: string; owner: string; velocity: string; orgLevel: "ENTERPRISE" | "SITE"; plant: "NW" | "SW" | null;
    sourceType: "MANUAL" | "HSE_ROLLUP"; rollupRuleId?: string; dominantDim: string;
    bumpPrior?: boolean; overdue?: boolean;
  };
  const RISKS: RiskSpec[] = [
    { code: "0001", title: "Demand contraction in core product segment", subCode: "STR-MKT", il: 4, ii: 4, rl: 3, ri: 4, state: "MONITORING", owner: "Anand K", velocity: "SLOW", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "FINANCIAL", bumpPrior: true },
    { code: "0002", title: "Low-cost competitor capacity addition", subCode: "STR-CMP", il: 4, ii: 3, rl: 3, ri: 3, state: "MONITORING", owner: "Anand K", velocity: "MODERATE", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "FINANCIAL" },
    { code: "0003", title: "South Kraft & Board Mill expansion cost overrun", subCode: "STR-EXP", il: 3, ii: 4, rl: 3, ri: 3, state: "TREATMENT_ACTIVE", owner: "Rajesh N", velocity: "MODERATE", orgLevel: "SITE", plant: "SW", sourceType: "MANUAL", dominantDim: "FINANCIAL", bumpPrior: true },
    { code: "0004", title: "USD/INR volatility on import payables", subCode: "FIN-FX", il: 4, ii: 3, rl: 2, ri: 3, state: "MONITORING", owner: "Rajesh N", velocity: "FAST", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "FINANCIAL", bumpPrior: true },
    { code: "0005", title: "Concentration of receivables — top 3 customers 58%", subCode: "FIN-CRD", il: 3, ii: 4, rl: 3, ri: 3, state: "TREATMENT_ACTIVE", owner: "Rajesh N", velocity: "MODERATE", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "FINANCIAL" },
    { code: "0006", title: "Raw material price escalation (pulpwood, recovered paper)", subCode: "FIN-CMD", il: 5, ii: 3, rl: 4, ri: 3, state: "TREATMENT_ACTIVE", owner: "Meera I", velocity: "FAST", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "FINANCIAL", bumpPrior: true },
    { code: "0007", title: "Working capital squeeze in seasonal cycle", subCode: "FIN-LIQ", il: 3, ii: 3, rl: 2, ri: 3, state: "MONITORING", owner: "Rajesh N", velocity: "FAST", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "FINANCIAL" },
    { code: "0008", title: "Aggregated HSE risk — North Paper Mill (rollup)", subCode: "OPS-HSE", il: 4, ii: 4, rl: 3, ri: 4, state: "MONITORING", owner: "Devendra K", velocity: "FAST", orgLevel: "SITE", plant: "NW", sourceType: "HSE_ROLLUP", rollupRuleId: ruleNW.id, dominantDim: "SAFETY", bumpPrior: true },
    { code: "0009", title: "Aggregated HSE risk — South Kraft & Board Mill (rollup)", subCode: "OPS-HSE", il: 4, ii: 3, rl: 3, ri: 3, state: "MONITORING", owner: "Lakshmi V", velocity: "FAST", orgLevel: "SITE", plant: "SW", sourceType: "HSE_ROLLUP", rollupRuleId: ruleSW.id, dominantDim: "SAFETY" },
    { code: "0010", title: "Aggregated environmental risk — both plants (rollup)", subCode: "OPS-ENV", il: 3, ii: 4, rl: 3, ri: 3, state: "MONITORING", owner: "Devendra K", velocity: "MODERATE", orgLevel: "ENTERPRISE", plant: null, sourceType: "HSE_ROLLUP", rollupRuleId: ruleENV.id, dominantDim: "REGULATORY" },
    { code: "0011", title: "Single-line dependency — North Paper Mill Line 3", subCode: "OPS-AST", il: 3, ii: 5, rl: 2, ri: 5, state: "TREATMENT_ACTIVE", owner: "Devendra K", velocity: "VERY_FAST", orgLevel: "SITE", plant: "NW", sourceType: "MANUAL", dominantDim: "BUSINESS_INTERRUPTION", bumpPrior: true },
    { code: "0012", title: "Quality escape to key packaging customer", subCode: "OPS-QUA", il: 3, ii: 4, rl: 2, ri: 4, state: "MONITORING", owner: "Lakshmi V", velocity: "FAST", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "REPUTATIONAL" },
    { code: "0013", title: "Factories Act compliance gaps — contractor records", subCode: "CMP-STA", il: 3, ii: 4, rl: 2, ri: 4, state: "TREATMENT_ACTIVE", owner: "Suresh P", velocity: "MODERATE", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "REGULATORY", overdue: true },
    { code: "0014", title: "Pending excise litigation — legacy demand", subCode: "CMP-LIT", il: 2, ii: 4, rl: 2, ri: 4, state: "ACCEPTED", owner: "Rajesh N", velocity: "SLOW", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "FINANCIAL" },
    { code: "0015", title: "CPCB consent renewal delay — South Kraft & Board Mill ETP", subCode: "CMP-LIC", il: 3, ii: 5, rl: 2, ri: 5, state: "TREATMENT_ACTIVE", owner: "Lakshmi V", velocity: "MODERATE", orgLevel: "SITE", plant: "SW", sourceType: "MANUAL", dominantDim: "REGULATORY", bumpPrior: true },
    { code: "0016", title: "Community grievance — North Paper Mill night logistics", subCode: "REP-COM", il: 3, ii: 3, rl: 2, ri: 3, state: "MONITORING", owner: "Suresh P", velocity: "MODERATE", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "REPUTATIONAL", overdue: true },
    { code: "0017", title: "Key customer audit failure risk", subCode: "REP-BRD", il: 2, ii: 4, rl: 2, ri: 3, state: "MONITORING", owner: "Meera I", velocity: "FAST", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "REPUTATIONAL" },
    { code: "0018", title: "Ransomware attack on plant IT/OT systems", subCode: "TEC-CYB", il: 4, ii: 5, rl: 3, ri: 4, state: "TREATMENT_ACTIVE", owner: "Kavita R", velocity: "VERY_FAST", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "BUSINESS_INTERRUPTION", bumpPrior: true },
    { code: "0019", title: "ERP single-instance availability failure", subCode: "TEC-AVL", il: 3, ii: 4, rl: 2, ri: 4, state: "MONITORING", owner: "Kavita R", velocity: "VERY_FAST", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "BUSINESS_INTERRUPTION" },
    { code: "0020", title: "BRSR disclosure error / assurance gap", subCode: "ESG-RPT", il: 3, ii: 3, rl: 2, ri: 3, state: "TREATMENT_ACTIVE", owner: "Anand K", velocity: "SLOW", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "REGULATORY" },
    { code: "0021", title: "Water stress — South Kraft & Board Mill groundwater dependency", subCode: "ESG-PHY", il: 4, ii: 4, rl: 3, ri: 4, state: "TREATMENT_ACTIVE", owner: "Lakshmi V", velocity: "SLOW", orgLevel: "SITE", plant: "SW", sourceType: "MANUAL", dominantDim: "BUSINESS_INTERRUPTION", bumpPrior: true },
    { code: "0022", title: "Single-source dependency — chlorine dioxide chemical vendor", subCode: "SCM-SRC", il: 4, ii: 4, rl: 3, ri: 4, state: "TREATMENT_ACTIVE", owner: "Meera I", velocity: "FAST", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "BUSINESS_INTERRUPTION", bumpPrior: true },
    { code: "0023", title: "Skilled operator attrition — both plants", subCode: "PPL-SKL", il: 4, ii: 3, rl: 3, ri: 3, state: "TREATMENT_ACTIVE", owner: "Suresh P", velocity: "MODERATE", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "BUSINESS_INTERRUPTION", overdue: true },
    { code: "0024", title: "Import tariff change on key raw material", subCode: "GEO-TRD", il: 3, ii: 4, rl: 3, ri: 4, state: "ESCALATED", owner: "Anand K", velocity: "FAST", orgLevel: "ENTERPRISE", plant: null, sourceType: "MANUAL", dominantDim: "FINANCIAL", bumpPrior: true },
  ];

  // narrative content keyed by code
  const narrative: Record<string, { desc: string; causes: string[]; consequences: string[]; controls: string[]; tags: string[] }> = {
    "0001": { desc: "Softening end-market demand in the core product segment (cause) leads to a sustained decline in order intake (event), reducing revenue and capacity utilisation (consequence).", causes: ["Macroeconomic slowdown", "Substitution by alternative materials", "Customer de-stocking"], consequences: ["Revenue shortfall", "Idle capacity / fixed-cost under-absorption", "Margin compression"], controls: ["Diversified customer base monitoring", "Rolling demand forecast reviews"], tags: ["strategy", "demand"] },
    "0002": { desc: "A low-cost competitor commissioning new capacity (cause) triggers aggressive price competition (event), eroding Page Industries's market share and pricing power (consequence).", causes: ["New entrant capacity addition", "Import competition", "Price-led customer switching"], consequences: ["Market share loss", "Price erosion", "Reduced contribution margin"], controls: ["Competitive intelligence tracking", "Value-differentiation strategy"], tags: ["strategy", "competition"] },
    "0003": { desc: "Scope creep and input-cost inflation on the South Kraft & Board Mill expansion (cause) cause the project to overrun its sanctioned budget (event), straining capital allocation and returns (consequence).", causes: ["Scope changes mid-project", "Construction material inflation", "Schedule slippage"], consequences: ["Capital overrun", "Delayed capacity availability", "Lower project IRR"], controls: ["Stage-gate project governance", "Monthly cost-to-complete reviews"], tags: ["capex", "south-works"] },
    "0004": { desc: "Sharp USD/INR depreciation (cause) increases the rupee cost of unhedged import payables (event), inflating landed material cost and hurting margins (consequence).", causes: ["Currency volatility", "Unhedged exposure window", "Global rate moves"], consequences: ["Higher import cost", "Margin volatility", "Forecast variance"], controls: ["Forward-cover hedging policy", "Treasury exposure dashboard"], tags: ["forex", "treasury"] },
    "0005": { desc: "High revenue concentration in the top three customers (cause) creates outsized exposure to a single customer default or exit (event), risking a large receivables write-off (consequence).", causes: ["Customer concentration (58%)", "Extended credit terms", "Sector-correlated customers"], consequences: ["Bad-debt write-off", "Liquidity strain", "Earnings shock"], controls: ["Credit-limit framework", "Aging & DSO monitoring"], tags: ["credit", "receivables"] },
    "0006": { desc: "Volatility in pulpwood and recovered-paper (waste paper) prices (cause) raises raw-material cost faster than selling prices can be reset (event), compressing gross margin (consequence).", causes: ["Commodity price spikes", "Pass-through lag in contracts", "Supplier price hikes"], consequences: ["Gross-margin erosion", "Quote competitiveness loss", "Inventory valuation swings"], controls: ["Index-linked pricing clauses", "Strategic raw-material inventory"], tags: ["commodity", "margin"] },
    "0007": { desc: "Seasonal working-capital build-up (cause) combined with delayed collections (event) tightens liquidity headroom during peak inventory months (consequence).", causes: ["Seasonal inventory build", "Collection delays", "Supplier advance demands"], consequences: ["Liquidity squeeze", "Higher short-term borrowing", "Covenant pressure"], controls: ["13-week cash-flow forecast", "Committed working-capital lines"], tags: ["liquidity", "seasonal"] },
    "0008": { desc: "Concentration of HIGH/CRITICAL residual hazards across North Paper Mill activities (cause) raises the aggregated likelihood of a serious safety event (event), risking injury and operational disruption (consequence). Auto-rolled-up from the HIRA register.", causes: ["High-residual HIRA hazards", "Aging guarding on legacy lines", "Contractor density"], consequences: ["Serious injury / LTI", "Regulatory scrutiny", "Production stoppage"], controls: ["HIRA control hierarchy", "Daily safety walkdowns", "PTW gate enforcement"], tags: ["hse", "rollup", "north-works"] },
    "0009": { desc: "Aggregated HIGH/CRITICAL residual hazards across South Kraft & Board Mill (cause) elevate the combined probability of a significant safety incident (event), threatening worker safety and continuity (consequence). Auto-rolled-up from the HIRA register.", causes: ["High-residual HIRA hazards", "New-line ramp-up exposure", "Heat-stress conditions"], consequences: ["Serious injury / LTI", "Regulatory action", "Output loss"], controls: ["HIRA control hierarchy", "Shift safety briefings", "PTW gate enforcement"], tags: ["hse", "rollup", "south-works"] },
    "0010": { desc: "Aggregated significant environmental aspects across both plants (cause) increase the chance of an exceedance or pollution event (event), risking regulatory penalties and reputational harm (consequence). Auto-rolled-up from the EAI register.", causes: ["Significant EAI aspects", "Effluent / emission load", "Ambient stress"], consequences: ["Consent exceedance", "Regulatory penalty", "Community concern"], controls: ["Continuous emission monitoring", "ETP/STP operations governance"], tags: ["environment", "rollup"] },
    "0011": { desc: "Critical dependency on a single production line at North Paper Mill (cause) means an extended Line 3 breakdown (event) would halt a major product family and breach customer commitments (consequence).", causes: ["No redundant line", "Aging critical equipment", "Long spares lead time"], consequences: ["Extended production halt", "Customer SLA breach", "Revenue loss"], controls: ["Preventive maintenance plan", "Critical-spares holding"], tags: ["asset", "single-point", "north-works"] },
    "0012": { desc: "An undetected paper quality defect (cause) escaping to a key packaging/publisher customer (event) could trigger a reel rejection / press-stop claim and damage the relationship (consequence).", causes: ["Inspection escape", "Process drift", "Inadequate reel-quality control"], consequences: ["Customer press-stop claim", "Reputational damage", "Reel rejection cost"], controls: ["SPC at critical stations", "Final inspection gates"], tags: ["quality", "customer"] },
    "0013": { desc: "Incomplete contractor statutory records (cause) discovered during a labour inspection (event) could result in a Factories Act / CLRA non-compliance notice and penalty (consequence).", causes: ["Incomplete contractor records", "Manual register gaps", "High contractor churn"], consequences: ["Statutory notice", "Penalty / prosecution risk", "Operational restriction"], controls: ["Contractor compliance checklist", "Digital register reconciliation"], tags: ["compliance", "contractor"] },
    "0014": { desc: "A legacy excise demand under litigation (cause) could be ruled against Page Industries (event), crystallising a financial liability already provisioned in part (consequence). The board has accepted this residual risk.", causes: ["Adverse tribunal interpretation", "Legacy classification dispute"], consequences: ["Crystallised tax liability", "Interest / penalty exposure"], controls: ["Specialist tax counsel", "Provisioning per accounting policy"], tags: ["litigation", "tax"] },
    "0015": { desc: "Delay in renewing the CPCB consent-to-operate for the South Kraft & Board Mill ETP (cause) could leave the plant operating without valid consent (event), exposing it to a closure direction (consequence).", causes: ["Renewal application delay", "Pending compliance conditions", "Regulatory backlog"], consequences: ["Operation without consent", "Closure direction", "Penalty"], controls: ["Consent-renewal tracker", "Pre-emptive compliance closure"], tags: ["compliance", "environment", "south-works"] },
    "0016": { desc: "Night-time logistics movements near a residential cluster at North Paper Mill (cause) generate noise and traffic grievances (event), risking community escalation and adverse publicity (consequence).", causes: ["Night-shift truck movements", "Noise near residences", "Limited grievance redress"], consequences: ["Community protest", "Local media coverage", "Operating-hour restriction"], controls: ["Community grievance mechanism", "Routing & timing controls"], tags: ["community", "north-works"] },
    "0017": { desc: "Gaps in a key customer's quality/social audit readiness (cause) could lead to an audit failure (event), jeopardising approved-supplier status (consequence).", causes: ["Audit-readiness gaps", "Documentation lapses", "Process non-conformance"], consequences: ["Loss of approved-supplier status", "Order diversion", "Reputational harm"], controls: ["Mock-audit programme", "CAPA closure discipline"], tags: ["customer", "audit"] },
    "0018": { desc: "A successful ransomware intrusion into plant IT/OT systems (cause) could encrypt control and ERP systems (event), halting production and exposing data (consequence).", causes: ["Phishing / credential theft", "Unsegmented OT network", "Unpatched systems"], consequences: ["Production shutdown", "Data exfiltration", "Ransom & recovery cost"], controls: ["EDR + network segmentation", "Immutable backups & DR drills"], tags: ["cyber", "ot"] },
    "0019": { desc: "Reliance on a single ERP instance without hot standby (cause) means an infrastructure failure (event) would interrupt order-to-cash and planning across both plants (consequence).", causes: ["Single-instance architecture", "No hot standby", "Aging infrastructure"], consequences: ["Order-to-cash disruption", "Planning blackout", "Revenue deferral"], controls: ["Daily backups", "DR runbook"], tags: ["technology", "availability"] },
    "0020": { desc: "Errors or assurance gaps in BRSR disclosures (cause) could surface during external assurance (event), leading to restatement and regulatory/investor scrutiny (consequence).", causes: ["Data-quality gaps", "Manual ESG data collation", "Late assurance engagement"], consequences: ["Disclosure restatement", "Regulatory query", "Investor concern"], controls: ["ESG data governance", "Pre-assurance internal review"], tags: ["esg", "disclosure"] },
    "0021": { desc: "Over-reliance on declining groundwater at South Kraft & Board Mill (cause) during a drought year (event) could force production curtailment and invite regulatory limits (consequence).", causes: ["Declining water table", "Drought conditions", "High specific water use"], consequences: ["Production curtailment", "Abstraction limits", "Higher water cost"], controls: ["Water recycling & ZLD roadmap", "Rainwater harvesting"], tags: ["climate", "water", "south-works"] },
    "0022": { desc: "Dependence on a single qualified vendor for chlorine dioxide (bleaching chemical) (cause) means a vendor disruption (event) would stop production of dependent bleached-grade SKUs (consequence).", causes: ["Single qualified source", "No alternate qualification", "Vendor financial stress"], consequences: ["Input stock-out", "Production halt for dependent SKUs", "Expedite premiums"], controls: ["Buffer inventory", "Alternate-vendor qualification (in progress)"], tags: ["supply-chain", "single-source"] },
    "0023": { desc: "Rising attrition of skilled operators across both plants (cause) erodes the experienced workforce (event), degrading throughput, quality and safety performance (consequence).", causes: ["Competitive labour market", "Limited career pathing", "Wage pressure"], consequences: ["Throughput / quality decline", "Higher training load", "Safety risk from inexperience"], controls: ["Retention & skilling programmes", "Cross-skilling matrix"], tags: ["people", "attrition"] },
    "0024": { desc: "An adverse change in import tariffs on a key raw material (cause) raises landed cost or restricts supply (event), squeezing margins and threatening continuity (consequence). Escalated for board attention.", causes: ["Tariff / duty revision", "Trade-policy shift", "Anti-dumping action"], consequences: ["Higher input cost", "Supply restriction", "Margin shock"], controls: ["Tariff-scenario monitoring", "Domestic-source development"], tags: ["geopolitical", "tariff"] },
  };

  // identifiedDate spread over last 6 months
  const identifiedDates = [165, 158, 150, 142, 135, 128, 120, 112, 104, 96, 90, 84, 78, 72, 66, 60, 54, 48, 42, 36, 30, 24, 18, 12];

  const riskIdByCode = new Map<string, string>();
  const riskRowByCode = new Map<string, RiskSpec>();
  let bumpedPrior = 0;

  for (let i = 0; i < RISKS.length; i++) {
    const r = RISKS[i];
    const n = narrative[r.code];
    const inherentScore = r.il * r.ii;
    const residualScore = r.rl * r.ri;
    const inherentBand = bandFor(inherentScore);
    const residualBand = bandFor(residualScore);
    const plantId = r.plant === "NW" ? nw.id : r.plant === "SW" ? sw.id : null;
    const ownerId = uid(ownerEmail[r.owner]);
    const championId = r.plant === "SW" ? championSW : championNW;
    const subCategoryId = subCatIdByCode.get(r.subCode)!;
    const categoryId = catIdByCode.get(r.subCode.split("-")[0])!;
    const identifiedDate = daysAgo(identifiedDates[i]);

    // prior residual: bump one band higher for ~10 risks, else equal to current
    let priorResidualScore = residualScore;
    let priorResidualBand = residualBand;
    if (r.bumpPrior) {
      // raise residual likelihood by 1 (capped at 5) for a higher prior score
      const priorL = Math.min(5, r.rl + 1);
      priorResidualScore = priorL * r.ri;
      priorResidualBand = bandFor(priorResidualScore);
      bumpedPrior++;
    }

    // nextReviewDate: overdue ones in the past, else compute from residual band
    let nextReviewDate: Date;
    if (r.overdue) {
      nextReviewDate = r.code === "0016" ? daysAgo(22) : daysAgo(40); // amber vs red
    } else {
      nextReviewDate = daysFromNow(reviewDaysForBand(residualBand) - 14);
    }

    const riskCode = `ERM-2026-${r.code}`;
    const created = await prisma.enterpriseRisk.create({
      data: {
        riskCode, title: r.title, description: n.desc,
        categoryId, subCategoryId,
        orgLevel: r.orgLevel, plantId,
        riskOwnerId: ownerId, riskChampionId: championId,
        lifecycleState: r.state, velocity: r.velocity,
        sourceType: r.sourceType, rollupRuleId: r.rollupRuleId ?? null,
        identifiedDate, nextReviewDate,
        tags: n.tags as any, causes: n.causes as any, consequences: n.consequences as any, existingControls: n.controls as any,
        inherentLikelihood: r.il, inherentImpact: r.ii, inherentScore, inherentBand,
        residualLikelihood: r.rl, residualImpact: r.ri, residualScore, residualBand,
        priorResidualScore, priorResidualBand,
        escalatedAt: r.state === "ESCALATED" ? daysAgo(9) : null,
        createdBy: championId,
      },
    });
    riskIdByCode.set(r.code, created.id);
    riskRowByCode.set(r.code, r);

    // ── Assessments: INHERENT + RESIDUAL ──
    const secondaryDim = r.dominantDim === "FINANCIAL" ? "REPUTATIONAL" : "FINANCIAL";
    const assessmentDate = daysAgo(identifiedDates[i] - 4 > 0 ? identifiedDates[i] - 4 : 2);
    const mkImpactScores = (impactLvl: number) => [
      { dimension: r.dominantDim, level: impactLvl },
      { dimension: secondaryDim, level: Math.max(1, impactLvl - 1) },
    ];
    await prisma.riskAssessment.create({
      data: {
        riskId: created.id, matrixConfigId: matrix.id, matrixVersion: 1,
        assessmentType: "INHERENT", likelihood: r.il,
        impactScores: mkImpactScores(r.ii) as any, dominantImpactDimension: r.dominantDim,
        overallImpact: r.ii, totalScore: inherentScore, ratingBand: inherentBand,
        assessmentDate, assessedBy: championId,
        rationale: `Inherent (pre-control) assessment: ${r.dominantDim.toLowerCase()} impact rated ${r.ii} against a likelihood of ${r.il}, before crediting existing controls.`,
        isCurrent: true, createdBy: championId,
      },
    });
    await prisma.riskAssessment.create({
      data: {
        riskId: created.id, matrixConfigId: matrix.id, matrixVersion: 1,
        assessmentType: "RESIDUAL", likelihood: r.rl,
        impactScores: mkImpactScores(r.ri) as any, dominantImpactDimension: r.dominantDim,
        overallImpact: r.ri, totalScore: residualScore, ratingBand: residualBand,
        assessmentDate, assessedBy: championId,
        rationale: `Residual assessment after crediting controls (${n.controls.join("; ")}). Likelihood reduced to ${r.rl}; net residual band ${residualBand}.`,
        isCurrent: true, createdBy: championId,
      },
    });
  }
  console.log(`  enterprise risks: ${RISKS.length} (each with INHERENT + RESIDUAL assessment) — ${bumpedPrior} with bumped prior-quarter scores`);

  // ── Risk 0014 acceptance ────────────────────────────────────────────────
  await prisma.enterpriseRisk.update({
    where: { id: riskIdByCode.get("0014")! },
    data: {
      acceptanceJustification: "Residual exposure is within board risk appetite for legacy tax matters. The demand is partly provisioned per accounting policy, specialist counsel rates the adverse-outcome probability as low, and any liability is non-operational. RMC has formally accepted (TOLERATE) this risk with annual review.",
      acceptedBy: croId, acceptedAt: daysAgo(20),
    },
  });

  // ── Rollup linkages (HIRA for 0008/0009, EAI for 0010) ────────────────────
  async function pickHiraEntries(plantId: string, want = 8) {
    let entries = await prisma.hiraEntry.findMany({
      where: { isCurrentVersion: true, study: { plantId }, residualRiskLevel: { in: ["HIGH", "CRITICAL"] } },
      select: { id: true, activityDescription: true, residualRiskScore: true, residualRiskLevel: true, initialRiskScore: true, initialRiskLevel: true },
      orderBy: { residualRiskScore: "desc" }, take: want,
    });
    if (entries.length < 6) {
      entries = await prisma.hiraEntry.findMany({
        where: { isCurrentVersion: true, study: { plantId } },
        select: { id: true, activityDescription: true, residualRiskScore: true, residualRiskLevel: true, initialRiskScore: true, initialRiskLevel: true },
        orderBy: { residualRiskScore: "desc" }, take: want,
      });
    }
    return entries;
  }
  async function pickEaiEntries(plantId: string, want = 5) {
    return prisma.eaiEntry.findMany({
      where: { isCurrentVersion: true, study: { plantId } },
      select: { id: true, activityDescription: true, residualImpactScore: true, residualImpactLevel: true, initialImpactScore: true, initialImpactLevel: true },
      orderBy: { residualImpactScore: "desc" }, take: want,
    });
  }

  let rollupCount = 0;
  const rollupSummary: Record<string, number> = {};
  async function linkHira(riskCode: string, ruleId: string, plantId: string, want: number) {
    const riskId = riskIdByCode.get(riskCode)!;
    const entries = await pickHiraEntries(plantId, want);
    let made = 0;
    for (const e of entries) {
      const score = e.residualRiskScore ?? e.initialRiskScore ?? 1;
      const band = normBand(e.residualRiskLevel ?? e.initialRiskLevel);
      try {
        await prisma.rollupLinkage.create({
          data: {
            enterpriseRiskId: riskId, rollupRuleId: ruleId,
            sourceRegisterEntryId: e.id, sourceModule: "HIRA",
            sourceRef: e.activityDescription, contributingScore: score, contributingBand: band,
          },
        });
        made++; rollupCount++;
      } catch { /* unique dup — skip */ }
    }
    rollupSummary[riskCode] = made;
    return made;
  }
  async function linkEai(riskCode: string, ruleId: string, plantId: string, want: number) {
    const riskId = riskIdByCode.get(riskCode)!;
    const entries = await pickEaiEntries(plantId, want);
    let made = 0;
    for (const e of entries) {
      const score = e.residualImpactScore ?? e.initialImpactScore ?? 1;
      const band = normBand(e.residualImpactLevel ?? e.initialImpactLevel);
      try {
        await prisma.rollupLinkage.create({
          data: {
            enterpriseRiskId: riskId, rollupRuleId: ruleId,
            sourceRegisterEntryId: e.id, sourceModule: "EAI",
            sourceRef: e.activityDescription, contributingScore: score, contributingBand: band,
          },
        });
        made++; rollupCount++;
      } catch { /* unique dup — skip */ }
    }
    rollupSummary[riskCode] = (rollupSummary[riskCode] ?? 0) + made;
    return made;
  }

  const nwLinks = await linkHira("0008", ruleNW.id, nw.id, 8);
  const swLinks = await linkHira("0009", ruleSW.id, sw.id, 8);
  // ENV: link entries from both plants (split the budget)
  const envNW = await linkEai("0010", ruleENV.id, nw.id, 5);
  const envSW = await linkEai("0010", ruleENV.id, sw.id, 5);
  console.log(`  rollup linkages: ${rollupCount} total — 0008(NW)=${nwLinks}, 0009(SW)=${swLinks}, 0010(ENV)=${envNW + envSW}`);

  // ── Inter-risk linkages ───────────────────────────────────────────────────
  const linkages: { src: string; tgt: string; type: string; notes: string }[] = [
    { src: "0024", tgt: "0006", type: "TRIGGERS", notes: "A tariff increase on imported raw material directly drives up commodity input cost." },
    { src: "0006", tgt: "0007", type: "AMPLIFIES", notes: "Higher raw-material cost enlarges working-capital and inventory funding needs." },
    { src: "0022", tgt: "0011", type: "TRIGGERS", notes: "A single-source bleaching-chemical disruption can force a stoppage on the dependent North Paper Mill line." },
    { src: "0018", tgt: "0019", type: "TRIGGERS", notes: "A ransomware event would likely take down the single-instance ERP as well." },
    { src: "0021", tgt: "0015", type: "AMPLIFIES", notes: "Water stress increases effluent concentration pressure, worsening the ETP consent position." },
    { src: "0001", tgt: "0002", type: "CORRELATED", notes: "Soft demand and intensifying competition tend to move together in the core segment." },
  ];
  let linkageCount = 0;
  for (const l of linkages) {
    try {
      await prisma.riskLinkage.create({
        data: { sourceRiskId: riskIdByCode.get(l.src)!, targetRiskId: riskIdByCode.get(l.tgt)!, linkageType: l.type, notes: l.notes },
      });
      linkageCount++;
    } catch { /* dup — skip */ }
  }
  console.log(`  inter-risk linkages: ${linkageCount}`);

  // ── Treatment CAPAs ───────────────────────────────────────────────────────
  type CapaSpec = {
    riskCode: string; strategy: "TREAT" | "TRANSFER" | "TERMINATE"; title: string; problem: string;
    state: string; severity: string; priority: string; overdue?: boolean; expectedReduction: string;
  };
  const CAPAS: CapaSpec[] = [
    { riskCode: "0003", strategy: "TREAT", title: "Tighten South Kraft & Board Mill expansion cost controls", problem: "Project trending above sanctioned budget; reinforce stage-gate cost governance and change control.", state: "ACTIONS_IN_PROGRESS", severity: "HIGH", priority: "HIGH", expectedReduction: "Hold residual at MEDIUM by capping overrun" },
    { riskCode: "0005", strategy: "TRANSFER", title: "Place trade-credit insurance on top customers", problem: "Receivables concentration in top 3 customers; transfer default risk via trade-credit insurance.", state: "ACTIONS_PLANNED", severity: "HIGH", priority: "HIGH", expectedReduction: "Cap bad-debt exposure; residual MEDIUM" },
    { riskCode: "0006", strategy: "TREAT", title: "Implement index-linked pricing clauses", problem: "Raw-material cost escalation outpaces price resets; introduce index-linked pass-through clauses.", state: "ACTIONS_IN_PROGRESS", severity: "HIGH", priority: "HIGH", expectedReduction: "Reduce margin volatility; residual MEDIUM" },
    { riskCode: "0006", strategy: "TREAT", title: "Build strategic raw-material buffer stock", problem: "Price-spike exposure on pulpwood/recovered paper; establish a strategic buffer-inventory policy.", state: "ACTIONS_PLANNED", severity: "HIGH", priority: "HIGH", expectedReduction: "Smooth price shocks; residual MEDIUM" },
    { riskCode: "0011", strategy: "TRANSFER", title: "Place machinery breakdown insurance on Line 3", problem: "Single-line dependency at North Paper Mill Line 3; transfer breakdown loss via insurance placement.", state: "PENDING_VERIFICATION", severity: "HIGH", priority: "HIGH", expectedReduction: "Transfer financial loss; residual HIGH" },
    { riskCode: "0013", strategy: "TREAT", title: "Digitise & reconcile contractor statutory records", problem: "Contractor record gaps risk a Factories Act/CLRA notice; digitise and reconcile registers.", state: "ACTIONS_IN_PROGRESS", severity: "HIGH", priority: "HIGH", overdue: true, expectedReduction: "Close compliance gaps; residual MEDIUM" },
    { riskCode: "0015", strategy: "TREAT", title: "Expedite South Kraft & Board Mill ETP consent renewal", problem: "CPCB consent renewal lagging; close pending conditions and expedite the renewal application.", state: "ACTIONS_PLANNED", severity: "HIGH", priority: "HIGH", expectedReduction: "Restore valid consent; residual HIGH" },
    { riskCode: "0018", strategy: "TREAT", title: "OT network segmentation & immutable backups", problem: "Ransomware exposure on IT/OT; segment the OT network and deploy immutable, tested backups.", state: "ACTIONS_IN_PROGRESS", severity: "CRITICAL", priority: "URGENT", overdue: true, expectedReduction: "Reduce likelihood; residual HIGH" },
    { riskCode: "0020", strategy: "TREAT", title: "Stand up BRSR data governance & pre-assurance", problem: "BRSR disclosure assurance gap; establish ESG data governance and internal pre-assurance review.", state: "VERIFIED", severity: "HIGH", priority: "HIGH", expectedReduction: "Reduce disclosure error; residual MEDIUM" },
    { riskCode: "0021", strategy: "TREAT", title: "Commission water recycling & rainwater harvesting", problem: "Groundwater dependency at South Kraft & Board Mill; reduce abstraction via recycling and harvesting.", state: "ACTIONS_PLANNED", severity: "HIGH", priority: "HIGH", expectedReduction: "Cut freshwater draw; residual HIGH" },
    { riskCode: "0022", strategy: "TERMINATE", title: "Qualify alternate chlorine-dioxide vendor", problem: "Single-source bleaching-chemical dependency; qualify an alternate vendor to terminate the single point of failure.", state: "ACTIONS_IN_PROGRESS", severity: "HIGH", priority: "HIGH", expectedReduction: "Eliminate single source; residual MEDIUM" },
    { riskCode: "0023", strategy: "TREAT", title: "Launch operator retention & cross-skilling programme", problem: "Skilled-operator attrition across both plants; deploy retention incentives and cross-skilling.", state: "CLOSED", severity: "HIGH", priority: "HIGH", expectedReduction: "Stabilise skilled headcount; residual MEDIUM" },
  ];

  const plantSeq: Record<string, number> = { NW: 0, SW: 0 };
  let capaCount = 0;
  for (const c of CAPAS) {
    const r = riskRowByCode.get(c.riskCode)!;
    const riskId = riskIdByCode.get(c.riskCode)!;
    const plantId = r.plant === "SW" ? sw.id : r.plant === "NW" ? nw.id : nw.id;
    const plantCode = plantId === sw.id ? "SW" : "NW";
    plantSeq[plantCode] += 1;
    const seq = String(plantSeq[plantCode]).padStart(3, "0");
    const capaNumber = `CAPA-RTM-2026-${plantCode}-${seq}`;
    const ownerId = uid(ownerEmail[r.owner]);
    const detectedAt = daysAgo(c.overdue ? 80 : 55);
    const closureTargetDate = c.overdue ? daysAgo(8) : daysFromNow(60);
    const isClosed = c.state === "CLOSED";
    const isVerified = c.state === "VERIFIED" || isClosed;
    try {
      await prisma.capa.create({
        data: {
          capaNumber, title: c.title, plantId,
          sourceCategoryId: rtmCat.id, sourceTypeId: rtmType.id, sourceTypeCode: "RISK_TREATMENT",
          sourceReferenceId: riskId, sourceReferenceUrl: `/erm/risks/${riskId}`,
          sourceReferenceSummary: `ERM-2026-${c.riskCode} — ${r.title}`,
          sourceMetadata: { treatmentStrategy: c.strategy, expectedResidualReduction: c.expectedReduction, riskCode: `ERM-2026-${c.riskCode}` } as any,
          problemDescription: c.problem, detectionMethod: "ERM_TREATMENT", detectedAt, detectedByUserId: ownerId,
          primaryCategory: "Risk Treatment", severity: c.severity, priority: c.priority,
          state: c.state, stateChangedAt: c.state === "DRAFT" ? detectedAt : daysAgo(c.overdue ? 5 : 3),
          closureTargetDate,
          closedAt: isClosed ? daysAgo(2) : null, closedByUserId: isClosed ? ownerId : null,
          verificationCompletedAt: isVerified ? daysAgo(4) : null,
          raisedByUserId: ownerId, primaryOwnerUserId: ownerId, createdByUserId: ownerId,
        },
      });
      capaCount++;
    } catch (e) {
      console.warn(`  (capa ${capaNumber} failed: ${(e as Error).message})`);
    }
  }
  console.log(`  treatment CAPAs: ${capaCount} (TREAT/TRANSFER/TERMINATE; 2 overdue)`);

  // ── Prior-quarter snapshots (Q4 FY26) ─────────────────────────────────────
  const snapshotDate = new Date("2026-03-31T00:00:00.000Z");
  let snapCount = 0;
  for (const r of RISKS) {
    const inherentScore = r.il * r.ii;
    const residualScore = r.rl * r.ri;
    let priorScore = residualScore;
    let priorBand = bandFor(residualScore);
    if (r.bumpPrior) {
      const priorL = Math.min(5, r.rl + 1);
      priorScore = priorL * r.ri; priorBand = bandFor(priorScore);
    }
    const priorL = r.bumpPrior ? Math.min(5, r.rl + 1) : r.rl;
    try {
      await prisma.ermRiskSnapshot.create({
        data: {
          quarterLabel: "Q4 FY26", snapshotDate,
          riskId: riskIdByCode.get(r.code)!, riskCode: `ERM-2026-${r.code}`,
          categoryCode: r.subCode.split("-")[0],
          inherentScore, inherentBand: bandFor(inherentScore),
          residualScore: priorScore, residualBand: priorBand,
          likelihood: priorL, overallImpact: r.ri, lifecycleState: r.state,
        },
      });
      snapCount++;
    } catch { /* dup — skip */ }
  }
  console.log(`  prior-quarter snapshots (Q4 FY26): ${snapCount}`);

  // ── Risk reviews ──────────────────────────────────────────────────────────
  // 2 completed reviews each on 5 risks
  const reviewRisks = ["0001", "0004", "0008", "0018", "0022"];
  let reviewCount = 0;
  for (const code of reviewRisks) {
    const r = riskRowByCode.get(code)!;
    const championId = r.plant === "SW" ? championSW : championNW;
    const reviews = [
      { date: daysAgo(190), outcome: "NO_CHANGE", notes: "Periodic review: controls operating as designed; no change to scoring this cycle." },
      { date: daysAgo(95), outcome: "RESCORED", notes: "Treatment progress credited; residual likelihood re-evaluated and confirmed at current band." },
    ];
    for (const rv of reviews) {
      try {
        await prisma.riskReview.create({
          data: { riskId: riskIdByCode.get(code)!, reviewDate: rv.date, reviewedBy: championId, outcome: rv.outcome, notes: rv.notes },
        });
        reviewCount++;
      } catch { /* skip */ }
    }
  }
  // overdue badges already encoded in nextReviewDate via r.overdue (0016 amber, 0013 + 0023 red)
  console.log(`  risk reviews: ${reviewCount} (overdue: 0016 amber, 0013 + 0023 red)`);

  // ── Board pack (draft) ────────────────────────────────────────────────────
  await prisma.ermBoardPack.create({
    data: {
      title: "Q1 FY27 Risk Management Committee Pack", quarterLabel: "Q1 FY27",
      periodStart: new Date("2026-04-01T00:00:00.000Z"), periodEnd: new Date("2026-06-30T00:00:00.000Z"),
      status: "DRAFT",
      sections: { executiveSummary: true, heatMap: true, top10: true, movement: true, treatmentStatus: true, newRisks: true, escalations: true } as any,
      commentary: {
        [riskIdByCode.get("0024")!]: "<p><strong>Escalated:</strong> import-tariff change on a key raw material; domestic-source development underway.</p>",
        [riskIdByCode.get("0018")!]: "<p>Cyber/OT remains the top technology exposure; segmentation and immutable-backup programme in progress.</p>",
        [riskIdByCode.get("0011")!]: "<p>Single-line dependency at North Paper Mill Line 3 carries the highest residual impact; insurance placement pending verification.</p>",
      } as any,
      createdBy: croId,
    },
  });
  console.log("  board pack: 1 (DRAFT, Q1 FY27)");

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = {
    categories: await prisma.riskCategory.count(),
    subCategories: await prisma.riskSubCategory.count(),
    matrices: await prisma.scoringMatrixConfig.count(),
    reviewConfigs: await prisma.reviewCycleConfig.count(),
    personas: await prisma.user.count({ where: { email: { in: personaEmails } } }),
    risks: await prisma.enterpriseRisk.count({ where: ermRiskWhere }),
    assessments: await prisma.riskAssessment.count({ where: { risk: ermRiskWhere } }),
    rollupRules: await prisma.rollupRule.count(),
    rollupLinkages: await prisma.rollupLinkage.count({ where: { enterpriseRisk: ermRiskWhere } }),
    riskLinkages: await prisma.riskLinkage.count({ where: { sourceRisk: ermRiskWhere } }),
    treatmentCapas: await prisma.capa.count({ where: { sourceTypeCode: "RISK_TREATMENT" } }),
    snapshots: await prisma.ermRiskSnapshot.count({ where: { riskCode: { startsWith: "ERM-2026-" } } }),
    reviews: await prisma.riskReview.count({ where: { risk: ermRiskWhere } }),
    boardPacks: await prisma.ermBoardPack.count(),
  };
  console.log("\n  ── ERM seed summary ─────────────────────────");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`     ${k.padEnd(16)} : ${v}`);
  }
  console.log(`     rollup detail   : 0008=${rollupSummary["0008"]} 0009=${rollupSummary["0009"]} 0010=${rollupSummary["0010"]}`);
  console.log("✅  ERM seed complete.");
}

main()
  .catch((e) => { console.error("❌ seed-erm failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
