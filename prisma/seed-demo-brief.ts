// `npm run seed:demo-brief` (build spec 2.4) — thin wrapper that runs the
// backend seed. The demo pre-state touches backend-owned tables
// (RootCauseAnalysis) and reuses the SQLAlchemy models + services, so the real
// implementation lives in safeops_360_bakend/seed_demo_brief.py. This wrapper
// just invokes it with the backend virtualenv so the platform command works
// from the frontend package like the other db:seed-* scripts.
//
// Resets to: RCA-2026-0104 (PEER_REVIEW, 3 CAPAs) + PTW-NW-2026-2231 ACTIVE
// (Cutting Hall) + overlap + 2 HIGH machine-guarding reports in Sewing Line 2.
// Then perform the 3 live actions on /dashboard/daily. See DEMO_DAILY_BRIEF.md.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

// The backend checkout sits alongside the frontend, but the directory name
// differs per portal ("Safeops360-backend" here, "safeops_360_bakend" in the
// original repo). Probe both so this works from either layout.
const BACKEND_DIR_NAMES = ["Safeops360-backend", "safeops_360_bakend"];
const backendDir =
  BACKEND_DIR_NAMES.map((d) => resolve(__dirname, "..", "..", d)).find((d) =>
    existsSync(join(d, "seed_demo_brief.py")),
  ) ?? resolve(__dirname, "..", "..", BACKEND_DIR_NAMES[0]);
const winPy = join(backendDir, "venv", "Scripts", "python.exe");
const nixPy = join(backendDir, "venv", "bin", "python");
const python = existsSync(winPy) ? winPy : existsSync(nixPy) ? nixPy : "python";

if (!existsSync(join(backendDir, "seed_demo_brief.py"))) {
  console.error(`Backend seed not found at ${backendDir}/seed_demo_brief.py`);
  process.exit(1);
}

console.log(`Running backend demo-brief seed (${python})…`);
const res = spawnSync(python, ["seed_demo_brief.py"], {
  cwd: backendDir,
  stdio: "inherit",
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});
process.exit(res.status ?? 1);
