#!/usr/bin/env node
/*
 * One-off asset pipeline for the survived.ai landing page.
 * Output is committed to site/, so there is no build step at deploy time.
 *
 * Uses sharp from the app repo (no local npm install needed):
 *   NODE_PATH=/Users/nanoclaw/Desktop/survived/APP/survivedAI/node_modules node tools/build-assets.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const IMG = path.join(SITE, 'assets/img');
const ICONS = path.join(SITE, 'assets/icons');
const SURVIVED = path.resolve(ROOT, '..');
const APP = path.join(SURVIVED, 'APP/survivedAI');

const CHARCOAL = '#171B1E';
const flameSvg = fs.readFileSync(path.join(APP, 'assets/brand/flame.svg'), 'utf8');
// Inner flame markup (paths only) so we can place it on other canvases.
const flameInner = flameSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');


// Flame centered on a charcoal square; `scale` = flame height / canvas size.
function flameTile(size, scale, { radius = 0, bg = CHARCOAL } = {}) {
  const h = size * scale;
  const w = h * (590 / 700);
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>` +
      `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="250 50 590 700">${flameInner}</svg></svg>`
  );
}

// Minimal ICO writer: PNG-compressed entries (supported by all modern browsers).
function writeIco(file, pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, o);
    header.writeUInt8(size >= 256 ? 0 : size, o + 1);
    header.writeUInt16LE(1, o + 4);
    header.writeUInt16LE(32, o + 6);
    header.writeUInt32LE(buf.length, o + 8);
    header.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  fs.writeFileSync(file, Buffer.concat([header, ...pngs.map((p) => p.buf)]));
}


(async () => {
  fs.mkdirSync(IMG, { recursive: true });
  fs.mkdirSync(ICONS, { recursive: true });

  // Photographic stills (hero, closing poster, shorts strip) are built by tools/build-stills.py.

  // --- Brand mark + icons ---
  fs.copyFileSync(path.join(APP, 'assets/brand/flame.svg'), path.join(IMG, 'flame.svg'));
  fs.writeFileSync(
    path.join(SITE, 'favicon.svg'),
    flameTile(64, 0.74, { radius: 14 }).toString()
  );
  const icon = path.join(APP, 'assets/icon.png');
  await sharp(icon).resize(180).png({ compressionLevel: 9, palette: true }).toFile(path.join(SITE, 'apple-touch-icon.png'));
  await sharp(icon).resize(192).png({ compressionLevel: 9, palette: true }).toFile(path.join(ICONS, 'icon-192.png'));
  await sharp(icon).resize(512).png({ compressionLevel: 9, palette: true }).toFile(path.join(ICONS, 'icon-512.png'));
  // Maskable: keep the whole flame inside the 80% safe circle.
  await sharp(flameTile(512, 0.56)).png({ compressionLevel: 9, palette: true }).toFile(path.join(ICONS, 'icon-maskable-512.png'));
  const ico = [];
  for (const size of [16, 32, 48]) {
    ico.push({ size, buf: await sharp(flameTile(size, 0.8, { radius: size * 0.2 })).png().toBuffer() });
  }
  writeIco(path.join(SITE, 'favicon.ico'), ico);

  console.log('assets built');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
