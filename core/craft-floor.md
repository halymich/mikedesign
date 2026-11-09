# Craft floor

Load this immediately before writing or editing interface code. It holds what no script can
check. The linter in `data/rules.json` owns everything mechanical; do not re-audit those rules by
hand, and do not treat a clean lint as evidence the design is good. A clean lint means nothing
is obviously wrong.

Build to this without announcing it. The brief overrides anything here, except what is marked
**Always wins**. Your habits override nothing.

Each principle below is a pair: it names its opposite and says where each one wins. Read them the
way "How to read the principles" in [../SKILL.md](../SKILL.md) describes, and write any decision
between them into the brief with its reason.

## Verify on the built result

Each of these is a check on what rendered, not on what you intended. Run them in one batched
inspection round rather than a screenshot per fix.

**Contrast.** Body and placeholder text at 4.5:1 minimum, large text at 3:1. On a coloured
surface, tint secondary text from that hue or from the foreground. Never reach for grey; grey on
colour is the sound of a decision not being made.
**Always wins:** the ratios are WCAG 2.2 AA. A brand colour that cannot make them is used for
something other than text, not excused.

**Depth.** A shadow implies a light source, so it has direction: offset plus soft blur. Consistent
across the surface, because two light sources on one page reads as an accident.
**Opposite:** as little design as possible. **Where each wins:** depth is earned where it says
something (a layer above another, a control that can be pressed). On a flat reading surface with
nothing stacked, no shadow at all beats a careful one.

**Spacing.** Tight within a group, generous between groups. More space above a heading than
below it, so it binds to what it introduces. Read the computed values rather than trusting the
scale you meant to use.

**Type.** Measure depends on what the surface is for: **45 to 60 characters on `persuade`**, 65 to
75 on `read`. Marketing copy is scanned, and a short line scans faster; long-form reading wants
the wider measure. Measured on sites that do this well, marketing body copy runs 48 to 55ch.

An obvious scale, with steps large enough to read as deliberate; three sizes that differ by 2px
is three accidents. Tracking tightens as size grows and goes negative on display, around −0.02 to
−0.03em. Display leading goes below 1, around 0.85 to 0.95; display type set at body leading just
looks like body copy that got bigger. Weight is a decision, not a default: a serif at regular
weight can carry a page more convincingly than a sans at 800. Run the real copy at every
breakpoint and fix what overflows, rather than the placeholder that happened to fit.

