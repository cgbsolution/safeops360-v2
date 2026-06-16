// QA Phase 3 — run the TS activation gate on a permit and dump the PPE
// section as JSON, for diffing against the Python service's output.
// Usage: npx tsx scripts/qa-parity-gate.ts <permitId>
import { writeFileSync } from "node:fs";
import { getPtwActivationGate } from "../src/lib/ptw/activation-gate";

async function main() {
  const permitId = process.argv[2];
  if (!permitId) {
    console.error("usage: tsx scripts/qa-parity-gate.ts <permitId>");
    process.exit(2);
  }
  const gate = await getPtwActivationGate(permitId);
  const out = {
    permitId,
    crewPpeIssues: gate.crewPpeIssues,
    crewPpeWarnings: gate.crewPpeWarnings
  };
  writeFileSync("scripts/qa_parity_actual.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
