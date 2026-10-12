/* Zenstra core: an exploded, line-drawn reactor driven by scroll.
   One canvas draws a 3D wireframe of five coaxial layers (policy engine, Workflow
   Security, Cloud Security, Zenstra EDR, decision record). Scroll progress p (0 to 1)
   assembles, explodes, rotates and travels along the axis; time adds the small
   motions that make it feel alive (spin, pulses, packets). HTML labels and cards sit
   on top so the words stay crisp and readable by assistive technology. */
(function () {
  'use strict';
  var sec = document.querySelector('[data-core]'); if (!sec) return;
  var root = document.documentElement;
  var REDUCE = root.classList.contains('reduce');
  var track = sec.querySelector('.core-track'), pin = sec.querySelector('.core-pin'), box = sec.querySelector('.core-stage'), cv = sec.querySelector('canvas');
  var labels = [].slice.call(sec.querySelectorAll('.core-label')), cards = [].slice.call(sec.querySelectorAll('.core-card'));
  var hudN = sec.querySelector('[data-core-n]'), hudT = sec.querySelector('[data-core-t]'), hudBar = sec.querySelector('.core-hud i');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');

  /* ---------- helpers ---------- */
  var TAU = Math.PI * 2;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var mix = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  // Keyframes: [[p, value], ...] with eased segments.
  var at = function (kf, p) {
    if (p <= kf[0][0]) return kf[0][1];
    for (var i = 1; i < kf.length; i++) if (p <= kf[i][0]) { var a = kf[i - 1], b = kf[i]; return mix(a[1], b[1], ease((p - a[0]) / ((b[0] - a[0]) || 1))); }
    return kf[kf.length - 1][1];
  };
  var win = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };

  /* ---------- model ---------- */
  // Each layer: assembled z (z0), exploded z (z1), a slow spin, and polylines in
  // layer space. A polyline is {pts:[[x,y,z],...], k:kind, i:index, closed}.
  var ring = function (r, z, n, a0, a1) {
    n = n || 120; a0 = a0 || 0; a1 = a1 == null ? TAU : a1;
    var pts = []; for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; pts.push([r * Math.cos(a), r * Math.sin(a), z]); } return pts;
  };
  var polar = function (r, a, z) { return [r * Math.cos(a), r * Math.sin(a), z]; };
  // An annular block between radii r0..r1 and angles a0..a1, with depth (front zf, back zb).
  var block = function (out, r0, r1, a0, a1, zf, zb, k, i, windings) {
    var face = function (z) { var p = ring(r0, z, 6, a0, a1).concat(ring(r1, z, 6, a1, a0)); p.push(p[0]); return p; };
    out.push({ pts: face(zf), k: k, i: i }); out.push({ pts: face(zb), k: k, i: i, back: 1 });
    [[r0, a0], [r1, a0], [r0, a1], [r1, a1]].forEach(function (c) { out.push({ pts: [polar(c[0], c[1], zf), polar(c[0], c[1], zb)], k: k, i: i, back: 1 }); });
    for (var w = 1; w <= (windings || 0); w++) { var a = a0 + (a1 - a0) * w / (windings + 1); out.push({ pts: [polar(r0, a, zf), polar(r1, a, zf)], k: k + 'w', i: i }); }
  };
  var L = [];
  // 0 · Policy engine: the Zenstra star inside two discs.
  (function () {
    var o = [], star = [[0, -46], [10, -10], [46, 0], [10, 10], [0, 46], [-10, 10], [-46, 0], [-10, -10], [0, -46]];
    [6, -6].forEach(function (z) { o.push({ pts: star.map(function (s) { return [s[0], s[1], z]; }), k: 'star', back: z < 0 ? 1 : 0 }); });
    star.slice(0, 8).forEach(function (s) { o.push({ pts: [[s[0], s[1], 6], [s[0], s[1], -6]], k: 'star', back: 1 }); });
    o.push({ pts: ring(30, 8, 64), k: 'disc' }); o.push({ pts: ring(52, 4, 90), k: 'disc' }); o.push({ pts: ring(52, -4, 90), k: 'disc', back: 1 });
    for (var i = 0; i < 24; i++) { var a = i / 24 * TAU; o.push({ pts: [polar(54, a, 0), polar(60, a, 0)], k: 'tick' }); }
    L.push({ z0: 26, z1: 236, spin: 0, lines: o, rim: 60 });
  })();
  // 1 · Workflow Security: ten coils (the hops) on a chain.
  (function () {
    var o = [];
    o.push({ pts: ring(64, 6, 100), k: 'rim' }); o.push({ pts: ring(104, 6, 120), k: 'rim' }); o.push({ pts: ring(104, -6, 120), k: 'rim', back: 1 });
    for (var i = 0; i < 10; i++) {
      var c = i / 10 * TAU - Math.PI / 2, h = 0.22;
      block(o, 70, 98, c - h, c + h, 9, -9, 'coil', i, 4);
      o.push({ pts: ring(84, 0, 6, c + h + 0.03, c + TAU / 10 - h - 0.03), k: 'chain', i: i });
    }
    L.push({ z0: 12, z1: 118, spin: 0.09, lines: o, rim: 104 });
  })();
  // 2 · Cloud Security: gateway ports inside a dashed VPC boundary.
  (function () {
    var o = [];
    o.push({ pts: ring(114, 5, 120), k: 'rim' }); o.push({ pts: ring(150, 5, 140), k: 'rim' }); o.push({ pts: ring(150, -5, 140), k: 'rim', back: 1 });
    for (var d = 0; d < 48; d++) { var a0 = d / 48 * TAU; o.push({ pts: ring(168, 0, 3, a0, a0 + TAU / 96), k: 'vpc' }); }
    for (var i = 0; i < 6; i++) { var c = i / 6 * TAU - Math.PI / 2 + Math.PI / 6; block(o, 118, 146, c - 0.12, c + 0.12, 11, -11, 'port', i, 1); }
    for (var t = 0; t < 72; t++) { var a = t / 72 * TAU; o.push({ pts: [polar(150, a, 5), polar(156, a, 5)], k: 'tick' }); }
    L.push({ z0: 0, z1: 0, spin: 0, lines: o, rim: 168 });
  })();
  // 3 · Zenstra EDR: a housing ring of devices.
  (function () {
    var o = [];
    o.push({ pts: ring(176, 7, 150), k: 'rim' }); o.push({ pts: ring(212, 7, 160), k: 'rim' }); o.push({ pts: ring(212, -7, 160), k: 'rim', back: 1 });
    for (var i = 0; i < 24; i++) {
      var c = i / 24 * TAU, h = 0.085;
      block(o, 181, 203, c - h, c + h, 10, 2, 'dev', i, 0);
      o.push({ pts: [polar(184, c - h * 0.7, 10), polar(184, c + h * 0.7, 10)], k: 'devw', i: i });
    }
    L.push({ z0: -10, z1: -118, spin: -0.04, lines: o, rim: 212 });
  })();
  // 4 · Decision record: the back plate, a ledger of ticks.
  (function () {
    var o = [];
    [214, 160, 104].forEach(function (r) { o.push({ pts: ring(r, 0, 160), k: 'plate' }); });
    o.push({ pts: ring(214, -8, 160), k: 'plate', back: 1 });
    for (var g = 0; g < 2; g++) for (var d = 0; d < 60; d++) { var a0 = d / 60 * TAU; o.push({ pts: ring(186 + g * 12, 0, 2, a0, a0 + TAU / 140), k: 'plate' }); }
    for (var t = 0; t < 60; t++) { var a = t / 60 * TAU - Math.PI / 2; o.push({ pts: [polar(122, a, 0), polar(142, a, 0)], k: 'ledger', i: t }); }
    L.push({ z0: -24, z1: -236, spin: 0.02, lines: o, rim: 214 });
  })();

  /* ---------- scroll choreography ---------- */
  var STAGES = [0, 0.14, 0.3, 0.48, 0.66, 0.82];
  var K = {
    yaw: [[0, -0.18], [0.14, -0.26], [0.27, -0.96], [0.82, -0.96], [0.95, -0.16]],
    pitch: [[0, 0.1], [0.14, 0.16], [0.27, 0.56], [0.82, 0.56], [0.95, 0.08]],
    ex: [[0.14, 0], [0.27, 1], [0.82, 1], [0.94, 0]],
    sc: [[0, 1], [0.14, 1], [0.26, 0.74], [0.33, 1.32], [0.46, 1.32], [0.52, 1.12], [0.64, 1.12], [0.7, 0.98], [0.8, 0.98], [0.9, 1], [1, 1.04]],
    fz: [[0.26, 2], [0.33, 1], [0.46, 1], [0.52, 2], [0.64, 2], [0.7, 3], [0.8, 3], [0.9, 2]],
    tx: [[0, 0.07], [0.14, 0.07], [0.26, -0.03], [0.33, -0.18], [0.46, -0.18], [0.52, 0.17], [0.64, 0.17], [0.7, -0.15], [0.8, -0.15], [0.9, -0.08]],
    ty: [[0.26, 0], [0.33, -0.08], [0.46, -0.08], [0.52, 0.03], [0.64, 0.03], [0.7, 0], [0.8, 0], [0.9, 0.02]],
    dim: [[0.28, 0], [0.33, 1], [0.8, 1], [0.86, 0]],
    core: [[0.03, 0], [0.1, 1]],
    l1: [[0.3, 0], [0.34, 1], [0.46, 1], [0.5, 0.3], [0.84, 0.3], [0.91, 1]],
    l2: [[0.48, 0], [0.52, 1], [0.64, 1], [0.68, 0.3], [0.86, 0.3], [0.93, 1]],
    l3: [[0.66, 0], [0.7, 1], [0.8, 1], [0.84, 0.3], [0.88, 0.3], [0.95, 1]],
    l4: [[0.88, 0], [0.98, 1]],
    lab: [[0.2, 0], [0.27, 1], [0.8, 1], [0.86, 0]]
  };
  var focusOf = function (p) { return p >= 0.3 && p < 0.48 ? 1 : p >= 0.48 && p < 0.66 ? 2 : p >= 0.66 && p < 0.84 ? 3 : -1; };

  /* ---------- canvas sizing ---------- */
  var W = 0, H = 0, DPR = 1, mobile = false;
  var size = function () {
    var r = box.getBoundingClientRect(); W = r.width; H = r.height;
    // Sharp on high-density screens, but never more than ~3.5 million canvas pixels.
    DPR = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(3.5e6 / Math.max(1, W * H)));
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    mobile = W < 900;
  };

  /* ---------- projection ---------- */
  var F = 1300;
  var proj = function (pt, s, layerZ, spin) {
    var x = pt[0] * s.cs[spin] - pt[1] * s.sn[spin], y = pt[0] * s.sn[spin] + pt[1] * s.cs[spin], z = pt[2] + layerZ;
    // yaw around y, then pitch around x
    var x1 = x * s.cy + z * s.sy, z1 = -x * s.sy + z * s.cy;
    var y2 = y * s.cp - z1 * s.sp, z2 = y * s.sp + z1 * s.cp;
    var f = F / (F - z2 * s.k);
    return [s.ox + x1 * s.k * f, s.oy + y2 * s.k * f, z2];
  };

  /* ---------- draw ---------- */
  var BASE = '143,176,211', CY = '92,210,255', RED = '255,143,134', AMB = '232,178,92', GRN = '47,199,155';
  var stroke = function (pts, rgb, a, w) {
    if (a <= 0.003) return;
    ctx.strokeStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')'; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  };
  // The wireframe is thousands of short polylines; lines that share a colour, a
  // (quantised) opacity and a width are drawn as one path, so a frame costs a few
  // dozen stroke calls instead of thousands.
  var buckets = {}, order = [];
  var queue = function (pts, rgb, a, w, glow) {
    if (a <= 0.01) return;
    var key = (glow ? 'g' : 'n') + rgb + '|' + Math.round(a * 30) + '|' + w, b = buckets[key];
    if (!b) { b = buckets[key] = { rgb: rgb, a: Math.round(a * 30) / 30, w: w, glow: glow, list: [] }; order.push(key); }
    b.list.push(pts);
  };
  var flush = function () {
    order.sort(function (x, y) { return (buckets[y].glow ? 1 : 0) - (buckets[x].glow ? 1 : 0); });
    order.forEach(function (key) {
      var b = buckets[key];
      ctx.globalCompositeOperation = b.glow ? 'lighter' : 'source-over';
      ctx.strokeStyle = 'rgba(' + b.rgb + ',' + b.a.toFixed(3) + ')'; ctx.lineWidth = b.w;
      ctx.beginPath();
      for (var j = 0; j < b.list.length; j++) { var pts = b.list[j]; ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }
      ctx.stroke();
    });
    ctx.globalCompositeOperation = 'source-over';
    buckets = {}; order = [];
  };
  var glowDot = function (x, y, r, rgb, a) {
    if (a <= 0.003) return;
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  };

  var lastP = 0;
  var render = function (p, t) {
    var mob = mobile ? 1 : 0;
    var ex = at(K.ex, p), sc = at(K.sc, p), yaw = at(K.yaw, p), pitch = at(K.pitch, p);
    var minDim = mob ? Math.min(W * 0.92, H * 0.56) : Math.min(W * 0.44, H * 0.8);
    var k = minDim / 2 / 214 * sc * (mob ? 0.9 : 1);
    var s = { k: k, cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), cs: [], sn: [], ox: 0, oy: 0 };
    L.forEach(function (l, i) { var a = REDUCE ? 0 : l.spin * t; s.cs[i] = Math.cos(a); s.sn[i] = Math.sin(a); });
    var lz = L.map(function (l) { return mix(l.z0, l.z1, ex); });
    // Travel along the axis: put the focus point (between layers) at the target spot.
    var fz = at(K.fz, p), fi = Math.floor(clamp(fz, 0, 3.999)), ff = fz - fi, zf = mix(lz[fi], lz[fi + 1], ff);
    var cx = W / 2, cy = mob ? H * 0.33 : H / 2;
    var o = proj([0, 0, 0], s, zf, 0);
    s.ox = cx + at(K.tx, p) * W * (mob ? 0.25 : 1) - o[0]; s.oy = cy + at(K.ty, p) * H * (mob ? 0.25 : 1) - o[1];

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    var dim = at(K.dim, p), focus = focusOf(p);
    var lit = [at(K.core, p), at(K.l1, p), at(K.l2, p), at(K.l3, p), at(K.l4, p)];
    var pulse = REDUCE ? 1 : 0.88 + 0.12 * Math.sin(t * 2.4);

    // Core light behind everything.
    var c0 = proj([0, 0, 0], s, lz[0], 0);
    ctx.globalCompositeOperation = 'lighter';
    glowDot(c0[0], c0[1], 170 * k, '0,168,239', 0.34 * lit[0] * pulse);
    glowDot(c0[0], c0[1], 60 * k, '190,240,255', 0.55 * lit[0] * pulse);
    ctx.globalCompositeOperation = 'source-over';

    // Local timers for each platform's activity (loop with time while in focus).
    var hopT = REDUCE ? 0.75 : (t * 0.22) % 1, callT = REDUCE ? 0.7 : (t * 0.35) % 1, devT = REDUCE ? 0.8 : (t * 0.18) % 1;
    
    for (var li = L.length - 1; li >= 0; li--) {
      var l = L[li], z = lz[li];
      var d = focus < 0 ? 1 : li === focus ? 1 : li === 0 ? 0.75 : 1 - 0.72 * dim;
      var on = lit[li];
      for (var j = 0; j < l.lines.length; j++) {
        var ln = l.lines[j], pts = new Array(ln.pts.length), zs = 0;
        for (var q = 0; q < ln.pts.length; q++) { pts[q] = proj(ln.pts[q], s, z, li); zs += pts[q][2]; }
        var depth = clamp(0.62 + zs / ln.pts.length / 600, 0.35, 1);
        var a = (ln.back ? 0.22 : 0.42) * depth * d, rgb = BASE, w = 1, hot = 0;
        // Per-kind state: hops, ports, devices and ledger ticks light up in turn.
        if (li === 0) hot = on * (ln.k === 'star' ? 1 : 0.7);
        else if (li === 1 && (ln.k === 'coil' || ln.k === 'coilw' || ln.k === 'chain')) {
          var hop = ln.i / 10, reached = focus === 1 ? (hopT > hop ? 1 : 0) : 1;
          hot = on * (ln.k === 'chain' ? 0.6 : 1) * (focus === 1 ? 0.35 + 0.65 * reached : 1);
          if (ln.i === 6 && focus === 1 && hopT > 0.6) { rgb = RED; hot = 0; a = 0.95 * d; }
        } else if (li === 1) hot = on * 0.5;
        else if (li === 2) {
          hot = on * (ln.k === 'port' || ln.k === 'portw' ? 1 : ln.k === 'vpc' ? 0.9 : 0.5);
          if (ln.k === 'vpc' && focus === 2) hot = on;
        } else if (li === 3) {
          var dv = ln.i / 24, seen = focus === 3 ? (devT > dv ? 1 : 0.25) : 1;
          hot = on * (ln.k === 'dev' || ln.k === 'devw' ? seen : 0.5);
          if ((ln.k === 'dev' || ln.k === 'devw') && ln.i === 9 && focus === 3 && devT > 0.42) { rgb = devT > 0.62 ? AMB : RED; hot = 0; a = 0.95 * d; }
        } else if (li === 4) {
          hot = on * (ln.k === 'ledger' ? (REDUCE ? 1 : (ln.i / 60 < (t * 0.25) % 1.4 ? 1 : 0.3)) : 0.45);
        }
        if (hot > 0.01) {
          var ha = hot * d * (ln.back ? 0.45 : 1);
          queue(pts, '0,168,239', 0.16 * ha, 4, true);
          queue(pts, CY, Math.max(a, 0.92 * ha), 1.15);
        } else queue(pts, rgb, a, rgb === BASE ? 1 : 1.4);
      }
    }
    flush();

    // Activity overlays for the focused platform.
    ctx.globalCompositeOperation = 'lighter';
    if (focus === 1 || (REDUCE && p > 0.2)) {
      // A packet travels the hop chain and stops at the blocked hop.
      var lt = focus === 1 ? win(p, 0.31, 0.34) : 1, ang = -Math.PI / 2 + Math.min(hopT, 0.62) * TAU;
      var pk = proj(polar(84, ang, 10), s, lz[1], 1);
      glowDot(pk[0], pk[1], 16 * k, hopT > 0.6 ? RED : CY, 0.9 * lt);
    }
    if (focus === 2 || (REDUCE && p > 0.2)) {
      // Calls arrive from outside the VPC; one is stopped at its port.
      for (var c = 0; c < 6; c++) {
        var ca = c / 6 * TAU - Math.PI / 2 + Math.PI / 6, ph = (callT + c * 0.17) % 1, bad = c === 2;
        var r = bad ? mix(290, 152, Math.min(ph * 1.6, 1)) : mix(290, 40, ph);
        var a0 = proj(polar(r + 26, ca, 0), s, lz[2], 2), a1 = proj(polar(r, ca, 0), s, lz[2], 2);
        var alpha = (bad && ph > 0.62 ? 1 - (ph - 0.62) / 0.38 : 1) * (focus === 2 ? 1 : 0.5);
        stroke([a0, a1], bad ? RED : CY, 0.9 * alpha, 2);
        glowDot(a1[0], a1[1], 10 * k, bad ? RED : CY, 0.7 * alpha);
      }
    }
    if (focus === 3 && devT > 0.42) {
      var dpos = proj(polar(192, 9 / 24 * TAU, 10), s, lz[3], 3);
      glowDot(dpos[0], dpos[1], 26 * k, devT > 0.62 ? AMB : RED, 0.75);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Labels and their leader lines.
    var la = at(K.lab, p) * (mob ? 0 : 1);
    labels.forEach(function (el, i) {
      var vis = la * (focus < 0 ? 1 : i === focus ? 1 : 0.35);
      el.style.opacity = vis.toFixed(3);
      el.classList.toggle('on', focus === i);
      if (vis < 0.01) return;
      var right = i % 2 === 0, ang = right ? -0.7 : Math.PI - 0.7;
      var an = proj(polar(L[i].rim, ang, 0), s, lz[i], i);
      var lw = el.offsetWidth, lh = el.offsetHeight;
      var lx = right ? an[0] + 70 : an[0] - 70 - lw, ly = an[1] + (right ? -60 : 50) - lh / 2;
      lx = clamp(lx, 16, W - lw - 16); ly = clamp(ly, 16, H - lh - 72);
      el.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px)';
      var ex2 = right ? lx - 6 : lx + lw + 6, ey = ly + lh / 2;
      var mid = [ex2 + (right ? -24 : 24), ey];
      var col = focus === i ? CY : BASE;
      stroke([[an[0], an[1]], mid, [ex2, ey]], col, 0.6 * vis, 1);
      ctx.fillStyle = 'rgba(' + col + ',' + (0.9 * vis).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(an[0], an[1], 2.6, 0, TAU); ctx.fill();
    });
  };

  /* ---------- cards and progress ---------- */
  var stage = -1;
  var setStage = function (p) {
    var s = 0; for (var i = 0; i < STAGES.length; i++) if (p + 0.012 >= STAGES[i]) s = i;
    if (hudBar) hudBar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    if (s === stage) return; stage = s;
    cards.forEach(function (c, i) { c.classList.toggle('on', i === s); c.classList.toggle('past', i < s); });
    if (hudN) hudN.textContent = '0' + (s + 1) + ' / 0' + cards.length;
    if (hudT && cards[s]) hudT.textContent = cards[s].getAttribute('data-name') || '';
  };

  /* ---------- loop ---------- */
  var progress = function () {
    var top = parseFloat(getComputedStyle(pin).top) || 0, r = track.getBoundingClientRect(), total = track.offsetHeight - pin.offsetHeight;
    return clamp((top - r.top) / Math.max(1, total), 0, 1);
  };
  size();
  if (REDUCE) {
    sec.classList.add('core-static');
    var still = function () { size(); render(0.28, 0); labels.forEach(function (el) { el.style.opacity = mobile ? 0 : 1; }); };
    still(); window.addEventListener('resize', still);
    return;
  }
  var visible = false, raf = 0, t0 = performance.now();
  var frame = function (now) {
    raf = 0; if (!visible) return;
    var p = progress(); lastP = p;
    render(p, (now - t0) / 1000); setStage(p);
    raf = requestAnimationFrame(frame);
  };
  var start = function () { if (!raf) raf = requestAnimationFrame(frame); };
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }, { rootMargin: '100px 0px' }).observe(track);
  else { visible = true; start(); }
  window.addEventListener('resize', function () { size(); render(lastP, (performance.now() - t0) / 1000); });
  render(0, 0); setStage(0);
})();
