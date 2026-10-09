/* Zenstra v4 background engines.
 * RingField  — WebGL field of small dashes that light up around a slow ring.
 *              The ring drifts on its own and follows the pointer gently.
 *              A soft mask keeps particles faint behind the headline.
 * MorphField — Canvas 2D particles that settle into shapes (radar, shield, chain).
 * DotWave    — Canvas 2D dot grid that ripples, brighter near the pointer.
 * Every engine pauses off screen and when the tab is hidden, and draws a
 * single still frame when the visitor prefers reduced motion.
 */
(function () {
  'use strict';
  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = function () { return Math.min(window.devicePixelRatio || 1, 1.75); };

  function onVisible(el, fn) {
    var vis = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; fn(vis && !document.hidden); }, { rootMargin: '120px' }).observe(el);
    document.addEventListener('visibilitychange', function () { fn(vis && !document.hidden); });
  }
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; }

  /* Simplex noise 3D, after Ashima Arts / Stefan Gustavson (MIT). */
  var NOISE = [
    'vec3 m289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 m289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 perm(vec4 x){return m289(((x*34.0)+1.0)*x);}',
    'vec4 tis(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
    'float snoise(vec3 v){',
    ' const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);',
    ' vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);',
    ' vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);',
    ' vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=m289(i);',
    ' vec4 p=perm(perm(perm(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
    ' float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;',
    ' vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);',
    ' vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);',
    ' vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);',
    ' vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));',
    ' vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    ' vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);',
    ' vec4 nm=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=nm.x; p1*=nm.y; p2*=nm.z; p3*=nm.w;',
    ' vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;',
    ' return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
    '}'
  ].join('\n');

  var VS = [
    'precision highp float;',
    'attribute vec2 aRef; attribute float aSeed;',
    'uniform float uTime, uAspect, uRadius, uWidth, uPx, uDpr, uGrow, uMaskMin;',
    'uniform vec2 uRing; uniform vec4 uMask;',
    'varying float vScale; varying float vAngle; varying float vCol; varying float vFade;',
    NOISE,
    'void main(){',
    ' float t=uTime*0.5; vec2 p=aRef;',
    ' vec2 d1=vec2(snoise(vec3(p*1.5+vec2(8.4,2.9),t*0.35)),snoise(vec3(p*1.5+vec2(50.9,12.9),t*0.35)))*0.04;',
    ' vec2 d2=vec2(snoise(vec3(p*9.0,t*0.5)),snoise(vec3(p*9.0+31.0,t*0.5)))*0.006;',
    ' vec2 q=p+d1+d2;',
    ' float d=distance(q,uRing);',
    ' float rr=(uRadius+snoise(vec3(q*1.1+vec2(18.4,72.9),t*0.45))*0.05)*uGrow;',
    ' float band=smoothstep(rr-uWidth*2.2,rr,d)-smoothstep(rr,rr+uWidth,d);',
    ' band=max(band,0.0);',
    ' float inner=(1.0-smoothstep(0.0,rr,d))*0.18;',
    ' float amb=pow((snoise(vec3(q*1.3+vec2(3.1,9.7),t*0.4))+1.0)*0.5,4.0)*0.55;',
    ' float s=pow(band,1.5)*1.25+inner+amb+aSeed*0.08;',
    ' vec2 dir=normalize(q-uRing+vec2(1e-4));',
    ' q+=dir*band*0.035;',
    ' vScale=s;',
    ' vAngle=atan(q.y-uRing.y,q.x-uRing.x)+snoise(vec3(q*5.0,t*0.8))*0.45;',
    ' vCol=(snoise(vec3(q*0.9+vec2(74.6,91.5),t*0.22))+1.0)*0.5;',
    ' vec2 md=(q-uMask.xy)/max(uMask.zw,vec2(1e-3));',
    ' vFade=mix(uMaskMin,1.0,smoothstep(0.75,1.2,length(md)));',
    ' gl_Position=vec4(q.x/uAspect,q.y,0.0,1.0);',
    ' gl_PointSize=clamp(s,0.0,1.7)*uPx*uDpr;',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'uniform vec3 uC1,uC2,uC3; uniform float uAlpha;',
    'varying float vScale; varying float vAngle; varying float vCol; varying float vFade;',
    'void main(){',
    ' vec2 uv=gl_PointCoord-0.5; uv.y=-uv.y;',
    ' float c=cos(vAngle), s=sin(vAngle);',
    ' uv=vec2(c*uv.x+s*uv.y,-s*uv.x+c*uv.y);',
    ' vec2 q=abs(uv)-vec2(0.34,0.0);',
    ' float dist=length(max(q,0.0))+min(max(q.x,q.y),0.0)-0.15;',
    ' float shape=smoothstep(0.03,-0.03,dist);',
    ' float a=shape*smoothstep(0.14,0.32,vScale)*uAlpha*vFade;',
    ' if(a<0.01) discard;',
    ' vec3 col=vCol<0.62?mix(uC1,uC2,vCol/0.62):mix(uC2,uC3,smoothstep(0.62,0.95,vCol));',
    ' gl_FragColor=vec4(col,a);',
    '}'
  ].join('\n');

  function RingField(host, opts) {
    opts = opts || {};
    this.host = host; this.opts = opts;
    this.canvas = document.createElement('canvas');
    host.appendChild(this.canvas);
    var gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) { this.failed = true; return; }
    this.gl = gl;
    var prog = this.prog = gl.createProgram();
    [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]].forEach(function (s) {
      var sh = gl.createShader(s[0]); gl.shaderSource(sh, s[1]); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(sh));
      gl.attachShader(prog, sh);
    });
    gl.linkProgram(prog); gl.useProgram(prog);
    this.u = {};
    var self = this;
    ['uTime', 'uAspect', 'uRadius', 'uWidth', 'uPx', 'uDpr', 'uGrow', 'uMaskMin', 'uRing', 'uMask', 'uC1', 'uC2', 'uC3', 'uAlpha'].forEach(function (n) { self.u[n] = gl.getUniformLocation(prog, n); });
    this.aRef = gl.getAttribLocation(prog, 'aRef'); this.aSeed = gl.getAttribLocation(prog, 'aSeed');
    this.bRef = gl.createBuffer(); this.bSeed = gl.createBuffer();
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.ring = [0, 0]; this.target = [0, 0]; this.pointer = null;
    this.grow = opts.grow === false ? 1 : 0; this.alpha = 1;
    this.t0 = performance.now(); this.running = false; this.visible = false; this.started = !!opts.autostart;
    this.mask = [0, 0, 0.001, 0.001];
    this.setColors(opts.colors);
    this.resize();
    if ('ResizeObserver' in window) new ResizeObserver(function () { self.resize(); }).observe(host);
    window.addEventListener('pointermove', function (e) {
      var r = self.canvas.getBoundingClientRect();
      if (e.clientY < r.top - 80 || e.clientY > r.bottom + 80) { self.pointer = null; return; }
      var hh = r.height / 2;
      self.pointer = [(e.clientX - r.left - r.width / 2) / hh, -(e.clientY - r.top - hh) / hh];
    }, { passive: true });
    document.addEventListener('pointerleave', function () { self.pointer = null; });
    onVisible(host, function (v) { self.visible = v; self.loop(); });
    if (REDUCE) { this.grow = 1; this.draw(8); }
  }
  RingField.prototype.setColors = function (c) {
    c = c || ['#1667d9', '#12b0f0', '#f2675d'];
    this.colors = c.map(hex);
    if (!this.running && this.gl && this.count) this.draw(this.lastT || 8);
  };
  RingField.prototype.setMask = function (el, min) {
    this.maskEl = el; this.maskMin = min == null ? 0.1 : min; this.updateMask();
  };
  RingField.prototype.updateMask = function () {
    if (!this.maskEl) return;
    var c = this.canvas.getBoundingClientRect(), m = this.maskEl.getBoundingClientRect(), hh = c.height / 2;
    if (!hh) return;
    this.mask = [(m.left + m.width / 2 - c.left - c.width / 2) / hh, -(m.top + m.height / 2 - c.top - hh) / hh, (m.width / 2) / hh * 1.02, (m.height / 2) / hh * 1.15];
  };
  RingField.prototype.resize = function () {
    var gl = this.gl, w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    var dpr = DPR(); this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.aspect = w / h;
    var sp = this.opts.spacing || (w < 700 ? 18 : 14.5), ref = [], seed = [], hh = h / 2;
    for (var y = sp / 2; y < h; y += sp) for (var x = sp / 2; x < w; x += sp) {
      var jx = x + (Math.random() - 0.5) * sp * 0.9, jy = y + (Math.random() - 0.5) * sp * 0.9;
      ref.push((jx - w / 2) / hh, -(jy - hh) / hh); seed.push(Math.random());
    }
    this.count = seed.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bRef); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ref), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bSeed); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seed), gl.STATIC_DRAW);
    this.px = this.opts.size || (w < 700 ? 7 : 8);
    this.updateMask();
    if (!this.running) this.draw(this.lastT || 8);
  };
  RingField.prototype.start = function () { this.started = true; this.t0 = performance.now(); this.loop(); };
  RingField.prototype.loop = function () {
    var self = this;
    if (REDUCE || this.failed || this.running || !this.visible || !this.started) return;
    this.running = true;
    var last = performance.now();
    var frame = function (now) {
      if (!self.visible || !self.started) { self.running = false; return; }
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      var t = (now - self.t0) / 1000;
      if (self.grow < 1) self.grow = Math.min(1, self.grow + dt / 2.4);
      self.draw(t);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  RingField.prototype.draw = function (t) {
    var gl = this.gl, u = this.u, o = this.opts;
    if (!gl || !this.count) return;
    this.lastT = t;
    var wx = Math.sin(t * 0.21) * 0.22 + Math.sin(t * 0.37 + 1.3) * 0.1, wy = Math.cos(t * 0.17) * 0.08 + Math.sin(t * 0.29) * 0.05;
    var cx = (o.center || [0, 0])[0], cy = (o.center || [0, 0])[1];
    this.target = this.pointer ? [cx + this.pointer[0] * 0.32 + wx * 0.5, cy + this.pointer[1] * 0.3 + wy * 0.5] : [cx + wx, cy + wy];
    var k = this.pointer ? 0.025 : 0.012;
    this.ring[0] += (this.target[0] - this.ring[0]) * k; this.ring[1] += (this.target[1] - this.ring[1]) * k;
    if (REDUCE) this.ring = [cx, cy];
    if (this.maskEl && (Math.round(t * 10) % 5 === 0)) this.updateMask();
    var ease = 1 - Math.pow(1 - this.grow, 3);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform1f(u.uTime, t); gl.uniform1f(u.uAspect, this.aspect);
    gl.uniform1f(u.uRadius, o.radius || 0.72); gl.uniform1f(u.uWidth, o.width || 0.17);
    gl.uniform1f(u.uPx, this.px); gl.uniform1f(u.uDpr, this.dpr); gl.uniform1f(u.uGrow, 0.35 + ease * 0.65);
    gl.uniform1f(u.uMaskMin, this.maskEl ? this.maskMin : 1);
    gl.uniform2f(u.uRing, this.ring[0], this.ring[1]);
    gl.uniform4f(u.uMask, this.mask[0], this.mask[1], this.mask[2], this.mask[3]);
    gl.uniform3fv(u.uC1, this.colors[0]); gl.uniform3fv(u.uC2, this.colors[1]); gl.uniform3fv(u.uC3, this.colors[2]);
    gl.uniform1f(u.uAlpha, this.alpha * ease);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bRef); gl.enableVertexAttribArray(this.aRef); gl.vertexAttribPointer(this.aRef, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bSeed); gl.enableVertexAttribArray(this.aSeed); gl.vertexAttribPointer(this.aSeed, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, this.count);
  };

  /* ---------------- MorphField ---------------- */
  var SHAPES = {
    radar: function (g, w, h) {
      var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
      g.lineWidth = Math.max(2, R * 0.02);
      [0.34, 0.67, 1].forEach(function (k) { g.beginPath(); g.arc(cx, cy, R * k, 0, Math.PI * 2); g.stroke(); });
      var rnd = mulberry(7);
      for (var i = 0; i < 14; i++) { var a = rnd() * Math.PI * 2, r = R * (0.2 + rnd() * 0.75); g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, R * 0.035, 0, Math.PI * 2); g.fill(); }
    },
    shield: function (g, w, h) {
      var s = Math.min(w, h) * 0.8, x = w / 2 - s * 0.4, y = h / 2 - s * 0.47;
      g.lineWidth = Math.max(2.5, s * 0.022); g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + s * 0.4, y); g.lineTo(x + s * 0.78, y + s * 0.15); g.lineTo(x + s * 0.78, y + s * 0.45);
      g.bezierCurveTo(x + s * 0.78, y + s * 0.72, x + s * 0.6, y + s * 0.86, x + s * 0.4, y + s * 0.94);
      g.bezierCurveTo(x + s * 0.2, y + s * 0.86, x + s * 0.02, y + s * 0.72, x + s * 0.02, y + s * 0.45);
      g.lineTo(x + s * 0.02, y + s * 0.15); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(x + s * 0.24, y + s * 0.47); g.lineTo(x + s * 0.36, y + s * 0.6); g.lineTo(x + s * 0.58, y + s * 0.34); g.stroke();
    },
    chain: function (g, w, h) {
      var n = 3, bw = Math.min(w * 0.22, h * 0.36), gap = bw * 0.42, total = n * bw + (n - 1) * gap, x0 = w / 2 - total / 2, y0 = h / 2 - bw / 2;
      g.lineWidth = Math.max(2, bw * 0.03); g.lineCap = 'round';
      for (var i = 0; i < n; i++) {
        var x = x0 + i * (bw + gap);
        roundRect(g, x, y0, bw, bw, bw * 0.14); g.stroke();
        for (var l = 0; l < 3; l++) { g.beginPath(); g.moveTo(x + bw * 0.2, y0 + bw * (0.34 + l * 0.16)); g.lineTo(x + bw * (l === 2 ? 0.55 : 0.8), y0 + bw * (0.34 + l * 0.16)); g.stroke(); }
        if (i < n - 1) { g.beginPath(); g.moveTo(x + bw + gap * 0.18, y0 + bw / 2); g.lineTo(x + bw + gap * 0.82, y0 + bw / 2); g.stroke(); }
      }
    }
  };
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function MorphField(host, opts) {
    opts = opts || {};
    this.host = host; this.opts = opts;
    this.canvas = document.createElement('canvas'); host.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.shape = opts.shapes ? opts.shapes[0] : 'radar';
    this.mouse = null; this.running = false; this.visible = false;
    var self = this;
    this.resize();
    if ('ResizeObserver' in window) new ResizeObserver(function () { self.resize(); }).observe(host);
    host.addEventListener('pointermove', function (e) { var r = self.canvas.getBoundingClientRect(); self.mouse = [e.clientX - r.left, e.clientY - r.top]; }, { passive: true });
    host.addEventListener('pointerleave', function () { self.mouse = null; });
    onVisible(host, function (v) { self.visible = v; self.loop(); });
  }
  MorphField.prototype.resize = function () {
    var w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
    var dpr = DPR(); this.dpr = dpr; this.w = w; this.h = h;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    var n = w < 600 ? 900 : 1500;
    if (!this.p || this.p.length !== n) {
      this.p = [];
      var rnd = mulberry(42);
      for (var i = 0; i < n; i++) this.p.push({ x: rnd() * w, y: rnd() * h, vx: 0, vy: 0, tx: w / 2, ty: h / 2, s: 0.6 + rnd() * 0.8, k: rnd() < 0.07 ? 1 : 0, ph: rnd() * 6.28 });
    }
    this.targets = {};
    this.setShape(this.shape, true);
  };
  MorphField.prototype.sample = function (name) {
    if (this.targets[name]) return this.targets[name];
    var w = Math.round(this.w / 2), h = Math.round(this.h / 2), c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d', { willReadFrequently: true }); g.strokeStyle = g.fillStyle = '#fff';
    SHAPES[name](g, w, h);
    var d = g.getImageData(0, 0, w, h).data, pts = [];
    for (var y = 0; y < h; y += 1) for (var x = 0; x < w; x += 1) if (d[(y * w + x) * 4 + 3] > 120) pts.push(x * 2, y * 2);
    var out = [], m = pts.length / 2, rnd = mulberry(name.length * 31);
    for (var i = 0; i < this.p.length; i++) { var j = Math.floor(rnd() * m); out.push(pts[j * 2] + (rnd() - 0.5) * 3, pts[j * 2 + 1] + (rnd() - 0.5) * 3); }
    this.targets[name] = out; return out;
  };
  MorphField.prototype.setShape = function (name, instant) {
    this.shape = name;
    var t = this.sample(name), w = this.w, h = this.h, rnd = mulberry(name.length * 13);
    for (var i = 0; i < this.p.length; i++) {
      var p = this.p[i];
      if (p.k && name === 'shield') { var a = rnd() * Math.PI * 2, r = Math.min(w, h) * (0.5 + rnd() * 0.12); p.tx = w / 2 + Math.cos(a) * r * 1.15; p.ty = h / 2 + Math.sin(a) * r * 0.8; }
      else { p.tx = t[i * 2]; p.ty = t[i * 2 + 1]; }
      if (instant || REDUCE) { p.x = p.tx; p.y = p.ty; }
      else { p.vx += (Math.random() - 0.5) * 6; p.vy += (Math.random() - 0.5) * 6; }
    }
    if (!this.running) this.draw(0);
  };
  MorphField.prototype.loop = function () {
    var self = this;
    if (REDUCE || this.running || !this.visible) return;
    this.running = true;
    var frame = function (now) { if (!self.visible) { self.running = false; return; } self.step(now / 1000); self.draw(now / 1000); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  };
  MorphField.prototype.step = function (t) {
    var m = this.mouse;
    for (var i = 0; i < this.p.length; i++) {
      var p = this.p[i];
      var ax = (p.tx + Math.sin(t * 1.3 + p.ph) * 1.6 - p.x) * 0.018, ay = (p.ty + Math.cos(t * 1.1 + p.ph) * 1.6 - p.y) * 0.018;
      if (m) { var dx = p.x - m[0], dy = p.y - m[1], d2 = dx * dx + dy * dy; if (d2 < 9000) { var f = (1 - d2 / 9000) * 1.6, d = Math.sqrt(d2) || 1; ax += dx / d * f; ay += dy / d * f; } }
      p.vx = (p.vx + ax) * 0.86; p.vy = (p.vy + ay) * 0.86;
      p.x += p.vx; p.y += p.vy;
    }
  };
  MorphField.prototype.draw = function (t) {
    var g = this.g, dpr = this.dpr, cols = this.opts.colors || ['#5b9dff', '#2cc0f5', '#e8f1ff'], coral = '#ff7d73';
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (var i = 0; i < this.p.length; i++) {
      var p = this.p[i], sp = Math.hypot(p.vx, p.vy), ang = sp > 0.15 ? Math.atan2(p.vy, p.vx) : Math.atan2(p.y - this.h / 2, p.x - this.w / 2);
      var len = (3.2 + Math.min(sp, 4) * 1.4) * p.s, wid = 1.7 * p.s;
      g.setTransform(Math.cos(ang) * dpr, Math.sin(ang) * dpr, -Math.sin(ang) * dpr, Math.cos(ang) * dpr, p.x * dpr, p.y * dpr);
      g.globalAlpha = p.k ? 0.95 : 0.66 + (i % 4) * 0.09;
      g.fillStyle = p.k ? coral : cols[i % 3];
      g.fillRect(-len / 2, -wid / 2, len, wid);
    }
    g.globalAlpha = 1;
  };

  /* ---------------- DotWave ---------------- */
  function DotWave(canvas, opts) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.opts = opts || {}; this.hover = 0; this.target = 0; this.mouse = null;
    var self = this, host = canvas.parentElement;
    this.resize();
    if ('ResizeObserver' in window) new ResizeObserver(function () { self.resize(); }).observe(host);
    host.addEventListener('pointerenter', function () { self.target = 1; });
    host.addEventListener('pointerleave', function () { self.target = 0; self.mouse = null; });
    host.addEventListener('pointermove', function (e) { var r = canvas.getBoundingClientRect(); self.mouse = [e.clientX - r.left, e.clientY - r.top]; }, { passive: true });
    onVisible(host, function (v) { self.visible = v; self.loop(); });
  }
  DotWave.prototype.resize = function () {
    var w = this.c.parentElement.clientWidth, h = this.c.parentElement.clientHeight, dpr = DPR();
    this.w = w; this.h = h; this.dpr = dpr; this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    if (!this.running) this.draw(2);
  };
  DotWave.prototype.loop = function () {
    var self = this; if (REDUCE || this.running || !this.visible) return; this.running = true;
    var frame = function (now) { if (!self.visible) { self.running = false; return; } self.hover += (self.target - self.hover) * 0.05; self.draw(now / 1000); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  };
  DotWave.prototype.draw = function (t) {
    var g = this.g, w = this.w, h = this.h, dpr = this.dpr, sp = 15, cs = getComputedStyle(document.documentElement);
    var base = cs.getPropertyValue('--ink-4').trim() || '#c9ced8', hot = cs.getPropertyValue('--brand').trim() || '#1667d9';
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    var amp = 5 + this.hover * 7, m = this.mouse, phase = this.opts.phase || 0;
    for (var y = sp; y < h; y += sp) for (var x = sp; x < w; x += sp) {
      var nx = x / w, ny = y / h;
      var fade = Math.sin(Math.PI * nx) * Math.sin(Math.PI * ny);
      var dy = Math.sin(x * 0.018 + t * 0.9 + phase) * Math.cos(y * 0.022 - t * 0.6) * amp * fade;
      var r = 0.9 + fade * 0.5, near = 0;
      if (m) { var d = Math.hypot(x - m[0], y + dy - m[1]); near = Math.max(0, 1 - d / 140); }
      g.globalAlpha = 0.25 + fade * 0.6;
      g.fillStyle = near > 0.05 ? hot : base;
      g.beginPath(); g.arc(x, y + dy, r + near * 1.3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  };

  window.ZXFX = { RingField: RingField, MorphField: MorphField, DotWave: DotWave, REDUCE: REDUCE };
})();
