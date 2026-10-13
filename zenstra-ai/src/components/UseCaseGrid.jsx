import A from './A.jsx';
import Icon from './Icon.jsx';
import { USE_CASES, useCasePath } from '../content/site.js';

/* Every use case as a compact card (home page). */
export default function UseCaseGrid() {
  return (
    <div className="ucgrid">
      {USE_CASES.map((u, i) => (
        <A key={u.slug} to={useCasePath(u.slug)} className="uccard" data-reveal="" data-delay={(i % 4) * 70}>
          <span className="mm-ic"><Icon name={u.icon} /></span>
          <b>{u.name}</b>
          <small>{u.short}</small>
          <svg className="uc-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
        </A>
      ))}
    </div>
  );
}
