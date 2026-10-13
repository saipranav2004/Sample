/* Build step: render every route to static HTML so each page loads complete
   (fast first paint, crawlable), then React hydrates it in the browser.
   Writes dist/<route>.html (and dist/index.html for "/"), 404.html, sitemap.xml and
   robots.txt. nginx serves /platform from platform.html (try_files $uri.html). */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const ssr = join(here, '..', 'dist-ssr', 'entry-server.js');
const SITE = 'https://zenstra.ai';
const { render, ROUTES, NOT_FOUND } = await import(pathToFileURL(ssr).href);
const template = readFileSync(join(dist, 'index.html'), 'utf8');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function page(route, html, { noindex = false } = {}) {
  let out = template;
  const url = SITE + (route.path === '/' ? '/' : route.path);
  out = out.replace(/<title>[^<]*<\/title>/, '<title>' + esc(route.title) + '</title>');
  out = out.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + esc(route.description) + '$2');
  out = out.replace(/(<meta property="og:title" content=")[^"]*(")/, '$1' + esc(route.title) + '$2');
  out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, '$1' + esc(route.description) + '$2');
  out = out.replace(/(<meta property="og:url" content=")[^"]*(")/, '$1' + url + '$2');
  out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, '$1' + (noindex ? SITE + '/' : url) + '$2');
  out = out.replace('<!--robots-->', noindex ? '<meta name="robots" content="noindex">' : '');
  if (!out.includes('<!--app-->')) throw new Error('template is missing <!--app-->');
  return out.replace('<!--app-->', html);
}
function write(file, content) {
  const f = join(dist, file);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, content);
}

for (const r of ROUTES) {
  const html = render(r.path);
  const file = r.path === '/' ? 'index.html' : r.path.slice(1) + '.html';
  write(file, page(r, html));
  console.log('  prerendered', r.path.padEnd(36), '→', file);
}
write('404.html', page(NOT_FOUND, render(NOT_FOUND.path), { noindex: true }));
console.log('  prerendered', '404'.padEnd(36), '→ 404.html');

const today = new Date().toISOString().slice(0, 10);
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  ROUTES.map((r) => '  <url><loc>' + SITE + (r.path === '/' ? '/' : r.path) + '</loc><lastmod>' + today + '</lastmod></url>').join('\n') + '\n</urlset>\n');
write('robots.txt', 'User-agent: *\nAllow: /\nSitemap: ' + SITE + '/sitemap.xml\n');
rmSync(join(here, '..', 'dist-ssr'), { recursive: true, force: true });
console.log('  wrote sitemap.xml and robots.txt (' + ROUTES.length + ' pages)');
