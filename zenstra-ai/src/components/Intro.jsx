import { useEffect, useRef } from 'react';
import { Mark, Wordmark } from './Logo.jsx';
import { anim, wait, $, $$, reduced, markIntroDone } from '../lib/env.js';
import { letters, swapSlot, swapTo, lettersOut, DROP } from '../lib/text.js';
import { stopScroll, startScroll } from '../lib/scroll.js';

/* Opening sequence (home, first visit in a tab, or ?intro=1).
   "Zenstra for workflow security" arrives as one line and holds about 1.5 s; cloud
   security and EDR move faster; the line gives way to the Zenstra logo; every agent
   in the field converges into the mark, and the page opens through it. */
const HOLD_FIRST = 850, HOLD_NEXT = [560, 680];

export default function Intro() {
  const ref = useRef(null);

  useEffect(() => {
    const root = document.documentElement, intro = ref.current;
    if (!intro || !root.classList.contains('intro-play')) { markIntroDone(); return undefined; }
    try { sessionStorage.setItem('zx5-intro', '1'); } catch (e) { /* private mode */ }
    stopScroll();
    let alive = true, done = false, opened = false, field = null;
    const word = $('.intro-word', intro), line = $('.intro-line', intro), logo = $('.intro-logo', intro), forEl = $('.intro-for', intro), skip = $('.intro-skip', intro);
    const words = word.getAttribute('data-words').split('|');
    const mark = () => { const m = $('.logo-mark .th-dark', logo) || $('.logo-mark', logo), r = m.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width / 2 }; };
    const finish = () => { root.classList.remove('intro-play'); startScroll(); if (field) field.stop(); };
    const reveal = (fast) => {
      if (opened || !alive) return; opened = true;
      const m = mark();
      anim($('.logo-word', logo), [{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
      anim(skip, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      anim($('.logo-mark', logo), [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.18)' }], { duration: 260, delay: 60, easing: 'ease-in' });
      if (!field) { const f = anim(intro, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 }); if (f) f.onfinish = finish; else finish(); markIntroDone(); return; }
      const OPEN = fast ? 900 : 1800;
      field.open(m.x, m.y, Math.max(16, m.s * 0.9), OPEN).then(finish);
      // The page zooms in toward the viewer as the star window opens over it.
      if (!reduced()) [$('.head'), $('main')].forEach((el) => {
        if (!el) return; const r = el.getBoundingClientRect();
        el.style.transformOrigin = (m.x - r.left) + 'px ' + (m.y - r.top) + 'px';
        const z = anim(el, [{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: OPEN + 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        const clear = () => { el.style.transformOrigin = ''; if (z) z.cancel(); };
        if (z) z.onfinish = clear; else clear();
      });
      setTimeout(markIntroDone, fast ? 200 : 700);
    };
    const toLogo = () => {
      anim(logo, [{ opacity: 0, transform: 'translateY(-0.6em)', filter: 'blur(10px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }], { duration: 520, easing: DROP });
    };
    const open = () => {
      // Skip: go straight to the logo and open the page through it.
      if (done || !alive) return; done = true;
      anim(line, [{ opacity: getComputedStyle(line).opacity }, { opacity: 0 }], { duration: 180 });
      if (getComputedStyle(logo).opacity < 0.5) toLogo();
      setTimeout(() => reveal(true), 260);
    };
    skip.addEventListener('click', open);
    intro.addEventListener('click', open);
    window.addEventListener('keydown', open, { once: true });

    const fieldReady = import('../lib/fx5.js').then((m) => {
      if (!alive) return;
      field = m.IntroField ? m.IntroField(intro) : null;
      if (field) intro.classList.add('cv');
    }).catch(() => {});

    const fl = letters(forEl, forEl.textContent), cur = swapSlot(word, words[0]), all = fl.concat($$('.l', cur));
    let k = 0, lastIn = null;
    all.forEach((l) => { l.style.opacity = 0; lastIn = anim(l, [{ transform: 'translateY(-0.45em)', filter: 'blur(12px)', opacity: 0 }, { transform: 'translateY(0)', filter: 'blur(0)', opacity: 1 }], { duration: 560, delay: 160 + k * 8, easing: DROP }); k++; });
    // The hold starts once the whole line has arrived, so a busy first second (the
    // page still loading) never shortens how long it can be read.
    const arrived = lastIn && lastIn.finished ? lastIn.finished.catch(() => {}) : wait(160 + k * 8 + 560);
    let seq = arrived.then(() => wait(HOLD_FIRST)).then(() => { all.forEach((l) => { l.style.opacity = ''; }); });
    words.slice(1).forEach((w, i) => {
      seq = seq.then(() => { if (!done && alive) return swapTo(word, w); })
        .then(() => { if (!done && alive) return wait(HOLD_NEXT[i] || 600); });
    });
    seq.then(() => {
      if (done || !alive) return undefined;
      lettersOut($$('.l', line), { dur: 340, stag: 9, dist: '0.42em', blur: '10px' });
      setTimeout(toLogo, 160);
      return wait(160 + 300);
    }).then(() => fieldReady).then(() => {
      if (done || !alive) return undefined;
      if (!field) return wait(600);
      const m = mark();
      return field.converge(m.x, m.y, 720).then(() => wait(380));
    }).then(() => { if (!done && alive) { done = true; reveal(false); } });

    return () => {
      alive = false;
      skip.removeEventListener('click', open);
      intro.removeEventListener('click', open);
      window.removeEventListener('keydown', open);
      if (root.classList.contains('intro-play')) { finish(); markIntroDone(); }
    };
  }, []);

  return (
    <div className="intro" aria-hidden="true" ref={ref}>
      <div className="intro-stage">
        <p className="intro-line"><span className="intro-for">Zenstra for</span>{' '}<span className="intro-word" data-words="workflow security|cloud security|EDR"></span></p>
        <div className="intro-logo"><Mark /><Wordmark /></div>
      </div>
      <button className="intro-skip" type="button" tabIndex={-1}>Skip intro</button>
    </div>
  );
}
