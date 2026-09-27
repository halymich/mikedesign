#!/usr/bin/env node
/*
 * mikedesign product UI measurement.
 *
 *   node measure.mjs <url> [--tap <css selector>]... [--profile mobile|desktop|both]
 *                          [--design <DESIGN.md>] [--target <name>] [--out <file.json>]
 *                          [--user-data-dir <dir>] [--headed] [--json]
 *
 * Opens the page in a real Chrome, the way a person would meet it, and measures
 * what the product UI layer promises:
 *
 *   tap response    worst interaction latency (INP), from real input events
 *   layout shift    CLS, largest session window, including shifts after taps
 *   JavaScript      compressed bytes of script on first load
 *   font files      font files fetched on first load
 *   accessibility   axe-core violations against WCAG 2.0/2.1/2.2 A and AA
 *
 * The mobile profile is a mid-range phone: 412x915 at 2.625x, touch, the CPU
 * slowed 4x and the network at Lighthouse's slow 4G (150ms, 1.6Mbps). A page
 * that is fast only on the machine it was built on has not been measured.
 *
 * Taps: pass --tap with selectors for the controls a person actually uses. With
 * none, it taps up to five controls that only change what is shown: disclosures
 * and tabs. Never links, submit buttons, checkboxes, switches or toggle buttons,
 * because on a signed-in account any of those can change saved data.
 *
 * Pages behind a sign-in: pass --user-data-dir <dir> and --headed once, sign in
 * with a test account, then re-run with the same directory.
 *
 * Misses are reported, not enforced: the owner decides whether one blocks.
 * Exit codes: 0 every measured target met · 1 at least one miss ·
 *             2 nothing could be measured (Chrome missing, page did not load).
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(HERE, '..', 'data', 'rules.json'), 'utf8'));

/* ---------- args ---------- */

const argv = process.argv.slice(2);
const opt = { url: null, taps: [], profile: 'both', design: null, target: null, out: null, userDataDir: null, headed: false, json: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--tap') opt.taps.push(argv[++i]);
  else if (a === '--profile') opt.profile = argv[++i];
  else if (a === '--design') opt.design = argv[++i];
  else if (a === '--target') opt.target = argv[++i];
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--user-data-dir') opt.userDataDir = argv[++i];
  else if (a === '--headed') opt.headed = true;
  else if (a === '--json') opt.json = true;
  else if (a === '--help' || a === '-h') { usage(); process.exit(2); }
  else if (a.startsWith('--')) { console.error(`unknown argument: ${a}`); usage(); process.exit(2); }
  else opt.url = a;
}
function usage() {
  console.error('usage: measure.mjs <url> [--tap <selector>]... [--profile mobile|desktop|both] [--design DESIGN.md] [--target name] [--out file.json] [--user-data-dir dir] [--headed] [--json]');
}
if (!opt.url) { usage(); process.exit(2); }
if (!['mobile', 'desktop', 'both'].includes(opt.profile)) { console.error(`unknown profile "${opt.profile}"`); process.exit(2); }

/* ---------- budgets ---------- */

function loadBudgets() {
  const budgets = { ...RULES.ui.budgets };
  if (!opt.design || !existsSync(opt.design)) return budgets;
  const m = readFileSync(opt.design, 'utf8').match(/```json\s*([\s\S]*?)```/);
  if (!m) return budgets;
  let cfg;
  try { cfg = JSON.parse(m[1]); } catch { return budgets; }
  const brand = cfg.brand || cfg;
  Object.assign(budgets, brand.uiBudgets || {});
  const targets = cfg.targets || {};
  const pick = opt.target || (Object.keys(targets).length === 1 ? Object.keys(targets)[0] : null);
  if (pick && targets[pick]) Object.assign(budgets, targets[pick].uiBudgets || {});
  return budgets;
}
const budgets = loadBudgets();

/* ---------- chrome ---------- */

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

