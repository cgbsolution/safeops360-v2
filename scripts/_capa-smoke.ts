// Post-change smoke: signs in and confirms the pages touched by the CAPA RCA
// work still render without a server error.
//
//   npx tsx scripts/_capa-smoke.ts
//
// Throwaway diagnostic — not part of the e2e suite.

import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const CAPA_ID = "cmqgxjyh2004zph0cexwa1ywt";
const GOVERNED = "cd406e5b447e4209a7b941847f68a4a8";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } } as never);
  let bad = 0;
  try {
    for (let a = 1; a <= 4; a++) {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      await page.fill("#email", "admin@safeops360.in");
      await page.fill("#password", "demo123");
      await page.locator("form").filter({ has: page.locator("#password") }).locator('button[type="submit"]').click();
      try {
        await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20_000 });
        break;
      } catch {
        if (a === 4) throw new Error("could not sign in");
      }
    }
    const paths = [
      "/capa",
      `/capa/${CAPA_ID}?tab=rca`,
      `/capa/${CAPA_ID}?tab=actions`,
      `/capa/${CAPA_ID}/print`,
      `/capa/${GOVERNED}?tab=rca`,
      "/cams/findings"
    ];
    for (const p of paths) {
      const res = await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
      const status = res?.status() ?? 0;
      const crashed = await page.getByText("Application error", { exact: false }).count();
      const ok = status < 400 && crashed === 0;
      if (!ok) bad++;
      console.log(`${ok ? "✓" : "✗"} ${String(status).padEnd(3)} ${p}`);
    }
  } finally {
    await browser.close();
  }
  if (bad) process.exit(1);
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(1);
});
