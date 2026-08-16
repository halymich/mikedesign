#!/usr/bin/env node
/*
 * Device screen mask extractor.
 *
 *   node device-mask.mjs list
 *   node device-mask.mjs "iPhone 17 Pro Max" [--json]
 *
 * Pulls the exact display outline for a simulator device out of the vector
 * artwork Xcode already ships, and prints it as an SVG path.
 *
 * Why bother: an iPhone screen corner is a continuous curve assembled from
 * bezier segments, not a circular arc. A CSS border-radius is always visibly
 * wrong next to the real thing, and no single radius value fixes it because the
 * shape is not an arc at any radius. Apple ships the true outline inside each
 * .simdevicetype bundle at 1:1 pixel scale, so the honest move is to read it
 * rather than eyeball a number.
 *
 * macOS with Xcode only. Everywhere else, fall back to the ratio in
 * data/devices.json and say in the report that the frame is approximate.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const ROOT = '/Library/Developer/CoreSimulator/Profiles/DeviceTypes';

function bundles() {
  if (!existsSync(ROOT)) return [];
  return readdirSync(ROOT)
    .filter((f) => f.endsWith('.simdevicetype'))
    .map((f) => ({ name: f.replace('.simdevicetype', ''), path: join(ROOT, f) }));
}

if (process.argv[2] === 'list') {
  const all = bundles();
  if (!all.length) { console.error('mikedesign: no simulator device types found. Xcode required.'); process.exit(2); }
  for (const b of all) console.log(b.name);
  process.exit(0);
}

const want = process.argv[2];
const asJson = process.argv.includes('--json');
if (!want) {
  console.error('usage: device-mask.mjs list | device-mask.mjs "<device name>" [--json]');
  process.exit(2);
}

const match = bundles().find((b) => b.name.toLowerCase() === want.toLowerCase())
  || bundles().find((b) => b.name.toLowerCase().includes(want.toLowerCase()));
if (!match) { console.error(`mikedesign: no simulator device type matching "${want}". Try: device-mask.mjs list`); process.exit(2); }

const res = join(match.path, 'Contents', 'Resources');
const profile = join(res, 'profile.plist');
let W = 0, H = 0, scale = 1;
if (existsSync(profile)) {
  // These profiles ship as binary plists, so read them through plutil rather
  // than pattern-matching the file. Doing that silently produced scale 1 on a
  // 3x device, which quietly made every point measurement three times too big.
  const conv = spawnSync('plutil', ['-convert', 'xml1', '-o', '-', profile], { encoding: 'utf8' });
  const p = conv.status === 0 ? conv.stdout : readFileSync(profile, 'utf8');
  const num = (k) => {
    const hit = p.match(new RegExp(`<key>${k}</key>\\s*<(?:integer|real)>([\\d.]+)<`));
    return hit ? Number(hit[1]) : 0;
  };
  W = num('mainScreenWidth'); H = num('mainScreenHeight'); scale = num('mainScreenScale') || 1;
}

// The screen outline is the PDF whose MediaBox equals the screen size. Other
// PDFs in the bundle (sensor bars and so on) are a different shape, so match on
// the box rather than the filename, which is a UUID.
const pdfs = readdirSync(res).filter((f) => f.toLowerCase().endsWith('.pdf'));
let chosen = null;
for (const f of pdfs) {
  const buf = readFileSync(join(res, f));
  const mb = buf.toString('latin1').match(/\/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/);
  if (!mb) continue;
  const bw = Math.round(Number(mb[3]) - Number(mb[1]));
  const bh = Math.round(Number(mb[4]) - Number(mb[2]));
  if ((W && bw === W && bh === H) || (!W && bh > bw)) { chosen = { file: f, buf, w: bw, h: bh }; break; }
}
if (!chosen) { console.error(`mikedesign: no screen-shaped vector outline in ${match.name}.`); process.exit(2); }
if (!W) { W = chosen.w; H = chosen.h; }

// Decompress content streams and keep the one holding the outline.
const raw = chosen.buf.toString('latin1');
let content = '';
for (const hit of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
  let t;
  try { t = inflateSync(Buffer.from(hit[1], 'latin1')).toString('latin1'); }
  catch { continue; } // not a flate stream
  // Identify a page content stream by its shape, not its size. These PDFs also
  // embed an ICC colour profile, which inflates larger and contains stray "c"
  // bytes, so picking the longest stream picks the wrong one.
  const looksLikePath = /[\d.]+\s+[\d.]+\s+m\b/.test(t) && /[\d.]+\s+[\d.]+\s+c\b/.test(t);
  if (looksLikePath && !content) content = t;
}
if (!content) { console.error('mikedesign: could not decompress the outline path.'); process.exit(2); }

// The leading "0 2868 m ... h W* n" is the clipping rectangle, not the shape.
// Drop everything up to and including the clip operator.
const clipEnd = content.search(/\bW\*?\s+n\b/);
const body = clipEnd > -1 ? content.slice(clipEnd).replace(/^\s*W\*?\s+n/, '') : content;

// PDF puts the origin bottom-left, SVG puts it top-left, so y flips.
const tokens = body.trim().split(/[\s\r\n]+/);
const out = [];
const nums = [];
const fy = (y) => +(H - y).toFixed(3);
const fx = (x) => +Number(x).toFixed(3);

for (const tk of tokens) {
  const isNum = /^-?[\d.]+$/.test(tk);
  if (isNum) { nums.push(Number(tk)); continue; }
  if (tk === 'm' && nums.length >= 2) { const [x, y] = nums.slice(-2); out.push(`M${fx(x)} ${fy(y)}`); }
  else if (tk === 'l' && nums.length >= 2) { const [x, y] = nums.slice(-2); out.push(`L${fx(x)} ${fy(y)}`); }
  else if (tk === 'c' && nums.length >= 6) {
    const [x1, y1, x2, y2, x3, y3] = nums.slice(-6);
    out.push(`C${fx(x1)} ${fy(y1)} ${fx(x2)} ${fy(y2)} ${fx(x3)} ${fy(y3)}`);
  } else if (tk === 'h') out.push('Z');
  nums.length = 0;
}

const path = out.join(' ');
if (!path.includes('C')) { console.error('mikedesign: extracted path has no curves, refusing to report it as a screen outline.'); process.exit(2); }

// Corner extent: how far the curve runs before the straight edge begins. Not a
// radius, and deliberately not reported as one.
const first = path.match(/^M([\d.]+) ([\d.]+)/);
const cornerX = first ? Number(first[1]) : null;
const extent = cornerX !== null ? Math.min(cornerX, W - cornerX) : null;

if (asJson) {
  console.log(JSON.stringify({
    device: match.name, w: W, h: H, scale,
    cornerExtentPx: extent,
    cornerExtentPt: extent ? +(extent / scale).toFixed(2) : null,
    cornerExtentRatio: extent ? +(extent / W).toFixed(5) : null,
    viewBox: `0 0 ${W} ${H}`,
    path,
  }, null, 2));
} else {
  console.log(`device:        ${match.name}`);
  console.log(`screen:        ${W}x${H} px @${scale}x  (${W / scale}x${H / scale} pt)`);
  console.log(`corner extent: ${extent}px = ${(extent / scale).toFixed(1)}pt  (ratio ${(extent / W).toFixed(4)} of width)`);
  console.log(`segments:      ${(path.match(/C/g) || []).length} curves`);
  console.log(`viewBox:       0 0 ${W} ${H}`);
  console.log(`path:          ${path}`);
}
