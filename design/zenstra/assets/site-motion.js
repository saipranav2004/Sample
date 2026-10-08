/* Zenstra marketing motion.
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
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href').length < 2) return;
      var target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -84, duration: 1.2 });
    });
  }
  ZX.lenis = lenis;

  /* ------------------------------------------------------------------ */
  /* Header: solid after the hero starts scrolling, hides on the way down */
  /* ------------------------------------------------------------------ */
  var head = $('.site-head');
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY;
    if (head) {
      head.classList.toggle('scrolled', y > 12);
      var menuOpen = document.body.classList.contains('menu-open');
      head.classList.toggle('hide', !menuOpen && y > 640 && y > lastY + 4 && !head.matches(':hover, :focus-within'));
      if (y < lastY - 4) head.classList.remove('hide');
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Scroll progress bar
  var bar = $('.progress');
  if (bar && M && !reduce) {
    M.scroll(function (p) { bar.style.transform = 'scaleX(' + p + ')'; });
  }

  // Mobile menu
  var menuBtn = $('.menu-btn'), menu = $('.mobile-menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      document.body.classList.toggle('menu-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      if (lenis) open ? lenis.stop() : lenis.start();
    });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { menu.classList.remove('open'); document.body.classList.remove('menu-open'); if (lenis) lenis.start(); }); });
  }

  /* ------------------------------------------------------------------ */
  /* Intro loader, then the hero entrance                               */
  /* ------------------------------------------------------------------ */
  var intro = $('.intro');
  var seen = false;
  try { seen = sessionStorage.getItem('zx-intro') === '1'; } catch (e) {}
  function heroEntrance() {
    var hero = $('.hero');
    if (!hero || reduce || !M) { $$('.mark').forEach(function (m) { m.classList.add('on'); }); return; }
    M.animate($$('.hero [data-hero]'), { opacity: [0, 1], transform: ['translateY(18px)', 'translateY(0)'] }, { duration: 1, delay: M.stagger(0.08, { start: 0.35 }), ease: EASE });
    M.animate($$('.hero h1 .line > span'), { transform: ['translateY(105%)', 'translateY(0)'] }, { duration: 1.1, delay: M.stagger(0.09, { start: 0.12 }), ease: EASE });
    var u = $('.hero h1 .accent path');
    if (u && A) {
      var d = A.svg.createDrawable(u);
      A.animate(d, { draw: ['0 0', '0 1'], duration: 900, delay: 900, ease: 'inOutQuart' });
    }
    var led = $('.ledger');
    if (led) M.animate(led, { opacity: [0, 1], transform: ['perspective(1400px) rotateX(10deg) rotateY(-10deg) translateY(40px)', 'perspective(1400px) rotateX(0deg) rotateY(0deg) translateY(0)'] }, { duration: 1.4, delay: 0.45, ease: EASE });
    if (A && $('.ledger')) {
      A.animate('.ledger tbody tr', { opacity: [0, 1], translateX: [-12, 0], delay: A.stagger(70, { start: 900 }), duration: 700, ease: 'outExpo' });
      $$('.ledger-stats [data-count]').forEach(countUp);
    }
  }
  function startPage() {
    root.classList.add('ready');
    heroEntrance();
  }
  if (intro && !reduce && A && !seen) {
    try { sessionStorage.setItem('zx-intro', '1'); } catch (e) {}
    var stroke = A.svg.createDrawable('.intro .star-stroke');
    var tl = A.createTimeline({ defaults: { ease: 'outExpo' } });
    tl.add(stroke, { draw: ['0 0', '0 1'], duration: 800, ease: 'inOutQuad' })
      .add('.intro .star-fill', { opacity: [0, 1], scale: [0.6, 1], duration: 500 }, '-=250')
      .add('.intro .word span', { opacity: [0, 1], translateY: [8, 0], delay: A.stagger(40), duration: 500 }, '-=350')
      .add('.intro .bar i', { scaleX: [0, 1], duration: 650, ease: 'inOutQuart' }, '-=600')
      .add('.intro', { clipPath: ['inset(0 0 0% 0)', 'inset(0 0 100% 0)'], duration: 700, ease: 'inOutQuart', onBegin: startPage }, '+=80')
      .then(function () { intro.remove(); });
  } else {
    if (intro) {
      if (!reduce && M) { M.animate(intro, { opacity: [1, 0] }, { duration: 0.35 }).then(function () { intro.remove(); }); }
      else intro.remove();
    }
    startPage();
  }

  /* ------------------------------------------------------------------ */
  /* Scroll reveals                                                      */
  /* ------------------------------------------------------------------ */
  var FROM = {
    up: ['translateY(32px)', 'translateY(0px)'], fade: ['translateY(0px)', 'translateY(0px)'], left: ['translateX(-32px)', 'translateX(0px)'],
    right: ['translateX(32px)', 'translateX(0px)'], scale: ['scale(0.96) translateY(16px)', 'scale(1) translateY(0px)']
  };
  if (M && !reduce) {
    $$('[data-reveal]').forEach(function (el) {
      if (el.closest('.hero')) return;
      var kind = el.getAttribute('data-reveal') || 'up';
      var delay = parseFloat(el.getAttribute('data-delay') || '0');
      M.inView(el, function () {
        M.animate(el, { opacity: [0, 1], transform: FROM[kind] || FROM.up, filter: ['blur(6px)', 'blur(0px)'] }, { duration: 1, delay: delay, ease: EASE });
      }, { amount: 0.18 });
    });
    $$('[data-stagger]').forEach(function (group) {
      var kids = $$(':scope > *', group);
      kids.forEach(function (k) { k.style.opacity = '0'; });
      M.inView(group, function () {
        M.animate(kids, { opacity: [0, 1], transform: ['translateY(28px)', 'translateY(0px)'] }, { duration: 0.9, delay: M.stagger(0.09), ease: EASE });
      }, { amount: 0.15 });
    });
    $$('.mark').forEach(function (m) { if (!m.closest('.hero')) M.inView(m, function () { m.classList.add('on'); }, { amount: 0.8 }); });
    $$('[data-count]').forEach(function (el) { if (!el.closest('.ledger')) M.inView(el, function () { countUp(el); }, { amount: 0.6 }); });
    $$('[data-play]').forEach(function (el) { M.inView(el, function () { el.classList.add('play'); }, { amount: 0.45 }); });
  } else {
    $$('.mark, [data-play]').forEach(function (el) { el.classList.add('on', 'play'); });
  }
  ZX.motionReady = true;

  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-count'));
    var dec = (el.getAttribute('data-count').split('.')[1] || '').length;
    var fmt = function (v) { return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); };
    if (reduce || !A) { el.textContent = fmt(to); return; }
    var o = { v: 0 };
    A.animate(o, { v: to, duration: 1600, ease: 'outExpo', onUpdate: function () { el.textContent = fmt(o.v); } });
  }
  ZX.countUp = countUp;

  /* ------------------------------------------------------------------ */
  /* Hero background: the decision field                                */
  /* Requests travel along lanes to a policy gate. Most pass, some are  */
  /* held for a person (amber), some are blocked at the gate (red).     */
  /* ------------------------------------------------------------------ */
  var cv = $('.hero-canvas');
  if (cv) {
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1, gateX = 0, lanes = [], packets = [], bursts = [], colors = {}, running = false, last = 0;
    function readColors() {
      colors = { sig: ZX.cssVar('--signal'), crit: ZX.cssVar('--crit'), med: ZX.cssVar('--med'), line: ZX.cssVar('--hero-line'), ink: ZX.cssVar('--hero-ink-2'), dark: ZX.isDark() };
    }
    function size() {
      var r = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gateX = W < 1040 ? W * 0.86 : W * 0.5;
      lanes = [];
      var n = Math.max(8, Math.round(H / 64));
      for (var i = 0; i < n; i++) lanes.push(56 + (H - 140) * (i + 0.5) / n);
    }
    function spawn() {
      var r = Math.random();
      packets.push({ x: -10, lane: lanes[(Math.random() * lanes.length) | 0], v: 70 + Math.random() * 80, kind: r < 0.12 ? 'block' : r < 0.2 ? 'step' : 'allow', hold: 0, a: 1, trail: 40 + Math.random() * 60 });
    }
    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      // lanes
      ctx.lineWidth = 1;
      for (var i = 0; i < lanes.length; i++) {
        ctx.strokeStyle = colors.line;
        ctx.beginPath(); ctx.moveTo(0, lanes[i]); ctx.lineTo(W, lanes[i]); ctx.stroke();
      }
      // gate
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, colors.sig); g.addColorStop(0.7, colors.sig); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = colors.dark ? 0.55 : 0.35;
      ctx.strokeStyle = g; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(gateX, 0); ctx.lineTo(gateX, H); ctx.stroke();
      ctx.globalAlpha = colors.dark ? 0.12 : 0.07;
      ctx.fillStyle = colors.sig; ctx.fillRect(gateX - 14, 0, 28, H);
      ctx.globalAlpha = 1;
      for (var l = 0; l < lanes.length; l++) { ctx.fillStyle = colors.sig; ctx.globalAlpha = 0.5; ctx.fillRect(gateX - 3, lanes[l] - 0.5, 6, 1); }
      ctx.globalAlpha = 1;
      // packets
      for (var p = packets.length - 1; p >= 0; p--) {
        var k = packets[p];
        if (k.hold > 0) { k.hold -= dt; if (k.hold <= 0 && k.kind === 'block') { packets.splice(p, 1); continue; } }
        else {
          var nx = k.x + k.v * dt;
          if (k.x < gateX - 4 && nx >= gateX - 4 && k.kind !== 'allow') {
            nx = gateX - 4;
            k.hold = k.kind === 'block' ? 0.5 : 0.9;
            bursts.push({ x: gateX, y: k.lane, r: 2, a: 1, c: k.kind === 'block' ? colors.crit : colors.med });
            if (k.kind === 'step') k.kind = 'stepped';
          }
          k.x = nx;
        }
        if (k.x > W + 120) { packets.splice(p, 1); continue; }
        var before = k.x < gateX;
        var col = k.kind === 'block' ? colors.crit : (k.kind === 'step' || (k.kind === 'stepped' && k.hold > 0)) ? colors.med : colors.sig;
        var alpha = before ? (colors.dark ? 0.45 : 0.35) : (colors.dark ? 0.95 : 0.75);
        var tg = ctx.createLinearGradient(k.x - k.trail, 0, k.x, 0);
        tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(1, col);
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = tg; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(Math.max(0, k.x - k.trail), k.lane); ctx.lineTo(k.x, k.lane); ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(k.x, k.lane, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      // bursts at the gate
      for (var b = bursts.length - 1; b >= 0; b--) {
        var s = bursts[b];
        s.r += 34 * dt; s.a -= 1.4 * dt;
        if (s.a <= 0) { bursts.splice(b, 1); continue; }
        ctx.globalAlpha = s.a; ctx.strokeStyle = s.c; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    var acc = 0;
    function frame(t) {
      if (!running) return;
      var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      acc += dt;
      if (acc > 0.16) { acc = 0; if (packets.length < 46) spawn(); }
      draw(dt);
      requestAnimationFrame(frame);
    }
    function start() { if (running || reduce) return; running = true; last = 0; requestAnimationFrame(frame); }
    function stop() { running = false; }
    readColors(); size();
    // Pre-fill so the first frame already looks alive
    for (var s0 = 0; s0 < 30; s0++) { spawn(); packets[packets.length - 1].x = Math.random() * W; }
    draw(0);
    if (!reduce) {
      new IntersectionObserver(function (en) { en[0].isIntersecting && !document.hidden ? start() : stop(); }).observe(cv);
      document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    }
    window.addEventListener('resize', function () { size(); draw(0); });
    ZX.onTheme(function () { requestAnimationFrame(function () { readColors(); draw(0); }); });
  }

  /* ------------------------------------------------------------------ */
  /* Decision ledger: one new decision every 2.2 s                      */
  /* ------------------------------------------------------------------ */
  var rows = $('#ledger-rows');
  if (rows) {
    var pauseBtn = $('#ledger-pause');
    var feed = [
      ['member-voice', 'kb.article.read', 'POL-021', 'allow', 4],
      ['copilot-finance', 'gl.journal.post', 'POL-052', 'stepup', 12],
      ['loan-doc-classifier', 'los.loanfile.read', 'POL-021', 'allow', 5],
      ['zapier:lead-sync', 'crm.contact.export', 'unregistered', 'block', 7],
      ['sar-prep-agent', 'case.note.write', 'POL-087', 'allow', 6],
      ['member-chat-assist', 'memory.write (unsigned)', 'POL-140', 'block', 9],
      ['dev-agent-ci', 'git.push main', 'POL-009', 'stepup', 10],
      ['copilot-hr-assist', 'hris.salary.read', 'POL-033', 'block', 8],
      ['member-chat-assist', 'core.account.read', 'POL-021', 'allow', 5]
    ];
    var label = { allow: 'Allow', stepup: 'Step-up', block: 'Block' };
    var counts = { total: $('#lc-total'), block: $('#lc-block'), step: $('#lc-step') };
    var i = 0, paused = reduce, clock = new Date(2026, 9, 8, 9, 41, 3);
    if (reduce && pauseBtn) { pauseBtn.textContent = 'Play'; pauseBtn.setAttribute('aria-pressed', 'true'); }
    var pad = function (n) { return String(n).padStart(2, '0'); };
    function bump(el, by) { if (!el) return; var v = parseInt(el.textContent.replace(/,/g, ''), 10) + by; el.textContent = v.toLocaleString('en-US'); }
    setInterval(function () {
      if (paused || document.hidden || !root.classList.contains('ready')) return;
      var f = feed[i++ % feed.length];
      clock = new Date(clock.getTime() + 900 + Math.round(Math.random() * 1500));
      var tr = document.createElement('tr');
      tr.className = 'enter' + (f[3] === 'block' ? ' blk' : '');
      tr.innerHTML = '<td>' + pad(clock.getHours()) + ':' + pad(clock.getMinutes()) + ':' + pad(clock.getSeconds()) + '</td><td class="agent">' + f[0] + '</td><td>' + f[1] + '</td><td><span class="verdict ' + f[3] + '"><i></i>' + label[f[3]] + '</span></td><td class="ms">' + f[4] + '</td>';
      rows.insertBefore(tr, rows.firstChild);
      while (rows.children.length > 6) rows.removeChild(rows.lastChild);
      bump(counts.total, 37 + ((Math.random() * 20) | 0));
      if (f[3] === 'block') bump(counts.block, 1);
      if (f[3] === 'stepup') bump(counts.step, 1);
    }, 2200);
    if (pauseBtn) pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Play' : 'Pause';
      pauseBtn.setAttribute('aria-pressed', String(paused));
    });
    // Subtle tilt toward the pointer
    var led = $('.ledger');
    if (led && !reduce && window.matchMedia('(pointer: fine)').matches) {
      var hero = $('.hero');
      hero.addEventListener('mousemove', function (e) {
        var r = led.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        led.style.transform = 'perspective(1400px) rotateY(' + (dx * 3).toFixed(2) + 'deg) rotateX(' + (-dy * 3).toFixed(2) + 'deg)';
      });
      hero.addEventListener('mouseleave', function () { led.style.transition = 'transform 600ms cubic-bezier(0.16,1,0.3,1)'; led.style.transform = 'none'; setTimeout(function () { led.style.transition = ''; }, 600); });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Architecture: the four checks run in order while the section is   */
  /* on screen, then the verdict lights up.                            */
  /* ------------------------------------------------------------------ */
  var gate = $('.gate');
  if (gate) {
    var steps = $$('.steps li', gate), outs = $$('.gate-out .verdict', gate);
    var idx = -1, timer = null;
    function tick() {
      idx = (idx + 1) % (steps.length + 2);
      steps.forEach(function (s, n) { s.classList.toggle('active', n === idx); s.classList.toggle('done', n < idx); });
      var v = idx === steps.length ? (Math.random() < 0.5 ? 2 : Math.random() < 0.5 ? 1 : 0) : -1;
      outs.forEach(function (o, n) { o.classList.toggle('lit', n === v); });
    }
    if (reduce) { steps.forEach(function (s) { s.classList.add('done'); }); }
    else if (M) M.inView(gate, function () { tick(); timer = setInterval(tick, 750); return function () { clearInterval(timer); }; }, { amount: 0.4 });
    // Draw the connectors between the columns once layout is known
    var arch = $('.arch'), svg = $('.arch-flow');
    function wire() {
      if (!arch || !svg) return;
      var box = arch.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      var g = gate.getBoundingClientRect();
      var html = '';
      if (window.innerWidth > 960) {
        $$('.arch-col', arch).forEach(function (col, c) {
          $$('.node', col).forEach(function (n, j) {
            var r = n.getBoundingClientRect();
            var x1, y1, x2, y2;
            if (c === 0) { x1 = r.right - box.left; y1 = r.top + r.height / 2 - box.top; x2 = g.left - box.left; y2 = g.top + g.height / 2 - box.top + (j - 1) * 18; }
            else { x1 = g.right - box.left; y1 = g.top + g.height / 2 - box.top + (j - 1.5) * 14; x2 = r.left - box.left; y2 = r.top + r.height / 2 - box.top; }
            var mx = (x1 + x2) / 2;
            var d = 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2;
            var id = 'p' + c + j;
            html += '<path id="' + id + '" class="wire" d="' + d + '"/>';
            if (!reduce) html += '<circle r="3" class="pkt' + (c === 1 && j === 2 ? ' pkt-b' : '') + '"><animateMotion dur="' + (2.2 + j * 0.35) + 's" begin="' + (j * 0.4 + c * 0.9) + 's" repeatCount="indefinite"><mpath href="#' + id + '"/></animateMotion></circle>';
          });
        });
      }
      svg.innerHTML = html;
    }
    wire();
    window.addEventListener('resize', wire);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(wire);
  }

  /* ------------------------------------------------------------------ */
  /* Product tour: pinned while scrolling through four screens          */
  /* ------------------------------------------------------------------ */
  var tour = $('.tour');
  if (tour) {
    var tabs = $$('.tour-tab', tour), panes = $$('.pane', tour), fills = $$('.tour-tab .fill', tour);
    var cur = -1;
    function show(n) {
      if (n === cur) return;
      cur = n;
      tabs.forEach(function (t, i) { t.setAttribute('aria-selected', String(i === n)); t.classList.toggle('past', i < n); });
      panes.forEach(function (p, i) { p.classList.toggle('on', i === n); p.setAttribute('aria-hidden', String(i !== n)); });
      var url = $('.tour .screen-url');
      if (url) url.textContent = panes[n].getAttribute('data-url');
      $$('[data-count]', panes[n]).forEach(countUp);
    }
    var pinned = function () { return !reduce && window.innerWidth > 960; };
    tour.classList.toggle('pinned', pinned());
    window.addEventListener('resize', function () { tour.classList.toggle('pinned', pinned()); });
    show(0);
    if (M) M.scroll(function (p) {
      if (!tour.classList.contains('pinned')) return;
      var x = p * tabs.length;
      var n = Math.min(tabs.length - 1, Math.floor(x));
      show(n);
      fills.forEach(function (f, i) { f.style.transform = 'scaleY(' + (i < n ? 1 : i === n ? Math.min(1, x - n) : 0) + ')'; });
    }, { target: tour, offset: ['start start', 'end end'] });
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        if (tour.classList.contains('pinned')) {
          var top = tour.getBoundingClientRect().top + window.scrollY;
          var span = tour.offsetHeight - window.innerHeight;
          var y = top + span * (i + 0.15) / tabs.length;
          lenis ? lenis.scrollTo(y, { duration: 1.1 }) : window.scrollTo({ top: y, behavior: 'smooth' });
        } else show(i);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* FAQ: animated height                                               */
  /* ------------------------------------------------------------------ */
  $$('.faq details').forEach(function (d) {
    var s = $('summary', d), body = $('.faq-body', d);
    s.addEventListener('click', function (e) {
      if (reduce || !M || !body) return;
      e.preventDefault();
      if (d.open) {
        M.animate(body, { height: [body.offsetHeight + 'px', '0px'], opacity: [1, 0] }, { duration: 0.35, ease: EASE }).then(function () { d.open = false; body.style.height = ''; });
      } else {
        d.open = true;
        var h = body.offsetHeight;
        M.animate(body, { height: ['0px', h + 'px'], opacity: [0, 1] }, { duration: 0.5, ease: EASE }).then(function () { body.style.height = ''; });
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* Platform: sequence diagram drawn step by step                      */
  /* ------------------------------------------------------------------ */
  var seq = $('.seq');
  if (seq && A) {
    var msgs = $$('.msg', seq), lives = $$('.life', seq), heads = $$('.lane-head', seq), acts = $$('.act', seq), extra = $$('.t, .note-box, .seq-end', seq);
    var replayBtn = $('#seq-replay');
    function playSeq() {
      if (reduce) return;
      A.utils.set(msgs.concat(heads, extra), { opacity: 0 });
      A.utils.set(lives, { scaleY: 0 });
      A.utils.set(acts, { scaleY: 0 });
      var lines = A.svg.createDrawable($$('.msg line', seq));
      A.utils.set(lines, { draw: '0 0' });
      var tl = A.createTimeline({ defaults: { ease: 'outExpo' } });
      tl.add(heads, { opacity: [0, 1], translateY: [-10, 0], delay: A.stagger(60), duration: 500 })
        .add(lives, { scaleY: [0, 1], duration: 600, delay: A.stagger(40), ease: 'inOutQuart' }, '-=300')
        .add(acts, { scaleY: [0, 1], duration: 500, ease: 'inOutQuart' }, '-=250');
      msgs.forEach(function (m, n) {
        var ls = A.svg.createDrawable($$('line', m));
        tl.add(m, { opacity: [0, 1], duration: 200 }, n === 0 ? '-=150' : '+=40')
          .add(ls, { draw: ['0 0', '0 1'], duration: 380, ease: 'inOutQuad' }, '<<');
        if (m.classList.contains('block')) tl.add(m, { scale: [1, 1.04, 1], duration: 500, ease: 'outElastic(1, .6)' });
        if (n === 3) tl.add($$('.note-box', seq), { opacity: [0, 1], translateX: [8, 0], duration: 500 });
      });
      tl.add($$('.t, .seq-end', seq), { opacity: [0, 1], duration: 600, delay: A.stagger(100) });
    }
    if (!reduce && M) M.inView(seq, function () { playSeq(); }, { amount: 0.35 });
    if (replayBtn) replayBtn.addEventListener('click', playSeq);
  }

  /* Platform sub-navigation follows the section in view */
  var subLinks = $$('.subnav a');
  if (subLinks.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) subLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    subLinks.forEach(function (a) { var t = $(a.getAttribute('href')); if (t) io.observe(t); });
  }
})();
