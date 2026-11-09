# mikedesign

A design skill for Claude Code and Codex. One skill, six commands, and a rule set that is enforced by
scripts rather than by hoping the model remembers.

It exists because design guidance written as prose degrades. Models skim it, and under time
pressure the rules quietly stop applying. So everything mechanically checkable lives in
`data/rules.json` and two small scripts, and prose is reserved for judgment that genuinely cannot
be checked.

## Install

```bash
git clone https://github.com/halymich/mikedesign.git ~/.claude/skills/mikedesign
git clone https://github.com/halymich/mikecopy.git ~/.claude/skills/mikecopy
ln -s ~/.claude/skills/mikedesign ~/.agents/skills/mikedesign   # Codex
ln -s ~/.claude/skills/mikecopy ~/.agents/skills/mikecopy       # Codex
```

[mikecopy](https://github.com/halymich/mikecopy) writes the words. mikedesign hands it every
headline, label, empty state and email, and loads its rules to check the copy on rendered pages.
Installed as a sibling folder, it is found automatically. Without it mikedesign still works, and
its linter says plainly that the words were not checked.

Node is the only dependency, and both tools already require it. Nothing to build, nothing to
configure.

To have the agent reach for it automatically, add a line to your global `AGENTS.md` (or `CLAUDE.md`):

```
Design decisions (visual identity, layout, styling, product UI, illustration) go through the
`mikedesign` skill, never ad hoc. If I did not name a command, ask me once to confirm and
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
| `illustrate <subject>` | Software mockups, interface illustrations, data-flow diagrams |
| `screenshots` | App Store and Play Store listing panels and app preview videos |

## The principles

Every principle in the skill is a pair: it names its opposite and says where each one wins, so
the skill tells you when to break its own advice. A short list of hard rules has no opposite and
is marked "Always wins": WCAG 2.2 AA, the measured budgets and hard rules in `data/rules.json`,
the behaviour gate, asking (never assuming) which tool the person already uses, and never faking
an asset or an approval. Many pairs link to the matching page in
[Interface Lineage](https://interfacelineage.com/principles), cited by link only.

**Ruthless inquiry.** `scripts/brief.mjs` writes an `ASSUMED:` stub for every unanswered field
and exits non-zero until each has a reason. It is not possible to reach a clean brief while
holding an unrecorded guess. You can still tell it to just go, and it will, but the guesses
arrive at the top of the report instead of hiding in the design.

**Minimal text.** Word ceilings per element, varying by surface type, so a marketing budget never
gets applied to a privacy policy. When copy exceeds its ceiling the prescribed fix is a diagram,
a mockup or a demonstration, never smaller type.

**Zero AI slop.** The tells the design community now recognizes on sight: indigo and violet
defaults, gradient text, eyebrow labels (banned outright everywhere except marketing websites, where they are advisory, at write time and again in the linter,
measured as geometry so sentence case and wrapper divs do not escape), emoji as icons, halo
shadows, default typefaces as the
display voice, glass on panels that float over nothing. The writing tells (negative parallelism,
brochure adjectives, fabricated metrics, raw model output) live in mikecopy and are checked on the
rendered page when it is installed. Hard rules gate. Advisory rules report and never block,
because a strict linter that cries wolf gets switched off.

**Behaviour before looks.** On a product screen, how it works is designed and approved before
how it looks. The interview must ask which tool the person already uses for the job (the brief
checker refuses to let that be assumed), and the first thing the owner sees is an unstyled
prototype of the core actions: their states, their undo, their keys. The rules for it are fifteen
behaviour principles in `core/behaviour.md`, each paired with the principle it fights and where
each one wins, and each linked to its page on [Interface Lineage](https://interfacelineage.com/),
the library of interface mechanisms they are drawn from.

**Show the work.** Every command that produces something a person could look at ends by handing
them a link they can open, then stops and asks. Verification is evidence for the model; showing
is evidence for the user, and a clean lint has never meant the design was any good.

## One interview for the layout and its words

A screen and its words are one decision, so they are decided in one interview. The `grilling`
skill runs it, mikedesign and [mikecopy](https://github.com/halymich/mikecopy) each supply their
questions, and the owner answers each question once. The result is a joint brief
(`brief.mjs init ... --fields joint`) with the design answers, the writing answers, the string
inventory and the references. Every string goes through a deletion test before it is drafted, and
the linter flags a subhead that restates its headline. See `core/joint-brief.md`.

## The bar is the best work shipped today

Work is compared with current, world-class interfaces from well-resourced teams, found live for
each job and combined with the owner's private taste profile (`taste-personal.md`, kept outside
this public repository). The skill takes their principles, never their look, and names no team,
style or number that would date. See `core/bar.md`.

## Email

`platform/email.md` covers transactional and lifecycle email. `scripts/email-check.mjs` reads an
email, finds the HTML and CSS features it uses, and looks each up in the live support data at
caniemail.com, so nothing about what email clients support is stored in this skill.

## Product UI is measured, not admired

Anything a person uses to get something done (an app screen, a bookings page, settings, a
dashboard) is an `operate` surface, and loads `core/ui.md` automatically. It holds product UI to
targets that are measured in a real Chrome on a slowed mid-range phone profile and on desktop:

| Target | Default |
|---|---|
| Tap response (INP) | 200 ms or less |
| Layout shift (CLS) | 0.05 or less |
| JavaScript on first load | 150 KB compressed or less |
| Font files on first load | 2 or fewer |
| Accessibility | WCAG 2.2 AA, zero axe-core violations |

```bash
node scripts/measure.mjs http://localhost:3000/bookings --tap "#price-history" --design .mikedesign/DESIGN.md
```

Misses are reported with their numbers, and the owner decides whether one blocks. axe-core is
pinned by version and hash, and a changed file on the CDN is refused rather than run.

The same file sets the visual language for product UI: a major third type scale (1.25) that the
linter checks, variable fonts doing hierarchy through weight and optical size, tactile texture and
pressed states, and glass as a tool for exactly one job, a layer over moving content. On iOS that
means Apple's own materials. None of these is a default look; each product records where it uses
them.

## Behaviour is pressed, not described

`scripts/behave.mjs` presses the main action of a product screen in a real Chrome, on phone and
desktop, and checks what a script can see of `core/behaviour.md`:

| Check | Passes when |
|---|---|
| Acknowledged | Something visible changed within 100 ms of the press |
| Announced | The result reached a live region, so a screen reader says it |
| Waiting | An action slower than a second showed it was working before it finished |
| Undo | The undo route put the screen back exactly as it was |
| Failure | The same press, with the failure switched on, told the person something went wrong |

```bash
node scripts/behave.mjs http://localhost:3000/takes --action ".take .delete"
```

`--prepare` clicks controls first, for an action that needs a selection. `--fail-switch` presses
the prototype's own simulate-failure control, for a product whose real failure is a full disk
rather than the network; without it the network goes offline. A disabled action is refused
rather than pressed.

It really performs the action, so it runs only against local or `.test` addresses, rechecks where
the page actually is before pressing, and never follows a link. A hand walkthrough of every core
action through all four states sits beside it in the report, because a script cannot tell whether
the states are clear or the model is the right one.

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

Writing tells go in mikecopy's `data/rules.json` instead, with a line in its `fixtures/slop.md`.

Add a trigger line to `fixtures/slop.html` at the same time. `scripts/verify.sh` asserts that
every declared rule catches its own fixture, so a rule with no fixture fails the suite, and a rule
that silently stopped matching cannot hide.

A rule that depends on knowing an element's role needs two patterns. `pattern` runs against
rendered text, where the role is already known. `sourcePattern` runs against raw files, where it
is not, so it has to find the role in the markup. Without that split a headline rule fires on
every paragraph of every article.

## Licence

MIT.
