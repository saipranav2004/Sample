/* Zenstra v5 canvas engines.
 * GateStream  — agent actions stream toward a decision line. Most pass (cyan),
 *               some wait for a person (amber), some are stopped (coral).
 * WorkflowViz — an agent workflow graph; one hop is blocked before it runs.
 * CloudViz    — your cloud boundary with a gateway; payloads never leave.
 * EdrViz      — a fleet of devices scanned for AI agents; rogue ones contained.
 * IntroField  — the intro backdrop; agents converge into the Zenstra mark,
 *               which then opens to reveal the page.
 * Each engine pauses off screen or in a hidden tab, and draws one still frame
 * under prefers-reduced-motion.
 */
/* ES module port of the site's canvas engines (was assets/fx5.js). */
  var REDUCE = document.documentElement.classList.contains('reduce') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = function () { return Math.min(window.devicePixelRatio || 1, 2); };
  var css = function (n, fb) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || fb; };
  function rgba(hex, a) { hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.replace(/./g, '$&$&'); return 'rgba(' + parseInt(hex.slice(0, 2), 16) + ',' + parseInt(hex.slice(2, 4), 16) + ',' + parseInt(hex.slice(4, 6), 16) + ',' + a + ')'; }
  function rand(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* Shared canvas host with resize, visibility and frame loop. */
  function Host(el, draw, opts) {
    opts = opts || {};
    this.el = el; this.draw = draw; this.c = document.createElement('canvas'); el.appendChild(this.c);
    this.g = this.c.getContext('2d'); this.vis = false; this.running = false; this.t = 0; this.active = opts.active !== false;
    var self = this;
    this.onWinResize = function () { self.resize(); };
    this.onVis = function () { self.loop(); };
    if ('ResizeObserver' in window) { this.ro = new ResizeObserver(this.onWinResize); this.ro.observe(el); } else window.addEventListener('resize', this.onWinResize);
    if ('IntersectionObserver' in window) { this.io = new IntersectionObserver(function (e) { self.vis = e[0].isIntersecting; self.loop(); }, { rootMargin: '100px' }); this.io.observe(el); } else { this.vis = true; }
    document.addEventListener('visibilitychange', this.onVis);
  }
  // Stop drawing and release observers and listeners (a page unmounting).
  Host.prototype.destroy = function () {
    this.dead = true; this.active = false;
    if (this.ro) this.ro.disconnect(); else window.removeEventListener('resize', this.onWinResize);
    if (this.io) this.io.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    if (this.extra) this.extra();
    if (this.c.parentNode) this.c.parentNode.removeChild(this.c);
  };
  Host.prototype.resize = function () {
    var w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return;
    var d = DPR(); this.w = w; this.h = h; this.d = d;
    this.c.width = Math.round(w * d); this.c.height = Math.round(h * d);
    if (this.onResize) this.onResize(w, h);
    this.frame(0);
  };
  Host.prototype.frame = function (dt) { if (!this.w) return; var g = this.g; g.setTransform(this.d, 0, 0, this.d, 0, 0); g.clearRect(0, 0, this.w, this.h); this.draw(g, this.w, this.h, dt, this.t); };
  Host.prototype.loop = function () {
    var self = this;
    if (this.dead) return;
    if (REDUCE) { if (!this.stilled) { this.stilled = true; this.t = 6; if (this.warm) this.warm(); this.frame(0); } return; }
    if (this.running || !this.vis || document.hidden || !this.active) return;
    this.running = true; var last = performance.now();
    var step = function (now) {
      if (self.dead || !self.vis || document.hidden || !self.active) { self.running = false; return; }
      var dt = Math.min(0.05, (now - last) / 1000); last = now; self.t += dt;
      self.frame(dt); requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  Host.prototype.setActive = function (on) { this.active = on; if (on) this.loop(); };

  /* ---------------- GateStream ---------------- */
  function GateStream(el, opts) {
    opts = opts || {};
    var gateAt = opts.gate || 0.62, dark = !!opts.dark, density = opts.density || 1;
    var P = [], bursts = [], R = rand(11), pointerY = null;
    var col = {};
    var theme = function () {
      col.idle = dark ? '#5d7fa6' : css('--ink-3', '#6b87a6');
      col.ok = dark ? '#5cd2ff' : css('--accent-2', '#00a8ef');
      col.hold = css('--warn', '#d89a32');
      col.bad = css('--bad', '#d94a44');
      col.gate = dark ? '#00a8ef' : css('--accent', '#005aa4');
    };
    theme();
    var spawn = function (w, h, init) {
      var r = R(), kind = r < 0.07 ? 'block' : r < 0.14 ? 'hold' : 'ok';
      return { x: init ? R() * w : -20 - R() * 120, lane: R(), sp: (80 + R() * 110) * (w / 1400 + 0.5), len: 16 + R() * 40, kind: kind, state: 0, hold: 0, a: 0.35 + R() * 0.5, ph: R() * 6.28, wob: 3 + R() * 10 };
    };
    var host = new Host(el, function (g, w, h, dt, t) {
      var gx = w * gateAt;
      // gate
      var grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, rgba(col.gate, 0)); grd.addColorStop(0.5, rgba(col.gate, dark ? 0.9 : 0.6)); grd.addColorStop(1, rgba(col.gate, 0));
      g.fillStyle = grd; g.fillRect(gx - 0.75, 0, 1.5, h);
      var glow = g.createLinearGradient(gx - 40, 0, gx + 40, 0);
      glow.addColorStop(0, rgba(col.gate, 0)); glow.addColorStop(0.5, rgba(col.gate, dark ? 0.16 : 0.08)); glow.addColorStop(1, rgba(col.gate, 0));
      g.fillStyle = glow; g.fillRect(gx - 40, 0, 80, h);
      for (var y = 0; y < h; y += 28) { g.fillStyle = rgba(col.gate, 0.35 * Math.sin(Math.PI * y / h)); g.fillRect(gx - 4, y, 8, 1); }
      // streaks
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        var dxn = Math.min(1, Math.abs(p.x - gx) / (w * 0.42));
        var spread = 0.36 + 0.6 * (1 - Math.pow(1 - dxn, 2));
        var ly = h * (0.5 + (p.lane - 0.5) * 0.92 * spread);
        var y = ly + Math.sin(p.x * 0.006 + p.ph + t * 0.6) * p.wob * dxn;
        if (pointerY != null) y += (pointerY - ly) * 0.06 * Math.exp(-Math.pow((ly - pointerY) / 140, 2));
        if (p.state === 0) { // approaching
          p.x += p.sp * dt;
          if (p.x >= gx - 2 && p.kind !== 'ok') { p.x = gx - 2; p.state = 1; p.hold = p.kind === 'hold' ? 1.1 + R() * 0.8 : 0; if (p.kind === 'block') bursts.push({ x: gx, y: y, r: 2, a: 1, c: col.bad }); else bursts.push({ x: gx, y: y, r: 2, a: 0.8, c: col.hold }); }
          else if (p.x >= gx && p.kind === 'ok') p.state = 2;
        } else if (p.state === 1) { // at the gate
          if (p.kind === 'hold') { p.hold -= dt; if (p.hold <= 0) { p.state = 2; p.x = gx + 1; } }
          else { p.a -= dt * 1.6; if (p.a <= 0) { P[i] = spawn(w, h); continue; } }
        } else { p.x += p.sp * dt * 1.08; }
        if (p.x > w + 40) { P[i] = spawn(w, h); continue; }
        var past = p.state === 2, c = p.state === 0 ? col.idle : p.kind === 'block' ? col.bad : p.kind === 'hold' && !past ? col.hold : past && p.kind === 'hold' ? col.hold : col.ok;
        var len = p.state === 1 ? p.len * 0.5 : p.len;
        var a = p.a * (p.state === 0 ? (dark ? 0.6 : 0.62) : 1);
        var lg = g.createLinearGradient(p.x - len, 0, p.x, 0);
        lg.addColorStop(0, rgba(c, 0)); lg.addColorStop(1, rgba(c, a));
        g.strokeStyle = lg; g.lineWidth = past || p.state === 1 ? 1.8 : 1.3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x - len, y); g.lineTo(p.x, y); g.stroke();
        if (p.state === 1) { g.fillStyle = rgba(c, a); g.beginPath(); g.arc(p.x, y, 2.4, 0, 6.29); g.fill(); }
      }
      for (var k = bursts.length - 1; k >= 0; k--) {
        var b = bursts[k]; b.r += dt * 34; b.a -= dt * 1.1;
        if (b.a <= 0) { bursts.splice(k, 1); continue; }
        g.strokeStyle = rgba(b.c, b.a * 0.8); g.lineWidth = 1.2; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.29); g.stroke();
      }
    });
    host.onResize = function (w, h) {
      var n = Math.round(Math.min(420, (w * h) / 2600) * density);
      P = []; for (var i = 0; i < n; i++) P.push(spawn(w, h, true));
    };
    host.warm = function () { for (var s = 0; s < 240; s++) { host.t += 0.03; host.draw(host.g, host.w, host.h, 0.03, host.t); } };
    host.resize();
    el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); pointerY = e.clientY - r.top; }, { passive: true });
    el.addEventListener('pointerleave', function () { pointerY = null; });
    host.theme = function () { theme(); if (!host.running) host.frame(0); };
    return host;
  }

  /* Helpers for product visuals */
  function pill(g, x, y, w, h, r, fill, stroke) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); } }
  var C = { ink: '#dce9f9', dim: '#5d7fa6', line: '#1b4373', ok: '#5cd2ff', good: '#2fc79b', bad: '#f0736c', warn: '#e8b25c', card: '#0c2a4c' };
  function label(g, s, x, y, c, size, align) { g.font = '500 ' + (size || 11) + 'px "JetBrains Mono", monospace'; g.fillStyle = c || C.ink; g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y); }

  /* ---------------- WorkflowViz ---------------- */
  function WorkflowViz(el) {
    var nodes, edges, packets = [], bursts = [], tag = null, R = rand(5), count = 0;
    var layout = function (w, h) {
      var big = h > 420, top = h * (big ? 0.15 : 0.26), H = h * (big ? 0.2 : 0.58), L = w * (w < 500 ? 0.12 : 0.1), W = w * (w < 500 ? 0.76 : 0.78);
      var N = function (id, fx, fy, txt) { return { id: id, x: L + W * fx, y: top + H * fy, t: txt }; };
      nodes = [N('in', 0.0, 0.5, 'trigger'), N('ag', 0.24, 0.5, 'agent'), N('kb', 0.5, 0.08, 'kb.search'), N('crm', 0.5, 0.5, 'crm.read'), N('mail', 0.5, 0.92, 'email.send'), N('out', 0.78, 0.3, 'reply'), N('apr', 0.78, 0.82, 'approve')];
      var by = {}; nodes.forEach(function (n) { by[n.id] = n; });
      edges = [['in', 'ag'], ['ag', 'kb'], ['ag', 'crm'], ['ag', 'mail'], ['kb', 'out'], ['crm', 'out'], ['mail', 'apr']].map(function (e) { return { a: by[e[0]], b: by[e[1]], block: e[1] === 'mail' }; });
    };
    var pt = function (e, k) { var mx = (e.a.x + e.b.x) / 2; var x = Math.pow(1 - k, 3) * e.a.x + 3 * Math.pow(1 - k, 2) * k * mx + 3 * (1 - k) * k * k * mx + k * k * k * e.b.x; var y = Math.pow(1 - k, 3) * e.a.y + 3 * Math.pow(1 - k, 2) * k * e.a.y + 3 * (1 - k) * k * k * e.b.y + k * k * k * e.b.y; return [x, y]; };
    var acc = 0;
    var host = new Host(el, function (g, w, h, dt, t) {
      acc += dt;
      if (acc > 0.5) { acc = 0; var es = edges.filter(function (e) { return e.a.id === 'ag' || e.a.id === 'in'; }); var e = es[Math.floor(R() * es.length)]; count++; packets.push({ e: e, k: 0, sp: 0.55 + R() * 0.3, bad: e.block && count % 2 === 0 }); }
      edges.forEach(function (e) {
        g.strokeStyle = e.block ? 'rgba(240,115,108,0.35)' : 'rgba(92,210,255,0.22)'; g.lineWidth = 1.2; g.setLineDash(e.block ? [4, 4] : []);
        g.beginPath(); var mx = (e.a.x + e.b.x) / 2; g.moveTo(e.a.x, e.a.y); g.bezierCurveTo(mx, e.a.y, mx, e.b.y, e.b.x, e.b.y); g.stroke(); g.setLineDash([]);
      });
      for (var i = packets.length - 1; i >= 0; i--) {
        var p = packets[i]; p.k += p.sp * dt;
        if (p.bad && p.k >= 0.86) { var q = pt(p.e, 0.86); bursts.push({ x: q[0], y: q[1], r: 3, a: 1 }); tag = { x: q[0], y: q[1], a: 1.6 }; packets.splice(i, 1); continue; }
        if (p.k >= 1) { var nx = edges.filter(function (e) { return e.a === p.e.b; }); packets.splice(i, 1); if (nx.length && !p.e.block) packets.push({ e: nx[0], k: 0, sp: p.sp, bad: false }); else if (nx.length && p.e.block) packets.push({ e: nx[0], k: 0, sp: p.sp, bad: false, hold: true }); continue; }
        var xy = pt(p.e, p.k), c = p.bad ? C.bad : p.hold ? C.warn : C.ok;
        g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 10; g.beginPath(); g.arc(xy[0], xy[1], 3, 0, 6.29); g.fill(); g.shadowBlur = 0;
      }
      var fs = w < 500 ? 9.5 : 11;
      nodes.forEach(function (n) {
        g.font = '500 ' + fs + 'px "JetBrains Mono", monospace'; var tw = g.measureText(n.t).width + (w < 500 ? 12 : 22);
        var hot = n.id === 'mail' && tag && tag.a > 0;
        pill(g, n.x - tw / 2, n.y - 14, tw, 28, 8, hot ? 'rgba(240,115,108,0.16)' : C.card, hot ? C.bad : C.line);
        label(g, n.t, n.x, n.y + 0.5, hot ? '#fff' : C.ink, fs);
      });
      for (var k = bursts.length - 1; k >= 0; k--) { var b = bursts[k]; b.r += dt * 40; b.a -= dt * 1.2; if (b.a <= 0) { bursts.splice(k, 1); continue; } g.strokeStyle = rgba(C.bad, b.a); g.lineWidth = 1.4; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.29); g.stroke(); }
      if (tag) { tag.a -= dt * 0.7; if (tag.a > 0) { var al = Math.min(1, tag.a); g.globalAlpha = al; pill(g, tag.x - 62, tag.y - 46, 124, 22, 6, 'rgba(240,115,108,0.95)'); label(g, 'BLOCK · POL-114', tag.x, tag.y - 35, '#fff', 10.5); g.globalAlpha = 1; } else tag = null; }
    }, { active: false });
    host.onResize = layout; host.resize();
    host.warm = function () { tag = { x: nodes[4].x - 30, y: nodes[4].y, a: 1 }; };
    return host;
  }

  /* ---------------- CloudViz ---------------- */
  function CloudViz(el) {
    var box, gw, inner, outer, packets = [], bursts = [], R = rand(9), acc = 0, n = 0;
    var layout = function (w, h) {
      var big = h > 420; box = { x: w * 0.34, y: h * (big ? 0.11 : 0.14), w: w * 0.58, h: h * (big ? 0.22 : 0.62) };
      gw = { x: box.x, y: box.y + box.h / 2 };
      inner = [{ x: box.x + box.w * 0.35, y: box.y + box.h * 0.25, t: 'agent' }, { x: box.x + box.w * 0.35, y: box.y + box.h * 0.75, t: 'agent' }, { x: box.x + box.w * 0.75, y: box.y + box.h * 0.2, t: 'core' }, { x: box.x + box.w * 0.75, y: box.y + box.h * 0.5, t: 'LOS' }, { x: box.x + box.w * 0.75, y: box.y + box.h * 0.8, t: 'ledger' }];
      outer = [{ x: w * 0.12, y: box.y + box.h * 0.15, t: 'Bedrock' }, { x: w * 0.12, y: box.y + box.h * 0.5, t: 'Azure OpenAI' }, { x: w * 0.12, y: box.y + box.h * 0.85, t: 'Vertex AI' }];
    };
    var host = new Host(el, function (g, w, h, dt, t) {
      acc += dt;
      if (acc > 0.42) { acc = 0; n++; var a = inner[Math.floor(R() * 2)]; var to = n % 4 === 0 ? 'leak' : n % 2 ? 'model' : 'tool'; packets.push({ from: a, to: to, k: 0, tgt: to === 'tool' ? inner[2 + Math.floor(R() * 3)] : outer[Math.floor(R() * 3)] }); }
      g.setLineDash([5, 5]); pill(g, box.x, box.y, box.w, box.h, 18, 'rgba(0,168,239,0.04)', 'rgba(92,210,255,0.45)'); g.setLineDash([]);
      label(g, 'YOUR CLOUD · VPC', box.x + 16, box.y - 12, C.ok, 10.5, 'left');
      outer.forEach(function (o) { g.font = '500 11px "JetBrains Mono", monospace'; var tw = g.measureText(o.t).width + 22; pill(g, o.x - tw / 2, o.y - 13, tw, 26, 13, 'rgba(12,42,76,0.7)', C.line); label(g, o.t, o.x, o.y + 0.5, C.dim); });
      inner.forEach(function (o) { var tw = 64; pill(g, o.x - tw / 2, o.y - 13, tw, 26, 8, C.card, C.line); label(g, o.t, o.x, o.y + 0.5, C.ink); });
      var pulse = 0.5 + Math.sin(t * 3) * 0.2;
      pill(g, gw.x - 20, gw.y - 26, 40, 52, 10, '#0a3a66', '#00a8ef'); g.globalAlpha = pulse; pill(g, gw.x - 26, gw.y - 32, 52, 64, 14, null, 'rgba(0,168,239,0.5)'); g.globalAlpha = 1;
      label(g, 'GW', gw.x, gw.y + 1, '#fff', 11);
      for (var i = packets.length - 1; i >= 0; i--) {
        var p = packets[i]; p.k += dt * 0.8; var x, y, c = C.ok;
        if (p.to === 'tool') { x = p.from.x + (p.tgt.x - p.from.x) * Math.min(1, p.k); y = p.from.y + (p.tgt.y - p.from.y) * Math.min(1, p.k); if (p.k >= 1) { packets.splice(i, 1); continue; } }
        else {
          var k1 = Math.min(1, p.k * 1.6); x = p.from.x + (gw.x - p.from.x) * k1; y = p.from.y + (gw.y - p.from.y) * k1;
          if (k1 >= 1) {
            if (p.to === 'leak') { bursts.push({ x: gw.x - 22, y: gw.y, r: 4, a: 1 }); packets.splice(i, 1); continue; }
            var k2 = Math.min(1, (p.k - 1 / 1.6) * 2.2); x = gw.x + (p.tgt.x - gw.x) * k2; y = gw.y + (p.tgt.y - gw.y) * k2; c = C.good;
            if (k2 >= 1) { packets.splice(i, 1); continue; }
          }
          if (p.to === 'leak') c = k1 > 0.6 ? C.bad : C.ok;
        }
        g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 8; g.beginPath(); g.arc(x, y, p.to === 'model' && c === C.good ? 2.2 : 3, 0, 6.29); g.fill(); g.shadowBlur = 0;
      }
      for (var k = bursts.length - 1; k >= 0; k--) { var b = bursts[k]; b.r += dt * 36; b.a -= dt * 1.2; if (b.a <= 0) { bursts.splice(k, 1); continue; } g.strokeStyle = rgba(C.bad, b.a); g.lineWidth = 1.4; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.29); g.stroke(); }
      label(g, 'payloads stay inside', box.x + box.w * 0.5, box.y + box.h + 18, C.dim, 10.5);
    }, { active: false });
    host.onResize = layout; host.resize();
    return host;
  }

  /* ---------------- EdrViz ---------------- */
  function EdrViz(el) {
    var dev = [], cols = 11, rows = 5, R = rand(3), scanX = 0, found = 0, contained = 0, cycle = 0;
    var layout = function (w, h) {
      dev = []; var big = h > 420, gx = w * 0.07, gw = w * 0.86, gy = h * (big ? 0.12 : 0.1), gh = h * (big ? 0.2 : 0.6);
      cols = w < 480 ? 7 : 11;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) dev.push({ x: gx + gw * (c + 0.5) / cols, y: gy + gh * (r + 0.5) / rows, ai: R() < 0.32, rogue: false, seen: 0, cont: 0 });
      var picks = [Math.floor(dev.length * 0.37), Math.floor(dev.length * 0.71)]; picks.forEach(function (i) { dev[i].ai = true; dev[i].rogue = true; });
      scanX = gx - 20;
    };
    var host = new Host(el, function (g, w, h, dt, t) {
      var big = h > 420, gx = w * 0.07, gw = w * 0.86, gy = h * (big ? 0.12 : 0.1), gh = h * (big ? 0.2 : 0.6);
      scanX += dt * w * 0.16;
      if (scanX > gx + gw + 80) { scanX = gx - 40; cycle++; found = 0; contained = 0; dev.forEach(function (d) { d.seen = 0; d.cont = 0; }); }
      var sg = g.createLinearGradient(scanX - 70, 0, scanX, 0); sg.addColorStop(0, 'rgba(0,168,239,0)'); sg.addColorStop(1, 'rgba(0,168,239,0.22)');
      g.fillStyle = sg; g.fillRect(scanX - 70, gy - 16, 70, gh + 32); g.fillStyle = 'rgba(92,210,255,0.9)'; g.fillRect(scanX, gy - 16, 1.5, gh + 32);
      var dw = Math.min(30, gw / cols * 0.6), dh = dw * 0.62;
      dev.forEach(function (d) {
        if (!d.seen && d.x < scanX) { d.seen = 1; if (d.ai) found++; if (d.rogue) { d.cont = 1.4; contained++; } }
        var c = !d.seen ? 'rgba(93,127,166,0.35)' : d.rogue ? C.bad : d.ai ? C.ok : 'rgba(93,127,166,0.6)';
        pill(g, d.x - dw / 2, d.y - dh / 2, dw, dh, 3, null, c); g.fillStyle = c; g.fillRect(d.x - dw * 0.62, d.y + dh / 2 + 2, dw * 1.24, 1.6);
        if (d.seen && d.ai && !d.rogue) { g.fillStyle = C.ok; g.beginPath(); g.arc(d.x, d.y, 1.8, 0, 6.29); g.fill(); }
        if (d.rogue && d.seen) {
          d.cont = Math.max(0, d.cont - dt * 0.6);
          var rr = dw * 0.9 + (1.4 - d.cont) * 6; g.strokeStyle = rgba(C.bad, 0.3 + d.cont * 0.4); g.lineWidth = 1.2; g.beginPath(); g.arc(d.x, d.y, rr, 0, 6.29); g.stroke();
          g.fillStyle = C.bad; g.fillRect(d.x - 3, d.y - 1, 6, 4.5); g.strokeStyle = C.bad; g.beginPath(); g.arc(d.x, d.y - 1.5, 2.2, Math.PI, 0); g.stroke();
        }
      });
      label(g, 'devices ' + (cols * rows * 6 + 2) + '   ·   AI apps ' + (found * 3) + '   ·   contained ' + contained, w / 2, gy + gh + 26, C.dim, 11);
    }, { active: false });
    host.onResize = layout; host.resize();
    host.warm = function () { scanX = w0() * 0.6; function w0() { return host.w; } };
    return host;
  }

  /* ---------------- LensField ----------------
   * After Antigravity's hero: a quiet field of short dashes covers the whole
   * hero. Around a soft ring the dashes grow, turn to face outward and take on
   * brand colour. The ring drifts on its own and eases after the pointer with a
   * lag, so moving the mouse sweeps it smoothly across the field. Dashes over
   * the text block are kept faint so the headline stays clean.
   */
  function LensField(el, opts) {
    opts = opts || {};
    var dots = [], R = rand(21), lens = null, target = null, ptr = null, lastMove = -10, maskEl = opts.mask || null, mask = null;
    var col = {};
    var theme = function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
      col.a = dark ? '#5cd2ff' : '#00a8ef'; col.b = dark ? '#7fa8ff' : '#005aa4'; col.c = dark ? '#ff8f86' : '#e5574f'; col.dust = dark ? 'rgba(124,148,174,0.35)' : 'rgba(107,135,166,0.28)'; col.dark = dark;
    };
    theme();
    var idle = function (w, h, t) { var cx = opts.cx != null ? opts.cx : 0.66, cy = opts.cy != null ? opts.cy : 0.5; return [w * cx + Math.sin(t * 0.23) * w * 0.07 + Math.sin(t * 0.51 + 1.7) * w * 0.025, h * cy + Math.cos(t * 0.19) * h * 0.08 + Math.sin(t * 0.43) * h * 0.03]; };
    var host = new Host(el, function (g, w, h, dt, t) {
      var tgt = (ptr && t - lastMove < 6) ? ptr : idle(w, h, t);
      if (!lens) lens = tgt.slice();
      var k = 1 - Math.exp(-dt / (ptr ? 0.55 : 1.4));
      lens[0] += (tgt[0] - lens[0]) * k; lens[1] += (tgt[1] - lens[1]) * k;
      if (maskEl && (Math.round(t * 4) % 4 === 0 || !mask)) { var er = el.getBoundingClientRect(), mr = maskEl.getBoundingClientRect(); mask = [mr.left - er.left - 24, mr.top - er.top - 16, mr.right - er.left + 24, mr.bottom - er.top + 16]; }
      var Rr = Math.min(w, h) * 0.24 + Math.sin(t * 0.9) * 10 + Math.cos(t * 2.1) * 5, band = 46;
      var lx = lens[0], ly = lens[1];
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var dx = d.x - lx, dy = d.y - ly, dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var e = (dist - Rr) / band, ring = Math.exp(-e * e);
        var inner = dist < Rr ? 0.16 * (1 - dist / Rr) : 0;
        var dust = (Math.sin(d.x * 0.013 + t * 0.7 + d.p) * Math.cos(d.y * 0.017 - t * 0.5) + 1) * 0.5;
        var sc = ring * 1.0 + inner + Math.pow(dust, 6) * 0.35;
        if (sc < 0.08) continue;
        var push = ring * 9, x = d.x + dx / dist * push, y = d.y + dy / dist * push;
        var fade = 1;
        if (mask && x > mask[0] && x < mask[2] && y > mask[1] && y < mask[3]) fade = 0.16;
        var ang = Math.atan2(dy, dx) + Math.sin(t * 0.8 + d.p) * 0.35;
        var len = 2.2 + sc * 8.5, wid = 1.1 + sc * 1.6;
        var hue = (Math.sin(Math.atan2(dy, dx) * 1.0 + t * 0.35 + d.p * 0.2) + 1) * 0.5;
        g.globalAlpha = Math.min(1, (0.25 + sc * 0.9)) * fade * (ring > 0.12 ? 1 : 0.7);
        g.fillStyle = ring > 0.12 ? (hue < 0.62 ? col.a : hue < 0.9 ? col.b : col.c) : col.dust;
        g.setTransform(Math.cos(ang) * host.d, Math.sin(ang) * host.d, -Math.sin(ang) * host.d, Math.cos(ang) * host.d, x * host.d, y * host.d);
        g.beginPath(); var r = wid / 2; g.moveTo(-len / 2 + r, -r); g.lineTo(len / 2 - r, -r); g.arc(len / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2); g.lineTo(-len / 2 + r, r); g.arc(-len / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5); g.fill();
      }
      g.globalAlpha = 1; g.setTransform(host.d, 0, 0, host.d, 0, 0);
    });
    host.onResize = function (w, h) {
      var sp = opts.spacing || (w < 700 ? 20 : 22); dots = [];
      for (var y = sp / 2; y < h; y += sp) for (var x = sp / 2; x < w; x += sp) dots.push({ x: x + (R() - 0.5) * sp * 0.8, y: y + (R() - 0.5) * sp * 0.8, p: R() * 6.28 });
    };
    host.resize();
    var onMove = function (e) {
      var r = el.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) { ptr = null; return; }
      ptr = [e.clientX - r.left, e.clientY - r.top]; lastMove = host.t;
    };
    var onLeave = function () { ptr = null; };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    host.extra = function () { window.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); };
    host.theme = function () { theme(); if (!host.running) host.frame(0); };
    return host;
  }

  /* ---------------- IntroField ----------------
   * The intro backdrop: navy with one soft light and fine grain, and a quiet
   * field of agents with faint links. converge() pulls every agent into the
   * Zenstra mark; open() cuts a mark-shaped window that grows until the page
   * underneath is fully revealed.
   */
  function IntroField(host, opts) {
    opts = opts || {};
    var cv = document.createElement('canvas'); cv.className = 'intro-cv'; host.insertBefore(cv, host.firstChild);
    var g = cv.getContext('2d'); if (!g) return null;
    var w = 0, h = 0, d = 1, R = rand(7), pts = [], grain = null, raf = 0, t0 = performance.now(), last = t0;
    var mode = 'idle', mAt = 0, mDur = 1, cx = 0, cy = 0, s0 = 22, s1 = 2000, glowAt = -10, done = null, fadeIn = 0;
    var ease = { inOut: function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }, in: function (k) { return k * k * k; }, expoInOut: function (k) { return k === 0 ? 0 : k === 1 ? 1 : k < 0.5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2; } };
    function makeGrain() {
      var n = document.createElement('canvas'); n.width = n.height = 160; var c = n.getContext('2d'), im = c.createImageData(160, 160);
      for (var i = 0; i < im.data.length; i += 4) { var v = R() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 10; }
      c.putImageData(im, 0, 0); grain = g.createPattern(n, 'repeat');
    }
    function resize() {
      w = innerWidth; h = innerHeight; d = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
      var n = Math.max(70, Math.min(190, Math.round(w * h / 8200)));
      if (!pts.length) for (var i = 0; i < n; i++) {
        var ag = R() < 0.14;
        pts.push({ x: R() * w, y: R() * h, vx: (R() - 0.5) * 9, vy: (R() - 0.5) * 7, r: ag ? 1.6 + R() * 0.8 : 0.7 + R() * 0.8, a: ag ? 0.75 : 0.22 + R() * 0.3, ag: ag, p: R() * 6.28, lag: 0 });
      }
      makeGrain();
    }
    // Four-point concave star with the proportions of the Zenstra mark.
    function star(x, y, s) {
      var ax = s, ay = s * 0.913, k = 0.13;
      g.beginPath(); g.moveTo(x, y - ay);
      g.quadraticCurveTo(x + ax * k, y - ay * k, x + ax, y);
      g.quadraticCurveTo(x + ax * k, y + ay * k, x, y + ay);
      g.quadraticCurveTo(x - ax * k, y + ay * k, x - ax, y);
      g.quadraticCurveTo(x - ax * k, y - ay * k, x, y - ay);
      g.closePath();
    }
    function backdrop(t) {
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = '#04101f'; g.fillRect(0, 0, w, h);
      var br = 0.2 + Math.sin(t * 0.8) * 0.035, L = g.createRadialGradient(w / 2, h * 0.52, 0, w / 2, h * 0.52, Math.max(w, h) * 0.62);
      L.addColorStop(0, 'rgba(0,110,190,' + br + ')'); L.addColorStop(0.45, 'rgba(0,70,140,' + br * 0.4 + ')'); L.addColorStop(1, 'rgba(4,16,31,0)');
      g.fillStyle = L; g.fillRect(0, 0, w, h);
      if (grain) { g.fillStyle = grain; g.fillRect(0, 0, w, h); }
    }
    function field(t, dt) {
      var conv = mode === 'converge' || mode === 'open', k = conv ? Math.max(0, Math.min(1, (performance.now() - mAt) / mDur)) : 0;
      var vis = Math.max(0, Math.min(1, fadeIn));
      // links between nearby agents and their neighbours
      if (!conv) {
        g.lineWidth = 1;
        for (var i = 0; i < pts.length; i++) { var a = pts[i]; if (!a.ag) continue;
          for (var j = 0; j < pts.length; j++) { if (i === j) continue; var b = pts[j], dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy;
            if (dd < 150 * 150) { g.strokeStyle = 'rgba(92,180,255,' + (0.15 * (1 - Math.sqrt(dd) / 150) * vis) + ')'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); } } }
      }
      for (var q = 0; q < pts.length; q++) {
        var p = pts[q];
        if (!conv) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10; if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
          var tw = 0.75 + Math.sin(t * 1.3 + p.p) * 0.25;
          g.globalAlpha = p.a * tw * vis; g.fillStyle = p.ag ? '#5cd2ff' : '#7f9cc0';
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
          if (p.ag) { g.globalAlpha = 0.12 * vis; g.beginPath(); g.arc(p.x, p.y, p.r * 4, 0, 6.283); g.fill(); }
        } else {
          if (!p.sx) { p.sx = p.x; p.sy = p.y; var dist = Math.hypot(p.x - cx, p.y - cy); p.lag = Math.min(0.35, dist / Math.hypot(w, h) * 0.45); }
          var kk = Math.max(0, Math.min(1, (k - p.lag) / (1 - p.lag))), e = ease.in(kk);
          var x = p.sx + (cx - p.sx) * e, y = p.sy + (cy - p.sy) * e;
          var e2 = ease.in(Math.max(0, kk - 0.022)), px = p.sx + (cx - p.sx) * e2, py = p.sy + (cy - p.sy) * e2;
          var near = Math.hypot(x - cx, y - cy), al = p.a * Math.min(1, near / 26) * (0.6 + kk * 0.8);
          if (kk >= 1 || al <= 0.01) continue;
          g.globalAlpha = Math.min(1, al); g.strokeStyle = p.ag ? '#5cd2ff' : '#9cc2ea'; g.lineWidth = p.r * 1.1; g.lineCap = 'round';
          g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
        }
      }
      g.globalAlpha = 1;
    }
    function frame(now) {
      var dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now); var t = Math.max(0, (now - t0) / 1000);
      fadeIn += dt / 0.9;
      g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
      backdrop(t);
      if (mode === 'idle' || mode === 'converge') field(t, dt);
      var gl = (now - glowAt) / 520;
      if (gl >= 0 && gl < 1) { var G = g.createRadialGradient(cx, cy, 0, cx, cy, 40 + gl * 120); G.addColorStop(0, 'rgba(92,210,255,' + 0.55 * (1 - gl) + ')'); G.addColorStop(1, 'rgba(92,210,255,0)'); g.fillStyle = G; g.fillRect(cx - 200, cy - 200, 400, 400); }
      if (mode === 'converge' && now - mAt >= mDur) { glowAt = now; mode = 'held'; if (done) { var f = done; done = null; f(); } }
      if (mode === 'open') {
        var k = Math.max(0, Math.min(1, (now - mAt) / mDur)), q = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, e = k * 0.45 + q * 0.55, s = s0 * Math.pow(s1 / s0, e);
        g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 1; g.fillStyle = '#000'; star(cx, cy, s); g.fill();
        g.globalCompositeOperation = 'source-over';
        star(cx, cy, s); g.lineWidth = 1.5; g.strokeStyle = 'rgba(92,210,255,' + (0.9 * (1 - k)) + ')'; g.shadowColor = 'rgba(0,168,239,0.9)'; g.shadowBlur = 22; g.stroke(); g.shadowBlur = 0;
        if (k >= 1) { cancelAnimationFrame(raf); raf = 0; g.clearRect(0, 0, w, h); if (done) { var f2 = done; done = null; f2(); } return; }
      }
      raf = requestAnimationFrame(frame);
    }
    resize(); window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
    return {
      converge: function (x, y, ms) { cx = x; cy = y; mode = 'converge'; mAt = performance.now(); mDur = ms; return new Promise(function (r) { done = r; }); },
      open: function (x, y, size, ms) { cx = x; cy = y; s0 = size; s1 = Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) / 0.36; mode = 'open'; mAt = performance.now(); mDur = ms; return new Promise(function (r) { done = r; }); },
      stop: function () { cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', resize); }
    };
  }

  export { IntroField, LensField, GateStream, WorkflowViz, CloudViz, EdrViz, REDUCE };
