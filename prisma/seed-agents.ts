// Seeds the user-initiated agent platform.
//
// Idempotent — safe to re-run. On each invocation:
//   • Each registered Agent row is upserted by code
//   • AgentPrompt v1 is inserted if not present (or updated in place if
//     the .md file body changed but the version number didn't)
//   • Agent.activePromptId is repointed to the latest version
//
// System prompt source: the same Markdown files the Python runtime reads
// from safeops_360_bakend/app/services/agents/prompts/. Reading from one
// file per agent eliminates the seed-vs-runtime drift risk.
//
// Currently registered agents:
//   • RCA_ASSISTANT          — incident root cause analysis
//   • PERMIT_RISK_REVIEWER   — permit-to-work risk review
//   • TRIAGE_AGENT           — observation / near-miss L1 triage

import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";

const prisma = new PrismaClient();

// ─── Canonical config ─────────────────────────────────────────────────
// Mirror of RCA_AGENT_TOOL_NAMES in Python's app/services/agents/tools/__init__.py.
// A Python test guards against drift between this list and the registry.
const RCA_TOOLS = [
  "find_similar_incidents",
  "find_related_observations",
  "find_related_near_misses",
  "get_equipment_history",
  "get_training_records",
  "get_active_permits_at_time",
  "search_documents_reviewed",
  "check_recent_changes",
  "get_industry_benchmark"
] as const;

// Mirror of PERMIT_RISK_REVIEWER_TOOL_NAMES in the Python tool registry.
const PERMIT_REVIEW_TOOLS = [
  "find_concurrent_permits",
  "find_similar_past_incidents_for_permit",
  "check_crew_training_currency",
  "find_recent_findings_in_area",
  "get_training_records",
  "get_equipment_history"
] as const;

const RCA_ASSISTANT_CODE = "RCA_ASSISTANT";
const RCA_ASSISTANT_PROMPT_VERSION = 1;
const PERMIT_REVIEWER_CODE = "PERMIT_RISK_REVIEWER";
const PERMIT_REVIEWER_PROMPT_VERSION = 1;
const TRIAGE_AGENT_CODE = "TRIAGE_AGENT";
const TRIAGE_AGENT_PROMPT_VERSION = 1;
const HIRA_ASSISTANT_CODE = "HIRA_ASSISTANT";
// Bumped to v2 for HIRA Phase 2: Layer A integration, two new task types
// (`analyze_full_entry`, `compare_versions`), pattern observations,
// reviewer attention items. v1 prompt body in v1.md remains in place but
// the agent's activePromptId now points at v2.
const HIRA_ASSISTANT_PROMPT_VERSION = 2;
const CAPA_ASSISTANT_CODE = "CAPA_ASSISTANT";
const CAPA_ASSISTANT_PROMPT_VERSION = 1;

// The backend checkout sits alongside the frontend, but the directory name
// differs per portal ("Safeops360-backend" here, "safeops_360_bakend" in the
// original repo). Probe both so this works from either layout.
const BACKEND_DIR_NAMES = ["Safeops360-backend", "safeops_360_bakend"];

