// Phase 2 of the CAPA end-to-end run: from ACTIONS_PLANNED through action
// execution, effectiveness verification, closure and the recurrence check.
// Driven through the real UI against the real backend.
//
//   npx tsx scripts/_capa-e2e-lifecycle.ts
//
// Throwaway diagnostic — not part of the e2e suite.

import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = "admin@safeops360.in";
const PASSWORD = "demo123";
const CAPA_ID = process.env.CAPA_ID ?? "cmqgxjyh2004zph0cexwa1ywt"; // CAPA-NW-DEMO-008
const SHOTS = process.env.SHOT_DIR ?? "./_capa-run";

let step = 20;
const log: string[] = [];

function note(msg: string) {
  const line = `[${String(++step).padStart(2, "0")}] ${msg}`;
  console.log(line);
  log.push(line);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${String(step).padStart(2, "0")}-${name}.png`), fullPage: true });
}

async function login(page: Page) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.locator("form").filter({ has: page.locator("#password") }).locator('button[type="submit"]').click();
    try {
      await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20_000 });
      note(`logged in as ${EMAIL}`);
      return;
    } catch {
      /* not hydrated yet — try again */
    }
  }
  throw new Error("could not sign in");
}

async function openTab(page: Page, tab: string) {
  await page.goto(`${BASE}/capa/${CAPA_ID}?tab=${tab}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
}

async function stateChip(page: Page): Promise<string> {
  const chips = page.locator("header span, div span").filter({ hasText: /^(DRAFT|SUBMITTED|UNDER RCA|ACTIONS PLANNED|ACTIONS IN PROGRESS|PENDING VERIFICATION|VERIFIED|CLOSED)$/ });
  return (await chips.count()) ? ((await chips.first().textContent()) ?? "").trim() : "?";
}

// The three action groups render in a fixed order — Immediate Containment,
// Corrective, Preventive — so the nth "+ Add action" button is the nth group.
// Targeting by card text is unreliable: every ancestor div matches the heading.
async function addAction(page: Page, groupIndex: number, type: string, description: string) {
  const adders = page.getByRole("button", { name: "+ Add action" });
  await adders.nth(groupIndex).click();
  await page.waitForTimeout(600);
  const selects = page.locator("select");
  const typeSel = selects.nth(0);
  await typeSel.selectOption(type);
  // Owner picker — first real person in the list.
  const owner = selects.nth(1);
  const values = await owner.locator("option").evaluateAll((os) =>
    os.map((o) => (o as HTMLOptionElement).value).filter(Boolean)
  );
  if (!values.length) throw new Error("owner picker is empty");
  await owner.selectOption(values[0]);
  await page.getByPlaceholder("Action description").fill(description);
  await page.getByPlaceholder("Rationale (optional)").fill("Traceable to the root cause recorded on the RCA tab.");
  await page.getByRole("button", { name: /^Add Action$/ }).click();
  await page.waitForTimeout(3200);
  await page.waitForLoadState("networkidle");
}

