/* Zenstra v5 interactions and text motion. */
(function () {
  'use strict';
  var root = document.documentElement, body = document.body;
  var REDUCE = root.classList.contains('reduce');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var FX = window.ZX6 || null;
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

  // Runs fn at most once per frame on scroll, and only while el is near the viewport.
  function onScrollFrame(el, fn) {
    var near = true, queued = false;
    var run = function () { queued = false; if (near) fn(); };
    var ask = function () { if (!queued) { queued = true; requestAnimationFrame(run); } };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { near = es[0].isIntersecting; if (near) ask(); }, { rootMargin: '200px 0px' }).observe(el);
    window.addEventListener('scroll', ask, { passive: true }); window.addEventListener('resize', ask); fn();
  }

  /* ---------------- Smooth scroll ---------------- */
  var lenis = null;
  if (!REDUCE && window.Lenis) {
    lenis = new Lenis({ duration: 1.1, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
    (window.ZX = window.ZX || {}).lenis = lenis;
    var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  }
  var scrollToEl = function (el) { if (lenis) lenis.scrollTo(el, { offset: -90 }); else el.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' }); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="#"]'); if (!a) return;
    var url = new URL(a.href, location.href); if (url.pathname !== location.pathname || url.hash.length < 2) return;
    var t = document.getElementById(url.hash.slice(1)); if (!t) return;
    e.preventDefault(); closeAll(); scrollToEl(t.matches('.prod') ? t.parentElement : t); history.replaceState(null, '', url.hash);
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
    var b = $('.dd-btn', d), tm, hoverAt = 0;
    var set = function (on) { d.classList.toggle('open', on); b.setAttribute('aria-expanded', String(on)); };
    b.addEventListener('click', function () { var open = d.classList.contains('open'); if (open && performance.now() - hoverAt < 600) return; set(!open); });
    d.addEventListener('mouseenter', function () { clearTimeout(tm); if (!d.classList.contains('open')) hoverAt = performance.now(); set(true); });
    d.addEventListener('mouseleave', function () { tm = setTimeout(function () { set(false); }, 180); });
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.dd')) dds.forEach(function (d) { d.classList.remove('open'); $('.dd-btn', d).setAttribute('aria-expanded', 'false'); }); });
  var menuBtn = $('.menu-btn');
  function toggleMenu(open) { body.classList.toggle('menu-open', open); menuBtn.setAttribute('aria-expanded', String(open)); if (lenis) open ? lenis.stop() : lenis.start(); }
  if (menuBtn) menuBtn.addEventListener('click', function () { toggleMenu(!body.classList.contains('menu-open')); });
  // Escape closes menus and returns focus to the control that opened them.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openDd = $('.dd.open'), inMenu = body.classList.contains('menu-open');
    closeAll();
    if (openDd) $('.dd-btn', openDd).focus(); else if (inMenu) { var mb = $('.menu-btn'); if (mb) mb.focus(); }
  });

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
      heroStream = FX.AgentLens(h, { mask: m, cx: +h.getAttribute('data-cx') || 0.66, cy: +h.getAttribute('data-cy') || 0.5 });
      onTheme.push(heroStream.theme);
    });
    $$('.cta .stream').forEach(function (h) { ctaStreams.push(FX.GateStream(h, { gate: 0.76, dark: true, density: 0.8 })); });
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
    if (!h) { scope.classList.add('hero-ready'); runPack(); return; }
    wait(REDUCE ? 0 : 150).then(function () { return scanReveal(h); }).then(function () {
      scope.classList.add('hero-ready');
      $$('[data-switch]').forEach(switcher);
      
      runPack();
    });
  }

  /* ---------------- Intro ----------------
     Timing measured from go.ai: the line drops in blurred (~0.45 s), each word
     holds ~0.7 s, swaps take ~0.38 s, then the whole line gives way to the
     Zenstra logo the same way before the screen opens. */
  function runIntro() {
    var intro = $('.intro');
    if (!intro || !root.classList.contains('intro-play')) { startHero(); return; }
    try { sessionStorage.setItem('zx6-intro', '1'); } catch (e) {}
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
      field.open(m.x, m.y, Math.max(16, m.s * 0.9), fast ? 900 : 1150).then(finish);
      setTimeout(startHero, fast ? 200 : 380);
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

    // 1. "Zenstra for workflow security" ripples in, letter by letter.
    var fl = letters(forEl, forEl.textContent), cur = swapSlot(word, words[0]), all = fl.concat([null]).concat($$('.l', cur));
    var k = 0;
    all.forEach(function (l) { if (!l) { k += 2; return; } l.style.opacity = 0; anim(l, [{ transform: 'translateY(-0.45em)', filter: 'blur(12px)', opacity: 0 }, { transform: 'translateY(0)', filter: 'blur(0)', opacity: 1 }], { duration: 560, delay: 160 + k * 12, easing: DROP }); k++; });
    var seq = wait(160 + k * 12 + 560 + 520).then(function () { all.forEach(function (l) { if (l) l.style.opacity = ''; }); });
    // 2. cloud security, then EDR.
    words.slice(1).forEach(function (w, i) {
      seq = seq.then(function () { if (!done) return swapTo(word, w); })
        .then(function () { if (!done) return wait(i === words.length - 2 ? 700 : 600); });
    });
    // 3. The line sinks away, the logo arrives, every agent converges into the mark, the page opens through it.
    seq.then(function () {
      if (done) return;
      lettersOut($$('.l', line), { dur: 340, stag: 9, dist: '0.42em', blur: '10px' });
      setTimeout(toLogo, 160);
      return wait(160 + 300);
    }).then(function () {
      if (done) return;
      if (!field) return wait(600);
      var m = mark();
      return field.converge(m.x, m.y, 720).then(function () { return wait(60); });
    }).then(function () { if (!done) { done = true; reveal(false); } });
  }

  /* ---------------- Products ---------------- */
  var prods = $$('.prod'), vizzes = [], prodIdx = 0, prodTimer = null, prodBar = null, prodUser = false, prodVis = false;
  var narrow = function () { return matchMedia('(max-width: 1000px)').matches; };
  prods.forEach(function (p) {
    var host = $('.viz', p), kind = p.getAttribute('data-viz'), v = null;
    if (FX && host) v = kind === 'workflow' ? FX.WorkflowViz(host) : kind === 'cloud' ? FX.CloudViz(host) : FX.EdrViz(host);
    vizzes.push(v);
    p.addEventListener('click', function (e) { if (e.target.closest('a')) return; selectProduct(p, true); });
    p.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) { e.preventDefault(); selectProduct(p, true); } });
    // Hover intent: only a pointer that rests on a panel opens it, so sweeping across them does not.
    var hover = 0;
    p.addEventListener('mouseenter', function () { clearTimeout(hover); if (!narrow() && !p.classList.contains('on')) hover = setTimeout(function () { selectProduct(p, true); }, 160); });
    p.addEventListener('mouseleave', function () { clearTimeout(hover); });
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
    // Canvases keep the width of an open panel; closed panels show part of it.
    var sizeViz = function () { var gap = 12 * (prods.length - 1), w = (wrapP.clientWidth - gap) * 2.6 / (2.6 + prods.length - 1); wrapP.style.setProperty('--prod-w', narrow() ? '100%' : Math.round(w) + 'px'); };
    sizeViz();
    selectProduct(prods[0]);
    window.addEventListener('resize', function () { sizeViz(); selectProduct(prods[prodIdx]); });
    if (location.hash) { var hp = document.getElementById(location.hash.slice(1)); if (hp && hp.matches('.prod')) selectProduct(hp, true); }
  }

  /* ---------------- Product page hero visual ---------------- */
  $$('[data-pviz]').forEach(function (h) {
    var k = h.getAttribute('data-pviz');
    if (FX) (k === 'workflow' ? FX.WorkflowViz : k === 'cloud' ? FX.CloudViz : FX.EdrViz)(h);
  });

  /* ---------------- Arriving on a #section from another page ----------------
   * The browser's own jump puts the target under the fixed header (and, for a
   * product, cuts its panel off). Land it just below the header instead.
   */
  (function () {
    var t = location.hash.length > 1 && document.getElementById(location.hash.slice(1)); if (!t) return;
    var el = t.matches('.prod') ? t.parentElement : t;
    // Layout position, not getBoundingClientRect: reveal transforms would skew it.
    var docTop = function (n) { var y = 0; while (n) { y += n.offsetTop; n = n.offsetParent; } return y; };
    // Native scroll: Lenis ignores jumps requested before it has measured the page, and follows native scrolls.
    var land = function () { window.scrollTo(0, Math.max(0, docTop(el) - (head ? head.offsetHeight : 70) - 24)); };
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    land(); window.addEventListener('load', function () { requestAnimationFrame(land); });
  })();

  /* ---------------- Decision section: the inline module ----------------
   * assets/checks3d.js draws the module in WebGL; it is loaded only when the
   * section comes near. This pins the section and turns scroll into progress
   * for the 3D scene, the step list, the copy and the counter. Every state is
   * a function of progress, so scrolling back plays it in reverse. Without
   * WebGL, or on small screens or with reduced motion, the cards show instead.
   */
  $$('[data-engine]').forEach(function (sec) {
    var pin = $('.eng-pin', sec), host = $('[data-checks3d]', sec); if (!pin || !host) return;
    var steps = $$('.eng-steps li', sec), ds = $$('.eng-d', sec), stopped = $('[data-stopped]', sec), sum = $('[data-sum]', sec), ticks = $('.eng-ticks i', sec), hud = $('.eng-hud', sec);
    var on = function () { return !REDUCE && !sec.classList.contains('no3d') && getComputedStyle(pin).display !== 'none'; };
    // Shared with checks3d.js: when each beat of the story happens.
    var TL = { intro: [0, 0.08], enter: [0.08, 0.2], stages: [0.2, 0.35, 0.5, 0.65], stageLen: 0.15, hitAt: 0.09, outcome: [0.8, 0.9], fail: [0.9, 1] };
    var PANELS = [0, 0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 1.0001];
    var HITS = TL.stages.map(function (s) { return s + TL.hitAt; });
    var scene = null, loading = false, P = 0, D = -1, raf = 0, vis = false, lastT = 0;
    var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
    var seg = function (p, a, b) { return clamp((p - a) / (b - a)); };
    var setCls = function (el, name, v) { if (el.classList.contains(name) !== v) el.classList.toggle(name, v); };
    function fallback() { sec.classList.add('no3d'); sec.style.height = ''; }
    function load() {
      if (loading || !on()) return; loading = true;
      import(new URL(host.getAttribute('data-src'), document.baseURI).href).then(function (mod) {
        scene = mod.create(host, { timeline: TL });
        if (!scene) return fallback();
        onTheme.push(scene.theme); scene.set(D < 0 ? target() : D); scene.setActive(vis);
      }).catch(fallback);
    }
    function render(p) {
      if (scene) scene.set(p);
      var cur = 0; for (var i = 0; i < PANELS.length - 1; i++) if (p >= PANELS[i]) cur = i;
      var sp = seg(p, PANELS[cur], PANELS[cur + 1]);
      ds.forEach(function (d, i) {
        setCls(d, 'on', i === cur);
        var k = i === cur ? sp : i < cur ? 1 : 0;
        $$('.row', d).forEach(function (r, j) { setCls(r, 'on', k > 0.08 + j * 0.12); });
      });
      steps.forEach(function (li, i) {
        var act = cur - 2, after = cur >= 6;
        setCls(li, 'on', i === act); setCls(li, 'done', i < act || after);
        setCls(li, 'caught', p >= HITS[i]);
        $('b', li).style.transform = 'scaleX(' + (i < act || after ? 1 : i === act ? sp : 0).toFixed(3) + ')';
      });
      var n = HITS.filter(function (h) { return p >= h; }).length;
      if (stopped.textContent !== String(n)) stopped.textContent = n;
      setCls(stopped.parentNode, 'done', n === 4);
      var sm = p >= TL.fail[0] ? 'fail-closed · nothing passes' : n === 4 ? '0 reached your systems · all recorded' : '0 reached your systems';
      if (sum.textContent !== sm) sum.textContent = sm;
      if (ticks) ticks.style.setProperty('--p', p.toFixed(3));
      setCls(hud, 'in', p > 0.08);
    }
    function target() { var r = sec.getBoundingClientRect(), total = sec.offsetHeight - innerHeight; return clamp(-r.top / Math.max(1, total)); }
    function loop() {
      // Ease towards the scroll position at the same speed at any frame rate.
      var now = performance.now(), dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016; lastT = now;
      P = target(); if (D < 0) D = P;
      D += (P - D) * (1 - Math.exp(-dt * 10)); if (Math.abs(P - D) < 0.0003) D = P;
      render(D); sec.__p = D;
      raf = vis ? requestAnimationFrame(loop) : (lastT = 0);
    }
    function size() {
      if (!on()) { sec.style.height = ''; if (scene) scene.setActive(false); return; }
      sec.style.height = Math.round(innerHeight * 8) + 'px';
      render(D < 0 ? target() : D);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { if (es[0].isIntersecting) load(); }, { rootMargin: '150% 0px' }).observe(sec);
      new IntersectionObserver(function (es) { vis = es[0].isIntersecting && on(); if (scene) scene.setActive(vis); if (vis && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: '100px' }).observe(sec);
    } else fallback();
    window.addEventListener('resize', size);
    window.addEventListener('load', size);
    size();
  });

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
      t.addEventListener('keydown', function (e) { var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); var n = (idx + d + tabs.length) % tabs.length; go(n, true); tabs[n].focus(); } });
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis && !user) go(idx); else clearTimeout(timer); }, { threshold: 0.35 }).observe(sec);
    go(0);
    if (!REDUCE && frame) {
      var tilt = function () { var r = frame.getBoundingClientRect(), k = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.75))); frame.style.transform = 'rotateX(' + ((1 - k) * 14).toFixed(2) + 'deg) scale(' + (0.94 + k * 0.06).toFixed(3) + ')'; };
      onScrollFrame(frame, tilt);
    }
  });

  /* ---------------- Agenda line ---------------- */
  $$('[data-agenda]').forEach(function (list) {
    var line = $('.prog', list), items = $$('li', list); if (!line) return;
    var upd = function () {
      var r = list.getBoundingClientRect(), k = REDUCE ? 1 : Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height));
      var lit = items.map(function (li) { return REDUCE || li.getBoundingClientRect().top < innerHeight * 0.7; });
      line.style.transform = 'scaleY(' + k.toFixed(3) + ')'; items.forEach(function (li, i) { li.classList.toggle('lit', lit[i]); });
    };
    onScrollFrame(list, upd);
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

  /* ---------------- Legal contents: mark the section being read ---------------- */
  $$('.legal-toc').forEach(function (toc) {
    var links = $$('ol a', toc), secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var upd = function () {
      var cur = 0, line = innerHeight * 0.3;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < line) cur = i; });
      links.forEach(function (a, i) { if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    };
    onScrollFrame(toc.parentElement, upd);
  });

  window.__v6ok = true;
  runIntro();
})();
