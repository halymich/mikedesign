# Inquiry

The failure this prevents: a design that is plausible, competent, and about a product nobody
described. Every generic interface starts with a question nobody asked.

## The rule

Never guess a design decision. Two outcomes are acceptable for any required field: the user
answered it, or it is recorded as an assumption with a reason. There is no third acceptable
outcome, and "it seemed obvious" is the guess this exists to catch.

**Opposite:** never ask what you can find out, and the owner's time is the scarcest thing in the
room. **Where each wins:** ask when two answers would build different things and the answer is not
in the code, the app or an earlier brief. Find it yourself when it is. Record an assumption when
the owner has chosen speed. A question whose answer would not change the build is never asked.
[Defaults are decisions](https://interfacelineage.com/defaults-are-decisions)

Each principle in this file is a pair, read the way "How to read the principles" in
[../SKILL.md](../SKILL.md) describes.

## Joint with the words

Most surfaces have words. The interview is then the one described in
[joint-brief.md](joint-brief.md), run by the `grilling` skill, and the questions below are the
design half of it. Read this file for how to ask the design questions well, and joint-brief.md
for how the whole interview runs.

## Mechanics

```
node $S/brief.mjs init <project-root> <surface> --type persuade|operate|read
node $S/brief.mjs check <project-root>/.mikedesign/brief-<surface>.md
```

`check` writes an `ASSUMED: <field> :: <reason required>` stub for every unanswered field and
exits 1 until each has a reason. Run it before you design, and again before you report. Do not
maintain the assumption list by hand: the whole point is that the script produces it, so a
forgotten guess is impossible rather than merely discouraged.

When `check` exits 1, you have two legitimate moves:

- Ask the user the outstanding questions. Preferred, always.
- Fill each `<reason required>` with why you are proceeding without an answer, then continue.

**Always wins:** deleting a stub to make the script pass is falsifying the record.

## Asking well

Use your tool's structured question feature (`AskUserQuestion` in Claude Code, `request_user_input` in Codex; plain numbered options in chat if neither exists), up to four questions per call, factual before visual.

**Factual first.** Who arrives, what they must do, what they must believe, what they use instead
today, what content is non-negotiable, what real assets exist. These constrain the design. Asking
"do you like serif or sans" before them produces a decorated guess.

**Give real options with real trade-offs.** Every option needs a description that says what
happens if it is chosen, not a restatement of the label. Put your recommendation first and mark
it. Being a thought partner means having a view.
**Opposite:** the owner's hands are the evidence. **Where each wins:** a recommendation goes first
on every question except `convention-source`, where the owner's experience is the answer and a
recommendation would only lead the witness (below).

**Never ask what you can find out.** Read the code, the existing CSS, the app, the repo. A
question whose answer is sitting in the stylesheet wastes the user's attention and spends
credibility you will need for the questions that matter.

**On a product screen, ask which tool they already use for this job.** Every time, with no
default answer. Then ask which parts of its model their hands already know: the layout, what a
click and a drag do, how selection works, the keys. This is `convention-source` in the brief,
and it is the one field `brief.mjs` will not let you assume (**Always wins**), because an interaction model nobody
asked about is the most expensive thing this skill can get wrong: it looks fine in a screenshot
and is only found when the owner tries to work in it. "None" is a real answer when it says what
was checked. See [behaviour.md](behaviour.md).

Four rules for this question, because it is the one most easily skipped:

- **Ask it fresh.** It overrides "never ask what you can find out" and "reuse earlier answers".
  An earlier brief or plan may name a model; offer it as one of the options, never as the answer.
- **No recommended option.** Elsewhere the recommendation goes first. Here the owner's hands are
  the evidence, so the options are the tools you found, plus "something else" and "nothing".
- **Ask which parts carry over in the same round.** Layout, selection, keys, what a click and a
  drag mean, and how the product's own suggestions or automation reach the person (marks on the
  work, or a list to approve). The last one is where generated tools most often go wrong.
- **Then recheck the brief.** Once the model is known, reread every field written before it
  (`success-action`, `must-include`, `string-inventory`) and ask about any that assume a
  different model. A brief that says "approve each suggestion" next to a model that says "edit
  the work" contradicts itself, and the old half wins by default.

Record the answer with who said it and when, for example "(Michael, 9 Nov 2026)". `brief.mjs`
does not accept it otherwise.

**Ask about the enemy.** "What should this not look like" is worth three positive references.
People describe taste far more precisely in the negative.

**One question, one decision.** If an answer would not change what you build, do not ask it.
**Opposite:** ask the whole frontier at once. **Where each wins:** each question carries one
decision, and every question that is open at the same time goes in the same round, up to four, so
the owner is not interrupted once per question.

## Assets are where this actually fails

Ask explicitly, early, and expect the honest answer to be "none of that yet":

- Real screenshots of the product, or a way to produce them
- Photography that is genuinely theirs or genuinely licensed
- A licensed display face, or budget for one
- Real customer quotes, real numbers, real logos

Whatever is missing becomes a constraint, not a gap to fill with an approximation. No real
photography means no photographic hero, not a generated one. No real testimonials means no
testimonial section, not invented ones. Record the constraint in the brief so the next surface
inherits it instead of relearning it.

**Always wins.** A missing asset is never faked. The design changes shape to fit what is real.

## When the user says "just do it"

That is a real answer and you should take it. Run `brief.mjs check`, fill every stub with a
reason that names what you inferred it from, build, then lead the report with the assumption
list so they can correct the ones that matter. Speed is theirs to choose. Invisible guessing is
not.

**Opposite:** ruthless inquiry. **Where each wins:** "just do it" wins for everything except
`convention-source` on a product screen, which still gets its one question, because it is the
guess most expensive to undo.
