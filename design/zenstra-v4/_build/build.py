#!/usr/bin/env python3
"""Build the Zenstra v4 pages (home, demo, credit unions).

Same approach as the v3 generator: each file in pages/ starts with a one-line
JSON comment (title, description, active nav item), an optional <style> block,
then the page body. This script adds the shared head, intro, header, footer and
scripts. Pages not yet redesigned link to their v3 versions in ../zenstra/.
Run:  python3 _build/build.py
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
V3 = '../zenstra/'

sys.path.insert(0, os.path.join(OUT, '..', 'zenstra', '_build'))
from build import I, icon, STAR  # noqa: E402  shared icon set

NAV = [
    ('platform', 'Platform', V3 + 'platform.html'),
    ('solutions', 'Credit unions', 'credit-unions.html'),
    ('resources', 'Resources', V3 + 'resources.html'),
    ('trust', 'Trust Center', V3 + 'trust-center.html'),
    ('company', 'Company', V3 + 'company.html'),
]

FOOT = [
    ('Platform', [('Discover', V3 + 'discover.html'), ('Enforce', V3 + 'enforce.html'), ('Prove', V3 + 'prove.html'), ('Architecture', V3 + 'platform.html#architecture'), ('Console', V3 + 'console.html')]),
    ('Solutions', [('Credit unions', 'credit-unions.html'), ('Banking and lending', V3 + 'solutions.html#banking'), ('Healthcare', V3 + 'solutions.html#healthcare'), ('Agent types', V3 + 'solutions.html#agents')]),
    ('Trust', [('Trust Center', V3 + 'trust-center.html'), ('Certifications', V3 + 'trust-center.html#compliance'), ('Subprocessors', V3 + 'trust-center.html#subprocessors'), ('Report a vulnerability', V3 + 'trust-center.html#disclosure')]),
    ('Company', [('About', V3 + 'company.html#about'), ('Careers', V3 + 'company.html#careers'), ('Contact', V3 + 'company.html#contact'), ('Request a demo', 'demo.html')]),
]

MARK = f'<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="url(#zgrad)" d="{STAR}"/></svg>'
DEFS = '<svg class="svg-defs" aria-hidden="true" focusable="false"><defs><linearGradient id="zgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12b0f0"/><stop offset="1" stop-color="#1667d9"/></linearGradient></defs></svg>'


def head(meta, style):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{meta['title']}</title>
<meta name="description" content="{meta['description']}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>(function(){{var r=document.documentElement;r.classList.add('js');try{{var t=localStorage.getItem('zx-theme');if(t)r.setAttribute('data-theme',t);}}catch(e){{}}var red=matchMedia('(prefers-reduced-motion: reduce)').matches;if(red)r.classList.add('reduce');var seen=false;try{{seen=sessionStorage.getItem('zx4-intro')==='1';}}catch(e){{}}if(!red&&(!seen||/[?&]intro=1/.test(location.search)))r.classList.add('intro-play');setTimeout(function(){{if(!window.__v4ok){{r.classList.remove('intro-play');r.classList.add('reveal-all');}}}},6000);}})();</script>
<link rel="stylesheet" href="assets/v4.css">
{style}
</head>
<body data-page="{meta['name']}">
<a class="skip" href="#main">Skip to content</a>
''' + DEFS + '''
'''


def intro():
    words = ['credit unions', 'banks', 'healthcare']
    spans = ''.join(f'<span>{w}</span>' for w in words)
    return f'''<div class="intro" aria-hidden="true">
  <div class="intro-line"><span class="intro-brand">{MARK}<b>Zenstra</b></span><span class="intro-for">for</span><span class="intro-words">{spans}</span></div>
  <button class="intro-skip" type="button" tabindex="-1">Skip</button>
</div>
'''


def header(active):
    cur = ' aria-current="page"'
    links = ''.join(f'<a href="{href}"{cur if key == active else ""}>{label}</a>' for key, label, href in NAV)
    mobile = ''.join(f'<a href="{href}">{label}</a>' for key, label, href in NAV)
    return f'''<header class="head">
  <div class="wrap head-row">
    <a class="logo" href="home.html" aria-label="Zenstra home">{MARK}<span>Zenstra</span></a>
    <nav class="nav" aria-label="Main">{links}</nav>
    <div class="head-actions">
      <button class="icon-btn theme" type="button" data-theme-toggle aria-label="Switch between light and dark theme"><svg class="moon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z"/></svg><svg class="sun" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1"/></svg></button>
      <a class="signin" href="{V3}console.html">Sign in</a>
      <a class="pill dark" href="demo.html">Request a demo</a>
      <button class="icon-btn menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menu">{icon('menu')}</button>
    </div>
  </div>
</header>
<nav class="menu" id="menu" aria-label="Mobile">{mobile}<a href="{V3}console.html">Sign in</a><a class="pill dark" href="demo.html">Request a demo</a></nav>
'''


def footer():
    cols = ''.join(f'<div><h2>{t}</h2>' + ''.join(f'<a href="{h}">{l}</a>' for l, h in links) + '</div>' for t, links in FOOT)
    return f'''<footer class="foot" data-foot>
  <div class="wrap">
    <div class="foot-top">
      <p class="foot-line">Every agent action,<br>checked before it runs.</p>
      <div class="foot-cols">{cols}</div>
    </div>
    <div class="wordmark" aria-hidden="true"><span>Zenstra</span><svg class="lift-star" viewBox="0 0 24 24"><path d="{STAR}"/></svg></div>
    <div class="foot-legal"><span>&copy; 2026 Zenstra AI</span><a href="{V3}legal.html#privacy">Privacy</a><a href="{V3}legal.html#terms">Terms</a><a href="{V3}legal.html#cookies">Cookies</a><a href="{V3}legal.html#accessibility">Accessibility</a><a class="status" href="{V3}trust-center.html#status"><i></i>All systems operational</a></div>
  </div>
</footer>
'''


def scripts(meta):
    extra = ''.join(f'<script src="assets/{s}"></script>\n' for s in meta.get('scripts', []))
    return f'''<script src="assets/vendor/lenis-1.1.13.min.js"></script>
<script src="assets/particles.js"></script>
{extra}<script src="assets/v4.js"></script>
</body>
</html>
'''


def shot(name, alt, eager=False):
    from PIL import Image
    w, h = Image.open(os.path.join(OUT, 'assets', 'img', name + '-light.webp')).size
    load = 'eager' if eager else 'lazy'
    return (f'<img class="th-light" src="assets/img/{name}-light.webp" alt="{alt}" width="{w}" height="{h}" loading="{load}" decoding="async">'
            f'<img class="th-dark" src="assets/img/{name}-dark.webp" alt="" width="{w}" height="{h}" loading="{load}" decoding="async">')


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
    body = body.replace('{{mark}}', MARK)
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
