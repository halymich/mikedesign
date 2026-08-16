# Platform: web

## Detect, do not assume

Read what the project actually is before writing a line. Look for a package manifest, a build
config, existing stylesheets, and how a page currently gets to the browser. Hand-written static
HTML, Astro, Next, Rails, Hugo and a single `index.html` all need different output, and guessing
produces code that does not belong in the repo.

Match the incumbent patterns. If the project writes plain CSS in shared partials, write plain CSS
in shared partials. Introducing a framework, a build step or a utility-class system into a
project that had none is an architectural decision for the user, not a side effect of a design
task.

Utility-class defaults are the single most-cited source of the generated look, indigo-500 above
all. On a project already using one, the defence is the design system: define the tokens, use
them, and never reach for a stock palette entry because it was closest to hand.

---

# What good actually looks like

The rest of this file is measured, not remembered. The numbers come from reading computed styles
off a set of software marketing sites that do this well, so they describe what these pages are,
not what a trend piece says they are. Treat them as calibration, not as a template: copying the
numbers gets you a competent page, and the point is to know which axis you are choosing to move.

Reference set, deliberately spanning dark technical, warm editorial and bright conversion:
[wisprflow.ai](https://wisprflow.ai), [writer.com](https://writer.com),
[crewai.com](https://crewai.com), [coderabbit.ai](https://www.coderabbit.ai),
[lindy.ai](https://www.lindy.ai), [databricks.com](https://www.databricks.com),
[aiven.io](https://aiven.io).

To extend this, measure rather than describe. Load the site, run `$S/collect.js`, and read the
computed values. An impression of a page is worth much less than its actual type scale, and the
two disagree more often than you would expect.

## The ground is a decision

**Not one of them uses `#ffffff` or `#000000`.** Measured grounds: `#FFFFEB` (pale warm yellow),
`#FCF9F8` (warm off-white), `#05080F` (near-black with a blue cast). Pure values are what you get
when nobody chose, and on a large flat area that absence is visible.

Warm off-whites read approachable and human. Blue-cast near-blacks read technical and precise.
Pick from the use scene and the product, then push the ground a few points off pure in that
direction. It costs nothing.

## Type carries the page

Display type is the design on these pages. Everything else is support.

- **Size:** 57 to 96px at desktop for the hero headline. Not 32px. The headline should be
  uncomfortable to write and obvious to read.
- **Leading is tighter than the type size.** Measured: 0.85 and 0.95. Display type at 1.4 leading
  looks like body copy that got bigger.
- **Tracking is negative:** −0.02em to −0.03em. Large type needs less space between letters, not
  more.
- **Weight is a decision, not a default.** One of these leads with a serif at **weight 400** and
  outranks the sites shouting at 800. Another runs an 800-weight condensed sans in uppercase.
  Both are deliberate. Regular-weight display is available to you.
- **One or two families, not three.** Several use a single family across the whole page and
  separate the display voice by weight and size alone.

Body copy sits at 18 to 20px with leading 1.3 to 1.5. Note that 16px is a floor, not a target.

**Measure: 45 to 60 characters on a `persuade` surface.** Measured at 48ch and 55ch. This is
deliberately narrower than the 65 to 75ch that is right for reading. Marketing copy is scanned in
a glance, and a short line is easier to scan; long-form reading wants the wider measure. Use the
surface type to decide which you are building.

## The headline

- **One accent, never two.** Every site colours or highlights exactly one word or phrase in the
  headline. The accent is what the sentence is about. Two accents means neither.
- The accent can be colour, a solid highlight block behind the words, or a shift to italic in a
  serif. It does not have to be a gradient, and on these sites it never is.
- **Say the specific thing.** "Serverless Postgres for applications that scale" beats "the modern
  data platform". The subhead is where real nouns go: the actual product names, the actual number,
  the actual guarantee.

## Show the product, large

Every one of these leads with the real thing, at size, usually bleeding off an edge of the
viewport so it reads as a window into something bigger:

- real product UI, screenshotted or rebuilt in the page
- an actual API call with real endpoints, not `foo/bar`
- the integrations as their real logos, arranged around the hero

None of them leads with an abstract illustration of a concept. If the product is not
photogenic yet, that is a reason to show a smaller true part of it, not a reason to draw a
metaphor.

## The page sequence

Read across these sites the order is remarkably consistent. It is a sales conversation, and it
answers objections in the order they occur:

1. **Hero.** Headline, one-line subhead, primary action.
2. **Logo wall, immediately.** Measured at roughly 900px down, which is just past the first
   screen. Borrowed credibility before anything is explained.
3. **The mechanism.** How it actually works, usually with the quantified benefit attached.
4. **Features**, as named or numbered blocks, each with its own visual.
5. **Objection handling.** Security, privacy, compliance, control. Whatever the obvious hesitation
   is, answered as a section rather than left to the FAQ.
6. **Testimonials with real names and numbers.** Named people, their company, their title, and a
   metric where one exists.
7. **Pricing**, when the product is self-serve.
8. **FAQ**, 10 to 14 questions, doing the remaining objection work.
9. **Final CTA**, restating the same primary action.
10. **Footer**, with compliance badges and the full navigation.

You do not need all ten. You do need the order: earn attention, borrow credibility, explain,
prove, remove risk, ask.

## Call to action

- **One primary action, repeated verbatim.** Measured: the same label eight times on one page,
  four on another. Repetition is not clutter, it is the visitor being able to act at the moment
  they are convinced, wherever that is. Do not creatively vary the wording.
- The secondary action is always visually quieter: outlined against filled, or dark against
  brand colour. Two equal buttons is two ways of saying you did not decide.
- **Risk-removing microcopy sits directly under the button**, not in the footer: the trial length,
  the cancellation terms, the platforms it runs on, whether a card is needed.
- Some replace the button with the first field of the form itself. That removes a click and is
  worth considering when the next step is just an email address.

## Trust, and where it goes

- Logos above or immediately below the fold.
- A rating inline with the hero CTA, where it is read as part of the decision.
- Testimonials from named, checkable people, with handles or titles, ideally with a number
  attached.
- Compliance badges in the footer, which is where people go looking for them.
- **Real numbers only.** These sites cite 99.99% SLA, 72% TCO reduction, 17K customers. Each is
  checkable and each belongs to someone. An invented equivalent is a hard rule violation and a
  claim you cannot stand behind.

## Motion

Measured, this is far more disciplined than it looks:

- **Almost everything is `opacity` and `transform`.** On one site, 656 of 831 transition
  declarations; on another, 319 of roughly 450. These are the two properties that skip layout and
  paint, so they stay smooth on cheap hardware.
- **Never transition `width`, `height`, `top`, `left`, `margin` or `padding`.** Scale instead of
  width. Translate instead of top. The linter flags this.
- **Honour `prefers-reduced-motion`.** Two of the three sites measured carry explicit rules for
  it. The third does not, and that is a defect in an otherwise excellent site, not a licence.
- **Nobody uses scroll-driven CSS timelines.** Reveals are IntersectionObserver plus a class.
  Well-supported and easy to disable.
- **One authored moment per page.** Kinetic type that assembles the headline, text running along a
  curved path, a dashboard that animates once. One idea, executed properly, beats a fade-up on
  every section.
- Entrances start from an already-visible state so nothing essential depends on JavaScript having
  run.

## Navigation

Two patterns, both fine, and the choice says something:

- **Full-bleed bar** on the top edge. Conventional, gets out of the way, right for dense
  enterprise navigation.
- **Floating pill**, inset from the top with a shadow, so the page appears to run underneath.
  Lighter and more product-like. Fits a smaller navigation.

The primary CTA lives in the nav in every case, and it is the same label as the hero button.

---

## Verification

```
node $S/lint.mjs --rendered <scratch.json> --source <dir> --design .mikedesign/DESIGN.md
```

Collect with `$S/collect.js` from a real render, at desktop and at mobile, since the computed
values differ and so do the findings. Screenshot both and read them at full size.

Also check by hand, because the linter cannot:

- Tab through the whole surface. Focus visible at every stop, order matching the visual order.
- Text selection, caret, scrollbars and focus rings themed from the palette.
- Real content at its longest and its emptiest.
- Reduced motion honoured.
- Both themes if the project has two.

## Performance is design

Layout shift after load is a design failure, not an engineering detail. Reserve space for images
and embeds. Self-host the display face and preload it, so the first paint is the design rather
than a fallback. Ship the fewest fonts and weights the system genuinely uses.