function promptFilePath(filename: string): string {
  const candidates = BACKEND_DIR_NAMES.map((d) =>
    path.resolve(
      __dirname,
      "..", "..", d, "app", "services", "agents", "prompts", filename
    )
  );
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

function loadPromptFile(filename: string): string {
  const promptPath = promptFilePath(filename);
  if (!fs.existsSync(promptPath)) {
    throw new Error(
      `Agent prompt not found at ${promptPath}. The TS seed and Python ` +
      `runtime read from one file; make sure the backend repo is checked ` +
      `out alongside the frontend.`
    );
  }
  return fs.readFileSync(promptPath, "utf-8");
}

function loadPrompt(): string {
  return loadPromptFile(`rca_assistant_v${RCA_ASSISTANT_PROMPT_VERSION}.md`);
}

async function findCreatorUserId(): Promise<string> {
  // Prefer the anchor admin used elsewhere in seeding; fall back to
  // any SYSTEM_ADMIN-roled user; fall back to any user.
  const anchor = await prisma.user.findFirst({
    where: { email: "admin@safeops360.in" },
    select: { id: true }
  });
  if (anchor) return anchor.id;

  const sysAdmin = await prisma.user.findFirst({
    where: { role: "SYSTEM_ADMIN" },
    select: { id: true }
  });
  if (sysAdmin) return sysAdmin.id;

  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  if (!anyUser) {
    throw new Error(
      "No users in DB — run `npm run db:seed` before `npm run db:seed-agents`."
    );
  }
  return anyUser.id;
}

async function main() {
  console.log("🤖  Agent seed: RCA_ASSISTANT");

  const promptBody = loadPrompt();
  const creatorId = await findCreatorUserId();

  // 1. Upsert the Agent row (no activePromptId yet — set after prompt insert)
  const agent = await prisma.agent.upsert({
    where: { code: RCA_ASSISTANT_CODE },
    create: {
      code: RCA_ASSISTANT_CODE,
      name: "Root Cause Analysis Assistant",
      description:
        "Assists incident investigators by drafting root cause analysis using the " +
        "appropriate methodology, surfacing similar past incidents, and proposing " +
        "root causes for the investigator to accept, modify, or reject. Human-in-loop " +
        "by design — every output requires explicit acceptance to become part of the " +
        "investigation record.",
      module: "INCIDENT",
      capabilities: {
        suggest_methodology:
          "Recommend the appropriate RCA methodology (5-Why / Fishbone / FTA / Bowtie / TapRoot / Cause Map) based on incident characteristics.",
        draft_methodology_analysis:
          "Produce a draft analysis populating the JSON shape of the chosen methodology.",
        find_similar_cases:
          "Search the closed-incident corpus for similar prior events and surface their root causes + CAPA effectiveness.",
        propose_root_causes:
          "Propose 2-4 specific, actionable root causes with reasoning, for investigator review.",
        identify_evidence_gaps:
          "Flag what evidence / witness interviews / document reviews the investigator should still gather."
      },
      // Haiku-default, escalate to Opus for "deep analysis" requests. Locked
      // in via the earlier cost-ceiling decision.
      primaryModelId: "claude-haiku-4-5-20251001",
      escalationModelId: "claude-opus-4-7",
      currentAuthorityLevel: "L0",
      maxAuthorityLevel: "L1",
      authorityRationale:
        "L0 (suggest-only) for pilot. Promotion to L1 (pre-fill draft state) requires " +
        ">50% acceptance, <30% modification, <20% rejection over the first 50 invocations, " +
        "and zero detected hallucinations.",
      availableTools: [...RCA_TOOLS],
      // Haiku at ~$1/M in + $5/M out, with typical RCA invocation around
      // 8k input + 1.5k output, lands around $0.015. Round up for the UI.
      estimatedTokensPerInvocation: 9500,
      estimatedCostPerInvocation: 0.015,
      isActive: true,
      isInPilot: true,
      rateLimit: 50
    },
    update: {
      // Re-running the seed should refresh non-load-bearing config but
      // NOT reset accumulated metrics (totalInvocations etc.) or wipe
      // an already-promoted authority level. Only refresh fields where
      // the source-of-truth is this file.
      name: "Root Cause Analysis Assistant",
      description:
        "Assists incident investigators by drafting root cause analysis using the " +
        "appropriate methodology, surfacing similar past incidents, and proposing " +
        "root causes for the investigator to accept, modify, or reject. Human-in-loop " +
        "by design — every output requires explicit acceptance to become part of the " +
        "investigation record.",
      module: "INCIDENT",
      primaryModelId: "claude-haiku-4-5-20251001",
      escalationModelId: "claude-opus-4-7",
      availableTools: [...RCA_TOOLS],
      // estimatedTokensPerInvocation / estimatedCostPerInvocation: leave
      // alone on re-seed — the operations dashboard may have tuned these.
    }
  });
  console.log(`   agent upserted: ${agent.code} (id=${agent.id})`);

  // 2. Upsert the prompt row for this version. If the prompt body in
  //    the MD file has changed but the version number hasn't, we UPDATE
  //    in place (during development). In production, bumping the prompt
  //    means bumping RCA_ASSISTANT_PROMPT_VERSION and dropping a new
  //    rca_assistant_v{N}.md file alongside.
  const existingPrompt = await prisma.agentPrompt.findUnique({
    where: { agentId_version: { agentId: agent.id, version: RCA_ASSISTANT_PROMPT_VERSION } }
  });

  let promptId: string;
  if (existingPrompt) {
    const updated = await prisma.agentPrompt.update({
      where: { id: existingPrompt.id },
      data: {
        systemPrompt: promptBody,
        promptDescription:
          `Initial RCA assistant prompt (v${RCA_ASSISTANT_PROMPT_VERSION}). ` +
          "Establishes the human-in-loop framing, methodology selection guide, " +
          "structured output format, and critical rules against hallucination + " +
          "premature operator-blame attribution."
      }
    });
    promptId = updated.id;
    console.log(`   prompt v${RCA_ASSISTANT_PROMPT_VERSION} updated (id=${updated.id})`);
  } else {
    const created = await prisma.agentPrompt.create({
      data: {
        agentId: agent.id,
        version: RCA_ASSISTANT_PROMPT_VERSION,
        systemPrompt: promptBody,
        promptDescription:
          `Initial RCA assistant prompt (v${RCA_ASSISTANT_PROMPT_VERSION}). ` +
          "Establishes the human-in-loop framing, methodology selection guide, " +
          "structured output format, and critical rules against hallucination + " +
          "premature operator-blame attribution.",
        createdById: creatorId,
        approvedById: creatorId,
        approvedAt: new Date()
      }
    });
    promptId = created.id;
    console.log(`   prompt v${RCA_ASSISTANT_PROMPT_VERSION} created (id=${created.id})`);
  }

  // 3. Point Agent.activePromptId at this version
  if (agent.activePromptId !== promptId) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { activePromptId: promptId }
    });
    console.log(`   activePromptId → ${promptId}`);
  }

  // ── 4. PERMIT_RISK_REVIEWER ─────────────────────────────────────────
  await seedPermitRiskReviewer(creatorId);

  // ── 4. HIRA_ASSISTANT ───────────────────────────────────────────────
  await seedHiraAssistant(creatorId);

  // ── 5. TRIAGE_AGENT ─────────────────────────────────────────────────
  await seedTriageAgent(creatorId);

  // ── 6. CAPA_ASSISTANT ───────────────────────────────────────────────
  await seedCapaAssistant(creatorId);

  console.log("✅  Agent seed complete.");
}


