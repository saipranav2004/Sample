import { useEffect, useRef, useState } from 'react';
import A from '../components/A.jsx';
import { usePageFx } from '../lib/usePage.js';
import { anim, reduced, EASE, $, $$ } from '../lib/env.js';
import { getLenis } from '../lib/scroll.js';

/* Requests are delivered by FormSubmit (formsubmit.co): the form's action is the
   plain POST fallback; with JavaScript the same address is called through its
   /ajax/ endpoint. Nothing is stored in the browser. If delivery fails, the visitor
   gets a prefilled email to send instead, so a request is never silently lost. */
const ACTION = 'https://formsubmit.co/info@zenstra.ai';
const TO = 'info@zenstra.ai';
const FREE = /@(gmail|yahoo|hotmail|outlook|icloud|aol|proton|protonmail|gmx|mail)\./i;
const ROLES = ['CISO or security leader', 'Security architect or engineer', 'AI or platform engineering', 'Risk, compliance or audit', 'Other'];
const Arrow = () => (<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>);

function payload(form) {
  const d = {};
  new FormData(form).forEach((v, k) => { v = String(v).trim(); if (!v) return; d[k] = d[k] ? d[k] + ', ' + v : v; });
  return d;
}
function mailto(d) {
  const lines = ['Name: ' + [d.first_name, d.last_name].filter(Boolean).join(' '), 'Work email: ' + (d.email || ''), 'Company: ' + (d.company || ''), 'Role: ' + (d.role || '')];
  return 'mailto:' + TO + '?subject=' + encodeURIComponent('Demo request · ' + (d.company || 'zenstra.ai')) + '&body=' + encodeURIComponent(lines.join('\n'));
}
function validate(form) {
  const errs = {};
  const val = (n) => (form.elements[n] ? String(form.elements[n].value || '').trim() : '');
  ['first_name', 'last_name', 'company', 'role'].forEach((n) => { if (!val(n)) errs[n] = 'Required.'; });
  const email = val('email');
  if (!email) errs.email = 'Required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter an email like name@company.com.';
  else if (FREE.test(email)) errs.email = 'Use your work email so we can prepare for your environment.';
  if (!form.elements.consent.checked) errs.consent = true;
  return errs;
}

function Field({ id, name, label, error, full, children }) {
  return (
    <div className={'field' + (full ? ' full' : '') + (error ? ' invalid' : '')}>
      <label htmlFor={id}>{label}</label>
      {children}
      <span className="err" role="alert">{error || ''}</span>
    </div>
  );
}