async function launch() {
  const bin = chromePath();
  if (!bin) throw new Error('Chrome not found. Install Chrome or set CHROME_PATH.');
  const temp = !opt.userDataDir;
  const dir = opt.userDataDir || mkdtempSync(join(tmpdir(), 'mikedesign-measure-'));
  if (!temp) mkdirSync(dir, { recursive: true });
  const args = [
    `--user-data-dir=${dir}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-sync', '--mute-audio',
    // CI containers run Chrome without the kernel features its sandbox needs.
    ...(process.env.CI ? ['--no-sandbox'] : []),
    ...(opt.headed ? [] : ['--headless=new', '--hide-scrollbars']),
    'about:blank',
  ];
  const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('Chrome did not open a debugging port within 20s')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); resolve(m[1]); }
    });
    proc.on('exit', (code) => { clearTimeout(t); reject(new Error(`Chrome exited early (${code})`)); });
  });
  // Wait for Chrome to exit before deleting its profile. A timer here never
  // fired, because the script exits first, and left a profile behind per run.
  const cleanup = async () => {
    const gone = new Promise((r) => { if (proc.exitCode !== null) r(); else proc.once('exit', r); });
    try { proc.kill(); } catch {}
    await Promise.race([gone, sleep(10000)]);
    // Helper processes can still be writing into the profile for a moment
    // after the browser exits (seen on Linux), so retry rather than race them.
    if (temp) { try { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch {} }
  };
  return { proc, wsUrl, cleanup };
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const listeners = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(`${msg.error.message}`)); else res(msg.result);
      } else if (msg.method) {
        for (const l of listeners) l(msg);
      }
    };
    ws.onerror = () => reject(new Error('could not connect to Chrome'));
    ws.onopen = () => resolve({
      send(method, params = {}, sessionId) {
        const mid = ++id;
        ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
        return new Promise((res, rej) => {
          pending.set(mid, { res, rej });
          setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(`${method} timed out`)); } }, 60000);
        });
      },
      on(fn) { listeners.push(fn); },
      close() { try { ws.close(); } catch {} },
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- in-page observer ---------- */
/*
 * Installed before any page script runs. Buffered observers would miss nothing
 * either, but an explicit record keeps the numbers identical to what the page
 * itself saw, and lets interaction latency be grouped by interactionId the way
 * INP defines it.
 */
const OBSERVER = `(() => {
  const r = window.__mdMeasure = { shifts: [], events: [], lcp: 0, downs: 0 };
  addEventListener('pointerdown', () => { r.downs++; }, true);
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) r.shifts.push({ t: e.startTime, v: e.value }); })
      .observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) r.events.push({ id: e.interactionId, d: e.duration, n: e.name }); })
      .observe({ type: 'event', buffered: true, durationThreshold: 16 });
    new PerformanceObserver((l) => { const es = l.getEntries(); if (es.length) r.lcp = es[es.length - 1].startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) { r.error = String(e); }
})();`;

// Controls that only change what is shown. Anything that can write (links,
// submits, checkboxes, switches, toggle buttons) is excluded even when it also
// carries aria-expanded, because a settings toggle on a real account persists.
const SAFE_TAPS = `(() => {
  const sel = 'summary, [aria-expanded], [role="tab"]';
  const writes = 'a[href], input, select, textarea, [type="submit"], [role="switch"], [role="checkbox"], [aria-pressed], [aria-checked]';
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    if (out.length >= 5) break;
    if (el.matches(writes) || el.closest('a[href]')) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    el.setAttribute('data-md-tap', String(out.length));
    out.push({ sel: '[data-md-tap="' + out.length + '"]', what: el.tagName.toLowerCase() + (el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : '') + (el.type ? '[type=' + el.type + ']' : '') });
  }
  return out;
})()`;

/* ---------- axe ---------- */

const AXE = RULES.ui.axe;
async function axeSource() {
  const cache = join(tmpdir(), `mikedesign-axe-${AXE.version}.js`);
  let src = existsSync(cache) ? readFileSync(cache, 'utf8') : null;
  if (!src) {
    const res = await fetch(AXE.url);
    if (!res.ok) throw new Error(`axe-core download failed (${res.status})`);
    src = await res.text();
  }
  // Pinned by hash. This file runs inside the page being measured, so a changed
  // file on the CDN is refused rather than trusted.
  const hash = createHash('sha256').update(src).digest('hex');
  if (hash !== AXE.sha256) throw new Error(`axe-core hash mismatch (got ${hash.slice(0, 12)}), refusing to run it`);
  writeFileSync(cache, src);
  return src;
}

/* ---------- one profile ---------- */

const PROFILES = {
  mobile: {
    label: 'mobile (4x slower CPU, slow 4G)',
    metrics: { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true },
    cpu: 4,
    network: { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  },
  desktop: {
    label: 'desktop',
    metrics: { width: 1350, height: 940, deviceScaleFactor: 1, mobile: false },
    cpu: 1,
    network: null,
  },
};

async function measure(name, axeSrc) {
  const p = PROFILES[name];
  const chrome = await launch();
  const cdp = await connect(chrome.wsUrl);
  const result = { profile: name, label: p.label, url: opt.url, notes: [] };
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: s } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (m, params) => cdp.send(m, params, s);

    const requests = new Map();
    let loadPhase = true;
    let loaded = false;
    let lastNet = Date.now();
    cdp.on((msg) => {
      if (msg.sessionId !== s) return;
      if (msg.method === 'Network.requestWillBeSent') lastNet = Date.now();
      if (msg.method === 'Network.responseReceived') {
        lastNet = Date.now();
        requests.set(msg.params.requestId, { type: msg.params.type, url: msg.params.response.url, status: msg.params.response.status, bytes: 0, initial: loadPhase });
      }
      if (msg.method === 'Network.loadingFinished') {
        lastNet = Date.now();
        const r = requests.get(msg.params.requestId);
        if (r) r.bytes = msg.params.encodedDataLength;
      }
      if (msg.method === 'Page.loadEventFired') loaded = true;
    });

    await send('Page.enable');
    await send('Network.enable');
    await send('Runtime.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Emulation.setDeviceMetricsOverride', p.metrics);
    if (p.metrics.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    if (p.cpu > 1) await send('Emulation.setCPUThrottlingRate', { rate: p.cpu });
    if (p.network) await send('Network.emulateNetworkConditions', p.network);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVER });

    const nav = await send('Page.navigate', { url: opt.url });
    if (nav.errorText) throw new Error(`page did not load: ${nav.errorText}`);
    const start = Date.now();
    while (!loaded && Date.now() - start < 45000) await sleep(100);
    if (!loaded) throw new Error('page did not finish loading within 45s');
    // Settle: wait for two quiet seconds on the network, up to 15s more.
    const settle = Date.now();
    while (Date.now() - lastNet < 2000 && Date.now() - settle < 15000) await sleep(200);
    loadPhase = false;

    const doc = await send('Runtime.evaluate', { expression: 'document.readyState + "|" + location.href', returnByValue: true });
    result.finalUrl = String(doc.result.value).split('|').slice(1).join('|');
    if (result.finalUrl !== opt.url) result.notes.push(`landed on ${result.finalUrl}, which may be a sign-in redirect`);

    // Weight on first load
    const initial = [...requests.values()].filter((r) => r.initial);
    result.jsKb = Math.round(initial.filter((r) => r.type === 'Script').reduce((n, r) => n + r.bytes, 0) / 102.4) / 10;
    result.fontFiles = initial.filter((r) => r.type === 'Font').length;

    // Taps
    let taps = opt.taps.map((sel) => ({ sel, what: 'given' }));
    if (!taps.length) {
      const found = await send('Runtime.evaluate', { expression: SAFE_TAPS, returnByValue: true });
      taps = found.result.value || [];
      if (taps.length) result.notes.push(`no --tap given, so it tapped ${taps.length} in-place control(s) it judged safe`);
    }
    result.taps = [];
    for (const { sel, what } of taps) {
      const box = await send('Runtime.evaluate', {
        expression: `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
        returnByValue: true,
      });
      const pt = box.result.value;
      if (!pt) { result.taps.push({ selector: sel, what, found: false }); continue; }
      await sleep(300);
      if (p.metrics.mobile) {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }] });
        await sleep(60);
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
        await sleep(60);
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
      }
      result.taps.push({ selector: sel, what, found: true });
      await sleep(1200);
    }

    const m = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__mdMeasure || null)', returnByValue: true });
    const rec = JSON.parse(m.result.value || 'null');
    if (!rec) throw new Error('the in-page observer did not run');
    if (rec.error) result.notes.push(`observer: ${rec.error}`);

    // CLS: largest session window (gap under 1s, window under 5s).
    let cls = 0, win = 0, first = 0, prev = 0;
    for (const sh of rec.shifts.sort((a, b) => a.t - b.t)) {
      if (win && sh.t - prev < 1000 && sh.t - first < 5000) win += sh.v;
      else { win = sh.v; first = sh.t; }
      prev = sh.t;
      cls = Math.max(cls, win);
    }
    result.cls = Math.round(cls * 1000) / 1000;
    result.lcpMs = Math.round(rec.lcp);

    // INP: worst interaction, grouping event entries by interactionId. Under 50
    // interactions INP is simply the worst one.
    const byId = new Map();
    for (const e of rec.events) byId.set(e.id, Math.max(byId.get(e.id) || 0, e.d));
    result.interactions = byId.size;
    result.inpMs = byId.size ? Math.max(...byId.values()) : null;
    if (!byId.size && rec.downs > 0) {
      // The browser records only interactions of 16ms or more. Taps that
      // reached the page and left no record were faster than that floor.
      result.inpMs = 16;
      result.interactions = rec.downs;
      result.notes.push('every tap finished under the 16 ms recording floor, so tap response is reported as 16 ms');
    } else if (!byId.size) {
      result.notes.push(result.taps.some((t) => t.found) ? 'taps were sent but never reached the page' : 'no interaction was measured; pass --tap with the controls people use');
    }

    // Accessibility
    if (axeSrc) {
      await send('Runtime.evaluate', { expression: axeSrc });
      const a = await send('Runtime.evaluate', {
        expression: `axe.run(document, { runOnly: { type: 'tag', values: ${JSON.stringify(AXE.tags)} }, resultTypes: ['violations'] }).then((r) => JSON.stringify(r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, where: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))))`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (a.exceptionDetails) result.notes.push(`accessibility check failed: ${a.exceptionDetails.text}`);
      else result.a11y = JSON.parse(a.result.value);
    }
  } catch (e) {
    result.error = e.message;
  } finally {
    cdp.close();
    await chrome.cleanup();
  }
  return result;
}

