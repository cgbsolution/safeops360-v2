/**
 * Regression test for the "assignee gets a 404 on their own task" bug.
 * For each module, signs in as a real workflow assignee whose role scope would
 * otherwise deny the read, opens the record page, and reports whether it 404s.
 */
const { chromium } = require('C:/cgbcode/pagesafeops/SafeOps360/node_modules/@playwright/test');
const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const PW = 'demo123';

const CASES = [
  { module: 'NEAR_MISS',   path: 'near-miss',    id: '4401d41cc58045b5b859af49b956ad38',
    email: 'dept-head.it.nw@safeops360.in',        who: 'Yogesh Patel (DEPARTMENT_HEAD)' },
  { module: 'OBSERVATION', path: 'observations',  id: '44cedea0ff8b4e4f8d5f83c71f0a4e3d',
    email: 'maintenance-head.it.nw@safeops360.in', who: 'Tushar Mishra (MAINTENANCE_HEAD)' },
  { module: 'PTW',         path: 'ptw',           id: '25eac643ceeb42ffa4d70666dd214042',
    email: 'supervisor.it.nw@safeops360.in',       who: 'Mohan Lal (SUPERVISOR)' },
  { module: 'INSPECTION',  path: 'inspections',   id: 'cmqgxj9yb0082148jshs5nvvq',
    email: 'maintenance-head.it.nw@safeops360.in', who: 'Tushar Mishra (MAINTENANCE_HEAD)' },
];

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  let fails = 0;

  for (const c of CASES) {
    await ctx.clearCookies();
    await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForSelector('#email', { timeout: 60000 });
    await p.fill('#email', c.email);
    await p.fill('#password', PW);
    await p.click('button[type=submit]');
    try {
      await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 60000 });
    } catch {
      // first compile of a cold route can outrun the wait — retry once
      await p.fill('#email', c.email); await p.fill('#password', PW);
      await p.click('button[type=submit]');
      await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 90000 });
    }

    await p.goto(`${BASE}/${c.path}/${c.id}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForTimeout(7000);
    const body = await p.evaluate(() => document.body.innerText || '');
    const is404 = /this page could not be found/i.test(body) || /^\s*404\b/m.test(body);
    if (is404) fails++;
    const head = body.split('\n').map(s => s.trim()).filter(Boolean)
      .filter(s => !/^(S360|SafeOps360|Page Industries|Inbox|Dashboard)$/i.test(s))[0] || '(empty)';
    console.log(`${is404 ? 'FAIL 404' : 'OK      '} ${c.module.padEnd(12)} ${c.who.padEnd(38)} ${head.slice(0, 46)}`);
  }

  console.log(fails === 0
    ? '\nAll modules: workflow assignees can open their record.'
    : `\n${fails} module(s) still 404 for their assignee.`);
  await b.close();
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
