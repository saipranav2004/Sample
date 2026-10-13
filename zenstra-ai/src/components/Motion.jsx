/* Rolling and scroll-driven pieces, after zenity.io:
     Marquee      a seamless sideways loop (pauses on hover and focus)
     FactCarousel big-number cards in a Marquee
     WorksWith    the platforms Zenstra works with, rolling
     ScrollPath   a curved line that draws as you scroll and lights each step
     ScrollSteps  a pinned list where scrolling moves from one step to the next
   All of it renders complete on the server and works without JavaScript; with
   reduced motion nothing loops, and the path and steps simply show their end state. */
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { reduced } from '../lib/env.js';
import Two from './Two.jsx';

/* ---------- Marquee ---------- */
export function Marquee({ children, label, seconds = 48, gap = 24, className = '' }) {
  return (
    <div className={'rm ' + className} role="group" aria-label={label} style={{ '--dur': seconds + 's', '--gap': gap + 'px' }} tabIndex={0}>
      <div className="rm-track">
        <div className="rm-set">{children}</div>
        <div className="rm-set" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Big-number cards ---------- */
export const FACTS = [
  { n: '18', u: 'ms', c: 'p95 decision latency, inline', t: 'Runtime' },
  { n: '47', u: '+', c: 'Agents protected', t: 'Coverage' },
  { n: '8.7', u: 'K', c: 'Threats blocked every month', t: 'Detection' },
  { n: '60', u: '+', c: 'Security policies enforced', t: 'Policy' },
  { n: '0', u: '', c: 'Agents to rewrite', t: 'Deployment' },
  { n: '4', u: '', c: 'Certifications, audited every year', t: 'Assurance' },
];

export function FactCard({ n, u, c, t }) {
  return (
    <article className="fact">
      <b className="fact-n">{n}{u ? <small>{u}</small> : null}</b>
      <p>{c}</p>
      <span className="fact-tag">{t}</span>
    </article>
  );
}

export function FactCarousel({ facts = FACTS, label = 'Zenstra in numbers', seconds }) {
  return (
    <Marquee label={label} seconds={seconds || facts.length * 9} gap={28} className="rm-facts">
      {facts.map((f) => <FactCard key={f.c} {...f} />)}
    </Marquee>
  );
}

/* ---------- Works with ---------- */
export const WORKS = ['Microsoft Copilot', 'ChatGPT Enterprise', 'Claude', 'Gemini', 'MCP', 'n8n', 'Zapier', 'LangGraph', 'CrewAI', 'AWS Bedrock', 'Azure OpenAI', 'Vertex AI', 'Fiserv', 'Jack Henry', 'Temenos'];

export function WorksWith({ standalone = false }) {
  return (
    <div className={'works' + (standalone ? ' works-solo' : '')} {...(standalone ? { 'data-reveal': '' } : { 'data-after': '' })}>
      <span className="mono-label">Works with</span>
      <p className="sr-only">Works with {WORKS.join(', ')}.</p>
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {WORKS.concat(WORKS).map((w, i) => <span key={w + i}>{w}</span>)}
        </div>
      </div>
    </div>
  );
}

/* ---------- Scroll progress through an element ---------- */
function useScrollProgress(ref, { start = 0.6, onProgress }) {
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    let raf = 0;
    const run = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = (window.innerHeight * start - r.top) / r.height;
      onProgress(Math.min(1, Math.max(0, p)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(run); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    run();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, start]);
}

/* ---------- ScrollPath: the line that draws as you scroll ----------
   Every step sits on its own half-circle of the line, bulging left, then right,
   and so on; its text is on the bulging side. The glowing head follows the scroll,
   and a step lights once the head has passed it. */
export function ScrollPath({ id = 'path', eyebrow, h, items }) {
  const root = useRef(null), track = useRef(null), fill = useRef(null), head = useRef(null);
  const [lit, setLit] = useState(0);
  const n = items.length;
  // With reduced motion the finished state shows at once (set after hydration, so the
  // server and the first client render agree).
  useEffect(() => { if (reduced()) setLit(n); }, [n]);
  // Geometry in "units" of one row: radius R = D / 2 (see --sp-d in the CSS).
  const D = 190, R = D / 2, W = 2 * R + 8, cx = R + 4, L = n * Math.PI * R;
  let d = 'M ' + cx + ' 0';
  for (let k = 0; k < n; k++) d += ' A ' + R + ' ' + R + ' 0 0 ' + (k % 2 === 0 ? 0 : 1) + ' ' + cx + ' ' + (k + 1) * D;

  useScrollProgress(root, {
    start: 0.58,
    onProgress: (p) => {
      if (reduced()) return;
      const len = p * L;
      if (fill.current) fill.current.style.strokeDasharray = len.toFixed(1) + ' ' + (L + 2).toFixed(1);
      if (head.current && track.current) {
        const pt = track.current.getPointAtLength(Math.min(len, L - 0.01));
        head.current.setAttribute('cx', pt.x.toFixed(1)); head.current.setAttribute('cy', pt.y.toFixed(1));
        head.current.style.opacity = p > 0.002 && p < 0.998 ? 1 : 0;
      }
      let k = 0; while (k < n && len >= (k + 0.5) * Math.PI * R - 1) k++;
      setLit((cur) => (cur === k ? cur : k));
    },
  });

  return (
    <section className="sec sp" id={id} aria-labelledby={id + '-h'}>
      <div className="wrap">
        <div className="sec-head center">
          {eyebrow ? <span className="eyebrow" data-reveal="">{eyebrow}</span> : null}
          <h2 className="h2" id={id + '-h'} data-reveal=""><Two t={h} /></h2>
        </div>
        <ol className="sp-list" ref={root} style={{ '--n': n }}>
          <svg className="sp-svg" viewBox={'0 0 ' + W + ' ' + n * D} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={id + '-g'} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" /><stop offset="45%" stopColor="var(--accent-2)" /><stop offset="100%" stopColor="var(--accent)" />
              </linearGradient>
            </defs>
            <path ref={track} className="sp-track" d={d} fill="none" />
            <path ref={fill} className="sp-fill" d={d} fill="none" stroke={'url(#' + id + '-g)'} strokeLinecap="round" style={{ strokeDasharray: '0 ' + (L + 2) }} />
            <circle ref={head} className="sp-head" r="6" cx={cx} cy="0" />
          </svg>
          {items.map((it, k) => (
            <li key={it.h} className={'sp-row ' + (k % 2 === 0 ? 'l' : 'r') + (k < lit ? ' on' : '') + (k === lit - 1 ? ' now' : '')}>
              <div className="sp-t"><h3>{it.h}</h3><p>{it.p}</p></div>
              <span className="sp-node"><Icon name={it.icon} /></span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- ScrollSteps: pinned steps beside a flowing diagram ---------- */
function Flow({ step }) {
  // Nine lines: many agent actions in from the left, narrowing to one decision
  // point, then out to the record on the right.
  const lines = Array.from({ length: 9 }, (_, i) => {
    const yl = 50 + i * 52, yg = 252 + (i - 4) * 9, yr = 50 + i * 52;
    return { yl, yg, yr, d: 'M0 ' + yl + ' C 150 ' + yl + ' 230 ' + yg + ' 330 ' + yg + ' S 500 ' + yr + ' 640 ' + yr };
  });
  const kind = ['ok', 'ok', 'hold', 'ok', 'block', 'ok', 'ok', 'hold', 'ok'];
  return (
    <svg className="flow" data-step={step} viewBox="0 0 640 504" aria-hidden="true" focusable="false">
      <g className="fl-lines">{lines.map((l, i) => <path key={i} d={l.d} />)}</g>
      <g className="fl-agents">{lines.map((l, i) => <circle key={i} cx="14" cy={l.yl} r="5" style={{ animationDelay: i * 0.25 + 's' }} />)}</g>
      <g className="fl-gate"><line x1="330" y1="150" x2="330" y2="356" /><rect x="320" y="150" width="20" height="206" rx="10" /></g>
      <g className="fl-dots">{lines.map((l, i) => <circle key={i} className={'fd ' + kind[i]} r="4.5" style={{ offsetPath: "path('" + l.d + "')", animationDelay: -i * 0.9 + 's' }} />)}</g>
      <g className="fl-ledger">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i} transform={'translate(520 ' + (96 + i * 56) + ')'}>
            <rect width="104" height="38" rx="8" /><rect className="lb" x="12" y="11" width={[56, 40, 64, 48, 60, 44][i]} height="5" rx="2.5" /><rect className="lb" x="12" y="23" width="30" height="5" rx="2.5" />
            {i < 5 ? <line x1="52" y1="38" x2="52" y2="56" /> : null}
          </g>
        ))}
      </g>
    </svg>
  );
}

export function ScrollSteps({ id = 'steps', eyebrow, h, p, steps, cta }) {
  const root = useRef(null);
  const [i, setI] = useState(0);
  const n = steps.length;
  useEffect(() => { if (reduced()) setI(n - 1); }, [n]);
  useScrollProgress(root, {
    start: 0,
    onProgress: () => {
      const el = root.current; if (!el || reduced()) return;
      const r = el.getBoundingClientRect(), span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(0.999, Math.max(0, -r.top / span)) : 0;
      setI((cur) => { const k = Math.floor(p * n); return cur === k ? cur : k; });
    },
  });
  const go = (k) => {
    const el = root.current; if (!el) return;
    const r = el.getBoundingClientRect(), span = r.height - window.innerHeight;
    if (window.matchMedia('(max-width: 900px)').matches || span <= 0) { setI(k); return; }
    window.scrollTo({ top: window.scrollY + r.top + span * ((k + 0.5) / n), behavior: reduced() ? 'auto' : 'smooth' });
  };
  return (
    <section className="ss" id={id} aria-labelledby={id + '-h'} ref={root} style={{ '--n': n }}>
      <div className="ss-pin">
        <div className="wrap ss-grid">
          <div className="ss-copy">
            <h2 className="h2" id={id + '-h'} data-reveal=""><Two t={h} /></h2>
            <p className="lede" data-reveal="">{p}</p>
            {cta}
            <ol className="ss-list">
              {steps.map((s, k) => (
                <li key={s.h} className={(k === i ? 'on ' : '') + (k < i ? 'past' : '')}>
                  <button type="button" onClick={() => go(k)} aria-current={k === i ? 'step' : undefined}><span className="ss-dot" aria-hidden="true" />{s.h}</button>
                  <p>{s.p}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="ss-viz"><Flow step={i} /></div>
        </div>
      </div>
    </section>
  );
}
