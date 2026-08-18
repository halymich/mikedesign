#!/usr/bin/env node
/*
 * mikedesign linter.
 *
 *   node lint.mjs --rendered <collected.json> [--design <DESIGN.md>] [--surface persuade]
 *   node lint.mjs --source <path...>          [--design <DESIGN.md>] [--surface read]
 *   node lint.mjs --rendered a.json --source src --json
 *
 * Two hard promises, because a linter that lies is worse than no linter:
 *   1. It always reports what it actually inspected.
 *   2. It never reports a pass when it inspected nothing. No coverage, no verdict.
 *
 * Exit codes: 0 clean · 1 hard violations · 2 no verdict possible (or usage error).
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(HERE, '..', 'data', 'rules.json'), 'utf8'));

/* ---------- args ---------- */

const argv = process.argv.slice(2);
const opt = { rendered: null, source: [], design: null, surface: null, target: null, json: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--rendered') opt.rendered = argv[++i];
  else if (a === '--design') opt.design = argv[++i];
  else if (a === '--surface') opt.surface = argv[++i];
  else if (a === '--target') opt.target = argv[++i];
  else if (a === '--json') opt.json = true;
  else if (a === '--source') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) opt.source.push(argv[++i]); }
  else if (a === '--help' || a === '-h') { usage(); process.exit(2); }
  else { console.error(`unknown argument: ${a}`); usage(); process.exit(2); }
}

function usage() {
  console.error('usage: lint.mjs [--rendered <json>] [--source <path...>] [--design <DESIGN.md>] [--target <name>] [--surface persuade|operate|read] [--json]');
}

if (!opt.rendered && opt.source.length === 0) {
  console.error('mikedesign: nothing to inspect. Pass --rendered, --source, or both.');
  usage();
  process.exit(2);
}

/* ---------- project config from DESIGN.md ---------- */
/*
 * DESIGN.md is human prose plus exactly one fenced ```json block that scripts
 * read. Parsing prose for a palette is guesswork; a fenced block is a contract.
 */
function loadDesign(path, wantTarget) {
  const empty = { palette: [], fonts: {}, allow: [], budgetOverrides: {}, surfaceType: null, found: false, targets: [], target: null };
  if (!path || !existsSync(path)) return empty;
  const md = readFileSync(path, 'utf8');
  const m = md.match(/```json\s*([\s\S]*?)```/);
  if (!m) return { ...empty, found: true, parseError: 'no fenced json config block found' };

  let cfg;
  try { cfg = JSON.parse(m[1]); }
  catch (e) { return { ...empty, found: true, parseError: e.message }; }

  // A project can carry several interfaces (an app, a marketing site, a
  // dashboard). They share one brand and differ in platform, stack and the
  // components actually available, so brand sits at the top level once and each
  // target overrides only what genuinely differs. One copy of the brand means
  // it cannot drift between surfaces.
  const brand = cfg.brand || cfg;
  const targets = cfg.targets && typeof cfg.targets === 'object' ? cfg.targets : null;

  const base = {
    palette: brand.palette || [],
    fonts: brand.fonts || {},
    allow: brand.allow || [],
    budgetOverrides: brand.budgetOverrides || {},
    surfaceType: brand.surfaceType || null,
    found: true,
    targets: targets ? Object.keys(targets) : [],
    target: null,
  };

  if (!targets) return base;

  const names = Object.keys(targets);
  let pick = wantTarget;
  if (!pick) {
    // Never guess which interface is being checked. One target is unambiguous;
    // several is a question, not a default.
    if (names.length === 1) pick = names[0];
    else return { ...base, targetError: `this project declares ${names.length} targets (${names.join(', ')}). Pass --target <name>.` };
  }
  if (!targets[pick]) return { ...base, targetError: `unknown target "${pick}". Declared: ${names.join(', ') || 'none'}.` };

  const t = targets[pick];
  return {
    ...base,
    target: pick,
    platform: t.platform || null,
    // Target values extend the brand rather than replacing it: an app may add
    // a colour the site never uses without redeclaring the whole palette.
    palette: [...base.palette, ...(t.palette || [])],
    fonts: { ...base.fonts, ...(t.fonts || {}) },
    allow: [...base.allow, ...(t.allow || [])],
    budgetOverrides: { ...base.budgetOverrides, ...(t.budgetOverrides || {}) },
    surfaceType: t.surfaceType || base.surfaceType,
  };
}
const design = loadDesign(opt.design, opt.target);
if (design.targetError) {
  console.error(`mikedesign: ${design.targetError}`);
  process.exit(2);
}
const surface = opt.surface || design.surfaceType || 'persuade';
if (!RULES.budgets[surface]) {
  console.error(`mikedesign: unknown surface type "${surface}". Expected persuade, operate or read.`);
  process.exit(2);
}
const budgets = { ...RULES.budgets[surface], ...design.budgetOverrides };
const allowed = new Set(design.allow);

