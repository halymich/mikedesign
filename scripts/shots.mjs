#!/usr/bin/env node
/*
 * mikedesign store asset renderer.
 *
 *   node shots.mjs devices [ios|android]
 *   node shots.mjs render --template <file.html> --data <captions.json> --out <dir> [--only <locale>]
 *   node shots.mjs verify <dir> --platform ios --device iphone-6.9
 *
 * Store listings are the highest-volume design surface there is: locales times
 * panels times device classes runs to well over a hundred images. So the layout
 * is a template, the words are data, and rendering is a loop. Redoing a caption
 * in nine languages is then one command, not ninety design tasks.
 *
 * Dimensions are checked by reading the PNG header directly rather than
 * shelling out to an image tool, so verification works the same everywhere.
 * Stores reject on exact pixels and on a stray alpha channel, and both are
 * silent failures you would otherwise discover at upload.
 *
 * Exit codes: 0 ok · 1 something failed verification · 2 usage or environment error.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve, basename, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEVICES = JSON.parse(readFileSync(join(HERE, '..', 'data', 'devices.json'), 'utf8'));

const die = (msg, code = 2) => { console.error(`mikedesign: ${msg}`); process.exit(code); };

/* ---------- headless renderer discovery ---------- */

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
].filter(Boolean);

function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!hit) {
    die('no Chrome or Chromium found for rendering. Install one, or set CHROME_PATH to its binary.\n' +
        '  Looked in:\n    ' + CHROME_CANDIDATES.join('\n    '));
  }
  return hit;
}

/* ---------- PNG header reading ---------- */
/*
 * IHDR is always the first chunk: width and height are big-endian uint32 at
 * bytes 16 and 20, colour type is byte 25. Types 4 and 6 carry alpha, and both
 * Apple and Google reject alpha in store assets.
 */
function pngInfo(path) {
  const buf = readFileSync(path);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (buf.length < 26 || !sig.every((b, i) => buf[i] === b)) return null;
  const colorType = buf[25];
  return {
    w: buf.readUInt32BE(16),
    h: buf.readUInt32BE(20),
    colorType,
    hasAlpha: colorType === 4 || colorType === 6,
    bytes: buf.length,
  };
}

/* ---------- helpers ---------- */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const isRtl = (locale) => DEVICES.rtlLocales.some((l) => String(locale).toLowerCase().startsWith(l));

function specFor(platform, device, kind = 'screenshots') {
  const p = DEVICES[platform];
  if (!p) die(`unknown platform "${platform}". Expected ios or android.`);
  const group = p[kind] || (p.graphics || {});
  const s = group[device] || (p.graphics && p.graphics[device]);
  if (!s) die(`unknown ${platform} ${kind} target "${device}". Available: ${Object.keys(group).join(', ')}`);
  return s;
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
}

/*
 * Device frame geometry.
 *
 * A phone screen corner is a continuous curve, not a circular arc, so a CSS
 * border-radius never quite matches and looks subtly wrong beside the real
 * thing. Where Xcode is installed, read the true outline out of Apple's own
 * device artwork. Everywhere else fall back to the closest circular radius and
 * say so, rather than shipping an approximation that claims to be exact.
 */
function deviceGeometry(spec) {
  // Values recorded in devices.json, which were themselves measured.
  // n is the CSS corner-shape parameter, which is log2 of the real exponent.
  // round is superellipse(1), squircle is superellipse(2).
  const declared = {
    measured: false,
    ratio: spec.cornerExtentRatio || 0.12,
    n: spec.cornerSuperellipseCss || 1.536,
    exponent: spec.cornerExponent || 2.9,
    path: '',
    viewBox: `0 0 ${spec.w} ${spec.h}`,
  };
  if (!spec.simulator) return declared;
  // Where the vendor artwork is installed, re-measure rather than trust the
  // stored number, so a new device or an OS change cannot silently go stale.
  const r = spawnSync(process.execPath, [join(HERE, 'device-mask.mjs'), spec.simulator, '--json'], {
    encoding: 'utf8', timeout: 20_000,
  });
  if (r.status !== 0 || !r.stdout) return declared;
  try {
    const m = JSON.parse(r.stdout);
    if (!m.cornerExtentRatio) return declared;
    return {
      measured: true,
      ratio: m.cornerExtentRatio,
      n: m.cornerSuperellipseCss || declared.n,
      exponent: m.cornerExponent || declared.exponent,
      residual: m.cornerFit ? m.cornerFit.residual : null,
      path: m.path || '',
      viewBox: m.viewBox,
      w: m.w, h: m.h,
    };
  } catch { return declared; }
}

/* ---------- devices ---------- */

