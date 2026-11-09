/*
 * mikedesign Chrome driver, shared by measure.mjs and behave.mjs.
 *
 * Launches a real Chrome with its own temporary profile, talks to it over the
 * DevTools protocol with no dependencies, and cleans the profile up afterwards.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';


export function chromePath() {
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

export async function launch({ userDataDir = null, headed = false, label = 'mikedesign' } = {}) {
  const bin = chromePath();
  if (!bin) throw new Error('Chrome not found. Install Chrome or set CHROME_PATH.');
  const temp = !userDataDir;
  const dir = userDataDir || mkdtempSync(join(tmpdir(), `${label}-`));
  if (!temp) mkdirSync(dir, { recursive: true });
  const args = [
    `--user-data-dir=${dir}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-sync', '--mute-audio',
    // CI containers run Chrome without the kernel features its sandbox needs.
    ...(process.env.CI ? ['--no-sandbox'] : []),
    ...(headed ? [] : ['--headless=new', '--hide-scrollbars']),
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
    const t0 = Date.now();
    // Killing the browser process leaves its helper processes (network,
    // storage) writing into the profile on Linux, and the delete then fails
    // with ENOTEMPTY. Asking it to close shuts the helpers down first; the
    // kill is only a fallback for a browser that ignores the request.
    const exited = await Promise.race([gone.then(() => true), sleep(5000).then(() => false)]);
    if (!exited) { try { proc.kill(); } catch {} await Promise.race([gone, sleep(5000)]); }
    if (process.env.MIKEDESIGN_DEBUG) console.error(`${label}: chrome exit took ${Date.now() - t0} ms (exitCode ${proc.exitCode}, signal ${proc.signalCode})`);
    // Helper processes can still be writing into the profile for a moment
    // after the browser exits (seen on Linux), so retry rather than race them.
    if (temp) {
      try { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); }
      catch (e) { console.error(`${label}: could not delete temporary profile ${dir}: ${e.message}`); }
      if (existsSync(dir)) console.error(`${label}: temporary profile still present after delete: ${dir} (exitCode ${proc.exitCode}, signal ${proc.signalCode})`);
    }
  };
  return { proc, wsUrl, cleanup };
}

export function connect(wsUrl) {
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

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * Product UI budgets: the defaults from rules.json, then the brand's uiBudgets,
 * then the named target's (or the only target's) from the DESIGN.md json block.
 */
export function loadBudgets(defaults, designPath, targetName) {
  const budgets = { ...defaults };
  if (!designPath || !existsSync(designPath)) return budgets;
  const m = readFileSync(designPath, 'utf8').match(/```json\s*([\s\S]*?)```/);
  if (!m) return budgets;
  let cfg;
  try { cfg = JSON.parse(m[1]); } catch { return budgets; }
  const brand = cfg.brand || cfg;
  Object.assign(budgets, brand.uiBudgets || {});
  const targets = cfg.targets || {};
  const pick = targetName || (Object.keys(targets).length === 1 ? Object.keys(targets)[0] : null);
  if (pick && targets[pick]) Object.assign(budgets, targets[pick].uiBudgets || {});
  return budgets;
}
