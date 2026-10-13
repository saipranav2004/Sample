import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router';
import A from './A.jsx';
import Logo from './Logo.jsx';
import Icon from './Icon.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { CAPABILITIES, USE_CASE_GROUPS, INDUSTRIES, COMPANY, capabilityPath, useCasePath } from '../content/site.js';
import { stopScroll, startScroll } from '../lib/scroll.js';

const Chevron = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
);

/* One dropdown: opens on hover (desktop pointer) or click/keyboard. A click on a
   menu the pointer already opened keeps it open: the user is reaching for it. */
function Dropdown({ id, label, open, setOpen, active, children, wide }) {
  const tm = useRef(0);
  const enter = useRef(0);
  const byHover = useRef(false);
  const isOpen = open === id;
  // Hover intent: while another menu is open, this one only takes over if the pointer
  // rests on it, so crossing it on the way into the open panel does not switch menus.
  const onEnter = () => {
    clearTimeout(tm.current);
    if (isOpen) return;
    const show = () => { setOpen(id); byHover.current = true; };
    if (open && open !== id) enter.current = setTimeout(show, 200); else show();
  };
  return (
    <div
      className={'dd' + (wide ? ' mega' : '') + (isOpen ? ' open' : '')}
      onMouseEnter={onEnter}
      onMouseLeave={() => { clearTimeout(enter.current); tm.current = setTimeout(() => { setOpen((o) => (o === id ? null : o)); byHover.current = false; }, 180); }}
    >
      <button
        className={'nav-link dd-btn' + (active ? ' is-active' : '')}
        type="button"
        aria-expanded={isOpen}
        aria-controls={'dd-' + id}
        onClick={() => { if (isOpen && byHover.current) { byHover.current = false; return; } byHover.current = false; setOpen(isOpen ? null : id); }}
      >
        {label} <Chevron />
      </button>
      <div className="dd-panel" id={'dd-' + id}>{children}</div>
    </div>
  );
}

function PlatformPanel() {
  return (
    <div className="mega-grid mega-platform">
      <A to="/platform" className="mega-feature">
        <span className="mono-label">The platform</span>
        <b>One policy engine for every agent, everywhere it runs.</b>
        <small>One inventory, one policy and one decision record across workflows, your cloud and every device.</small>
        <span className="link">Explore the platform <Icon name="arrow" /></span>
      </A>
      <div className="mega-col">
        <span className="mono-label">Capabilities</span>
        <div className="mega-items two">
          {CAPABILITIES.map((c) => (
            <A key={c.slug} to={capabilityPath(c.slug)} className="mm-item">
              <span className="mm-ic"><Icon name={c.icon} /></span>
              <span><b>{c.name.charAt(0).toUpperCase() + c.name.slice(1)}</b><small>{c.short}</small></span>
            </A>
          ))}
        </div>
      </div>
    </div>
  );
}

