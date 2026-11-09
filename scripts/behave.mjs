#!/usr/bin/env node
/*
 * mikedesign behaviour check.
 *
 *   node behave.mjs <url> --action <css selector> [--undo <css selector>] [--scope <css selector>]
 *                         [--profile mobile|desktop|both] [--design <DESIGN.md>] [--target <name>]
 *                         [--allow-remote] [--headed] [--json]
 *
 * Presses the main action of a product screen in a real Chrome, the way a
 * person would, and checks the part of core/behaviour.md a script can see:
 *
 *   acknowledged  something visible changed within ackMs (100 ms by default) of
 *                 the press: a pressed state, a pending row, anything. Measured
 *                 from the press to the first DOM change, or to a change in the
 *                 control's own style while it is held down.
 *   announced     the result reached a live region (aria-live, role=status,
 *                 role=alert, role=log, <output>), so it is announced to people
 *                 using a screen reader. WCAG 2.2 SC 4.1.3.
 *   waiting       when the action took more than a second to settle, a working
 *                 cue appeared before it finished (aria-busy, a progressbar, or
 *                 an announcement). A quick action does not need one.
 *   undo          the undo route (--undo, else a visible button named exactly
 *                 "Undo", else Cmd+Z / Ctrl+Z) put the screen back the way it was.
 *                 Compared as the visible text of --scope (default: main, else
 *                 body) with live regions left out.
 *   failure       the same press, made on a fresh load with the network offline,
 *                 told the person something went wrong instead of failing
 *                 silently or looking like success. Only judged when the action
 *                 makes a network request; otherwise it is reported as not
 *                 measured, and the failure path is checked by hand.
 *
 * What it cannot see: whether the states are clear to a person, whether the
 * model is the right one, and whether a convention was broken for a reason.
 * That is the walkthrough in core/behaviour.md, and the report needs both.
 *
 * Safety: the action is really performed, twice per profile, so it runs only
 * against a local address (localhost, 127.0.0.1, [::1], *.localhost, *.test,
 * file:) unless --allow-remote is passed for a test environment the owner named.
 * Never point it at a production account.
 *
 * Misses are reported, not enforced: the owner decides whether one blocks.
 * Exit codes: 0 every measured check met · 1 at least one miss ·
 *             2 no verdict (Chrome missing, page or action not found, address refused).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch as launchChrome, connect, sleep, loadBudgets } from './chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(HERE, '..', 'data', 'rules.json'), 'utf8'));

/* ---------- args ---------- */

const argv = process.argv.slice(2);
const opt = { url: null, action: null, undo: null, scope: null, profile: 'both', design: null, target: null, allowRemote: false, headed: false, json: false, out: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--action') opt.action = argv[++i];
  else if (a === '--undo') opt.undo = argv[++i];
  else if (a === '--scope') opt.scope = argv[++i];
  else if (a === '--profile') opt.profile = argv[++i];
  else if (a === '--design') opt.design = argv[++i];
  else if (a === '--target') opt.target = argv[++i];
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--allow-remote') opt.allowRemote = true;
  else if (a === '--headed') opt.headed = true;
  else if (a === '--json') opt.json = true;
  else if (a === '--help' || a === '-h') { usage(); process.exit(2); }
  else if (a.startsWith('--')) { console.error(`unknown argument: ${a}`); usage(); process.exit(2); }
  else opt.url = a;
}
function usage() {
  console.error('usage: behave.mjs <url> --action <selector> [--undo <selector>] [--scope <selector>] [--profile mobile|desktop|both] [--design DESIGN.md] [--target name] [--allow-remote] [--headed] [--json] [--out file.json]');
}
if (!opt.url || !opt.action) { usage(); process.exit(2); }
if (!['mobile', 'desktop', 'both'].includes(opt.profile)) { console.error(`unknown profile "${opt.profile}"`); process.exit(2); }

