#!/usr/bin/env python3
"""Build the Zenstra v6 experiment pages (home, demo, credit unions).

Each file in pages/ starts with a one-line JSON comment (title, description,
active nav item), an optional <style> block, then the page body. This script
adds the shared head, intro, header, footer and scripts. Pages that are not
part of v6 link to their v3 versions in ../zenstra/.
Run:  python3 _build/build.py
"""
import json, os, re, sys
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
V3 = '../zenstra/'

sys.path.insert(0, os.path.join(OUT, '..', 'zenstra', '_build'))
from build import I, icon  # noqa: E402  shared icon set

I.update({
    'flow': '<circle cx="3" cy="4" r="1.6"/><circle cx="13" cy="4" r="1.6"/><circle cx="8" cy="12" r="1.6"/><path d="M4.6 4h6.8M3.8 5.4l3.4 5.2M12.2 5.4 8.8 10.6"/>',
    'scan': '<path d="M2 5V3a1 1 0 0 1 1-1h2M11 2h2a1 1 0 0 1 1 1v2M14 11v2a1 1 0 0 1-1 1h-2M5 14H3a1 1 0 0 1-1-1v-2M2 8h12"/>',
})

LOGO = ('<span class="logo-mark"><img class="th-light" src="assets/img/zenstra-mark.png" alt="" width="138" height="126">'
        '<img class="th-dark" src="assets/img/zenstra-mark-dark.png" alt="" width="138" height="126"></span>'
        '<span class="logo-word">ZENSTRA<b>AI</b></span>')

PRODUCTS = [
    ('flow', 'Workflow Security', 'Every hop in every agent workflow', 'home.html#workflow'),
    ('cloud', 'Cloud Security', 'Runtime protection in your cloud', 'home.html#cloud'),
    ('scan', 'Zenstra EDR', 'Detection and response for AI on endpoints', 'home.html#edr'),
]
PLATFORM = [('Platform overview', V3 + 'platform.html'), ('Architecture', V3 + 'platform.html#architecture'), ('Discover', V3 + 'discover.html'), ('Enforce', V3 + 'enforce.html'), ('Prove', V3 + 'prove.html'), ('Console', V3 + 'console.html')]

NAV = [
    ('solutions', 'Credit unions', 'credit-unions.html'),
    ('resources', 'Resources', V3 + 'resources.html'),
    ('trust', 'Trust Center', V3 + 'trust-center.html'),
    ('company', 'Company', V3 + 'company.html'),
]

FOOT = [
    ('Products', [(p[1], p[3]) for p in PRODUCTS] + [('Console', V3 + 'console.html')]),
    ('Platform', PLATFORM[1:5]),
    ('Solutions', [('Credit unions', 'credit-unions.html'), ('Banking and lending', V3 + 'solutions.html#banking'), ('Healthcare', V3 + 'solutions.html#healthcare'), ('Agent types', V3 + 'solutions.html#agents')]),
    ('Company', [('Trust Center', V3 + 'trust-center.html'), ('About', V3 + 'company.html#about'), ('Careers', V3 + 'company.html#careers'), ('Contact', V3 + 'company.html#contact')]),
]


def head(meta, style):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{meta['title']}</title>
<meta name="description" content="{meta['description']}">
<link rel="icon" href="assets/img/zenstra-mark.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Sora:wght@600&display=swap" rel="stylesheet">
<script>(function(){{var r=document.documentElement;r.classList.add('js');try{{var t=localStorage.getItem('zx-theme');if(t)r.setAttribute('data-theme',t);}}catch(e){{}}var red=matchMedia('(prefers-reduced-motion: reduce)').matches;if(red)r.classList.add('reduce');var seen=false;try{{seen=sessionStorage.getItem('zx6-intro')==='1';}}catch(e){{}}if(!red&&(!seen||/[?&]intro=1/.test(location.search)))r.classList.add('intro-play');setTimeout(function(){{if(!window.__v6ok){{r.classList.remove('intro-play');r.classList.add('reveal-all');}}}},7000);}})();</script>
<link rel="stylesheet" href="assets/v6.css">
{style}
</head>
<body data-page="{meta['name']}">
<a class="skip" href="#main">Skip to content</a>
'''


def intro():
    words = ['workflow security', 'cloud security', 'EDR']
    data = '|'.join(words)
    return f'''<div class="intro" aria-hidden="true">
  <div class="intro-stage">
    <p class="intro-line"><span class="intro-for">Zenstra for</span> <span class="intro-word" data-words="{data}"></span></p>
    <div class="intro-logo">{LOGO}</div>
  </div>
  <button class="intro-skip" type="button" tabindex="-1">Skip intro</button>
