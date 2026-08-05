// E2E config for the Guided Field Capture flows (airplane-mode + tap-count).
// Requires BOTH servers running before `npm run e2e`:
//   backend:  cd ../safeops_360_bakend && ./venv/Scripts/python -m uvicorn app.main:app --port 8000
//   frontend: npm run dev            (or `npm run build && npm start`)
// First run: npx playwright install chromium

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false, // offline/online toggling — keep runs serial
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    // the capture flow targets cheap Android — emulate one
    ...devices["Pixel 5"],
  },
});
