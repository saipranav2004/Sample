/* Zenstra: the four checks, in 3D (three.js).
 *
 * The scene is zenstra.ai's own platform diagram, built as one object:
 * callers on the left (users, AI agents, peer agents), the protected surfaces
 * on the right (MCP servers, external tools, APIs, enterprise systems), and
 * between them the Zenstra layer: a glass block every call passes through.
 * Inside are four glass panes, one per check: identity and attestation,
 * injection screening, tool scope brokering and memory integrity.
 *
 * Legitimate calls stream through all four panes (time-based). Scroll drives
 * the rest: the camera travels into the block pane by pane, each attack is
 * stopped at the pane whose check catches it, and when Zenstra is cut off
 * every pane closes (fail-closed). Units: flow runs along +X, Y is up.
 */
import * as THREE from './vendor/three-0.170.0.module.min.js';

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;

const BLOCK = { w: 2.6, h: 1.5, d: 1.7, y: 0.95 };            // the Zenstra layer
const PANES = [-0.84, -0.28, 0.28, 0.84];                      // x of each check
const CHECKS = [['01', 'Identity & attestation'], ['02', 'Injection screening'], ['03', 'Tool scope brokering'], ['04', 'Memory integrity']];
const CALLERS = [['User', 'request or task'], ['AI agent', 'plans, calls tools'], ['Peer agents', 'A2A delegation']];
const SURFACES = [['MCP servers', 'tools over MCP'], ['External tools', 'browsers, code, shells'], ['APIs', 'internal and third-party'], ['Enterprise systems', 'CRM, ERP, data']];
const CALLER_Z = [-1.25, 0, 1.25], SURFACE_Z = [-1.8, -0.6, 0.6, 1.8];
const LEFT_X = -3.4, RIGHT_X = 3.4;
const ATTACKS = [
  { from: 2, to: 2, name: 'spoofed agent', out: 'Spoofed agent refused' },
  { from: 0, to: 3, name: 'hidden instruction', out: 'Injected instruction blocked' },
  { from: 1, to: 1, name: 'email.send → external', out: 'Out-of-scope call denied' },
  { from: 1, to: 0, name: 'unsigned memory write', out: 'Poisoned memory quarantined' },
];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// A soft studio so glass and enamel pick up gentle reflections.
function studio(renderer, dark) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), new THREE.MeshBasicMaterial({ color: dark ? 0x0d1a2a : 0xdfe8f2, side: THREE.BackSide })));
  const strip = (w, h, x, y, z, rx, ry, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k * 1.02, k * 1.06), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
  strip(12, 3, 0, 7.5, 0, Math.PI / 2, 0, dark ? 2.5 : 4);
  strip(2, 8, 7.5, 2, 3, 0, -Math.PI / 2, dark ? 1.5 : 2.5);
  strip(2, 8, -7.5, 2, -2, 0, Math.PI / 2, dark ? 1 : 1.6);
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromScene(s, 0.04).texture; pm.dispose(); return t;
}