async function seedPermitRiskReviewer(creatorId: string): Promise<void> {
  console.log("🤖  Agent seed: PERMIT_RISK_REVIEWER");

  const promptBody = loadPromptFile(
    `permit_risk_reviewer_v${PERMIT_REVIEWER_PROMPT_VERSION}.md`
  );

  // 1. Upsert the Agent row
  const agent = await prisma.agent.upsert({
    where: { code: PERMIT_REVIEWER_CODE },
    create: {
      code: PERMIT_REVIEWER_CODE,
      name: "Permit Risk Reviewer",
      description:
        "Reviews Permit to Work (PTW) submissions and surfaces multi-signal " +
        "risks the deterministic rules engine cannot catch: SIMOPS conflicts " +
        "across concurrent permits, scope-control mismatches, crew composition " +
        "concerns, and historical patterns from past incidents in the same " +
        "area. Authority L2 — MONITOR: the agent flags risks; humans decide. " +
        "Output is advisory only — the agent cannot approve, reject, modify, " +
        "or delay any permit.",
      module: "PTW",
      capabilities: {
        flag_simops_conflicts:
          "Identify cross-permit conflicts when multiple permits are active in the same plant/area with overlapping validity windows.",
        flag_scope_control_mismatch:
          "Surface when the scopeOfWork implies hazards that the structured controls (PPE, isolations, gas test, fire watch) do not address.",
        flag_crew_competency_gaps:
          "Detect crew composition concerns including training expiring during the permit window, all-contractor crews on critical work, and single-point-of-failure roles.",
        flag_historical_patterns:
          "Surface recurring root causes from past incidents involving the same permit type or work nature at this plant.",
        propose_mitigations:
          "For each finding, propose specific imperative-voice mitigations the Issuer or Safety Officer could apply."
      },
      // Haiku as default. Opus as escalation for complex SIMOPS reasoning
      // requested explicitly via the "Deep review" UI toggle.
      primaryModelId: "claude-haiku-4-5-20251001",
      escalationModelId: "claude-opus-4-7",
      currentAuthorityLevel: "L2",
      maxAuthorityLevel: "L2",
      authorityRationale:
        "L2 — MONITOR. Agent surfaces risks; humans retain full approval authority. " +
        "Authority is bounded by design; promotion past L2 is not supported and " +
        "would require a re-design of the permit workflow gating.",
      availableTools: [...PERMIT_REVIEW_TOOLS],
      // Typical permit review ~10k input + 1.5k output on Haiku ≈ $0.018.
      estimatedTokensPerInvocation: 11500,
      estimatedCostPerInvocation: 0.018,
      isActive: true,
      isInPilot: true,
      rateLimit: 100
    },
    update: {
      name: "Permit Risk Reviewer",
      description:
        "Reviews Permit to Work (PTW) submissions and surfaces multi-signal " +
        "risks the deterministic rules engine cannot catch: SIMOPS conflicts " +
        "across concurrent permits, scope-control mismatches, crew composition " +
        "concerns, and historical patterns from past incidents in the same " +
        "area. Authority L2 — MONITOR: the agent flags risks; humans decide. " +
        "Output is advisory only — the agent cannot approve, reject, modify, " +
        "or delay any permit.",
      module: "PTW",
      primaryModelId: "claude-haiku-4-5-20251001",
      escalationModelId: "claude-opus-4-7",
      availableTools: [...PERMIT_REVIEW_TOOLS],
      // Leave authority + estimates alone on re-seed.
    }
  });
  console.log(`   agent upserted: ${agent.code} (id=${agent.id})`);

  // 2. Upsert the prompt row
  const existingPrompt = await prisma.agentPrompt.findUnique({
    where: {
      agentId_version: {
        agentId: agent.id,
        version: PERMIT_REVIEWER_PROMPT_VERSION
      }
    }
  });

  let promptId: string;
  if (existingPrompt) {
    const updated = await prisma.agentPrompt.update({
      where: { id: existingPrompt.id },
      data: {
        systemPrompt: promptBody,
        promptDescription:
          `Initial Permit Risk Reviewer prompt (v${PERMIT_REVIEWER_PROMPT_VERSION}). ` +
          "Establishes the L2-MONITOR authority frame, multi-signal review " +
          "patterns (SIMOPS, scope-control mismatch, crew composition, " +
          "historical synthesis), severity scale, and the structured findings " +
          "JSON output schema."
      }
    });
    promptId = updated.id;
    console.log(
      `   prompt v${PERMIT_REVIEWER_PROMPT_VERSION} updated (id=${updated.id})`
    );
  } else {
    const created = await prisma.agentPrompt.create({
      data: {
        agentId: agent.id,
        version: PERMIT_REVIEWER_PROMPT_VERSION,
        systemPrompt: promptBody,
        promptDescription:
          `Initial Permit Risk Reviewer prompt (v${PERMIT_REVIEWER_PROMPT_VERSION}). ` +
          "Establishes the L2-MONITOR authority frame, multi-signal review " +
          "patterns (SIMOPS, scope-control mismatch, crew composition, " +
          "historical synthesis), severity scale, and the structured findings " +
          "JSON output schema.",
        createdById: creatorId,
        approvedById: creatorId,
        approvedAt: new Date()
      }
    });
    promptId = created.id;
    console.log(
      `   prompt v${PERMIT_REVIEWER_PROMPT_VERSION} created (id=${created.id})`
    );
  }

  // 3. Point Agent.activePromptId at this version
  if (agent.activePromptId !== promptId) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { activePromptId: promptId }
    });
    console.log(`   activePromptId → ${promptId}`);
  }
}


