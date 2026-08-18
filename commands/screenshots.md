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

## 5. Brand it from the app it belongs to

These panels are the product's own advertising, so they must look like the product. Never render
them in a generic style.

Take the brand from `.mikedesign/DESIGN.md` when the project has one. When it does not, the app
itself is the source of truth and you should read it rather than ask:

- **iOS:** the asset catalog. `Assets.xcassets/**/*.colorset/Contents.json` holds real accent,
  background and semantic colours with their light and dark variants, and `AppIcon.appiconset`
  holds the mark.
- **Android:** `res/values/colors.xml` and the theme.
- **Web or cross-platform:** the token file, theme object, or stylesheet the app actually ships.

Show the user what you extracted and confirm it before rendering. If the app's accent happens to
sit in a banned range, that is fine: it is the declared brand, so record it in the `DESIGN.md`
palette and the rule goes quiet. That is the override working as designed, not a reason to change
the brand.

Match the existing listing too, if there is one. A new set that looks nothing like the panels
currently on the store makes the app look like it changed hands.

## 6. Device frames

Keep the frame simple: a subtle bezel and the screen. Do not build a photorealistic handset with
rim highlights, glare, buttons or a drawn camera bump. That reads as a stock device mockup rather
than as design, and it pulls attention away from the screen, which is the only part that matters.

The one thing that must be exact is the corner.

**A phone screen corner is a superellipse, not a circle.** Fitted against the vendor's own vector
artwork, the iPhone measures an exponent of **2.9** in `|x|^n + |y|^n = 1`.

**CSS `corner-shape` takes log2 of that, not the exponent itself.** `round` is `superellipse(1)`
and `squircle` is `superellipse(2)`, so 2.9 becomes `superellipse(1.536)`. Passing 2.9 straight
through asks for an exponent of 2^2.9 and draws a nearly square corner. Get both numbers from the
measurement, never from memory:

```
node $S/device-mask.mjs list
node $S/device-mask.mjs "iPhone 17 Pro Max"
#   corner extent: 255.49px = 85.2pt  (ratio 0.1936 of width)
#   corner curve:  |x|^n + |y|^n = 1 with n=2.9
#   CSS:           corner-shape: superellipse(1.536)
```

`shots.mjs` runs that automatically and hands the template `{{cornerRatio}}` and `{{cornerN}}`, so
the CSS is just:

```css
--r: calc((var(--w) - 2 * var(--bezel)) * {{cornerRatio}});
border-radius: calc(var(--r) + var(--bezel));
corner-shape: superellipse({{cornerN}});
```

The bezel is padding, and the outer radius is the screen radius plus that padding. Where
`corner-shape` is unsupported it degrades to a circle of the correct size: wrong through the
middle of the curve, right at both ends, and far better than a guessed radius.

Three traps, all of which have already been hit:

- **Clip the screen with `overflow: hidden` on the frame.** An SVG `clip-path` silently failed to
  apply here and left square-cornered screens sitting on a rounded bezel. It was invisible in a
  downscaled review and obvious at 1:1.
- **Inspect corners at 1:1 before reporting.** A dark screen on a dark bezel hides this class of
  defect completely at review size. Crop the corner and look at actual pixels.
- **A simulator capture already contains the Dynamic Island**, drawn black in the status bar. Draw
  another and you get two.

## 7. Three layouts, then signoff

Do not render 96 images in a direction the user has not seen. Build three genuinely different
layouts, render each with real copy and a real screen, and have them pick.

Send the three as rendered images rather than a live page. Store panels are fixed-size assets and
a browser that reflows them is showing something the store will never display, so this is the one
place in the skill where the image is the honest medium and a URL is not.
[../core/showing.md](../core/showing.md) covers why, and how to gate on it.

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

## 8. Write the captions

Caption budget is 6 words, and it gates. These are billboards read in about a second.

- Say what the app does for the person, not what the feature is called.
- No invented metrics, no fabricated testimonials, no star ratings you did not earn, no fake
  award badges. All of these are hard rule violations and some are grounds for rejection.
- No device chrome drawn in the caption zone pretending to be UI.
- A sub-caption is optional and usually unnecessary. If the caption needs a sub-caption to make
  sense, the caption is wrong.

## 9. Translate

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

## 10. Render and verify

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

## 11. Upload

Output goes to `fastlane/screenshots/<locale>/`, in sorted filename order, which is the order the
listing shows. `deliver` uploads from there.

Uploading changes a public store listing, so **get explicit approval before running it**, and say
what will change. Getting the images correct is your job; publishing them is the user's call.
