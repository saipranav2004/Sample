import A from './A.jsx';
import Logo from './Logo.jsx';
import { CAPABILITIES, USE_CASE_GROUPS, INDUSTRIES, COMPANY, capabilityPath, useCasePath } from '../content/site.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* Enterprise footer: brand block plus every page on the site, grouped the same
   way as the header menus. */
export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <A to="/" className="logo" aria-label="Zenstra AI home"><Logo /></A>
            <p>Runtime security for agentic AI. Every agent identified, every action checked against its task, every decision on record.</p>
            <a className="foot-mail" href="mailto:info@zenstra.ai">info@zenstra.ai</a>
            <ul className="foot-certs" aria-label="Certifications"><li>SOC 2 Type II</li><li>ISO 27001</li><li>ISO 42001</li><li>ISO 27701</li></ul>
          </div>
          <nav className="foot-nav" aria-label="Footer">
            <div>
              <h2 className="mono-label">Platform</h2>
              <A to="/platform">Platform overview</A>
              {CAPABILITIES.map((c) => <A key={c.slug} to={capabilityPath(c.slug)}>{cap(c.name)}</A>)}
            </div>
            <div>
              <h2 className="mono-label">Use cases</h2>
              {USE_CASE_GROUPS.flatMap((g) => g.items).map((u) => <A key={u.slug} to={useCasePath(u.slug)}>{u.name}</A>)}
            </div>
            <div>
              <h2 className="mono-label">Industries</h2>
              {INDUSTRIES.map((i) => <A key={i.to} to={i.to}>{i.name}</A>)}
              <h2 className="mono-label foot-sub">Company</h2>
              {COMPANY.map((c) => <A key={c.to} to={c.to}>{c.name}</A>)}
              <A to="/demo">Request a demo</A>
            </div>
            <div>
              <h2 className="mono-label">Offices</h2>
              <A to="/company#contact">Hyderabad <small>HQ</small></A>
              <A to="/company#contact">Bangalore</A>
              <A to="/company#contact">Maryland, USA</A>
            </div>
          </nav>
        </div>
        <div className="foot-bar">
          <span>&copy; 2026 Zenstra AI · A Deep Algorithms company</span>
          <nav className="foot-legal-links" aria-label="Legal"><A to="/privacy">Privacy Policy</A><A to="/terms">Terms of Service</A></nav>
          <a className="foot-social" href="https://www.linkedin.com/company/deepalgorithms.in" target="_blank" rel="noopener" aria-label="Deep Algorithms on LinkedIn"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.6 5.6H1.2V15h2.4zM2.4 1a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM15 9.6c0-2.6-1.4-4.2-3.6-4.2-1.2 0-2 .6-2.4 1.2V5.6H6.6V15H9v-5c0-1.2.6-2 1.6-2s1.4.8 1.4 2v5H15z" /></svg></a>
        </div>
      </div>
    </footer>
  );
}
