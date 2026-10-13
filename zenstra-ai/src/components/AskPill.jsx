import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import A from './A.jsx';
import { Mark } from './Logo.jsx';
import { introDone, reduced } from '../lib/env.js';

/* The floating call-out in the bottom-right corner of every page (after zenity.io's
   "AI Product Expert" pill): a light runs around its border and its line rolls
   through what a visitor can ask for. It leads to the demo request, hides on the
   demo page and can be dismissed for the rest of the visit. */
const LINES = [
  'Talk to a Zenstra engineer',
  'See a live block in 30 minutes',
  'Ask how it runs in your VPC',
  'Get the security review pack',
];

export default function AskPill() {
  const { pathname } = useLocation();
  const [shown, setShown] = useState(false);
  const [off, setOff] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try { if (sessionStorage.getItem('zx-pill-off') === '1') { setOff(true); return undefined; } } catch (e) { /* private mode */ }
    let t = 0, ready = false;
    // On phones it waits until the visitor scrolls past the first screen, so it never
    // sits on top of the hero; on larger screens it arrives shortly after the page.
    const narrow = () => matchMedia('(max-width: 640px)').matches;
    const check = () => { if (ready && (!narrow() || window.scrollY > window.innerHeight * 0.6)) { setShown(true); window.removeEventListener('scroll', check); } };
    introDone.then(() => { t = setTimeout(() => { ready = true; check(); }, reduced() ? 0 : 1600); });
    window.addEventListener('scroll', check, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener('scroll', check); };
  }, []);

  useEffect(() => {
    if (!shown || reduced()) return undefined;
    const id = setInterval(() => { if (!document.hidden) setI((n) => (n + 1) % LINES.length); }, 3200);
    return () => clearInterval(id);
  }, [shown]);

  if (off || pathname === '/demo') return null;
  const dismiss = () => {
    setOff(true);
    try { sessionStorage.setItem('zx-pill-off', '1'); } catch (e) { /* private mode */ }
  };
  return (
    <aside className={'askpill' + (shown ? ' on' : '')} hidden={!shown} aria-label="Talk to Zenstra">
      <A to="/demo" className="askpill-link">
        <span className="askpill-av" aria-hidden="true"><Mark className="logo-mark" /></span>
        <span className="sr-only">Talk to a Zenstra engineer: request a demo</span>
        <span className="askpill-roll" aria-hidden="true">
          {LINES.map((l, k) => (
            <span key={l} className={'askpill-line' + (k === i ? ' cur' : k === (i + LINES.length - 1) % LINES.length ? ' prev' : '')}>{l}</span>
          ))}
        </span>
      </A>
      <button type="button" className="askpill-x" aria-label="Hide this message" onClick={dismiss}>
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m3 3 6 6M9 3 3 9" /></svg>
      </button>
    </aside>
  );
}
