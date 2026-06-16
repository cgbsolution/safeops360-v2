import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function qa() {
  const DEMO_DATE = new Date("2026-06-07T09:00:00.000Z");
  let pass = 0, fail = 0;

  function check(label: string, ok: boolean, detail: string) {
    console.log(`  ${ok ? "✅" : "❌"} ${label}: ${detail}`);
    ok ? pass++ : fail++;
  }

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  SafeOps360 — Meridian Manufacturing QA Checkpoint   ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // ── 1. Primary persona ───────────────────────────────────────────────
  const priya = await prisma.user.findUnique({
    where: { email: "priya.nair@safeops360.in" },
    include: { plant: true },
  });
  check("Priya Nair exists", !!priya, priya ? `${priya.name} | ${priya.role} | Plant ${priya.plant?.code}` : "NOT FOUND");
  check("Role = HSE_MANAGER", priya?.role === "HSE_MANAGER", priya?.role ?? "n/a");
  check("Plant = NW", priya?.plant?.code === "NW", priya?.plant?.code ?? "n/a");

  // ── 2. Plants ────────────────────────────────────────────────────────
  const plants = await prisma.plant.findMany({ orderBy: { code: "asc" } });
  const meridianPlants = plants.filter(p => ["NW", "SW"].includes(p.code));
  const industryPlants = plants.filter(p => !["NW", "SW"].includes(p.code));
  check("Meridian plants = 2 (NW + SW)", meridianPlants.length === 2, meridianPlants.map(p => p.code).join(", "));
  check("Industry tenants = 10", industryPlants.length === 10, `${industryPlants.length}: ${industryPlants.map(p => p.code).join(", ")}`);
  const nwPlant = plants.find(p => p.code === "NW");
  const swPlant = plants.find(p => p.code === "SW");
  check("NW plant exists", !!nwPlant, nwPlant?.name?.slice(0, 40) ?? "MISSING");
  check("SW plant exists", !!swPlant, swPlant?.name?.slice(0, 40) ?? "MISSING");

  // ── 3. Days since last LTI (Meridian NW) ───────────────────────────
  const lastLTI = await prisma.incident.findFirst({
    where: { type: "LTI", plantId: nwPlant?.id },
    orderBy: { date: "desc" },
  });
  const days = lastLTI
    ? Math.floor((DEMO_DATE.getTime() - new Date(lastLTI.date).getTime()) / 86400000)
    : null;
  check(
    "Days since last LTI = 28",
    days === 28,
    `Last LTI: ${lastLTI?.date?.toISOString().slice(0, 10) ?? "NONE"} → ${days ?? "n/a"} days`
  );

  // ── 4. Trailing-12M LTIFR ────────────────────────────────────────────
  // Trailing 12 months = Jun 2025 – May 2026
  const mhRows = await prisma.manhours.findMany({
    where: {
      plantId: nwPlant?.id,
      OR: [
        { year: 2025, month: { gte: 6 } },
        { year: 2026, month: { lte: 5 } },
      ],
    },
  });
  const totalHours = mhRows.reduce(
    (s, r) => s + (r.employeeHours || 0) + (r.contractorHours || 0),
    0
  );
  const ltiCount = mhRows.reduce((s, r) => s + (r.ltiCount || 0), 0);
  const ltifr = totalHours > 0 ? (ltiCount * 200000) / totalHours : 0;
  check(
    "LTIFR = 0.34",
    ltifr.toFixed(2) === "0.34",
    `${ltiCount} LTIs × 200k / ${totalHours.toLocaleString()} hrs = ${ltifr.toFixed(4)} → ${ltifr.toFixed(2)}`
  );

  // ── 5. Active permits ────────────────────────────────────────────────
  const permits = await prisma.permit.findMany({
    where: { status: "ACTIVE", plantId: nwPlant?.id },
    select: { number: true, type: true },
  });
  check("Active permits = 2", permits.length === 2, permits.map(p => `${p.number} (${p.type})`).join(", ") || "NONE");
  const hasHotWork = permits.some(p => p.type === "HOT_WORK");
  const hasCS = permits.some(p => p.type === "CONFINED_SPACE");
  check("HOT_WORK permit exists", hasHotWork, hasHotWork ? "YES" : "MISSING");
  check("CONFINED_SPACE permit exists", hasCS, hasCS ? "YES" : "MISSING");

  // ── 6. Users ─────────────────────────────────────────────────────────
  const userCount = await prisma.user.count();
  check("User count = 139", userCount === 139, `${userCount} users (78 Meridian + 10×6 industry users)`);

  // ── 7. Master data counts ────────────────────────────────────────────
  const hazardCount = await prisma.hiraHazard.count();
  check("HIRA hazards ≥ 167", hazardCount >= 167, `${hazardCount} hazards`);
  const aspectCount = await prisma.eaiAspect.count();
  check("EAI aspects ≥ 68", aspectCount >= 68, `${aspectCount} aspects`);
  const compCount = await prisma.competency.count();
  check("Competencies ≥ 197", compCount >= 197, `${compCount} competencies`);
  const trainingCount = await prisma.trainingProgram.count();
  check("Training programs ≥ 39", trainingCount >= 39, `${trainingCount} programs`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n  ${pass + fail} checks: ${pass} passed, ${fail} failed`);
  if (fail === 0) {
    console.log("  ✅ ALL QA CHECKS PASSED — ready for customer demo\n");
  } else {
    console.log("  ❌ SOME CHECKS FAILED — review above before demo\n");
    process.exitCode = 1;
  }
}

qa()
  .catch((e) => {
    console.error("QA error:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
