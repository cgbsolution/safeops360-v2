import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

export const BASE = "http://localhost:3000";
export const PW = "demo123";
export const SHOT_DIR = path.resolve("../docs/incident-investigation/incident-investigation-manual-screenshots");
export const MANIFEST = path.resolve("../docs/incident-investigation/manifest.json");

export const VIEWPORT = { width: 1500, height: 950 };

export async function launch() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale: "en-IN", timezoneId: "Asia/Kolkata" });
  ctx.setDefaultTimeout(45000);
  return { browser, ctx };
}

export async function login(page, email, password = PW) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  return page;
}

export async function submitLogin(page) {
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 }),
    page.click('button[type="submit"]')
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}