function UseCasePanel() {
  return (
    <div className="mega-grid mega-uses">
      {USE_CASE_GROUPS.map((g) => (
        <div className="mega-col" key={g.label}>
          <span className="mono-label">{g.label}</span>
          <div className="mega-items">
            {g.items.map((u) => (
              <A key={u.slug} to={useCasePath(u.slug)} className="mm-item compact">
                <span className="mm-ic"><Icon name={u.icon} /></span>
                <span><b>{u.name}</b><small>{u.short}</small></span>
              </A>
            ))}
          </div>
          {g.label === 'By need' ? (
            <>
              <span className="mono-label mega-sub">By industry</span>
              <div className="mega-items">
                {INDUSTRIES.map((i) => (
                  <A key={i.to} to={i.to} className="mm-item compact">
                    <span className="mm-ic"><Icon name={i.icon} /></span>
                    <span><b>{i.name}</b><small>{i.short}</small></span>
                  </A>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CompanyPanel() {
  return (
    <div className="mega-list">
      {COMPANY.map((c) => <A key={c.to} to={c.to}>{c.name}</A>)}
    </div>
  );
}

function Group({ id, label, sec, setSec, children }) {
  const on = sec === id;
  return (
    <div className={'mgroup' + (on ? ' open' : '')}>
      <button type="button" className="mgroup-btn" aria-expanded={on} aria-controls={'mg-' + id} onClick={() => setSec(on ? null : id)}>
        {label} <Chevron />
      </button>
      <div className="mgroup-panel" id={'mg-' + id} hidden={!on}>{children}</div>
    </div>
  );
}

function MobileMenu({ close }) {
  const [sec, setSec] = useState(null);
  const g = { sec, setSec };
  return (
    <nav className="menu" id="menu" aria-label="Mobile" onClick={(e) => { if (e.target.closest('a')) close(); }}>
      <Group id="platform" label="Platform" {...g}>
        <A to="/platform">Platform overview</A>
        {CAPABILITIES.map((c) => <A key={c.slug} to={capabilityPath(c.slug)}>{c.name.charAt(0).toUpperCase() + c.name.slice(1)}</A>)}
      </Group>
      <Group id="uses" label="Use cases" {...g}>
        {USE_CASE_GROUPS.map((gr) => (
          <div key={gr.label}>
            <span className="mono-label">{gr.label}</span>
            {gr.items.map((u) => <A key={u.slug} to={useCasePath(u.slug)}>{u.name}</A>)}
          </div>
        ))}
      </Group>
      <A to="/credit-unions" className="mtop">Credit unions</A>
      <Group id="company" label="Company" {...g}>
        {COMPANY.map((c) => <A key={c.to} to={c.to}>{c.name}</A>)}
      </Group>
      <A className="btn primary" to="/demo">Request a demo</A>
    </nav>
  );
}

export default function Header() {
  const head = useRef(null);
  const [open, setOpen] = useState(null);
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const path = loc.pathname;

  const toggleMenu = useCallback((on) => {
    setMenu(on);
    document.body.classList.toggle('menu-open', on);
    if (on) stopScroll(); else startScroll();
  }, []);

  // Close everything when the route changes.
  useEffect(() => { setOpen(null); if (document.body.classList.contains('menu-open')) toggleMenu(false); }, [path, loc.hash, toggleMenu]);

  // Header state on scroll: a border once scrolled, hidden while reading down the page.
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const el = head.current; if (!el) return;
      const y = window.scrollY;
      el.classList.toggle('scrolled', y > 8);
      if (!document.body.classList.contains('menu-open') && !el.querySelector('.dd.open')) el.classList.toggle('hide', y > lastY && y > 480);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Outside click and Escape close the menus.
  useEffect(() => {
    const onDoc = (e) => { if (!e.target.closest('.dd')) setOpen(null); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(null); if (document.body.classList.contains('menu-open')) toggleMenu(false); } };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  }, [toggleMenu]);

  const inPlatform = path === '/platform' || path.startsWith('/platform/');
  const inUses = path.startsWith('/use-cases/');
  return (
    <>
      <header className="head" ref={head}>
        <div className="wrap head-row">
          <A to="/" className="logo" aria-label="Zenstra AI home"><Logo /></A>
          <nav className="nav" aria-label="Main">
            <Dropdown id="platform" label="Platform" open={open} setOpen={setOpen} active={inPlatform} wide><PlatformPanel /></Dropdown>
            <Dropdown id="uses" label="Use cases" open={open} setOpen={setOpen} active={inUses} wide><UseCasePanel /></Dropdown>
            <A to="/credit-unions" className="nav-link" aria-current={path === '/credit-unions' ? 'page' : undefined}>Credit unions</A>
            <Dropdown id="company" label="Company" open={open} setOpen={setOpen} active={path === '/company'}><CompanyPanel /></Dropdown>
          </nav>
          <div className="head-actions">
            <ThemeToggle />
            <A to="/demo" className="btn primary sm">Request a demo</A>
            <button className="icon-btn menu-btn" type="button" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="menu" onClick={() => toggleMenu(!menu)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {menu ? <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /> : <path d="M2 4h12M2 8h12M2 12h12" />}
              </svg>
            </button>
          </div>
        </div>
      </header>
      <MobileMenu close={() => toggleMenu(false)} />
    </>
  );
}
