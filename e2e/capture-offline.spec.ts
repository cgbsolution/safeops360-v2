// Airplane-mode E2E (spec 1.4 testable requirement):
//   submit 3 observations with photos while OFFLINE, close and reopen the app,
//   restore network, assert all 3 arrive server-side EXACTLY ONCE with media.
// Plus the tap-count budget assertion (spec 1.1.7): happy path <= 8 taps.
//
// Prereqs: frontend + backend running (see playwright.config.ts header),
// seed-capture applied (ramesh.kumar@safeops360.in / demo123 exists).

import { expect, test, type Page } from "@playwright/test";

const TECH_EMAIL = "ramesh.kumar@safeops360.in";
const TECH_PASSWORD = "demo123";

// 1x1 red PNG — goes through the wizard's canvas compressor untouched
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#email", TECH_EMAIL);
  await page.fill("#password", TECH_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/(capture|dashboard|inbox)/, { timeout: 30_000 });
}

async function openWizard(page: Page) {
  await page.goto("/capture");
  // first launch shows the language picker — pick Hindi (the demo default)
  const hindiBtn = page.getByTestId("btn-lang-hi");
  if (await hindiBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await hindiBtn.click();
  }
  await expect(page.getByTestId("tile-type-observation")).toBeVisible({ timeout: 30_000 });
}

/** Walk screens 0-6 (happy path) and submit. Returns after the terminal screen. */
async function submitObservation(page: Page, opts: { withPhoto: boolean; expectQueued: boolean }) {
  await page.getByTestId("tile-type-observation").click();
  await page.locator("[data-testid^=tile-area-]").first().click();
  await page.locator("[data-testid^=tile-cat-l1-]").first().click();
  // L1 may or may not have children
  const l2 = page.locator("[data-testid^=tile-cat-l2-]").first();
  if (await l2.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await l2.click();
  }
  if (opts.withPhoto) {
    await page.getByTestId("input-photo").setInputFiles({
      name: "evidence.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(page.locator("img[src^=blob]")).toBeVisible({ timeout: 10_000 });
  }
  await page.getByTestId("btn-evidence-next").click();
  await page.getByTestId("tile-sev-medium").click();
  await page.getByTestId("btn-voice-next").click({ timeout: 10_000 });
  await page.getByTestId("btn-submit").click();
  await expect(page.getByTestId(opts.expectQueued ? "screen-queued" : "screen-success")).toBeVisible({
    timeout: 30_000,
  });
}

test("airplane mode: 3 offline submissions with photos arrive exactly once", async ({ page, context }) => {
  await login(page);
  await openWizard(page); // online boot — caches shell + taxonomy + bootstrap

  await context.setOffline(true);

  for (let i = 0; i < 3; i++) {
    await submitObservation(page, { withPhoto: true, expectQueued: true });
    if (i < 2) {
      await page.getByTestId("btn-another").click();
      await expect(page.getByTestId("tile-type-observation")).toBeVisible({ timeout: 15_000 });
    }
  }

  // "kill and reopen the app" — close the tab, open a fresh one, still offline
  await page.close();
  const page2 = await context.newPage();
  await page2.goto("/capture/mine").catch(() => undefined); // served by the SW cache
  // the 3 queued rows survive the restart (IndexedDB outbox)
  await expect(page2.getByText(/नेटवर्क का इंतज़ार|Waiting for network/).first()).toBeVisible({ timeout: 30_000 });

  // restore network → the sync engine drains the outbox
  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        const res = await page2.request.get("/api/capture/submissions/mine");
        if (!res.ok()) return -1;
        const data = (await res.json()) as { items: { clientSubmissionId: string; attachments: { kind: string }[] }[] };
        return data.items.length;
      },
      { timeout: 90_000, intervals: [2_000] },
    )
    .toBeGreaterThanOrEqual(3);

  const res = await page2.request.get("/api/capture/submissions/mine");
  const data = (await res.json()) as {
    items: { clientSubmissionId: string; attachments: { kind: string }[] }[];
  };

  // exactly once: no duplicate clientSubmissionIds server-side
  const ids = data.items.map((s) => s.clientSubmissionId);
  expect(new Set(ids).size).toBe(ids.length);

  // media intact: the 3 newest submissions each carry their photo
  await expect
    .poll(
      async () => {
        const r = await page2.request.get("/api/capture/submissions/mine");
        const d = (await r.json()) as { items: { attachments: { kind: string }[] }[] };
        return d.items.slice(0, 3).filter((s) => s.attachments.some((a) => a.kind === "PHOTO")).length;
      },
      { timeout: 60_000, intervals: [2_000] },
    )
    .toBe(3);
});

test("tap-count budget: happy-path submission is <= 8 taps", async ({ page }) => {
  await login(page);
  await openWizard(page);

  let tapCount: number | null = null;
  page.on("request", (req) => {
    if (req.url().includes("/api/capture/submissions") && req.method() === "POST") {
      try {
        const body = req.postDataJSON() as { capture?: { tapCount?: number } };
        if (body?.capture?.tapCount != null) tapCount = body.capture.tapCount;
      } catch {
        /* not JSON */
      }
    }
  });

  // happy path — no photo, skip voice: type, area, L1, (L2), skip evidence,
  // severity, skip voice, submit
  await submitObservation(page, { withPhoto: false, expectQueued: false });

  expect(tapCount).not.toBeNull();
  expect(tapCount as unknown as number).toBeLessThanOrEqual(8);
});
