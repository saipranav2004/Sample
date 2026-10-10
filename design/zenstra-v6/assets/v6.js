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
    e.preventDefault(); closeAll(); scrollToEl(t); history.replaceState(null, '', url.hash);
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
    p.addEventListener('mouseenter', function () { if (!narrow() && !p.classList.contains('on')) selectProduct(p, true); });
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
    if (location.hash) { var hp = document.getElementById(location.hash.slice(1)); if (hp && hp.matches('.prod')) selectProduct(hp, true); }
  }

  /* ---------------- Decision path: pinned horizontal scroll ---------------- */
  /* ---------------- Decision engine: the perimeter ----------------
   * Four rings around a protected core: identity, intent, policy, record.
   * One tool call comes in from outside and stops at each gate; policy closes
   * its gate and the call never reaches the core. Every visual is a pure
   * function of scroll progress, so scrolling back plays it in reverse.
   */
  $$('[data-engine]').forEach(function (sec) {
    var pin = $('.eng-pin', sec), iso = $('[data-perimeter]', sec); if (!pin || !iso) return;
    var steps = $$('.eng-steps li', sec), ds = $$('.eng-d', sec), labs = $$('.elab', sec);
    var svg = $('.eng-lines', sec), stage = $('.eng-stage', sec), orb = $('.orb:not(.ev)', sec), ev = $('.orb.ev', sec);
    var core = $('.core', sec), coreTag = $('.core-tag', sec), mStart = $('.m-start', sec), mCore = $('.m-core', sec);
    var clock = $('[data-ms]', sec), clockBox = $('.eng-clock', sec), sum = $('[data-sum]', sec), ticks = $('.eng-ticks', sec), orbLabel = $('span', orb);
    var on = function () { return !REDUCE && getComputedStyle(pin).display !== 'none'; };
    var NS = 'http://www.w3.org/2000/svg';
    var RAD = [238, 182, 128, 80], STEP = 24, GATE = 200 * Math.PI / 180, GAP = 0.2, LINKS = 28;
    var mk = function (tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
    var arc = function (r, a0, a1) { var x0 = r + Math.cos(a0) * r, y0 = r + Math.sin(a0) * r, x1 = r + Math.cos(a1) * r, y1 = r + Math.sin(a1) * r; return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + ((a1 - a0) % 6.2832 > Math.PI ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2); };
    // Build the rings, outermost first so the DOM order matches the labels.
    var rings = RAD.map(function (R, i) {
      var el = document.createElement('div'); el.className = 'ring';
      el.style.cssText = 'left:' + -R + 'px;top:' + -R + 'px;width:' + 2 * R + 'px;height:' + 2 * R + 'px';
      var sv = mk('svg', { viewBox: '0 0 ' + 2 * R + ' ' + 2 * R, 'aria-hidden': 'true' }, el), r = R - 2, g = mk('g', { transform: 'translate(2 2)' }, sv);
      var ring = { el: el, R: R };
      if (i < 3) mk('path', { class: 'base', d: arc(r, GATE + GAP / 2, GATE - GAP / 2 + 6.2832) }, g);
      for (var k = 0; k < 72; k++) { if (k % 6) continue; var ta = k / 72 * 6.2832; mk('path', { class: 'tick', d: 'M' + (r + Math.cos(ta) * (r - 8)).toFixed(1) + ' ' + (r + Math.sin(ta) * (r - 8)).toFixed(1) + ' L' + (r + Math.cos(ta) * (r - 3)).toFixed(1) + ' ' + (r + Math.sin(ta) * (r - 3)).toFixed(1) }, g); }
      if (i === 0) { ring.scan = mk('path', { class: 'scan', d: arc(r, 0, 0.9) }, g); ring.scanG = ring.scan; }
      if (i === 1) { ring.a = mk('path', { class: 'cmp a', d: arc(r - 9, GATE + 0.3, GATE + 1.3) }, g); ring.b = mk('path', { class: 'cmp b', d: arc(r - 15, GATE + 0.3, GATE + 1.3) }, g); }
      if (i === 2) ring.door = mk('path', { class: 'door', d: arc(r, GATE - GAP / 2 - 0.02, GATE + GAP / 2 + 0.02) }, g);
      if (i === 3) { ring.links = []; for (var j = 0; j < LINKS; j++) { var a0 = GATE + j / LINKS * 6.2832 + 0.03; ring.links.push(mk('path', { class: 'link', d: arc(r, a0, a0 + 6.2832 / LINKS - 0.06) }, g)); } }
      iso.insertBefore(el, core);
      return ring;
    });
    var P = 0, D = -1, raf = 0, vis = false;
    var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
    var seg = function (p, a, b) { return clamp((p - a) / (b - a)); };
    var io3 = function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    var oc = function (k) { return 1 - Math.pow(1 - k, 3); };
    var STEPS = [[0.14, 0.34], [0.34, 0.54], [0.54, 0.74], [0.74, 0.94]];
    var MS = [0, 2.1, 6.8, 14.0, 18.0];
    var RUN = ['checking key', 'comparing task', 'evaluating POL-114', 'writing entry'];
    var DONE = [['verified', 'ok'], ['mismatch', 'warn'], ['blocked', 'bad'], ['chained · SIEM', 'rec']];
    var paths = []; for (var i = 0; i < 5; i++) paths.push(mk('path', i === 4 ? { class: 'route' } : {}, svg));
    var setCls = function (el, name, v) { if (el.classList.contains(name) !== v) el.classList.toggle(name, v); };
    var place = function (el, r, z) { el.style.setProperty('--x', (Math.cos(GATE) * r).toFixed(1) + 'px'); el.style.setProperty('--y', (Math.sin(GATE) * r).toFixed(1) + 'px'); el.style.setProperty('--z', z.toFixed(1) + 'px'); };

    function render(p) {
      // 1. A flat target rises into stepped terraces around the core.
      var e = io3(seg(p, 0.0, 0.12)), zOf = function (i) { return i * STEP * e; };
      rings.forEach(function (rg, i) { rg.el.style.setProperty('--z', zOf(i).toFixed(1) + 'px'); });
      var coreZ = zOf(4) - STEP * 0.4 * e; core.style.setProperty('--cz', coreZ.toFixed(1) + 'px');
      coreTag.style.setProperty('--z', (coreZ + 25).toFixed(1) + 'px');
      place(mStart, 300, 0); mCore.style.setProperty('--z', (coreZ + 25).toFixed(1) + 'px');
      labs.forEach(function (l) { l.style.setProperty('--lo', seg(p, 0.05, 0.12).toFixed(3)); });

      // 2. Which check is running, and how far along it is.
      var act = -1, sp = 0;
      STEPS.forEach(function (r, i) { if (p >= r[0]) { act = i; sp = seg(p, r[0], r[1]); } });
      var shown = Math.max(0, act);
      steps.forEach(function (li, i) {
        setCls(li, 'on', i === act); setCls(li, 'done', i < act);
        setCls(li, 'warn', i === 1 && (i < act || (i === act && sp > 0.75))); setCls(li, 'bad', i === 2 && (i < act || (i === act && sp > 0.45)));
        $('b', li).style.transform = 'scaleX(' + (i < act ? 1 : i === act ? sp : 0).toFixed(3) + ')';
      });
      ds.forEach(function (d, i) {
        setCls(d, 'on', i === shown);
        var k = i === act ? sp : i < act ? 1 : 0;
        $$('.row', d).forEach(function (r, j) { setCls(r, 'on', k > 0.12 + j * 0.17); });
      });
      labs.forEach(function (l, i) {
        var st = i < act || (i === act && sp > 0.8) ? 'done' : i === act ? 'run' : 'wait';
        var txt = st === 'done' ? DONE[i][0] : st === 'run' ? RUN[i] : 'waiting', span = $('span', l);
        if (span.textContent !== txt) span.textContent = txt;
        setCls(l, 'on', i === act); ['ok', 'warn', 'bad', 'rec'].forEach(function (c) { setCls(l, c, st === 'done' && DONE[i][1] === c); });
      });

      // 3. Each ring does its own work.
      var s0 = seg(p, 0.16, 0.31), s1 = seg(p, 0.37, 0.5), s2 = seg(p, 0.59, 0.66), s3 = seg(p, 0.77, 0.9);
      var r0 = rings[0], r1 = rings[1], r2 = rings[2], r3 = rings[3];
      r0.scan.setAttribute('transform', 'rotate(' + (GATE * 180 / Math.PI + s0 * 540).toFixed(1) + ' ' + (r0.R - 2) + ' ' + (r0.R - 2) + ')');
      r0.scan.style.opacity = s0 > 0 && s0 < 1 ? 1 : 0;
      r1.a.style.opacity = r1.b.style.opacity = s1 > 0 ? 1 : 0;
      r1.b.setAttribute('transform', 'rotate(' + (io3(s1) * 64).toFixed(1) + ' ' + (r1.R - 2) + ' ' + (r1.R - 2) + ')');
      r2.door.setAttribute('transform', 'rotate(' + ((1 - io3(s2)) * -38).toFixed(1) + ' ' + (r2.R - 2) + ' ' + (r2.R - 2) + ')');
      r2.door.style.opacity = s2 > 0 ? 1 : 0;
      var lit = Math.round(io3(s3) * LINKS); r3.links.forEach(function (l, j) { setCls(l, 'on', j < lit); });
      rings.forEach(function (rg, i) {
        var st = i < act || (i === act && sp > 0.8) ? DONE[i][1] : i === act ? 'run' : '';
        if (i === 2 && act === 2 && s2 > 0.5) st = 'bad';
        setCls(rg.el, 'on', st === 'run'); setCls(rg.el, 'ok', st === 'ok'); setCls(rg.el, 'warn', st === 'warn'); setCls(rg.el, 'bad', st === 'bad'); setCls(rg.el, 'rec', st === 'rec');
      });
      var safe = p >= 0.86; setCls(core, 'safe', safe); setCls(coreTag, 'safe', safe);
      var tag = safe ? 'untouched' : p >= 0.62 ? 'never reached' : 'protected', small = $('small', coreTag); if (small.textContent !== tag) small.textContent = tag;

      // 4. The call stops at each gate and is turned back at policy; the evidence goes to the record ring.
      var gateR = function (i) { return RAD[i] + 16; };
      var rr = 300 - (300 - gateR(0)) * oc(seg(p, 0.07, 0.16)), zz = zOf(0);
      var m1 = io3(seg(p, 0.31, 0.37)); rr += (gateR(1) - gateR(0)) * m1; zz += (zOf(1) - zOf(0)) * m1;
      var m2 = io3(seg(p, 0.51, 0.57)); rr += (gateR(2) - gateR(1)) * m2; zz += (zOf(2) - zOf(1)) * m2;
      var bump = seg(p, 0.6, 0.68); rr += Math.sin(bump * Math.PI) * 22 + bump * 10;
      place(orb, rr, zz + 10); orb.style.setProperty('--oo', seg(p, 0.06, 0.1).toFixed(3));
      var blocked = p >= 0.62; setCls(orb, 'bad', blocked);
      var ol = blocked ? 'email.send · blocked' : 'email.send'; if (orbLabel.textContent !== ol) orbLabel.textContent = ol;
      var evk = io3(seg(p, 0.74, 0.8));
      place(ev, gateR(2) - 10 + (RAD[3] - gateR(2) + 10) * evk, zOf(2) + (zOf(3) - zOf(2)) * evk + 8);
      ev.style.setProperty('--oo', (evk > 0 ? Math.min(1, evk * 4) * (1 - seg(p, 0.86, 0.92)) : 0).toFixed(3));

      // 5. Clock, summary and progress ruler.
      var ms = 0; STEPS.forEach(function (r, i) { if (p >= r[0]) ms = MS[i] + (MS[i + 1] - MS[i]) * oc(seg(p, r[0], r[0] + (r[1] - r[0]) * 0.8)); });
      clock.textContent = ms.toFixed(1); setCls(clockBox, 'bad', p >= 0.62 && p < 0.74);
      var sm = p >= 0.9 ? 'Blocked at 14 ms · recorded at 18 ms' : p >= 0.62 ? 'Blocked before the email was sent' : 'Decision time';
      if (sum.textContent !== sm) sum.textContent = sm;
      $('i', ticks).style.setProperty('--p', p.toFixed(3));

      // 6. Callouts from each ring to its label, and the route the call takes.
      var sr = stage.getBoundingClientRect(), W = sr.width, H = sr.height, used = [];
      rings.forEach(function (rg, i) {
        var r = rg.el.getBoundingClientRect(), ax = r.right - sr.left, ay = r.top + r.height / 2 - sr.top;
        var ly = Math.max(10, Math.min(H - 70, ay - 14 - (3 - i) * 26));
        used.forEach(function (u) { if (Math.abs(ly - u) < 46) ly = u + 46; }); used.push(ly);
        labs[i].style.top = ly.toFixed(1) + 'px';
        var lx = W - 168 - 14, x1 = Math.min(ax + 4, lx - 30);
        paths[i].setAttribute('d', 'M' + x1.toFixed(1) + ' ' + ay.toFixed(1) + ' L' + (lx - 18).toFixed(1) + ' ' + ay.toFixed(1) + ' L' + (lx - 4).toFixed(1) + ' ' + (ly + 14).toFixed(1));
        paths[i].style.opacity = seg(p, 0.05, 0.12); setCls(paths[i], 'on', i === act);
      });
      var a = mStart.getBoundingClientRect(), c = mCore.getBoundingClientRect();
      paths[4].setAttribute('d', 'M' + (a.left - sr.left).toFixed(1) + ' ' + (a.top - sr.top).toFixed(1) + ' L' + (c.left - sr.left).toFixed(1) + ' ' + (c.top - sr.top).toFixed(1));
      paths[4].style.opacity = (0.8 * seg(p, 0.05, 0.12)).toFixed(3);
    }
    function target() { var r = sec.getBoundingClientRect(), total = sec.offsetHeight - innerHeight; return clamp(-r.top / Math.max(1, total)); }
    function loop() {
      P = target(); if (D < 0) D = P;
      D += (P - D) * 0.2; if (Math.abs(P - D) < 0.0004) D = P;
      render(D);
      raf = vis ? requestAnimationFrame(loop) : 0;
    }
    function size() {
      if (!on()) { sec.style.height = ''; return; }
      sec.style.height = Math.round(innerHeight * 4.8) + 'px';
      render(D < 0 ? target() : D);
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting && on(); if (vis && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: '200px' }).observe(sec);
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

  window.__v6ok = true;
  runIntro();
})();
