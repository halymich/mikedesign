# system

Build the project's design system. Ends with a committed `DESIGN.md` that every later command
builds against.

## 1. Look before you ask

Decide whether this is greenfield or has an incumbent. A missing `DESIGN.md` does not mean
greenfield; it means nobody wrote one down.

If code exists, extract the de-facto system first: typefaces actually loaded, colours actually
used, spacing steps that repeat, component patterns, the motion that exists. Then show the user
what you found and ask what to keep, rather than interviewing them about decisions already
visible in their stylesheet. Nothing burns credibility faster than asking someone what their
brand colour is while it is sitting in their CSS.

## 2. Interview

Load [../core/inquiry.md](../core/inquiry.md). Scaffold and check the brief:

```
node $S/brief.mjs init <project-root> system --type <persuade|operate|read>
node $S/brief.mjs check <project-root>/.mikedesign/brief-system.md
```

Factual questions first, in batches of four. Then the specifically visual ones: what should this
never look like, what does the user already admire and why, what does the product feel like when
it is working, where and under what light is it used.

Ask about assets before designing, not after. What is available decides what is possible.

## 3. Three concepts, rendered

Not descriptions. Three real, working, viewable sections the user can look at side by side.
People react accurately to pixels and inaccurately to adjectives, and this step exists to stop
the round-trip where "modern and clean" turns out to have meant something else entirely.

**Scope: one representative section each**, typically the hero plus one content block. Not full
pages. Full-page concepts cost enough that this step quietly collapses into three colour swaps,
which is the exact failure to avoid.

**They must diverge on three named axes.** State the axes explicitly in your output:

1. **Type**: different families, and a different relationship between display and body.
2. **Layout**: different structural logic. Centred stack against asymmetric split against
   editorial column against full-bleed image-led. Not the same grid three times.
3. **Colour logic**: not three accents on one neutral. Different ground, different temperature,
   different amount of colour doing work.

If you cannot name how a concept differs on all three axes, it is not a third concept and you
should replace it before showing anything.

Render into a scratch directory, never into the project tree, so an interrupted run leaves
nothing behind. Show them with real copy from the brief, at desktop and mobile. Then ask which
one, and equally what to steal from the losers.

## 4. Write DESIGN.md

Human prose plus exactly one fenced json block. The prose is for the user; the block is the
contract the scripts read.

Cover: the chosen direction and why, the type system with real sizes and weights, the palette
with the role of each colour, spacing scale, radius and depth, motion character, voice, and the
rules of the illustration style if one exists yet. Record any hard rule the brief overrode, with
the reason.

```json
{
  "surfaceType": "persuade",
  "palette": ["#0c1425", "#facc15", "#f8f7f4"],
  "fonts": { "display": "Söhne", "body": "Söhne" },
  "allow": [],
  "budgetOverrides": {}
}
```

The palette block is load-bearing: colours declared here stop the linter reporting them as
generic. A genuinely violet brand declares violet and the rule goes quiet. That is the override
working as intended.

## 5. Verify and report

Lint the chosen concept as built (see the Verification section of SKILL.md). Report the
assumptions first, then the direction chosen and what it commits the project to, then what the
user should decide next.
