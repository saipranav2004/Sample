import { useEffect } from 'react';
import { mountPageFx } from './pagefx.js';

/* Wire a page's motion and interactions once it is on screen; undo on unmount. */
export function usePageFx(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    return mountPageFx(el);
  }, [ref]);
}

/* The pinned "Inside the Zenstra core" scene (home). */
export function useCore(ref) {
  useEffect(() => {
    const sec = ref.current && ref.current.querySelector('[data-core]');
    if (!sec) return undefined;
    let off = null, alive = true;
    import('./core5.js').then((m) => { if (alive) off = m.mountCore(sec); });
    return () => { alive = false; if (off) off(); };
  }, [ref]);
}
