#!/usr/bin/env node
/*
 * mikedesign brief tool.
 *
 *   node brief.mjs init  <project-root> <surface> [--type persuade|operate|read]
 *   node brief.mjs check <path/to/brief-<surface>.md> [--json]
 *
 * The point of this script is that "never guess" cannot survive as an
 * instruction. Asking the model to remember to record its guesses is the same
 * failure mode the skill exists to prevent, so the recording is mechanical:
 *
 *   check  diffs required fields against filled fields,
 *          WRITES an "ASSUMED: <field> :: <reason required>" stub for every gap,
 *          and exits non-zero while any stub still lacks a reason.
 *
 * So the script produces the assumption list. The model only supplies the why,
 * and cannot reach a clean exit without doing so.
 *
 * Exit codes: 0 every field answered or assumed with a reason · 1 stubs pending · 2 usage error.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const BASE_FIELDS = [
  ['surface-type',    'persuade, operate or read. Decides the word budgets, so it is never optional.'],
  ['visitor',         'Who actually arrives here, and what they already know.'],
  ['success-action',  'The single thing they must do. One action, not a list.'],
  ['belief-required', 'What they must believe before that action is possible.'],
  ['incumbent',       'What they use or do instead today. The real competitor is usually a habit.'],
  ['tone',            'In the owner\'s own words, not adjectives borrowed from a style guide.'],
  ['must-include',    'Non-negotiable content, claims, legal text or links.'],
  ['real-assets',     'Genuine material available: screenshots, photography, logos, data, licensed faces.'],
  ['anti-references', 'What this must not look like. Naming the enemy is worth three positive references.'],
];

/*
 * Extra fields for a `system` brief.
 *
 * A design system with no agreed scope grows to cover everything anyone might
 * ever need. That costs twice: once to build, and then on every single command
 * that loads DESIGN.md afterwards. Scope is therefore a required answer, not a
 * conversation people mean to have and forget.
 */
const SYSTEM_FIELDS = [
  ['surfaces',        'The real screens or pages being built in the NEXT milestone. Not the eventual roadmap.'],
  ['component-scope', 'Which components those surfaces genuinely need. A thing used once is markup, not a component.'],
  ['deferred',        'What is deliberately NOT being built yet, so the next run does not re-argue it.'],
];

const FIELD_SETS = { base: BASE_FIELDS, system: [...BASE_FIELDS, ...SYSTEM_FIELDS] };
const MARKER = /<!--\s*fields:\s*(\w+)\s*-->/;

const PLACEHOLDERS = new Set(['tbd', 'todo', '?', '-', 'n/a', '<reason required>', '']);
const isBlank = (v) => PLACEHOLDERS.has(String(v ?? '').trim().toLowerCase());

const argv = process.argv.slice(2);
const cmd = argv[0];
const json = argv.includes('--json');

function fail(msg) { console.error(`mikedesign: ${msg}`); process.exit(2); }

/* ---------- parse ---------- */

function parse(md, set) {
  const fields = {};
  const assumptions = {};
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    const a = line.match(/^-\s*ASSUMED:\s*([a-z-]+)\s*::\s*(.*)$/i);
    if (a) { assumptions[a[1].toLowerCase()] = a[2].trim(); continue; }
    const f = line.match(/^-\s*([a-z-]+)\s*:\s*(.*)$/i);
    if (f && set.some(([k]) => k === f[1].toLowerCase())) fields[f[1].toLowerCase()] = f[2].trim();
  }
  return { fields, assumptions };
}

/* ---------- init ---------- */

