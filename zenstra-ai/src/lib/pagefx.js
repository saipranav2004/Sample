/* Page motion and interactions (ported from the static site's v5.js), scoped to
   one page's root element. mountPageFx(root) wires everything it finds and returns
   a function that tears it all down again when the page unmounts. */
import { anim, reduced, onThemeChange, introDone, wait, EASE, $, $$ } from './env.js';
import { switcher, scanReveal, splitWords } from './text.js';

const EVENTS = [
  ['block', 'Prompt injection blocked', 'member-chat-assist · kb.article #4471'],
  ['allow', 'Allowed within scope', 'loan-doc-classifier · los.read · 6 ms'],
  ['hold', 'Held for approval', 'sar-prep-agent · core.txn.query (90d)'],
  ['block', 'Policy enforced', 'n8n:card-dispute · write:core · denied'],
  ['allow', 'Agent identity verified', 'copilot-hr-assist · attested 2 ms ago'],
  ['block', 'Shadow agent contained', 'cursor · laptop-114 · unregistered MCP'],
  ['hold', 'Step-up requested', 'dev-agent-ci · shell.exec (prod)']
];
const ICON = {
  block: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M4 12 12 4"/></svg>',
  hold: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 1.5"/></svg>',
  allow: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>'
};

export function mountPageFx(root) {
  const REDUCE = reduced();
  const offs = [];
  const timers = new Set();
  let alive = true;
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };
  const every = (fn, ms) => { const id = setInterval(() => { if (alive) fn(); }, ms); offs.push(() => clearInterval(id)); return id; };
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
  const observe = (cb, opts, els) => {
    if (!('IntersectionObserver' in window)) return null;
    const o = new IntersectionObserver(cb, opts); els.forEach((e) => o.observe(e)); offs.push(() => o.disconnect()); return o;
  };
  const onView = (el, fn, th) => {
    if (REDUCE || !('IntersectionObserver' in window)) { fn(); return; }
    const o = observe((es) => { if (es[0].isIntersecting) { o.disconnect(); fn(); } }, { threshold: th || 0.5 }, [el]);
  };

  /* ---------------- Reveals ---------------- */
  const reveals = $$('[data-reveal]', root), words = $$('[data-words]', root);
  words.forEach(splitWords);
  reveals.forEach((el) => { const d = el.getAttribute('data-delay'); if (d) el.style.transitionDelay = d + 'ms'; });
  if (REDUCE || !('IntersectionObserver' in window)) reveals.concat(words).forEach((el) => el.classList.add('in'));
  else {
    const io = observe((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' }, reveals.concat(words));
  }

  /* ---------------- Count-up and figures ---------------- */
  const countTo = (el, to, dec, pre, suf, dur) => {
    if (REDUCE) { el.textContent = pre + to.toFixed(dec) + suf; return; }
    const t0 = performance.now();
    const step = (now) => { if (!alive) return; const k = Math.min(1, (now - t0) / dur), v = to * (1 - Math.pow(1 - k, 4)); el.textContent = pre + v.toFixed(dec) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  $$('[data-count]', root).forEach((el) => {
    const raw = el.getAttribute('data-count'), to = parseFloat(raw), dec = (raw.split('.')[1] || '').length, pre = el.getAttribute('data-pre') || '', suf = el.getAttribute('data-suf') || '';
    if (!REDUCE) el.textContent = pre + (0).toFixed(dec) + suf;
    onView(el, () => countTo(el, to, dec, pre, suf, 1500));
  });
  $$('.fig', root).forEach((f) => {
    const d = +f.getAttribute('data-delay') || 0;
    onView(f, () => later(() => f.classList.add('drawn'), REDUCE ? 0 : d + 150));
  });

  /* ---------------- Hero ---------------- */
  const engines = [];
  let fx = null;
  const fxReady = import('./fx5.js').then((m) => {
    if (!alive) return null;
    fx = m;
    $$('.lens', root).forEach((h) => {
      const sec = h.closest('section'), mask = sec ? sec.querySelector('[data-lens-mask]') : null;
      const e = m.LensField(h, { mask, cx: +h.getAttribute('data-cx') || 0.66, cy: +h.getAttribute('data-cy') || 0.5 });
      engines.push(e); offs.push(onThemeChange(e.theme));
    });
    $$('.cta .stream', root).forEach((h) => engines.push(m.GateStream(h, { gate: 0.76, dark: true, density: 0.8 })));
    return m;
  });

  const fillChip = (c, e) => { c.className = 'dchip ' + e[0] + (c.classList.contains('on') ? ' on' : ''); c.innerHTML = '<span class="ic">' + ICON[e[0]] + '</span><span><b>' + e[1] + '</b><small>' + e[2] + '</small></span>'; };
  const runChips = () => {
    // Page-specific chips (data-fixed) keep their content and only arrive in turn.
    $$('.dchip[data-fixed]', root).forEach((c, i) => later(() => c.classList.add('on'), REDUCE ? 0 : 300 + i * 450));
    const chips = $$('.dchip:not([data-fixed])', root); if (!chips.length) return;
    let k = 0;
    chips.forEach((c, i) => { fillChip(c, EVENTS[k++ % EVENTS.length]); later(() => c.classList.add('on'), REDUCE ? 0 : 300 + i * 450); });
    if (REDUCE) return;
    let j = 0;
    every(() => {
      if (document.hidden) return;
      const c = chips[j % chips.length]; j++;
      c.classList.remove('on');
      later(() => { fillChip(c, EVENTS[k++ % EVENTS.length]); c.classList.add('on'); }, 650);
    }, 2600);
  };
  const runPack = () => {
    const pack = $('[data-pack]', root); if (!pack) return;
    const rows = $$('.prow', pack), bar = $('.pack-foot .bar i', pack), label = $('.pack-foot span', pack);
    if (REDUCE) { rows.forEach((r) => r.classList.add('on')); pack.classList.add('done'); if (label) label.textContent = 'Generated'; return; }
    anim(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: rows.length * 650 + 300, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
    rows.forEach((r, i) => {
      later(() => {
        r.classList.add('on');
        const p = $('path', r); if (p) { const L = p.getTotalLength(); p.style.strokeDasharray = L; anim(p, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 450 }); }
        const v = $('.v', r); if (v) anim(v, [{ opacity: 0, transform: 'translateX(6px)' }, { opacity: 1, transform: 'none' }], { duration: 500 });
      }, 250 + i * 650);
    });
    later(() => { pack.classList.add('done'); if (label) label.textContent = 'Generated'; }, 250 + rows.length * 650);
  };
  const startHero = () => {
    if (!alive) return;
    const h = $('[data-scan]', root);
    const scope = h ? (h.closest('section') || root) : root;
    if (!h) { scope.classList.add('hero-ready'); runChips(); runPack(); return; }
    wait(REDUCE ? 0 : 150).then(() => alive && scanReveal(h)).then(() => {
      if (!alive) return;
      scope.classList.add('hero-ready');
      $$('[data-switch]', root).forEach((el) => offs.push(switcher(el)));
      runChips();
      runPack();
    });
  };
  // The home hero waits for the opening sequence; every other page starts at once.
  introDone.then(startHero);

  /* ---------------- Products ---------------- */
  const prods = $$('.prod', root);
  if (prods.length) {
    const vizzes = prods.map(() => null);
    let prodIdx = 0, prodTimer = null, prodBar = null, prodUser = false, prodVis = false;
    // After a link opens a panel, scrolling can slide another panel under a still pointer;
    // hover only switches panels once the pointer has really moved.
    let pointerMoved = true;
    on(document, 'mousemove', () => { pointerMoved = true; }, { passive: true });
    const narrow = () => matchMedia('(max-width: 1000px)').matches;
    const select = (p, user) => {
      const i = prods.indexOf(p); if (i < 0) return;
      if (user) prodUser = true;
      prodIdx = i;
      prods.forEach((q, k) => { q.classList.toggle('on', k === i); q.setAttribute('aria-expanded', String(k === i)); if (vizzes[k]) vizzes[k].setActive(narrow() || k === i); });
      if (prodBar) prodBar.cancel();
      clearTimeout(prodTimer);
      if (!REDUCE && !prodUser && prodVis && !narrow()) {
        prodBar = anim($('.timer', p), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 7000, easing: 'linear' });
        prodTimer = later(() => select(prods[(prodIdx + 1) % prods.length]), 7000);
      }
    };
    prods.forEach((p) => {
      on(p, 'click', (e) => { if (e.target.closest('a')) return; select(p, true); });
      on(p, 'keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) { e.preventDefault(); select(p, true); } });
      on(p, 'mouseenter', () => { if (pointerMoved && !narrow() && !p.classList.contains('on')) select(p, true); });
      // An in-page link to a panel (#workflow, #cloud, #edr) opens it.
      on(p, 'zx:select', () => { pointerMoved = false; select(p, true); });
    });
    fxReady.then((m) => {
      if (!m) return;
      prods.forEach((p, k) => {
        const host = $('.viz', p), kind = p.getAttribute('data-viz');
        if (!host) return;
        const v = kind === 'workflow' ? m.WorkflowViz(host) : kind === 'cloud' ? m.CloudViz(host) : m.EdrViz(host);
        vizzes[k] = v; engines.push(v);
      });
      select(prods[prodIdx]);
    });
    observe((es) => { prodVis = es[0].isIntersecting; if (prodVis && !prodUser) select(prods[prodIdx]); else clearTimeout(prodTimer); }, { threshold: 0.4 }, [prods[0].parentElement]);
    select(prods[0]);
    on(window, 'resize', () => select(prods[prodIdx]));
    if (location.hash) { const hp = document.getElementById(location.hash.slice(1)); if (hp && hp.matches('.prod')) { pointerMoved = false; select(hp, true); } }
    offs.push(() => { clearTimeout(prodTimer); if (prodBar) prodBar.cancel(); });
  }

  /* ---------------- Console showcase ---------------- */
  $$('[data-show]', root).forEach((sec) => {
    const tabs = $$('.show-tab', sec), slides = $$('.show-slide', sec), cap = $('[data-caption]', sec), scan = $('.show-scan', sec), frame = $('.show-frame', sec);
    let idx = 0, timer = null, bar = null, vis = false, user = false;
    const go = (i, byUser) => {
      if (byUser) user = true;
      idx = i;
      tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
      slides.forEach((s, k) => s.classList.toggle('on', k === i));
      if (cap) cap.textContent = tabs[i].getAttribute('data-cap');
      if (!REDUCE && scan) anim(scan, [{ transform: 'translateY(0)' }, { transform: 'translateY(' + (frame.clientHeight + 160) + 'px)' }], { duration: 1100, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'none' });
      if (bar) bar.cancel(); clearTimeout(timer);
      if (!REDUCE && !user && vis) {
        bar = anim($('i', tabs[i]), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 6000, easing: 'linear' });
        timer = later(() => go((idx + 1) % tabs.length), 6000);
      }
    };
    tabs.forEach((t, i) => {
      on(t, 'click', () => go(i, true));
      on(t, 'keydown', (e) => { const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (d) { e.preventDefault(); const n = (idx + d + tabs.length) % tabs.length; go(n, true); tabs[n].focus(); } });
    });
    observe((es) => { vis = es[0].isIntersecting; if (vis && !user) go(idx); else clearTimeout(timer); }, { threshold: 0.35 }, [sec]);
    go(0);
    if (!REDUCE && frame) {
      const tilt = () => { const r = frame.getBoundingClientRect(), k = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.75))); frame.style.transform = 'rotateX(' + ((1 - k) * 14).toFixed(2) + 'deg) scale(' + (0.94 + k * 0.06).toFixed(3) + ')'; };
      on(window, 'scroll', tilt, { passive: true }); tilt();
    }
    offs.push(() => { clearTimeout(timer); if (bar) bar.cancel(); });
  });

  /* ---------------- Agenda line ---------------- */
  $$('[data-agenda]', root).forEach((list) => {
    const line = $('.prog', list), items = $$('li', list); if (!line) return;
    const upd = () => { const r = list.getBoundingClientRect(), k = REDUCE ? 1 : Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height)); line.style.transform = 'scaleY(' + k.toFixed(3) + ')'; items.forEach((li) => { const lr = li.getBoundingClientRect(); li.classList.toggle('lit', REDUCE || lr.top < innerHeight * 0.7); }); };
    on(window, 'scroll', upd, { passive: true }); upd();
  });

  /* ---------------- FAQ ---------------- */
  $$('.faq details', root).forEach((d) => {
    const s = $('summary', d), a = $('.a', d);
    on(s, 'click', (e) => {
      if (REDUCE || !a) return; e.preventDefault();
      if (d.open) { const x = a.animate([{ height: a.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 380, easing: EASE }); x.onfinish = () => { d.open = false; }; }
      else { d.open = true; const h = a.offsetHeight; a.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 520, easing: EASE }); }
    });
  });

  /* ---------------- Legal pages: mark the section being read ---------------- */
  $$('.legal-toc', root).forEach((toc) => {
    const links = $$('ol a', toc), secs = links.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
    let queued = false;
    const upd = () => {
      queued = false;
      let cur = 0; const line = innerHeight * 0.3;
      secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < line) cur = i; });
      links.forEach((a, i) => { if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    };
    on(window, 'scroll', () => { if (!queued) { queued = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  });

  return () => {
    alive = false;
    timers.forEach((id) => clearTimeout(id)); timers.clear();
    offs.splice(0).forEach((f) => f());
    engines.splice(0).forEach((e) => e && e.destroy && e.destroy());
  };
}

