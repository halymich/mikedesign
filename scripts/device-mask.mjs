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

/*
 * Fit a superellipse to the measured corner.
 *
 * The corner satisfies ((R-x)/R)^n + ((R-y)/R)^n = 1. n=2 is a plain circle,
 * which is what border-radius draws. CSS also offers a "squircle" keyword,
 * which is n=4. Neither is what Apple actually uses, so fit n from the real
 * geometry instead of repeating a number off a blog post.
 */
function fitExponent(R) {
  if (!R) return null;
  const segs = path.match(/[MLCZ][^MLCZ]*/g) || [];
  let cur = [0, 0];
  const pts = [];
  for (const seg of segs) {
    const op = seg[0];
    const n = (seg.slice(1).trim().match(/-?[\d.]+/g) || []).map(Number);
    if (op === 'M' || op === 'L') cur = [n[0], n[1]];
    else if (op === 'C' && n.length >= 6) {
      const [x1, y1, x2, y2, x3, y3] = n;
      const [x0, y0] = cur;
      for (let i = 0; i <= 60; i++) {
        const u = i / 60, v = 1 - u;
        pts.push([
          v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3,
          v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3,
        ]);
      }
      cur = [x3, y3];
    }
  }
  const corner = pts.filter(([x, y]) => x <= R && y <= R);
  if (corner.length < 20) return null;
  const residual = (e) => {
    let s = 0;
    for (const [x, y] of corner) s += Math.abs(Math.pow((R - x) / R, e) + Math.pow((R - y) / R, e) - 1);
    return s / corner.length;
  };
  let best = null;
  for (let e = 2; e <= 8; e += 0.05) {
    const r = residual(e);
    if (!best || r < best.residual) best = { n: +e.toFixed(2), residual: +r.toFixed(5) };
  }
  return { ...best, samples: corner.length, circleResidual: +residual(2).toFixed(5) };
}
const fit = fitExponent(extent);

if (asJson) {
  console.log(JSON.stringify({
    device: match.name, w: W, h: H, scale,
    cornerExtentPx: extent,
    cornerExtentPt: extent ? +(extent / scale).toFixed(2) : null,
    cornerExtentRatio: extent ? +(extent / W).toFixed(5) : null,
    cornerSuperellipse: fit ? fit.n : null,
    cornerFit: fit,
    viewBox: `0 0 ${W} ${H}`,
    path,
  }, null, 2));
} else {
  console.log(`device:        ${match.name}`);
  console.log(`screen:        ${W}x${H} px @${scale}x  (${W / scale}x${H / scale} pt)`);
  console.log(`corner extent: ${extent.toFixed(2)}px = ${(extent / scale).toFixed(1)}pt  (ratio ${(extent / W).toFixed(4)} of width)`);
  console.log(`segments:      ${(path.match(/C/g) || []).length} curves`);
  if (fit) {
    console.log(`corner curve:  superellipse n=${fit.n}  (residual ${fit.residual} over ${fit.samples} samples)`);
    console.log(`               a plain circular border-radius scores ${fit.circleResidual}, ${(fit.circleResidual / fit.residual).toFixed(0)}x worse`);
    console.log('');
    console.log(`  CSS:         border-radius: ${(extent / W).toFixed(4)} of screen width;  corner-shape: superellipse(${fit.n});`);
  }
  console.log(`viewBox:       0 0 ${W} ${H}`);
}
