# Product UI

Load this for every `operate` surface: anything a person uses to get something done. App screens,
account pages, a "My bookings" list, settings, dashboards, checkout, onboarding inside the app.
It loads on top of [craft-floor.md](craft-floor.md), never instead of it, and on native alongside
[../platform/native.md](../platform/native.md).

Marketing pages are `persuade` and do not load this file. A paywall or onboarding screen inside an
app is `persuade` for its copy and budgets, and still loads this file, because a person is
interacting with it.

The failure this prevents: a product screen that looks finished in a screenshot and feels slow,
jumpy or unusable in the hand. Product UI is judged in use. Everything below is either measured by
`scripts/measure.mjs` or checked by hand on the built result, and the report says which.

## The targets

Measured on a mid-range phone profile (4x slower CPU, slow 4G), not on the machine it was built
on. Misses are reported to the owner with the number; they decide whether a miss blocks shipping.
Never round a miss into a pass, and never leave a target out of the report because it missed.

| Target | Web | Native (iOS, Android) |
|---|---|---|
| Feedback | Tap response (INP) at or under **200 ms** | Visible or haptic response within **100 ms** of touch |
| Stability | Layout shift (CLS) at or under **0.05**, half of Google's "good" | No content jumping as data arrives |
| Weight | At or under **150 KB** compressed JavaScript and **2 font files** on first load | No new dependency for something the platform provides |
| Access | **WCAG 2.2 AA**, zero axe violations | VoiceOver and TalkBack complete every task, Dynamic Type to the largest size |
| Screens | Works from **320 px** wide to desktop | Every size class the app supports, both orientations it allows |

A project may change a target in `DESIGN.md` at `uiBudgets`, with the reason in prose. Moving a
target without a recorded reason is the same failure as silencing a lint rule.

### Sub-200 ms feedback

The user must see that their tap landed before anything slow happens. That is a design decision
before it is an engineering one.

- **Acknowledge first, work second.** The pressed state, the spinner, the optimistic row, all
  paint in the same frame as the tap. The network call comes after.
- **Optimistic UI for reversible actions.** Mark it done, then reconcile. For irreversible or paid
  actions, show progress instead, because pretending a payment succeeded is worse than waiting.
- **No work on the main thread in a tap handler** beyond updating state. Parsing, sorting large
  lists and image processing move off it or into idle time.
- **Pressed states are tactile.** A slight scale (0.97) and a compressed shadow on press, using
  `transform` and `opacity` only, so it costs nothing to render.
- **Skeletons match the real layout** exactly, so the swap to content moves nothing. A generic grey
  bar that is shorter than the real row is a layout shift waiting to happen.

### Layout stability at 0.05

- **Reserve every space before it fills.** Images and video carry `width` and `height` or an
  `aspect-ratio`. Embeds, ads and async panels get a fixed-size container.
- **Fonts do not reflow the page.** Self-host, preload the one file the first screen needs, and set
  the fallback's metrics (`size-adjust`, `ascent-override`) so the swap is invisible.
- **Never insert content above what the user is reading.** Banners, cookie notices and "new items"
  bars overlay or push from the bottom.
- **Animate with `transform` and `opacity` only.** The linter flags the rest.

### Lean architecture

- **Match what the project already uses.** A framework, build step or state library the project
  does not have is an architectural decision for the owner, not a side effect of a screen.
- **The platform first.** `<details>`, `<dialog>`, the `popover` attribute, CSS scroll snap,
  container queries and `:has()` replace most of what UI libraries are imported for.
- **One variable font file** covers every weight and usually the whole type system inside the
  two-file budget.
- **Images in AVIF or WebP**, sized to the slot they fill, lazy below the first screen.
- **Name the cost of anything added.** If a dependency is genuinely needed, say its compressed size
  in the report next to what it replaces.

### Accessibility, WCAG 2.2 AA

axe-core catches roughly the mechanical third. The rest is checked by hand, every time:

- **Keyboard**: every action reachable, focus order matches visual order, focus always visible and
  never hidden under a sticky bar (2.4.11).
- **Targets**: at least 24 px (2.5.8) with spacing; this skill's own floor is 44 px on touch.
- **Dragging** always has a single-tap alternative (2.5.7): reorder buttons beside the drag handle.
- **Forms**: visible labels, errors named in text next to the field, nothing asked twice in one
  flow (3.3.7), sign-in that allows paste and password managers (3.3.8).
- **Contrast** 4.5:1 for text, 3:1 for large text and for control boundaries, measured on the real
  background, including over glass and texture.
- **Motion** honours `prefers-reduced-motion`; transparency honours `prefers-reduced-transparency`.
- **Zoom and reflow**: usable at 200% text and at 320 px without horizontal scrolling (1.4.10).

### Responsive and mobile-first

