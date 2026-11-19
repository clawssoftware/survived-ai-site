#!/usr/bin/env node
/*
 * Screenshot + sanity check for the landing page.
 *   python3 -m http.server 8123 --directory site &
 *   NODE_PATH=/Users/nanoclaw/Desktop/survived/APP/survivedAI/node_modules node tools/shoot.cjs [outDir]
 * Uses the system Chrome via Playwright (channel: 'chrome').
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '../screenshots'));
fs.mkdirSync(OUT, { recursive: true });

// For full-page captures, settle scroll-driven animations at their end state
// (a full-page capture can't scroll every element through the viewport).
const SETTLE = `
  .realm, .facts li, .clip, .faq__list details, .socials li, .lit span, .hero__media img { animation: none !important; }
`;

const viewports = [
  { name: 'mobile', width: 390, height: 844, dsf: 2, mobile: true },
  { name: 'desktop', width: 1440, height: 900, dsf: 1, mobile: false },
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const report = {};
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });
    const page = await ctx.newPage();
    const errors = [];
    let bytes = 0;
    const requests = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
    page.on('response', async (r) => {
      try {
        const b = await r.body();
        bytes += b.length;
        requests.push([r.status(), b.length, r.url().replace(BASE, '/')]);
        if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
      } catch {}
    });
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
        .observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-hero.png`) });

    // The live phone demo, caught mid-answer.
    await page.evaluate(() => document.getElementById('phone')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(6600);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-demo.png`) });

    // Scroll through to trigger lazy images, then capture full page with settled animations.
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += vp.height / 2) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.addStyleTag({ content: SETTLE });
    await page.evaluate(() => window.__settle && window.__settle());
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-full.png`), fullPage: true, scale: 'css' });

    const metrics = await page.evaluate(() => ({
      cls: window.__cls,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      height: document.documentElement.scrollHeight,
    }));
    report[vp.name] = { errors, bytes, metrics, requests: requests.length };
    if (vp.name === 'desktop') report.requestList = requests;
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
