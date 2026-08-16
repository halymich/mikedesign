# refine

Improve something that already exists, without quietly redesigning it.

## What refinement means

Preserve the identity, the behaviour, the copy and everything outside the scope you were given.
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

Name the target precisely: this component, this section, this screen. Then hold that line. The
most common failure here is scope creep that looks like helpfulness, and the user cannot review a
change that touched everything.

Read `.mikedesign/DESIGN.md` first. Refinement moves work toward the committed system, so a fix
that introduces a colour, a size or a spacing value outside the system is not a fix.

## 3. Fix

Load [../core/craft-floor.md](../core/craft-floor.md). Work through the findings. Prefer removing
over adding: most tired interfaces are carrying too much, not too little, and the strongest
single move available is usually deletion.

If a finding needs a product decision, or a claim you cannot verify, or content the user has to
supply, leave it and flag it. Do not invent content to close a finding.

## 4. Verify

Re-render, re-collect, re-lint, and compare against the findings you set out to fix. Report which
findings closed, which remain and why, and what needs the user.
