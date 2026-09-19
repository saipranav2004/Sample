import { useEffect, useRef, useState } from 'react';

export { useQuery, useMutation } from './useQuery';

export function useDebouncedValue(value, delay = 320) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Locks scroll while a modal/drawer owns the viewport. */
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

export function useEventListener(target, type, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const node = typeof target === 'function' ? target() : target;
    if (!node) return undefined;
    const listener = (event) => handlerRef.current(event);
    node.addEventListener(type, listener);
    return () => node.removeEventListener(type, listener);
  }, [target, type]);
}

/** Traps Tab inside a container and restores focus on unmount. */
export function useFocusTrap(containerRef, active) {
  useEffect(() => {
    if (!active) return undefined;
    const previouslyFocused = document.activeElement;
    const container = containerRef.current;
    if (!container) return undefined;

    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusables = () => Array.from(container.querySelectorAll(selector)).filter((el) => el.offsetParent !== null);
    const first = focusables()[0];
    (first || container).focus?.();

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [containerRef, active]);
}

/**
 * Counts a metric up to its value once, on mount/value change. Respects
 * reduced-motion by jumping straight to the final number.
 */
export function useCountUp(value, duration = 620) {
  const target = Number.isFinite(Number(value)) ? Number(value) : 0;
  const [display, setDisplay] = useState(target);
  const previousRef = useRef(target);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = previousRef.current;
    previousRef.current = target;

    if (reduced || from === target || duration <= 0) {
      setDisplay(target);
      return undefined;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 4;
      setDisplay(Math.round(from + (target - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
