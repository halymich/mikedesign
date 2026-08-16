# system

Build the project's design system. Ends with a committed `DESIGN.md` that every later command
builds against.

## 1. Find the targets first

Before anything else, work out how many interfaces this project has. A repo with an Xcode project
and a `web/` directory has two, and they need one brand with two systems, not one system pretending
to cover both.

Detect, then confirm. Look for an Xcode project or `Package.swift` (ios), `build.gradle` with an
Android plugin (android), `package.json` or html or a static site directory (web), and any
existing `.mikedesign/DESIGN.md`. Propose the target list you found and let the user correct it,
rather than asking them to describe their own repo.

Then ask which one this run is for. Establishing the brand plus the first target is usually right,
with further targets added later against the brand already agreed. Do not interview once and write
a system that silently assumes a platform.

For each target, capture what the platform can actually build with: SwiftUI's components, a CSS
framework's primitives, or hand-written CSS with no framework at all. This is the part that stops
`new` later proposing a control the target has no way to make. Record it in that target's section.

If the project has exactly one interface, say so and move on. This step should cost one question,
not five.

## 2. Look before you ask

Decide whether this is greenfield or has an incumbent. A missing `DESIGN.md` does not mean
greenfield; it means nobody wrote one down.

If code exists, extract the de-facto system first: typefaces actually loaded, colours actually
used, spacing steps that repeat, component patterns, the motion that exists. Then show the user
what you found and ask what to keep, rather than interviewing them about decisions already
visible in their stylesheet. Nothing burns credibility faster than asking someone what their
brand colour is while it is sitting in their CSS.

## 3. Interview

Load [../core/inquiry.md](../core/inquiry.md). Scaffold and check the brief:

```
node $S/brief.mjs init <project-root> system --type <persuade|operate|read>
node $S/brief.mjs check <project-root>/.mikedesign/brief-system.md
```

Factual questions first, in batches of four. Then the specifically visual ones: what should this
never look like, what does the user already admire and why, what does the product feel like when
it is working, where and under what light is it used.

Ask about assets before designing, not after. What is available decides what is possible.

## 4. Three concepts, rendered

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

## 5. Write DESIGN.md

Human prose plus exactly one fenced json block. The prose is for the user; the block is the
contract the scripts read.

Cover, once at brand level: the chosen direction and why, the type system with real sizes and
weights, the palette with the role of each colour, spacing scale, radius and depth, motion
character, voice, and the rules of the illustration style if one exists yet.

Then a section per target covering its platform, its stack, **the components actually available
to build with**, and any deviation from brand with the reason. Record any hard rule the brief
overrode and why.

```json
{
  "brand": {
    "palette": ["#0c1425", "#facc15", "#f8f7f4"],
    "fonts": { "display": "Söhne", "body": "Söhne" }
  },
  "targets": {
    "web": { "platform": "web", "surfaceType": "persuade", "allow": [] },
    "ios": { "platform": "ios", "surfaceType": "operate", "palette": ["#1c2333"] }
  }
}
```

A single-interface project can skip `targets` entirely and put the brand keys at the top level.
Do not add a targets map to a project that has one interface.

The palette block is load-bearing: colours declared here stop the linter reporting them as
generic. A genuinely violet brand declares violet and the rule goes quiet. That is the override
working as intended.

## 6. Verify and report

Lint the chosen concept as built (see the Verification section of SKILL.md). Report the
assumptions first, then the direction chosen and what it commits the project to, then what the
user should decide next.