/* ---------- colour helpers ---------- */

function parseColor(v) {
  if (!v) return null;
  const m = String(v).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.%]+))?\s*\)/i);
  if (!m) return null;
  let a = 1;
  if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1], g: +m[2], b: +m[3], a };
}

function hexToRgb(hex) {
  const h = String(hex).trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return null;
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16), a: 1 };
}

function rgbToHsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0));
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: h * 60, s, l };
}

function luminance({ r, g, b }) {
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// A declared brand colour must never be reported as a slop tell. Tolerance
// covers hover/active shades derived from the same hue.
const paletteRgb = design.palette.map(hexToRgb).filter(Boolean);
function inPalette(c) {
  return paletteRgb.some((p) => Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) <= 60);
}

/* ---------- misc helpers ---------- */

const EMOJI = /\p{Extended_Pictographic}/u;
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}️‍\s]+$/u;
const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const px = (v) => { const m = String(v || '').match(/(-?[\d.]+)px/); return m ? parseFloat(m[1]) : null; };

// box-shadow: strip the colour function first, then read the remaining lengths
// in order. Handles both "rgb(..) 0px 0px 20px" and "0px 0px 20px rgb(..)".
function parseShadow(v) {
  if (!v || v === 'none') return null;
  const first = String(v).split(/,(?![^(]*\))/)[0];
  const lengths = first.replace(/rgba?\([^)]*\)/gi, ' ').match(/-?[\d.]+px/g);
  if (!lengths || lengths.length < 2) return null;
  const n = lengths.map(parseFloat);
  return { x: n[0], y: n[1], blur: n[2] ?? 0, spread: n[3] ?? 0 };
}

const findings = [];

// A text rule matches the same sentence twice when rendered and source checks
// both run: once on the DOM node, once on the line of markup that produced it.
// That is one problem, not two, so collapse them on the normalized sentence and
// keep the file:line locator, which is the one you can act on.
const norm = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const seen = new Map();

function report(rule, where, evidence, context) {
  if (allowed.has(rule.id)) return; // explicitly overridden by the brief
  const finding = {
    id: rule.id,
    severity: rule.severity,
    title: rule.title,
    why: rule.why,
    fix: rule.fix,
    where,
    evidence: String(evidence).slice(0, 160),
  };

  if (context === undefined) { findings.push(finding); return; }

  // Match on containment, not equality: one DOM node's text is usually several
  // lines of source, so the same sentence arrives in two different shapes.
  // Containment collapses those while still keeping a genuinely repeated phrase
  // in four different cards as four findings.
  const key = `${rule.id}::${norm(evidence)}`;
  const ctx = norm(context);
  const bucket = seen.get(key) || [];
  const prior = bucket.find((e) => e.ctx.includes(ctx) || ctx.includes(e.ctx));

  if (!prior) {
    bucket.push({ ctx, finding });
    seen.set(key, bucket);
    findings.push(finding);
    return;
  }
  // Upgrade an element locator to a file:line locator when we learn one.
  if (/:\d+$/.test(where) && !/:\d+$/.test(prior.finding.where)) prior.finding.where = where;
}

/* ---------- coverage ---------- */

const coverage = {
  rendered: { ran: false, elements: 0, url: null, truncated: false },
  source: { ran: false, files: 0, skipped: 0, paths: [] },
};

function locator(el) {
  const cls = el.cls ? '.' + el.cls.trim().split(/\s+/).slice(0, 2).join('.') : '';
  const id = el.id ? '#' + el.id : '';
  const label = el.text ? ` "${el.text.slice(0, 40)}"` : '';
  return `<${el.tag.toLowerCase()}${id}${cls}>${label}`;
}

/* ---------- rendered checks ---------- */

