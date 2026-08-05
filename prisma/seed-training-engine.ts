// Training & Competency Engine — demo seed (idempotent, additive).
//   npm run db:seed-training-engine   (after db:apply-training-engine + prisma generate)
//
// Seeds the admin-configurable HazardToSkill mappings, vendor-decoupled demo
// TrainingContent for the top high-frequency skill nodes, and the global rule
// config. Purely upsert-by-natural-key — safe to re-run. Competencies resolve by
// code (with a name fallback) so this adapts to whatever the 170-competency
// library seeded. NO deleteMany; touches only its own tables.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Topic = {
  key: string;
  codes: string[];      // preferred competency codes, in priority order
  nameLike?: string;    // fallback: name ILIKE '%nameLike%'
  obsCategory?: string; // ObservationCategory enum value → exact category mapping
  keywords: string[];   // keyword-mode mappings (match the record's text blob)
  content: {
    title: string;
    contentType: string;   // video | document | quiz | vr_package | ar_package | external_link
    deliveryMode: string;  // hosted | external_redirect | local_package
    durationMinutes?: number;
    passingScore?: number;
  };
};

const TOPICS: Topic[] = [
  {
    key: "confined_space",
    codes: ["CS-ENTRANT-L1", "CS-ENTRANT-L2"],
    nameLike: "confined",
    obsCategory: "CONFINED_SPACE",
    keywords: ["confined space", "gas test", "entry permit"],
    content: { title: "Confined Space Entry — Core Awareness", contentType: "video", deliveryMode: "hosted", durationMinutes: 25 },
  },
  {
    key: "loto",
    codes: ["LOTO-AUTH", "ELEC-AUTH-LV"],
    nameLike: "lockout",
    obsCategory: "ELECTRICAL",
    keywords: ["lockout", "loto", "isolation", "energy control", "de-energize"],
    content: { title: "Lockout / Tagout — Energy Isolation", contentType: "video", deliveryMode: "hosted", durationMinutes: 20 },
  },
  {
    key: "work_at_height",
    codes: ["WORK-HEIGHT-L1", "WORK-HEIGHT-L2"],
    nameLike: "height",
    obsCategory: "WORK_AT_HEIGHT",
    keywords: ["work at height", "fall protection", "fall arrest", "scaffold"],
    content: { title: "Work at Height — Fall Protection Basics", contentType: "video", deliveryMode: "hosted", durationMinutes: 30 },
  },
  {
    key: "hot_work_fire",
    codes: ["HOT-WORK-WELDER-SMAW", "FIRE-WARDEN"],
    nameLike: "hot work",
    obsCategory: "HOT_WORK",
    keywords: ["hot work", "welding", "fire watch", "spark"],
    content: { title: "Hot Work & Fire Watch — Safe Practice", contentType: "document", deliveryMode: "hosted", durationMinutes: 15 },
  },
  {
    key: "mobile_equipment",
    codes: ["FORKLIFT-OP", "CRANE-OP-MOBILE"],
    nameLike: "forklift",
    obsCategory: "MOBILE_EQUIPMENT",
    keywords: ["forklift", "mobile equipment", "pedestrian", "reversing"],
    content: { title: "Powered Mobile Equipment — Pedestrian Safety", contentType: "video", deliveryMode: "hosted", durationMinutes: 18 },
  },
  {
    key: "ppe",
    codes: ["PPE-USER", "HSE-FOUNDATION"],
    nameLike: "protective",
    obsCategory: "PPE",
    keywords: ["ppe", "personal protective", "respirator", "hearing protection"],
    content: { title: "PPE Selection & Use", contentType: "quiz", deliveryMode: "hosted", durationMinutes: 12, passingScore: 80 },
  },
  {
    key: "ptw",
    codes: ["PERMIT-ISSUER", "PERMIT-AUTHORIZER"],
    nameLike: "permit to work",
    keywords: ["permit to work", "ptw", "work permit"],
    content: { title: "Permit to Work — Roles & Responsibilities", contentType: "document", deliveryMode: "hosted", durationMinutes: 22 },
  },
  {
    key: "first_aid",
    codes: ["FIRST-AIDER"],
    nameLike: "first aid",
    keywords: ["first aid", "cpr", "medical response"],
    content: { title: "First Aid & Emergency Response", contentType: "video", deliveryMode: "hosted", durationMinutes: 35 },
  },
];

