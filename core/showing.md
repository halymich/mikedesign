# Showing

The failure this prevents: a finished surface the user has never seen. Verification is evidence
for you. Showing is evidence for them. Passing a linter proves the design broke no rule, which is
not the same as the design being right, and only one person in this conversation can tell you
which it is.

## The rule

Never describe work instead of showing it. Never ask the user to run a command to see their own
design. Never claim a rung of the ladder was impossible without having tried it.

A report that says "the hero now uses the accent colour at 72px" has told the user nothing they
can judge. A link they can open has told them everything.

## The ladder

Climb down only when the rung above genuinely does not apply. Check the tool exists before
reaching for it, and fall to the next rung quietly rather than erroring at the user.

**1. The real project, running.** If the project has a dev server, start it and hand over the URL.
Write `.claude/launch.json` if it is missing. Reviewing the actual thing beats reviewing a copy of
it, because the copy cannot show you a CSS conflict, a font that failed to load, or the way the
nav behaves at 900px.

**2. A published artifact.** For work not yet wired into a project: the three `system` concepts, an
`illustrate` drawing, a `copy` before-and-after. Self-contained HTML on a private page, which
means it opens on a phone, which means the user can look at a mobile layout on a mobile.

**3. The simulator or emulator**, for native targets. Open the live panel before you build, not
after, so the user watches it come up rather than waiting for a screenshot.

**4. A rendered file**, sent to the user to view, where a live page would be dishonest. Store
panels are the case that matters: they must be exact pixel sizes, and a browser that reflows them
is showing something the store will never display.

**5. Screenshots in the reply.** Last resort. The report says which rungs you tried and why they
did not work, so "here are some images" never quietly becomes the default.

## The gate

Showing without stopping is just a louder report. A gate is: show, then stop.

1. **Show it.** Link first, before any explanation.
2. **Say what to look at.** Name the two or three decisions you actually want judged, and say which
   one you are least sure about. "Everything look OK?" gets "yes" and teaches you nothing.
3. **Ask, and wait.** `AskUserQuestion`, with options that mean something: approve as built, a
   specific named change, and a real alternative direction. "Looks good / not quite" is not a
   question, it is a formality.
4. **Write the answer down.** Feedback goes into `.mikedesign/brief-<surface>.md`, so the next
   command inherits the decision instead of relearning it. A correction you did not record is a
   correction you will need again.

## How many gates

Gates attach to design decisions, not to edits. The routing exemption in SKILL.md already covers
mechanical changes where the user named the value; this extends it.

- **New or changing direction: two gates.** One before building, on the direction itself, when it
  is still cheap to change. One after, on the result.
- **Inside an already-approved direction: one gate**, after.
- **Mechanical change the user specified: no gate.** Make it and move on.

A skill that stops twice to trim a button label gets routed around, and a skill nobody uses
enforces nothing. Proportionality is what keeps the gates worth respecting.

## When there is nobody to ask

Scheduled runs, headless runs, and any context without an interactive channel. `AskUserQuestion`
cannot work there.

Never fabricate the approval. Build to the brief, publish the artifact anyway, and lead the report
with the fact that this was not reviewed, followed by the link. That way the gate becomes a
message waiting for the user rather than a step that silently did not happen. This mirrors what
`brief.mjs` already does with unanswered fields: the record shows what was decided without a human.

## This is not the shipping gate

Projects have an approval gate immediately before merge, covering whether the work ships. This is
a different gate, earlier, covering whether the design is right. Passing this one does not
authorize a merge, and a merge approval was never a design review. Do not collapse them into one
question.
