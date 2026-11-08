# Joint brief

The failure this prevents: a screen designed without its words, then words squeezed into it, and
two interviews that ask the owner the same question twice. A layout and its copy are one
decision. The headline sets the hierarchy, the longest label sets the column width, the empty
state is half message and half picture. Deciding them in sequence is how words get cut to fit a
box nobody checked them against.

## When it applies

Any request whose result has both a layout and words a person reads: a feature screen, a
landing page, a settings page, an onboarding flow, a transactional email, a store listing. That
is nearly everything this skill touches. A purely mechanical edit the owner specified is
exempt, and so is a request that is only words (mikecopy alone) or only a visual (an icon, a
colour change).

## One interview, run by grilling

The owner is interviewed once, by the `grilling` skill, until they say they are aligned. Do not
run a design interview and then a copy interview.

- Load the `grilling` skill and run it. It owns the mechanics: design-tree rounds, the whole
  frontier asked each round, a recommended option first, the cost on every option, and the
  stopping rule.
- You supply the questions. Take the design questions from [inquiry.md](inquiry.md) (factual
  before visual, assets, the enemy) and the writing questions from mikecopy's
  `modes/product.md` (who is talking, what the reader already knows, the claim in one sentence,
  what must never be said). Ask each question once, in whichever round it belongs. If an answer
  already exists in `.mikedesign/DESIGN.md`, a prior brief or the owner's taste profile, use it
  and do not ask.
- If the `grilling` skill is not installed, run the same rounds yourself with your tool's
  structured question feature, and say so in the report.
- The record is `brief.mjs`, as before: `node $S/brief.mjs init <root> <surface> --type <type>
  --fields joint`. It holds the design fields and the writing fields in one file. Unanswered
  fields become recorded assumptions. Do not hand-maintain that list.

## Questions only a joint brief asks

These are the ones that stop the two halves drifting. Ask them in the round after the facts about
the visitor and the job are settled.

- **The string inventory.** Every piece of text the surface needs, one line each, with the job it
  does ("tells them the price dropped", "names the one action"). Nothing is drafted yet. The
  owner sees the list and can strike lines.
- **The deletion test.** For each string: if it were gone, what would the person lose? If the
  answer is nothing, or only something the layout or the next string already says, it comes out
  before any draft. See "Every string earns its place" in mikecopy's `SKILL.md`.
- **What the design says that the words need not.** An icon, a position, a state, a number in
  context. Words that repeat what the design already shows are the first to go.
- **What the words say that no design could.** The claim, the reassurance, the exact thing that
  will happen next. These get the space.
- **Where it will be read.** Phone in a queue, desktop at work, an inbox preview, a lock screen.
  This sets the length and the order, and for email it names the clients that matter. See
  [../platform/email.md](../platform/email.md).

## Order of work after the interview

1. **Find the bar.** Load [bar.md](bar.md), pick the references, write down the principles taken
   from each. This happens before any structure, because the bar changes what is worth
   attempting.
2. **Behaviour, on a product screen.** For an `operate` surface whose direction is new, build the
   grey prototype in [behaviour.md](behaviour.md) and hold the behaviour gate before any styling.
   Record the approved model in the brief's `behaviour-model` field. The string inventory's
   state and error strings appear in it in outline, because a failure state without its words
   cannot be judged.
3. **Structure and strings together.** Draw the sequence and the string inventory as one
   artifact. This is the direction gate in [showing.md](showing.md): the owner sees what appears, in
   what order, and what each piece of text says in outline.
4. **Words.** Hand the surviving inventory to mikecopy to write, in the voice at `brand.voice`.
   mikecopy returns the words with a count before and after, and any string it deleted with the
   reason.
5. **Build, verify, compare to the bar, show.** One surface, words in place, desktop and phone.

The words are written after the structure is agreed and before it is built. They are never
retrofitted into finished markup, and the structure is never finalized without having seen them.

## Fallbacks

- **No taste profile yet.** Offer the reaction session in [bar.md](bar.md) once. If declined,
  record that in the brief as an assumption and design from the product's own record. Do not
  block.
- **mikecopy not installed.** Write serviceable strings, keep the voice record intact, and say in
  the report that the words were not checked.
- **Nobody to ask** (scheduled or headless runs). Follow [showing.md](showing.md): build to the
  brief, mark every assumption, publish anyway, and lead the report with the fact that it was
  not reviewed.