/* ---------- run ---------- */

let axeSrc = null, axeError = null;
try { axeSrc = await axeSource(); } catch (e) { axeError = e.message; }

const runs = [];
const names = opt.profile === 'both' ? ['mobile', 'desktop'] : [opt.profile];
for (const n of names) {
  try { runs.push(await measure(n, axeSrc)); }
  catch (e) { runs.push({ profile: n, label: PROFILES[n].label, error: e.message, notes: [] }); }
}

/* ---------- verdict ---------- */

const verdict = (value, max) => (value == null ? 'not-measured' : value <= max ? 'met' : 'miss');
for (const r of runs) {
  if (r.error) { r.checks = null; continue; }
  r.checks = {
    tapResponse: { value: r.inpMs, unit: 'ms', max: budgets.inpMs, status: verdict(r.inpMs, budgets.inpMs) },
    layoutShift: { value: r.cls, unit: '', max: budgets.cls, status: verdict(r.cls, budgets.cls) },
    javascript: { value: r.jsKb, unit: 'KB', max: budgets.jsKb, status: verdict(r.jsKb, budgets.jsKb) },
    fontFiles: { value: r.fontFiles, unit: '', max: budgets.fontFiles, status: verdict(r.fontFiles, budgets.fontFiles) },
    accessibility: { value: r.a11y ? r.a11y.length : null, unit: 'violations', max: 0, status: r.a11y ? (r.a11y.length ? 'miss' : 'met') : 'not-measured' },
  };
}