// Walk every action on the execution board to COMPLETED, one control at a time.
// The board re-renders after each PATCH, so each pass re-reads the DOM.
async function driveExecution(page: Page) {
  for (let pass = 1; pass <= 14; pass++) {
    await openTab(page, "execution");
    const approve = page.getByRole("button", { name: "Approve" });
    const start = page.getByRole("button", { name: "Start" });
    const complete = page.getByRole("button", { name: "Mark complete" });

    if (await approve.count()) {
      await approve.first().click();
    } else if (await start.count()) {
      await start.first().click();
    } else if (await complete.count()) {
      await complete.first().click();
      await page.waitForTimeout(400);
      await page
        .locator("textarea")
        .last()
        .fill(
          "Verified on the shop floor: enclosure fitted, sound level meter reading logged against the pre-work baseline and filed with the shift record."
        );
      await page.getByRole("button", { name: "Confirm" }).first().click();
    } else {
      note(`execution board drained after ${pass - 1} action(s) driven`);
      return;
    }
    await page.waitForTimeout(2600);
    await page.waitForLoadState("networkidle");
  }
  note("execution loop hit its pass limit — check the board");
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

    // ── RCA read-back, now that the analysis is saved ─────────────────
    await openTab(page, "rca");
    const recorded = await page.getByText("analysis as recorded", { exact: false }).count();
    const ladder = await page.getByText("Why-Why Analysis", { exact: false }).count();
    const complete = await page.getByText("Analysis complete", { exact: false }).count();
    note(
      `RCA tab read-back: method chip+"Analysis complete"=${complete > 0 ? "✓" : "✗"}, ` +
        `Why-Why ladder=${ladder > 0 ? "✓" : "✗"}, structured template=${recorded > 0 ? "✓" : "✗"}`
    );
    await shot(page, "rca-readback");

    // ── Actions ───────────────────────────────────────────────────────
    await openTab(page, "actions");
    note(`actions tab opened — state ${await stateChip(page)}`);
    await addAction(
      page,
      0,
      "IMMEDIATE_CONTAINMENT",
      "Post the overdue drill on the current month's compliance calendar and brief the knitting-block shift in charge."
    );
    note("added an immediate containment action");
    await openTab(page, "actions");
    await addAction(
      page,
      1,
      "CORRECTIVE",
      "Add a statutory-compliance section to the role handover checklist and require safety sign-off before handover is accepted."
    );
    note("added a corrective action");
    await openTab(page, "actions");
    await shot(page, "actions-added");

    // ── Execution ─────────────────────────────────────────────────────
    await driveExecution(page);
    await openTab(page, "execution");
    note(`execution complete — state ${await stateChip(page)}`);
    await shot(page, "execution-board");

    // ── Verification ──────────────────────────────────────────────────
    await openTab(page, "verification");
    await page.getByRole("button", { name: /Submit Verification/ }).first().click();
    await page.waitForTimeout(600);
    const vform = page.locator("div").filter({ hasText: "Submit Effectiveness Verification" }).last();
    await vform
      .getByPlaceholder("What does success look like? What metric / observation / test confirms it?")
      .fill("Two consecutive handovers completed with safety sign-off, and the next drill held inside the statutory interval.");
    await vform.locator("select").last().selectOption("EFFECTIVE");
    await vform
      .getByPlaceholder("Document what you observed / measured / reviewed and what it showed.")
      .fill(
        "Reviewed the two handovers completed since the change: both carry the compliance section and a safety signature. The evacuation drill was held on 14 Aug, inside the interval. Sound-level readings after enclosure fitting are logged against baseline."
      );
    await vform.getByRole("button", { name: /^Submit Verification$/ }).click();
    await page.waitForTimeout(3500);
    await page.waitForLoadState("networkidle");
    note(`verification submitted — state ${await stateChip(page)}`);
    await shot(page, "verification-done");

    // ── Closure ───────────────────────────────────────────────────────
    await openTab(page, "closure");
    await page.getByRole("button", { name: /^Close CAPA$/ }).first().click();
    await page.waitForTimeout(600);
    await page.getByPlaceholder("Final summary for the audit trail.").fill(
      "Root cause addressed at the process level: handover is now a compliance-bearing document with safety sign-off. Containment and corrective actions complete and evidenced; effectiveness verified."
    );
    await page.getByRole("button", { name: /Confirm Close/ }).click();
    await page.waitForTimeout(3500);
    await page.waitForLoadState("networkidle");
    note(`closed — state ${await stateChip(page)}`);
    await shot(page, "closed");

    // ── Recurrence check ──────────────────────────────────────────────
    await openTab(page, "closure");
    const rcBtn = page.getByRole("button", { name: /Complete Recurrence Check/ });
    if (await rcBtn.count()) {
      await rcBtn.first().click();
      await page.waitForTimeout(500);
      await page.getByText("No recurrence — CAPA stays closed").click();
      await page.locator("textarea").last().fill("No repeat of the missed-drill condition in the 90 days since closure.");
      await page.getByRole("button", { name: /Submit Check/ }).click();
      await page.waitForTimeout(3500);
      await page.waitForLoadState("networkidle");
      note(`recurrence check submitted — state ${await stateChip(page)}`);
    } else {
      note("recurrence check button NOT OFFERED after closure ✗");
    }
    await shot(page, "recurrence-check");

    await openTab(page, "audit");
    note("audit trail captured");
    await shot(page, "audit-trail");

    fs.writeFileSync(path.join(SHOTS, "run-log-phase2.txt"), log.join("\n") + "\n");
    if (consoleErrors.length) {
      fs.writeFileSync(path.join(SHOTS, "console-errors-phase2.txt"), consoleErrors.join("\n"));
      console.log(`\n⚠ ${consoleErrors.length} console error(s) — see console-errors-phase2.txt`);
    }
  } finally {
    await ctx.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error("RUN FAILED:", e);
  fs.writeFileSync(path.join(SHOTS, "run-log-phase2.txt"), log.join("\n") + `\nFAILED: ${e}\n`);
  process.exit(1);
});