if (process.argv[2] === 'devices') {
  const only = process.argv[3];
  console.log(`\nStore specs, last verified ${DEVICES.lastVerified}\n`);
  for (const platform of ['ios', 'android']) {
    if (only && only !== platform) continue;
    const p = DEVICES[platform];
    console.log(`${p.store}`);
    console.log(`  ${p.source}`);
    const r = p.rules;
    console.log(`  count ${r.countMin} to ${r.countMax} ${r.scope}`);
    console.log(`  formats ${r.formats.join('/')}, alpha ${r.alpha ? 'allowed' : 'NOT allowed'}`);
    if (r.note) console.log(`  note: ${r.note}`);
    for (const [kind, label] of [['screenshots', 'screenshots'], ['previews', 'previews'], ['graphics', 'graphics']]) {
      const group = p[kind];
      if (!group) continue;
      console.log(`  ${label}:`);
      for (const [id, s] of Object.entries(group)) {
        if (!s || typeof s !== 'object' || !s.w) continue;
        const flag = s.verified === false ? '  [UNVERIFIED, confirm before upload]' : '';
        console.log(`    ${id.padEnd(16)} ${s.w}x${s.h}  ${s.label || ''}${flag}`);
      }
    }
    console.log('');
  }
  process.exit(0);
}

/* ---------- render ---------- */

if (process.argv[2] === 'render') {
  const templatePath = arg('--template');
  const dataPath = arg('--data');
  const outDir = arg('--out');
  const only = arg('--only');
  if (!templatePath || !dataPath || !outDir) {
    die('usage: shots.mjs render --template <file.html> --data <captions.json> --out <dir> [--only <locale>]');
  }
  if (!existsSync(templatePath)) die(`no template at ${templatePath}`);
  if (!existsSync(dataPath)) die(`no caption data at ${dataPath}`);

  const template = readFileSync(templatePath, 'utf8');
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const platform = data.platform || 'ios';
  const device = data.device || 'iphone-6.9';
  const spec = specFor(platform, device);
  const chrome = findChrome();

  const locales = Object.keys(data.locales || {});
  if (!locales.length) die('caption data declares no locales.');
  const ref = data.referenceLocale || locales[0];
  const refPanels = (data.locales[ref] || {}).panels || [];

  const geo = deviceGeometry(spec);
  const island = spec.dynamicIsland || null;

  console.log(`\nrendering ${platform} ${device} at ${spec.w}x${spec.h}`);
  console.log(`  renderer: ${chrome}`);
  console.log(`  corner:   ratio ${geo.ratio} of screen width, exponent ${geo.exponent} -> css superellipse(${geo.n})` +
    (geo.measured ? `  [measured from ${spec.simulator} artwork]` : '  [from devices.json, not re-measured]'));
  console.log(`  locales:  ${locales.join(', ')}${only ? `  (only ${only})` : ''}\n`);

  const tmpDir = join(dirname(resolve(templatePath)), '.shots-tmp');
  mkdirSync(tmpDir, { recursive: true });

  const written = [];
  const problems = [];
  const overflowRisk = [];

  for (const locale of locales) {
    if (only && locale !== only) continue;
    const entry = data.locales[locale] || {};
    const panels = entry.panels || [];
    if (!panels.length) { problems.push(`${locale}: no panels`); continue; }

    const localeOut = join(outDir, locale);
    mkdirSync(localeOut, { recursive: true });
    const dir = entry.dir || (isRtl(locale) ? 'rtl' : 'ltr');

    panels.forEach((panel, i) => {
      const n = String(i + 1).padStart(2, '0');

      // Screen images are referenced relative to the caption data file, and
      // resolved to absolute file URLs so the render works from any cwd.
      let screenUrl = '';
      if (panel.screen) {
        const abs = resolve(dirname(dataPath), panel.screen);
        if (!existsSync(abs)) {
          problems.push(`${locale} panel ${i + 1}: screen not found at ${panel.screen}`);
          return;
        }
        screenUrl = pathToFileURL(abs).href;
      }

      const vars = {
        caption: esc(panel.caption),
        sub: esc(panel.sub),
        screen: screenUrl,
        index: String(i + 1),
        total: String(panels.length),
        locale, dir,
        w: String(spec.w),
        h: String(spec.h),
        // Device frame geometry, so a template never has to guess a corner.
        // cornerRatio is a fraction of the SCREEN width, so a template can size
        // the device however it likes and still get the right corner.
        cornerRatio: String(geo.ratio),
        cornerN: String(geo.n),
        devicePath: geo.path,
        deviceViewBox: geo.viewBox,
        screenW: String(geo.w || spec.w),
        screenH: String(geo.h || spec.h),
        islandW: island ? String(Math.round(spec.w * island.wRatio)) : '0',
        islandH: island ? String(Math.round(spec.h * island.hRatio)) : '0',
        islandTop: island ? String(Math.round(spec.h * island.topRatio)) : '0',
      };
      // Raw variants for cases where the template needs unescaped markup.
      vars['caption_raw'] = String(panel.caption ?? '');
      for (const [k, v] of Object.entries(panel.vars || {})) vars[k] = esc(v);

      const html = template.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in vars ? vars[key] : m));
      const htmlPath = join(tmpDir, `${locale}-${n}.html`);
      writeFileSync(htmlPath, html);

      const outPath = join(localeOut, `${n}_${device}.png`);
      const res = spawnSync(chrome, [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        `--window-size=${spec.w},${spec.h}`,
        `--screenshot=${outPath}`,
        pathToFileURL(htmlPath).href,
      ], { encoding: 'utf8', timeout: 60_000 });

      if (res.error || !existsSync(outPath)) {
        problems.push(`${locale} panel ${i + 1}: render failed (${res.error ? res.error.message : 'no output'})`);
        return;
      }

      const info = pngInfo(outPath);
      if (!info) { problems.push(`${locale} panel ${i + 1}: output is not a readable PNG`); return; }
      if (info.w !== spec.w || info.h !== spec.h) {
        problems.push(`${locale} panel ${i + 1}: got ${info.w}x${info.h}, store requires exactly ${spec.w}x${spec.h}`);
      }
      if (info.hasAlpha) {
        problems.push(`${locale} panel ${i + 1}: has an alpha channel, which stores reject. Give the template an opaque background.`);
      }

      written.push({ locale, path: outPath, ...info });

      // Translated copy is routinely much longer than English. This does not
      // prove an overflow, it points at the panels worth looking at.
      const refCaption = (refPanels[i] || {}).caption || '';
      if (locale !== ref && refCaption && panel.caption) {
        const ratio = panel.caption.length / refCaption.length;
        if (ratio > 1.35) overflowRisk.push(`${locale} panel ${i + 1}: caption is ${Math.round(ratio * 100)}% of ${ref} length`);
      }
    });
  }

  rmSync(tmpDir, { recursive: true, force: true });

  const byLocale = written.reduce((a, w) => ((a[w.locale] = (a[w.locale] || 0) + 1), a), {});
  console.log(`wrote ${written.length} images`);
  for (const [l, n] of Object.entries(byLocale)) console.log(`  ${l.padEnd(8)} ${n}`);

  if (overflowRisk.length) {
    console.log(`\nLOOK AT THESE (translated copy much longer than ${ref}):`);
    for (const r of overflowRisk) console.log(`  · ${r}`);
    console.log('  Length is a hint, not proof. Open the rendered images and check they still read.');
  }

  if (problems.length) {
    console.log(`\nPROBLEMS (${problems.length}):`);
    for (const p of problems) console.log(`  · ${p}`);
    console.log('');
    process.exit(1);
  }

  console.log('\nAll images match the required dimensions with no alpha channel.\n');
  process.exit(0);
}