function runRendered(data) {
  const els = data.elements || [];
  coverage.rendered = {
    ran: true,
    elements: els.length,
    url: data.url || null,
    truncated: !!(data.coverage && data.coverage.truncated),
    scanned: data.coverage ? data.coverage.scanned : null,
    viewport: data.viewport || null,
    // A zero-width viewport means nothing laid out. Colour and type findings
    // survive that; anything depending on geometry does not, and saying so
    // beats reporting a size-based check that never had a chance to run.
    layoutReliable: !!(data.viewport && data.viewport.w > 0),
  };
  if (els.length === 0) return;

  // group signatures once, for repeat-structure
  const sigGroups = new Map();
  for (const el of els) {
    const key = el.parentSig + '::' + el.sig;
    if (!sigGroups.has(key)) sigGroups.set(key, []);
    sigGroups.get(key).push(el);
  }

  for (const rule of RULES.rules) {
    if (rule.scope !== 'rendered') continue;
    const t = rule.test;

    if (t.type === 'color-band') {
      for (const el of els) {
        for (const prop of t.props) {
          const c = parseColor(el.styles[prop]);
          if (!c || c.a < 0.15) continue;
          if (inPalette(c)) continue;
          const { h, s, l } = rgbToHsl(c);
          if (h >= t.hue[0] && h <= t.hue[1] && s >= t.satMin && l >= t.lightRange[0] && l <= t.lightRange[1]) {
            report(rule, locator(el), `${prop}: ${el.styles[prop]} (hue ${Math.round(h)} deg)`);
            break;
          }
        }
      }
    }

    else if (t.type === 'computed') {
      for (const el of els) {
        const ok = t.all.every((cond) => new RegExp(cond.match, 'i').test(el.styles[cond.prop] || ''));
        if (ok) report(rule, locator(el), t.all.map((c) => `${c.prop}: ${el.styles[c.prop]}`).join(' | '));
      }
    }

    else if (t.type === 'eyebrow') {
      for (const el of els) {
        if (!el.nextIsHeadline || !el.text) continue;
        if (words(el.text) > t.maxWords) continue;
        const size = px(el.styles.fontSize) ?? 16;
        const upper = el.styles.textTransform === 'uppercase' || (/[A-Z]/.test(el.text) && !/[a-z]/.test(el.text));
        if (upper && size <= 20) report(rule, locator(el), `"${el.text}" directly above a heading`);
      }
    }

    else if (t.type === 'emoji-icon') {
      for (const el of els) {
        if (!el.text || el.text.length > 8) continue;
        if (EMOJI.test(el.text) && EMOJI_ONLY.test(el.text)) report(rule, locator(el), el.text);
      }
    }

    else if (t.type === 'shadow') {
      for (const el of els) {
        // Deliberately does NOT skip focusable elements. Excluding them exempted
        // every button and link, which is exactly where halo shadows live. Focus
        // rings are shaped "0 0 0 3px" (no blur), so the minBlur floor already
        // excludes them without exempting the elements themselves.
        const s = parseShadow(el.styles.boxShadow);
        if (s && s.x === 0 && s.y === 0 && s.blur >= t.minBlur) {
          report(rule, locator(el), `box-shadow: ${el.styles.boxShadow}`);
        }
      }
    }

    else if (t.type === 'font-default') {
      const declared = Object.values(design.fonts).map((f) => String(f).toLowerCase());
      for (const el of els) {
        if (el.role !== 'headline' && !/\bdisplay\b/.test(el.cls)) continue;
        const fam = String(el.styles.fontFamily || '').split(',')[0].replace(/["']/g, '').trim().toLowerCase();
        if (!fam) continue;
        if (declared.some((d) => d.includes(fam) || fam.includes(d))) continue;
        if (t.families.includes(fam)) report(rule, locator(el), `font-family: ${el.styles.fontFamily}`);
      }
    }

    else if (t.type === 'repeat-structure') {
      for (const [, group] of sigGroups) {
        if (group.length < t.minRepeats) continue;
        const first = group[0];
        if (first.childCount < 2) continue; // a row of plain <li> is not a card wall
        report(rule, locator(first), `${group.length} siblings share an identical structure`);
      }
    }

    else if (t.type === 'page-color-exact') {
      const bg = String(data.pageBackground || '').trim();
      if (t.values.includes(bg)) report(rule, 'document body', `background ${bg}`);
    }

    else if (t.type === 'page-luminance') {
      const c = parseColor(data.pageBackground);
      if (c && c.a > 0 && luminance(c) < t.below) {
        report(rule, 'document body', `background ${data.pageBackground}`);
      }
    }

    else if (t.type === 'mono-costume') {
      const CODEISH = new Set(['CODE', 'PRE', 'KBD', 'SAMP', 'TT', 'VAR']);
      for (const el of els) {
        if (!el.text) continue;
        if (CODEISH.has(el.tag) || CODEISH.has(el.parentTag)) continue;
        if (/\bmono(space)?\b|courier|menlo|consolas|ui-monospace/i.test(el.styles.fontFamily || '')) {
          report(rule, locator(el), `font-family: ${el.styles.fontFamily}`);
        }
      }
    }

    else if (t.type === 'orb') {
      for (const el of els) {
        if (el.w < t.minSize || el.h < t.minSize) continue;
        const blurMatch = String(el.styles.filter || '').match(/blur\(([\d.]+)px\)/i);
        const round = /50%|9999px/.test(el.styles.borderRadius || '') || (px(el.styles.borderRadius) || 0) >= el.w / 2;
        const grad = /gradient/i.test(el.styles.backgroundImage || '');
        if (blurMatch && parseFloat(blurMatch[1]) >= t.minBlur && round && grad) {
          report(rule, locator(el), `${el.w}x${el.h}, ${el.styles.filter}`);
        }
      }
    }

    else if (t.type === 'text-pattern') {
      // rendered-scope text rules (e.g. section numbering) need the DOM
      const re = new RegExp(t.pattern, t.flags || '');
      for (const el of els) if (el.text && re.test(el.text)) report(rule, locator(el), el.text);
    }
  }

  // text-scope rules also run over rendered copy, which is the text a visitor
  // actually reads. Source may hold strings that never ship.
  for (const rule of RULES.rules) {
    if (rule.scope !== 'text' || rule.test.type !== 'text-pattern') continue;
    const re = new RegExp(rule.test.pattern, rule.test.flags || '');
    for (const el of els) {
      if (!el.text) continue;
      const m = el.text.match(re);
      if (m) report(rule, locator(el), m[0], el.text);
    }
  }

  // word budgets
  const sev = RULES.budgetSeverity;
  for (const el of els) {
    const cap = budgets[el.role];
    if (cap == null || !el.text) continue;
    const n = words(el.text);
    if (n <= cap) continue;
    findings.push({
      id: `budget-${el.role}`,
      severity: sev[el.role] || 'advisory',
      title: `${el.role} over budget (${n} words, ceiling ${cap} for "${surface}")`,
      why: 'Minimal text is a constraint, not a preference. Long copy here means the point is being explained rather than shown.',
      fix: 'Replace with a diagram, a mockup, or a demonstration. Never shrink the type to make it fit.',
      where: locator(el),
      evidence: el.text.slice(0, 120),
    });
  }
}

/* ---------- source checks ---------- */

const TEXTUAL = new Set(['.html', '.htm', '.md', '.mdx', '.txt', '.jsx', '.tsx', '.vue', '.svelte', '.astro', '.swift', '.kt', '.json', '.yml', '.yaml', '.js', '.ts', '.css']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'vendor', 'coverage', '.venv', 'DerivedData', '.mikedesign']);

function gitignorePatterns(root) {
  const p = join(root, '.gitignore');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/^\/+|\/+$/g, ''));
}

