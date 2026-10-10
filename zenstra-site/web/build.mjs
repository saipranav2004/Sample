// Builds the production site from the design sources.
//
//   node build.mjs --out dist --site-url https://zenstra.ai
//
// Pages: home, demo and credit unions from design/zenstra-v6; every other page
// from design/zenstra. Output:
//   <out>/site/          static files served by nginx
//   <out>/nginx/csp-hashes.conf   hashes of inline scripts, for the CSP header
import { readFile, writeFile, mkdir, rm, readdir, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const V6 = path.join(ROOT, 'design', 'zenstra-v6');
const V3 = path.join(ROOT, 'design', 'zenstra');
const FONTS = path.join(HERE, 'fonts');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.concat([[v.slice(2), all[i + 1]]]) : a), []));
const OUT = path.resolve(args.out || path.join(HERE, 'dist'));
const SITE = path.join(OUT, 'site');
const SITE_URL = String(args['site-url'] || 'http://localhost:8080').replace(/\/+$/, '');

const V6_PAGES = ['home', 'demo', 'credit-unions'];
const sha = (buf, enc = 'hex') => createHash('sha256').update(buf).digest(enc);
const exists = (p) => stat(p).then(() => true, () => false);

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p, base));
    else out.push(path.relative(base, p));
  }
  return out;
}

// 1. Merge the two asset folders. A file present in both must be identical.
async function mergeAssets() {
  const origin = new Map();
  for (const [src, label] of [[path.join(V3, 'assets'), 'v3'], [path.join(V6, 'assets'), 'v6']]) {
    for (const rel of await walk(src)) {
      const buf = await readFile(path.join(src, rel));
      const h = sha(buf);
      if (origin.has(rel) && origin.get(rel).h !== h) throw new Error(`asset conflict: assets/${rel} differs between ${origin.get(rel).label} and ${label}`);
      origin.set(rel, { h, label });
      await mkdir(path.dirname(path.join(SITE, 'assets', rel)), { recursive: true });
      await writeFile(path.join(SITE, 'assets', rel), buf);
    }
  }
  for (const f of await readdir(FONTS)) {
    if (!/\.(woff2|css)$/.test(f)) continue;
    await mkdir(path.join(SITE, 'assets', 'fonts'), { recursive: true });
    await copyFile(path.join(FONTS, f), path.join(SITE, 'assets', 'fonts', f));
  }
  await copyFile(path.join(FONTS, 'LICENSES.md'), path.join(SITE, 'assets', 'fonts', 'LICENSES.txt'));
  return origin.size;
}

// 2. Minify CSS and JS and give each a content-hashed name for long caching.
async function fingerprint() {
  const map = new Map();
  for (const rel of await walk(path.join(SITE, 'assets'))) {
    const ext = path.extname(rel);
    if (ext !== '.js' && ext !== '.css') continue;
    const file = path.join(SITE, 'assets', rel);
    const src = await readFile(file, 'utf8');
    const already = /\.min\.js$/.test(rel) || /vendor\//.test(rel);
    let code = src;
    if (!already) {
      const r = await transform(src, { loader: ext.slice(1), minify: true, legalComments: 'inline', target: ext === '.js' ? 'es2018' : ['chrome100', 'firefox100', 'safari15'] });
      code = r.code;
    }
    const hashed = rel.replace(/(\.min)?(\.js|\.css)$/, (m) => `.${sha(code).slice(0, 8)}${m}`);
    await writeFile(path.join(SITE, 'assets', hashed), code);
    map.set('assets/' + rel.split(path.sep).join('/'), 'assets/' + hashed.split(path.sep).join('/'));
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

// 3. Pages: flatten links, use hashed assets and local fonts, add SEO tags,
// and collect inline script hashes for the Content Security Policy.
async function pages(assetMap) {
  const scriptHashes = new Set();
  const list = [];
  const fontsCss = assetMap.get('assets/fonts/fonts.css');
  const preload = { v6: await preloadFor('Hanken Grotesk'), v3: await preloadFor('Instrument Sans') };
  const v3Pages = (await readdir(V3)).filter((f) => f.endsWith('.html') && !V6_PAGES.includes(f.replace('.html', '')));
  const sources = V6_PAGES.map((p) => ({ file: p + '.html', dir: V6, kind: 'v6' })).concat(v3Pages.map((f) => ({ file: f, dir: V3, kind: 'v3' })));
  for (const { file, dir, kind } of sources) {
    let html = await readFile(path.join(dir, file), 'utf8');
    html = html.replace(/\.\.\/zenstra(-v6)?\//g, '');
    html = html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
    const fontTags = `<link rel="preload" href="${preload[kind]}" as="font" type="font/woff2" crossorigin>\n<link rel="stylesheet" href="${fontsCss}">\n`;
    html = html.replace(/(<meta name="viewport"[^>]*>\n?)/, `$1${fontTags}`);
    if (!/rel="icon"/.test(html)) html = html.replace('</head>', '<link rel="icon" href="assets/img/zenstra-mark.png">\n</head>');
    html = html.replace(/((?:src|href)=")(assets\/[^"#?]+\.(?:js|css))(")/g, (m, a, ref, b) => (assetMap.has(ref) ? a + assetMap.get(ref) + b : m));
    // Canonical URLs match the links the pages use (file.html); home is the root.
    const url = `${SITE_URL}/${file === 'home.html' ? '' : file}`;
    const attr = (v) => String(v).replace(/&(?!amp;|lt;|gt;|quot;|#)/g, '&amp;').replace(/"/g, '&quot;');
    const title = attr((html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Zenstra AI');
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const seo = `<link rel="canonical" href="${url}">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="Zenstra AI">\n<meta property="og:title" content="${title}">\n<meta property="og:description" content="${desc}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${SITE_URL}/assets/img/zenstra-mark.png">\n<meta name="twitter:card" content="summary">\n<meta name="theme-color" content="#005aa4">\n`;
    html = html.replace('</head>', seo + '</head>');
    for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) scriptHashes.add(`'sha256-${sha(body, 'base64')}'`);
    const unresolved = [...html.matchAll(/(?:src|href)="(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]).filter((r) => !/\.[0-9a-f]{8}(\.min)?\.(js|css)$/.test(r));
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
  if (!(await exists(path.join(V6, 'home.html'))) || !(await exists(path.join(V3, 'platform.html')))) throw new Error('design sources not found; run the generators in design/zenstra and design/zenstra-v6 first');
  await rm(OUT, { recursive: true, force: true });
  await mkdir(SITE, { recursive: true });
  const n = await mergeAssets();
  const assetMap = await fingerprint();
  const { list, scriptHashes } = await pages(assetMap);
  await extras(list, assetMap);
  await mkdir(path.join(OUT, 'nginx'), { recursive: true });
  await writeFile(path.join(OUT, 'nginx', 'csp-hashes.conf'), `# Generated by build.mjs: hashes of the inline scripts in the built pages.\nset $csp_script_hashes "${[...scriptHashes].sort().join(' ')}";\n`);
  console.log(`built ${list.length} pages, ${n} assets (${assetMap.size} fingerprinted), ${scriptHashes.size} inline script hashes -> ${OUT}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
