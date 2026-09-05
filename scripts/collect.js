/*
 * mikedesign rendered-state collector.
 *
 * Runs INSIDE the page. Read this file and pass its contents verbatim as the
 * expression to a browser javascript evaluation tool, then save the returned
 * JSON to a file and hand that file to lint.mjs --rendered <file>.
 *
 * Why rendered and not source: computed style is the only place the truth about
 * colour, typeface and shadow actually lives. A regex over source has to
 * understand Tailwind, CSS variables, styled-components, CSS modules and theme
 * objects, and silently understands none of them on a project it has not seen.
 * getComputedStyle understands all of them by construction.
 *
 * The output is deliberately filtered: an element is kept only if it carries its
 * own text or has a non-default value on a watched property. On a real page that
 * is a few hundred elements rather than tens of thousands.
 */
(() => {
  const WATCH = [
    ['color', 'color'],
    ['backgroundColor', 'background-color'],
    ['backgroundImage', 'background-image'],
    ['webkitBackgroundClip', '-webkit-background-clip'],
    ['backdropFilter', 'backdrop-filter'],
    ['boxShadow', 'box-shadow'],
    ['fontFamily', 'font-family'],
    ['fontSize', 'font-size'],
    ['fontWeight', 'font-weight'],
    ['textTransform', 'text-transform'],
    ['borderRadius', 'border-radius'],
    ['filter', 'filter'],
    ['borderTopColor', 'border-top-color'],
    ['borderLeftWidth', 'border-left-width'],
    ['fill', 'fill'],
    ['transitionProperty', 'transition-property'],
  ];

  const DEFAULTISH = {
    backgroundColor: ['rgba(0, 0, 0, 0)', 'transparent'],
    backgroundImage: ['none'],
    webkitBackgroundClip: ['border-box'],
    backdropFilter: ['none'],
    boxShadow: ['none'],
    filter: ['none'],
    textTransform: ['none'],
    borderRadius: ['0px'],
    borderLeftWidth: ['0px'],
    fill: ['none', 'rgb(0, 0, 0)'],
    transitionProperty: ['all', 'none'],
  };

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', 'TITLE', 'NOSCRIPT', 'BR', 'PATH',
    'DEFS', 'CLIPPATH', 'LINEARGRADIENT', 'STOP', 'USE', 'G', 'CIRCLE', 'RECT',
  ]);

  const CONTROL_TAGS = new Set(['BUTTON', 'SELECT', 'SUMMARY']);
  const MAX_ELEMENTS = 1200;

  // Own text only: text in this element's direct text nodes, not descendants.
  // Without this every ancestor inherits its children's copy and word budgets
  // fire on the <body>.
  const px = (v) => parseFloat(String(v || '')) || 16;

  const ownText = (el) => {
    let out = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) out += n.nodeValue;
    }
    return out.replace(/\s+/g, ' ').trim();
  };

  const isControl = (el) => {
    if (CONTROL_TAGS.has(el.tagName)) return true;
    if (el.tagName === 'INPUT' && /^(submit|button|reset)$/i.test(el.type || '')) return true;
    if (el.getAttribute && el.getAttribute('role') === 'button') return true;
    if (el.tagName === 'A') {
      const c = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '';
      if (/\b(btn|button|cta)\b/i.test(String(c))) return true;
    }
    return false;
  };

  const isHeadline = (el) => el.tagName === 'H1' || el.tagName === 'H2';

  const roleOf = (el, text) => {
    const explicit = el.getAttribute && el.getAttribute('data-role');
    if (explicit) return explicit;
    if (isControl(el)) return 'control';
    if (isHeadline(el)) return 'headline';
    if (/^H[3-6]$/.test(el.tagName)) return 'item';
    // A subhead is the deck under the PAGE headline, so only an h1 creates one.
    // Keying off h2 as well made the first paragraph of every section a subhead
    // and held ordinary body copy to the subhead ceiling.
    const prev = el.previousElementSibling;
    if (prev && prev.tagName === 'H1' && text && text.split(/\s+/).length <= 40) return 'subhead';
    if (el.tagName === 'P' || el.tagName === 'LI') return 'body';
    return 'other';
  };

  // Signature for repeat detection: shape, not content. Two cards built the same
  // way produce the same string regardless of what they say.
  const sig = (el) => {
    const kids = Array.from(el.children).map((c) => c.tagName).join('>');
    const depth = el.querySelectorAll('*').length;
    return el.tagName + '|' + kids + '|' + Math.min(depth, 12);
  };

  const focusable = (el) =>
    isControl(el) ||
    el.tagName === 'A' ||
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    (el.hasAttribute && el.hasAttribute('tabindex'));

  /*
   * Eyebrow geometry.
   *
   * An eyebrow is a visual relationship, not a DOM one: a short line of small
   * type sitting immediately above a much larger heading. Keying off
   * nextElementSibling caught only the naive markup and missed every eyebrow
   * wrapped in its own div, which is how component libraries emit them. So this
   * measures the rendered stack instead: any heading whose top edge sits just
   * below this element's bottom edge, sharing a left edge or a centre line, set
   * meaningfully larger. Structure-independent by construction, which is the
   * same reason the rest of this file reads computed style rather than source.
   */
  const HEADINGS = [];
  if (document.body) {
    for (const h of document.body.querySelectorAll('h1, h2, h3')) {
      const r = h.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const hs = window.getComputedStyle(h);
      if (hs.display === 'none' || hs.visibility === 'hidden') continue;
      HEADINGS.push({
        el: h,
        rect: r,
        size: parseFloat(hs.fontSize) || 16,
        text: (h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      });
    }
  }

  const MAX_GAP = 48;    // px between the two boxes. Wider than this and they read as separate blocks.
  const ALIGN_TOL = 10;  // px of slop on the shared left edge or shared centre.
  const MIN_RATIO = 1.4; // heading must be this much larger, or the two are peers rather than label and heading.

  const eyebrowTarget = (el, rect, size) => {
    if (!rect || rect.height === 0) return null;
    if (/^H[1-6]$/.test(el.tagName)) return null;
    // A call to action above a heading is a button, not an eyebrow. Without this
    // the fixture's own CTA matched the geometry and was silenced only by the
    // link exemption, which is the wrong reason to let something through.
    if (isControl(el)) return null;
    let best = null;
    for (const h of HEADINGS) {
      if (h.el === el || el.contains(h.el) || h.el.contains(el)) continue;
      const gap = h.rect.top - rect.bottom;
      if (gap < -2 || gap > MAX_GAP) continue;
      if (h.size < size * MIN_RATIO) continue;
      const sharesLeft = Math.abs(h.rect.left - rect.left) <= ALIGN_TOL;
      const sharesCentre = Math.abs((h.rect.left + h.rect.width / 2) - (rect.left + rect.width / 2)) <= ALIGN_TOL;
      if (!sharesLeft && !sharesCentre) continue;
      if (!best || gap < best.gap) best = { gap: Math.round(gap), text: h.text, ratio: +(h.size / size).toFixed(2) };
    }
    return best;
  };

  // Structural exemptions, resolved here where the DOM is available rather than
  // guessed from text later. A category or a date earns its place above a
  // heading when it is real navigation or real metadata; the same word set as
  // inert decoration does not.
  // "It is a link" is only a defence if the link has a destination. An anchor
  // pointing at "#" is decoration wearing a tag.
  const realLink = (el) => {
    const a = el.tagName === 'A' ? el : (el.querySelector ? el.querySelector('a') : null);
    if (!a) return false;
    const href = a.getAttribute('href') || '';
    return !!href && href !== '#' && !/^javascript:/i.test(href);
  };

  const inBreadcrumb = (el) => {
    let n = el;
    for (let d = 0; n && d < 6; d++, n = n.parentElement) {
      if (n.tagName === 'NAV') return true;
      const al = n.getAttribute && n.getAttribute('aria-label');
      if (al && /breadcrumb/i.test(al)) return true;
      const c = n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className;
      if (/breadcrumb/i.test(String(c || ''))) return true;
    }
    return false;
  };

  const all = document.body ? document.body.querySelectorAll('*') : [];
  const elements = [];
  let scanned = 0;
  let skippedInvisible = 0;

  for (const el of all) {
    if (SKIP_TAGS.has(el.tagName)) continue;
    scanned++;
    if (elements.length >= MAX_ELEMENTS) break;

    const rect = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || (rect.width === 0 && rect.height === 0)) {
      skippedInvisible++;
      continue;
    }

    const styles = {};
    let interesting = false;
    for (const [key, prop] of WATCH) {
      const v = cs.getPropertyValue(prop);
      styles[key] = v;
      const defaults = DEFAULTISH[key];
      if (defaults && !defaults.includes(v.trim())) interesting = true;
    }

    const text = ownText(el);
    if (!text && !interesting) continue;

    const prev = el.previousElementSibling;
    const next = el.nextElementSibling;
    const cls = el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className;

    elements.push({
      i: elements.length,
      tag: el.tagName,
      cls: String(cls || '').slice(0, 120),
      id: el.id || '',
      text: text.slice(0, 400),
      role: roleOf(el, text),
      styles,
      prevTag: prev ? prev.tagName : '',
      nextTag: next ? next.tagName : '',
      nextIsHeadline: !!(next && (next.tagName === 'H1' || next.tagName === 'H2')),
      above: eyebrowTarget(el, rect, px(cs.fontSize)),
      isLink: realLink(el),
      inBreadcrumb: inBreadcrumb(el),
      timeTag: el.tagName === 'TIME' || !!(el.querySelector && el.querySelector('time')),
      parentTag: el.parentElement ? el.parentElement.tagName : '',
      parentSig: el.parentElement ? sig(el.parentElement) : '',
      sig: sig(el),
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      focusable: focusable(el),
      childCount: el.children.length,
    });
  }

  const bodyStyle = document.body ? window.getComputedStyle(document.body) : null;

  // window.innerWidth reads 0 in some embedded execution contexts even though
  // the page has laid out normally, so fall back to what the document reports
  // before concluding that geometry is untrustworthy.
  const vw = window.innerWidth ||
    (document.documentElement && document.documentElement.clientWidth) ||
    (document.body && Math.round(document.body.getBoundingClientRect().width)) || 0;
  const vh = window.innerHeight ||
    (document.documentElement && document.documentElement.clientHeight) || 0;

  const payload = {
    ok: true,
    collector: 'mikedesign/1',
    url: location.href,
    title: document.title || '',
    viewport: { w: vw, h: vh },
    pageBackground: bodyStyle ? bodyStyle.backgroundColor : '',
    pageColor: bodyStyle ? bodyStyle.color : '',
    coverage: {
      scanned,
      kept: elements.length,
      skippedInvisible,
      truncated: elements.length >= MAX_ELEMENTS,
    },
    elements,
  };

  // The collector posts its own result to the sink rather than returning it.
  // A real page fills this with a thousand elements, and routing that back
  // through an agent's context to be retyped into a file is both enormous and
  // lossy. Browser to disk, directly.
  const sink = window.__mikedesignSink || 'http://127.0.0.1:8900/';
  const summary = {
    collector: 'mikedesign/1',
    url: payload.url,
    elements: elements.length,
    viewport: payload.viewport,
    sink,
  };

  return fetch(sink, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  })
    .then((r) => ({ ...summary, posted: r.status }))
    .catch((e) => ({ ...summary, posted: null, error: `sink unreachable: ${e.message}. Start scripts/sink.mjs first.` }));
})()
