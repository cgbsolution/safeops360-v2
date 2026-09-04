// Safety Officer → full authority on every Operational Safety module, group-wide.
//
//   npx tsx prisma/patch-safety-officer-operational-access.ts            # apply
//   npx tsx prisma/patch-safety-officer-operational-access.ts --dry-run  # report only
//   npx tsx prisma/patch-safety-officer-operational-access.ts --no-delete
//
// What this grants: every action defined in the Permission catalogue for the
// eight modules in the sidebar's "Operational Safety" group, at ALL_PLANTS
// scope, to the SAFETY_OFFICER role.
//
// The action list is READ FROM THE DATABASE, not hardcoded. "All actions" that
// silently means "the fourteen actions that existed the day this was written"
// is the failure mode worth avoiding — a new PTW action added next quarter is
// picked up by re-running this, with no edit here.
//
// ── Why a patch script and not just an edit to seed-rbac ──────────────────
// Both RBAC seeders (prisma/seed-rbac.ts and app/seed/seed_rbac.py) DELETE every
// RolePermission row and rebuild the matrix from scratch; seed-rbac.ts also
// wipes UserRole, which would destroy the per-plant role assignments real users
// hold. Neither is safe to run against a populated database just to change one
// role. So this applies the change in place, and the same grants are ALSO
// restated in both seeder matrices so a future full re-seed reproduces them
// rather than silently reverting this. All three must stay in step — the same
// arrangement the HSE_MANAGER FIRE block already documents.
//
// ── Two grants worth a decision, not a default ────────────────────────────
// Both are included because "all actions" was the explicit ask. They are listed
// here so switching them off is a one-line change rather than an archaeology
// exercise:
//
//   • *.DELETE — destroys a filed safety record. Everywhere else in this matrix
//     DELETE sits with HSE_MANAGER / SYSTEM_ADMIN. Pass --no-delete to skip.
//
//   • CAPTURE.UNMASK — reveals the reporter behind an ANONYMOUS field capture.
//     It is an audited confidentiality control, not a capability: the whole
//     point of anonymous reporting is that the local officer cannot see who
//     filed it. Granting it plant-wide to every Safety Officer is a policy
//     choice about the reporting culture, not a permissions detail.

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

// The Supabase transaction pooler rejects Prisma's named prepared statements
// with 42P05 on the second query of a run; pgbouncer=true turns them off.
const POOLED_URL =
  (process.env.DATABASE_URL ?? "") +
  ((process.env.DATABASE_URL ?? "").includes("?") ? "&" : "?") +
  "pgbouncer=true&connection_limit=1";

const prisma = new PrismaClient({ datasources: { db: { url: POOLED_URL } } });

const DRY_RUN = process.argv.includes("--dry-run");
const NO_DELETE = process.argv.includes("--no-delete");

const ROLE_CODE = "SAFETY_OFFICER";
const SCOPE = "ALL_PLANTS";

/** The sidebar's "Operational Safety" group, module by module. Keep in step
 *  with components/layout/app-sidebar.tsx — FIRE and CHEMICAL appear there
 *  gated on INCIDENT.READ as a bootstrap, but both own real permission
 *  catalogues, and granting them is what lets that gate be corrected. */
const OPERATIONAL_SAFETY_MODULES = [
  "OBSERVATION", // Safety Observation
  "NEAR_MISS", // Near Miss
  "PTW", // Permit to Work
  "FLRA", // FLRA
  "INCIDENT", // Incident Investigation
  "FIRE", // Fire Safety & ER
  "CHEMICAL", // Chemical & Hazmat
  "CAPTURE" // Field Capture + Field Reports
];

async function main() {
  const role = await prisma.role.findUnique({ where: { code: ROLE_CODE } });
  if (!role) throw new Error(`Role ${ROLE_CODE} not found — run the RBAC seeder first.`);

  const perms = await prisma.permission.findMany({
    where: { module: { in: OPERATIONAL_SAFETY_MODULES } },
    orderBy: [{ module: "asc" }, { action: "asc" }]
  });
  if (perms.length === 0) throw new Error("No permissions found for the Operational Safety modules.");

  const existing = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
  const byPermissionId = new Map(existing.map((rp) => [rp.permissionId, rp]));

  let added = 0;
  let widened = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const perm of perms) {
    if (NO_DELETE && perm.action === "DELETE") {
      skipped += 1;
      continue;
    }
    const current = byPermissionId.get(perm.id);

    if (!current) {
      console.log(`  + ${perm.module}.${perm.action.padEnd(22)} ${SCOPE}`);
      added += 1;
      if (!DRY_RUN) {
        await prisma.rolePermission.create({
          data: {
            id: randomUUID().replace(/-/g, ""),
            roleId: role.id,
            permissionId: perm.id,
            scope: SCOPE
          }
        });
      }
      continue;
    }

    if (current.scope !== SCOPE) {
      console.log(`  ↑ ${perm.module}.${perm.action.padEnd(22)} ${current.scope} → ${SCOPE}`);
      widened += 1;
      if (!DRY_RUN) {
        await prisma.rolePermission.update({ where: { id: current.id }, data: { scope: SCOPE } });
      }
      continue;
    }

    unchanged += 1;
  }

  console.log(
    `\n${DRY_RUN ? "[dry run] " : ""}${ROLE_CODE}: ${added} granted, ${widened} widened to ${SCOPE}, ` +
      `${unchanged} already correct${NO_DELETE ? `, ${skipped} DELETE grants skipped` : ""}.`
  );
  console.log(
    `Covered ${OPERATIONAL_SAFETY_MODULES.length} modules: ${OPERATIONAL_SAFETY_MODULES.join(", ")}.`
  );
  if (!DRY_RUN && (added > 0 || widened > 0)) {
    // The permission service caches a user's grants for 5 minutes in-process.
    // Nothing here can reach that cache, so say so rather than let someone
    // conclude the change did not work.
    console.log(
      "\nRestart the backend (or wait 5 minutes) — app/services/permissions.py caches\n" +
        "each user's grants for 300s and this script cannot invalidate it."
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