async function findCompetency(codes: string[], nameLike?: string) {
  const byCode = await prisma.competency.findFirst({ where: { code: { in: codes } } });
  if (byCode) return byCode;
  if (nameLike) {
    return prisma.competency.findFirst({ where: { name: { contains: nameLike, mode: "insensitive" } } });
  }
  return null;
}

async function ensureMapping(
  sourceModule: string,
  classificationField: string,
  classificationValue: string,
  matchMode: string,
  competencyId: string,
  priority: number,
) {
  const existing = await prisma.hazardToSkillMapping.findFirst({
    where: { sourceModule, classificationField, classificationValue, competencyId, isDeleted: false },
  });
  if (existing) return false;
  await prisma.hazardToSkillMapping.create({
    data: { sourceModule, classificationField, classificationValue, matchMode, competencyId, priority, createdBy: "seed" },
  });
  return true;
}

async function ensureContent(competencyId: string, t: Topic["content"], opts?: { vendorId?: string; vendorName?: string; isPrimary?: boolean }) {
  const existing = await prisma.trainingContent.findFirst({
    where: { competencyId, title: t.title, isDeleted: false },
  });
  if (existing) return false;
  await prisma.trainingContent.create({
    data: {
      competencyId,
      title: t.title,
      contentType: t.contentType,
      deliveryMode: t.deliveryMode,
      contentRef: opts?.vendorId
        ? `vendor://${opts.vendorId}/${t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
        : `https://training.local/${t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      vendorId: opts?.vendorId ?? null,
      vendorName: opts?.vendorName ?? null,
      durationMinutes: t.durationMinutes ?? null,
      passingScore: t.passingScore ?? null,
      isPrimary: opts?.isPrimary ?? true,
      createdBy: "seed",
    },
  });
  return true;
}

async function main() {
  console.log("→ Seeding Training & Competency Engine demo data (idempotent)…\n");

  // Global rule config (plantId null) — the tenant-configurable defaults.
  const cfg = await prisma.trainingRuleConfig.findFirst({ where: { plantId: null } });
  if (!cfg) {
    await prisma.trainingRuleConfig.create({ data: { createdBy: "seed" } });
    console.log("  ✓ Global TrainingRuleConfig created (thresholdCount=3, window=90d, recert=30d)");
  } else {
    console.log("  • Global TrainingRuleConfig already present");
  }

  let mappings = 0;
  let contents = 0;
  let missing: string[] = [];

  for (const topic of TOPICS) {
    const comp = await findCompetency(topic.codes, topic.nameLike);
    if (!comp) {
      missing.push(topic.key);
      continue;
    }
    // exact category mapping (Observation), if the topic has one
    if (topic.obsCategory) {
      if (await ensureMapping("OBSERVATION", "category", topic.obsCategory, "exact", comp.id, 50)) mappings++;
    }
    // keyword mappings (ANY module — matches incident/near-miss/observation text)
    for (const kw of topic.keywords) {
      if (await ensureMapping("ANY", "keyword", kw, "keyword", comp.id, 100)) mappings++;
    }
    // primary demo content (vendorId null = demo/placeholder)
    if (await ensureContent(comp.id, topic.content, { isPrimary: true })) contents++;

    // Decoupling demo: one topic ALSO gets a mock EXTERNAL VENDOR VR package to
    // prove that swapping demo content for a vendor package is a data-only change
    // (verification checklist §C) — the engine keys only on competencyId.
    if (topic.key === "confined_space") {
      if (
        await ensureContent(
          comp.id,
          { title: "Confined Space — Immersive VR Drill (Vendor)", contentType: "vr_package", deliveryMode: "local_package", durationMinutes: 40 },
          { vendorId: "acme-vr-labs", vendorName: "Acme VR Labs", isPrimary: false },
        )
      )
        contents++;
    }
  }

  console.log(`\n✅  Mappings created: ${mappings}, TrainingContent created: ${contents}`);
  if (missing.length) console.log(`  ⚠ competencies not found for: ${missing.join(", ")} (mapping/content skipped)`);
}

main()
  .catch((e) => {
    console.error("❌ seed-training-engine failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
