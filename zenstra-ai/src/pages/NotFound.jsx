import { useRef } from 'react';
import A from '../components/A.jsx';
import { usePageFx } from '../lib/usePage.js';

export default function NotFound() {
  const ref = useRef(null);
  usePageFx(ref);
  return (
      <main id="main" data-page="404" ref={ref}>
      <section className="nf" aria-labelledby="nf-h">
      <div className="wrap nf-in">
      <span className="eyebrow">Error 404</span>
      <h1 className="h2" id="nf-h">This page isn’t here.</h1>
      <p className="lede">The link may be old, or the page may have moved. These will get you back on track.</p>
      <div className="nf-links">
      <A to="/" className="btn primary">Go to the home page{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></A>
      <A to="/credit-unions" className="btn secondary">Credit unions</A>
      <A to="/company" className="btn secondary">Company</A>
      </div>
      </div>
      </section>
      </main>
  );
}
