/* Building blocks shared by the platform, capability and use-case pages, so every
   page has the same rhythm, type scale and card language. */
import { useEffect, useRef, useState } from 'react';
import A from './A.jsx';
import Icon from './Icon.jsx';
import Two from './Two.jsx';
import { reduced } from '../lib/env.js';
import { Marquee, FactCarousel, WorksWith } from './Motion.jsx';
import { CAPABILITIES, USE_CASES, INDUSTRIES, capabilityPath, useCasePath } from '../content/site.js';

export const Arrow = () => (<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>);

export { Two };

const SHOTS = {
  overview: ['screen-overview', 1600, 1000], detections: ['screen-detections', 1600, 1000], investigation: ['screen-investigation', 1600, 1000], agent: ['screen-agent', 1600, 1000],
  coverage: ['crop-coverage', 687, 404], grants: ['crop-grants', 1206, 411], kpis: ['crop-kpis', 1740, 186], riskiest: ['crop-riskiest', 1031, 546], run: ['crop-run', 1206, 1025],
};
const SHOT_ALT = {
  overview: 'Zenstra console overview', detections: 'Detections ranked by severity', investigation: 'An investigation in the Zenstra console', agent: 'An agent profile in the Zenstra console',
  coverage: 'Coverage by platform: governed versus discovered agents', grants: 'Tool grants with scope, expiry and last use', kpis: 'Agents governed, open detections, actions blocked and approvals waiting', riskiest: 'Highest-risk agents with risk score, main factor and owner', run: 'An agent run blocked by policy after a failed intent check',
};

/* A real console screen in a framed card, light and dark versions. */
export function Shot({ name, eager, className = '' }) {
  const [file, w, h] = SHOTS[name] || SHOTS.overview;
  const load = eager ? 'eager' : 'lazy';
  return (
    <figure className={'shot ' + className + (h / w < 0.3 ? ' strip' : '')}>
      <div className="shot-chrome" aria-hidden="true"><i /><i /><i /><span>console.zenstra.ai</span></div>
      <img className="th-light" src={'/img/' + file + '-light.webp'} alt={SHOT_ALT[name]} width={w} height={h} loading={load} />
      <img className="th-dark" src={'/img/' + file + '-dark.webp'} alt={SHOT_ALT[name]} width={w} height={h} loading={load} />
    </figure>
  );
}

const CHIP_IC = {
  block: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="8" cy="8" r="6" /><path d="M4 12 12 4" /></svg>,
  hold: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="8" cy="8" r="6" /><path d="M8 5v3.5l2 1.5" /></svg>,
  allow: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>,
};

