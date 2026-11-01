#!/usr/bin/env node
/*
 * email-check: which parts of this email's HTML and CSS break in which mail clients.
 *
 *   node email-check.mjs <email.html> --clients gmail,outlook,apple-mail
 *                        [--all] [--data <caniemail.json>] [--json] [--verbose]
 *
 * Email clients support a small and shifting subset of HTML and CSS, and a list of
 * what works in this file would be wrong within a year. So there is no list here.
 * The support data is fetched live from caniemail.com's public feed every run, and
 * this script only reads the email, finds the features it uses, and looks each one up.
 * `--data` reads a saved copy of the feed instead, for offline runs and the test suite.
 *
 * Exit 0: nothing used is unsupported in the clients checked.
 * Exit 1: at least one feature is unsupported somewhere, or a basic is missing.
 *         Partial support is listed with --verbose and never fails on its own, because
 *         nearly everything is "partial" somewhere and a gate that always fires gets ignored.
 * Exit 2: no verdict (the file was unreadable, no features were found, the data
 *         could not be loaded, or the clients named are not in the data). Exit 2 is not a pass.
 *
 * Name the clients that matter to this email's readers. The feed covers dozens of
 * clients, many of them small regional webmail, and checking all of them makes almost
 * every email fail, which teaches people to ignore the result. `--all` is explicit.
 */

import { readFileSync, existsSync } from 'node:fs';

const FEED = 'https://www.caniemail.com/api/data.json';
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : null; };
// Flags that take a value, so the file is the first argument that is neither a flag
// nor one of those values, wherever the flags sit.
const VALUE_FLAGS = new Set(['--clients', '--data']);
const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && VALUE_FLAGS.has(argv[i - 1])));
const asJson = argv.includes('--json');
const verbose = argv.includes('--verbose');
const wantClients = flag('--clients') ? flag('--clients').split(',').map((s) => s.trim()) : null;
const dataFile = flag('--data');
const all = argv.includes('--all');

const bail = (msg) => { console.error(`email-check: ${msg}`); process.exit(2); };
if (!file || !existsSync(file)) bail('usage: email-check.mjs <email.html> --clients a,b [--all] [--data file] [--json] [--verbose]');
if (!wantClients && !all) bail('name the clients that matter with --clients gmail,outlook,... (or pass --all to check every client in the data)');

const html = readFileSync(file, 'utf8');

// --- what the email uses ---------------------------------------------------

const css = [];
for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) css.push(m[1]);
const inline = [...html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m) => m[1] ?? m[2]);
const allCss = css.join('\n') + '\n' + inline.join(';');

