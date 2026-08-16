# Inquiry

The failure this prevents: a design that is plausible, competent, and about a product nobody
described. Every generic interface starts with a question nobody asked.

## The rule

Never guess a design decision. Two outcomes are acceptable for any required field: the user
answered it, or it is recorded as an assumption with a reason. There is no third acceptable
outcome, and "it seemed obvious" is the guess this exists to catch.

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

Deleting a stub to make the script pass is falsifying the record.

## Asking well

Use `AskUserQuestion`, up to four questions per call, factual before visual.

**Factual first.** Who arrives, what they must do, what they must believe, what they use instead
today, what content is non-negotiable, what real assets exist. These constrain the design. Asking
"do you like serif or sans" before them produces a decorated guess.

**Give real options with real trade-offs.** Every option needs a description that says what
happens if it is chosen, not a restatement of the label. Put your recommendation first and mark
it. Being a thought partner means having a view.

**Never ask what you can find out.** Read the code, the existing CSS, the app, the repo. A
question whose answer is sitting in the stylesheet wastes the user's attention and spends
credibility you will need for the questions that matter.

**Ask about the enemy.** "What should this not look like" is worth three positive references.
People describe taste far more precisely in the negative.

**One question, one decision.** If an answer would not change what you build, do not ask it.

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

## When the user says "just do it"

That is a real answer and you should take it. Run `brief.mjs check`, fill every stub with a
reason that names what you inferred it from, build, then lead the report with the assumption
list so they can correct the ones that matter. Speed is theirs to choose. Invisible guessing is
not.
