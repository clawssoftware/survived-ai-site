#!/usr/bin/env node
/*
 * Renders tools/og-template.html to site/assets/og/og-image.png (1200x630).
 *   NODE_PATH=/Users/nanoclaw/Desktop/survived/APP/survivedAI/node_modules node tools/render-og.cjs
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const sharp = require('sharp');

(async () => {
  const out = path.resolve(__dirname, '../site/assets/og/og-image.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, 'og-template.html'));
  await page.waitForTimeout(300);
  const buf = await page.screenshot({ type: 'png' });
  await browser.close();
  await sharp(buf).png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 }).toFile(out);
  console.log('wrote', out, fs.statSync(out).size, 'bytes');
})().catch((e) => { console.error(e); process.exit(1); });