const measured = runs.filter((r) => r.checks);
const statuses = measured.flatMap((r) => Object.values(r.checks).map((c) => c.status));
const anyMiss = statuses.includes('miss');
const partial = statuses.includes('not-measured') || measured.length < runs.length;
const exitCode = measured.length === 0 ? 2 : anyMiss ? 1 : 0;

const payload = { tool: 'mikedesign/measure/1', url: opt.url, budgets, axe: { version: AXE.version, error: axeError }, partial, runs };
if (opt.out) writeFileSync(opt.out, JSON.stringify(payload, null, 2));

if (opt.json) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(exitCode);
}

const out = (s) => console.log(s);
const fmt = (c) => {
  if (c.status === 'not-measured') return 'not measured';
  const v = `${c.value}${c.unit && c.unit !== 'violations' ? ' ' + c.unit : ''}${c.unit === 'violations' ? ` violation${c.value === 1 ? '' : 's'}` : ''}`;
  return `${v}  ${c.status === 'met' ? 'met' : 'MISS'}`;
};
out('');
out(`mikedesign measure · ${opt.url}`);
out(`  targets: tap response <= ${budgets.inpMs} ms, layout shift <= ${budgets.cls}, JavaScript <= ${budgets.jsKb} KB, fonts <= ${budgets.fontFiles} files, WCAG 2.2 AA`);
for (const r of runs) {
  out('');
  out(`${r.label}`);
  if (r.error) { out(`  NO VERDICT: ${r.error}`); continue; }
  out(`  tap response   ${fmt(r.checks.tapResponse)}${r.interactions ? `  (${r.interactions} interaction${r.interactions === 1 ? '' : 's'})` : ''}`);
  out(`  layout shift   ${fmt(r.checks.layoutShift)}`);
  out(`  JavaScript     ${fmt(r.checks.javascript)}`);
  out(`  font files     ${fmt(r.checks.fontFiles)}`);
  out(`  accessibility  ${fmt(r.checks.accessibility)}`);
  out(`  largest paint  ${(r.lcpMs / 1000).toFixed(2)} s  (reported, not a target)`);
  for (const v of r.a11y || []) out(`    · ${v.id} (${v.impact}, ${v.nodes} element${v.nodes === 1 ? '' : 's'}): ${v.help}  e.g. ${v.where[0] || ''}`);
  for (const t of (r.taps || []).filter((t) => !t.found)) out(`    · tap target not found: ${t.selector}`);
  for (const n of r.notes) out(`    note: ${n}`);
}
if (axeError) { out(''); out(`accessibility not measured: ${axeError}`); }
out('');
if (exitCode === 2) out('NO VERDICT. Nothing could be measured, so this is not a pass.');
else if (partial) out('PARTIAL: some targets were not measured. Say so in the report; do not call it clean.');
out('Misses are reported for the owner to decide. They do not block on their own.');
out('');
process.exit(exitCode);
