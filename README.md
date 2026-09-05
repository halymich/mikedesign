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

## Your first run

Start in the project you want to design, and run:

```
/mikedesign system
```

It will find how many interfaces the project has, read whatever design decisions are already
visible in the code, interview you, **agree the scope of the system with you**, then show you
three real rendered directions to choose from before writing anything.

That scope step matters more than it sounds. Design systems default to growing until they cover
every component anyone might ever need, and here that cost is charged twice: once to build, and
then on every later command, because `DESIGN.md` is re-read each time. Most projects want
foundations only, or foundations plus five components. The command will tell you what it proposes
to leave out, and record it so the decision is not re-argued next time.

Everything lands in `.mikedesign/` in your project. Commit `DESIGN.md` and the briefs; the
critique files are regenerable and belong in `.gitignore`.

## Commands

| Command | What it does |
|---|---|
| `system` | Builds the design system: interview, three real rendered concepts, then `DESIGN.md` |
| `new <surface>` | Builds a new page or screen against that system |
| `refine <target>` | Iterates on existing work without redesigning it |
| `critique <target>` | Read-only diagnosis, scored, writes a findings backlog |
| `copy <target>` | Writes or cuts the words the product ships: interface, marketing, articles, email, store |
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
defaults, gradient text, eyebrow labels (banned outright, at write time and again in the linter,
measured as geometry so sentence case and wrapper divs do not escape), emoji as icons, halo
shadows, default typefaces as the
display voice, fabricated testimonials and metrics, filler phrasing. In writing: negative
parallelism, essay transitions, brochure adjectives, endings that gesture at significance, and
raw model output left in the copy. Hard rules gate. Advisory rules report and never block,
because a strict linter that cries wolf gets switched off.

**Show the work.** Every command that produces something a person could look at ends by handing
them a link they can open, then stops and asks. Verification is evidence for the model; showing
is evidence for the user, and a clean lint has never meant the design was any good.

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

## Calibrated against real sites, by measurement

`platform/web.md` carries what good software marketing sites actually do, taken by reading their
computed styles rather than by describing screenshots. Some of it contradicts the usual advice:
none of the reference sites uses pure white or pure black, marketing body copy runs 45 to 60
characters rather than 65 to 75, display leading goes below 1, and motion is almost entirely
`opacity` and `transform` (656 of 831 transition declarations on one site). Two of those became
lint rules.

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

Panels are branded from the project: `DESIGN.md` when it exists, otherwise the app's own asset
catalog or theme. A store listing rendered in a generic style is an advert for nothing.

### Device corners are measured, not eyeballed

A phone screen corner is a superellipse, not a circle, which is why most hand-built mockups look
subtly wrong next to a real device.

`device-mask.mjs` reads the vendor's own vector outline out of the artwork Xcode ships inside each
`.simdevicetype` bundle, at 1:1 pixel scale, then fits a superellipse to it:

```bash
node scripts/device-mask.mjs "iPhone 17 Pro Max"
# corner extent: 255.49px = 85.2pt  (ratio 0.1936 of width)
# corner curve:  |x|^n + |y|^n = 1 with n=2.9   (a circle scores 38x worse)
# CSS:           corner-shape: superellipse(1.536)
```

**CSS `corner-shape` takes log2 of the exponent, not the exponent.** `round` is
`superellipse(1)` and `squircle` is `superellipse(2)`, so an exponent of 2.9 becomes
`superellipse(1.536)`. Passing 2.9 straight through asks for an exponent of 2^2.9 and draws a
nearly square corner. Pixel-diffed against the real outline over a 256×256 corner box:

| corner | mismatched pixels of 65,536 |
|---|---|
| `border-radius` alone, `superellipse(1)` | 5,952 |
| **`superellipse(1.536)`, measured** | **142** |
| `squircle` keyword, `superellipse(2)` | 3,351 |

So `squircle` overcorrects and a circle undercorrects. The frame is otherwise plain CSS and kept
deliberately simple: `border-radius` for the size, `corner-shape` for the shape.

## Adding a tell

Edit `data/rules.json`. One entry, and every command inherits it. That is the whole maintenance
story, and it is the reason this is a couple of dozen files instead of eighty.

Add a trigger line to `fixtures/slop.html` at the same time. `scripts/verify.sh` asserts that
every declared rule catches its own fixture, so a rule with no fixture fails the suite, and a rule
that silently stopped matching cannot hide.

A rule that depends on knowing an element's role needs two patterns. `pattern` runs against
rendered text, where the role is already known. `sourcePattern` runs against raw files, where it
is not, so it has to find the role in the markup. Without that split a headline rule fires on
every paragraph of every article.

## Why not the humanizer skill

Deliberate overlap. `humanizer` derives from Wikipedia's signs-of-AI-writing guide, and its target
register is encyclopedic neutrality. That is the right goal for an encyclopedia and the wrong one
for a landing page, where the fix for slop is more voice rather than less. `core/voice.md` is
built around capturing a specific person's voice and then enforcing it, which is a different job.
Use both if you like; do not expect them to agree.

## Licence

MIT.
