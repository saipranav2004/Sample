/* Browser-side environment shared by the motion code. boot.js sets the classes on
   <html> before first paint: `js`, `reduce` (prefers-reduced-motion) and
   `intro-play` (the opening sequence should run). */
export const isBrowser = typeof window !== 'undefined';

export function reduced() {
  return isBrowser && document.documentElement.classList.contains('reduce');
}

export function isDark() {
  if (!isBrowser) return false;
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}

/* Theme change subscribers (canvas engines recolour themselves). */
const themeSubs = new Set();
export function onThemeChange(fn) {
  themeSubs.add(fn);
  return () => themeSubs.delete(fn);
}
export function notifyTheme() {
  themeSubs.forEach((f) => f());
}

/* The opening sequence: the home hero waits for it before its own entrance. */
let resolveIntro;
export const introDone = isBrowser
  ? new Promise((r) => { resolveIntro = r; })
  : Promise.resolve();
export function markIntroDone() {
  if (resolveIntro) resolveIntro();
}
if (isBrowser && !document.documentElement.classList.contains('intro-play')) markIntroDone();

export const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export function anim(el, kf, o) {
  return el && el.animate ? el.animate(kf, Object.assign({ fill: 'both', easing: EASE }, o)) : null;
}
export const $ = (s, c) => (c || document).querySelector(s);
export const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));
