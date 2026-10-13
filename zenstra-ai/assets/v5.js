/* Zenstra v5 interactions and text motion. */
(function () {
  'use strict';
  var root = document.documentElement, body = document.body;
  var REDUCE = root.classList.contains('reduce');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var FX = window.ZX5 || null;
  var EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var anim = function (el, kf, o) { return el && el.animate ? el.animate(kf, Object.assign({ fill: 'both', easing: EASE }, o)) : null; };
  var isDark = function () { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  var onTheme = [];

  /* ---------------- Theme ---------------- */
  $$('[data-theme-toggle]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      var next = isDark() ? 'light' : 'dark';
      var apply = function () { root.setAttribute('data-theme', next); try { localStorage.setItem('zx-theme', next); } catch (e) {} onTheme.forEach(function (f) { f(); }); };
      if (!document.startViewTransition || REDUCE) { apply(); return; }
      // Circular reveal from the toggle
      var r0 = b.getBoundingClientRect();
      var x = e.clientX || r0.left + r0.width / 2, y = e.clientY || r0.top + r0.height / 2;
      var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.classList.add('vt');
      var vt = document.startViewTransition(apply);
      vt.finished.finally(function () { root.classList.remove('vt'); });
      vt.ready.then(function () {
        root.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(function () {});
    });
  });

  /* ---------------- Smooth scroll ---------------- */
  var lenis = null;
  if (!REDUCE && window.Lenis) {
    lenis = new Lenis({ duration: 1.1, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
    var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  }
  // Going down the page the header slides away, so land on the target itself (a
  // padded section needs no gap); going up it stays, so leave room under it.
  var scrollToEl = function (el) {
    var top = el.getBoundingClientRect().top + window.scrollY, down = top > window.scrollY && top > 480;
    var gap = down ? (parseFloat(getComputedStyle(el).paddingTop) >= 24 ? 0 : 24) : 90, y = Math.max(0, top - gap);
    if (lenis) lenis.scrollTo(y); else window.scrollTo({ top: y, behavior: REDUCE ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="#"]'); if (!a) return;
    var url = new URL(a.href, location.href); if (url.pathname !== location.pathname || url.hash.length < 2) return;
    var t = document.getElementById(url.hash.slice(1)); if (!t) return;
    e.preventDefault(); closeAll(); scrollToEl(t); history.replaceState(null, '', url.hash);
    if (t.classList.contains('prod')) { t.click(); window.dispatchEvent(new Event('zx:prodlink')); }
    if (t.matches('.prod')) selectProduct(t, true);
  });

  /* ---------------- Header, dropdown, menu ---------------- */
  var head = $('.head'), lastY = 0;
  var onScroll = function () {
    var y = window.scrollY; head.classList.toggle('scrolled', y > 8);
    if (!body.classList.contains('menu-open') && !$('.dd.open')) head.classList.toggle('hide', y > lastY && y > 480);
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var dds = $$('.dd');
  function closeAll() { dds.forEach(function (d) { d.classList.remove('open'); $('.dd-btn', d).setAttribute('aria-expanded', 'false'); }); if (body.classList.contains('menu-open')) toggleMenu(false); }
  dds.forEach(function (d) {
    var b = $('.dd-btn', d), tm, byHover = false;
    var set = function (on) { d.classList.toggle('open', on); b.setAttribute('aria-expanded', String(on)); if (!on) byHover = false; };
    // A click on a menu the pointer already opened keeps it open: the user is
    // reaching for it, not dismissing it. Keyboard and touch toggle as usual.
    b.addEventListener('click', function () { var open = d.classList.contains('open'); if (open && byHover) { byHover = false; return; } set(!open); });
    d.addEventListener('mouseenter', function () { clearTimeout(tm); if (!d.classList.contains('open')) { set(true); byHover = true; } });
    d.addEventListener('mouseleave', function () { tm = setTimeout(function () { set(false); }, 180); });
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.dd')) dds.forEach(function (d) { d.classList.remove('open'); $('.dd-btn', d).setAttribute('aria-expanded', 'false'); }); });
  var menuBtn = $('.menu-btn');
  function toggleMenu(open) { body.classList.toggle('menu-open', open); menuBtn.setAttribute('aria-expanded', String(open)); if (lenis) open ? lenis.stop() : lenis.start(); }
  if (menuBtn) menuBtn.addEventListener('click', function () { toggleMenu(!body.classList.contains('menu-open')); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });

  /* ---------------- Text: word swap (after go.ai's intro) ----------------
     The outgoing word sinks and blurs away while the next word drops in from
     above and sharpens, both at once. The slot eases to the new word's width,
     so a centred line re-centres smoothly instead of jumping. */
  var DROP = 'cubic-bezier(0.22, 1, 0.36, 1)';
  // Words are split into letters so each swap ripples across the word.
  function letters(el, text) {
    el.textContent = '';
    for (var k = 0; k < text.length; k++) { var l = document.createElement('span'); l.className = 'l'; l.textContent = text[k]; el.appendChild(l); }
    return $$('.l', el);
  }
  function swapSlot(slot, first) {
    slot.classList.add('swap'); slot.textContent = '';
    var cur = document.createElement('span'); cur.className = 'sw'; letters(cur, first); slot.appendChild(cur);
    return cur;
  }
  var OUT = 'cubic-bezier(0.55, 0, 0.75, 0.3)';
  function lettersIn(ls, o) {
    var last = null;
    ls.forEach(function (l, k) { last = anim(l, [{ transform: 'translateY(-' + o.dist + ')', filter: 'blur(' + o.blur + ')', opacity: 0 }, { transform: 'translateY(0)', filter: 'blur(0)', opacity: 1 }], { duration: o.dur, delay: (o.delay || 0) + k * o.stag, easing: DROP }); });
    return last;
  }
  function lettersOut(ls, o) {
    var last = null;
    ls.forEach(function (l, k) { last = anim(l, [{ transform: 'translateY(0)', filter: 'blur(0)', opacity: 1 }, { transform: 'translateY(' + o.dist + ')', filter: 'blur(' + o.blur + ')', opacity: 0 }], { duration: o.dur, delay: k * o.stag, easing: OUT }); });
    return last;
  }
  function swapTo(slot, text, opts) {
    opts = opts || {};
    var cur = slot.querySelector('.sw:not(.out)');
    if (REDUCE) { if (cur) letters(cur, text); slot.style.width = ''; return Promise.resolve(); }
    var nxt = document.createElement('span'); nxt.className = 'sw in'; var nl = letters(nxt, text); slot.appendChild(nxt);
    nl.forEach(function (l) { l.style.opacity = 0; });
    var from = cur ? cur.getBoundingClientRect().width : 0, to = nxt.getBoundingClientRect().width;
    var d = opts.dur || 420, stag = opts.stag != null ? opts.stag : 14, dist = opts.dist || '0.42em', blur = opts.blur || '10px';
    slot.style.width = from + 'px';
    void slot.offsetWidth;
    slot.style.transition = 'width ' + (opts.widthMs || 520) + 'ms ' + DROP;
    slot.style.width = to + 'px';
    if (cur) {
      cur.classList.add('out');
      var o = lettersOut($$('.l', cur), { dur: d * 0.7, stag: stag * 0.6, dist: dist, blur: blur });
      if (o) o.onfinish = function () { cur.remove(); }; else cur.remove();
    }
    var i = lettersIn(nl, { dur: d, stag: stag, dist: dist, blur: blur, delay: 60 });
    return new Promise(function (res) {
      var finish = function () { nxt.classList.remove('in'); nl.forEach(function (l) { l.style.opacity = ''; }); slot.style.transition = ''; slot.style.width = ''; res(); };
      if (i) i.onfinish = finish; else finish();
    });
  }

  /* Rotating product line under the hero headline */
  function switcher(el) {
    var words = el.getAttribute('data-switch').split('|'), i = 0;
    swapSlot(el, words[0]);
    if (REDUCE) return;
    setInterval(function () { if (document.hidden) return; i = (i + 1) % words.length; swapTo(el, words[i], { dist: '0.5em', blur: '8px', stag: 12 }); }, 2800);
  }

  /* ---------------- Text: scan-line reveal ---------------- */
  function scanReveal(h) {
    var lines = $$('.scanline', h);
    if (REDUCE || !lines.length) { h.classList.add('scanned'); return Promise.resolve(); }
    return new Promise(function (resolve) {
      lines.forEach(function (ln, i) {
        var inner = $('.in', ln), bar = $('.bar', ln), w = inner.getBoundingClientRect().width;
        var d = 1000, delay = i * 340;
        anim(inner, [{ clipPath: 'inset(-10% 100% -10% 0)' }, { clipPath: 'inset(-10% 0% -10% 0)' }], { duration: d, delay: delay, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
        anim(bar, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(' + w + 'px)', opacity: 1, offset: 0.92 }, { transform: 'translateX(' + (w + 6) + 'px)', opacity: 0 }], { duration: d + 120, delay: delay, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
      });
      setTimeout(function () { h.classList.add('scanned'); resolve(); }, (lines.length - 1) * 340 + 1100);
    });
  }

  /* ---------------- Words that light up on view ---------------- */
  function splitWords(el) {
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) { if (!p) return; if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; } var s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s); });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    $$('.w', el).forEach(function (w, i) { w.style.transitionDelay = Math.min(i * 28, 1200) + 'ms'; });
  }

  /* ---------------- Reveals ---------------- */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -10% 0px' }) : null;
  $$('[data-reveal]').forEach(function (el) { var d = el.getAttribute('data-delay'); if (d) el.style.transitionDelay = d + 'ms'; if (io && !REDUCE) io.observe(el); else el.classList.add('in'); });
  $$('[data-words]').forEach(function (el) { splitWords(el); if (io && !REDUCE) io.observe(el); else el.classList.add('in'); });

  /* ---------------- Count-up and figures ---------------- */
  function countTo(el, to, dec, pre, suf, dur) {
    if (REDUCE) { el.textContent = pre + to.toFixed(dec) + suf; return; }
    var t0 = performance.now();
    var step = function (now) { var k = Math.min(1, (now - t0) / dur), v = to * (1 - Math.pow(1 - k, 4)); el.textContent = pre + v.toFixed(dec) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  var onView = function (el, fn, th) { if (REDUCE || !('IntersectionObserver' in window)) { fn(); return; } var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { o.disconnect(); fn(); } }, { threshold: th || 0.5 }); o.observe(el); };
  $$('[data-count]').forEach(function (el) {
    var raw = el.getAttribute('data-count'), to = parseFloat(raw), dec = (raw.split('.')[1] || '').length, pre = el.getAttribute('data-pre') || '', suf = el.getAttribute('data-suf') || '';
    if (!REDUCE) el.textContent = pre + (0).toFixed(dec) + suf;
    onView(el, function () { countTo(el, to, dec, pre, suf, 1500); });
  });
  $$('.fig').forEach(function (f) {
    var d = +f.getAttribute('data-delay') || 0;
    onView(f, function () { setTimeout(function () { f.classList.add('drawn'); }, REDUCE ? 0 : d + 150); });
  });

  /* ---------------- Hero ---------------- */
  var heroStream = null, ctaStreams = [];
  if (FX) {
    $$('.lens').forEach(function (h) {
      var sec = h.closest('section'), m = sec ? sec.querySelector('[data-lens-mask]') : null;
      heroStream = FX.LensField(h, { mask: m, cx: +h.getAttribute('data-cx') || 0.66, cy: +h.getAttribute('data-cy') || 0.5 });
      onTheme.push(heroStream.theme);
    });
    $$('.cta .stream').forEach(function (h) { ctaStreams.push(FX.GateStream(h, { gate: 0.76, dark: true, density: 0.8 })); });
  }
  var EVENTS = [
    ['block', 'Prompt injection blocked', 'member-chat-assist · kb.article #4471'],
    ['allow', 'Allowed within scope', 'loan-doc-classifier · los.read · 6 ms'],
    ['hold', 'Held for approval', 'sar-prep-agent · core.txn.query (90d)'],
    ['block', 'Policy enforced', 'n8n:card-dispute · write:core · denied'],
    ['allow', 'Agent identity verified', 'copilot-hr-assist · attested 2 ms ago'],
    ['block', 'Shadow agent contained', 'cursor · laptop-114 · unregistered MCP'],
    ['hold', 'Step-up requested', 'dev-agent-ci · shell.exec (prod)']
  ];
  var ICON = { block: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M4 12 12 4"/></svg>', hold: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 1.5"/></svg>', allow: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>' };
  function fillChip(c, e) { c.className = 'dchip ' + e[0] + (c.classList.contains('on') ? ' on' : ''); c.innerHTML = '<span class="ic">' + ICON[e[0]] + '</span><span><b>' + e[1] + '</b><small>' + e[2] + '</small></span>'; }
  function runChips() {
    var chips = $$('.dchip'); if (!chips.length) return;
    var k = 0;
    chips.forEach(function (c, i) { fillChip(c, EVENTS[k++ % EVENTS.length]); setTimeout(function () { c.classList.add('on'); }, REDUCE ? 0 : 300 + i * 450); });
    if (REDUCE) return;
    var j = 0;
    setInterval(function () {
      if (document.hidden) return;
      var c = chips[j % chips.length]; j++;
      c.classList.remove('on');
      setTimeout(function () { fillChip(c, EVENTS[k++ % EVENTS.length]); c.classList.add('on'); }, 650);
    }, 2600);
  }
  function runPack() {
    var pack = $('[data-pack]'); if (!pack) return;
    var rows = $$('.prow', pack), bar = $('.pack-foot .bar i', pack), label = $('.pack-foot span', pack);
    if (REDUCE) { rows.forEach(function (r) { r.classList.add('on'); }); pack.classList.add('done'); if (label) label.textContent = 'Generated'; return; }
    anim(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: rows.length * 650 + 300, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
    rows.forEach(function (r, i) {
      setTimeout(function () {
        r.classList.add('on');
        var p = $('path', r); if (p) { var L = p.getTotalLength(); p.style.strokeDasharray = L; anim(p, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 450 }); }
        var v = $('.v', r); if (v) anim(v, [{ opacity: 0, transform: 'translateX(6px)' }, { opacity: 1, transform: 'none' }], { duration: 500 });
      }, 250 + i * 650);
    });
    setTimeout(function () { pack.classList.add('done'); if (label) label.textContent = 'Generated'; }, 250 + rows.length * 650);
  }
  function startHero() {
    var h = $('[data-scan]');
    var scope = h ? (h.closest('section') || body) : body;
    if (!h) { scope.classList.add('hero-ready'); runChips(); runPack(); return; }
    wait(REDUCE ? 0 : 150).then(function () { return scanReveal(h); }).then(function () {
      scope.classList.add('hero-ready');
      $$('[data-switch]').forEach(switcher);
      runChips();
      runPack();
    });
  }

  /* ---------------- Intro ----------------
     Timing measured from go.ai: the lead words appear alone, the first word holds
     about 2 s, later words about 0.6 to 0.7 s, swaps take ~0.38 s, then the line
     gives way to the Zenstra logo before the screen opens. */
  function runIntro() {
    var intro = $('.intro');
    if (!intro || !root.classList.contains('intro-play')) { startHero(); return; }
    try { sessionStorage.setItem('zx5-intro', '1'); } catch (e) {}
    if (lenis) lenis.stop();
    var word = $('.intro-word', intro), line = $('.intro-line', intro), logo = $('.intro-logo', intro), forEl = $('.intro-for', intro);
    var words = word.getAttribute('data-words').split('|'), skip = $('.intro-skip', intro);
    var field = FX && FX.IntroField ? FX.IntroField(intro) : null;
    if (field) intro.classList.add('cv');
    var done = false, opened = false;
    var mark = function () { var m = $('.logo-mark .th-dark', logo) || $('.logo-mark', logo), r = m.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width / 2 }; };
    var finish = function () { root.classList.remove('intro-play'); if (lenis) lenis.start(); if (field) field.stop(); };
    var reveal = function (fast) {
      if (opened) return; opened = true;
      var m = mark();
      anim($('.logo-word', logo), [{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
      anim(skip, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      var lm = $('.logo-mark', logo);
      anim(lm, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.18)' }], { duration: 260, delay: 60, easing: 'ease-in' });
      if (!field) { var f = anim(intro, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 }); if (f) f.onfinish = finish; else finish(); startHero(); return; }
      var OPEN = fast ? 900 : 1800;
      field.open(m.x, m.y, Math.max(16, m.s * 0.9), OPEN).then(finish);
      // The page zooms in toward the viewer as the star window opens over it.
      if (!REDUCE) [$('.head'), $('main')].forEach(function (el) {
        if (!el) return; var r = el.getBoundingClientRect();
        el.style.transformOrigin = (m.x - r.left) + 'px ' + (m.y - r.top) + 'px';
        var z = anim(el, [{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: OPEN + 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        var clear = function () { el.style.transformOrigin = ''; };
        if (z) z.onfinish = clear; else clear();
      });
      setTimeout(startHero, fast ? 200 : 700);
    };
    var toLogo = function () {
      anim(logo, [{ opacity: 0, transform: 'translateY(-0.6em)', filter: 'blur(10px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }], { duration: 520, easing: DROP });
    };
    var open = function () {
      // Skip: go straight to the logo and open the page through it.
      if (done) return; done = true;
      anim(line, [{ opacity: getComputedStyle(line).opacity }, { opacity: 0 }], { duration: 180 });
      if (getComputedStyle(logo).opacity < 0.5) toLogo();
      setTimeout(function () { reveal(true); }, 260);
    };
    skip.addEventListener('click', open);
    intro.addEventListener('click', open);
    window.addEventListener('keydown', open, { once: true });

    // "Zenstra for workflow security" arrives as one line and holds the longest;
    // the next products move faster, then the line gives way to the logo.
    var HOLD_FIRST = 1950, HOLD_NEXT = [560, 680];
    var fl = letters(forEl, forEl.textContent), cur = swapSlot(word, words[0]), all = fl.concat($$('.l', cur));
    var k = 0;
    all.forEach(function (l) { l.style.opacity = 0; anim(l, [{ transform: 'translateY(-0.45em)', filter: 'blur(12px)', opacity: 0 }, { transform: 'translateY(0)', filter: 'blur(0)', opacity: 1 }], { duration: 560, delay: 160 + k * 8, easing: DROP }); k++; });
    var seq = wait(160 + k * 8 + 560 + HOLD_FIRST).then(function () { all.forEach(function (l) { l.style.opacity = ''; }); });
    // cloud security, then EDR, each for less time.
    words.slice(1).forEach(function (w, i) {
      seq = seq.then(function () { if (!done) return swapTo(word, w); })
        .then(function () { if (!done) return wait(HOLD_NEXT[i] || 600); });
    });
    // 4. The line sinks away, the logo arrives, every agent converges into the mark, the page opens through it.
    seq.then(function () {
      if (done) return;
      lettersOut($$('.l', line), { dur: 340, stag: 9, dist: '0.42em', blur: '10px' });
      setTimeout(toLogo, 160);
      return wait(160 + 300);
    }).then(function () {
      if (done) return;
      if (!field) return wait(600);
      var m = mark();
      return field.converge(m.x, m.y, 720).then(function () { return wait(380); });
    }).then(function () { if (!done) { done = true; reveal(false); } });
  }

  /* ---------------- Products ---------------- */
  var prods = $$('.prod'), vizzes = [], prodIdx = 0, prodTimer = null, prodBar = null, prodUser = false, prodVis = false;
  // After a link opens a panel, scrolling can slide another panel under a still pointer;
  // hover only switches panels once the pointer has really moved.
  var pointerMoved = true;
  document.addEventListener('mousemove', function () { pointerMoved = true; }, { passive: true });
  window.addEventListener('zx:prodlink', function () { pointerMoved = false; });
  var narrow = function () { return matchMedia('(max-width: 1000px)').matches; };
  prods.forEach(function (p) {
    var host = $('.viz', p), kind = p.getAttribute('data-viz'), v = null;
    if (FX && host) v = kind === 'workflow' ? FX.WorkflowViz(host) : kind === 'cloud' ? FX.CloudViz(host) : FX.EdrViz(host);
    vizzes.push(v);
    p.addEventListener('click', function (e) { if (e.target.closest('a')) return; selectProduct(p, true); });
    p.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) { e.preventDefault(); selectProduct(p, true); } });
    p.addEventListener('mouseenter', function () { if (pointerMoved && !narrow() && !p.classList.contains('on')) selectProduct(p, true); });
  });
  function selectProduct(p, user) {
    var i = prods.indexOf(p); if (i < 0) return;
    if (user) prodUser = true;
    prodIdx = i;
    prods.forEach(function (q, k) { q.classList.toggle('on', k === i); q.setAttribute('aria-expanded', String(k === i)); if (vizzes[k]) vizzes[k].setActive(narrow() || k === i); });
    if (prodBar) prodBar.cancel();
    clearTimeout(prodTimer);
    if (!REDUCE && !prodUser && prodVis && !narrow()) {
      prodBar = anim($('.timer', p), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 7000, easing: 'linear' });
      prodTimer = setTimeout(function () { selectProduct(prods[(prodIdx + 1) % prods.length]); }, 7000);
    }
  }
  if (prods.length) {
    var wrapP = prods[0].parentElement;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { prodVis = es[0].isIntersecting; if (prodVis && !prodUser) selectProduct(prods[prodIdx]); else clearTimeout(prodTimer); }, { threshold: 0.4 }).observe(wrapP);
    selectProduct(prods[0]);
    window.addEventListener('resize', function () { selectProduct(prods[prodIdx]); });
    if (location.hash) { var hp = document.getElementById(location.hash.slice(1)); if (hp && hp.matches('.prod')) { pointerMoved = false; selectProduct(hp, true); } }
  }

  /* ---------------- Console showcase ---------------- */
  $$('[data-show]').forEach(function (sec) {
    var tabs = $$('.show-tab', sec), slides = $$('.show-slide', sec), cap = $('[data-caption]', sec), scan = $('.show-scan', sec), frame = $('.show-frame', sec);
    var idx = 0, timer = null, bar = null, vis = false, user = false;
    var go = function (i, byUser) {
      if (byUser) user = true;
      idx = i;
      tabs.forEach(function (t, k) { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
      slides.forEach(function (s, k) { s.classList.toggle('on', k === i); });
      if (cap) cap.textContent = tabs[i].getAttribute('data-cap');
      if (!REDUCE && scan) anim(scan, [{ transform: 'translateY(0)' }, { transform: 'translateY(' + (frame.clientHeight + 160) + 'px)' }], { duration: 1100, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'none' });
      if (bar) bar.cancel(); clearTimeout(timer);
      if (!REDUCE && !user && vis) {
        bar = anim($('i', tabs[i]), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 6000, easing: 'linear' });
        timer = setTimeout(function () { go((idx + 1) % tabs.length); }, 6000);
      }
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { go(i, true); });
      t.addEventListener('keydown', function (e) { var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (d) { e.preventDefault(); var n = (idx + d + tabs.length) % tabs.length; go(n, true); tabs[n].focus(); } });
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis && !user) go(idx); else clearTimeout(timer); }, { threshold: 0.35 }).observe(sec);
    go(0);
    if (!REDUCE && frame) {
      var tilt = function () { var r = frame.getBoundingClientRect(), k = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.75))); frame.style.transform = 'rotateX(' + ((1 - k) * 14).toFixed(2) + 'deg) scale(' + (0.94 + k * 0.06).toFixed(3) + ')'; };
      window.addEventListener('scroll', tilt, { passive: true }); tilt();
    }
  });

  /* ---------------- Agenda line ---------------- */
  $$('[data-agenda]').forEach(function (list) {
    var line = $('.prog', list), items = $$('li', list); if (!line) return;
    var upd = function () { var r = list.getBoundingClientRect(), k = REDUCE ? 1 : Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height)); line.style.transform = 'scaleY(' + k.toFixed(3) + ')'; items.forEach(function (li) { var lr = li.getBoundingClientRect(); li.classList.toggle('lit', REDUCE || lr.top < innerHeight * 0.7); }); };
    window.addEventListener('scroll', upd, { passive: true }); upd();
  });

  /* ---------------- FAQ ---------------- */
  $$('.faq details').forEach(function (d) {
    var s = $('summary', d), a = $('.a', d);
    s.addEventListener('click', function (e) {
      if (REDUCE || !a) return; e.preventDefault();
      if (d.open) { var x = a.animate([{ height: a.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 380, easing: EASE }); x.onfinish = function () { d.open = false; }; }
      else { d.open = true; var h = a.offsetHeight; a.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 520, easing: EASE }); }
    });
  });

  /* ---------------- Forms ---------------- */
  var FREE = /@(gmail|yahoo|hotmail|outlook|icloud|aol|proton|protonmail|gmx|mail)\./i;
  $$('form[data-validate]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = null;
      $$('.field', form).forEach(function (f) {
        var inp = $('input:not([type=checkbox]):not([type=radio]), select, textarea', f), err = $('.err', f); if (!inp) return;
        var msg = '';
        if (inp.required && !inp.value.trim()) msg = 'Required.';
        else if (inp.type === 'email' && inp.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value)) msg = 'Enter an email like name@company.com.';
        else if (inp.type === 'email' && inp.hasAttribute('data-work') && FREE.test(inp.value)) msg = 'Use your work email so we can prepare for your environment.';
        f.classList.toggle('invalid', !!msg); if (err) err.textContent = msg; inp.setAttribute('aria-invalid', String(!!msg));
        if (msg && !first) first = inp;
      });
      $$('.consent', form).forEach(function (c) { var cb = $('input', c), bad = cb.required && !cb.checked; c.classList.toggle('invalid', bad); if (bad && !first) first = cb; });
      if (first) { first.focus(); return; }
      if (form.hasAttribute('data-send')) send(form); else done(form);
    });
  });

  // Delivered by FormSubmit (formsubmit.co): the form's action is the plain POST
  // fallback; with JavaScript the same address is called through its /ajax/ endpoint.
  // Nothing is stored in the browser. If delivery fails, the visitor gets a prefilled
  // email to send instead, so a request is never silently lost.
  var sending = false;
  function payload(form) {
    var d = {}, fd = new FormData(form);
    fd.forEach(function (v, k) { v = String(v).trim(); if (!v) return; d[k] = d[k] ? d[k] + ', ' + v : v; });
    return d;
  }
  function mailto(form, d) {
    var to = (form.getAttribute('action') || '').split('/').pop() || 'info@zenstra.ai';
    var lines = ['Name: ' + [d.first_name, d.last_name].filter(Boolean).join(' '), 'Work email: ' + (d.email || ''), 'Company: ' + (d.company || ''), 'Role: ' + (d.role || '')];
    return 'mailto:' + to + '?subject=' + encodeURIComponent('Demo request · ' + (d.company || 'zenstra.ai')) + '&body=' + encodeURIComponent(lines.join('\n'));
  }
  function send(form) {
    if (sending) return;
    var d = payload(form), status = $('[data-status]', form), btn = $('button[type=submit]', form), label = btn ? btn.innerHTML : '';
    if (d._honey) { done(form); return; }
    delete d._honey;
    sending = true; form.setAttribute('aria-busy', 'true'); if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    if (status) { status.hidden = true; status.className = 'form-status'; }
    var url = (form.getAttribute('action') || '').replace('formsubmit.co/', 'formsubmit.co/ajax/');
    var ctl = 'AbortController' in window ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(d), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) { if (res.ok && (res.j.success === true || res.j.success === 'true')) done(form); else fail(form, d); })
      .catch(function () { fail(form, d); })
      .then(function () { clearTimeout(timer); sending = false; form.removeAttribute('aria-busy'); if (btn) { btn.disabled = false; btn.innerHTML = label; } });
  }
  function fail(form, d) {
    var status = $('[data-status]', form); if (!status) return;
    var to = (form.getAttribute('action') || '').split('/').pop() || 'info@zenstra.ai';
    status.className = 'form-status err'; status.hidden = false;
    status.innerHTML = '<b>Your request did not go through.</b>Nothing was lost: send it as an email instead, already filled in for you, or write to <a href="mailto:' + to + '">' + to + '</a>.<br><a class="btn secondary" data-mail>Email the request</a>';
    $('[data-mail]', status).setAttribute('href', mailto(form, d));
    status.tabIndex = -1; status.focus();
  }
  function done(form) {
    var ok = form.parentElement.querySelector('[data-success]'); if (!ok) return;
    var d = payload(form), val = function (k) { return d[k] || ''; };
    form.hidden = true; ok.hidden = false;
    // The card: a summary of exactly what was sent.
    $$('[data-sum]', ok).forEach(function (el) { var k = el.getAttribute('data-sum'); el.textContent = k === 'name' ? [val('first_name'), val('last_name')].join(' ').trim() : val(k); });
    // The left column: from "what the session is" to "what happens next".
    var page = form.closest('main') || document, before = $('[data-before]', page), next = $('[data-next]', page);
    $$('[data-who]', page).forEach(function (el) { el.textContent = val('first_name'); });
    var now = new Date(), when = $('[data-when]', page);
    if (when) { when.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); when.setAttribute('datetime', now.toISOString()); }
    if (before && next) {
      before.hidden = true; next.hidden = false;
      if (!REDUCE) {
        anim(next, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: EASE });
        $$('.track li, .prep, .wait', next).forEach(function (el, i) { anim(el, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 180 + i * 110, easing: EASE, fill: 'both' }); });
      }
    }
    if (!REDUCE) {
      anim(ok, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 700 });
      var path = $('.check path', ok); if (path) { var L = path.getTotalLength(); path.style.strokeDasharray = L; anim(path, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 700, delay: 200 }); }
    }
    // Bring the confirmation into view (on phones the form sits below the fold) and move focus to it.
    var target = next && !next.hidden ? next : ok, head = next && !next.hidden ? $('.next-h', next) : $('h2, h3', ok);
    if (lenis) lenis.scrollTo(target, { offset: -110 }); else target.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
    if (head) { head.tabIndex = -1; head.focus({ preventScroll: true }); }
  }
  // "Edit and send again": back to the filled-in form; nothing was lost.
  $$('[data-edit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var ok = btn.closest('[data-success]'), form = ok && ok.parentElement.querySelector('form'); if (!form) return;
      var page = form.closest('main') || document, before = $('[data-before]', page), next = $('[data-next]', page);
      ok.hidden = true; form.hidden = false; if (next) next.hidden = true; if (before) before.hidden = false;
      var email = $('input[type=email]', form); if (email) { email.focus(); email.select(); }
    });
  });
  // Preparation checklist: a live count, nothing stored.
  $$('.prep').forEach(function (box) {
    var boxes = $$('[data-prep]', box), out = $('[data-prep-count]', box);
    var upd = function () { var n = boxes.filter(function (b) { return b.checked; }).length; if (out) { out.textContent = n === boxes.length ? 'Ready for your session' : n + ' of ' + boxes.length + ' ready'; out.classList.toggle('all', n === boxes.length); } };
    boxes.forEach(function (b) { b.addEventListener('change', upd); }); upd();
  });


  /* ---------------- Legal pages: mark the section being read ---------------- */
  $$('.legal-toc').forEach(function (toc) {
    var links = $$('ol a', toc), secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var queued = false;
    var upd = function () {
      queued = false;
      var cur = 0, line = innerHeight * 0.3;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < line) cur = i; });
      links.forEach(function (a, i) { if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    };
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  });

  window.__v5ok = true;
  runIntro();
})();
