/* Platform architecture: the "today vs with Zenstra" comparison and the
   architecture explorer (deployment modes x six steps of one tool call).
   The diagram is generated from the layout data below so every mode uses the
   same node ids, and each step highlights the same parts in every mode. */
(function () {
  var ZX = window.ZX, M = window.Motion, reduce = ZX.reduce;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var NS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------------ */
  /* Shared packet engine: dots that travel along SVG paths             */
  /* ------------------------------------------------------------------ */
  function Packets(layer) {
    this.layer = layer; this.items = [];
  }
  Packets.prototype.add = function (path, opts) {
    var c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', opts.r || 4.5);
    c.setAttribute('class', 'pk ' + (opts.kind || 'ok'));
    this.layer.appendChild(c);
    this.items.push({ el: c, path: path, len: path.getTotalLength(), t: -(opts.delay || 0), dur: opts.dur || 1100, rev: !!opts.rev, stop: opts.stop || 1, onStop: opts.onStop, stopped: false });
  };
  Packets.prototype.step = function (dt) {
    for (var i = this.items.length - 1; i >= 0; i--) {
      var p = this.items[i];
      p.t += dt;
      if (p.t < 0) { p.el.style.opacity = 0; continue; }
      var f = Math.min(p.stop, p.t / p.dur);
      if (f >= p.stop && !p.stopped) { p.stopped = true; p.hold = 700; if (p.onStop) p.onStop(); }
      if (p.stopped) { p.hold -= dt; p.el.style.opacity = Math.max(0, p.hold / 700); if (p.hold <= 0) { p.el.remove(); this.items.splice(i, 1); } }
      else p.el.style.opacity = 1;
      var pt = p.path.getPointAtLength((p.rev ? 1 - f : f) * p.len);
      p.el.setAttribute('cx', pt.x.toFixed(1)); p.el.setAttribute('cy', pt.y.toFixed(1));
    }
  };
  Packets.prototype.clear = function () { this.items.forEach(function (p) { p.el.remove(); }); this.items = []; };

  /* ------------------------------------------------------------------ */
  /* Today vs with Zenstra                                              */
  /* ------------------------------------------------------------------ */
  $$('.cmp-diagram').forEach(function (svg) {
    var paths = $$('path.flow', svg), layer = $('.pk-layer', svg), eng = new Packets(layer);
    var target = $('.hit', svg), gate = $('.gate-ring', svg);
    var t = 0, n = 0, running = false, last = 0;
    function launch() {
      var bad = n % 3 === 2; n++;
      var p = paths[(Math.random() * paths.length) | 0];
      var withZ = svg.classList.contains('with');
      eng.add(bad ? paths[1] : p, {
        kind: bad ? 'bad' : 'ok', dur: 1500, stop: bad && withZ ? 0.5 : 1,
        onStop: function () {
          var el = bad ? (withZ ? gate : target) : null;
          if (!el) return;
          el.classList.remove('flash'); void el.getBBox(); el.classList.add('flash');
        }
      });
    }
    function frame(ts) {
      if (!running) return;
      var dt = last ? ts - last : 0; last = ts; t += dt;
      if (t > 700) { t = 0; launch(); }
      eng.step(dt);
      requestAnimationFrame(frame);
    }
    if (reduce) return;
    new IntersectionObserver(function (en) {
      if (en[0].isIntersecting && !running) { running = true; last = 0; requestAnimationFrame(frame); }
      else if (!en[0].isIntersecting) running = false;
    }, { threshold: 0.3 }).observe(svg);
  });

  /* ------------------------------------------------------------------ */
  /* Architecture explorer                                              */
  /* ------------------------------------------------------------------ */
  var root = $('#explorer');
  if (!root) return;
  var svg = $('.ax-svg', root), stepsEl = $$('.ax-step', root), modeBtns = $$('.ax-mode', root), replay = $('#ax-replay', root);
  var OUT = [
    { id: 'ctrl', x: 604, y: 60, w: 140, h: 76, t: 'Control plane', s: 'Zenstra cloud', c: 'zx ext' },
    { id: 'siem', x: 604, y: 252, w: 140, h: 62, t: 'Your SIEM', s: 'Splunk · Sentinel', c: 'ext' },
    { id: 'idp', x: 604, y: 338, w: 140, h: 62, t: 'Identity provider', s: 'Entra ID · Okta', c: 'ext' }
  ];
  function tools(x, w) {
    return [
      { id: 'kb', x: x, y: 70, w: w, h: 54, t: 'Knowledge base', s: 'fee-schedule-2026.pdf', c: 'tool' },
      { id: 'mcp', x: x, y: 140, w: w, h: 54, t: 'MCP server', s: 'crm.case.create', c: 'tool' },
      { id: 'core', x: x, y: 210, w: w, h: 54, t: 'Core banking API', s: 'core.account.read', c: 'tool' },
      { id: 'email', x: x, y: 280, w: w, h: 54, t: 'Email', s: 'email.send', c: 'tool' },
      { id: 'ledger', x: x, y: 372, w: w, h: 60, t: 'Decision ledger', s: 'hash-chained · yours', c: 'zx' }
    ];
  }
  var common = [['kb', 'l', 'pep', 'r'], ['pep', 'r', 'mcp', 'l'], ['pep', 'r', 'core', 'l'], ['pep', 'r', 'email', 'l'], ['pep', 'b', 'dp', 't'], ['dp', 'r', 'ledger', 'l'], ['ledger', 'r', 'siem', 'l']];
  var LAYOUT = {
    sdk: {
      boundary: 'Your environment · VPC',
      nodes: [
        { id: 'agent', x: 44, y: 84, w: 220, h: 150, t: 'AI agent', s: 'member-chat-assist', c: 'host' },
        { id: 'pep', x: 62, y: 168, w: 184, h: 52, t: 'Zenstra SDK', s: 'inside the agent', c: 'zx' },
        { id: 'dp', x: 44, y: 300, w: 220, h: 86, t: 'Decision point', s: 'policy engine · your VPC', c: 'zx' }
      ].concat(tools(372, 188)),
      edges: [['agent', 'x', 'pep', 'x', 'M154 132 L154 166']].concat(common)
    },
    gateway: {
      boundary: 'Your environment · VPC',
      nodes: [
        { id: 'agent', x: 44, y: 110, w: 168, h: 86, t: 'AI agent', s: 'built or bought', c: 'host' },
        { id: 'pep', x: 238, y: 110, w: 118, h: 86, t: 'Gateway', s: 'MCP + API proxy', c: 'zx' },
        { id: 'dp', x: 44, y: 300, w: 220, h: 86, t: 'Decision point', s: 'policy engine · your VPC', c: 'zx' }
      ].concat(tools(390, 170)),
      edges: [['agent', 'r', 'pep', 'l']].concat(common)
    },
    endpoint: {
      boundary: 'Your environment · VPC and managed devices',
      frame: { x: 36, y: 70, w: 318, h: 186, t: 'Employee laptop' },
      nodes: [
        { id: 'agent', x: 56, y: 98, w: 170, h: 64, t: 'Copilot', s: 'employee AI tool', c: 'host' },
        { id: 'pep', x: 56, y: 182, w: 280, h: 56, t: 'Zenstra endpoint app', s: 'deployed by MDM', c: 'zx' },
        { id: 'dp', x: 44, y: 300, w: 220, h: 86, t: 'Decision point', s: 'policy engine · your VPC', c: 'zx' }
      ].concat(tools(390, 170)),
      edges: [['agent', 'x', 'pep', 'x', 'M141 162 L141 180']].concat(common)
    }
  };
  var EXTRA = [['dp', 'r', 'idp', 'l'], ['dp', 'r', 'ctrl', 'l', 'M264 343 C 300 343, 290 446, 330 446 L 566 446 C 594 446, 584 98, 604 98', 'decisions + redacted evidence']];
  var STEPS = [
    { n: ['agent', 'pep'], e: ['agent-pep'], p: [{ e: 'agent-pep' }] },
    { n: ['pep', 'dp', 'idp'], e: ['pep-dp', 'dp-idp'], p: [{ e: 'pep-dp' }, { e: 'dp-idp', delay: 500 }] },
    { n: ['kb', 'pep', 'dp'], e: ['kb-pep', 'pep-dp'], p: [{ e: 'kb-pep', kind: 'warn' }, { e: 'pep-dp', delay: 700 }] },
    { n: ['dp', 'pep'], e: ['pep-dp'], p: [{ e: 'pep-dp', rev: true, kind: 'bad' }], deny: true },
    { n: ['pep', 'email', 'mcp'], e: ['pep-email', 'pep-mcp'], p: [{ e: 'pep-mcp' }, { e: 'pep-email', kind: 'bad', stop: 0.55, delay: 300 }], blocked: true, deny: true },
    { n: ['dp', 'ledger', 'siem', 'ctrl'], e: ['dp-ledger', 'ledger-siem', 'dp-ctrl'], p: [{ e: 'dp-ledger' }, { e: 'dp-ctrl', delay: 300 }, { e: 'ledger-siem', delay: 900 }], deny: true }
  ];
  var N = { r: [1, 0], l: [-1, 0], t: [0, -1], b: [0, 1] };
  function anchor(n, a) {
    if (a === 'r') return [n.x + n.w, n.y + n.h / 2];
    if (a === 'l') return [n.x, n.y + n.h / 2];
    if (a === 't') return [n.x + n.w / 2, n.y];
    return [n.x + n.w / 2, n.y + n.h];
  }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  var mode = 'sdk', step = 0, eng = null, pathsById = {}, auto = !reduce, hover = false, elapsed = 0, packetTimer = 0, last = 0, visible = false;
  var STEP_MS = 3600;

  function render() {
    svg.innerHTML = '';
    pathsById = {};
    var L = LAYOUT[mode], byId = {};
    OUT.concat(L.nodes).forEach(function (n) { byId[n.id] = n; });
    // Environment boundary
    var gB = el('g', { class: 'boundary' }, svg);
    el('rect', { x: 16, y: 40, width: 562, height: 412, rx: 18 }, gB);
    var tag = el('text', { x: 36, y: 34 }, gB); tag.textContent = L.boundary.toUpperCase();
    var tag2 = el('text', { x: 604, y: 34, class: 'out' }, gB); tag2.textContent = 'OUTSIDE';
    if (L.frame) {
      var gF = el('g', { class: 'frame' }, svg);
      el('rect', { x: L.frame.x, y: L.frame.y, width: L.frame.w, height: L.frame.h, rx: 12 }, gF);
      var ft = el('text', { x: L.frame.x + 14, y: L.frame.y + 18 }, gF); ft.textContent = L.frame.t.toUpperCase();
    }
    // Edges first so nodes sit on top of them
    var gE = el('g', { class: 'edges' }, svg);
    L.edges.concat(EXTRA).forEach(function (d) {
      var a = byId[d[0]], b = byId[d[2]], id = d[0] + '-' + d[2], path;
      if (d[4]) path = d[4];
      else {
        var A = anchor(a, d[1]), B = anchor(b, d[3]);
        var k = Math.max(30, Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.42);
        var na = N[d[1]], nb = N[d[3]];
        path = 'M' + A[0] + ' ' + A[1] + ' C' + (A[0] + na[0] * k) + ' ' + (A[1] + na[1] * k) + ' ' + (B[0] + nb[0] * k) + ' ' + (B[1] + nb[1] * k) + ' ' + B[0] + ' ' + B[1];
      }
      var p = el('path', { id: 'ax-' + id, d: path, class: 'edge' + (d[0] === 'dp' && (d[2] === 'ctrl' || d[2] === 'idp') || d[2] === 'siem' ? ' cross' : ''), 'data-e': id, 'marker-end': 'url(#ax-arrow)' }, gE);
      pathsById[id] = p;
      if (d[5]) {
        var tx = el('text', { class: 'edge-label', dy: -6 }, gE);
        var tp = el('textPath', { href: '#ax-' + id, startOffset: '36%', 'text-anchor': 'middle' }, tx);
        tp.textContent = d[5];
      }
    });
    var defs = el('defs', {}, svg);
    var mk = el('marker', { id: 'ax-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 1 9 5 0 9Z', class: 'arrowhead' }, mk);
    // Nodes
    var gN = el('g', { class: 'nodes' }, svg);
    OUT.concat(L.nodes).forEach(function (n) {
      var g = el('g', { class: 'node ' + n.c, 'data-n': n.id }, gN);
      el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 10 }, g);
      var top = n.id === 'agent' && mode === 'sdk' ? n.y + 24 : n.y + n.h / 2 - 3;
      var t = el('text', { x: n.x + 14, y: top, class: 't' }, g); t.textContent = n.t;
      var s = el('text', { x: n.x + 14, y: top + 17, class: 's' }, g); s.textContent = n.s;
    });
    // Verdict tag and blocked mark
    var dp = byId.dp, em = byId.email;
    var v = el('g', { class: 'verdict-tag', transform: 'translate(' + (dp.x + dp.w - 108) + ' ' + (dp.y - 12) + ')' }, svg);
    el('rect', { width: 100, height: 22, rx: 6 }, v);
    var vt = el('text', { x: 50, y: 15, 'text-anchor': 'middle' }, v); vt.textContent = 'BLOCK · POL-114';
    var x = el('g', { class: 'x-mark', transform: 'translate(' + (em.x - 22) + ' ' + (em.y + em.h / 2) + ')' }, svg);
    el('circle', { r: 9 }, x); el('path', { d: 'M-3.5 -3.5 3.5 3.5M3.5 -3.5 -3.5 3.5' }, x);
    eng = new Packets(el('g', { class: 'pk-layer' }, svg));
  }

  function setStep(i, user) {
    step = (i + STEPS.length) % STEPS.length;
    elapsed = 0; packetTimer = 99999;
    var S = STEPS[step];
    svg.classList.add('focus');
    $$('.node', svg).forEach(function (g) { g.classList.toggle('on', S.n.indexOf(g.getAttribute('data-n')) > -1); });
    $$('.edge', svg).forEach(function (p) { p.classList.toggle('on', S.e.indexOf(p.getAttribute('data-e')) > -1); });
    var dpn = $('.node[data-n="dp"]', svg); if (dpn) dpn.classList.toggle('deny', step === 3);
    var emn = $('.node[data-n="email"]', svg); if (emn) emn.classList.toggle('blocked', !!S.blocked);
    svg.classList.toggle('show-verdict', !!S.deny);
    svg.classList.toggle('show-x', !!S.blocked);
    stepsEl.forEach(function (li, n) {
      li.classList.toggle('on', n === step); li.classList.toggle('done', n < step);
      $('button', li).setAttribute('aria-current', n === step ? 'step' : 'false');
      var fill = $('.fill', li); if (fill) fill.style.transform = 'scaleY(' + (n < step ? 1 : 0) + ')';
    });
    if (eng) eng.clear();
    if (user) setAuto(false);
    var live = $('.ax-live', root); if (live) live.textContent = 'Step ' + (step + 1) + ' of 6: ' + $('b', stepsEl[step]).textContent;
  }
  function launchPackets() {
    STEPS[step].p.forEach(function (q) {
      var path = pathsById[q.e]; if (!path) return;
      eng.add(path, { kind: q.kind || 'ok', rev: q.rev, stop: q.stop, delay: q.delay || 0, dur: Math.max(700, path.getTotalLength() * 3.2) });
    });
  }
  function setAuto(on) {
    auto = on;
    if (replay) replay.innerHTML = on ? replay.getAttribute('data-pause') : replay.getAttribute('data-play');
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    modeBtns.forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-mode') === m)); b.tabIndex = b.getAttribute('data-mode') === m ? 0 : -1; });
    $$('[data-mode-copy]', root).forEach(function (p) { p.hidden = p.getAttribute('data-mode-copy') !== m; });
    var swap = function () { render(); setStep(0); };
    if (M && !reduce) {
      M.animate(svg, { opacity: [1, 0], transform: ['scale(1)', 'scale(0.985)'] }, { duration: 0.22 }).then(function () {
        swap(); M.animate(svg, { opacity: [0, 1], transform: ['scale(0.985)', 'scale(1)'] }, { duration: 0.45, ease: [0.16, 1, 0.3, 1] });
      });
    } else swap();
  }
  modeBtns.forEach(function (b, i) {
    b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var nb = modeBtns[(i + (e.key === 'ArrowRight' ? 1 : -1) + modeBtns.length) % modeBtns.length];
      nb.focus(); setMode(nb.getAttribute('data-mode'));
    });
  });
  stepsEl.forEach(function (li, i) { $('button', li).addEventListener('click', function () { setStep(i, true); }); });
  if (replay) replay.addEventListener('click', function () { if (auto) setAuto(false); else { setAuto(true); setStep(0); } });
  root.addEventListener('mouseenter', function () { hover = true; });
  root.addEventListener('mouseleave', function () { hover = false; });

  render(); setStep(0);
  if (reduce) { setAuto(false); return; }
  new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0.25 }).observe(svg);
  (function loop(ts) {
    var dt = last ? Math.min(60, ts - last) : 0; last = ts;
    if (visible && !document.hidden) {
      packetTimer += dt;
      if (packetTimer > 1900) { packetTimer = 0; launchPackets(); }
      eng.step(dt);
      if (auto && !hover) {
        elapsed += dt;
        var fill = $('.fill', stepsEl[step]); if (fill) fill.style.transform = 'scaleY(' + Math.min(1, elapsed / STEP_MS) + ')';
        if (elapsed >= STEP_MS) setStep(step + 1);
      }
    }
    requestAnimationFrame(loop);
  })(performance.now());
})();
