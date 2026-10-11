// Builds the production site from zenstra-site/site.
//
//   node build.mjs --out dist --site-url https://zenstra.ai
//
// Every page in site/ is copied with minified, fingerprinted assets and self-hosted fonts. Output:
//   <out>/site/                   static files served by nginx
//   <out>/nginx/csp-hashes.conf   hashes of inline scripts, for the CSP header
import { readFile, writeFile, mkdir, rm, readdir, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'site');
const FONTS = path.join(HERE, 'fonts');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.concat([[v.slice(2), all[i + 1]]]) : a), []));
const OUT = path.resolve(args.out || path.join(HERE, 'dist'));
const SITE = path.join(OUT, 'site');
const SITE_URL = String(args['site-url'] || 'http://localhost:8080').replace(/\/+$/, '');

const sha = (buf, enc = 'hex') => createHash('sha256').update(buf).digest(enc);
const exists = (p) => stat(p).then(() => true, () => false);
const posix = (p) => p.split(path.sep).join('/');

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p, base));
    else out.push(path.relative(base, p));
  }
  return out;
}

// 1. Copy the site, leaving out the page sources and generator.
async function copySite() {
  const files = (await walk(SRC)).filter((f) => !posix(f).startsWith('_build/') && !/(^|\/)\.|__pycache__/.test(posix(f)));
  for (const rel of files) {
    await mkdir(path.dirname(path.join(SITE, rel)), { recursive: true });
    await copyFile(path.join(SRC, rel), path.join(SITE, rel));
  }
  await mkdir(path.join(SITE, 'assets', 'fonts'), { recursive: true });
  for (const f of await readdir(FONTS)) if (/\.(woff2|css)$/.test(f)) await copyFile(path.join(FONTS, f), path.join(SITE, 'assets', 'fonts', f));
  await copyFile(path.join(FONTS, 'LICENSES.md'), path.join(SITE, 'assets', 'fonts', 'LICENSES.txt'));
  return files;
}

// 2. Minify CSS and JS and give each a content-hashed name for long caching.
// Keys and values are paths from the site root.
async function fingerprint(files) {
  const map = new Map();
  for (const rel of files.map(posix).concat('assets/fonts/fonts.css')) {
    const ext = path.extname(rel);
    if (ext !== '.js' && ext !== '.css') continue;
    // Vendor files carry their version in the name and are imported by path
    // (three.js by checks3d.js), so they keep it.
    if (/(^|\/)vendor\//.test(rel)) continue;
    const file = path.join(SITE, rel);
    const src = await readFile(file, 'utf8');
    const already = /\.min\.js$/.test(rel) || /vendor\//.test(rel);
    let code = src;
    if (!already) {
      const r = await transform(src, { loader: ext.slice(1), minify: true, legalComments: 'inline', target: ext === '.js' ? 'es2018' : ['chrome100', 'firefox100', 'safari15'] });
      code = r.code;
    }
    const hashed = rel.replace(/(\.min)?(\.js|\.css)$/, (m) => `.${sha(code).slice(0, 8)}${m}`);
    await writeFile(path.join(SITE, hashed), code);
    await rm(file);
    map.set(rel, hashed);
  }
  return map;
}

// The first latin face of a family in fonts.css, to preload.
async function preloadFor(family) {
  const css = await readFile(path.join(FONTS, 'fonts.css'), 'utf8');
  const block = css.split('/* ').find((b) => b.startsWith('latin */') && b.includes(`font-family: '${family}'`) && /font-style: normal/.test(b));
  const m = block && block.match(/url\(([^)]+\.woff2)\)/);
  return m ? `assets/fonts/${m[1]}` : null;
}

