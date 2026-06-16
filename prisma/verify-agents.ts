// One-off diagnostic. Prints what's actually in the DB for the agent
// platform so we can confirm Commits 1-6 landed end-to-end. Safe to
// re-run; reads only.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("═══ Permission rows for module=AGENT ═══");
  const perms = await prisma.permission.findMany({
    where: { module: "AGENT" },
    select: { code: true, module: true, action: true, description: true }
  });
  console.log(`  count: ${perms.length}`);
  for (const p of perms) console.log(`    ${p.code}`);

  console.log("\n═══ Role grants for AGENT.* ═══");
  const grants = await prisma.rolePermission.findMany({
    where: { permission: { module: "AGENT" } },
    include: {
      role: { select: { code: true } },
      permission: { select: { code: true } }
    },
    orderBy: [{ role: { code: "asc" } }]
  });
  const byRole: Record<string, string[]> = {};
  for (const g of grants) {
    const rcode = g.role.code;
    (byRole[rcode] ??= []).push(`${g.permission.code} (${g.scope})`);
  }
  for (const [rcode, codes] of Object.entries(byRole)) {
    console.log(`  ${rcode}:`);
    for (const c of codes) console.log(`    ${c}`);
  }

  console.log("\n═══ Agent rows ═══");
  const agents = await prisma.agent.findMany({
    select: {
      code: true, name: true, currentAuthorityLevel: true, maxAuthorityLevel: true,
      isActive: true, isInPilot: true, rateLimit: true, primaryModelId: true,
      escalationModelId: true, activePromptId: true, totalInvocations: true,
      totalAcceptances: true, totalModifications: true, totalRejections: true,
      calibrationScore: true, lastCalibrationAt: true
    }
  });
  console.log(`  count: ${agents.length}`);
  for (const a of agents) {
    console.log(`  ${a.code}: ${a.name}`);
    console.log(`    authority=${a.currentAuthorityLevel}/${a.maxAuthorityLevel} active=${a.isActive} pilot=${a.isInPilot} rate=${a.rateLimit}/h`);
    console.log(`    model=${a.primaryModelId} escalation=${a.escalationModelId}`);
    console.log(`    promptId=${a.activePromptId}`);
    console.log(`    metrics: total=${a.totalInvocations} acc=${a.totalAcceptances} mod=${a.totalModifications} rej=${a.totalRejections} score=${a.calibrationScore ?? "—"}`);
    console.log(`    lastCalibrationAt=${a.lastCalibrationAt?.toISOString() ?? "never"}`);
  }

  console.log("\n═══ AgentPrompt rows ═══");
  const prompts = await prisma.agentPrompt.findMany({
    select: {
      id: true, agentId: true, version: true, promptDescription: true,
      invocationCount: true, acceptanceRate: true, rejectionRate: true
    },
    orderBy: [{ agentId: "asc" }, { version: "desc" }]
  });
  console.log(`  count: ${prompts.length}`);
  for (const p of prompts) {
    console.log(`  v${p.version} (id=${p.id}): invocations=${p.invocationCount} acc=${p.acceptanceRate ?? "—"} rej=${p.rejectionRate ?? "—"}`);
  }

  console.log("\n═══ AgentInvocation rows ═══");
  const invs = await prisma.agentInvocation.findMany({
    select: {
      invocationNumber: true, status: true, humanDecision: true,
      ratingByHuman: true, totalCostUsd: true, latencyMs: true,
      hallucinationFlagged: true, sourceRecordId: true
    },
    orderBy: { invokedAt: "desc" }
  });
  console.log(`  count: ${invs.length}`);
  for (const i of invs) {
    console.log(`  ${i.invocationNumber}: ${i.status} → ${i.humanDecision ?? "—"} (rating ${i.ratingByHuman ?? "—"}) cost=$${i.totalCostUsd?.toFixed(4) ?? "—"} latency=${i.latencyMs}ms`);
  }

  console.log("\n═══ Tool call counts per invocation ═══");
  const toolCalls = await prisma.agentToolCall.groupBy({
    by: ["invocationId"],
    _count: { id: true }
  });
  console.log(`  total tool-call rows: ${toolCalls.reduce((s, r) => s + r._count.id, 0)} across ${toolCalls.length} invocations`);

  // Per-role membership for ADMIN to confirm the logged-in user has it
  console.log("\n═══ Vizionforge Admin (admin@safeops360.in) effective AGENT permissions ═══");
  const admin = await prisma.user.findFirst({
    where: { email: "admin@safeops360.in" },
    include: {
      userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }
    }
  });
  if (!admin) {
    console.log("  ❌ admin@safeops360.in not found");
  } else {
    const effective: Record<string, string> = {};
    for (const ur of admin.userRoles) {
      for (const rp of ur.role.permissions) {
        if (rp.permission.module === "AGENT") {
          effective[rp.permission.code] = rp.scope;
        }
      }
    }
    if (Object.keys(effective).length === 0) {
      console.log("  ❌ no AGENT permissions on admin's roles");
    } else {
      for (const [code, scope] of Object.entries(effective)) {
        console.log(`    ✓ ${code} (scope=${scope})`);
      }
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
