/* Zenstra core (ES module; mountCore(section) returns a teardown function): an exploded, line-drawn reactor driven by scroll.
   One canvas draws a 3D wireframe of five coaxial layers (policy engine, Workflow
   Security, Cloud Security, Zenstra EDR, decision record). Scroll progress p (0 to 1)
   assembles, explodes, rotates and travels along the axis; time adds the small
   motions that make it feel alive (spin, pulses, packets). HTML labels and cards sit
   on top so the words stay crisp and readable by assistive technology. */
export function mountCore(sec) {
  var noop = function () {};
  if (!sec) return noop;
  var root = document.documentElement;
  var REDUCE = root.classList.contains('reduce');
  var track = sec.querySelector('.core-track'), pin = sec.querySelector('.core-pin'), box = sec.querySelector('.core-stage'), cv = sec.querySelector('canvas');
  var labels = [].slice.call(sec.querySelectorAll('.core-label')), cards = [].slice.call(sec.querySelectorAll('.core-card'));
  var hudN = sec.querySelector('[data-core-n]'), hudT = sec.querySelector('[data-core-t]'), hudBar = sec.querySelector('.core-hud i');
  if (!cv || !cv.getContext) return noop;
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
  // Ease out with a small overshoot: a part travels a touch past its mark and settles.
  var back = function (t) { var c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

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
  // 0 · Policy engine: the Zenstra mark, traced from the logo file itself: four
  // separate curved blades around a star-shaped hollow, each with the logo's own
  // colours (measured near its inner and outer edge). Units: the mark's half width.
  var MARK_BLADES = [
    { q: 'TR', inner: '25,149,220', outer: '35,164,232', pts: [[0.02,-0.785],[0.047,-0.682],[0.104,-0.543],[0.151,-0.465],[0.223,-0.37],[0.322,-0.271],[0.482,-0.15],[0.499,-0.146],[0.559,-0.107],[0.577,-0.103],[0.587,-0.092],[0.609,-0.088],[0.654,-0.062],[0.678,-0.061],[0.691,-0.047],[0.721,-0.046],[0.743,-0.031],[0.775,-0.031],[0.791,-0.014],[0.842,-0.012],[0.836,-0.005],[0.816,-0.005],[0.743,-0.018],[0.7,-0.018],[0.507,-0.018],[0.453,-0.033],[0.363,-0.033],[0.339,-0.047],[0.304,-0.047],[0.291,-0.061],[0.263,-0.064],[0.184,-0.111],[0.119,-0.174],[0.061,-0.267],[0.032,-0.37],[0.015,-0.586],[0.015,-0.77]] },
    { q: 'BR', inner: '13,91,154', outer: '15,106,172', pts: [[0.734,0.014],[0.993,0.014],[1.0,0.021],[0.993,0.027],[0.927,0.027],[0.901,0.042],[0.855,0.042],[0.84,0.055],[0.804,0.057],[0.782,0.072],[0.754,0.072],[0.737,0.087],[0.713,0.087],[0.693,0.101],[0.672,0.101],[0.655,0.115],[0.631,0.118],[0.618,0.131],[0.601,0.131],[0.587,0.146],[0.572,0.146],[0.561,0.159],[0.542,0.163],[0.533,0.174],[0.514,0.18],[0.423,0.237],[0.315,0.327],[0.236,0.409],[0.181,0.48],[0.104,0.606],[0.074,0.671],[0.052,0.742],[0.03,0.815],[0.024,0.861],[0.015,0.863],[0.011,0.845],[0.017,0.569],[0.032,0.418],[0.061,0.31],[0.091,0.254],[0.136,0.195],[0.182,0.15],[0.225,0.12],[0.281,0.09],[0.302,0.088],[0.318,0.074],[0.352,0.072],[0.365,0.059],[0.413,0.059],[0.439,0.044],[0.514,0.044],[0.544,0.029],[0.685,0.029]] },
    { q: 'BL', inner: '13,102,169', outer: '14,106,173', pts: [[-0.955,0.001],[-0.827,0.001],[-0.838,0.007],[-0.827,0.014],[-0.749,0.027],[-0.564,0.029],[-0.527,0.044],[-0.454,0.044],[-0.428,0.059],[-0.378,0.059],[-0.356,0.074],[-0.324,0.075],[-0.309,0.088],[-0.291,0.088],[-0.277,0.101],[-0.261,0.103],[-0.25,0.116],[-0.212,0.135],[-0.123,0.224],[-0.095,0.267],[-0.063,0.336],[-0.048,0.386],[-0.034,0.487],[-0.024,0.757],[-0.024,0.861],[-0.028,0.826],[-0.041,0.807],[-0.063,0.722],[-0.106,0.621],[-0.153,0.537],[-0.212,0.45],[-0.268,0.385],[-0.395,0.265],[-0.523,0.178],[-0.594,0.144],[-0.605,0.133],[-0.624,0.129],[-0.635,0.118],[-0.657,0.115],[-0.68,0.1],[-0.696,0.1],[-0.708,0.087],[-0.739,0.085],[-0.752,0.072],[-0.78,0.072],[-0.799,0.057],[-0.844,0.055],[-0.857,0.042],[-0.905,0.042],[-0.927,0.027],[-0.994,0.027],[-0.998,0.016],[-0.972,0.012]] },
    { q: 'TL', inner: '13,97,161', outer: '14,108,176', pts: [[-0.024,-0.865],[-0.017,-0.841],[-0.019,-0.669],[-0.034,-0.433],[-0.048,-0.342],[-0.065,-0.286],[-0.093,-0.226],[-0.155,-0.146],[-0.242,-0.079],[-0.261,-0.075],[-0.276,-0.062],[-0.292,-0.062],[-0.307,-0.047],[-0.339,-0.047],[-0.363,-0.033],[-0.413,-0.033],[-0.441,-0.018],[-0.551,-0.018],[-0.601,-0.003],[-0.801,-0.003],[-0.95,-0.001],[-0.879,-0.001],[-0.858,-0.016],[-0.816,-0.016],[-0.795,-0.031],[-0.764,-0.031],[-0.747,-0.044],[-0.721,-0.046],[-0.696,-0.061],[-0.678,-0.061],[-0.665,-0.074],[-0.644,-0.075],[-0.628,-0.088],[-0.575,-0.107],[-0.408,-0.211],[-0.32,-0.286],[-0.257,-0.351],[-0.151,-0.496],[-0.091,-0.612],[-0.047,-0.748]] }
  ];
  var MS = 56;   // the mark's half width in layer units
  var BLADES = MARK_BLADES.map(function (b) { return { inner: b.inner, outer: b.outer, pts: b.pts.map(function (p) { return [p[0] * MS, p[1] * MS]; }) }; });
  (function () {
    var o = [];
    BLADES.forEach(function (b) {
      var loop = function (z) { var q = b.pts.map(function (p) { return [p[0], p[1], z]; }); q.push(q[0]); return q; };
      o.push({ pts: loop(5), k: 'star' }); o.push({ pts: loop(-5), k: 'star', back: 1 });
      // Join front and back at each blade's two tips, so it reads as a solid piece.
      var far = b.pts.slice().sort(function (p, q) { return Math.abs(q[0]) + 0.001 * Math.abs(q[1]) - Math.abs(p[0]); })[0];
      var tall = b.pts.slice().sort(function (p, q) { return Math.abs(q[1]) - Math.abs(p[1]); })[0];
      [far, tall].forEach(function (t) { o.push({ pts: [[t[0], t[1], 5], [t[0], t[1], -5]], k: 'star', back: 1 }); });
    });
    o.push({ pts: ring(64, 4, 96), k: 'disc' }); o.push({ pts: ring(64, -4, 96), k: 'disc', back: 1 });
    for (var i = 0; i < 24; i++) { var a = i / 24 * TAU; o.push({ pts: [polar(66, a, 0), polar(72, a, 0)], k: 'tick' }); }
    L.push({ z0: 26, z1: 236, spin: 0, lines: o, rim: 72 });
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
    core: [[0.06, 0], [0.11, 1]],
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
    var x = pt[0] * s.cs[spin] - pt[1] * s.sn[spin], y = pt[0] * s.sn[spin] + pt[1] * s.cs[spin], x1, y2, z2;
    if (spin === 0) {
      // The mark's disc keeps its centre on the axis but turns its face toward the
      // viewer by its own (gentler) angle, so the logo reads in every stage.
      var zc = layerZ * s.cy, xa = x * s.fcy + pt[2] * s.fsy, za = -x * s.fsy + pt[2] * s.fcy;
      x1 = layerZ * s.sy + xa; y2 = -zc * s.sp + y * s.fcp - za * s.fsp; z2 = zc * s.cp + y * s.fsp + za * s.fcp;
    } else {
      // yaw around y, then pitch around x
      var z = pt[2] + layerZ, z1 = -x * s.sy + z * s.cy;
      x1 = x * s.cy + z * s.sy; y2 = y * s.cp - z1 * s.sp; z2 = y * s.sp + z1 * s.cp;
    }
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
  // State that carries between frames: pointer tilt, each layer's last light level
  // (to fire an activation wave when it powers on), and the assembly "lock".
  var tilt = { x: 0, y: 0, tx: 0, ty: 0 }, prevLit = [0, 0, 0, 0, 0], waveAt = [-9, -9, -9, -9, -9], prevEx = 0, lockAt = -9;
  var render = function (p, t) {
    var mob = mobile ? 1 : 0;
    var ex = at(K.ex, p), sc = at(K.sc, p), yaw = at(K.yaw, p), pitch = at(K.pitch, p);
    var minDim = mob ? Math.min(W * 0.92, H * 0.56) : Math.min(W * 0.44, H * 0.8);
    var k = minDim / 2 / 214 * sc * (mob ? 0.9 : 1);
    if (!REDUCE) { yaw += Math.sin(t * 0.23) * 0.035 + tilt.x * 0.09; pitch += Math.sin(t * 0.17 + 1) * 0.02 + tilt.y * 0.06; }
    // While the layers are apart, the mark's disc turns most of the way to face you.
    var fyaw = yaw * (1 - 0.7 * ex), fpitch = pitch * (1 - 0.65 * ex);
    var s = { k: k, cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), fcy: Math.cos(fyaw), fsy: Math.sin(fyaw), fcp: Math.cos(fpitch), fsp: Math.sin(fpitch), cs: [], sn: [], ox: 0, oy: 0 };
    L.forEach(function (l, i) { var a = REDUCE ? 0 : l.spin * t; s.cs[i] = Math.cos(a); s.sn[i] = Math.sin(a); });
    // Layers separate one after another (inner pair first, the outer two follow) and
    // each settles with a slight spring; assembling runs the same way in reverse.
    var DELAY = [0.16, 0, 0, 0, 0.16];
    var lz = L.map(function (l, i) { var e = clamp((ex - DELAY[i]) / (1 - DELAY[i]), 0, 1); return mix(l.z0, l.z1, REDUCE ? e : back(e)); });
    // Travel along the axis: put the focus point (between layers) at the target spot.
    var fz = at(K.fz, p), fi = Math.floor(clamp(fz, 0, 3.999)), ff = fz - fi, zf = mix(lz[fi], lz[fi + 1], ff);
    var cx = W / 2, cy = mob ? H * 0.33 : H / 2;
    var o = proj([0, 0, 0], s, zf, 0);
    s.ox = cx + at(K.tx, p) * W * (mob ? 0.25 : 1) - o[0]; s.oy = cy + at(K.ty, p) * H * (mob ? 0.25 : 1) - o[1];

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    var dim = at(K.dim, p), focus = focusOf(p);
    var lit = [at(K.core, p), at(K.l1, p), at(K.l2, p), at(K.l3, p), at(K.l4, p)];
    var pulse = REDUCE ? 1 : 0.88 + 0.12 * Math.sin(t * 2.4);
    // A layer that powers on sends a wave around its rim; the layers locking back
    // together sends a flash through the whole core.
    lit.forEach(function (v, i) { if (v > 0.55 && prevLit[i] <= 0.55) waveAt[i] = t; prevLit[i] = v; });
    if (ex < 0.02 && prevEx >= 0.02 && p > 0.5) lockAt = t;
    prevEx = ex;
    var lockK = clamp((t - lockAt) / 1.1, 0, 1), lockOn = lockK < 1 ? 1 - lockK : 0;

    // Core light behind everything.
    var c0 = proj([0, 0, 0], s, lz[0], 0);
    ctx.globalCompositeOperation = 'lighter';
    glowDot(c0[0], c0[1], 170 * k * (1 + lockOn * 0.6), '0,168,239', (0.34 * lit[0] * pulse) + 0.35 * lockOn);
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
    // The mark itself, in the logo's own colours once the core is lit.
    if (lit[0] > 0.02) {
      var mr = MS * k;
      BLADES.forEach(function (b) {
        var g = ctx.createRadialGradient(c0[0], c0[1], mr * 0.18, c0[0], c0[1], mr * 0.62);
        g.addColorStop(0, 'rgba(' + b.inner + ',' + (0.96 * lit[0]).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + b.outer + ',' + (0.96 * lit[0]).toFixed(3) + ')');
        ctx.beginPath();
        b.pts.forEach(function (pt, i) { var q = proj([pt[0], pt[1], 5], s, lz[0], 0); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
        ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      });
    }

    ctx.globalCompositeOperation = 'lighter';
    // Activation waves: a bright ring sweeps outward over the layer that just powered on.
    waveAt.forEach(function (w0, i) {
      var wk = (t - w0) / 0.9; if (wk < 0 || wk >= 1 || REDUCE) return;
      var rr = L[i].rim * (0.82 + wk * 0.3), pts = ring(rr, 0, 72).map(function (pt) { return proj(pt, s, lz[i], i); });
      stroke(pts, CY, 0.75 * (1 - wk), 2.2); stroke(pts, '0,168,239', 0.25 * (1 - wk), 7);
    });
    // The lock: when the layers meet again, a ring of light runs out from the core.
    if (lockOn > 0) { var lpts = ring(216 * (1 + lockK * 0.35), 0, 96).map(function (pt) { return proj(pt, s, lz[2], 2); }); stroke(lpts, CY, 0.8 * lockOn, 2.4); stroke(lpts, '0,168,239', 0.3 * lockOn, 9); }
    // Energy: while a platform is in focus, light travels from the engine along the
    // axis to that layer, then out to its ring: the one engine powering each way in.
    if (focus > 0 && !REDUCE) {
      var RIM = [0, 84, 132, 192], fa = dim;
      for (var e = 0; e < 14; e++) {
        var ph = (t * 0.55 + e / 14) % 1, ang = e * 2.399 + t * 0.15;
        var zA = mix(lz[0], lz[focus], ease(clamp(ph / 0.55, 0, 1))), rA = ph < 0.55 ? 4 : mix(4, RIM[focus], ease((ph - 0.55) / 0.45));
        var pe = proj(polar(rA, ang, 0), s, zA, focus), al2 = fa * (ph < 0.08 ? ph / 0.08 : ph > 0.9 ? (1 - ph) / 0.1 : 1);
        glowDot(pe[0], pe[1], 9 * k + 2, CY, 0.65 * al2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

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

    // Opening: named attacks close in on the dormant core; ignition pushes them back.
    if (!REDUCE && p < 0.16) {
      var near = ease(win(p, 0, 0.085)), push = ease(win(p, 0.095, 0.15)), rimPx = 214 * k * 1.12;
      var far = mob ? Math.min(W, H) * 0.62 : Math.max(W, H) * 0.62, TH = [['PROMPT INJECTION', -0.75], ['TOOL POISONING', 0.3], ['CREDENTIAL LEAK', 1.25], ['SHADOW AI', 2.35]];
      ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace'; ctx.textBaseline = 'middle';
      TH.forEach(function (th, i) {
        var wob = Math.sin(t * 1.3 + i * 1.7) * 0.03, ang = th[1] + wob;
        var d = mix(far, rimPx, near) + push * far * 0.5, al = (0.25 + 0.75 * near) * (1 - push);
        if (al < 0.01) return;
        var hx = c0[0] + Math.cos(ang) * d, hy = c0[1] + Math.sin(ang) * d, tx2 = c0[0] + Math.cos(ang) * (d + 90), ty2 = c0[1] + Math.sin(ang) * (d + 90);
        var g = ctx.createLinearGradient(tx2, ty2, hx, hy); g.addColorStop(0, 'rgba(' + RED + ',0)'); g.addColorStop(1, 'rgba(' + RED + ',' + (0.85 * al).toFixed(3) + ')');
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; glowDot(hx, hy, 14, RED, 0.8 * al); ctx.globalCompositeOperation = 'source-over';
        // Keep each label fully on screen (phones are narrow).
        var tw = ctx.measureText(th[0]).width, right = Math.cos(ang) >= 0;
        var lx2 = right ? hx + 14 : hx - 14 - tw; lx2 = clamp(lx2, 8, W - 8 - tw);
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(' + RED + ',' + (0.95 * al).toFixed(3) + ')';
        ctx.fillText(th[0], lx2, clamp(hy - 12, 12, H - 12));
      });
      // The shield pulse that pushes them back.
      var pr = win(p, 0.09, 0.14);
      if (pr > 0 && pr < 1) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(' + CY + ',' + (0.7 * (1 - pr)).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c0[0], c0[1], rimPx * (1 + pr * 0.7), 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
    }

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
    return function () { window.removeEventListener('resize', still); };
  }
  var visible = false, raf = 0, t0 = performance.now(), last = t0, shown = progress();
  // Pointer tilt (desktop): the object leans a little toward the cursor.
  var dead = false;
  var onPtr = function (e) {
    if (e.pointerType !== 'mouse') return;
    var r = box.getBoundingClientRect(); tilt.tx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1); tilt.ty = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
  };
  var onLeave = function () { tilt.tx = 0; tilt.ty = 0; };
  sec.addEventListener('pointermove', onPtr, { passive: true });
  sec.addEventListener('pointerleave', onLeave);
  var frame = function (now) {
    raf = 0; if (dead || !visible) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    // Inertia: the scene follows the scroll position with a short, smooth lag, so
    // stepped mouse wheels still read as one continuous camera move.
    var target = progress(), f = 1 - Math.exp(-dt * 7.5);
    shown += (target - shown) * f; if (Math.abs(target - shown) < 0.0004) shown = target;
    tilt.x += (tilt.tx - tilt.x) * (1 - Math.exp(-dt * 3)); tilt.y += (tilt.ty - tilt.y) * (1 - Math.exp(-dt * 3));
    lastP = shown;
    render(shown, (now - t0) / 1000); setStage(shown);
    raf = requestAnimationFrame(frame);
  };
  var start = function () { if (!raf) raf = requestAnimationFrame(frame); };
  var io = null;
  if ('IntersectionObserver' in window) { io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }, { rootMargin: '100px 0px' }); io.observe(track); }
  else { visible = true; start(); }
  var onResize = function () { size(); render(lastP, (performance.now() - t0) / 1000); };
  window.addEventListener('resize', onResize);
  render(0, 0); setStage(0);
  return function () {
    dead = true; if (raf) cancelAnimationFrame(raf); raf = 0;
    if (io) io.disconnect();
    window.removeEventListener('resize', onResize);
    sec.removeEventListener('pointermove', onPtr); sec.removeEventListener('pointerleave', onLeave);
  };
}
