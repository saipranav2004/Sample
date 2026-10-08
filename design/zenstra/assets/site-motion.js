/* Zenstra marketing motion and interaction, shared by every marketing page.
   Libraries: Motion 11 (scroll, inView, animate, stagger), anime.js 4
   (timelines, SVG drawing, counters), Lenis 1.1 (smooth scrolling).
   Every effect is skipped under prefers-reduced-motion. */
(function () {
  var ZX = window.ZX;
  var M = window.Motion;
  var A = window.anime;
  var root = document.documentElement;
  var reduce = ZX.reduce;
  var EASE = [0.16, 1, 0.3, 1];
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------------ */
  /* Smooth scrolling                                                    */
  /* ------------------------------------------------------------------ */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.9 });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
  }
  ZX.lenis = lenis;
  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -100, duration: 1.2 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    history.replaceState(null, '', a.getAttribute('href'));
    scrollToEl(target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  // Arriving from another page with #anchor: land below the fixed header.
  if (location.hash.length > 1) {
    var landing = document.getElementById(location.hash.slice(1));
    if (landing) window.addEventListener('load', function () { setTimeout(function () { scrollToEl(landing); }, 60); });
  }

  /* ------------------------------------------------------------------ */
  /* Header: solid once scrolling, hides on the way down                */
  /* ------------------------------------------------------------------ */
  var head = $('.site-head');
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY;
    if (head) {
      head.classList.toggle('scrolled', y > 12);
      var busy = document.body.classList.contains('menu-open') || head.matches(':hover, :focus-within') || $('.nav li.open');
      if (!busy && y > 640 && y > lastY + 4) head.classList.add('hide');
      if (y < lastY - 4 || y < 640) head.classList.remove('hide');
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var bar = $('.progress');
  if (bar && M && !reduce) M.scroll(function (p) { bar.style.transform = 'scaleX(' + p + ')'; });

  // Mega menus open on hover (CSS) and on click / keyboard (here)
  $$('.nav > li > button.nav-trigger').forEach(function (btn) {
    var li = btn.parentElement;
    btn.addEventListener('click', function () {
      var open = !li.classList.contains('open');
      $$('.nav > li.open').forEach(function (x) { x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); });
      li.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav')) $$('.nav > li.open').forEach(function (x) { x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = $('.nav > li.open');
    if (open) { open.classList.remove('open'); open.firstElementChild.setAttribute('aria-expanded', 'false'); open.firstElementChild.focus(); }
  });

  // Mobile menu
  var menuBtn = $('.menu-btn'), menu = $('.mobile-menu');
  function setMenu(open) {
    menu.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });
  }

  /* ------------------------------------------------------------------ */
  /* Intro loader (once per session), then the hero entrance            */
  /* ------------------------------------------------------------------ */
  var intro = $('.intro');
  var seen = false;
  try { seen = sessionStorage.getItem('zx-intro') === '1'; } catch (e) {}
  function heroEntrance() {
    var hero = $('.hero, .page-hero');
    if (!hero || reduce || !M) { $$('.mark').forEach(function (m) { m.classList.add('on'); }); return; }
    M.animate($$('[data-hero]', hero), { opacity: [0, 1], transform: ['translateY(18px)', 'translateY(0px)'] }, { duration: 1, delay: M.stagger(0.08, { start: 0.35 }), ease: EASE });
    M.animate($$('h1 .line > span', hero), { transform: ['translateY(105%)', 'translateY(0%)'] }, { duration: 1.1, delay: M.stagger(0.09, { start: 0.12 }), ease: EASE });
    var u = $('h1 .accent path', hero);
    if (u && A) A.animate(A.svg.createDrawable(u), { draw: ['0 0', '0 1'], duration: 900, delay: 900, ease: 'inOutQuart' });
    var led = $('.ledger');
    if (led) {
      M.animate(led, { opacity: [0, 1], transform: ['perspective(1400px) rotateX(8deg) translateY(36px)', 'perspective(1400px) rotateX(0deg) translateY(0px)'] }, { duration: 1.4, delay: 0.45, ease: EASE });
      if (A) {
        A.animate('.ledger tbody tr', { opacity: [0, 1], translateX: [-12, 0], delay: A.stagger(70, { start: 900 }), duration: 700, ease: 'outExpo' });
        $$('.ledger-stats [data-count]').forEach(countUp);
      }
    }
  }
  function startPage() { root.classList.add('ready'); heroEntrance(); }
  if (intro && !reduce && A && !seen) {
    try { sessionStorage.setItem('zx-intro', '1'); } catch (e) {}
    var tl = A.createTimeline({ defaults: { ease: 'outExpo' } });
    tl.add(A.svg.createDrawable('.intro .star-stroke'), { draw: ['0 0', '0 1'], duration: 800, ease: 'inOutQuad' })
      .add('.intro .star-fill', { opacity: [0, 1], scale: [0.6, 1], duration: 500 }, '-=250')
      .add('.intro .word span', { opacity: [0, 1], translateY: [8, 0], delay: A.stagger(40), duration: 500 }, '-=350')
      .add('.intro .bar i', { scaleX: [0, 1], duration: 650, ease: 'inOutQuart' }, '-=600')
      .add('.intro', { clipPath: ['inset(0 0 0% 0)', 'inset(0 0 100% 0)'], duration: 700, ease: 'inOutQuart', onBegin: startPage }, '+=80')
      .then(function () { intro.remove(); });
  } else {
    if (intro) {
      if (!reduce && M) M.animate(intro, { opacity: [1, 0] }, { duration: 0.35 }).then(function () { intro.remove(); });
      else intro.remove();
    }
    startPage();
  }

  /* ------------------------------------------------------------------ */
  /* Scroll reveals                                                      */
  /* ------------------------------------------------------------------ */
  var FROM = {
    up: ['translateY(32px)', 'translateY(0px)'], fade: ['translateY(0px)', 'translateY(0px)'],
    left: ['translateX(-32px)', 'translateX(0px)'], right: ['translateX(32px)', 'translateX(0px)'],
    scale: ['scale(0.96) translateY(16px)', 'scale(1) translateY(0px)']
  };
  function countUp(el) {
    var raw = el.getAttribute('data-count');
    var to = parseFloat(raw), dec = (raw.split('.')[1] || '').length;
    var fmt = function (v) { return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); };
    if (reduce || !A) { el.textContent = fmt(to); return; }
    var o = { v: 0 };
    A.animate(o, { v: to, duration: 1600, ease: 'outExpo', onUpdate: function () { el.textContent = fmt(o.v); } });
  }
  ZX.countUp = countUp;
  if (M && !reduce) {
    $$('[data-reveal]').forEach(function (el) {
      if (el.closest('.hero, .page-hero')) return;
      var kind = el.getAttribute('data-reveal') || 'up';
      var delay = parseFloat(el.getAttribute('data-delay') || '0');
      M.inView(el, function () {
        M.animate(el, { opacity: [0, 1], transform: FROM[kind] || FROM.up, filter: ['blur(6px)', 'blur(0px)'] }, { duration: 1, delay: delay, ease: EASE });
      }, { amount: 0.15 });
    });
    $$('[data-stagger]').forEach(function (group) {
      var kids = $$(':scope > *', group);
      kids.forEach(function (k) { k.style.opacity = '0'; });
      M.inView(group, function () {
        M.animate(kids, { opacity: [0, 1], transform: ['translateY(28px)', 'translateY(0px)'] }, { duration: 0.9, delay: M.stagger(0.08), ease: EASE });
      }, { amount: 0.12 });
    });
    $$('.mark').forEach(function (m) { if (!m.closest('.hero, .page-hero')) M.inView(m, function () { m.classList.add('on'); }, { amount: 0.8 }); });
    $$('[data-count]').forEach(function (el) { if (!el.closest('.ledger, [data-trust]')) M.inView(el, function () { countUp(el); }, { amount: 0.6 }); });
    $$('[data-play]').forEach(function (el) { M.inView(el, function () { el.classList.add('play'); }, { amount: 0.45 }); });
  } else {
    $$('.mark, [data-play]').forEach(function (el) { el.classList.add('on', 'play'); });
  }
  ZX.motionReady = true;

  /* ------------------------------------------------------------------ */
  /* Hero background: a quiet network of agents and tools on the right. */
  /* Requests travel between them; red ones are stopped mid-way. The    */
  /* field fades out well before the headline, so text stays clean.     */
  /* ------------------------------------------------------------------ */
  var cv = $('.hero-canvas');
  if (cv) {
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, X0 = 0, nodes = [], edges = [], pulses = [], rings = [], C = {}, running = false, last = 0, acc = 0;
    function readColors() {
      var d = ZX.isDark();
      C = { sig: ZX.cssVar('--signal'), crit: ZX.cssVar('--crit'), med: ZX.cssVar('--med'), line: ZX.cssVar('--hero-ink-2'), k: d ? 1 : 0.75 };
    }
    function rnd(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
    function layout() {
      var r = cv.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      X0 = W * 0.5;
      var led = $('.ledger'), lr = null;
      if (led) { var b = led.getBoundingClientRect(); lr = { x: b.left - r.left - 20, y: b.top - r.top - 20, w: b.width + 40, h: b.height + 40 }; }
      var R = rnd(7), cell = 104;
      nodes = [];
      for (var y = 40; y < H - 30; y += cell) {
        for (var x = X0 + 40; x < W - 20; x += cell) {
          var nx = x + (R() - 0.5) * cell * 0.7, ny = y + (R() - 0.5) * cell * 0.7;
          if (lr && nx > lr.x && nx < lr.x + lr.w && ny > lr.y && ny < lr.y + lr.h) continue;
          nodes.push({ x: nx, y: ny, big: R() < 0.22 });
        }
      }
      edges = [];
      nodes.forEach(function (a, i) {
        var near = nodes.map(function (b, j) { return { j: j, d: Math.hypot(a.x - b.x, a.y - b.y) }; }).filter(function (o) { return o.j !== i; }).sort(function (p, q) { return p.d - q.d; }).slice(0, 2);
        near.forEach(function (o) {
          if (o.d > cell * 1.9) return;
          var key = Math.min(i, o.j) + '-' + Math.max(i, o.j);
          if (!edges.some(function (e) { return e.key === key; })) edges.push({ key: key, a: i, b: o.j, len: o.d });
        });
      });
      pulses = []; rings = [];
    }
    function fade(x) { var t = Math.min(1, Math.max(0, (x - X0) / 200)); return t * t * (3 - 2 * t); }
    function spawn() {
      if (!edges.length) return;
      var e = edges[(Math.random() * edges.length) | 0], rev = Math.random() < 0.5, r = Math.random();
      pulses.push({ e: e, rev: rev, t: 0, kind: r < 0.12 ? 'block' : r < 0.2 ? 'held' : 'allow', hold: 0, stop: 0.4 + Math.random() * 0.25 });
    }
    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      edges.forEach(function (e) {
        var a = nodes[e.a], b = nodes[e.b];
        ctx.globalAlpha = 0.14 * C.k * Math.min(fade(a.x), fade(b.x));
        ctx.strokeStyle = C.line;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      nodes.forEach(function (n) {
        var f = fade(n.x);
        ctx.globalAlpha = (n.big ? 0.55 : 0.35) * C.k * f;
        ctx.fillStyle = n.big ? C.sig : C.line;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.big ? 2.6 : 1.6, 0, Math.PI * 2); ctx.fill();
        if (n.big) { ctx.globalAlpha = 0.18 * C.k * f; ctx.strokeStyle = C.sig; ctx.beginPath(); ctx.arc(n.x, n.y, 7, 0, Math.PI * 2); ctx.stroke(); }
      });
      for (var i = pulses.length - 1; i >= 0; i--) {
        var p = pulses[i], a = nodes[p.e.rev ? p.e.b : p.e.a], b = nodes[p.e.rev ? p.e.a : p.e.b];
        if (p.rev) { var tmp = a; a = b; b = tmp; }
        if (p.hold > 0) {
          p.hold -= dt;
          if (p.hold <= 0 && p.kind === 'block') { pulses.splice(i, 1); continue; }
          if (p.hold <= 0) p.kind = 'passed';
        } else {
          p.t += (70 / p.e.len) * dt;
          if ((p.kind === 'block' || p.kind === 'held') && p.t >= p.stop) {
            p.t = p.stop; p.hold = p.kind === 'block' ? 0.6 : 0.9;
            var hx = a.x + (b.x - a.x) * p.t, hy = a.y + (b.y - a.y) * p.t;
            rings.push({ x: hx, y: hy, r: 3, a: 1, c: p.kind === 'block' ? C.crit : C.med });
          }
          if (p.t >= 1) { pulses.splice(i, 1); continue; }
        }
        var x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t, f = fade(x);
        var col = p.kind === 'block' ? C.crit : (p.kind === 'held' && p.hold > 0) ? C.med : C.sig;
        var tx = x - (b.x - a.x) / p.e.len * 22, ty = y - (b.y - a.y) / p.e.len * 22;
        var g = ctx.createLinearGradient(tx, ty, x, y);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col);
        ctx.globalAlpha = 0.75 * C.k * f; ctx.strokeStyle = g; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1;
      }
      for (var k = rings.length - 1; k >= 0; k--) {
        var s = rings[k];
        s.r += 22 * dt; s.a -= 1.3 * dt;
        if (s.a <= 0) { rings.splice(k, 1); continue; }
        ctx.globalAlpha = s.a * 0.8 * C.k * fade(s.x); ctx.strokeStyle = s.c;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    function frame(t) {
      if (!running) return;
      var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      acc += dt;
      if (acc > 0.45) { acc = 0; if (pulses.length < 14) spawn(); }
      draw(dt);
      requestAnimationFrame(frame);
    }
    function start() { if (running || reduce || getComputedStyle(cv).display === 'none') return; running = true; last = 0; requestAnimationFrame(frame); }
    function stop() { running = false; }
    readColors(); layout();
    for (var s0 = 0; s0 < 6; s0++) { spawn(); if (pulses.length) pulses[pulses.length - 1].t = Math.random() * 0.8; }
    draw(0);
    if (!reduce) {
      new IntersectionObserver(function (en) { en[0].isIntersecting && !document.hidden ? start() : stop(); }).observe(cv);
      document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    }
    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { layout(); draw(0); start(); }, 120); });
    window.addEventListener('load', function () { layout(); draw(0); });
    ZX.onTheme(function () { requestAnimationFrame(function () { readColors(); draw(0); }); });
  }

  /* ------------------------------------------------------------------ */
  /* Decision ledger: one new decision every 2.2 s                      */
  /* ------------------------------------------------------------------ */
  var rows = $('#ledger-rows');
  if (rows) {
    var pauseBtn = $('#ledger-pause');
    var feed = [
      ['member-voice', 'kb.article.read', 'allow', 4], ['copilot-finance', 'gl.journal.post', 'stepup', 12],
      ['loan-doc-classifier', 'los.loanfile.read', 'allow', 5], ['zapier:lead-sync', 'crm.contact.export', 'block', 7],
      ['sar-prep-agent', 'case.note.write', 'allow', 6], ['member-chat-assist', 'memory.write (unsigned)', 'block', 9],
      ['dev-agent-ci', 'git.push main', 'stepup', 10], ['copilot-hr-assist', 'hris.salary.read', 'block', 8],
      ['member-chat-assist', 'core.account.read', 'allow', 5]
    ];
    var label = { allow: 'Allow', stepup: 'Step-up', block: 'Block' };
    var counts = { total: $('#lc-total'), block: $('#lc-block'), step: $('#lc-step') };
    var li = 0, paused = reduce, clock = new Date(2026, 9, 8, 9, 41, 3);
    if (reduce && pauseBtn) { pauseBtn.textContent = 'Play'; pauseBtn.setAttribute('aria-pressed', 'true'); }
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var bump = function (el, by) { if (!el) return; el.textContent = (parseInt(el.textContent.replace(/,/g, ''), 10) + by).toLocaleString('en-US'); };
    setInterval(function () {
      if (paused || document.hidden || !root.classList.contains('ready')) return;
      var f = feed[li++ % feed.length];
      clock = new Date(clock.getTime() + 900 + Math.round(Math.random() * 1500));
      var tr = document.createElement('tr');
      tr.className = 'enter' + (f[2] === 'block' ? ' blk' : '');
      tr.innerHTML = '<td>' + pad(clock.getHours()) + ':' + pad(clock.getMinutes()) + ':' + pad(clock.getSeconds()) + '</td><td class="agent">' + f[0] + '</td><td>' + f[1] + '</td><td><span class="verdict ' + f[2] + '"><i></i>' + label[f[2]] + '</span></td><td class="ms">' + f[3] + '</td>';
      rows.insertBefore(tr, rows.firstChild);
      while (rows.children.length > 6) rows.removeChild(rows.lastChild);
      bump(counts.total, 37 + ((Math.random() * 20) | 0));
      if (f[2] === 'block') bump(counts.block, 1);
      if (f[2] === 'stepup') bump(counts.step, 1);
    }, 2200);
    if (pauseBtn) pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Play' : 'Pause';
      pauseBtn.setAttribute('aria-pressed', String(paused));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Home architecture: the four checks run in order, packets on wires   */
  /* ------------------------------------------------------------------ */
  var gate = $('.gate');
  if (gate) {
    var gsteps = $$('.steps li', gate), outs = $$('.gate-out .verdict', gate);
    var gi = -1, gtimer = null;
    var gtick = function () {
      gi = (gi + 1) % (gsteps.length + 2);
      gsteps.forEach(function (s, n) { s.classList.toggle('active', n === gi); s.classList.toggle('done', n < gi); });
      var v = gi === gsteps.length ? (Math.random() < 0.5 ? 2 : Math.random() < 0.5 ? 1 : 0) : -1;
      outs.forEach(function (o, n) { o.classList.toggle('lit', n === v); });
    };
    if (reduce) gsteps.forEach(function (s) { s.classList.add('done'); });
    else if (M) M.inView(gate, function () { gtick(); gtimer = setInterval(gtick, 750); return function () { clearInterval(gtimer); }; }, { amount: 0.4 });
    var arch = $('.arch'), wsvg = $('.arch-flow');
    var wire = function () {
      if (!arch || !wsvg) return;
      var box = arch.getBoundingClientRect(), g = gate.getBoundingClientRect(), html = '';
      wsvg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      if (window.innerWidth > 960) {
        $$('.arch-col', arch).forEach(function (col, c) {
          $$('.node', col).forEach(function (n, j) {
            var r = n.getBoundingClientRect(), x1, y1, x2, y2;
            if (c === 0) { x1 = r.right - box.left; y1 = r.top + r.height / 2 - box.top; x2 = g.left - box.left; y2 = g.top + g.height / 2 - box.top + (j - 1) * 18; }
            else { x1 = g.right - box.left; y1 = g.top + g.height / 2 - box.top + (j - 1.5) * 14; x2 = r.left - box.left; y2 = r.top + r.height / 2 - box.top; }
            var mx = (x1 + x2) / 2, id = 'p' + c + j;
            html += '<path id="' + id + '" class="wire" d="M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"/>';
            if (!reduce) html += '<circle r="3" class="pkt' + (c === 1 && j === 2 ? ' pkt-b' : '') + '"><animateMotion dur="' + (2.2 + j * 0.35) + 's" begin="' + (j * 0.4 + c * 0.9) + 's" repeatCount="indefinite"><mpath href="#' + id + '"/></animateMotion></circle>';
          });
        });
      }
      wsvg.innerHTML = html;
    };
    wire();
    window.addEventListener('resize', wire);
    window.addEventListener('load', wire);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(wire);
  }

  /* ------------------------------------------------------------------ */
  /* Home product showcase: tabs that advance on their own while the    */
  /* section is on screen. Hover pauses; choosing a tab stops it.       */
  /* ------------------------------------------------------------------ */
  var sc = $('.showcase');
  if (sc) {
    var tabs = $$('.sc-tab', sc), slides = $$('.sc-slide', sc), urlEl = $('.sc-url', sc), scPause = $('#sc-pause'), frameEl = $('.sc-frame', sc);
    var cur = 0, DUR = 6500, elapsed = 0, auto = !reduce, hover = false, manual = false, inView = false, lastT = 0;
    var show = function (n, focus) {
      cur = (n + tabs.length) % tabs.length; elapsed = 0;
      tabs.forEach(function (t, i) {
        var on = i === cur;
        t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
        $('.bar i', t).style.transform = 'scaleX(' + (on && !auto ? 1 : 0) + ')';
      });
      slides.forEach(function (s, i) { s.classList.toggle('on', i === cur); });
      if (urlEl) urlEl.textContent = tabs[cur].getAttribute('data-url');
      if (focus) tabs[cur].focus();
    };
    var setAuto = function (on) {
      auto = on; if (scPause) { scPause.textContent = on ? 'Pause' : 'Play'; scPause.setAttribute('aria-pressed', String(!on)); }
      $('.bar i', tabs[cur]).style.transform = 'scaleX(' + (on ? elapsed / DUR : 1) + ')';
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i); setAuto(false); manual = true; });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(cur + (e.key === 'ArrowRight' ? 1 : -1), true); setAuto(false); }
      });
    });
    if (scPause) scPause.addEventListener('click', function () { setAuto(!auto); });
    sc.addEventListener('mouseenter', function () { hover = true; });
    sc.addEventListener('mouseleave', function () { hover = false; });
    if (reduce) setAuto(false);
    else {
      new IntersectionObserver(function (en) { inView = en[0].isIntersecting; }, { threshold: 0.35 }).observe($('.sc-stage', sc));
      (function loop(t) {
        var dt = lastT ? t - lastT : 0; lastT = t;
        if (auto && inView && !hover && !document.hidden) {
          elapsed += dt;
          $('.bar i', tabs[cur]).style.transform = 'scaleX(' + Math.min(1, elapsed / DUR) + ')';
          if (elapsed >= DUR) show(cur + 1);
        }
        requestAnimationFrame(loop);
      })(performance.now());
      if (M && frameEl) M.scroll(M.animate(frameEl, { transform: ['perspective(1800px) rotateX(14deg) scale(0.94)', 'perspective(1800px) rotateX(0deg) scale(1)'] }, { ease: 'linear' }), { target: $('.sc-stage', sc), offset: ['start end', 'start 0.3'] });
    }
    show(0);
  }

  /* ------------------------------------------------------------------ */
  /* Trust center card: frameworks pop in, controls tick, counts rise   */
  /* ------------------------------------------------------------------ */
  $$('[data-trust]').forEach(function (tc) {
    var fws = $$('.fw-card', tc), ctls = $$('.ctl-row', tc), docs = $$('.doc', tc);
    var seals = $$('.seal .d', tc), ticks = $$('.tick path', tc), tracks = $$('.track i', tc);
    if (reduce || !M || !A) { $$('[data-count]', tc).forEach(countUp); return; }
    M.inView(tc, function () {
      if (fws.length) M.animate(fws, { opacity: [0, 1], transform: ['translateY(14px) scale(0.94)', 'translateY(0px) scale(1)'] }, { duration: 0.7, delay: M.stagger(0.08, { start: 0.2 }), ease: EASE });
      if (seals.length) A.animate(seals, { rotate: [-90, 0], duration: 1600, delay: A.stagger(80, { start: 300 }), ease: 'outExpo' });
      if (ctls.length) M.animate(ctls, { opacity: [0, 1], transform: ['translateX(-10px)', 'translateX(0px)'] }, { duration: 0.6, delay: M.stagger(0.09, { start: 0.6 }), ease: EASE });
      if (ticks.length) A.animate(A.svg.createDrawable(ticks), { draw: ['0 0', '0 1'], duration: 500, delay: A.stagger(90, { start: 900 }), ease: 'outQuad' });
      if (tracks.length) M.animate(tracks, { transform: ['scaleX(0)', 'scaleX(1)'] }, { duration: 1.1, delay: M.stagger(0.09, { start: 0.8 }), ease: [0.85, 0, 0.15, 1] });
      $$('[data-count]', tc).forEach(function (el, i) { setTimeout(function () { countUp(el); }, 700 + i * 60); });
      if (docs.length) M.animate(docs, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] }, { duration: 0.6, delay: M.stagger(0.1, { start: 1.3 }), ease: EASE });
    }, { amount: 0.3 });
  });

  /* ------------------------------------------------------------------ */
  /* FAQ: animated height                                               */
  /* ------------------------------------------------------------------ */
  $$('.faq details').forEach(function (d) {
    var s = $('summary', d), body = $('.faq-body', d);
    s.addEventListener('click', function (e) {
      if (reduce || !M || !body) return;
      e.preventDefault();
      if (d.open) {
        M.animate(body, { height: [body.offsetHeight + 'px', '0px'], opacity: [1, 0] }, { duration: 0.35, ease: EASE }).then(function () { d.open = false; body.style.height = ''; body.style.opacity = ''; });
      } else {
        d.open = true;
        var h = body.offsetHeight;
        M.animate(body, { height: ['0px', h + 'px'], opacity: [0, 1] }, { duration: 0.5, ease: EASE }).then(function () { body.style.height = ''; });
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* In-page navigation follows the section in view                     */
  /* ------------------------------------------------------------------ */
  var subLinks = $$('.subnav a[href^="#"], .legal-nav a[href^="#"]');
  var subTargets = subLinks.map(function (a) { return [a, document.getElementById(a.getAttribute('href').slice(1))]; }).filter(function (x) { return x[1]; });
  if (subTargets.length) {
    // The current section is the last one whose top has passed 35% of the viewport; at the very bottom, the last one.
    var subTick = false;
    var updateSub = function () {
      subTick = false;
      var line = innerHeight * 0.35, cur = subTargets[0];
      subTargets.forEach(function (t) { if (t[1].getBoundingClientRect().top <= line) cur = t; });
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = subTargets[subTargets.length - 1];
      subTargets.forEach(function (t) { t[0].classList.toggle('on', t === cur); });
    };
    window.addEventListener('scroll', function () { if (!subTick) { subTick = true; requestAnimationFrame(updateSub); } }, { passive: true });
    window.addEventListener('load', updateSub);
    updateSub();
  }

  /* ------------------------------------------------------------------ */
  /* Resource library: filter by type and search                        */
  /* ------------------------------------------------------------------ */
  var lib = $('#library');
  if (lib) {
    var chips = $$('.chip-btn[data-filter]'), items = $$('.res[data-type]', lib), search = $('#res-search'), empty = $('.empty-state', lib);
    var filter = 'all';
    chips.forEach(function (c) {
      var f = c.getAttribute('data-filter');
      var n = f === 'all' ? items.length : items.filter(function (it) { return it.getAttribute('data-type') === f; }).length;
      var cEl = $('.c', c); if (cEl) cEl.textContent = n;
    });
    var apply = function (animate) {
      var q = search ? search.value.trim().toLowerCase() : '';
      var shown = [];
      items.forEach(function (it) {
        var ok = (filter === 'all' || it.getAttribute('data-type') === filter) && (!q || it.textContent.toLowerCase().indexOf(q) > -1);
        it.hidden = !ok; if (ok) shown.push(it);
      });
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === filter)); });
      if (empty) empty.style.display = shown.length ? 'none' : 'block';
      if (animate && M && !reduce && shown.length) M.animate(shown, { opacity: [0, 1], transform: ['translateY(14px)', 'translateY(0px)'] }, { duration: 0.5, delay: M.stagger(0.04), ease: EASE });
    };
    chips.forEach(function (c) { c.addEventListener('click', function () { filter = c.getAttribute('data-filter'); apply(true); }); });
    if (search) search.addEventListener('input', function () { apply(false); });
    var fromHash = function () {
      var h = location.hash.slice(1);
      if (chips.some(function (c) { return c.getAttribute('data-filter') === h; })) { filter = h; apply(true); scrollToEl(lib); }
    };
    window.addEventListener('hashchange', fromHash);
    fromHash(); apply(false);
  }

  /* ------------------------------------------------------------------ */
  /* Forms: validation and a success state (no data leaves the page)    */
  /* ------------------------------------------------------------------ */
  var FREE = /@(gmail|yahoo|hotmail|outlook|icloud|aol|proton|protonmail|gmx|mail)\./i;
  $$('form[data-validate]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = null;
      $$('.field', form).forEach(function (f) {
        var inp = $('input, select, textarea', f), err = $('.err', f);
        if (!inp) return;
        var msg = '';
        if (inp.required && !inp.value.trim()) msg = 'Required.';
        else if (inp.type === 'email' && inp.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value)) msg = 'Enter an email address like name@company.com.';
        else if (inp.type === 'email' && inp.hasAttribute('data-work') && FREE.test(inp.value)) msg = 'Use your work email so we can prepare for your environment.';
        f.classList.toggle('invalid', !!msg);
        if (err) err.textContent = msg;
        inp.setAttribute('aria-invalid', String(!!msg));
        if (msg && !first) first = inp;
      });
      $$('input[type=checkbox][required]', form).forEach(function (cb) { if (!cb.checked && !first) { first = cb; cb.closest('.check-row').style.color = 'var(--crit)'; } });
      if (first) { first.focus(); return; }
      var ok = form.parentElement.querySelector('[data-success]');
      if (!ok) return;
      form.hidden = true; ok.hidden = false;
      var name = $('input[name=first]', form) || $('input[name=name]', form);
      var who = $('[data-who]', ok); if (who && name) who.textContent = name.value.trim();
      if (A && !reduce) {
        A.animate(A.svg.createDrawable($$('.success path', ok)), { draw: ['0 0', '0 1'], duration: 700, ease: 'outQuad' });
        if (M) M.animate(ok, { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0px)'] }, { duration: 0.5, ease: EASE });
      }
      var h = $('h2, h3', ok); if (h) { h.tabIndex = -1; h.focus(); }
    });
  });

  /* ------------------------------------------------------------------ */
  /* Modals (document requests)                                         */
  /* ------------------------------------------------------------------ */
  var lastOpener = null;
  function openModal(id, opener) {
    var m = document.getElementById(id); if (!m) return;
    lastOpener = opener;
    var doc = opener && opener.getAttribute('data-doc');
    var slot = $('[data-doc-name]', m); if (slot && doc) slot.textContent = doc;
    var form = $('form', m), ok = $('[data-success]', m);
    if (form) { form.hidden = false; form.reset(); $$('.field', form).forEach(function (f) { f.classList.remove('invalid'); }); }
    if (ok) ok.hidden = true;
    m.hidden = false;
    if (lenis) lenis.stop();
    if (M && !reduce) M.animate($('.modal-card', m), { opacity: [0, 1], transform: ['translateY(16px) scale(0.98)', 'translateY(0px) scale(1)'] }, { duration: 0.45, ease: EASE });
    var f = $('input, button', $('.modal-card', m)); if (f) f.focus();
  }
  function closeModal(m) { m.hidden = true; if (lenis) lenis.start(); if (lastOpener) lastOpener.focus(); }
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-modal-open]');
    if (o) { e.preventDefault(); openModal(o.getAttribute('data-modal-open'), o); return; }
    var c = e.target.closest('[data-modal-close]');
    if (c) { closeModal(c.closest('.modal')); return; }
    if (e.target.classList && e.target.classList.contains('modal')) closeModal(e.target);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var m = $('.modal:not([hidden])'); if (m) closeModal(m); } });

  /* ------------------------------------------------------------------ */
  /* Copy-to-clipboard for addresses                                    */
  /* ------------------------------------------------------------------ */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy'), lab = $('.copy-label', b), prev = lab ? lab.textContent : '';
      var done = function () { if (lab) { lab.textContent = 'Copied'; setTimeout(function () { lab.textContent = prev; }, 1600); } };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });

  /* ------------------------------------------------------------------ */
  /* Status page: 90-day uptime bars                                    */
  /* ------------------------------------------------------------------ */
  $$('.uptime').forEach(function (u) {
    var days = function (a) { return (u.getAttribute(a) || '').split(',').filter(Boolean).map(Number); };
    var warn = days('data-warn'), bad = days('data-bad');
    var html = '';
    for (var d = 0; d < 90; d++) html += '<i class="' + (bad.indexOf(d) > -1 ? 'x' : warn.indexOf(d) > -1 ? 'w' : '') + '" title="Day ' + (90 - d) + ' ago"></i>';
    u.innerHTML = html;
    if (M && !reduce) M.inView(u, function () { M.animate($$('i', u), { transform: ['scaleY(0)', 'scaleY(1)'] }, { duration: 0.5, delay: M.stagger(0.006), ease: EASE }); }, { amount: 0.5 });
  });
})();
