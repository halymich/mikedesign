# screenshots

App Store and Play Store listing assets: the captioned screenshot panels, and app preview videos.

This is the highest-leverage design surface an app has. Most people decide from the first two or
three panels in search results, before they ever open the listing. It is also the most slop-prone
surface there is, because it invites invented ratings, fake testimonials and claims nobody
measured. Every rule in `data/rules.json` applies here.

Specs live in `data/devices.json` with the date they were last verified and a source link. Stores
change them. Run `node $S/shots.mjs devices ios` rather than trusting memory, and if an entry says
`verified: false`, confirm it in the store console before uploading.

## 1. Scope it

Ask before anything else, because each answer changes the volume of work:

- **iOS, Android, or both?** They have different sizes, different counts, and Play needs a
  1024x500 feature graphic that Apple has no equivalent of.
- **Which device classes?** Apple only requires the largest per family: a 6.9" iPhone set and, if
  the app supports iPad, a 13" iPad set. Apple scales those down for everything else. Play does
  not scale, so tablet screenshots must show a genuine tablet layout rather than a stretched
  phone.
- **Which locales?** Read the project's existing store metadata first if it has any, so you
  propose the list rather than asking them to recite it. Apple falls back to the primary language
  where a locale has no screenshots, so shipping English first and adding locales later is safe.
- **How many panels?** Apple allows 1 to 10, Play 2 to 8. More is not better. Decide from how
  many things genuinely need saying.

Multiply it out and say the number out loud before starting. Eight locales times six panels times
two device classes is 96 images, and that number is what justifies templating instead of
composing each one.

## 2. Decide what the panels say

Interview. The question is not "which screens do you want to show" but "what does someone have to
believe to install this".

- Order by persuasion, not by app navigation. Panel one carries the single strongest reason.
- One idea per panel. A panel making two points makes neither.
- The first two or three are doing almost all the work. Spend the effort there.
- Objections are content. If the obvious hesitation is privacy, price or effort, answer it in a
  panel rather than hoping nobody thinks of it.

Write the caption list and get agreement on it before designing anything.

## 3. Plan the capture

State plainly which screens you can capture yourself and which you cannot, then capture your half.

**You can capture:** anything reachable on a simulator or emulator from a clean install.

```
xcrun simctl list devices booted
xcrun simctl io <udid> screenshot screen.png
```

The simulator for a 6.9" iPhone outputs 1320x2868 natively, which is already the required App
Store size. It also outputs **with an alpha channel**, and stores reject alpha. Rendering through
the template fixes that automatically, since the panel background is opaque. Never upload a raw
simulator capture.

**You cannot capture** a screen that needs real content, a purchased entitlement, granted
permissions, or hardware the simulator lacks. Name each one and why, and ask the user to capture
those on a real device. Real content also simply looks better than seeded data, so for
content-driven apps the user's own device is worth preferring even where a simulator would work.

Never fake a screen. A mocked-up interface presented as the product is the one thing here that is
not a style choice.

## 4. Ask about app previews

Apple allows up to 3 video previews per locale, 15 to 30 seconds. Ask whether they want them, and
be honest that this is the fiddliest part of the job.

```
xcrun simctl io <udid> recordVideo --codec h264 preview.mov
```

Conform it to the spec in `data/devices.json` (886x1920 for the 6.9" iPhone class, H.264, 30fps
ceiling, 500MB ceiling) with ffmpeg. Previews must show actual app footage: Apple rejects
previews that are mostly title cards or marketing animation.

Uploading previews through `deliver` is unreliable in practice. Expect to upload them through
App Store Connect or Transporter, and say so rather than promising an automated path.

## 5. Three layouts, then signoff

Do not render 96 images in a direction the user has not seen. Build three genuinely different
layouts, render each with real copy and a real screen, and have them pick.

The three families worth offering, unless the brief points elsewhere:

- **Flat panel.** Caption on top, device below, solid or gradient ground. Reads clearly at
  thumbnail size, which is where most people see it. The safest and often the right answer.
- **Angled float.** Device rotated and bled off the edge, sometimes overlapping panels. More
  energy, more brand, slightly less legible at thumbnail size.
- **Continuous bleed.** One image or scene running across all panels so the set reads as a strip
  when swiped. Striking on the listing page, and it fails badly if a store ever shows the panels
  out of order or in isolation. Use `{{index}}` and `{{total}}` in the template to offset the
  background per panel.

They must differ structurally, not by accent colour. Everything comes from the project's design
system: the palette, the display face, the illustration style if one is recorded.

Record the chosen layout in `DESIGN.md` so the next release matches without re-litigating it.

## 6. Write the captions

Caption budget is 6 words, and it gates. These are billboards read in about a second.

- Say what the app does for the person, not what the feature is called.
- No invented metrics, no fabricated testimonials, no star ratings you did not earn, no fake
  award badges. All of these are hard rule violations and some are grounds for rejection.
- No device chrome drawn in the caption zone pretending to be UI.
- A sub-caption is optional and usually unnecessary. If the caption needs a sub-caption to make
  sense, the caption is wrong.

## 7. Translate

Translate into every locale, matching the tone of any store metadata the project already has.
**Say clearly in the report that translations are machine-generated and have not had a native
speaker on them**, so the user can decide what to have reviewed.

German, Finnish and Russian run far longer than English; Arabic, Hebrew and Farsi are
right-to-left. The renderer sets `dir` automatically for RTL locales and flags any caption much
longer than the reference locale. That flag is a hint to look, not proof of a problem. Open the
flagged images.

Build the layout so a long translation grows the caption block and pushes the rest down. A fixed
caption box with hidden overflow silently clips a language you do not read, which is the worst
possible failure.

## 8. Render and verify

```
node $S/shots.mjs render --template <layout.html> --data <captions.json> --out fastlane/screenshots
node $S/shots.mjs verify fastlane/screenshots --platform ios --device iphone-6.9
```

`render` substitutes `{{caption}}`, `{{sub}}`, `{{screen}}`, `{{index}}`, `{{total}}`, `{{locale}}`,
`{{dir}}`, `{{w}}` and `{{h}}`, renders at exact store dimensions, and fails loudly on a wrong
size or a stray alpha channel. `verify` re-checks a finished directory against the count, format
and size rules before upload.

Then look at the images. Verification proves they are uploadable, not that they are any good.
Check a sample at thumbnail size, since that is how they will actually be seen, and check every
locale you cannot read for text that has collided or clipped.

## 9. Upload

Output goes to `fastlane/screenshots/<locale>/`, in sorted filename order, which is the order the
listing shows. `deliver` uploads from there.

Uploading changes a public store listing, so **get explicit approval before running it**, and say
what will change. Getting the images correct is your job; publishing them is the user's call.