function walk(target, out, ignored, root) {
  let st;
  try { st = statSync(target); } catch { return; }
  if (st.isFile()) {
    if (TEXTUAL.has(extname(target))) out.push(target);
    else coverage.source.skipped++;
    return;
  }
  if (!st.isDirectory()) return;
  for (const name of readdirSync(target)) {
    if (IGNORE_DIRS.has(name)) continue;
    const rel = relative(root, join(target, name));
    if (ignored.some((pat) => rel === pat || rel.startsWith(pat + '/'))) continue;
    walk(join(target, name), out, ignored, root);
  }
}

function runSource(paths) {
  const files = [];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const root = statSync(p).isDirectory() ? p : dirname(p);
    walk(p, files, gitignorePatterns(root), root);
  }
  coverage.source = { ran: true, files: files.length, skipped: coverage.source.skipped, paths };
  if (files.length === 0) return;

  const textRules = RULES.rules.filter((r) => r.scope === 'text' && r.test.type === 'text-pattern');
  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { coverage.source.skipped++; continue; }
    const lines = content.split('\n');

    // A fenced code block in markdown is not prose, and its contents are not this
    // author's voice. Linting it reports the sample's wording as the writer's own,
    // which is wrong often enough to teach people to ignore the whole rule.
    const fenced = new Set();
    if (extname(file) === '.md' || extname(file) === '.mdx') {
      let open = false;
      lines.forEach((line, i) => {
        if (/^\s*(```|~~~)/.test(line)) { open = !open; fenced.add(i); return; }
        if (open) fenced.add(i);
      });
    }

    for (const rule of textRules) {
      // Rendered text arrives with its role already known, so a rule can match bare prose.
      // Raw source does not, so a role-specific rule declares sourcePattern to find the role
      // in the markup itself. Without it a headline rule fires on every paragraph.
      const re = new RegExp(rule.test.sourcePattern || rule.test.pattern, rule.test.flags || '');
      lines.forEach((line, i) => {
        if (fenced.has(i)) return;
        const m = line.match(re);
        if (m) report(rule, `${file}:${i + 1}`, m[0].trim(), line);
      });
    }
  }
}

/* ---------- run ---------- */

if (opt.rendered) {
  if (!existsSync(opt.rendered)) {
    console.error(`mikedesign: rendered data file not found: ${opt.rendered}`);
    process.exit(2);
  }
  let data;
  try { data = JSON.parse(readFileSync(opt.rendered, 'utf8')); }
  catch (e) {
    console.error(`mikedesign: could not parse rendered data (${e.message}). Re-run the collector.`);
    process.exit(2);
  }
  // the browser tool may wrap the return value
  if (data && data.result && data.result.collector) data = data.result;
  if (!data || !data.collector) {
    console.error('mikedesign: that file is not collector output. Run scripts/collect.js in the page first.');
    process.exit(2);
  }
  runRendered(data);
}
if (opt.source.length) runSource(opt.source);

/* ---------- verdict ---------- */

const hard = findings.filter((f) => f.severity === 'hard');
const advisory = findings.filter((f) => f.severity === 'advisory');

const inspectedAnything =
  (coverage.rendered.ran && coverage.rendered.elements > 0) ||
  (coverage.source.ran && coverage.source.files > 0);

const partial = !coverage.rendered.ran || coverage.rendered.elements === 0;

if (opt.json) {
  console.log(JSON.stringify({
    verdict: !inspectedAnything ? 'no-verdict' : hard.length ? 'fail' : 'pass',
    partial,
    surface,
    coverage,
    design: { loaded: design.found, parseError: design.parseError || null, allow: [...allowed], target: design.target, targets: design.targets, platform: design.platform || null },
    findings,
  }, null, 2));
  process.exit(!inspectedAnything ? 2 : hard.length ? 1 : 0);
}

const line = (s) => console.log(s);
line('');
line(`mikedesign lint · surface: ${surface}`);

if (coverage.rendered.ran) {
  line(`  rendered: ${coverage.rendered.elements} elements inspected` +
    (coverage.rendered.url ? ` at ${coverage.rendered.url}` : '') +
    (coverage.rendered.truncated ? ' (truncated at collector cap)' : ''));
  if (!coverage.rendered.layoutReliable) {
    line('            viewport reported zero width, so size-dependent checks did not');
    line('            get a real layout. Re-collect from a sized window for those.');
  }
} else {
  line('  rendered: NOT RUN');
}
if (coverage.source.ran) line(`  source:   ${coverage.source.files} files read, ${coverage.source.skipped} skipped`);
else line('  source:   not run');

if (design.found && design.parseError) line(`  design:   loaded but config block unreadable (${design.parseError})`);
else if (design.found) {
  const tgt = design.target
    ? `target "${design.target}"${design.platform ? ` (${design.platform})` : ''} of ${design.targets.length}`
    : 'single target';
  line(`  design:   ${tgt}, ${design.palette.length} palette colours, ${allowed.size} rule overrides`);
}
else if (opt.design) line('  design:   no DESIGN.md at that path');

line('');

if (!inspectedAnything) {
  line('NO VERDICT. Nothing was actually inspected, so this is not a pass.');
  line('Fix the target or the collector and run again before reporting anything as clean.');
  line('');
  process.exit(2);
}

const show = (list, label) => {
  if (!list.length) return;
  line(`${label} (${list.length})`);
  for (const f of list) {
    line(`  · ${f.title}`);
    line(`      where: ${f.where}`);
    line(`      found: ${f.evidence}`);
    line(`      why:   ${f.why}`);
    line(`      fix:   ${f.fix}`);
  }
  line('');
};

show(hard, 'HARD (these gate the result)');
show(advisory, 'ADVISORY (judgment, not a block)');

if (!findings.length) line('No findings.');

if (partial) {
  line('');
  line('PARTIAL COVERAGE: rendered checks did not run, so colour, typeface, shadow and');
  line('layout tells were not checked. Do not report this as a clean design pass.');
}
line('');

process.exit(hard.length ? 1 : 0);