**Motion.** One authored moment that belongs to this product, not an entrance animation stapled
to every section. Ease out from an already-visible default so nothing important depends on
JavaScript having run. Blur, clip-path, mask and backdrop-filter are part of the palette when they
stay smooth.
**Opposite:** motion shows what the action did (principle 15 in [behaviour.md](behaviour.md)).
**Where each wins:** on a `persuade` surface, the one authored moment is identity and may carry
feeling. On a product screen, motion explains cause and nothing else; a flourish that delays a
familiar action loses.
**Always wins:** honour `prefers-reduced-motion`.
[Animate the cause](https://interfacelineage.com/animate-the-cause)

**States.** Hover, focus, active, disabled, loading, error, empty. The empty state is the one
that ships broken, and it is the first thing a new user sees. On a product screen, the states of
each action (idle, working, done, failed) and what they mean were settled at the behaviour gate in
[behaviour.md](behaviour.md); this is where they get their look, each one distinct.

**Browser surfaces.** The parts nobody draws still carry the design: text selection, the caret,
scrollbars, focus rings, underline offset, tabular numerals in data. They ship with defaults that
belong to no design system. Theming them is the cheapest available signal that a page was built
rather than assembled, and it is the thing models skip most reliably.
**Opposite:** keep the platform's own controls. **Where each wins:** on the web, theme them. On
native, the system's own controls, focus and selection win, because they carry accessibility and
behaviour the person already knows (see [../platform/native.md](../platform/native.md)). A themed
focus ring that is harder to see than the default loses everywhere.

**Real content.** Longest plausible name, empty list, one item, a thousand items, a broken image,
a slow network. Design that only works at the demo length is not finished.

## Eyebrows

**Always wins** in app screens, emails and every surface that is not a marketing website. On a
marketing website the owner dropped the hard ban (decision of 1 November 2026): an eyebrow there
is reported as advisory, not a gate. It still has to pass the deletion test, meaning it says
something the headline does not, and build without one by default. The linter applies this by
surface type and platform: a `persuade` surface on a `web` target. A paywall, pricing or
onboarding screen inside a web app is not a marketing website, so lint it against the app's own
target (`operate`), where the ban stays hard.

Nothing goes above a headline. No small line of type, no uppercase label, no coloured pill, no
short phrase in the brand accent, at any size, in any case, in any shape. If a heading is the
first thing in a block, it stays the first thing in a block.

This is the single most recognizable tell of generated design, and it survives every other rule
in this file because it looks like craft while it is being written. It is not. The eyebrow spends
the most valuable position on the surface, the place the eye lands first, restating the topic that
the headline is about to state properly. "Introducing" above "Meet the new editor". "OUR PROCESS"
above "How we work". The reader learns nothing from the first line that the second does not give
them a moment later, in bigger type, better written.

The pull toward it is real, so name it: an eyebrow feels like it adds context to a headline that
seems bare. A headline that needs an eyebrow is a headline that is not finished. Rewrite the
headline until it stands alone, which is what it has to do anyway on a search result, a share
card, a tab title and a screen reader.

Four things are not eyebrows, and each is allowed only in its own real component, never as a
decorative line of text:

- A **breadcrumb**: actual links, in a `nav`, going somewhere.
- A **progress indicator**: "Step 2 of 4", and it should look like progress, not like a label.
- A **dateline or byline** on an article: a real date in a `time` element, a real author.
- A **numbered sequence** in long-form content: "Chapter 3", "Issue 14".

The linter enforces this list literally, by geometry rather than by class name, so a sentence-case
eyebrow, a pill-shaped one, or one wrapped in its own div all fail the same way an uppercase one
does. Do not reach for the exemptions to smuggle a label through. A category word is exempt when
it is a link that goes to that category and at no other time.

The copy side of this is the same rule: when writing headlines, write one headline. Never hand
back a headline with a short line above it, whatever it is labelled in the deliverable.

## Judgment the linter cannot make

### One thing is loudest

Squint at it. If everything is equally loud, nothing is. The most important element on the
surface should be obvious before any text is read.

**Opposite:** even weight for scanning. **Where each wins:** a page seen once, or a screen with one
job, gets a single clear focal point. A table, a list or a dashboard a person scans all day gets
calm, even rows, and the loud element is the exception the person must act on, not the header.

### Structure follows content

Different things should look different. Identical cards for non-identical content is the lazy
container, and nested cards are always wrong.

**Opposite:** strive for consistency. **Where each wins:** things that share a rule share a look;
things that act differently look different. Before reusing a component for new content, name the
rule the two share. If the only answer is that they look alike, give the new content its own shape.
[Be consistent, not uniform](https://interfacelineage.com/be-consistent-not-uniform)

### Copy is design

Controls name their action. Errors name the problem and the recovery. Product language, not
category language.

**Opposite:** fewer words. **Where each wins:** see principle 2 in [../SKILL.md](../SKILL.md). A
label is cut until it would stop naming the action, and no further.
[Name commands plainly](https://interfacelineage.com/name-commands-plainly)

### Density suits the scene

Who is using this, where, on what, under what light, in how much of a hurry. A tool used all day
and a page seen once should not have the same density.

**Opposite:** approachable over powerful. **Where each wins:** a first-run screen, a form and a
marketing page should look easy to start, so they get air and one obvious move. A daily tool used
by someone who has learned it gets density, because space they scroll past every day is a cost.
[Approachable over powerful](https://interfacelineage.com/approachable-over-impressive) ·
[Design for the intermediate](https://interfacelineage.com/design-for-the-intermediate)

### Commit

When torn between refined and committed, commit. A design with a clear point of view and one flaw
beats a design with no flaws and no view. Safety is the failure mode here, not boldness.

**Opposite:** as little design as possible, and refinement preserves. **Where each wins:**
commitment wins on a new direction and on `persuade` surfaces, where a point of view is the
product. Restraint wins on a screen whose subject is the person's own material, where the design
steps back so the work leads. On a refine, the existing identity wins (below).
[As little design as possible](https://interfacelineage.com/as-little-design-as-possible) ·
[Ornament is guilty until useful](https://interfacelineage.com/ornament-is-guilty-until-useful)

## When refining rather than building

Refinement preserves. Keep the identity, the behaviour, the copy and everything outside the
scope you were given. Do not replace factual copy or add claims without asking.

**Opposite:** commit. **Where each wins:** inside the scope you were given, commit to the best
version of it. If the incumbent look genuinely needs replacing, that is a `system` conversation and
a decision for the user, not something to do quietly under the heading of a polish pass.

## The standard

The floor above is what a design must clear. This is what separates work that holds up from work
that merely passed. All are habits, not styles, so they apply to any visual direction.

### Every load-bearing value records the alternative it beat

Load-bearing means a reader would reasonably ask "why that number?" A breakpoint that says why it
is not two hundred pixels lower, a glass fill that says why it is not the app's value, a font size
that says what it looked like one step down. A value with its reasoning attached argues back when
someone reaches for it. A bare number gets changed on a whim inside a week, and that is how a
system drifts: not through one bad decision, but through a hundred undefended small ones.

**Opposite:** do not build what nobody asked for. **Where each wins:** record the reason for values
a reader would question. A value that simply sits on the agreed scale needs no essay; the scale is
its reason.

### When a rule gets skipped twice, make it mechanical

Prose degrades under time pressure, because it can be skimmed and skimming is what happens when
the work is nearly done. The second time a project relearns the same lesson, the lesson belongs in
a script, a schema, or a build step that fails.

**Opposite:** judgment the linter cannot make. **Where each wins:** anything that can be measured
the same way twice becomes a check. Hierarchy, fit and whether the thing is any good stay with a
person looking at it, and a script that pretends to judge them is worse than none.

### Measure rather than eyeball, and record the measurement

Perception is not linear and the eye is a bad instrument for its own failures. Banding is a
response to the derivative of a gradient, not its absolute step, so a fade that looks wrong three
times in a row will still look wrong after a fourth adjustment made by eye. Sample it, compute the
thing that actually governs the effect, and write the number down. The same holds for contrast
ratios, optical alignment and hit areas: measured, then recorded, so the next person does not redo
the work to reach the same answer.

**Opposite:** look at it. **Where each wins:** a number settles a question with a known threshold
(contrast, hit size, shift). Composition, rhythm and taste are settled by looking at the real thing
on a phone and a desktop. Neither replaces the other, and verification asks for both.

### Draw it rather than import it, and theme the parts nobody draws

An icon set chosen from a library is a decision to look like every other product using that
library. Selection colour, caret, scrollbar, focus ring and placeholder are the parts no one
designs, which makes theming them the cheapest available signal that a page was built rather than
assembled.

**Opposite:** use what the platform provides. **Where each wins:** on a web product with its own
identity, draw it. On native, the platform's symbol set and controls win, because the person
already reads them and they scale with accessibility settings for free. Drawing replaces a library,
never a platform.

### Record deviations instead of taking them silently

Every real project ships something it knows is not right: an accessibility path that does not
exist yet, a contrast ratio the brand colour cannot make, a state left undesigned. Written down,
with who decided it, that is a known debt. Unwritten, it is a defect nobody owns, and the
difference between the two is entirely in the record.

**Always wins:** the record itself. A miss against an **Always wins** rule is never taken
silently: it is written down with who decided it, and it stays a debt to pay, never a new
standard for the next surface.
