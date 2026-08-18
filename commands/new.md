# new

Build a surface that does not exist yet, against the system that does.

## 1. Foundation

Read `.mikedesign/DESIGN.md`. Build inside it: this command executes a committed visual world, it
does not invent a new one. If the surface genuinely needs a different world, that is a `system`
conversation with the user, not a decision to make quietly here.

**If there is no DESIGN.md**, do not block. Establish the minimum this one surface needs
(typeface, palette, spacing, one motion idea), record the entire foundation as assumptions via
`brief.mjs`, and build. Offer `system` afterwards. A user asking for a pricing page should get a
pricing page, not a form.

## 2. Brief

```
node $S/brief.mjs init <project-root> <surface> --type <persuade|operate|read>
node $S/brief.mjs check <project-root>/.mikedesign/brief-<surface>.md
```

Surface type is not inherited from the project. A docs page inside a marketing site is `read`.
Get it right, because it sets the word budgets and half of what "good" means here.

## 3. Stay inside the agreed scope

`DESIGN.md` lists the target's `components` and its `deferred` set. Build from the first. If the
surface genuinely needs something in `deferred`, or something on neither list, **ask before
building it**, then add it to `components` so the next surface inherits it.

Quietly widening the system is how a scoped system becomes an unscoped one, one surface at a
time. The scope was a decision the user made about what they are paying to maintain.

## 4. Structure before style

Decide what the surface must do, in order, before opening a stylesheet. What does the visitor
need to understand, in what sequence, to take the one action. Write that sequence down. Then let
the content decide the structure, rather than reaching for the section stack that fits any
product and therefore describes none.

Sections earn their place by carrying something the sequence needs. A section that exists
because pages usually have one is the definition of the thing this skill prevents.

**Gate on the sequence before you build it**, when the direction for this surface is new. The
section list is the cheapest artifact to change and the most expensive to change late: reordering
a list costs a sentence, reordering a built page costs the page. Show the sequence, say which
section you are least sure earns its place, and ask. See [../core/showing.md](../core/showing.md)
for how many gates this surface warrants; a page inside an already-approved direction needs only
the one at the end.

## 5. Build

Load [../core/craft-floor.md](../core/craft-floor.md) and the matching platform file. Build the
whole surface: real copy, real states, responsive, keyboard reachable, empty and error cases
handled. A surface that only works with placeholder content is not finished.

Text stays under budget by showing instead of telling. When a section needs more words than it
has, that is usually the signal it should be a mockup, a diagram or a demonstration. Reach for
`illustrate`.

## 6. Verify

Render, collect, lint, screenshot desktop and mobile, read the screenshots. Fix everything one
round shows, confirm with at most one more round, then stop. Open-ended self-review costs the
user money and finds less than one careful look.

## 7. Show it, and stop

Verification proved the surface broke no rule. It cannot tell you the surface is any good, and
you are not the one who gets to decide that.

Hand over something the user can open and click: the real project running if it has a dev server,
otherwise a published artifact. Desktop and mobile both. Name the two or three decisions you want
judged and say which one you are least sure about, then ask and wait.
[../core/showing.md](../core/showing.md) has the ladder and the gate.

Report assumptions first, then what shipped, then what needs deciding.