/* Hero visual: a console screen with live decision chips floating over it. */
export function HeroVisual({ shot, chips }) {
  return (
    <div className="pv" aria-hidden="true">
      <Shot name={shot} eager className="pv-shot" />
      <div className="pv-chips">
        {chips.map((c, i) => (
          <div key={i} className={'dchip ' + c[0]} data-fixed="">
            <span className="ic">{CHIP_IC[c[0]]}</span><span><b>{c[1]}</b><small>{c[2]}</small></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Page hero shared by the platform, capability and use-case pages. */
export function PageHero({ eyebrow, icon, title, lede, roll, visual, secondary }) {
  return (
    <section className="phero rails" aria-labelledby="hero-h">
      <div className="lens" data-cx="0.74" data-cy="0.46" aria-hidden="true"></div>
      <div className="wrap phero-grid">
        <div className="phero-copy" data-lens-mask="">
          <span className="eyebrow" data-after="">{icon ? <Icon name={icon} className="eb-ic" /> : null}{eyebrow}</span>
          <h1 className="display" id="hero-h" data-scan="">
            <span className="scanline"><span className="in">{title[0]}</span><i className="bar"></i></span>
            <span className="scanline"><span className="in grad">{title[1]}</span><i className="bar"></i></span>
          </h1>
          <p className="lede" data-after="">{lede}</p>
          {roll ? (
            <p className="switch" data-after="">
              <span className="muted" aria-hidden="true">{roll.lead}</span>{' '}
              <span className="slot" data-switch={roll.words.join('|')} aria-hidden="true">{roll.words[0]}</span>
              <span className="sr-only">{roll.lead} {roll.words.join(', ')}</span>
            </p>
          ) : null}
          <div className="ctas" data-after="">
            <A to="/demo" className="btn primary lg">Request a demo <Arrow /></A>
            {secondary || <a href="#how" className="btn secondary lg">See how it works</a>}
          </div>
        </div>
        <div className="phero-side" data-after="">{visual}</div>
      </div>
    </section>
  );
}

/* Centred problem statement with three icon cards. */
export function Problem({ eyebrow = 'The problem', h, p, cards }) {
  return (
    <section className="sec" aria-labelledby="problem-h">
      <div className="wrap">
        <div className="sec-head center">
          <span className="eyebrow" data-reveal="">{eyebrow}</span>
          <h2 className="h2" id="problem-h" data-reveal=""><Two t={h} /></h2>
          <p className="lede" data-words="">{p}</p>
        </div>
        <div className="icards">
          {cards.map((c, i) => (
            <div className="icard" key={c.h} data-reveal="" data-delay={i * 90}>
              <span className="icard-ic"><Icon name={c.icon} /></span>
              <h3>{c.h}</h3>
              <p>{c.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Tabbed "how it works": copy and key features beside a framed console screen.
   Advances on its own while on screen until the visitor picks a tab. */
export function HowTabs({ id = 'how', eyebrow = 'How Zenstra handles it', h, p, tabs }) {
  const [i, setI] = useState(0);
  const [user, setUser] = useState(false);
  const [vis, setVis] = useState(false);
  const sec = useRef(null);
  const btns = useRef([]);
  useEffect(() => {
    const el = sec.current; if (!el || !('IntersectionObserver' in window)) return undefined;
    const o = new IntersectionObserver((es) => setVis(es[0].isIntersecting), { threshold: 0.35 });
    o.observe(el); return () => o.disconnect();
  }, []);
  useEffect(() => {
    if (user || !vis || reduced()) return undefined;
    const t = setTimeout(() => setI((n) => (n + 1) % tabs.length), 7000);
    return () => clearTimeout(t);
  }, [i, user, vis, tabs.length]);
  const pick = (k, focus) => { setUser(true); setI(k); if (focus && btns.current[k]) btns.current[k].focus(); };
  const onKey = (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return; e.preventDefault(); pick((i + d + tabs.length) % tabs.length, true);
  };
  const t = tabs[i];
  return (
    <section className="sec alt how" id={id} aria-labelledby={id + '-h'} ref={sec}>
      <div className="wrap">
        <div className="sec-head split">
          <div style={{ display: 'grid', gap: 20 }}>
            <span className="eyebrow" data-reveal="">{eyebrow}</span>
            <h2 className="h2" id={id + '-h'} data-reveal=""><Two t={h} /></h2>
          </div>
          <p className="lede" data-words="">{p}</p>
        </div>
        <div className="how-tabs" role="tablist" aria-label={eyebrow} data-reveal="">
          {tabs.map((x, k) => (
            <button key={x.label} ref={(el) => { btns.current[k] = el; }} role="tab" type="button" id={id + '-t' + k} aria-selected={k === i} aria-controls={id + '-p'} tabIndex={k === i ? 0 : -1} className={'how-tab' + (k === i ? ' on' : '')} onClick={() => pick(k)} onKeyDown={onKey}>
              <span className="how-n">{'0' + (k + 1)}</span>{x.label}
              <i className={'how-bar' + (k === i && !user && vis && !reduced() ? ' run' : '')} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="how-panel" role="tabpanel" id={id + '-p'} aria-labelledby={id + '-t' + i} key={i}>
          <div className="how-copy">
            <h3 className="h3">{t.h}</h3>
            <p>{t.p}</p>
            <span className="mono-label">Key capabilities</span>
            <ul className="how-feats">{t.feats.map((f) => <li key={f}><Icon name="check" />{f}</li>)}</ul>
          </div>
          <Shot name={t.shot} />
        </div>
      </div>
    </section>
  );
}

/* Scenario cards that roll sideways (the loop pauses on hover). */
export function Grid({ eyebrow, h, items }) {
  return (
    <section className="sec scen" aria-labelledby="grid-h">
      <div className="wrap">
        <div className="sec-head center">
          <span className="eyebrow" data-reveal="">{eyebrow}</span>
          <h2 className="h2" id="grid-h" data-reveal=""><Two t={h} /></h2>
        </div>
      </div>
      <Marquee label={eyebrow} seconds={items.length * 8} gap={24} className="rm-scen">
        {items.map((x, i) => (
          <article className="scard" key={x.h}>
            <span className="scard-n">{String(i + 1).padStart(2, '0')}</span>
            <h3>{x.h}</h3>
            <p>{x.p}</p>
          </article>
        ))}
      </Marquee>
    </section>
  );
}

/* Proof: big-number cards that roll sideways, then the certifications. */
export function Proof({ h = ['Built for regulated', 'environments.'], p = 'Every control runs inline, before a tool call executes, and leaves evidence your auditors can read.' }) {
  return (
    <section className="sec proof" aria-labelledby="proof-h">
      <div className="wrap">
        <div className="sec-head center">
          <span className="eyebrow" data-reveal="">Why teams choose Zenstra</span>
          <h2 className="h2" id="proof-h" data-reveal=""><Two t={h} /></h2>
          <p className="lede" data-reveal="">{p}</p>
        </div>
      </div>
      <FactCarousel />
      <div className="wrap">
        <ul className="certs-line" data-reveal="" aria-label="Certifications">
          <li>SOC 2 Type II</li><li>ISO/IEC 27001</li><li>ISO/IEC 42001</li><li>ISO/IEC 27701</li><li>HIPAA and GDPR programmes</li>
        </ul>
      </div>
    </section>
  );
}

function linkFor(kind, slug) {
  if (kind === 'cap') { const c = CAPABILITIES.find((x) => x.slug === slug); return c && { to: capabilityPath(slug), tag: 'Capability', name: c.name.charAt(0).toUpperCase() + c.name.slice(1), short: c.short, icon: c.icon }; }
  if (kind === 'use') { const u = USE_CASES.find((x) => x.slug === slug); return u && { to: useCasePath(slug), tag: 'Use case', name: u.name, short: u.short, icon: u.icon }; }
  const n = INDUSTRIES.find((x) => x.to === '/' + slug); return n && { to: n.to, tag: 'Industry', name: n.name, short: n.short, icon: n.icon };
}

/* "Explore more": cross-links that make the site feel like one system. */
export function Related({ items, h = ['Keep', 'exploring.'] }) {
  const links = items.map(([k, s]) => linkFor(k, s)).filter(Boolean);
  return (
    <section className="sec" aria-labelledby="rel-h">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow" data-reveal="">Related</span>
          <h2 className="h2" id="rel-h" data-reveal=""><Two t={h} /></h2>
        </div>
        <div className="rel">
          {links.map((l, i) => (
            <A key={l.to} to={l.to} className="rel-card" data-reveal="" data-delay={i * 90}>
              <span className="rel-top"><span className="mm-ic"><Icon name={l.icon} /></span><span className="mono-label">{l.tag}</span></span>
              <b>{l.name}</b>
              <small>{l.short}</small>
              <span className="link">Learn more <Arrow /></span>
            </A>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Faq({ items, h = 'Common questions.' }) {
  return (
    <section className="sec alt" aria-labelledby="faq-h">
      <div className="wrap faq">
        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}><span className="eyebrow" data-reveal="">FAQ</span><h2 className="h2" id="faq-h" style={{ fontSize: 'clamp(28px,3vw,42px)' }} data-reveal="">{h}</h2></div>
        <div data-reveal="">
          {items.map((f) => (<details key={f.q}><summary>{f.q}</summary><div className="a"><p>{f.a}</p></div></details>))}
        </div>
      </div>
    </section>
  );
}

/* Closing call to action (same as the home page). */
export function Cta({ eyebrow = '30-minute technical session', h = 'See it stop a live attack on your own agent.', p = 'A security engineer connects Zenstra to one of your agents, runs a real injection against it, and hands you the decision record.' }) {
  return (
    <section aria-labelledby="cta-h" style={{ padding: 'clamp(64px,7vw,104px) 0' }}>
      <div className="wrap">
        <div className="cta">
          <div className="stream" aria-hidden="true"></div>
          <div className="cta-inner">
            <span className="eyebrow" style={{ color: '#5cd2ff' }} data-reveal="">{eyebrow}</span>
            <h2 className="h2" id="cta-h" data-reveal="">{h}</h2>
            <p data-reveal="">{p}</p>
            <div className="ctas" data-reveal=""><A to="/demo" className="btn white lg">Request a demo <Arrow /></A></div>
            <p className="fine" data-reveal="">No agent rewrite · Runs in your cloud · Security review pack included</p>
          </div>
        </div>
      </div>
    </section>
  );
}
