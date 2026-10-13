import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import App from './App.jsx';

/* Used at build time only (scripts/prerender.mjs): render one route to HTML. */
export function render(url) {
  return renderToString(<StaticRouter location={url}><App /></StaticRouter>);
}
export { ROUTES, NOT_FOUND } from './content/site.js';
