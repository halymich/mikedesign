# copy

Write and cut the words a product ships. Interface strings, marketing pages, articles, the emails
it sends, and its store listing.

Load [../core/voice.md](../core/voice.md) before writing anything, plus
[../core/showing.md](../core/showing.md) for the review gates and
[../core/inquiry.md](../core/inquiry.md) for the interview.

## 1. Scope it first

Five scopes. They have different budgets, different structures and different failure modes, so
getting this wrong wastes the whole run. Take it from the request when it is obvious, ask once
when it is not.

| Scope | Covers | Surface type |
|---|---|---|
| `interface` | headlines, subheads, labels, buttons, errors, empty states, tooltips | the surface's own |
| `marketing` | landing and site copy, title tags, meta descriptions, OG text | `persuade` |
| `article` | blog posts, guides, hub pages, changelogs | `read` |
| `lifecycle` | transactional and lifecycle email, push, in-app messages | `persuade` |
| `store` | App Store and Play Store name, subtitle, description, keywords, release notes | `persuade` |

`screenshots` owns store panel captions and their six-word budget. Everything else in a store
listing is this command.

## 2. Voice before words

No drafting until a voice profile exists in `DESIGN.md` and `brief.mjs check` passes:

```
node $S/brief.mjs init <project-root> <surface> --fields copy
node $S/brief.mjs check <project-root>/.mikedesign/brief-<surface>.md
```

Capture the voice per `core/voice.md`. If the owner has published writing, read it before asking
them anything.

Editing existing copy does not need the full profile, but it does need enough of one to know what
you are preserving. Cutting words is safe. Changing how something sounds, without knowing how it
is supposed to sound, is not.

## 3. Budgets

Rendered surfaces have word ceilings in `data/rules.json`, enforced by the linter and keyed by
surface type. Overflow on headline, subhead and control gates. Overflow on body and item is
reported, because a long paragraph is sometimes correct and a script cannot tell.

The other formats have ceilings too, but they are yours to apply, not the linter's. Nothing in a
markdown file says which string is a subject line, so treating these as a gate would be pretending
to a check that does not exist:

- **Email subject** 9 words, and it must survive truncation at about 35 characters on a phone.
- **Email preheader** 14 words, and it must not restate the subject.
- **Push title** 6 words. **Push body** 20.
- **Article standfirst** 30 words.
- **Store subtitle** 30 characters, hard, set by Apple. The first three lines of a store
  description are the only ones shown before "more", so they carry the whole listing.

Articles have no body ceiling. That is what `read` means.

## 4. The rule that matters

**When text exceeds budget, the fix is usually not shorter text. It is a different medium.**

A paragraph explaining how the product works wants to be a mockup. A list of steps wants to be a
diagram. A claim about speed wants to be a demonstration. Reach for `illustrate` rather than
compressing prose into a tighter block of prose, and never solve overflow by shrinking the type.

This applies to interface copy. It does not apply to articles, where prose is the medium and
replacing a paragraph with a diagram loses the argument.

## 5. How to cut

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

## 6. Show it before it lands

Words read differently at 56px than they do in a chat message. A headline that is sharp in a
message can be shouty on a page, and a subhead that reads fine in isolation can duplicate the
headline once they sit together.

So the after-gate for this command is copy **in place, at real size**, not a list of strings. Put
the new copy on the real page and hand over the URL, or publish a before-and-after artifact where
there is no page yet. For an article, that means the article rendered in the site's own reading
styles, at its real measure.

Direction gate first when the angle is new: what this piece claims, in one sentence, and who it
is arguing against. Cheap to change then, expensive after a draft exists.

## 7. What you must not do

Do not invent claims, numbers, testimonials or names to fill a section. If a section needs proof
that does not exist, the section should not exist yet. Say that in the report rather than writing
the fiction.

Do not change factual content, legal text, pricing or product claims without asking. Cutting
words is in scope. Changing what is being asserted is not.

Do not silence a rule to make a draft pass. `em-dash-in-copy` is hard, and an article quoting a
source that uses one will trip it legitimately. The way through is the `allow` list in
`DESIGN.md`, which records that the project decided to permit it. Deleting the finding without
recording the decision is the same failure as deleting an assumption stub.

## 8. Verify

Re-render and re-lint so budget findings are measured on the built result, not on the source you
hope shipped. For articles and emails, lint the markdown directly with `--source`; the text rules
run there and cover it.

Two known limits, and say them in the report rather than implying coverage you do not have.
Fenced code blocks in markdown are not stripped, so a code sample can trip a text rule. And the
format budgets in step 3 were applied by you, not by a script.

Report what was cut, the word counts before and after, and anything left long on purpose with the
reason.
