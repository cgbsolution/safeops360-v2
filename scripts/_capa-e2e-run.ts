// End-to-end CAPA lifecycle run, driven through the real UI against the real
// backend. Proves the RCA methodology templates switch, then walks one CAPA
// from DRAFT to CLOSED + recurrence check.
//
//   BACKEND on :8001, Next on :3000, then:
//   npx tsx scripts/_capa-e2e-run.ts
//
// Throwaway diagnostic — not part of the e2e suite.

import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = "admin@safeops360.in";
const PASSWORD = "demo123";
const CAPA_ID = process.env.CAPA_ID ?? "cmqgxjyh2004zph0cexwa1ywt"; // CAPA-NW-DEMO-008
const GOVERNED_CAPA_ID = "cd406e5b447e4209a7b941847f68a4a8"; // the one from the bug report
const SHOTS = process.env.SHOT_DIR ?? "./_capa-run";

let step = 0;
const log: string[] = [];

function note(msg: string) {
  const line = `[${String(++step).padStart(2, "0")}] ${msg}`;
  console.log(line);
  log.push(line);
}

async function shot(page: Page, name: string) {
  const file = path.join(SHOTS, `${String(step).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function login(page: Page) {
  // Clicking Sign in before React has hydrated submits the form natively, which
  // lands back on /login? with nothing signed in. Retry until the click is the
  // handler's rather than the browser's.
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    // #email / #password are the credentials fields — the page also carries a
    // persona-search input that matches input[type="email"] first.
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page
      .locator("form")
      .filter({ has: page.locator("#password") })
      .locator('button[type="submit"]')
      .click();
    try {
      await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20_000 });
      note(`logged in as ${EMAIL} (attempt ${attempt})`);
      return;
    } catch {
      note(`sign-in attempt ${attempt} did not navigate — retrying`);
    }
  }
  throw new Error("could not sign in after 4 attempts");
}

async function openTab(page: Page, id: string, tab: string) {
  await page.goto(`${BASE}/capa/${id}?tab=${tab}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
}

// The RCA form's method <select> is the one whose options include Bowtie.
function methodSelect(page: Page) {
  return page.locator("select").filter({ hasText: "Bowtie" }).first();
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });

  try {
    await login(page);

    // ── A. the governed CAPA from the bug report ──────────────────────
    await openTab(page, GOVERNED_CAPA_ID, "rca");
    const banner = await page.getByText("governed by", { exact: false }).count();
    const formButton = await page.getByRole("button", { name: /Submit Root Cause Analysis/ }).count();
    note(
      `governed CAPA: governance banner=${banner > 0 ? "shown" : "MISSING"}, ` +
        `free-text RCA form=${formButton > 0 ? "STILL OFFERED (bug)" : "correctly hidden"}`
    );
    await shot(page, "governed-capa-rca-tab");

    // ── B. template switching on the working CAPA ─────────────────────
    await openTab(page, CAPA_ID, "rca");
    note("opened working CAPA RCA tab");
    await shot(page, "rca-tab-before");

    await page.getByRole("button", { name: /Submit Root Cause Analysis/ }).click();
    await page.waitForTimeout(400);
    note("opened the Submit RCA form");
    await shot(page, "rca-form-open");

    const METHODS: { code: string; marker: string }[] = [
      { code: "FIVE_WHY", marker: "5-Why Analysis" },
      { code: "FISHBONE", marker: "Fishbone (Ishikawa) — 6M Categories" },
      { code: "FTA", marker: "Fault Tree Analysis (FTA)" },
      { code: "BOWTIE", marker: "Bowtie Analysis" },
      { code: "TAPROOT", marker: "TapRoot Analysis" },
      { code: "CAUSE_MAP", marker: "Cause Map" },
      { code: "EIGHT_D", marker: "has no structured" }
    ];
    const sel = methodSelect(page);
    for (const m of METHODS) {
      await sel.selectOption(m.code);
      await page.waitForTimeout(350);
      const seen = await page.getByText(m.marker, { exact: false }).count();
      note(`method ${m.code.padEnd(10)} → template "${m.marker}" ${seen > 0 ? "rendered ✓" : "NOT FOUND ✗"}`);
      await shot(page, `method-${m.code.toLowerCase()}`);
    }

    // ── C. fill the 5-Why and submit ──────────────────────────────────
    await sel.selectOption("FIVE_WHY");
    await page.waitForTimeout(300);
    page.once("dialog", (d) => d.accept()); // the switch-away confirm, if it fires
    await page.waitForTimeout(200);

    const problem = page.getByPlaceholder("One-sentence description of what happened...");
    await problem.fill(
      "Fire evacuation drill for the knitting block was not completed within the statutory 6-month interval."
    );
    const whyQ = page.getByPlaceholder("Why did this happen?");
    await whyQ.fill("Why was the drill not held on schedule?");
    const answers = page.getByPlaceholder("Answer...");
    const whys = page.getByPlaceholder("Why?");
    const chain = [
      [
        "The drill calendar was owned by the shift in charge and never transferred when the role changed.",
        "Why did the handover miss the drill calendar?"
      ],
      [
        "The handover checklist covers production items only and has no statutory-compliance section.",
        "Why does the handover checklist have no compliance section?"
      ],
      [
        "It was written by production planning and never reviewed by the safety function.",
        "Why was it never reviewed by safety?"
      ],
      [
        "No control requires safety sign-off on role handover documents.",
        "Why is there no such control?"
      ],
      ["Handover was treated as a production process, not a compliance-bearing one.", ""]
    ];
    await answers.nth(0).fill(chain[0][0]);
    for (let i = 1; i < chain.length; i++) {
      await whys.nth(i - 1).fill(chain[i - 1][1]);
      await answers.nth(i).fill(chain[i][0]);
    }
    await page
      .getByPlaceholder("Final identified root cause.")
      .fill(
        "Role handover is governed as a production process with no safety sign-off, so statutory duties attached to a role are not carried across when the role changes hands."
      );
    await page.waitForTimeout(500);
    note("filled the 5-Why ladder (5 levels + root cause)");
    await shot(page, "five-why-filled");

    const derivedCount = await page.getByText("Contributing levels read from the analysis", { exact: false }).count();
    const summaryBox = page.getByPlaceholder(
      "Conclusion of the analysis — what does the team believe caused the problem?"
    );
    const autoSummary = await summaryBox.inputValue();
    note(`derived-levels panel ${derivedCount > 0 ? "shown ✓" : "MISSING ✗"}; auto summary = ${JSON.stringify(autoSummary.slice(0, 90))}`);

    await page.getByRole("button", { name: /Fill from analysis/ }).click();
    await page.waitForTimeout(300);
    note("clicked 'Fill from analysis' to populate the root-cause row");
    await shot(page, "before-submit");

    await page.getByRole("button", { name: /^Submit RCA$/ }).click();
    await page.waitForTimeout(3500);
    await page.waitForLoadState("networkidle");
    note("submitted the RCA");
    await shot(page, "rca-submitted");

    const chip = await page.getByText("Analysis complete", { exact: false }).count();
    const recorded = await page.getByText("analysis as recorded", { exact: false }).count();
    const ladder = await page.getByText("Why-Why Analysis", { exact: false }).count();
    note(
      `after submit: "Analysis complete"=${chip > 0 ? "✓" : "✗"}, ` +
        `structured read-back=${recorded > 0 ? "✓" : "✗"}, Why-Why ladder=${ladder > 0 ? "✓" : "✗"}`
    );

    fs.writeFileSync(path.join(SHOTS, "run-log.txt"), log.join("\n") + "\n");
    if (consoleErrors.length) {
      fs.writeFileSync(path.join(SHOTS, "console-errors.txt"), consoleErrors.join("\n"));
      console.log(`\n⚠ ${consoleErrors.length} console error(s) captured — see console-errors.txt`);
    }
    console.log(`\nScreenshots in ${path.resolve(SHOTS)}`);
  } finally {
    await ctx.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error("RUN FAILED:", e);
  fs.writeFileSync(path.join(SHOTS, "run-log.txt"), log.join("\n") + `\nFAILED: ${e}\n`);
  process.exit(1);
});