export function create(host, opts) {
  const T = opts.timeline;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  const labelsEl = document.createElement('div'); labelsEl.className = 'c3d-labels'; host.appendChild(labelsEl);

  const scene = new THREE.Scene();
  const envs = {};
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb8c8da, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(-3, 8, 6); scene.add(sun);

  const C = {};   // theme colours
  const M = {
    card: new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    cardNear: new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3, transparent: true }),
    glass: new THREE.MeshPhysicalMaterial({ roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    pane: new THREE.MeshPhysicalMaterial({ roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
    edge: new THREE.LineBasicMaterial({ transparent: true }),
    path: new THREE.LineBasicMaterial({ transparent: true }),
  };

  // Floor: a dotted grid that fades out, and a soft shadow under the block.
  const gridTex = canvasTex(256, 256, (g, w) => { g.clearRect(0, 0, w, w); g.fillStyle = 'rgba(255,255,255,1)'; for (let x = 16; x < w; x += 32) for (let y = 16; y < w; y += 32) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); } });
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.repeat.set(14, 10);
  const fadeTex = canvasTex(256, 256, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, '#fff'); r.addColorStop(0.55, '#fff'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  const floorMat = new THREE.MeshBasicMaterial({ map: gridTex, alphaMap: fadeTex, transparent: true, depthWrite: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), floorMat); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const shadowTex = canvasTex(256, 256, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,0.5)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3), shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; scene.add(shadow);

  // The Zenstra block: rounded glass, a bright edge and the mark on top.
  const blockGeo = new THREE.ExtrudeGeometry(roundRect(BLOCK.d, BLOCK.h, 0.14), { depth: BLOCK.w, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 4, curveSegments: 10 });
  blockGeo.translate(0, 0, -BLOCK.w / 2); blockGeo.rotateY(Math.PI / 2);
  const block = new THREE.Mesh(blockGeo, M.glass); block.position.y = BLOCK.y; scene.add(block);
  const blockEdge = new THREE.LineSegments(new THREE.EdgesGeometry(blockGeo, 35), M.edge); blockEdge.position.y = BLOCK.y; scene.add(blockEdge);
  const markTex = { light: new THREE.TextureLoader().load('assets/img/zenstra-mark.png'), dark: new THREE.TextureLoader().load('assets/img/zenstra-mark-dark.png') };
  Object.values(markTex).forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; });
  const markMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.85 });
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.383), markMat); mark.rotation.x = -Math.PI / 2; mark.position.set(-BLOCK.w / 2 + 0.42, BLOCK.y + BLOCK.h / 2 + 0.035, BLOCK.d / 2 - 0.36); scene.add(mark);

  // Four panes inside, each with a light frame that reports its state.
  const paneGeo = new THREE.ExtrudeGeometry(roundRect(BLOCK.d - 0.32, BLOCK.h - 0.3, 0.08), { depth: 0.025, bevelEnabled: false });
  paneGeo.translate(0, 0, -0.0125); paneGeo.rotateY(Math.PI / 2);
  const frameGeo = new THREE.EdgesGeometry(paneGeo, 30);
  const panes = PANES.map((x) => {
    const m = new THREE.Mesh(paneGeo, M.pane.clone()); m.position.set(x, BLOCK.y, 0); scene.add(m);
    const fm = new THREE.LineBasicMaterial({ transparent: true, toneMapped: false });
    const f = new THREE.LineSegments(frameGeo, fm); f.position.copy(m.position); scene.add(f);
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK.d - 0.34, BLOCK.h - 0.32), new THREE.MeshBasicMaterial({ color: 0xff5a52, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    fill.rotation.y = Math.PI / 2; fill.position.copy(m.position); scene.add(fill);
    return { x, m, f, fm, fill };
  });

  // Caller and surface cards: enamel tiles with their names printed on.
  const cards = [];
  const cardGeo = new THREE.ExtrudeGeometry(roundRect(1.3, 0.62, 0.1), { depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 });
  function card(name, sub, x, z, side) {
    const g = new THREE.Group(); g.position.set(x, 0.36, z); g.rotation.y = side < 0 ? 0.42 : -0.42; scene.add(g);
    const body = new THREE.Mesh(cardGeo, side < 0 ? M.cardNear : M.card); body.position.z = -0.05; g.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.56), new THREE.MeshBasicMaterial({ transparent: true })); face.position.z = 0.072; g.add(face);
    const c = { g, face, name, sub, glow: 0, side };
    cards.push(c);
    return c;
  }
  const callers = CALLERS.map((c, i) => card(c[0], c[1], LEFT_X, CALLER_Z[i], -1));
  const surfaces = SURFACES.map((c, i) => card(c[0], c[1], RIGHT_X, SURFACE_Z[i], 1));
  function paintCards() {
    cards.forEach((c) => {
      if (c.face.material.map) c.face.material.map.dispose();
      c.face.material.map = canvasTex(512, 232, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = C.cardInk; g.font = '600 46px "Hanken Grotesk", system-ui, sans-serif'; g.textBaseline = 'alphabetic'; g.fillText(c.name, 36, 104);
        g.fillStyle = C.cardSub; g.font = '500 28px "JetBrains Mono", ui-monospace, monospace'; g.fillText(c.sub, 36, 160);
        g.fillStyle = c.side < 0 ? C.cyan : C.accent; g.beginPath(); g.arc(w - 46, 52, 9, 0, 7); g.fill();
      });
      c.face.material.needsUpdate = true;
    });
  }

  // Routes: from each caller into the block, through it, out to each surface.
  const entry = (i) => new THREE.Vector3(-BLOCK.w / 2 - 0.05, BLOCK.y + (i - 1) * 0.28, (i - 1) * 0.42);
  const exit = (j) => new THREE.Vector3(BLOCK.w / 2 + 0.05, BLOCK.y + (j - 1.5) * 0.2, (j - 1.5) * 0.3);
  const inCurves = callers.map((c, i) => new THREE.CatmullRomCurve3([new THREE.Vector3(LEFT_X + 0.62, 0.36, CALLER_Z[i] + 0.25), new THREE.Vector3(LEFT_X + 1.6, 0.6, CALLER_Z[i] * 0.8), new THREE.Vector3(-BLOCK.w / 2 - 0.8, entry(i).y, entry(i).z), entry(i)]));
  const outCurves = surfaces.map((c, j) => new THREE.CatmullRomCurve3([exit(j), new THREE.Vector3(BLOCK.w / 2 + 0.8, exit(j).y, exit(j).z), new THREE.Vector3(RIGHT_X - 1.6, 0.6, SURFACE_Z[j] * 0.85), new THREE.Vector3(RIGHT_X - 0.62, 0.36, SURFACE_Z[j] + 0.25)]));
  [...inCurves, ...outCurves].forEach((cv) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(cv.getPoints(60)), M.path); scene.add(l); });
  // A call's position: along its in-route (0..1), across the block (1..2), along its out-route (2..3).
  const at = (from, to, u, out) => {
    if (u < 1) return out.copy(inCurves[from].getPoint(u));
    if (u < 2) { const a = entry(from), b = exit(to), k = u - 1; return out.set(lerp(a.x, b.x, k), lerp(a.y, b.y, ease(k)), lerp(a.z, b.z, ease(k))); }
    return out.copy(outCurves[to].getPoint(Math.min(1, u - 2)));
  };
  const uOfX = (from, to, x) => 1 + (x - entry(from).x) / (exit(to).x - entry(from).x);

  // Calls: glowing beads. Legitimate ones run on time; attacks follow scroll.
  const glowTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  const NP = 14;
  const beadGeo = new THREE.SphereGeometry(0.035, 16, 12);
  const okMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const okGlowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const calls = Array.from({ length: NP }, (_, k) => {
    const m = new THREE.Mesh(beadGeo, okMat), s = new THREE.Sprite(okGlowMat); s.scale.setScalar(0.22); scene.add(m, s);
    return { m, s, from: k % 3, to: Math.floor(rnd() * 4), u: (k / NP) * 3, v: 0.32 + rnd() * 0.12 };
  });
  const badMat = new THREE.MeshBasicMaterial({ color: 0xff5a52, toneMapped: false, transparent: true });
  const badGlowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff5a52, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const attacks = ATTACKS.map((a) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), badMat.clone()), s = new THREE.Sprite(badGlowMat.clone()); s.scale.setScalar(0.3); scene.add(m, s); return Object.assign({ m, s }, a); });
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 64), new THREE.MeshBasicMaterial({ color: 0xff5a52, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  ripple.rotation.y = Math.PI / 2; scene.add(ripple);

  // HTML labels.
  const tag = (cls, html) => { const d = document.createElement('div'); d.className = 'c3d-tag ' + cls; d.innerHTML = html; labelsEl.appendChild(d); return d; };
  const paneTags = CHECKS.map((c) => tag('stage', '<b>' + c[0] + '</b><span>' + c[1] + '</span>'));
  const layerTag = tag('io', '<b>ZENSTRA</b>inline · fail-closed · 18 ms p95');
  const sideTags = [tag('side', 'Callers'), tag('side', 'Protected surfaces')];
  const attackTag = tag('attack', ''), resultTag = tag('result', '');
  const caughtTags = ATTACKS.map((a) => tag('caught', '✕ ' + a.out));
  const failTag = tag('fail', '<b>Zenstra unreachable</b>every pane closed · nothing passes');

  let W = 1, H = 1, P = 0, active = false, raf = 0, dark = false, last = 0;
  const v = new THREE.Vector3(), tmp = new THREE.Vector3();
  const scr = (x, y, z) => { v.set(x, y, z).project(camera); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H, v.z < 1]; };
  const place = (el, xy, show, dx = 0, dy = 0) => { const o = show ? 1 : 0; if (el._o !== o) { el.style.opacity = o; el._o = o; } if (show) el.style.transform = 'translate(' + (xy[0] + dx).toFixed(1) + 'px,' + (xy[1] + dy).toFixed(1) + 'px)'; };

  function theme() {
    const r = document.documentElement;
    dark = r.getAttribute('data-theme') === 'dark' || (!r.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    envs[dark] = envs[dark] || studio(renderer, dark); scene.environment = envs[dark];
    Object.assign(C, dark
      ? { card: 0x0f2741, cardInk: '#e9f3ff', cardSub: '#7c94ae', cyan: '#5cd2ff', accent: '#00a8ef', edge: 0x5cd2ff, path: 0x2b5a85, grid: 0x23415f, glass: 0x9fdcff }
      : { card: 0xffffff, cardInk: '#07182c', cardSub: '#6b87a6', cyan: '#00a8ef', accent: '#005aa4', edge: 0x2b9be0, path: 0x9cc0e2, grid: 0xb9cbe0, glass: 0xd6efff });
    M.card.color.set(C.card); M.cardNear.color.set(C.card);
    M.glass.color.set(C.glass);
    M.pane.color.set(C.glass);
    M.edge.color.set(C.edge); M.path.color.set(C.path); floorMat.color.set(C.grid);
    okMat.color.set(dark ? 0x5cd2ff : 0x00a8ef); okGlowMat.color.set(dark ? 0x5cd2ff : 0x00a8ef);
    shadowMat.opacity = dark ? 0.9 : 0.35;
    markMat.map = dark ? markTex.dark : markTex.light; markMat.needsUpdate = true;
    hemi.intensity = dark ? 0.5 : 0.9;
    paintCards();
    render(0);
  }
  function resize() { W = host.clientWidth; H = host.clientHeight; if (!W || !H) return; renderer.setSize(W, H, false); render(0); }

  // Camera stations: overview, into the block, each pane, back out.
  const S = {
    over: { pos: [-1.6, 6.4, 13.4], tgt: [-0.35, 0.45, 0], fov: 30 },
    near: { pos: [-2.4, 3.2, 7.2], tgt: [0, 0.8, 0], fov: 30 },
    pane: (i) => ({ pos: [PANES[i] - 2.6, BLOCK.y + 2.4, 6.2], tgt: [PANES[i] + 0.2, BLOCK.y - 0.1, 0], fov: 30 }),
  };
  const mix = (a, b, k) => ({ pos: a.pos.map((q, i) => lerp(q, b.pos[i], k)), tgt: a.tgt.map((q, i) => lerp(q, b.tgt[i], k)), fov: lerp(a.fov, b.fov, k) });
  function camAt(p) {
    if (p < T.intro[1]) return S.over;
    if (p < T.enter[1]) { const k = ease(seg(p, T.enter[0], T.enter[1])); return k < 0.5 ? mix(S.over, S.near, k * 2) : mix(S.near, S.pane(0), (k - 0.5) * 2); }
    for (let i = 0; i < 4; i++) {
      const s0 = T.stages[i];
      if (p < s0 + T.stageLen) return i === 0 ? S.pane(0) : mix(S.pane(i - 1), S.pane(i), ease(seg(p, s0, s0 + T.stageLen * 0.35)));
    }
    return mix(S.pane(3), S.over, ease(seg(p, T.outcome[0], T.outcome[0] + 0.05)));
  }
  const hitOf = (i) => T.stages[i] + T.hitAt;
  const closedK = (p) => ease(seg(p, T.fail[0] + 0.02, T.fail[0] + 0.05));

  function render(dt) {
    if (!W) return;
    const p = P, fail = closedK(p);
    // 1. Legitimate calls stream through; when Zenstra is cut off they queue at the block.
    const red = new THREE.Color(0xff5a52), amber = new THREE.Color(0xe8b25c), cyan = new THREE.Color(dark ? 0x5cd2ff : 0x00a8ef), good = new THREE.Color(0x2fc79b);
    calls.forEach((c, k) => {
      if (dt) {
        let nu = c.u + c.v * dt * (c.u > 0.98 && c.u < 2 ? 0.7 : 1);
        if (fail > 0.3 && c.u < 0.97 && nu >= 0.97) nu = 0.97 - (k % 4) * 0.03;
        c.u = nu; if (c.u > 3) { c.u = 0; c.from = Math.floor(rnd() * 3); c.to = Math.floor(rnd() * 4); }
      }
      at(c.from, c.to, c.u, tmp); c.m.position.copy(tmp); c.s.position.copy(tmp);
      const vis = p > 0.005; c.m.visible = c.s.visible = vis;
      if (c.u > 2.96 && dt) surfaces[c.to].glow = 1;
    });

    // 2. Panes: idle glass, the active check lit, a red flash on a catch, amber when closed.
    let cur = -1; T.stages.forEach((s0, i) => { if (p >= s0 && p < s0 + T.stageLen) cur = i; });
    panes.forEach((pn, i) => {
      const hit = hitOf(i), f = p >= hit ? 1 - seg(p, hit, hit + 0.05) : 0;
      const col = cyan.clone().lerp(red, f).lerp(amber, fail);
      pn.fm.color.copy(col); pn.fm.opacity = 0.35 + (cur === i ? 0.65 : 0) + f * 0.5 + fail * 0.5;
      pn.fill.material.color.copy(f > 0 ? red : amber); pn.fill.material.opacity = Math.max(f * 0.28, fail * 0.42);
    });
    M.edge.opacity = 0.65 + fail * 0.3; M.edge.color.set(C.edge).lerp(amber, fail);
    const insideK = seg(p, T.enter[0] + 0.06, T.enter[1]) * (1 - seg(p, T.outcome[0], T.outcome[0] + 0.04));
    M.glass.opacity = lerp(0.16, 0.05, insideK) + fail * 0.12;
    panes.forEach((pn, i) => { pn.m.material.opacity = (cur === i ? 0.16 : 0.08) + fail * 0.25; });
    M.cardNear.opacity = lerp(1, 0.12, insideK); callers.forEach((c) => { c.face.material.opacity = M.cardNear.opacity; });

    // 3. Attacks, scroll-driven: in from a caller, stopped at their pane.
    let showAttack = null;
    attacks.forEach((a, i) => {
      const s0 = T.stages[i], hit = hitOf(i), uStop = uOfX(a.from, a.to, PANES[i] - 0.03);
      const k = ease(seg(p, s0 - 0.04, hit)), after = seg(p, hit, hit + 0.03);
      const live = p > s0 - 0.04 && after < 1;
      at(a.from, a.to, k * uStop, tmp);
      a.m.position.copy(tmp); a.s.position.copy(tmp);
      a.m.visible = a.s.visible = live; a.m.material.opacity = 1 - after; a.s.material.opacity = 1 - after; a.m.scale.setScalar(1 - after * 0.6);
      if (live && p < hit) showAttack = a;
      if (p >= hit && p < hit + 0.05) { const r = seg(p, hit, hit + 0.05); ripple.position.set(PANES[i] - 0.02, tmp.y, tmp.z); ripple.scale.setScalar(1 + r * 9); ripple.material.opacity = (1 - r) * 0.9; }
    });
    if (!attacks.some((a, i) => p >= hitOf(i) && p < hitOf(i) + 0.05)) ripple.material.opacity = 0;

    // 4. Cards glow when a call lands.
    cards.forEach((c) => { if (dt) c.glow = Math.max(0, c.glow - dt * 2.5); c.face.material.color.setScalar(1 + c.glow * 0.25); });

    // 5. Camera, with the vanishing point pushed right of the copy.
    const c = camAt(p);
    camera.position.set(c.pos[0], c.pos[1], c.pos[2]); camera.lookAt(c.tgt[0], c.tgt[1], c.tgt[2]); camera.fov = c.fov;
    const cx = 0.68, fullW = W * 2 * cx;
    camera.aspect = fullW / H; camera.setViewOffset(fullW, H, 0, 0, W, H); camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    // 6. Labels.
    const overview = p < T.enter[0] + 0.02 || p >= T.outcome[0] + 0.03;
    panes.forEach((pn, i) => {
      const a = overview ? scr(pn.x, BLOCK.y + BLOCK.h / 2 + 0.06, -BLOCK.d / 2 + 0.2) : scr(pn.x, BLOCK.y - BLOCK.h / 2 + 0.12, BLOCK.d / 2 - 0.1);
      paneTags[i].classList.toggle('compact', overview); paneTags[i].classList.toggle('below', !overview);
      place(paneTags[i], a, a[2] && (overview ? p > 0.02 : cur === i), 0, overview ? -8 : 14);
    });
    place(layerTag, scr(0, BLOCK.y + BLOCK.h / 2 + 0.55, -BLOCK.d / 2), overview && p > 0.02, 0, 0);
    place(sideTags[0], scr(LEFT_X, 0.95, -1.8), overview && p < T.fail[0], 0, 0);
    place(sideTags[1], scr(RIGHT_X, 0.95, -2.4), overview && p < T.fail[0], 0, 0);
    if (showAttack) { const a = scr(showAttack.m.position.x, showAttack.m.position.y, showAttack.m.position.z); if (attackTag._n !== showAttack.name) { attackTag.textContent = showAttack.name; attackTag._n = showAttack.name; } place(attackTag, a, a[2] && a[1] < H * 0.7, 14, -26); } else place(attackTag, [0, 0], false);
    if (cur >= 0 && p >= hitOf(cur)) { const a = scr(PANES[cur], BLOCK.y + 0.42, 0.2); if (resultTag._i !== cur) { resultTag.textContent = '✕ ' + ATTACKS[cur].out; resultTag._i = cur; } place(resultTag, a, a[2], 0, 0); } else place(resultTag, [0, 0], false);
    const showCaught = p >= T.outcome[0] + 0.04 && p < T.fail[0];
    panes.forEach((pn, i) => { const a = scr(pn.x, BLOCK.y - BLOCK.h / 2 - 0.1, BLOCK.d / 2); place(caughtTags[i], a, showCaught && a[2], 0, 10 + i * 30); });
    place(failTag, scr(0, BLOCK.y, BLOCK.d / 2 + 0.2), fail > 0.5, 0, 0);
  }

  function tick(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    render(dt);
    raf = active ? requestAnimationFrame(tick) : (last = 0);
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
  theme(); resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { paintCards(); render(0); });

  return {
    set(p) { P = p; },
    theme,
    setActive(on) { active = on; if (on && !raf) raf = requestAnimationFrame(tick); },
    render: () => render(0),
  };
}