async function seedTriageAgent(creatorId: string): Promise<void> {
  console.log("🤖  Agent seed: TRIAGE_AGENT");

  const promptBody = loadPromptFile(
    `triage_agent_v${TRIAGE_AGENT_PROMPT_VERSION}.md`
  );

  // 1. Upsert the Agent row
  const agent = await prisma.agent.upsert({
    where: { code: TRIAGE_AGENT_CODE },
    create: {
      code: TRIAGE_AGENT_CODE,
      name: "Triage Agent",
      description:
        "Triages incoming safety observations and near-miss reports — " +
        "classifying by category and severity, suggesting an action owner, " +
        "analysing similar past cases, and flagging statutory implications " +
        "or candidate near-miss-to-incident promotions. Authority L1 — " +
        "ACT WITH AUDIT: high-confidence routine cases can be auto-applied; " +
        "low-confidence or high-stakes cases route to HSE Manager review. " +
        "Output is calibrated by component confidence; the orchestrator " +
        "determines disposition.",
      module: "OBSERVATION",
      capabilities: {
        classify_category:
          "Pick the most specific category from the tenant's master list, with up to 2 alternatives considered and confidence calibrated to evidence strength.",
        assess_severity:
          "Assign low / moderate / high / critical based on credible worst-case outcome — energy sources, proximity, controls present.",
        suggest_action_owner:
          "Match the implied corrective action to the role best positioned to execute it, considering typical role load.",
        analyse_similar_cases:
          "Rank top 3 similar past records by actual relevance, extract patterns when 2+ cases share a feature.",
        promotion_check:
          "For near misses, examine description for evidence the record is actually an unreported incident (physical contact, equipment damage, environmental release).",
        flag_statutory:
          "Identify whether the record may trigger Factories Act, MAH, CPCB/SPCB, or PESO reporting obligations."
      },
      // Haiku for the high-volume path. Opus as escalation for borderline
      // severity / promotion cases — the orchestrator triggers escalation
      // when component confidences fall below threshold.
      primaryModelId: "claude-haiku-4-5-20251001",
      escalationModelId: "claude-opus-4-7",
      currentAuthorityLevel: "L1",
      maxAuthorityLevel: "L1",
      authorityRationale:
        "L1 — ACT WITH AUDIT. High-confidence routine triage can be applied " +
        "directly with audit trail. Low-confidence, high-severity, statutory, " +
        "or promotion-candidate cases draft for HSE Manager review. Promotion " +
        "past L1 is not supported and would require eval suite re-baselining.",
      // The TriageAgent has no tools — the prompt explicitly says "reason
      // within what is provided". availableTools stays empty so the runtime
      // sends an empty tools list to Anthropic.
      availableTools: [],
      // Typical triage ~6k input + ~1.2k output on Haiku ≈ $0.012.
      estimatedTokensPerInvocation: 7500,
      estimatedCostPerInvocation: 0.012,
      isActive: true,
      isInPilot: true,
      // High volume — match the documented "hundreds to thousands per day"
      // expectation. Per-plant rate limit; pilot can lower this if needed.
      rateLimit: 500
    },
    update: {
      name: "Triage Agent",
      description:
        "Triages incoming safety observations and near-miss reports — " +
        "classifying by category and severity, suggesting an action owner, " +
        "analysing similar past cases, and flagging statutory implications " +
        "or candidate near-miss-to-incident promotions. Authority L1 — " +
        "ACT WITH AUDIT: high-confidence routine cases can be auto-applied; " +
        "low-confidence or high-stakes cases route to HSE Manager review.",
      module: "OBSERVATION",
      primaryModelId: "claude-haiku-4-5-20251001",
      escalationModelId: "claude-opus-4-7",
      availableTools: [],
      // Leave authority + estimates alone on re-seed.
    }
  });
  console.log(`   agent upserted: ${agent.code} (id=${agent.id})`);

  // 2. Upsert the prompt row
  const existingPrompt = await prisma.agentPrompt.findUnique({
    where: {
      agentId_version: {
        agentId: agent.id,
        version: TRIAGE_AGENT_PROMPT_VERSION
      }
    }
  });

  let promptId: string;
  if (existingPrompt) {
    const updated = await prisma.agentPrompt.update({
      where: { id: existingPrompt.id },
      data: {
        systemPrompt: promptBody,
        promptDescription:
          `Initial TriageAgent prompt (v${TRIAGE_AGENT_PROMPT_VERSION}). ` +
          "Establishes the L1-ACT-WITH-AUDIT authority frame, severity " +
          "calibration scale (low / moderate / high / critical) with worked " +
          "examples, component-confidence guidelines, and the structured " +
          "JSON output schema with category / severity / action-owner / " +
          "similar-cases / promotion-check / statutory blocks."
      }
    });
    promptId = updated.id;
    console.log(
      `   prompt v${TRIAGE_AGENT_PROMPT_VERSION} updated (id=${updated.id})`
    );
  } else {
    const created = await prisma.agentPrompt.create({
      data: {
        agentId: agent.id,
        version: TRIAGE_AGENT_PROMPT_VERSION,
        systemPrompt: promptBody,
        promptDescription:
          `Initial TriageAgent prompt (v${TRIAGE_AGENT_PROMPT_VERSION}). ` +
          "Establishes the L1-ACT-WITH-AUDIT authority frame, severity " +
          "calibration scale (low / moderate / high / critical) with worked " +
          "examples, component-confidence guidelines, and the structured " +
          "JSON output schema with category / severity / action-owner / " +
          "similar-cases / promotion-check / statutory blocks.",
        createdById: creatorId,
        approvedById: creatorId,
        approvedAt: new Date()
      }
    });
    promptId = created.id;
    console.log(
      `   prompt v${TRIAGE_AGENT_PROMPT_VERSION} created (id=${created.id})`
    );
  }

  // 3. Point Agent.activePromptId at this version
  if (agent.activePromptId !== promptId) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { activePromptId: promptId }
    });
    console.log(`   activePromptId → ${promptId}`);
  }
}

