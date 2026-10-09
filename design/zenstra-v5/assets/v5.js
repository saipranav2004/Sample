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
    b.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      var apply = function () { root.setAttribute('data-theme', next); try { localStorage.setItem('zx-theme', next); } catch (e) {} onTheme.forEach(function (f) { f(); }); };
      if (document.startViewTransition && !REDUCE) document.startViewTransition(apply); else apply();
    });
  });

  /* ---------------- Smooth scroll ---------------- */
  var lenis = null;
  if (!REDUCE && window.Lenis) {
    lenis = new Lenis({ duration: 1.1, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
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

  /* ---------------- Text: scramble ---------------- */
  var GLYPHS = '01<>/\\=+*#_-:;[]{}';
  function scramble(el, text, dur) {
    return new Promise(function (resolve) {
      if (REDUCE) { el.textContent = text; resolve(); return; }
      var t0 = performance.now(), n = text.length;
      var step = function (now) {
        var k = Math.min(1, (now - t0) / dur), done = Math.floor(k * n), out = text.slice(0, done), tail = '';
        for (var i = done; i < Math.min(n, done + 6); i++) tail += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        el.innerHTML = '';
        el.appendChild(document.createTextNode(out));
        if (tail) { var s = document.createElement('span'); s.className = 'gl'; s.textContent = tail; el.appendChild(s); }
        if (k < 1) requestAnimationFrame(step); else { el.textContent = text; resolve(); }
      };
      requestAnimationFrame(step);
    });
  }
  function unscramble(el, dur) {
    return new Promise(function (resolve) {
      var text = el.textContent; if (REDUCE || !text) { resolve(); return; }
      var t0 = performance.now(), n = text.length;
      var step = function (now) {
        var k = Math.min(1, (now - t0) / dur), keep = Math.ceil((1 - k) * n), tail = '';
        for (var i = keep; i < Math.min(n, keep + 4); i++) tail += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        el.innerHTML = ''; el.appendChild(document.createTextNode(text.slice(0, keep)));
        if (tail && k < 1) { var s = document.createElement('span'); s.className = 'gl'; s.textContent = tail; el.appendChild(s); }
        if (k < 1) requestAnimationFrame(step); else { el.textContent = ''; resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  /* Rotating product word (decode) */
  function switcher(el) {
    var words = el.getAttribute('data-switch').split('|'), i = 0, live = $('.sr-only', el.parentElement);
    el.textContent = words[0]; el.style.minWidth = '';
    if (REDUCE) return;
    setInterval(function () {
      if (document.hidden) return;
      i = (i + 1) % words.length;
      unscramble(el, 300).then(function () { return scramble(el, words[i], 520); });
    }, 3000);
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

  /* ---------------- Count-up and gauges ---------------- */
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
  $$('.gauge').forEach(function (g) {
    var v = $('.v', g), frac = parseFloat(g.getAttribute('data-gauge') || '1'), L = 2 * Math.PI * 32;
    v.style.strokeDasharray = L; v.style.strokeDashoffset = REDUCE ? L * (1 - frac) : L;
    onView(g, function () { anim(v, [{ strokeDashoffset: L }, { strokeDashoffset: L * (1 - frac) }], { duration: 1600, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }); });
  });

  /* ---------------- Hero ---------------- */
  var heroStream = null, ctaStreams = [];
  if (FX) {
    $$('.hero .stream, .hero-lite .stream').forEach(function (h) { heroStream = FX.GateStream(h, { gate: +h.getAttribute('data-gate') || 0.74 }); onTheme.push(heroStream.theme); });
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

  /* ---------------- Intro ---------------- */
  function runIntro() {
    var intro = $('.intro');
    if (!intro || !root.classList.contains('intro-play')) { startHero(); return; }
    try { sessionStorage.setItem('zx5-intro', '1'); } catch (e) {}
    if (lenis) lenis.stop();
    var word = $('.intro-word', intro), line = $('.intro-line', intro), logo = $('.intro-logo', intro), beam = $('.intro-beam', intro);
    var top = $('.intro-half.top', intro), bot = $('.intro-half.bottom', intro), words = word.getAttribute('data-words').split('|');
    var done = false;
    var open = function () {
      if (done) return; done = true;
      anim(line, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      anim(logo, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 });
      anim(beam, [{ transform: 'translateX(-50%) scaleX(0.2)', opacity: 1 }, { transform: 'translateX(-50%) scaleX(1)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
      setTimeout(function () {
        anim(beam, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 300 });
        anim(top, [{ transform: 'translateY(0)' }, { transform: 'translateY(-101%)' }], { duration: 950, easing: 'cubic-bezier(0.76, 0, 0.24, 1)' });
        var a = anim(bot, [{ transform: 'translateY(0)' }, { transform: 'translateY(101%)' }], { duration: 950, easing: 'cubic-bezier(0.76, 0, 0.24, 1)' });
        $$('.intro-stage, .intro-skip', intro).forEach(function (x) { x.style.display = 'none'; });
        var end = function () { root.classList.remove('intro-play'); if (lenis) lenis.start(); };
        if (a) a.onfinish = end; else end();
        setTimeout(startHero, 380);
      }, 420);
    };
    $('.intro-skip', intro).addEventListener('click', open);
    intro.addEventListener('click', open);
    window.addEventListener('keydown', open, { once: true });
    anim(line, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 600 });
    var seq = wait(350);
    words.forEach(function (w, i) {
      seq = seq.then(function () { if (!done) return scramble(word, w, 520); })
        .then(function () { if (!done) return wait(i === words.length - 1 ? 650 : 520); })
        .then(function () { if (!done && i < words.length - 1) return unscramble(word, 260); });
    });
    seq.then(function () {
      if (done) return;
      anim(line, [{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(8px)' }], { duration: 420 });
      anim(logo, [{ opacity: 0, transform: 'scale(0.94)', filter: 'blur(8px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' }], { duration: 700, delay: 250 });
      return wait(1250);
    }).then(open);
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
  $$('[data-path]').forEach(function (sec) {
    var pin = $('.path-pin', sec), track = $('.path-track', sec), cards = $$('.pcard', sec), bar = $('.path-prog i', sec), dot = $('.path-dot', sec), stage = $('.path-stage', sec);
    var on = function () { return !REDUCE && matchMedia('(min-width: 901px)').matches; };
    var dist = 0;
    var size = function () {
      if (!on()) { sec.style.height = ''; track.style.transform = ''; cards.forEach(function (c) { c.classList.add('lit'); }); return; }
      dist = Math.max(0, track.scrollWidth - innerWidth + Math.max(20, (innerWidth - 1240) / 2));
      sec.style.height = (dist + innerHeight * 1.15) + 'px';
      upd();
    };
    var upd = function () {
      if (!on()) return;
      var r = sec.getBoundingClientRect(), total = sec.offsetHeight - innerHeight, k = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
      track.style.transform = 'translate3d(' + (-k * dist).toFixed(1) + 'px,0,0)';
      if (bar) bar.style.transform = 'scaleX(' + k.toFixed(3) + ')';
      if (dot && stage) { var lo = Math.max(20, (stage.clientWidth - 1240) / 2); dot.style.left = (lo + k * (stage.clientWidth - lo * 2)).toFixed(1) + 'px'; }
      var mid = innerWidth * 0.62;
      cards.forEach(function (c, i) { var cr = c.getBoundingClientRect(); if (cr.left < mid || (k > 0.97 && i === cards.length - 1)) c.classList.add('lit'); });
    };
    window.addEventListener('scroll', upd, { passive: true });
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
      var ok = form.parentElement.querySelector('[data-success]'); if (!ok) return;
      form.hidden = true; ok.hidden = false;
      var who = $('[data-who]', ok), nm = $('input[name=first]', form); if (who && nm) who.textContent = nm.value.trim();
      if (!REDUCE) {
        anim(ok, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 700 });
        var path = $('.check path', ok); if (path) { var L = path.getTotalLength(); path.style.strokeDasharray = L; anim(path, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 700, delay: 200 }); }
      }
      var h = $('h2, h3', ok); if (h) { h.tabIndex = -1; h.focus(); }
    });
  });

  window.__v5ok = true;
  runIntro();
})();