</div>
'''


def header(active):
    cur = ' aria-current="page"'
    prod = ''.join(f'<a class="mm-item" href="{h}"><span class="mm-ic">{icon(i)}</span><span><b>{n}</b><small>{d}</small></span></a>' for i, n, d, h in PRODUCTS)
    plat = ''.join(f'<a href="{h}">{n}</a>' for n, h in PLATFORM)
    links = ''.join(f'<a class="nav-link" href="{h}"{cur if k == active else ""}>{l}</a>' for k, l, h in NAV)
    mob_prod = ''.join(f'<a href="{h}">{n}</a>' for i, n, d, h in PRODUCTS)
    mob = ''.join(f'<a href="{h}">{l}</a>' for k, l, h in NAV)
    return f'''<header class="head">
  <div class="wrap head-row">
    <a class="logo" href="home.html" aria-label="Zenstra AI home">{LOGO}</a>
    <nav class="nav" aria-label="Main">
      <div class="dd"><button class="nav-link dd-btn" type="button" aria-expanded="false" aria-controls="dd-products">Products {icon('chev')}</button>
        <div class="dd-panel" id="dd-products"><div class="mm-prod">{prod}</div><div class="mm-plat"><span class="mono-label">Platform</span>{plat}</div></div>
      </div>
      {links}
    </nav>
    <div class="head-actions">
      <button class="icon-btn theme" type="button" data-theme-toggle aria-label="Switch between light and dark theme"><svg class="moon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z"/></svg><svg class="sun" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1"/></svg></button>
      <a class="signin" href="{V3}console.html">Sign in</a>
      <a class="btn primary sm" href="demo.html">Request a demo</a>
      <button class="icon-btn menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menu">{icon('menu')}</button>
    </div>
  </div>
</header>
<nav class="menu" id="menu" aria-label="Mobile"><span class="mono-label">Products</span>{mob_prod}<span class="mono-label">Explore</span>{mob}<a href="{V3}platform.html">Platform</a><a href="{V3}console.html">Sign in</a><a class="btn primary" href="demo.html">Request a demo</a></nav>
'''


def footer():
    cols = ''.join(f'<div><h2 class="mono-label">{t}</h2>' + ''.join(f'<a href="{h}">{l}</a>' for l, h in links) + '</div>' for t, links in FOOT)
    return f'''<footer class="foot">
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand"><a class="logo" href="home.html" aria-label="Zenstra AI home">{LOGO}</a><p>The runtime security layer for agentic AI: identity, policy and threat defense for every autonomous decision.</p><a class="btn primary" href="demo.html">Request a demo {icon('arrow')}</a></div>
      <div class="foot-cols">{cols}</div>
    </div>
    <div class="foot-legal"><span>&copy; 2026 Zenstra AI</span><a href="{V3}legal.html#privacy">Privacy</a><a href="{V3}legal.html#terms">Terms</a><a href="{V3}legal.html#cookies">Cookies</a><a href="{V3}legal.html#accessibility">Accessibility</a><a class="status" href="{V3}trust-center.html#status"><i></i>All systems operational</a></div>
  </div>
</footer>
'''


def scripts(meta):
    extra = ''.join(f'<script src="assets/{s}"></script>\n' for s in meta.get('scripts', []))
    return f'''<script src="assets/vendor/lenis-1.1.13.min.js"></script>
<script src="assets/fx6.js"></script>
{extra}<script src="assets/v6.js"></script>
</body>
</html>
'''


def shot(name, alt):
    from PIL import Image
    w, h = Image.open(os.path.join(OUT, 'assets', 'img', name + '-light.webp')).size
    return (f'<img class="th-light" src="assets/img/{name}-light.webp" alt="{alt}" width="{w}" height="{h}" loading="lazy" decoding="async">'
            f'<img class="th-dark" src="assets/img/{name}-dark.webp" alt="" width="{w}" height="{h}" loading="lazy" decoding="async">')


def build(name):
    src = open(os.path.join(HERE, 'pages', name + '.html'), encoding='utf-8').read()
    m = re.match(r'\s*<!--(\{.*?\})-->\s*', src, re.S)
    if not m:
        sys.exit(f'{name}: missing meta comment')
    meta = json.loads(m.group(1)); meta['name'] = name
    body = src[m.end():]
    style = ''
    sm = re.match(r'(<style>.*?</style>)\s*', body, re.S)
    if sm:
        style, body = sm.group(1), body[sm.end():]
    body = body.replace('{{logo}}', LOGO)
    body = re.sub(r'\{\{icon:([a-z]+)\}\}', lambda x: icon(x.group(1)), body)
    body = re.sub(r'\{\{shot:([a-z0-9-]+)\|([^}]*)\}\}', lambda x: shot(x.group(1), x.group(2)), body)
    html = head(meta, style) + intro() + header(meta.get('active', '')) + '<main id="main">\n' + body.strip() + '\n</main>\n' + footer() + scripts(meta)
    with open(os.path.join(OUT, name + '.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    return name


if __name__ == '__main__':
    names = sorted(f[:-5] for f in os.listdir(os.path.join(HERE, 'pages')) if f.endswith('.html'))
    for n in names:
        build(n)
    print('built:', ', '.join(names))
