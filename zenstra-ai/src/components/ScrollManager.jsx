import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { initScroll, resetScroll, scrollToEl } from '../lib/scroll.js';
import { ROUTES, NOT_FOUND } from '../content/site.js';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const SITE = 'https://zenstra.ai';

function setHead(path) {
  const r = ROUTES.find((x) => x.path === path) || NOT_FOUND;
  document.title = r.title;
  const set = (sel, attr, val) => { const el = document.head.querySelector(sel); if (el) el.setAttribute(attr, val); };
  set('meta[name="description"]', 'content', r.description);
  set('link[rel="canonical"]', 'href', SITE + (r === NOT_FOUND ? '/' : r.path));
  set('meta[property="og:title"]', 'content', r.title);
  set('meta[property="og:description"]', 'content', r.description);
  set('meta[property="og:url"]', 'content', SITE + r.path);
}

/* An in-page link to a product panel (#workflow, #cloud, #edr) also opens it. */
function landOn(t, immediate) {
  scrollToEl(t, { immediate });
  if (t.matches('.prod')) t.dispatchEvent(new Event('zx:select'));
}

/* Scroll position, document head and focus on navigation; smooth in-page jumps. */
export default function ScrollManager() {
  const loc = useLocation();
  const first = useRef(true);
  const lastPath = useRef(loc.pathname);

  useEffect(() => { initScroll(); }, []);

  useIso(() => {
    const samePage = lastPath.current === loc.pathname;
    lastPath.current = loc.pathname;
    if (first.current) {
      first.current = false;
      if (loc.hash) {
        const t = document.getElementById(decodeURIComponent(loc.hash.slice(1)));
        if (t) requestAnimationFrame(() => landOn(t, true));
      }
      return;
    }
    setHead(loc.pathname);
    if (loc.hash) {
      const t = document.getElementById(decodeURIComponent(loc.hash.slice(1)));
      if (t) {
        if (samePage) landOn(t, false);
        else { resetScroll(); requestAnimationFrame(() => landOn(t, true)); }
        return;
      }
    }
    if (!samePage) {
      resetScroll();
      // Tell assistive technology a new page loaded: focus moves to its content.
      const main = document.getElementById('main');
      if (main) { main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true }); }
    }
  }, [loc.pathname, loc.hash, loc.key]);

  // Plain in-page anchors (href="#id") scroll smoothly instead of jumping.
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href^="#"]'); if (!a) return;
      const id = a.getAttribute('href').slice(1); if (!id) return;
      const t = document.getElementById(decodeURIComponent(id)); if (!t) return;
      e.preventDefault();
      landOn(t, false);
      if (id === 'main') { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
      history.replaceState(history.state, '', '#' + id);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
