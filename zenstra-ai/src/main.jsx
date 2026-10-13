import { hydrateRoot, createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App.jsx';
import './styles/v5.css';
import './styles/pages.css';
import './styles/enterprise.css';

const el = document.getElementById('root');
const app = (<BrowserRouter><App /></BrowserRouter>);
// Prerendered pages hydrate; the dev server renders from scratch.
if (el.hasChildNodes()) hydrateRoot(el, app);
else createRoot(el).render(app);
// boot.js reveals the page if this never runs (see public/boot.js).
window.__v5ok = true;
