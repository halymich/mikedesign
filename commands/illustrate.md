# illustrate

Software mockups, interface illustrations and data-flow diagrams. The thing you reach for when a
section is trying to explain something in words.

This command has **no house style**. Style is decided with the user, recorded, and then held
consistently. An illustration set that wanders across three styles reads worse than any one of
them.

## 1. Decide what it must communicate

Before any style question. One sentence: what does the viewer understand after looking that they
did not understand before. If that sentence needs an "and", it is two illustrations.

Then: is this showing what the interface looks like (a mockup), how something moves through the
system (a flow), how a thing changes over time (a chart), or how parts fit together (a
schematic). These want different drawings, and picking the wrong one is why an illustration ends
up decorative.

## 2. Decide the style, with the user

If `DESIGN.md` already records an illustration style, use it. Consistency across a set beats a
better idea applied to one of them.

If it does not, present the landscape and let the user choose. Show real examples where you can
rather than describing them, and say what each costs to maintain:

- **Monoline schematic.** Single stroke weight, no fill, one accent. Reads as precise and
  technical. Cheapest to keep consistent across a large set, and the safest default for flows.
- **Flat vector with solid fills.** Shape-led, two to three colours from the palette. Warmer,
  more approachable, easy to get generic if the shapes are not specific to this product.
- **Isometric.** Depth without perspective, good for systems with distinct components and layers.
  Expensive to keep consistent; every new piece has to obey the same projection.
- **Technical drawing.** Grid, measurement marks, exploded views, callout lines. Reads as
  engineering rather than marketing. Strong point of view, narrow range.
- **Editorial.** Expressive line, collage, deliberate imperfection, texture. The furthest from
  generated-looking, and the hardest to produce consistently without an actual illustrator.
- **Device-framed real screens.** Not drawn at all. Real product pixels composited into an
  authored frame. The most credible option available, and the one to prefer whenever the product
  actually exists.

Ask about motion in the same pass: static, animated on scroll or load, or interactive. Motion
changes how the thing must be built, so deciding it afterwards means rebuilding.

Record the choice in `DESIGN.md`, with stroke weight, corner treatment, fill logic, the palette
subset in use, and how labels are typeset. That is what makes the next one match.

## 3. Design the drawing with the user

Do not disappear and return with a finished illustration. Agree the content first: what is in the
frame, what is labelled, what is deliberately left out, what the viewer's eye should hit first
and second. For a flow, agree the steps and their order. For an animated piece, agree what moves,
what triggers it, and what the resting state is.

Leaving things out is most of the work. A mockup that reproduces every element of a real
interface communicates nothing; the simplification is the message.

## 4. Build it

Hand-authored inline SVG. Not a raster image, not a generated picture, not an icon-library
approximation of the thing.

The quality bar, all of which is checkable:

- **Colours come from tokens**, never hardcoded hex. It must follow the theme without being
  edited.
- **Geometry re-lays out on narrow screens**, rather than scaling down until it is unreadable. A
  chart that becomes illegible on a phone has failed at the size most people will see it.
- **One narrative, stated in `aria-label`.** Describe what the drawing shows, not that it is an
  image. Screen reader users get the point, not the filename.
- **Interactive parts are real controls.** Focusable, keyboard operable, visible focus state.
  Hover-only explanation does not exist on a phone, which is where most of the traffic is.
- **Motion honours `prefers-reduced-motion`** and starts from an already-visible resting state,
  so nothing essential depends on the animation having run.
- **Comment the reasoning, not the geometry.** Say why the drawing makes the choice it makes. The
  next person to touch it needs the intent, not a restatement of the coordinates.

## 5. Never fabricate data

**No invented prices, metrics, names, logos or testimonials.** A drawn number reads as a real
claim, and a chart with plausible fake data is a lie with a nice stroke weight.

When the shape of the data is the point and the values are not, show the shape without the
figures: mark the axis with a currency symbol or a unit, label the relationship, and leave the
numbers out. When real values exist, use them. When they do not and the drawing needs them, that
is a question for the user, not a gap to fill.

## 6. Device-framed real screenshots

Prefer these whenever the product exists. Capture from the real thing: the browser for web, the
Simulator for iOS, the emulator for Android. Composite into an authored frame that belongs to the
design system rather than a stock device mockup.

Be honest about the limit. Reaching a specific screen sometimes needs data in the account, a
purchased entitlement, a permission grant, or a physical device. When you cannot get there,
ask the user to drive the app to that screen and capture it, rather than drawing an approximation
and presenting it as the product.

## 7. Verify

Render it, view it at desktop and mobile, tab through any interactive parts, and check it in both
themes if the project has two. Lint the page it lives on. Confirm no fabricated data survived,
and report which parts are real and which are illustrative.

## 8. Show the finished drawing

Agreeing the content was not agreeing the drawing. An illustration is the one output in this skill
where a description and the artifact have almost no relationship: "a monoline diagram of the sync
flow" is true of a good one and a bad one equally.

Publish it where the user can open it at full size, in the page it belongs to if that page exists.
If it moves, they need to watch it move. [../core/showing.md](../core/showing.md) has the ladder.
