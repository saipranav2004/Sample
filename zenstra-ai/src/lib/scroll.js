/* Smooth scrolling (Lenis) and in-page jumps, shared by every page. */
import Lenis from 'lenis';
import { reduced } from './env.js';

let lenis = null;
let rafId = 0;

export function initScroll() {
  if (lenis || reduced()) return lenis;
  lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
  const raf = (t) => { lenis.raf(t); rafId = requestAnimationFrame(raf); };
  rafId = requestAnimationFrame(raf);
  return lenis;
}

export const getLenis = () => lenis;
export function stopScroll() { if (lenis) lenis.stop(); }
export function startScroll() { if (lenis) lenis.start(); }

/* Jump to the top of a new page without animating through the old one. */
export function resetScroll() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
}

/* Going down the page the header slides away, so land on the target itself (a
   padded section needs no gap); going up it stays, so leave room under it. */
export function scrollToEl(el, opts = {}) {
  const top = el.getBoundingClientRect().top + window.scrollY;
  const down = top > window.scrollY && top > 480;
  const gap = opts.offset != null ? opts.offset : down ? (parseFloat(getComputedStyle(el).paddingTop) >= 24 ? 0 : 24) : 90;
  const y = Math.max(0, top - gap);
  if (lenis) lenis.scrollTo(y, opts.immediate ? { immediate: true, force: true } : undefined);
  else window.scrollTo({ top: y, behavior: reduced() || opts.immediate ? 'auto' : 'smooth' });
}

export function destroyScroll() {
  if (rafId) cancelAnimationFrame(rafId);
  if (lenis) lenis.destroy();
  lenis = null;
}