if (cmd === 'init') {
  const root = argv[1];
  const surface = argv[2];
  if (!root || !surface) fail('usage: brief.mjs init <project-root> <surface> [--type persuade|operate|read]');
  const ti = argv.indexOf('--type');
  const type = ti > -1 ? argv[ti + 1] : 'TBD';
  const fi = argv.indexOf('--fields');
  // A `system` brief defaults to the system field set, because scoping is the
  // whole point of that command.
  const setName = fi > -1 ? argv[fi + 1] : (surface === 'system' ? 'system' : 'base');
  const set = FIELD_SETS[setName];
  if (!set) fail(`unknown field set "${setName}". Expected base or system.`);

  const dir = join(root, '.mikedesign');
  const path = join(dir, `brief-${surface}.md`);
  if (existsSync(path)) fail(`brief already exists at ${path}. Edit it, or run check.`);
  mkdirSync(dir, { recursive: true });

  const body = [
    `# Brief: ${surface}`,
    `<!-- fields: ${setName} -->`,
    '',
    'Every field below is required. Leave a field as TBD only if it genuinely cannot be',
    'answered yet; check will convert it into a recorded assumption rather than let it pass',
    'silently.',
    '',
    ...set.map(([k, help]) => `- ${k}: ${k === 'surface-type' ? type : 'TBD'}\n  <!-- ${help} -->`),
    '',
    '## Assumptions',
    '',
    'Written by brief.mjs. Each one needs a reason before this brief is clean.',
    '',
    '## Notes',
    '',
  ].join('\n');

  writeFileSync(path, body + '\n');
  console.log(path);
  process.exit(0);
}

/* ---------- check ---------- */

if (cmd === 'check') {
  const path = argv[1];
  if (!path) fail('usage: brief.mjs check <path/to/brief.md> [--json]');
  if (!existsSync(path)) fail(`no brief at ${path}. Run: brief.mjs init <project-root> <surface>`);

  const md = readFileSync(path, 'utf8');
  // The brief records which field set it was created with, so check cannot
  // silently validate a system brief against the shorter base list.
  const marker = md.match(MARKER);
  const setName = marker && FIELD_SETS[marker[1]] ? marker[1] : 'base';
  const set = FIELD_SETS[setName];
  const { fields, assumptions } = parse(md, set);

  const answered = [];
  const gaps = [];
  for (const [key] of set) {
    if (!isBlank(fields[key])) answered.push(key);
    else gaps.push(key);
  }

  // Stubs for gaps that have no assumption line yet, and drop stale ones.
  const pending = [];
  const recorded = [];
  for (const key of gaps) {
    const reason = assumptions[key];
    if (reason === undefined || isBlank(reason)) pending.push(key);
    else recorded.push({ key, reason });
  }
  const stale = Object.keys(assumptions).filter((k) => answered.includes(k));

  // Rewrite the Assumptions block so the file always matches reality.
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^##\s*Assumptions/i.test(l.trim()));
  if (start === -1) fail(`${path} has no "## Assumptions" section. Recreate it with brief.mjs init.`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) { end = i; break; }
  }

  const block = [
    '## Assumptions',
    '',
    'Written by brief.mjs. Each one needs a reason before this brief is clean.',
    '',
    ...recorded.map(({ key, reason }) => `- ASSUMED: ${key} :: ${reason}`),
    ...pending.map((key) => `- ASSUMED: ${key} :: <reason required>`),
    '',
  ];
  const next = [...lines.slice(0, start), ...block, ...lines.slice(end)].join('\n');
  if (next !== md) writeFileSync(path, next);

  const result = {
    path,
    surfaceType: fields['surface-type'] && !isBlank(fields['surface-type']) ? fields['surface-type'] : null,
    answered,
    recorded,
    pending,
    stale,
    clean: pending.length === 0,
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(pending.length ? 1 : 0);
  }

  console.log('');
  console.log(`mikedesign brief · ${path}`);
  console.log(`  answered: ${answered.length}/${set.length}  (${setName} fields)`);
  if (recorded.length) {
    console.log('');
    console.log(`  ASSUMPTIONS ON RECORD (${recorded.length}), lead the report with these:`);
    for (const { key, reason } of recorded) console.log(`    · ${key}: ${reason}`);
  }
  if (stale.length) {
    console.log('');
    console.log(`  cleared (now answered): ${stale.join(', ')}`);
  }
  if (pending.length) {
    console.log('');
    console.log(`  STUBS WRITTEN, REASONS MISSING (${pending.length}):`);
    for (const key of pending) {
      const help = set.find(([k]) => k === key)[1];
      console.log(`    · ${key}: ${help}`);
    }
    console.log('');
    console.log('  Either ask the user these questions, or fill in each "<reason required>"');
    console.log('  with why you are proceeding without an answer. Both are acceptable.');
    console.log('  Silently guessing is not.');
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log(recorded.length
    ? '  Clean: every gap is a recorded assumption with a reason.'
    : '  Clean: every field answered, nothing assumed.');
  console.log('');
  process.exit(0);
}

fail('usage: brief.mjs <init|check> ...');
