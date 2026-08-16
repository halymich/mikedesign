# critique

Read-only diagnosis. Produces a findings backlog that `refine` consumes. **Changes nothing.**

Diagnosis and surgery are separate on purpose. A pass that fixes as it looks stops looking early,
because the moment you start editing you begin defending what you already wrote.

## 1. Render and collect

```
node $S/lint.mjs --rendered <scratch.json> --source <target> --design .mikedesign/DESIGN.md
```

Get real coverage. A critique built on source scanning alone has not checked colour, typeface,
shadow or layout, and must say so rather than implying a clean bill.

On native, see [../platform/native.md](../platform/native.md). Rendered collection does not apply;
source checks and real screenshots do.

## 2. Look properly

The linter finds tells. It cannot tell you whether the thing is any good. Screenshot desktop and
mobile, then actually read the screenshots against
[../core/craft-floor.md](../core/craft-floor.md):

- Squint. Is the most important element obvious before any word is read?
- Follow the sequence. Does the surface answer the visitor's questions in the order they arise?
- Find the weakest section, name why it is weakest, and say what it should carry instead.
- Check the states nobody demos: empty, error, loading, longest plausible content.
- Check the copy against the product's own language, not category language.

## 3. Check for drift

Compare `.mikedesign/DESIGN.md` against what the code actually does. Typefaces that are no longer
loaded, palette colours nothing uses, spacing steps that have quietly multiplied, components that
have forked. Drift is why a design system stops being true, and it is invisible until something
is built against a description that stopped matching reality.

Report drift as findings. **Do not repair it here.** This command changes nothing, including
documentation.

## 4. Write the backlog

Write `.mikedesign/critique-<surface>.md`, ordered by severity. Add `.mikedesign/critique-*.md`
to the project's `.gitignore` if it is not already there: findings are regenerable and go stale,
so committing them just adds noise to every later diff. `DESIGN.md` and the briefs do get
committed.

Sections, in this order:

- **P0** hard lint findings, broken states, unreadable contrast, anything shipping-blocking
- **P1** craft floor failures, hierarchy problems, copy that misleads
- **P2** advisory findings and judgment calls, each with your recommendation
- **Drift** where the system and the code disagree

Every finding needs a locator, what is wrong, why it matters, and the fix. A finding a reader
cannot act on is a complaint.

Give a score out of 10 with one sentence of justification, and state the coverage the score rests
on. A 7 based on partial coverage is a 7 about half the surface, and saying so is the difference
between a critique and a guess.