function localAddress(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  // A file URL with a host (file://server/share) reaches another machine.
  if (u.protocol === 'file:') return u.hostname === '' || u.hostname.toLowerCase() === 'localhost';
  if (!['http:', 'https:'].includes(u.protocol)) return false;
  const h = u.hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || h.endsWith('.localhost') || h.endsWith('.test');
}
if (!opt.allowRemote && !localAddress(opt.url)) {
  console.error(`behave.mjs: refusing ${opt.url}. This script really performs the action, so it only runs against a local or .test address. Pass --allow-remote for a test environment the owner named, never a production account.`);
  process.exit(2);
}

const budgets = loadBudgets(RULES.ui.budgets, opt.design, opt.target);
const ACK_MS = budgets.ackMs ?? 100;
const SLOW_MS = 1000;   // past this, a wait needs a visible working cue
const QUIET_MS = 800;   // no DOM change for this long means the action has settled
const MAX_WAIT = 10000; // give up waiting for an action to settle

/* ---------- in-page recorder ---------- */
/*
 * Installed before any page script runs. Records every DOM change with its
 * time, what live regions said, and whether a working cue appeared. It stays
 * idle until armed, so page load does not count as the action's response.
 */
const RECORDER = `(() => {
  const r = window.__mdBehave = { armed: false, downAt: null, muts: [], live: [], busy: [], last: new WeakMap() };
  const LIVE = '[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"], output';
  const BUSY = '[aria-busy="true"], [role="progressbar"], progress';
  const textOf = (n) => (n && (n.innerText || n.textContent) || '').replace(/\\s+/g, ' ').trim();
  addEventListener('pointerdown', (e) => { if (r.armed && r.downAt === null) r.downAt = e.timeStamp; }, true);
  addEventListener('keydown', (e) => { if (r.armed && r.downAt === null) r.downAt = e.timeStamp; }, true);
  const obs = new MutationObserver((list) => {
    if (!r.armed) return;
    const t = performance.now();
    r.muts.push(t);
    for (const m of list) {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!el) continue;
      const region = el.closest(LIVE) || (m.addedNodes && [...m.addedNodes].find((n) => n.nodeType === 1 && n.matches(LIVE)));
      if (region) {
        const text = textOf(region);
        if (text && r.last.get(region) !== text) { r.last.set(region, text); r.live.push({ t, text: text.slice(0, 200), alert: region.matches('[role="alert"], [aria-live="assertive"]') }); }
      }
      const added = m.addedNodes ? [...m.addedNodes].filter((n) => n.nodeType === 1) : [];
      if ((m.type === 'attributes' && el.matches(BUSY)) || added.some((n) => n.matches(BUSY) || n.querySelector(BUSY))) r.busy.push(t);
    }
  });
  const start = () => obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.documentElement) start(); else addEventListener('DOMContentLoaded', start);
})();`;

// Visible text of the scope with live regions taken out, so a toast saying
// "Restored" does not count as the screen being different.
const FINGERPRINT = (scope) => `(() => {
  const root = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : `document.querySelector('main') || document.body`};
  if (!root) return null;
  let text = root.innerText || '';
  const LIVE = '[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"], output, [data-behave-ignore]';
  for (const n of root.querySelectorAll(LIVE)) { const t = n.innerText || ''; if (t) text = text.replace(t, ''); }
  return text.split('\\n').map((l) => l.replace(/\\s+/g, ' ').trim()).filter(Boolean).join('\\n');
})()`;

