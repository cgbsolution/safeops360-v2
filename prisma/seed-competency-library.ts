// Skill Matrix — competency library + role-definition loader (Phase 1 IMS).
//
// Loads prisma/seed-data/competency-library.json (170 global competencies) and
// role-definitions.json into the Competency / RoleDefinition /
// RoleCompetencyRequirement tables created in the skill_matrix_foundation
// migration. Idempotent: competencies upsert by `code`, role definitions upsert
// by their seed `id`, and each role's requirements are replaced on re-run.
//
// Run AFTER `prisma migrate dev` + `prisma generate`:
//     npx tsx prisma/seed-competency-library.ts
//
// Field mapping note: the JSON keeps the spec's snake_case shape; this loader
// maps to the camelCase Prisma columns. Cross-references in the spec use the
// JSON `id` (e.g. "comp_hse_foundation"); we translate those to the stable
// `code` before storing prerequisiteCompetencyIds.

import { PrismaClient, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const DATA_DIR = path.join(__dirname, "seed-data");

// JSON column helpers. Prisma's Json inputs are `Prisma.InputJsonValue`
// (and `Prisma.JsonNull` to write an explicit SQL NULL into a nullable Json
// column) — not `object`/`null`. Taking `unknown` here erases the source
// type (the seed JSON is already JSON-safe) so the cast is always valid.
const asJson = (v: unknown): Prisma.InputJsonValue => (v ?? null) as Prisma.InputJsonValue;
const asJsonOrNull = (v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  v == null ? Prisma.JsonNull : (v as Prisma.InputJsonValue);

type ValidationMethod = {
  method: string;
  is_mandatory?: boolean;
  weight?: number;
  minimum_score?: number;
  minimum_duration_months?: number;
  minimum_supervised_instances?: number;
};

type CompetencySeed = {
  id: string;
  code: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  validation_methods?: ValidationMethod[];
  related_training_program_ids?: string[];
  default_validity_months: number;
  pre_expiry_warning_days?: number;
  grace_period_days?: number;
  prerequisite_competency_ids?: string[];
  superseded_by_competency_ids?: string[];
  regulatory_references?: unknown[];
  enables_role_ids?: string[];
  enables_permit_types?: string[];
  enables_activity_types?: string[];
  re_validation_workflow?: string;
  is_global?: boolean;
};

type RequirementSeed = {
  competency_code: string;
  requirement_type: string;
  conditional_logic?: string;
  grace_period_for_new_hires_days?: number;
  rationale?: string;
};

type RoleDefSeed = {
  id: string;
  role_name: string;
  applies_to_departments?: string[];
  applies_to_plants?: string[];
  required_competencies?: RequirementSeed[];
  minimum_experience?: unknown;
  medical_fitness_requirements?: unknown;
  authority_limits?: unknown;
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
}

async function main() {
  console.log("🎓  Skill Matrix seed: competency library + role definitions");

  const competencies = readJson<CompetencySeed[]>("competency-library.json");
  const roleDefs = readJson<RoleDefSeed[]>("role-definitions.json");

  // Resolve a creator (createdByUserId is required). Prefer an admin; fall back
  // to any user, then to the sentinel "system" so the seed never hard-fails.
  const creator =
    (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ??
    (await prisma.user.findFirst());
  const creatorId = creator?.id ?? "system";

  // spec `id` -> `code`, so prerequisite references stored as stable codes.
  const idToCode = new Map(competencies.map((c) => [c.id, c.code]));
  const mapRefs = (ids?: string[]) => (ids ?? []).map((x) => idToCode.get(x) ?? x);

  // ── 1) Competencies (upsert by code) ──────────────────────────────────
  let created = 0;
  for (const c of competencies) {
    const data = {
      plantId: null as string | null, // global library
      name: c.name,
      description: c.description ?? null,
      category: c.category,
      subcategory: c.subcategory ?? null,
      validationMethods: asJson(c.validation_methods ?? []),
      relatedTrainingProgramIds: c.related_training_program_ids ?? [],
      defaultValidityMonths: c.default_validity_months,
      preExpiryWarningDays: c.pre_expiry_warning_days ?? 90,
      gracePeriodDays: c.grace_period_days ?? 30,
      prerequisiteCompetencyIds: mapRefs(c.prerequisite_competency_ids),
      supersededByCompetencyIds: mapRefs(c.superseded_by_competency_ids),
      regulatoryReferences: asJsonOrNull(c.regulatory_references),
      enablesRoleIds: c.enables_role_ids ?? [],
      enablesPermitTypes: c.enables_permit_types ?? [],
      enablesActivityTypes: c.enables_activity_types ?? [],
      reValidationWorkflow: c.re_validation_workflow ?? "assessment_required",
      isActive: true,
      isGlobal: true,
    };
    await prisma.competency.upsert({
      where: { code: c.code },
      update: data,
      create: { code: c.code, createdByUserId: creatorId, ...data },
    });
    created++;
  }
  console.log(`   competencies upserted: ${created}`);

  // code -> Competency.id, for resolving role requirements.
  const codeToId = new Map(
    (await prisma.competency.findMany({ select: { id: true, code: true } })).map((c) => [
      c.code,
      c.id,
    ]),
  );

  // ── 2) Role definitions (upsert by seed id) + requirements (replace) ───
  let roleCount = 0;
  let reqCount = 0;
  let skippedReqs = 0;
  for (const r of roleDefs) {
    const data = {
      plantId: null as string | null, // global template
      roleName: r.role_name,
      appliesToDepartments: r.applies_to_departments ?? [],
      appliesToPlants: r.applies_to_plants ?? [],
      minimumExperience: asJsonOrNull(r.minimum_experience),
      medicalFitnessRequirements: asJsonOrNull(r.medical_fitness_requirements),
      authorityLimits: asJsonOrNull(r.authority_limits),
      isActive: true,
    };
    await prisma.roleDefinition.upsert({
      where: { id: r.id },
      update: data,
      create: { id: r.id, ...data },
    });
    // Replace requirements idempotently.
    await prisma.roleCompetencyRequirement.deleteMany({ where: { roleDefinitionId: r.id } });
    for (const req of r.required_competencies ?? []) {
      const competencyId = codeToId.get(req.competency_code);
      if (!competencyId) {
        console.warn(
          `   ! role ${r.id}: competency code ${req.competency_code} not found — requirement skipped`,
        );
        skippedReqs++;
        continue;
      }
      await prisma.roleCompetencyRequirement.create({
        data: {
          roleDefinitionId: r.id,
          competencyId,
          requirementType: req.requirement_type,
          conditionalLogic: req.conditional_logic ?? null,
          gracePeriodForNewHiresDays: req.grace_period_for_new_hires_days ?? 0,
          rationale: req.rationale ?? null,
        },
      });
      reqCount++;
    }
    roleCount++;
  }
  console.log(
    `   role definitions upserted: ${roleCount} | requirements: ${reqCount}` +
      (skippedReqs ? ` | skipped (unknown code): ${skippedReqs}` : ""),
  );
  console.log("✅  Skill Matrix library seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
