# copy

Cut interface text to budget. Owns interface copy: headlines, subheads, labels, buttons, errors,
empty states, tooltips, microcopy. Prose and articles belong to a writing tool, not here.

## The budgets

In `data/rules.json`, by surface type, because a ceiling that is right for a landing page would
wreck a privacy policy. Get the surface type right before cutting anything.

Overflow on headline, subhead and control gates. Overflow on body and item is reported, because
a genuinely long paragraph is sometimes correct and a script cannot tell.

## The rule that matters

**When text exceeds budget, the fix is usually not shorter text. It is a different medium.**

A paragraph explaining how the product works wants to be a mockup. A list of steps wants to be a
diagram. A claim about speed wants to be a demonstration. Reach for `illustrate` rather than
compressing prose into a tighter block of prose, and never solve overflow by shrinking the type.

## How to cut

1. **Delete whole sentences before trimming words.** The second sentence usually restates the
   first with more adjectives.
2. **Cut the wind-up.** "We built this because we believe" prefixes the actual claim. Start at
   the claim.
3. **Name the thing.** Category language ("solutions", "platform", "experience") is what you
   write when you have not decided what the product is. Use the product's own words.
4. **Controls name their action.** "Start watching this price", not "Submit". "Get started" is
   what a button says when nobody decided what happens next.
5. **Errors name the problem and the recovery.** Not the error code, and not an apology.
6. **Kill the rhythm padding.** Rule-of-three phrasing, and any sentence whose shape is doing the
   work its content should be doing.
7. **No em dashes.** Restructure with commas, colons, parentheses or two sentences.

## What you must not do

Do not invent claims, numbers, testimonials or names to fill a section. If a section needs proof
that does not exist, the section should not exist yet. Say that in the report rather than writing
the fiction.

Do not change factual content, legal text, pricing or product claims without asking. Cutting
words is in scope. Changing what is being asserted is not.

## Verify

Re-render and re-lint so budget findings are measured on the built result, not on the source you
hope shipped. Report what was cut, the word counts before and after, and anything you left long
on purpose with the reason.
