// Verifies the OBSERVATION permission matrix matches the spec.
// Run with:  npx tsx scripts/verify-observation-matrix.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Expected matrix per stakeholder spec.
// Scope codes: ALL = ALL_PLANTS, PLANT = OWN_PLANT, DEPT = OWN_DEPARTMENT,
// OWN = OWN_RECORDS, "—" = no grant.
type ScopeShort = "ALL" | "PLANT" | "DEPT" | "OWN" | "—";

const EXPECTED: Record<string, Record<string, ScopeShort>> = {
  WORKER:                 { CREATE: "ALL", READ: "OWN",   UPDATE: "OWN",   APPROVE: "—",     EXECUTE: "OWN",   VERIFY: "—",     CLOSE: "—",     DELETE: "—",     EXPORT: "—" },
  CONTRACTOR_WORKMAN:     { CREATE: "ALL", READ: "OWN",   UPDATE: "OWN",   APPROVE: "—",     EXECUTE: "OWN",   VERIFY: "—",     CLOSE: "—",     DELETE: "—",     EXPORT: "—" },
  SUPERVISOR:             { CREATE: "ALL", READ: "DEPT",  UPDATE: "OWN",   APPROVE: "DEPT",  EXECUTE: "OWN",   VERIFY: "—",     CLOSE: "—",     DELETE: "—",     EXPORT: "DEPT" },
  PERMIT_ISSUER:          { CREATE: "ALL", READ: "DEPT",  UPDATE: "OWN",   APPROVE: "—",     EXECUTE: "OWN",   VERIFY: "—",     CLOSE: "—",     DELETE: "—",     EXPORT: "DEPT" },
  SAFETY_OFFICER:         { CREATE: "ALL", READ: "PLANT", UPDATE: "OWN",   APPROVE: "PLANT", EXECUTE: "OWN",   VERIFY: "PLANT", CLOSE: "—",     DELETE: "—",     EXPORT: "PLANT" },
  DEPARTMENT_HEAD:        { CREATE: "ALL", READ: "DEPT",  UPDATE: "OWN",   APPROVE: "DEPT",  EXECUTE: "OWN",   VERIFY: "—",     CLOSE: "—",     DELETE: "—",     EXPORT: "DEPT" },
  HSE_MANAGER:            { CREATE: "ALL", READ: "PLANT", UPDATE: "PLANT", APPROVE: "PLANT", EXECUTE: "PLANT", VERIFY: "PLANT", CLOSE: "PLANT", DELETE: "PLANT", EXPORT: "PLANT" },
  PLANT_HEAD:             { CREATE: "ALL", READ: "PLANT", UPDATE: "PLANT", APPROVE: "PLANT", EXECUTE: "—",     VERIFY: "—",     CLOSE: "PLANT", DELETE: "—",     EXPORT: "PLANT" },
  CORPORATE_HSE:          { CREATE: "ALL", READ: "ALL",   UPDATE: "ALL",   APPROVE: "ALL",   EXECUTE: "—",     VERIFY: "ALL",   CLOSE: "ALL",   DELETE: "ALL",   EXPORT: "ALL" },
  SYSTEM_ADMIN:           { CREATE: "ALL", READ: "ALL",   UPDATE: "ALL",   APPROVE: "ALL",   EXECUTE: "ALL",   VERIFY: "ALL",   CLOSE: "ALL",   DELETE: "ALL",   EXPORT: "ALL" },
  ADMIN:                  { CREATE: "ALL", READ: "ALL",   UPDATE: "ALL",   APPROVE: "ALL",   EXECUTE: "ALL",   VERIFY: "ALL",   CLOSE: "ALL",   DELETE: "ALL",   EXPORT: "ALL" },
  TRAINER:                { CREATE: "ALL", READ: "OWN",   UPDATE: "OWN",   APPROVE: "—",     EXECUTE: "OWN",   VERIFY: "—",     CLOSE: "—",     DELETE: "—",     EXPORT: "—" },
  LD_MANAGER:             { CREATE: "ALL", READ: "OWN",   UPDATE: "OWN",   APPROVE: "—",     EXECUTE: "OWN",   VERIFY: "—",     CLOSE: "—",     DELETE: "—",     EXPORT: "—" },
  MAINTENANCE_HEAD:       { CREATE: "ALL", READ: "DEPT",  UPDATE: "OWN",   APPROVE: "—",     EXECUTE: "OWN",   VERIFY: "—",     CLOSE: "—",     DELETE: "—",     EXPORT: "DEPT" },
  CONTRACTOR_COORDINATOR: { CREATE: "ALL", READ: "PLANT", UPDATE: "OWN",   APPROVE: "—",     EXECUTE: "OWN",   VERIFY: "—",     CLOSE: "—",     DELETE: "—",     EXPORT: "PLANT" },
  ENVIRONMENT_MANAGER:    { CREATE: "ALL", READ: "PLANT", UPDATE: "OWN",   APPROVE: "—",     EXECUTE: "OWN",   VERIFY: "—",     CLOSE: "—",     DELETE: "—",     EXPORT: "PLANT" }
};

const SCOPE_TO_SHORT: Record<string, ScopeShort> = {
  ALL_PLANTS: "ALL",
  OWN_PLANT: "PLANT",
  OWN_DEPARTMENT: "DEPT",
  OWN_RECORDS: "OWN"
};

const ACTIONS = ["CREATE", "READ", "UPDATE", "APPROVE", "EXECUTE", "VERIFY", "CLOSE", "DELETE", "EXPORT"];

async function main() {
  console.log("\n=== OBSERVATION matrix verification ===\n");

  const grants = await prisma.rolePermission.findMany({
    where: { permission: { module: "OBSERVATION" } },
    include: { role: true, permission: true }
  });

  // Build actual matrix: { roleCode → { action → scopeShort } }
  const actual: Record<string, Record<string, ScopeShort>> = {};
  for (const g of grants) {
    const role = g.role.code;
    const action = g.permission.action;
    actual[role] = actual[role] ?? {};
    const newScope = SCOPE_TO_SHORT[g.scope] ?? "—";
    const existing = actual[role][action];
    // If multiple grants for same action exist (broader vs narrower scope),
    // keep the BROADER one — that's what the engine effectively grants.
    const order: ScopeShort[] = ["—", "OWN", "DEPT", "PLANT", "ALL"];
    if (!existing || order.indexOf(newScope) > order.indexOf(existing)) {
      actual[role][action] = newScope;
    }
  }

  // Compare
  const header = ["Role".padEnd(24), ...ACTIONS.map((a) => a.slice(0, 6).padEnd(7))].join("");
  console.log(header);
  console.log("─".repeat(header.length));

  let mismatches = 0;
  for (const role of Object.keys(EXPECTED)) {
    const cells = [role.padEnd(24)];
    let rowOK = true;
    for (const action of ACTIONS) {
      const want = EXPECTED[role][action];
      const got = actual[role]?.[action] ?? "—";
      const ok = got === want;
      if (!ok) {
        rowOK = false;
        mismatches++;
      }
      // Show with marker if mismatch
      cells.push(ok ? got.padEnd(7) : `${got}≠${want}`.padEnd(7));
    }
    const prefix = rowOK ? "✓ " : "✗ ";
    console.log(prefix + cells.join(""));
  }

  console.log(`\n${mismatches === 0 ? "✓" : "✗"} ${mismatches} cell mismatch${mismatches === 1 ? "" : "es"}`);
  if (mismatches === 0) {
    console.log("Matrix matches the spec exactly.\n");
  } else {
    console.log("Format: actual≠expected. Update seed-rbac.ts to fix.\n");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