async function seedHiraAssistant(creatorId: string): Promise<void> {
  console.log("🤖  Agent seed: HIRA_ASSISTANT");

  const promptBody = loadPromptFile(`hira_assistant_v${HIRA_ASSISTANT_PROMPT_VERSION}.md`);

  const agent = await prisma.agent.upsert({
    where: { code: HIRA_ASSISTANT_CODE },
    create: {
      code: HIRA_ASSISTANT_CODE,
      name: "HIRA Assistant",
      description:
        "Assists HIRA study teams: suggests candidate hazards for an activity, " +
        "suggests residual risk given stated controls, and suggests additional " +
        "controls when residual risk is unacceptable. Authority L0 — ADVISORY ONLY. " +
        "Every suggestion is a draft the team explicitly accepts, modifies, or rejects. " +
        "Nothing writes to the HIRA register without a human click.",
      module: "HIRA",
      capabilities: {
        suggest_hazards:
          "Given an activity (description, equipment, materials, energy sources, location), suggest 3-8 candidate hazards from the tenant's library ranked by relevance with grounded rationale.",
        suggest_residual_risk:
          "Given initial risk and the controls applied (with effectiveness ratings), suggest the most credible residual likelihood and severity with rationale citing specific controls.",
        suggest_additional_controls:
          "When residual risk exceeds the acceptability threshold, suggest 2-4 additional controls walking the hierarchy top-down (elimination → substitution → engineering → administrative → PPE) with target reduction estimates."
      },
      // Sonnet for the breadth of reasoning required; Haiku for follow-up runs
      // when the team is iterating quickly on the same entry.
      primaryModelId: "claude-sonnet-4-6",
      escalationModelId: "claude-opus-4-7",
      currentAuthorityLevel: "L0",
      maxAuthorityLevel: "L0",
      authorityRationale:
        "L0 — ADVISORY ONLY. The HIRA register is a statutory document; only the study team writes to it. " +
        "The agent's role is to accelerate the team meeting, not to replace its judgement. " +
        "Promotion past L0 would require buyer-facing eval suite + external EHS reviewer sign-off.",
      // HIRA Assistant reasons within provided context — no DB tools.
      availableTools: [],
      estimatedTokensPerInvocation: 8500,
      estimatedCostPerInvocation: 0.04,
      isActive: true,
      isInPilot: true,
      rateLimit: 200
    },
    update: {
      name: "HIRA Assistant",
      description:
        "Assists HIRA study teams: suggests candidate hazards for an activity, " +
        "suggests residual risk given stated controls, and suggests additional " +
        "controls when residual risk is unacceptable. Authority L0 — ADVISORY ONLY.",
      module: "HIRA",
      primaryModelId: "claude-sonnet-4-6",
      escalationModelId: "claude-opus-4-7",
      availableTools: []
    }
  });
  console.log(`   agent upserted: ${agent.code} (id=${agent.id})`);

  const existingPrompt = await prisma.agentPrompt.findUnique({
    where: {
      agentId_version: {
        agentId: agent.id,
        version: HIRA_ASSISTANT_PROMPT_VERSION
      }
    }
  });

  let promptId: string;
  if (existingPrompt) {
    const updated = await prisma.agentPrompt.update({
      where: { id: existingPrompt.id },
      data: {
        systemPrompt: promptBody,
        promptDescription:
          `HIRA Assistant v${HIRA_ASSISTANT_PROMPT_VERSION} (Phase 2). ` +
          "Adds Layer A integration (10 deterministic rules HA-01..HA-10), " +
          "two new task types (analyze_full_entry, compare_versions), " +
          "pattern observations + reviewer attention items output blocks, " +
          "and explicit calibration guidance against similarPastEntries."
      }
    });
    promptId = updated.id;
    console.log(`   prompt v${HIRA_ASSISTANT_PROMPT_VERSION} updated (id=${updated.id})`);
  } else {
    const created = await prisma.agentPrompt.create({
      data: {
        agentId: agent.id,
        version: HIRA_ASSISTANT_PROMPT_VERSION,
        systemPrompt: promptBody,
        promptDescription:
          `HIRA Assistant v${HIRA_ASSISTANT_PROMPT_VERSION} (Phase 2). ` +
          "Adds Layer A integration (10 deterministic rules HA-01..HA-10), " +
          "two new task types (analyze_full_entry, compare_versions), " +
          "pattern observations + reviewer attention items output blocks, " +
          "and explicit calibration guidance against similarPastEntries.",
        createdById: creatorId,
        approvedById: creatorId,
        approvedAt: new Date()
      }
    });
    promptId = created.id;
    console.log(`   prompt v${HIRA_ASSISTANT_PROMPT_VERSION} created (id=${created.id})`);
  }

  if (agent.activePromptId !== promptId) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { activePromptId: promptId }
    });
    console.log(`   activePromptId → ${promptId}`);
  }
}

