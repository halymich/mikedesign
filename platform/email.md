# Email

Load this when the target is an email: transactional (receipts, alerts, password resets), lifecycle
(onboarding, win-back), or a newsletter. It loads on top of
[../core/craft-floor.md](../core/craft-floor.md) and [../core/joint-brief.md](../core/joint-brief.md).
It replaces [../core/ui.md](../core/ui.md) for email: tap response, layout shift and bundle weight
mean nothing in an inbox, so `measure.mjs` does not run on email.

The failure this prevents: an email that is lovely in the browser it was built in and broken in
the client where the reader opens it. The reader never sees your browser. They see Gmail on a
phone, a work Outlook, or the Apple Mail preview pane, each with its own idea of what CSS is.

## What is different about email

Everything below is a fact about email clients, and these facts change. None of it is stored as
a list in this skill. Look it up each run.

- **The renderers are many and uneven.** Support for HTML and CSS varies by client and by
  platform inside a client (Outlook on Windows is not Outlook on a phone). A property that
  works everywhere on the web may fail in the one client your reader uses.
- **Images are often off by default,** and a design that depends on an image to be understood
  is blank until the reader taps. Webfonts usually do not load.
- **Dark mode recolours your email,** sometimes by inverting, sometimes by leaving it alone.
  A logo drawn for a light background can vanish.
- **A message can be clipped or truncated** by the client past a size threshold, and the
  footer, the unsubscribe link and the legal text are what disappear.
- **The inbox shows the sender, subject and preview text before the email opens.** For most
  readers that is the whole email, and it is the first thing to design.

## Setting the target

Declare the target in `DESIGN.md` with `"platform": "email"`, the clients that matter to this
product's readers, and the components available (usually a table-based layout, a button, a
footer block). Choose the clients from evidence: the product's own sending provider or
analytics may report opens by client. If there is no evidence, ask the owner who the readers are
and record the assumption. Do not default to the clients that happen to be famous.

## Checking support, live

```
node $S/email-check.mjs <email.html> --clients <family,family> [--verbose]
```

Name the clients that matter to this email's readers: the feed covers dozens, many of them small regional webmail, and checking all of them (`--all`) makes almost every email fail. An unknown client name is no verdict. It reads the email, finds every HTML and CSS feature it uses, and looks each one up in the
public support data at caniemail.com, fetched fresh on every run. It reports what is
unsupported in the clients you named, what works only with caveats, and basic accessibility
gaps (no language, no title, images with no alt text). Exit 1 means something is unsupported
or missing, exit 2 means no verdict was possible. Exit 2 is not a pass.

Read the output as a design input, not a gate. An unsupported feature is fine when the email
degrades into something equally good (a rounded corner falls back to a square one). It is not
fine when the feature carries meaning: the layout collapses, the button vanishes, the text is
unreadable. Name each such case in the report with what the reader sees instead.

Anything the script reports as "no data" is checked by hand against the sources below.

## Checking the render, by looking

The script reports support. It does not render. Look at the email the way the reader will, in the
browser tool, on a page that contains only the email, at:

1. **Phone width and desktop width.** Narrow enough to be a real phone. Read the text at the size
   it will have.
2. **Dark mode.** Emulate dark colour scheme and look at the logo, the borders and the text
   contrast.
3. **Images off.** Block or remove images and look again. The message, the key number and the
   main action must all still be understood, with the alt text standing in.
4. **Plain text.** Every email also ships a plain-text version. Read it. If it makes no sense,
   the readers who get it are lost, and so is spam filtering.

For real clients, send a test only when the owner asks for it, to an address they name. A
real inbox is the only honest test of Gmail or Outlook. Without one, the report says which
clients were judged from support data alone and not seen.

Sources to check live, when the script lacks data or a client needs a closer look: the
caniemail.com feature pages, each client's own developer documentation, and the sending
provider's guidance. Do not rely on memory of any of them.

## Designing it

- **Subject, preheader and sender name are the first design,** written together with the body
  in the joint brief, before layout. mikecopy owns their word counts.
- **One job per email.** The reader opens a transactional email to find out what happened and
  what to do. Whatever does not serve that comes out. The deletion test in the joint brief
  applies hardest here.
- **The key fact leads, and it is text,** not an image of text.
- **One primary action,** as a real link or bulletproof button, with a visible label that names
  the action. Everything else is a plain text link or absent.
- **The footer carries its obligations:** why they got it, how to manage or stop it, and any
  legal line the product requires, in readable size. It must survive clipping, so keep the
  message short enough that it does.
- **Build with the constraint, not against it.** Prefer the structures that the support data
  shows are safe, put styles inline where the data says a style block is stripped, and let
  progressive enhancement add polish for clients that can show it.
- **Brand lives in precise details,** the same as any `operate` surface: the one real logo, a
  restrained palette, the right typeface from what is available, honest spacing. An email does
  not need to look like the website to look like the same company.

## Reporting

In addition to the standard report: the clients you checked and how (support data, a render, a
real send), the features the script flagged and what you did about each, and what the email looks
like with images off and in dark mode.
