import { launch, login, submitLogin, BASE } from "./lib.mjs";
const { browser, ctx } = await launch();
const page = await ctx.newPage();
await login(page, "worker.hr.nw@safeops360.in"); await submitLogin(page);
await page.goto(`${BASE}/incidents/new`, { waitUntil: "networkidle" });
console.log("URL:", page.url());
const txt = await page.locator("body").innerText();
console.log(txt.slice(0, 3000));
await browser.close();