const STYLE_OF = (sel) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return null;
  const cs = getComputedStyle(el);
  return ['transform', 'background-color', 'color', 'box-shadow', 'opacity', 'border-color', 'outline-color', 'filter'].map((p) => cs.getPropertyValue(p)).join('|');
})()`;

// Only a button whose name is exactly "Undo". Never a link: a page could label
// a link to anywhere "Undo", and the check would then follow it.
const FIND_UNDO = `(() => {
  const named = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim();
  for (const el of document.querySelectorAll('button, [role="button"]')) {
    if (el.closest('a[href]')) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (!/^undo$/i.test(named(el))) continue;
    el.setAttribute('data-md-undo', '1');
    return '[data-md-undo="1"]';
  }
  return null;
})()`;

/* ---------- profiles ---------- */

const PROFILES = {
  mobile: { label: 'mobile (4x slower CPU)', metrics: { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true }, cpu: 4 },
  desktop: { label: 'desktop', metrics: { width: 1350, height: 940, deviceScaleFactor: 1, mobile: false }, cpu: 1 },
};

/* ---------- one pass ---------- */

async function pass(profileName, { offline }) {
  const p = PROFILES[profileName];
  const chrome = await launchChrome({ headed: opt.headed, label: 'mikedesign-behave' });
  const cdp = await connect(chrome.wsUrl);
  const out = { offline };
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: s } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (m, params) => cdp.send(m, params, s);
    const ev = (expression, extra = {}) => send('Runtime.evaluate', { expression, returnByValue: true, ...extra }).then((r) => r.result.value);

    let loaded = false;
    let requestsAfterPress = 0;
    let pressed = false;
    // Requests the action started and that have not finished. The action is not
    // settled while one is open, however quiet the screen is: a slow save with
    // nothing on screen is exactly the wait this check exists to catch.
    const inflight = new Set();
    cdp.on((msg) => {
      if (msg.sessionId !== s) return;
      if (msg.method === 'Page.loadEventFired') loaded = true;
      if (msg.method === 'Network.requestWillBeSent' && pressed && !/^data:/.test(msg.params.request.url)) { requestsAfterPress++; inflight.add(msg.params.requestId); }
      if (msg.method === 'Network.loadingFinished' || msg.method === 'Network.loadingFailed') inflight.delete(msg.params.requestId);
    });
    await send('Page.enable');
    await send('Network.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', p.metrics);
    if (p.metrics.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    if (p.cpu > 1) await send('Emulation.setCPUThrottlingRate', { rate: p.cpu });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER });

    const nav = await send('Page.navigate', { url: opt.url });
    if (nav.errorText) throw new Error(`page did not load: ${nav.errorText}`);
    const t0 = Date.now();
    while (!loaded && Date.now() - t0 < 30000) await sleep(100);
    if (!loaded) throw new Error('page did not finish loading within 30s');
    await sleep(500);
    // The address was checked before loading; a redirect could have moved the
    // page somewhere else. Check where it actually is before pressing anything.
    const stillLocal = async () => {
      if (opt.allowRemote) return;
      const here = await ev('location.href');
      if (!localAddress(here)) throw new Error(`the page moved to ${here}, which is not a local address; nothing was pressed`);
    };
    await stillLocal();

    const box = await ev(`(() => { const el = document.querySelector(${JSON.stringify(opt.action)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!box) throw new Error(`action not found: ${opt.action}`);
    await sleep(200);

    out.before = await ev(FINGERPRINT(opt.scope));
    const restStyle = await ev(STYLE_OF(opt.action));
    await stillLocal();
    if (offline) await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

    await ev('(() => { const r = window.__mdBehave; r.armed = true; r.downAt = null; r.muts = []; r.live = []; r.busy = []; })()');
    pressed = true;
    let heldStyle;
    if (p.metrics.mobile) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
      await sleep(50);
      heldStyle = await ev(STYLE_OF(opt.action));
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
      await sleep(150); // let hover styles settle, so they are not mistaken for a pressed state
      const hoverStyle = await ev(STYLE_OF(opt.action));
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
      await sleep(50);
      heldStyle = await ev(STYLE_OF(opt.action));
      out.pressedStyleChanged = heldStyle !== null && hoverStyle !== null && heldStyle !== hoverStyle;
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    }
    if (out.pressedStyleChanged === undefined) out.pressedStyleChanged = heldStyle !== null && restStyle !== null && heldStyle !== restStyle;

    // Wait for the action to settle: no DOM change for QUIET_MS, up to MAX_WAIT.
    const waitStart = Date.now();
    let rec;
    for (;;) {
      await sleep(200);
      rec = await ev('(() => { const r = window.__mdBehave; return { downAt: r.downAt, muts: r.muts, live: r.live, busy: r.busy, now: performance.now() }; })()');
      const last = rec.muts.length ? rec.muts[rec.muts.length - 1] : rec.downAt ?? rec.now;
      if ((rec.now - last >= QUIET_MS && inflight.size === 0) || Date.now() - waitStart > MAX_WAIT) break;
    }
    const down = rec.downAt;
    if (down === null) throw new Error('the press never reached the page (is the action covered by another element?)');
    const after = rec.muts.filter((t) => t >= down);
    out.firstChangeMs = after.length ? Math.round(after[0] - down) : null;
    out.settleMs = after.length ? Math.round(after[after.length - 1] - down) : 0;
    out.live = rec.live.filter((l) => l.t >= down).map((l) => ({ ms: Math.round(l.t - down), text: l.text, alert: l.alert }));
    out.busyMs = rec.busy.filter((t) => t >= down).map((t) => Math.round(t - down));
    out.requests = requestsAfterPress;
    out.timedOut = Date.now() - waitStart > MAX_WAIT;
    out.after = await ev(FINGERPRINT(opt.scope));

    if (!offline) {
      // Undo: the given route, else a visible Undo control, else the platform key.
      let route = null;
      const undoSel = opt.undo || await ev(FIND_UNDO);
      if (undoSel) {
        const ub = await ev(`(() => { const el = document.querySelector(${JSON.stringify(undoSel)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        if (ub) {
          route = opt.undo ? `given control ${opt.undo}` : 'visible Undo control';
          if (p.metrics.mobile) {
            await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ub.x, y: ub.y }] });
            await sleep(50);
            await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          } else {
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: ub.x, y: ub.y });
            await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: ub.x, y: ub.y, button: 'left', clickCount: 1 });
            await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ub.x, y: ub.y, button: 'left', clickCount: 1 });
          }
        } else if (opt.undo) {
          out.notes = [`undo control not found: ${opt.undo}`];
        }
      }
      if (!route && !p.metrics.mobile) {
        route = 'keyboard (Cmd+Z / Ctrl+Z)';
        const mod = process.platform === 'darwin' ? 4 : 2; // Meta on macOS, Control elsewhere
        const keyArgs = { modifiers: mod, key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, nativeVirtualKeyCode: 90 };
        await send('Input.dispatchKeyEvent', { type: 'keyDown', ...keyArgs, commands: ['undo'] });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', ...keyArgs });
      }
      out.undoRoute = route;
      const us = Date.now();
      let prevLen = -1;
      for (;;) {
        await sleep(200);
        const n = await ev('window.__mdBehave.muts.length');
        if ((n === prevLen) || Date.now() - us > 3000) break;
        prevLen = n;
      }
      out.undone = await ev(FINGERPRINT(opt.scope));
    }
  } finally {
    try { await cdp.send('Browser.close'); } catch {}
    cdp.close();
    await chrome.cleanup();
  }
  return out;
}

function firstDifference(a, b) {
  const A = (a || '').split('\n');
  const B = (b || '').split('\n');
  for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) return { before: A[i] ?? '(nothing)', now: B[i] ?? '(nothing)' };
  return null;
}

/* ---------- one profile ---------- */

async function profileRun(name) {
  const result = { profile: name, label: PROFILES[name].label, notes: [] };
  try {
    const on = await pass(name, { offline: false });
    if (on.notes) result.notes.push(...on.notes);
    if (on.timedOut) result.notes.push(`the action had not settled after ${MAX_WAIT / 1000} s; the numbers below are as they stood then`);
    result.online = on;

    // Acknowledged
    const ack = on.pressedStyleChanged ? Math.min(50, on.firstChangeMs ?? Infinity) : on.firstChangeMs;
    const ackHow = on.pressedStyleChanged && (on.firstChangeMs == null || on.firstChangeMs > 50) ? 'pressed state while held' : 'first visible change';
    result.checks = {
      acknowledged: { value: ack, unit: 'ms', max: ACK_MS, how: ack == null ? 'nothing changed' : ackHow, status: ack == null ? 'miss' : ack <= ACK_MS ? 'met' : 'miss' },
      announced: { value: on.live.length ? on.live[on.live.length - 1].text : null, status: on.live.length ? 'met' : 'miss' },
    };

    // Waiting cue, only needed on a slow action
    const slow = on.settleMs > SLOW_MS;
    const cueBeforeEnd = on.busyMs.some((t) => t < on.settleMs) || on.live.some((l) => l.ms < on.settleMs - 50);
    result.checks.waiting = { value: on.settleMs, unit: 'ms to settle', status: !slow ? 'not-needed' : cueBeforeEnd ? 'met' : 'miss' };

    // Undo
    const changed = on.before !== on.after;
    if (!changed) {
      result.checks.undo = { value: null, status: 'not-measured' };
      result.notes.push('the action changed no visible text in scope, so undo could not be judged; pass --scope if the change is outside main');
    } else {
      const restored = on.undone === on.before;
      result.checks.undo = { value: on.undoRoute || 'none found', status: restored ? 'met' : 'miss' };
      if (!restored) {
        const d = firstDifference(on.before, on.undone);
        if (d) result.notes.push(`after undo, the screen still differs: "${d.before.slice(0, 80)}" is now "${d.now.slice(0, 80)}"`);
      }
    }

    // Failure, only when the action used the network
    if (on.requests === 0) {
      result.checks.failure = { value: null, status: 'not-measured' };
      result.notes.push('the action made no network request, so the offline failure could not be triggered; check the failure path by hand');
    } else {
      const off = await pass(name, { offline: true });
      result.offline = off;
      const successSaid = new Set(on.live.map((l) => l.text));
      const saidSomethingElse = off.live.some((l) => !successSaid.has(l.text));
      const lookedLikeSuccess = off.after === on.after && !saidSomethingElse;
      const silent = off.after === off.before && !saidSomethingElse;
      const status = saidSomethingElse ? 'met' : 'miss';
      result.checks.failure = { value: saidSomethingElse ? off.live.filter((l) => !successSaid.has(l.text)).pop().text : lookedLikeSuccess ? 'looked like success' : silent ? 'nothing happened, nothing said' : 'changed without saying why', status };
    }
  } catch (e) {
    result.error = e.message;
  }
  return result;
}

/* ---------- run ---------- */

const runs = [];
for (const n of opt.profile === 'both' ? ['mobile', 'desktop'] : [opt.profile]) runs.push(await profileRun(n));

const measured = runs.filter((r) => r.checks);
const statuses = measured.flatMap((r) => Object.values(r.checks).map((c) => c.status));
const anyMiss = statuses.includes('miss');
const partial = statuses.includes('not-measured') || measured.length < runs.length;
const exitCode = measured.length === 0 ? 2 : anyMiss ? 1 : 0;

const payload = { tool: 'mikedesign/behave/1', url: opt.url, action: opt.action, ackMs: ACK_MS, partial, runs };
if (opt.out) writeFileSync(opt.out, JSON.stringify(payload, null, 2));
if (opt.json) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(exitCode);
}

const out = (s) => console.log(s);
const show = (c, fmt) => (c.status === 'not-measured' ? 'not measured' : c.status === 'not-needed' ? `${fmt}  not needed` : `${fmt}  ${c.status === 'met' ? 'met' : 'MISS'}`);
out('');
out(`mikedesign behave · ${opt.url}`);
out(`  action: ${opt.action}   acknowledgement target: ${ACK_MS} ms`);
for (const r of runs) {
  out('');
  out(r.label);
  if (r.error) { out(`  NO VERDICT: ${r.error}`); continue; }
  const c = r.checks;
  out(`  acknowledged   ${show(c.acknowledged, c.acknowledged.value == null ? 'nothing changed' : `${c.acknowledged.value} ms (${c.acknowledged.how})`)}`);
  out(`  announced      ${show(c.announced, c.announced.value ? `"${c.announced.value.slice(0, 60)}"` : 'nothing reached a live region')}`);
  out(`  waiting        ${show(c.waiting, `${c.waiting.value} ms to settle`)}`);
  out(`  undo           ${show(c.undo, `${c.undo.value}`)}`);
  out(`  failure        ${show(c.failure, c.failure.value ? `offline: "${String(c.failure.value).slice(0, 60)}"` : '')}`);
  for (const n of r.notes) out(`    note: ${n}`);
}
out('');
if (exitCode === 2) out('NO VERDICT. Nothing could be checked, so this is not a pass.');
else if (partial) out('PARTIAL: some checks were not measured. Say so in the report; do not call it clean.');
out('This covers what a script can see. The walkthrough in core/behaviour.md covers the rest.');
out('');
process.exit(exitCode);
