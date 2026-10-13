/* Line icons used across menus, cards and capability pages (24px grid, 1.6 stroke). */
const P = {
  radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12 18.5 5.5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M15 8l2 2" /></>,
  gate: <><path d="M4 21V9l8-6 8 6v12" /><path d="M9 21v-7h6v7" /><path d="m10 10 1.5 1.5L15 8" /></>,
  plug: <><path d="M9 3v5M15 3v5" /><path d="M6 8h12v3a6 6 0 0 1-12 0z" /><path d="M12 17v4" /></>,
  pulse: <><path d="M3 12h4l2.5-6 4 12L16 12h5" /></>,
  ledger: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  eyeoff: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4M6.3 6.4A17 17 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 4.4-1.1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  inject: <><path d="M4 5h16v10H9l-5 4z" /><path d="m10 8 4 4M14 8l-4 4" /></>,
  flask: <><path d="M9 3h6M10 3v6l-5.5 9.2A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.8L14 9V3" /><path d="M7.5 15h9" /></>,
  drop: <><path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" /><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" /></>,
  flow: <><rect x="3" y="4" width="6" height="5" rx="1.2" /><rect x="15" y="4" width="6" height="5" rx="1.2" /><rect x="9" y="15" width="6" height="5" rx="1.2" /><path d="M6 9v2.5h12V9M12 11.5V15" /></>,
  cloud: <><path d="M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" /></>,
  laptop: <><rect x="5" y="5" width="14" height="10" rx="1.5" /><path d="M3 19h18" /></>,
  check: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="m9 13 2 2 4-4" /></>,
  bank: <><path d="M3 9 12 4l9 5" /><path d="M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 20h18" /></>,
  platform: <><path d="M12 3 3 8l9 5 9-5z" /><path d="m3 13 9 5 9-5" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  shield: <><path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  bolt: <><path d="M13 3 5 14h6l-1 7 8-11h-6z" /></>,
  layers: <><path d="M12 3 3 8l9 5 9-5z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  play: <><path d="M8 5v14l11-7z" fill="currentColor" stroke="none" /></>,
};

export default function Icon({ name, className, title }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      {P[name] || P.platform}
    </svg>
  );
}