async function seedCapaAssistant(creatorId: string): Promise<void> {
  console.log("🤖  Agent seed: CAPA_ASSISTANT");

  const promptBody = loadPromptFile(`capa_assistant_v${CAPA_ASSISTANT_PROMPT_VERSION}.md`);

  const agent = await prisma.agent.upsert({
    where: { code: CAPA_ASSISTANT_CODE },
    create: {
      code: CAPA_ASSISTANT_CODE,
      name: "CAPA Assistant",
      description:
        "Assists CAPA owners across all source categories (safety, quality, " +
        "audit, environmental, calibration, management-review, HIRA-derived). " +
        "Drafts root-cause candidates, action proposals, and verification " +
        "approaches calibrated to the CAPA's source. Authority L0 — ADVISORY " +
        "ONLY. Nothing writes to the CAPA register without an explicit human " +
        "click.",
      module: "CAPA",
      capabilities: {
        suggest_root_causes:
          "Given the CAPA problem, source category, and source-specific context, propose 1-4 candidate root causes ranked by likelihood, each with evidence-to-gather. Source-aware: quality NCRs framed as 8D, audit findings as system-clause gaps, calibration failures as drift/interval issues, etc.",
        suggest_actions:
          "Given confirmed root causes, propose 2-6 corrections, corrective actions, and preventive actions with target role, target days, and a verification criterion. Walks the control hierarchy for safety/environmental/HIRA-source CAPAs.",
        suggest_verification:
          "Given executed actions, propose the verification method, criterion, wait period, and data to collect — calibrated to the source category's typical effectiveness signal."
      },
      // Sonnet for breadth of reasoning across source categories; Opus as
      // escalation for highly complex cross-source CAPAs (e.g. quality NCR
      // tied to a process-safety event).
      primaryModelId: "claude-sonnet-4-6",
      escalationModelId: "claude-opus-4-7",
      currentAuthorityLevel: "L0",
      maxAuthorityLevel: "L0",
      authorityRationale:
        "L0 — ADVISORY ONLY. CAPA is the audit-trail of corrective action across " +
        "the management system; only the owner team writes to it. The agent's " +
        "role is to accelerate drafting, not replace judgement. Promotion past " +
        "L0 would require a per-source-category eval suite and external auditor sign-off.",
      // CAPA Assistant reasons within provided context — no DB tools.
      availableTools: [],
      estimatedTokensPerInvocation: 9500,
      estimatedCostPerInvocation: 0.045,
      isActive: true,
      isInPilot: true,
      rateLimit: 200
    },
    update: {
      name: "CAPA Assistant",
      description:
        "Assists CAPA owners across all source categories (safety, quality, " +
        "audit, environmental, calibration, management-review, HIRA-derived). " +
        "Drafts root-cause candidates, action proposals, and verification " +
        "approaches calibrated to the CAPA's source. Authority L0 — ADVISORY ONLY.",
      module: "CAPA",
      primaryModelId: "claude-sonnet-4-6",
      escalationModelId: "claude-opus-4-7",
      availableTools: []
    }
  });
  console.log(`   agent upserted: ${agent.code} (id=${agent.id})`);

  const existingPrompt = await prisma.agentPrompt.findUnique({
    where: {
      agentId_version: {
        agentId: agent.id,
        version: CAPA_ASSISTANT_PROMPT_VERSION
      }
    }
  });

  let promptId: string;
  if (existingPrompt) {
    const updated = await prisma.agentPrompt.update({
      where: { id: existingPrompt.id },
      data: {
        systemPrompt: promptBody,
        promptDescription:
          `Initial CAPA Assistant prompt (v${CAPA_ASSISTANT_PROMPT_VERSION}). ` +
          "Source-aware framing across SAFETY / QUALITY / AUDIT / ENVIRONMENTAL / " +
          "CALIBRATION / MANAGEMENT_REVIEW / HIRA_RISK_REDUCTION. Three task " +
          "types (suggest_root_causes, suggest_actions, suggest_verification) " +
          "with structured JSON output, calibration rules, and L0 advisory frame."
      }
    });
    promptId = updated.id;
    console.log(`   prompt v${CAPA_ASSISTANT_PROMPT_VERSION} updated (id=${updated.id})`);
  } else {
    const created = await prisma.agentPrompt.create({
      data: {
        agentId: agent.id,
        version: CAPA_ASSISTANT_PROMPT_VERSION,
        systemPrompt: promptBody,
        promptDescription:
          `Initial CAPA Assistant prompt (v${CAPA_ASSISTANT_PROMPT_VERSION}). ` +
          "Source-aware framing across SAFETY / QUALITY / AUDIT / ENVIRONMENTAL / " +
          "CALIBRATION / MANAGEMENT_REVIEW / HIRA_RISK_REDUCTION. Three task " +
          "types (suggest_root_causes, suggest_actions, suggest_verification) " +
          "with structured JSON output, calibration rules, and L0 advisory frame.",
        createdById: creatorId,
        approvedById: creatorId,
        approvedAt: new Date()
      }
    });
    promptId = created.id;
    console.log(`   prompt v${CAPA_ASSISTANT_PROMPT_VERSION} created (id=${created.id})`);
  }

  if (agent.activePromptId !== promptId) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { activePromptId: promptId }
    });
    console.log(`   activePromptId → ${promptId}`);
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
