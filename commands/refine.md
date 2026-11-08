# refine

Improve something that already exists, without quietly redesigning it.

## What refinement means

Preserve the identity, the behaviour, the copy and everything outside the scope you were given.
Behaviour means the approved model in the brief's `behaviour-model` field: the states, the undo,
the keys and the convention it follows. A polish pass that changes what a click or a key does has
changed the product, however small the diff looks.
The user asked for an improvement to this thing, not a replacement for it. If you believe the
whole direction is wrong, say so in a sentence and ask, rather than delivering a redesign under
the heading of a polish pass. Splitting the difference is the worst of the three: polish applied
to a look you had already decided to discard is wasted on both counts.

## 1. Get the backlog

If `.mikedesign/critique-<surface>.md` exists, that is the work list, and it is better than
anything you would generate from a fresh look because it was produced by a pass whose only job
was seeing clearly. Work it in severity order.

If it does not exist and the target is more than a small change, run `critique` first. Diagnosing
and fixing in one motion is how a refine pass turns into an unrequested rebuild.

## 2. Scope

If the target carries words, run the deletion test from
[../core/joint-brief.md](../core/joint-brief.md) over every string in scope first. Propose cuts
with the reason for each. The strongest refinement available is often removing text the design
already says. Words that stay and need rewriting go to mikecopy.

Name the target precisely: this component, this section, this screen. Then hold that line. The
most common failure here is scope creep that looks like helpfulness, and the user cannot review a
change that touched everything.

Read `.mikedesign/DESIGN.md` first. Refinement moves work toward the committed system, so a fix
that introduces a colour, a size or a spacing value outside the system is not a fix.

**Agree the list before you touch it.** A backlog of twenty findings is not a work order; some of
them are judgment calls the user will decide differently than you would, and finding that out
after the pass wastes the pass. Show the findings you propose to close this round, say which ones
you would leave, and ask. This is one short gate, not a per-finding conversation.

## 3. Fix

Load [../core/craft-floor.md](../core/craft-floor.md), and [../core/ui.md](../core/ui.md) for an
`operate` surface. Work through the findings. Prefer removing
over adding: most tired interfaces are carrying too much, not too little, and the strongest
single move available is usually deletion.

If a finding needs a product decision, or a claim you cannot verify, or content the user has to
supply, leave it and flag it. Do not invent content to close a finding.

## 4. Verify

Re-render, re-collect, re-lint, and compare against the findings you set out to fix. On a product
screen, re-run `behave.mjs` on the main action and confirm the behaviour still matches the
approved model. Then compare
the result to the references in [../core/bar.md](../core/bar.md), principle by principle, and
list the gaps that remain.

## 5. Show the difference

Refinement is the command where a written report is least trustworthy, because every individual
fix sounds like an improvement and the only real question is whether the whole thing got better.
Twelve defensible changes can still add up to a worse page.

So show before and after, on the same URL, at the same viewport. Publish the pair together if the
project cannot serve both. Follow [../core/showing.md](../core/showing.md).

Report which findings closed, which remain and why, and what needs the user.
