# mikedesign

A design skill for Claude Code. One skill, seven commands, and a rule set that is enforced by
scripts rather than by hoping the model remembers.

It exists because design guidance written as prose degrades. Models skim it, and under time
pressure the rules quietly stop applying. So everything mechanically checkable lives in
`data/rules.json` and two small scripts, and prose is reserved for judgment that genuinely cannot
be checked.

## Install

```bash
git clone https://github.com/halymich/mikedesign.git ~/.claude/skills/mikedesign
```

Node is the only dependency, and Claude Code already requires it. Nothing to build, nothing to
configure.

To have Claude reach for it automatically, add a line to `~/.claude/CLAUDE.md`:

```
Design decisions (visual identity, layout, styling, interface copy, illustration) go through the
`mikedesign` skill, never ad hoc. If I did not name a command, use AskUserQuestion to confirm and
route. Mechanical changes where I already specified the value are routine calls and proceed
directly.
```

The last sentence matters. Without it the skill fires on "move that 2px" and you will turn it
off within a week.

## Commands

| Command | What it does |
|---|---|
| `system` | Builds the design system: interview, three real rendered concepts, then `DESIGN.md` |
| `new <surface>` | Builds a new page or screen against that system |
| `refine <target>` | Iterates on existing work without redesigning it |
| `critique <target>` | Read-only diagnosis, scored, writes a findings backlog |
| `copy <target>` | Cuts interface text to budget |
| `illustrate <subject>` | Software mockups, interface illustrations, data-flow diagrams |
| `screenshots` | App Store and Play Store listing panels and app preview videos |

## The three principles

**Ruthless inquiry.** `scripts/brief.mjs` writes an `ASSUMED:` stub for every unanswered field
and exits non-zero until each has a reason. It is not possible to reach a clean brief while
holding an unrecorded guess. You can still tell it to just go, and it will, but the guesses
arrive at the top of the report instead of hiding in the design.

**Minimal text.** Word ceilings per element, varying by surface type, so a marketing budget never
gets applied to a privacy policy. When copy exceeds its ceiling the prescribed fix is a diagram,
a mockup or a demonstration, never smaller type.

**Zero AI slop.** The tells the design community now recognizes on sight: indigo and violet
defaults, gradient text, eyebrow labels, emoji as icons, halo shadows, default typefaces as the
display voice, fabricated testimonials and metrics, filler phrasing. Hard rules gate. Advisory
rules report and never block, because a strict linter that cries wolf gets switched off.

## Checking the rendered page, not the source

The linter reads computed styles collected from a real browser, not source code. A regex over
source has to understand Tailwind, CSS variables, styled-components, CSS modules and theme
objects, and on any project it has not seen it silently understands none of them, then reports
clean. `getComputedStyle` understands all of them by construction.

Two promises follow from that:

1. The linter always reports what it actually inspected.
2. It never reports a pass when it inspected nothing. **No coverage, no verdict**, exit code 2.

```bash
# render the page, evaluate scripts/collect.js in it, save the JSON, then:
node scripts/lint.mjs --rendered collected.json --source src --design .mikedesign/DESIGN.md
```

Exit 0 clean, 1 hard findings, 2 no verdict possible.

## Per project, not global

Each project gets its own `.mikedesign/DESIGN.md`. There is no shared house style, on purpose:
products that look like each other's templates is the problem this is trying to solve. The shared
layer is the craft floor and the rule set, which live in the skill.

`DESIGN.md` is human prose plus one fenced `json` block that the scripts read. Declaring your
palette there stops the linter flagging your own brand colours, so a genuinely violet brand
declares violet and the rule goes quiet.

## Several interfaces, one brand

A product often has more than one interface: an app, a marketing site, maybe a dashboard. They
share a brand and differ in platform, stack, and which components actually exist to build with.
SwiftUI and hand-written CSS do not offer the same things.

So brand sits at the top of `DESIGN.md` once, and each target overrides only what genuinely
differs. One copy of the palette means it cannot drift between surfaces.

```json
{
  "brand": { "palette": ["#0c1425", "#facc15"], "fonts": { "display": "Söhne" } },
  "targets": {
    "web": { "platform": "web", "surfaceType": "persuade" },
    "ios": { "platform": "ios", "surfaceType": "operate", "palette": ["#1c2333"] }
  }
}
```

Pass `--target web`. With several targets declared and none named, the linter stops and asks
rather than picking one. A single-interface project skips `targets` entirely.

## Store screenshots

`screenshots` produces App Store and Play Store listing panels. Eight locales times six panels
times two device classes is ninety-six images, which is why the layout is a template, the words
are data, and rendering is a loop.

```bash
node scripts/shots.mjs devices ios
node scripts/shots.mjs render --template layout.html --data captions.json --out fastlane/screenshots
node scripts/shots.mjs verify fastlane/screenshots --platform ios --device iphone-6.9
```

Sizes and rules live in `data/devices.json` with the date they were last verified and a source
link, because stores change them and a stale number should be auditable rather than silently
wrong. Rendering is exact-pixel through headless Chrome, and both render and verify fail on a
wrong dimension or a stray alpha channel. That last one matters more than it sounds: a raw iOS
simulator screenshot is already the correct 1320×2868 but carries an alpha channel, so uploading
one directly gets rejected.

Right-to-left locales get `dir` set automatically, and any caption much longer than the reference
locale is flagged for a look, since German will wrap where English did not.

## Adding a tell

Edit `data/rules.json`. One entry, and every command inherits it. That is the whole maintenance
story, and it is the reason this is twenty-one files instead of eighty.

## Licence

MIT.
