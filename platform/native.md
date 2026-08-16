# Platform: native (iOS, Android)

This file is deliberately thin. It carries what actually differs on native and grows on first
real use rather than guessing in advance.

## What changes

**Rendered collection does not apply.** There is no DOM and no `getComputedStyle`, so the
linter's rendered checks are unavailable. On native you have source checks plus real screenshots,
and the report must say so. Describing a native surface as "clean" on the strength of a source
scan overstates what was actually verified.

```
node $S/lint.mjs --source <path> --design .mikedesign/DESIGN.md --surface operate
```

That is partial coverage by construction, and the linter will say so. Do not paper over it.

**Simulator verification is opt-in per run.** A build plus launch plus navigate cycle takes
minutes, and a check that slow becomes a check everyone skips. Default to source checks and
existing screenshots. Run the full cycle when the change is visual enough to need it, or when the
user asks.

When you do run it, drive the Simulator directly and read the screenshots. Do not ask the user to
look on your behalf.

**Reaching a screen is often the hard part.** A specific state may need data in the account, a
purchased entitlement, granted permissions, or hardware the Simulator lacks. When you cannot get
there, say which screen you could not reach and why, and ask the user to drive the app to it.
Never describe a screen you did not see.

## Conventions

Native users expect native behaviour, and the platform's own patterns beat invented ones. Brand
lives in type, colour, motion character and the precision of the details, not in replacing
standard navigation with something bespoke.

- **Respect the platform's navigation model**, its gestures, its back behaviour and its
  presentation styles. A custom sheet that behaves almost like the system sheet is worse than
  either.
- **Touch targets** at 44pt on iOS, 48dp on Android, including the invisible hit area.
- **Dynamic Type and font scaling** are not optional. Test at the largest accessibility size and
  fix what breaks, rather than capping the scale.
- **Safe areas, notches, home indicators, keyboard avoidance.** These are where native layouts
  actually fail.
- **Dark mode is a real requirement**, not a toggle to add later. Both themes at every step.
- **System affordances** for the standard cases: share, permissions, purchases, alerts.
  Reimplementing them signals amateurism and usually loses functionality.

## Surface type

Most app screens are `operate`: the visitor is completing a task, and scanability and consistency
outrank expression. Onboarding and paywalls are the exception and are usually `persuade`. Set it
per surface in the brief, not per project.
