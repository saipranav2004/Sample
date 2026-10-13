import { isDark, notifyTheme, reduced } from '../lib/env.js';

/* Light/dark switch with a circular reveal from the button (View Transitions). */
export default function ThemeToggle() {
  const onClick = (e) => {
    const root = document.documentElement;
    const next = isDark() ? 'light' : 'dark';
    const apply = () => {
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('zx-theme', next); } catch (err) { /* private mode */ }
      notifyTheme();
    };
    if (!document.startViewTransition || reduced()) { apply(); return; }
    const b = e.currentTarget.getBoundingClientRect();
    const x = e.clientX || b.left + b.width / 2, y = e.clientY || b.top + b.height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('vt');
    const vt = document.startViewTransition(apply);
    vt.finished.finally(() => root.classList.remove('vt'));
    vt.ready.then(() => {
      root.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  };
  return (
    <button className="icon-btn theme" type="button" aria-label="Switch between light and dark theme" onClick={onClick}>
      <svg className="moon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z" /></svg>
      <svg className="sun" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="8" r="3" /><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" /></svg>
    </button>
  );
}
