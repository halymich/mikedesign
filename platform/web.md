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

## Where the generic look comes from

Utility-class defaults are the single most-cited source of the generated look, indigo-500 above
all. On a project already using one, the defence is the design system: define the tokens, use
them, and never reach for a stock palette entry because it was closest to hand.

## Conversion surfaces

On a `persuade` surface the design is the product, so it has to earn attention before it earns
action.

- **One action.** Every section either moves the visitor toward it or is deleted. A page with
  four equally weighted calls to action has none.
- **The sequence is the design.** What must the visitor understand, in what order, before the
  action is possible. Build that, rather than the section stack that fits any product.
- **Proof beats claims.** A working demonstration, a real screenshot, a real number. If the
  proof does not exist yet, the honest move is fewer claims, not invented evidence.
- **The fold is not a rule.** People scroll. What matters is whether the first screen makes
  scrolling feel worthwhile.
- **Mobile is the primary case.** Design it at 375 wide and let desktop be the adaptation, not
  the other way round.

## Verification

```
node $S/lint.mjs --rendered <scratch.json> --source <dir> --design .mikedesign/DESIGN.md
```

Collect with `$S/collect.js` from a real render, at desktop and at mobile, since the computed
values differ and so do the findings. Screenshot both and read them.

Also check by hand, because the linter cannot:

- Tab through the whole surface. Focus visible at every stop, order matching the visual order,
  nothing reachable that should not be, nothing unreachable that should.
- Text selection, caret, scrollbars and focus rings themed from the palette.
- Real content at its longest and its emptiest.
- Reduced motion honoured.
- Both themes if the project has two.

## Performance is design

Layout shift after load is a design failure, not an engineering detail. Reserve space for images
and embeds. Self-host the display face and preload it, so the first paint is the design rather
than a fallback. Ship the fewest fonts and weights the system genuinely uses.