/* ---------- verify ---------- */

if (process.argv[2] === 'verify') {
  const dir = process.argv[3];
  const platform = arg('--platform', 'ios');
  const device = arg('--device', 'iphone-6.9');
  if (!dir || !existsSync(dir)) die('usage: shots.mjs verify <dir> --platform ios --device iphone-6.9');

  const spec = specFor(platform, device);
  const rules = DEVICES[platform].rules;

  const locales = readdirSync(dir).filter((f) => {
    try { return readdirSync(join(dir, f)).length >= 0; } catch { return false; }
  });
  if (!locales.length) die(`${dir} contains no locale directories. Expected ${DEVICES.fastlane.layout}.`, 1);

  let bad = 0, total = 0;
  console.log(`\nverifying ${platform} ${device}, required ${spec.w}x${spec.h}\n`);

  for (const locale of locales) {
    const files = readdirSync(join(dir, locale))
      .filter((f) => ['.png', '.jpg', '.jpeg'].includes(extname(f).toLowerCase()))
      .sort();
    const issues = [];

    if (files.length < rules.countMin) issues.push(`only ${files.length} images, store requires at least ${rules.countMin}`);
    if (files.length > rules.countMax) issues.push(`${files.length} images, store allows at most ${rules.countMax}`);

    for (const f of files) {
      total++;
      const p = join(dir, locale, f);
      if (extname(f).toLowerCase() !== '.png') continue; // header read is PNG only
      const info = pngInfo(p);
      if (!info) { issues.push(`${f}: unreadable PNG`); continue; }
      if (info.w !== spec.w || info.h !== spec.h) issues.push(`${f}: ${info.w}x${info.h}, needs ${spec.w}x${spec.h}`);
      if (info.hasAlpha) issues.push(`${f}: has alpha channel`);
      if (rules.maxFileSizeMB && info.bytes > rules.maxFileSizeMB * 1024 * 1024) {
        issues.push(`${f}: ${(info.bytes / 1048576).toFixed(1)}MB exceeds the ${rules.maxFileSizeMB}MB limit`);
      }
    }

    if (issues.length) {
      bad += issues.length;
      console.log(`  ${locale}: ${files.length} images, ${issues.length} problems`);
      for (const i of issues) console.log(`      ${i}`);
    } else {
      console.log(`  ${locale}: ${files.length} images, ok`);
    }
  }

  console.log('');
  if (bad) { console.log(`${bad} problems across ${total} images. Fix before uploading.\n`); process.exit(1); }
  console.log(`${total} images across ${locales.length} locales, all valid for upload.\n`);
  process.exit(0);
}

die('usage: shots.mjs <devices|render|verify> ...');