- **Build the phone layout first** and add columns as space allows, never the reverse.
- **Container queries for components**, media queries for page layout, so a card works in a list
  and a sidebar without two versions.
- **The thumb zone.** Primary actions in the bottom half on phones. Destructive actions away from
  the primary one.
- **The right keyboard.** `type`, `inputmode` and `autocomplete` on every field.
- **Safe areas** on phones with notches and home indicators (`env(safe-area-inset-*)`).

## The visual language

Everything in this section is a tool, chosen per product and recorded in `DESIGN.md`. None of it
is a default. Two products built from the same defaults look like one product, and a trend applied
everywhere dates everything at once.

### Type scale: major third

Product UI uses a modular scale, **major third (1.25) by default**, on a 16 px base:

| Step | −2 | −1 | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|---|---|
| Size (px) | 10.24 | 12.8 | 16 | 20 | 25 | 31.25 | 39.06 | 48.83 |

A ratio this tight suits dense screens where many levels of hierarchy sit close together. Record it
at `typeScale` in `DESIGN.md` as `{ "base": 16, "ratio": 1.25 }`; the linter reports any text size
off the scale on `operate` surfaces. Marketing pages may choose a larger ratio for display type, and
that choice lives on their own target.

Rounding to the nearest whole pixel is fine and within the linter's tolerance. Inventing an
in-between size because 20 felt slightly too big is not: pick a step, or change the scale for the
whole product.

### Expressive, dynamic typography

- **Weight and optical size do the hierarchy work**, not only size. A variable font's `wght` and
  `opsz` axes give three clear levels without leaving the scale.
- **Numbers are tabular** in anything that updates or aligns: prices, times, counts, tables.
- **Fluid sizing (`clamp()`) only on display text**, between two scale steps. Body and control
  text stay fixed so the interface does not reflow as the window resizes.
- **Motion in type is one moment**, such as a price counting down to its new value, not a
  treatment on every heading. Reduced motion shows the final value.

### Tactile textures

Texture makes a flat screen feel like a material: a surface you could press.

- **Grain or noise** from a tiny inline SVG filter or a small tiled image (under 2 KB), at low
  opacity, on large surfaces only. Never under body text, where it costs contrast.
- **Pressed, raised and inset states** with layered shadows from one consistent light source, so
  controls read as physical and the pressed state reads as depressed.
- **Haptics on native** for confirmations and toggles, from the system's own feedback generators.
- **Check contrast on the textured surface**, not on the flat colour underneath it.

### Glassmorphism 2.0

Glass is for one job: **a layer floating over content that moves beneath it**, where seeing
through it keeps the user oriented. A tab bar over a scrolling photo grid, a sheet over a map, a
toolbar over a canvas. On an in-flow card nothing moves behind it, so the blur costs rendering time
and contrast and buys nothing. The linter flags glass on anything that is not fixed, sticky or
overlaid.

When glass is right:

- **On iOS and macOS, use the system material** (Liquid Glass through SwiftUI's glass and material
  APIs). It adapts to content, accessibility settings and performance limits for free. A hand-made
  imitation gets all three wrong.
- **On the web**: `backdrop-filter: blur()` plus saturation, a translucent tint from the palette, a
  one-pixel highlight on the top edge. Solid-tint fallback under `@supports not (backdrop-filter:
  blur(1px))` and under `prefers-reduced-transparency`.
- **Two blurred layers on screen at most on phones**, and never animate the blur radius. Blur is
  one of the most expensive things a phone draws, and it is what breaks the 200 ms target first.
- **Contrast is measured over the busiest content** that can scroll behind it, not over a calm
  area of the design file.

Record in `DESIGN.md` which surfaces use glass and texture and why. If a product uses glass
somewhere the linter flags, the record plus an `allow` entry is how it passes.

## Verify

1. **Lint** as usual; on `operate` it adds the type scale check.
2. **Measure** every surface that runs in a browser:
   ```
   node $S/measure.mjs <url> --tap "<selector for the main action>" --design .mikedesign/DESIGN.md
   ```
   Pass `--tap` for the controls people actually use. Without it the script taps only safe in-place
   controls, and a screen whose main action is never tapped has not had its feedback measured.
   For a screen behind sign-in on a local dev server, use a test account with `--user-data-dir`,
   and keep that folder in scratch space outside the repo: it holds the test account's session.
3. **Check by hand** what no script sees: keyboard pass, screen reader pass on the main task, 200%
   zoom, 320 px, reduced motion, the empty, error, slow and longest-content states.
4. **Native**: follow [../platform/native.md](../platform/native.md).

## Report

A table: each target, the measured value on mobile and on desktop, met or missed. Then what was
checked by hand, then what could not be measured and why. A miss is stated as a number with the
likely cause and the fix, and left for the owner to decide.