// 3. Pages: hashed assets, local fonts, SEO tags, and the hashes of inline
// scripts for the Content Security Policy.
async function pages(files, assetMap) {
  const scriptHashes = new Set();
  const list = [];
  const preload = await preloadFor('Hanken Grotesk');
  for (const file of files.map(posix).filter((f) => f.endsWith('.html'))) {
    const dir = path.posix.dirname(file) === '.' ? '' : path.posix.dirname(file);
    const up = (p) => (dir ? path.posix.relative(dir, p) : p);
    let html = await readFile(path.join(SITE, file), 'utf8');
    html = html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
    const fontTags = `<link rel="preload" href="${up(preload)}" as="font" type="font/woff2" crossorigin>\n<link rel="stylesheet" href="${up(assetMap.get('assets/fonts/fonts.css'))}">\n`;
    html = html.replace(/(<meta name="viewport"[^>]*>\n?)/, `$1${fontTags}`);
    if (!/rel="icon"/.test(html)) html = html.replace('</head>', `<link rel="icon" href="${up('assets/img/zenstra-mark.png')}">\n</head>`);
    html = html.replace(/((?:src|href|data-src)=")((?:\.\.\/)*assets\/[^"#?]+\.(?:js|css))(")/g, (m, a, ref, b) => {
      const key = path.posix.join(dir, ref);
      return assetMap.has(key) ? a + up(assetMap.get(key)) + b : m;
    });
    // Canonical URLs match the links the pages use (file.html); home is the root.
    const url = `${SITE_URL}/${file === 'home.html' ? '' : file.replace(/(^|\/)index\.html$/, '$1')}`;
    const attr = (v) => String(v).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;').replace(/"/g, '&quot;');
    const title = attr((html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Zenstra AI');
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const seo = `<link rel="canonical" href="${url}">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="Zenstra AI">\n<meta property="og:title" content="${title}">\n<meta property="og:description" content="${desc}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${SITE_URL}/assets/img/zenstra-mark.png">\n<meta name="twitter:card" content="summary">\n<meta name="theme-color" content="#005aa4">\n`;
    html = html.replace('</head>', seo + '</head>');
    for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) scriptHashes.add(`'sha256-${sha(body, 'base64')}'`);
    const unresolved = [...html.matchAll(/(?:src|href|data-src)="((?:\.\.\/)*assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]).filter((r) => !/\/vendor\/|^assets\/vendor\//.test(r) && !/\.[0-9a-f]{8}(\.min)?\.(js|css)$/.test(r));
    if (unresolved.length) throw new Error(`${file}: assets not fingerprinted: ${unresolved.join(', ')}`);
    await writeFile(path.join(SITE, file), html);
    list.push({ file, url, title });
  }
  return { list, scriptHashes };
}

async function extras(list, assetMap) {
  const urls = list.map((p) => `  <url><loc>${p.url}</loc></url>`).join('\n');
  await writeFile(path.join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  await writeFile(path.join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  const css = assetMap.get('assets/v6.css');
  const fonts = assetMap.get('assets/fonts/fonts.css');
  await writeFile(path.join(SITE, '404.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found · Zenstra AI</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/img/zenstra-mark.png">
<link rel="stylesheet" href="/${fonts}">
<link rel="stylesheet" href="/${css}">
</head>
<body>
<main class="wrap" style="min-height:100vh;display:grid;align-content:center;gap:22px;padding:80px 0">
  <a class="logo" href="/" aria-label="Zenstra AI home"><span class="logo-mark"><img src="/assets/img/zenstra-mark.png" alt="" width="138" height="126"></span><span class="logo-word">ZENSTRA<b>AI</b></span></a>
  <span class="eyebrow">404</span>
  <h1 class="h2">This page is outside the perimeter.</h1>
  <p class="lede">The link may be old, or the page may have moved.</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn primary" href="/">Go to the home page</a><a class="btn secondary" href="/demo">Request a demo</a></div>
</main>
</body>
</html>
`);
}

async function main() {
  if (!(await exists(path.join(SRC, 'home.html')))) throw new Error('site/home.html not found; run python3 site/_build/build.py first');
  await rm(OUT, { recursive: true, force: true });
  await mkdir(SITE, { recursive: true });
  const files = await copySite();
  const assetMap = await fingerprint(files);
  const { list, scriptHashes } = await pages(files, assetMap);
  await extras(list, assetMap);
  await mkdir(path.join(OUT, 'nginx'), { recursive: true });
  await writeFile(path.join(OUT, 'nginx', 'csp-hashes.conf'), `# Generated by build.mjs: hashes of the inline scripts in the built pages.\nset $csp_script_hashes "${[...scriptHashes].sort().join(' ')}";\n`);
  console.log(`built ${list.length} pages, ${files.length} files (${assetMap.size} fingerprinted), ${scriptHashes.size} inline script hashes -> ${OUT}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
