/* Text motion (ported from the static site's v5.js).
   Word swap after go.ai's intro: the outgoing word sinks and blurs away while the
   next word drops in from above and sharpens, both at once. The slot eases to the
   new word's width, so a centred line re-centres smoothly instead of jumping. */
import { anim, reduced, $, $$ } from './env.js';

export const DROP = 'cubic-bezier(0.22, 1, 0.36, 1)';
const OUT = 'cubic-bezier(0.55, 0, 0.75, 0.3)';

// Words are split into letters so each swap ripples across the word.
export function letters(el, text) {
  el.textContent = '';
  for (let k = 0; k < text.length; k++) {
    const l = document.createElement('span');
    l.className = 'l'; l.textContent = text[k]; el.appendChild(l);
  }
  return $$('.l', el);
}

export function swapSlot(slot, first) {
  slot.classList.add('swap'); slot.textContent = '';
  const cur = document.createElement('span'); cur.className = 'sw'; letters(cur, first); slot.appendChild(cur);
  return cur;
}

export function lettersIn(ls, o) {
  let last = null;
  ls.forEach((l, k) => {
    last = anim(l, [{ transform: 'translateY(-' + o.dist + ')', filter: 'blur(' + o.blur + ')', opacity: 0 }, { transform: 'translateY(0)', filter: 'blur(0)', opacity: 1 }], { duration: o.dur, delay: (o.delay || 0) + k * o.stag, easing: DROP });
  });
  return last;
}

export function lettersOut(ls, o) {
  let last = null;
  ls.forEach((l, k) => {
    last = anim(l, [{ transform: 'translateY(0)', filter: 'blur(0)', opacity: 1 }, { transform: 'translateY(' + o.dist + ')', filter: 'blur(' + o.blur + ')', opacity: 0 }], { duration: o.dur, delay: k * o.stag, easing: OUT });
  });
  return last;
}

export function swapTo(slot, text, opts) {
  opts = opts || {};
  const cur = slot.querySelector('.sw:not(.out)');
  if (reduced()) { if (cur) letters(cur, text); slot.style.width = ''; return Promise.resolve(); }
  const nxt = document.createElement('span'); nxt.className = 'sw in'; const nl = letters(nxt, text); slot.appendChild(nxt);
  nl.forEach((l) => { l.style.opacity = 0; });
  const from = cur ? cur.getBoundingClientRect().width : 0, to = nxt.getBoundingClientRect().width;
  const d = opts.dur || 420, stag = opts.stag != null ? opts.stag : 14, dist = opts.dist || '0.42em', blur = opts.blur || '10px';
  slot.style.width = from + 'px';
  void slot.offsetWidth;
  slot.style.transition = 'width ' + (opts.widthMs || 520) + 'ms ' + DROP;
  slot.style.width = to + 'px';
  if (cur) {
    cur.classList.add('out');
    const o = lettersOut($$('.l', cur), { dur: d * 0.7, stag: stag * 0.6, dist, blur });
    if (o) o.onfinish = () => cur.remove(); else cur.remove();
  }
  const i = lettersIn(nl, { dur: d, stag, dist, blur, delay: 60 });
  return new Promise((res) => {
    const finish = () => { nxt.classList.remove('in'); nl.forEach((l) => { l.style.opacity = ''; }); slot.style.transition = ''; slot.style.width = ''; res(); };
    if (i) i.onfinish = finish; else finish();
  });
}

/* Rotating line (data-switch="a|b|c"). Returns a stop function. */
export function switcher(el, every = 2800) {
  const words = el.getAttribute('data-switch').split('|');
  let i = 0;
  swapSlot(el, words[0]);
  if (reduced()) return () => {};
  const id = setInterval(() => {
    if (document.hidden || !el.isConnected) return;
    i = (i + 1) % words.length;
    swapTo(el, words[i], { dist: '0.5em', blur: '8px', stag: 12 });
  }, every);
  return () => clearInterval(id);
}

/* Scan-line reveal of a multi-line headline. */
export function scanReveal(h) {
  const lines = $$('.scanline', h);
  if (reduced() || !lines.length) { h.classList.add('scanned'); return Promise.resolve(); }
  return new Promise((resolve) => {
    lines.forEach((ln, i) => {
      const inner = $('.in', ln), bar = $('.bar', ln), w = inner.getBoundingClientRect().width;
      const d = 1000, delay = i * 340;
      anim(inner, [{ clipPath: 'inset(-10% 100% -10% 0)' }, { clipPath: 'inset(-10% 0% -10% 0)' }], { duration: d, delay, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
      anim(bar, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(' + w + 'px)', opacity: 1, offset: 0.92 }, { transform: 'translateX(' + (w + 6) + 'px)', opacity: 0 }], { duration: d + 120, delay, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
    });
    setTimeout(() => { h.classList.add('scanned'); resolve(); }, (lines.length - 1) * 340 + 1100);
  });
}

/* Words that light up on view: wrap each word in a span (once). */
export function splitWords(el) {
  if (el.hasAttribute('data-split')) return;
  el.setAttribute('data-split', '');
  const walk = (node) => {
    Array.prototype.slice.call(node.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
          const s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s);
        });
        n.parentNode.replaceChild(frag, n);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
  $$('.w', el).forEach((w, i) => { w.style.transitionDelay = Math.min(i * 28, 1200) + 'ms'; });
}