export default function Demo() {
  const ref = useRef(null);
  usePageFx(ref);
  const formRef = useRef(null);
  const [errs, setErrs] = useState({});
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(null);
  const [sent, setSent] = useState(null);
  const [when, setWhen] = useState(null);
  const [prep, setPrep] = useState([false, false, false]);
  const statusRef = useRef(null);
  const nextRef = useRef(null);
  const okRef = useRef(null);

  const order = ['first_name', 'last_name', 'email', 'company', 'role', 'consent'];
  const onSubmit = (e) => {
    e.preventDefault();
    if (sending) return;
    const form = formRef.current;
    const v = validate(form);
    setErrs(v);
    const first = order.find((n) => v[n]);
    if (first) { form.elements[first].focus(); return; }
    const d = payload(form);
    if (d._honey) { setSent(d); return; } // a bot filled the hidden field: pretend it worked
    delete d._honey;
    setSending(true); setFailed(null);
    const ctl = 'AbortController' in window ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, 15000);
    fetch(ACTION.replace('formsubmit.co/', 'formsubmit.co/ajax/'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(d), signal: ctl ? ctl.signal : undefined })
      .then((r) => r.json().catch(() => ({})).then((j) => ({ ok: r.ok, j })))
      .then((res) => { if (res.ok && (res.j.success === true || res.j.success === 'true')) setSent(d); else setFailed(d); })
      .catch(() => setFailed(d))
      .then(() => { clearTimeout(timer); setSending(false); });
  };

  // A failed send: move focus to the explanation.
  useEffect(() => { if (failed && statusRef.current) statusRef.current.focus(); }, [failed]);

  // Sent: show what happens next, bring it into view and move focus to it.
  useEffect(() => {
    if (!sent) return;
    const now = new Date(); setWhen(now);
    const next = nextRef.current, ok = okRef.current;
    if (!reduced()) {
      if (next) {
        anim(next, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: EASE });
        $$('.track li, .prep, .wait', next).forEach((el, i) => anim(el, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 180 + i * 110, easing: EASE, fill: 'both' }));
      }
      if (ok) {
        anim(ok, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 700 });
        const path = $('.check path', ok); if (path) { const L = path.getTotalLength(); path.style.strokeDasharray = L; anim(path, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 700, delay: 200 }); }
      }
    }
    const target = next || ok, head = next ? $('.next-h', next) : $('h2', ok);
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(target, { offset: -110 }); else target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    if (head) head.focus({ preventScroll: true });
  }, [sent]);

  const edit = () => {
    setSent(null);
    requestAnimationFrame(() => { const em = formRef.current && formRef.current.elements.email; if (em) { em.focus(); em.select(); } });
  };
  const prepN = prep.filter(Boolean).length;
  const who = sent ? sent.first_name || '' : '';
  const sum = sent ? { name: [sent.first_name, sent.last_name].filter(Boolean).join(' '), email: sent.email || '', company: sent.company || '', role: sent.role || '' } : {};

  return (
    <main id="main" data-page="demo" ref={ref}>
      <section className="demo-hero hero-lite rails" aria-labelledby="hero-h">
        <div className="lens" data-cx="0.5" data-cy="0.3" aria-hidden="true"></div>
        <div className="wrap demo-grid">
          <div data-lens-mask="">
            <div data-before="" hidden={!!sent}>
              <h1 className="display" id="hero-h" data-scan=""><span className="scanline"><span className="in">See Zenstra stop</span><i className="bar"></i></span><span className="scanline"><span className="in grad">a live attack.</span><i className="bar"></i></span></h1>
              <p className="lede" data-after="">A security engineer connects Zenstra to one of your agents, runs a real injection against it, and hands you the decision record. No slides.</p>
              <ol className="agenda" data-agenda="">
                <i className="prog" aria-hidden="true"></i>
                <li data-reveal=""><span className="n">01</span><div><time>00 – 05 MIN</time><b>Your agent, your concerns</b><p>Which agent you are being asked to approve, and what worries you about it.</p></div></li>
                <li data-reveal=""><span className="n">02</span><div><time>05 – 12 MIN</time><b>Connect it</b><p>SDK, gateway or EDR app in front of a test copy. Any framework, any model.</p></div></li>
                <li data-reveal=""><span className="n">03</span><div><time>12 – 22 MIN</time><b>Watch a policy stop it</b><p>A live prompt injection and an exfiltration attempt, decided before the tool runs.</p></div></li>
                <li data-reveal=""><span className="n">04</span><div><time>22 – 30 MIN</time><b>Keep the record</b><p>The decision ledger from the session and a security review pack.</p></div></li>
              </ol>
              <div className="assure" data-reveal="">
                <div><b>No agent rewrite</b>Works with the code you have.</div>
                <div><b>Runs in your cloud</b>Nothing leaves your environment.</div>
                <div><b>Review pack included</b>For your security team.</div>
              </div>
            </div>
            <div className="next" data-next="" hidden={!sent} ref={nextRef}>
              <span className="eyebrow">Request received · <time dateTime={when ? when.toISOString() : undefined}>{when ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time></span>
              <h2 className="display next-h" id="next-h" tabIndex={-1}>Thanks, <span>{who}</span>.<br /><span className="grad">Here is what happens next.</span></h2>
              <ol className="track">
                <li className="done"><span className="dot" aria-hidden="true"></span><div><time>Just now</time><b>Request received</b><p>Your details reached the Zenstra team. There is nothing else to do on this page.</p></div></li>
                <li className="now"><span className="dot" aria-hidden="true"></span><div><time>Within one business day</time><b>A security engineer emails you</b><p>From a zenstra.ai address, with three times for a 30-minute session. If it has not arrived, check your spam folder.</p></div></li>
                <li><span className="dot" aria-hidden="true"></span><div><time>You choose</time><b>Pick a time</b><p>Reply with the slot that suits you, and bring whoever signs off on AI risk.</p></div></li>
                <li><span className="dot" aria-hidden="true"></span><div><time>30 minutes</time><b>The live session</b><p>Your agent, a real injection stopped before the tool runs, and the decision record to keep.</p></div></li>
              </ol>
              <div className="prep">
                <div className="prep-h"><b>Get the most from the session</b><span className={prepN === 3 ? 'all' : undefined} aria-live="polite">{prepN === 3 ? 'Ready for your session' : prepN + ' of 3 ready'}</span></div>
                {['Pick one agent you are being asked to approve', 'Note the tools and data it can reach', 'Ask whoever signs off on AI risk to join'].map((t, i) => (
                  <label key={t}><input type="checkbox" checked={prep[i]} onChange={(e) => setPrep((p) => p.map((x, k) => (k === i ? e.target.checked : x)))} /><span>{t}</span></label>
                ))}
              </div>
              <div className="wait"><span className="mono-label">While you wait</span>
                <A to="/#core">Inside the Zenstra core <Arrow /></A>
                <A to="/company#compliance">Security and compliance <Arrow /></A>
                <A to="/credit-unions">Zenstra for credit unions <Arrow /></A>
              </div>
            </div>
          </div>
          <div className="form-card" data-after="">
            <form ref={formRef} action={ACTION} method="POST" noValidate onSubmit={onSubmit} hidden={!!sent} aria-busy={sending || undefined}>
              <input type="hidden" name="_subject" defaultValue="Demo request · zenstra.ai" />
              <input type="hidden" name="_template" defaultValue="table" />
              <div className="hp" aria-hidden="true"><label htmlFor="f-hp">Leave this empty</label><input id="f-hp" type="text" name="_honey" tabIndex={-1} autoComplete="off" /></div>
              <h2>Request a technical session</h2>
              <p className="note">A security engineer replies within one business day.</p>
              <div className="form-grid">
                <Field id="f-first" label="First name" error={errs.first_name}><input id="f-first" name="first_name" required autoComplete="given-name" aria-invalid={!!errs.first_name} /></Field>
                <Field id="f-last" label="Last name" error={errs.last_name}><input id="f-last" name="last_name" required autoComplete="family-name" aria-invalid={!!errs.last_name} /></Field>
                <Field id="f-email" label="Work email" error={errs.email} full><input id="f-email" name="email" type="email" required autoComplete="email" placeholder="name@company.com" aria-invalid={!!errs.email} /></Field>
                <Field id="f-co" label="Company" error={errs.company}><input id="f-co" name="company" required autoComplete="organization" aria-invalid={!!errs.company} /></Field>
                <Field id="f-role" label="Role" error={errs.role}>
                  <select id="f-role" name="role" required defaultValue="" aria-invalid={!!errs.role}><option value="">Choose one</option>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                </Field>
                <label className={'consent full' + (errs.consent ? ' invalid' : '')}><input type="checkbox" name="consent" value="yes" required /><span>I agree that Zenstra may contact me about this request, as described in the <A to="/privacy">privacy notice</A>.</span></label>
                <button className="btn primary lg full" type="submit" disabled={sending}>{sending ? 'Sending…' : <>Request the session <Arrow /></>}</button>
              </div>
              <div className={'form-status' + (failed ? ' err' : '')} data-status="" role="status" aria-live="polite" hidden={!failed} tabIndex={-1} ref={statusRef}>
                {failed ? (<><b>Your request did not go through.</b>Nothing was lost: send it as an email instead, already filled in for you, or write to <a href={'mailto:' + TO}>{TO}</a>.<br /><a className="btn secondary" href={mailto(failed)}>Email the request</a></>) : null}
              </div>
              <p className="fine">No phone number needed · Reply within one business day</p>
            </form>
            <div className="success" data-success="" hidden={!sent} ref={okRef}>
              <svg className="check" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="28"></circle><path d="m18 29 7 7 14-15"></path></svg>
              <h2 tabIndex={-1}>Request received</h2>
              <dl className="sum">
                <div><dt>Name</dt><dd>{sum.name}</dd></div>
                <div><dt>Work email</dt><dd>{sum.email}</dd></div>
                <div><dt>Company</dt><dd>{sum.company}</dd></div>
                <div><dt>Role</dt><dd>{sum.role}</dd></div>
              </dl>
              <button className="btn secondary" type="button" onClick={edit}>Something wrong? Edit and send again</button>
              <p className="fine">We use these details only to arrange your session.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="sec alt" aria-labelledby="faq-h">
        <div className="wrap faq">
          <div style={{ display: 'grid', gap: '18px', alignContent: 'start' }}><span className="eyebrow" data-reveal="">Before you book</span><h2 className="h2" id="faq-h" style={{ fontSize: 'clamp(28px,3vw,42px)' }} data-reveal="">Common questions.</h2></div>
          <div data-reveal="">
            <details><summary>Do we need to prepare an agent?</summary><div className="a"><p>It helps, but it is not required. If you cannot run one in a test environment yet, we bring a sample agent that matches yours: a member-service assistant, a coding agent or a copilot.</p></div></details>
            <details><summary>Does any of our data leave our environment?</summary><div className="a"><p>No. The decision point runs in your environment, and the session uses the same deployment, so prompts and payloads stay with you.</p></div></details>
            <details><summary>Which product will you show?</summary><div className="a"><p>The one that matches your first risk. Workflow Security for automations, Cloud Security for agents calling your systems, or Zenstra EDR for AI on staff devices. All three share one console.</p></div></details>
            <details><summary>What happens after the session?</summary><div className="a"><p>You keep the decision record and a security review pack. If it fits, we plan a pilot with one platform and a small group of users.</p></div></details>
          </div>
        </div>
      </section>
    </main>
  );
}
