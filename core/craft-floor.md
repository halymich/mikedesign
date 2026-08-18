# Craft floor

Load this immediately before writing or editing interface code. It holds what no script can
check. The linter in `data/rules.json` owns everything mechanical; do not re-audit those rules by
hand, and do not treat a clean lint as evidence the design is good. A clean lint means nothing
is obviously wrong.

Build to this without announcing it. The brief overrides anything here. Your habits do not.

## Verify on the built result

Each of these is a check on what rendered, not on what you intended. Run them in one batched
inspection round rather than a screenshot per fix.

**Contrast.** Body and placeholder text at 4.5:1 minimum, large text at 3:1. On a coloured
surface, tint secondary text from that hue or from the foreground. Never reach for grey; grey on
colour is the sound of a decision not being made.

**Depth.** A shadow implies a light source, so it has direction: offset plus soft blur. Consistent
across the surface, because two light sources on one page reads as an accident.

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
JavaScript having run. Honour `prefers-reduced-motion`. Blur, clip-path, mask and backdrop-filter
are part of the palette when they stay smooth.

**States.** Hover, focus, active, disabled, loading, error, empty. The empty state is the one
that ships broken, and it is the first thing a new user sees.

**Browser surfaces.** The parts nobody draws still carry the design: text selection, the caret,
scrollbars, focus rings, underline offset, tabular numerals in data. They ship with defaults that
belong to no design system. Theming them is the cheapest available signal that a page was built
rather than assembled, and it is the thing models skip most reliably.

**Real content.** Longest plausible name, empty list, one item, a thousand items, a broken image,
a slow network. Design that only works at the demo length is not finished.

## Judgment the linter cannot make

- **Hierarchy.** Squint at it. If everything is equally loud, nothing is. The most important
  element on the surface should be obvious before any text is read.
- **Structure follows content.** Different things should look different. Identical cards for
  non-identical content is the lazy container, and nested cards are always wrong.
- **Copy is design.** Controls name their action. Errors name the problem and the recovery.
  Product language, not category language.
- **Density suits the scene.** Who is using this, where, on what, under what light, in how much
  of a hurry. A tool used all day and a page seen once should not have the same density.
- **Commit.** When torn between refined and committed, commit. A design with a clear point of
  view and one flaw beats a design with no flaws and no view. Safety is the failure mode here,
  not boldness.

## When refining rather than building

Refinement preserves. Keep the identity, the behaviour, the copy and everything outside the
scope you were given. Do not replace factual copy or add claims without asking. If the incumbent
look genuinely needs replacing, that is a `system` conversation and a decision for the user, not
something to do quietly under the heading of a polish pass.

## The standard

The floor above is what a design must clear. This is what separates work that holds up from work
that merely passed. All four are habits, not styles, so they apply to any visual direction.

**Every load-bearing value records the alternative it beat.** Load-bearing means a reader would
reasonably ask "why that number?" A breakpoint that says why it is not two hundred pixels lower,
a glass fill that says why it is not the app's value, a font size that says what it looked like
one step down. A value with its reasoning attached argues back when someone reaches for it. A
bare number gets changed on a whim inside a week, and that is how a system drifts: not through
one bad decision, but through a hundred undefended small ones.

**When a rule gets skipped twice, make it mechanical.** Prose degrades under time pressure,
because it can be skimmed and skimming is what happens when the work is nearly done. This skill
exists on that premise, so it should teach it rather than merely rely on it. The second time a
project relearns the same lesson, the lesson belongs in a script, a schema, or a build step that
fails.

**Measure rather than eyeball, and record the measurement.** Perception is not linear and the eye
is a bad instrument for its own failures. Banding is a response to the derivative of a gradient,
not its absolute step, so a fade that looks wrong three times in a row will still look wrong after
a fourth adjustment made by eye. Sample it, compute the thing that actually governs the effect,
and write the number down. The same holds for contrast ratios, optical alignment and hit areas:
measured, then recorded, so the next person does not redo the work to reach the same answer.

**Draw it rather than import it, and theme the parts nobody draws.** An icon set chosen from a
library is a decision to look like every other product using that library. Selection colour,
caret, scrollbar, focus ring and placeholder are the parts no one designs, which makes theming
them the cheapest available signal that a page was built rather than assembled.

**Record deviations instead of taking them silently.** Every real project ships something it
knows is not right: an accessibility path that does not exist yet, a contrast ratio the brand
colour cannot make, a state left undesigned. Written down, with who decided it, that is a known
debt. Unwritten, it is a defect nobody owns, and the difference between the two is entirely in
the record.