// Declarations only: drop url(...) payloads, at-rule preludes (a media feature such as
// max-width is not a property) and selectors (a:hover is not a declaration).
const declText = allCss
  .replace(/url\([^)]*\)/gi, 'url()')
  .replace(/@(?:media|supports|container)[^{]*\{/gi, '')
  .replace(/@font-face\s*\{/gi, ';')
  .replace(/[^{};]*\{/g, ';');

const decls = [];
for (const m of declText.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/gi)) decls.push([m[1].toLowerCase(), m[2].trim().toLowerCase()]);

const candidates = new Map(); // slug -> what we saw
const guessed = new Set(); // value-specific slugs we try speculatively; absence is not worth reporting
const want = (slug, saw, guess = false) => { if (!candidates.has(slug)) { candidates.set(slug, saw); if (guess) guessed.add(slug); } };

for (const [prop, value] of decls) {
  if (prop.startsWith('--')) { want('css-variables', `${prop}`); continue; }
  want(`css-${prop}`, `${prop}: ${value}`);
  if (['display', 'position', 'overflow', 'object-fit', 'background-size'].includes(prop)) want(`css-${prop}-${value.split(/\s+/)[0]}`, `${prop}: ${value}`, true);
  if (/linear-gradient|radial-gradient|conic-gradient/.test(value)) want('css-linear-gradient', `${prop}: ${value.slice(0, 50)}`);
  if (/\bcalc\(/.test(value)) want('css-function-calc', `${prop}: ${value.slice(0, 50)}`);
  if (/\bvar\(/.test(value)) want('css-variables', `${prop}: ${value.slice(0, 50)}`);
  if (/\brgba?\(|\bhsla?\(/.test(value)) want('css-rgba', `${prop}: ${value.slice(0, 50)}`);
}
if (/@media[^{]*prefers-color-scheme/i.test(allCss)) want('css-at-media-prefers-color-scheme', '@media (prefers-color-scheme)');
if (/@media/i.test(allCss)) want('css-at-media', '@media');
if (/@font-face/i.test(allCss)) want('css-at-font-face', '@font-face');
if (/@import/i.test(allCss)) want('css-at-import', '@import');
for (const m of html.matchAll(/<(picture|video|audio|svg|form|input|button|iframe|object|embed|dialog|details|table|link|style|center|font)\b/gi)) want(`html-${m[1].toLowerCase()}`, `<${m[1].toLowerCase()}>`);
if (/<img\b[^>]*\bsrcset\b/i.test(html)) want('html-srcset', '<img srcset>');
if (/<img\b[^>]*\.svg/i.test(html)) want('html-svg', 'svg image');
if (/<img\b[^>]*\.webp/i.test(html)) want('image-webp', 'webp image');
if (/<img\b[^>]*\.gif/i.test(html)) want('image-gif', 'gif image');
if (/<img\b[^>]*\.avif/i.test(html)) want('image-avif', 'avif image');

// --- structural checks that are accessibility basics, not support data -----

const structural = [];
if (!/<html[^>]*\slang\s*=/i.test(html)) structural.push('<html> has no lang attribute');
if (!/<title>[^<]+<\/title>/i.test(html)) structural.push('no <title>');
const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
const noAlt = imgs.filter((t) => !/\salt\s*=/i.test(t));
if (noAlt.length) structural.push(`${noAlt.length} image(s) with no alt attribute`);
const bytes = Buffer.byteLength(html, 'utf8');

// --- the data --------------------------------------------------------------

let feed;
try {
  feed = dataFile ? JSON.parse(readFileSync(dataFile, 'utf8')) : await (await fetch(FEED, { signal: AbortSignal.timeout(20000) })).json();
} catch (e) {
  bail(`could not load support data (${dataFile || FEED}): ${e.message}`);
}
const features = new Map(feed.data.map((f) => [f.slug, f]));
const known = new Set(feed.data.flatMap((f) => Object.keys(f.stats || {})));
if (wantClients) {
  const unknown = wantClients.filter((c) => !known.has(c));
  if (unknown.length) bail(`not in the support data: ${unknown.join(', ')}. Available: ${[...known].sort().join(', ')}`);
}
const names = feed.nicenames || { family: {}, platform: {} };

const latest = (versions) => { const ks = Object.keys(versions); return versions[ks[ks.length - 1]]; };
const code = (s) => String(s).trim()[0]; // y supported, n unsupported, a partial, u unknown

const rows = [];
const noData = [];
for (const [slug, saw] of candidates) {
  const f = features.get(slug);
  if (!f) { if (!guessed.has(slug)) noData.push(slug); continue; }
  const bad = [];
  for (const [family, platforms] of Object.entries(f.stats)) {
    if (wantClients && !wantClients.includes(family)) continue;
    for (const [platform, versions] of Object.entries(platforms)) {
      const c = code(latest(versions));
      if (c === 'n' || c === 'a') bad.push({ family, platform, status: c === 'n' ? 'unsupported' : 'partial' });
    }
  }
  rows.push({ slug, title: f.title, saw, url: f.url, lastTested: f.last_test_date, bad });
}

const problems = rows.filter((r) => r.bad.some((b) => b.status === 'unsupported'));
const caveats = rows.filter((r) => !problems.includes(r) && r.bad.length);
const result = {
  file, bytes, clients: wantClients || 'all in the feed', feedUpdated: feed.last_update_date,
  checked: rows.length, structural, problems, caveats: verbose ? caveats : caveats.map((c) => c.slug), noData,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const label = (b) => `${names.family?.[b.family] || b.family} ${names.platform?.[b.platform] || b.platform}`;
  console.log(`email-check  ${file}  (${(bytes / 1024).toFixed(1)} KB)`);
  console.log(`  support data: caniemail.com, updated ${feed.last_update_date}; clients: ${result.clients}`);
  console.log(`  features found in the email and looked up: ${rows.length}\n`);
  for (const p of problems) {
    const unsup = p.bad.filter((b) => b.status === 'unsupported').map(label);
    const part = p.bad.filter((b) => b.status === 'partial').map(label);
    console.log(`  ${p.title}   [${p.saw}]`);
    console.log(`      unsupported: ${unsup.join(', ')}`);
    if (verbose && part.length) console.log(`      partial:     ${part.join(', ')}`);
    console.log(`      ${p.url}`);
  }
  if (!problems.length) console.log('  Nothing found is unsupported in the clients checked.');
  if (caveats.length) {
    console.log(`\n  Works with caveats in some clients (${caveats.length}): ${caveats.map((c) => c.title).join('; ')}`);
    if (verbose) for (const c of caveats) console.log(`      ${c.title}: ${c.bad.map(label).join(', ')}  ${c.url}`);
    else console.log('      Run with --verbose for which clients and the linked notes.');
  }
  if (structural.length) { console.log('\n  Basics:'); structural.forEach((s) => console.log(`      ${s}`)); }
  if (noData.length) console.log(`\n  No support data for: ${noData.join(', ')} (verify these by hand)`);
  console.log('\n  This is support data, not a rendering test. Dark mode, images off and phone width');
  console.log('  still need to be looked at. See platform/email.md.');
}

if (!rows.length) bail('no known email features were found in this file, so there is no verdict');
process.exit(problems.length || structural.length ? 1 : 0);
