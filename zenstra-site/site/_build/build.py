#!/usr/bin/env python3
"""Build the zenstra.ai pages from _build/pages/.

Each file in pages/ starts with a one-line JSON comment (title, description,
active nav item), an optional <style> block, then the page body. This script
adds the shared head, intro, header, footer and scripts.
Run:  python3 _build/build.py
"""
import json, os, re, sys
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
# Icons: 16px line icons drawn on a 16x16 grid.
I = {
  'eye': '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/>',
  'key': '<circle cx="5.5" cy="8" r="3"/><path d="M8.5 8h6M12 8v2.5M14.5 8v2"/>',
  'lock': '<rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
  'shield': '<path d="M8 1.5 13.5 4v4c0 3.2-2.4 5.6-5.5 6.5C4.9 13.6 2.5 11.2 2.5 8V4Z"/>',
  'code': '<path d="M5 4 1.5 8 5 12M11 4l3.5 4-3.5 4"/>',
  'hand': '<path d="M8 2v6M5.5 4v5M10.5 4v5M3 7v3a5 5 0 0 0 10 0V6"/>',
  'list': '<path d="M3 3.5h10M3 6.5h10M3 9.5h10M3 12.5h6"/>',
  'pulse': '<path d="M1.5 8h3l2-4.5 3 9 2-4.5h3"/>',
  'file': '<path d="M4 1.5h5.5L12.5 4.5v10h-8.5Z M9 1.5v3.5h3.5M6 8.5h4.5M6 11h4.5"/>',
  'bank': '<path d="M2 6 8 2.5 14 6M3.5 6.5v6M6.5 6.5v6M9.5 6.5v6M12.5 6.5v6M2 13.5h12"/>',
  'card': '<rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="M2 7h12"/>',
  'plus': '<path d="M8 3v10M3 8h10"/>',
  'user': '<circle cx="8" cy="6" r="3"/><path d="M3 14c.8-2.6 2.8-4 5-4s4.2 1.4 5 4"/>',
  'chat': '<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z"/>',
  'plug': '<path d="M5.5 2.5v3.5M10.5 2.5v3.5M3.5 6h9v2a4.5 4.5 0 0 1-9 0Z M8 12.5v1.5"/>',
  'gear': '<circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
  'book': '<path d="M2.5 3h4a1.5 1.5 0 0 1 1.5 1.5V14a1.5 1.5 0 0 0-1.5-1.5h-4ZM13.5 3h-4A1.5 1.5 0 0 0 8 4.5V14a1.5 1.5 0 0 1 1.5-1.5h4Z"/>',
  'target': '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/>',
  'pen': '<path d="M10.5 2.5l3 3-8 8H2.5v-3Z"/>',
  'video': '<rect x="1.5" y="3.5" width="9" height="9" rx="1.5"/><path d="m10.5 6.5 4-2v7l-4-2"/>',
  'abc': '<path d="M2 12 4.5 4 7 12M3 9.5h3M9 4h2.5a2 2 0 0 1 0 4H9V4Zm0 4h3a2 2 0 0 1 0 4H9Z"/>',
  'building': '<rect x="3" y="2" width="10" height="12" rx="1"/><path d="M6 5h1M9 5h1M6 8h1M9 8h1M7 14v-3h2v3"/>',
  'people': '<circle cx="6" cy="5.5" r="2.5"/><path d="M1.5 13.5c.6-2.3 2.4-3.5 4.5-3.5s3.9 1.2 4.5 3.5M11 3.5a2.5 2.5 0 0 1 0 4.5M12.5 10.3c1 .5 1.7 1.6 2 3.2"/>',
  'brief': '<rect x="2" y="5" width="12" height="8.5" rx="1.5"/><path d="M5.5 5V3.5h5V5M2 9h12"/>',
  'news': '<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 6h6M5 8.5h6M5 11h3"/>',
  'mail': '<rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="m2.5 4.5 5.5 4 5.5-4"/>',
  'check': '<path d="m3 8.5 3 3 7-7"/>',
  'x': '<path d="M4 4l8 8M12 4l-8 8"/>',
  'arrow': '<path d="M3 8h10M9 4l4 4-4 4"/>',
  'chev': '<path d="M3 4.5 6 7.5 9 4.5"/>',
  'menu': '<path d="M2 4h12M2 8h12M2 12h12"/>',
  'bot': '<rect x="2.5" y="4.5" width="11" height="8" rx="2"/><path d="M8 2v2.5M6 8.5h.01M10 8.5h.01"/>',
  'terminal': '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="m4.5 6.5 2 1.5-2 1.5M8.5 10h3"/>',
  'grid': '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>',
  'cloud': '<path d="M4.5 12.5h7a3 3 0 0 0 .3-6A4 4 0 0 0 4.2 6 3.3 3.3 0 0 0 4.5 12.5Z"/>',
  'device': '<rect x="2" y="3" width="12" height="8" rx="1.2"/><path d="M5.5 13.5h5M8 11v2.5"/>',
  'alert': '<path d="M8 2 14.5 13.5h-13Z M8 6.5v3M8 11.5h.01"/>',
}
def icon(name, size=None, sw='1.6'):
    s = f' width="{size}" height="{size}"' if size else ''
    return f'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"{s}>{I[name]}</svg>'

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
PLATFORM = [('How a decision happens', 'home.html#how'), ('The console', 'home.html#console')]

NAV = [
    ('solutions', 'Credit unions', 'credit-unions.html'),
    ('company', 'Company', 'company.html'),
]

FOOT = [
    ('Products', [(p[1], p[3]) for p in PRODUCTS]),
    ('Solutions', [('Credit unions', 'credit-unions.html')]),
    ('Company', [('About', 'company.html'), ('Contact', 'company.html#contact'), ('Request a demo', 'demo.html')]),
    ('Legal', [('Privacy Policy', 'privacy.html'), ('Terms of Service', 'terms.html')]),
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
      <a class="btn primary sm" href="demo.html">Request a demo</a>
      <button class="icon-btn menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menu">{icon('menu')}</button>
    </div>
  </div>
</header>
<nav class="menu" id="menu" aria-label="Mobile"><span class="mono-label">Products</span>{mob_prod}<span class="mono-label">Explore</span>{mob}<a href="home.html#how">How a decision happens</a><a class="btn primary" href="demo.html">Request a demo</a></nav>
'''


def footer():
    cols = ''.join(f'<div><h2 class="mono-label">{t}</h2>' + ''.join(f'<a href="{h}">{l}</a>' for l, h in links) + '</div>' for t, links in FOOT)
    return f'''<footer class="foot">
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand"><a class="logo" href="home.html" aria-label="Zenstra AI home">{LOGO}</a><p>The runtime security layer for agentic AI: identity, policy and threat defense for every autonomous decision.</p><a class="btn primary" href="demo.html">Request a demo {icon('arrow')}</a></div>
      <div class="foot-cols">{cols}</div>
    </div>
    <div class="foot-legal"><span>&copy; 2026 Zenstra AI</span><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a></div>
  </div>
</footer>
'''


def scripts(meta):
    extra = ''.join(f'<script src="assets/{s}"></script>\n' for s in meta.get('scripts', []))
    return f'''<script src="assets/vendor/lenis-1.1.13.min.js"></script>
<script src="assets/fx6.js"></script>
{extra}<script src="assets/v6.js"></script>
<script src="assets/forms.js"></script>
</body>
</html>
'''


def shot(name, alt):
    from PIL import Image
    w, h = Image.open(os.path.join(OUT, 'assets', 'img', name + '-light.webp')).size
    return (f'<img class="th-light" src="assets/img/{name}-light.webp" alt="{alt}" width="{w}" height="{h}" loading="lazy" decoding="async">'
            f'<img class="th-dark" src="assets/img/{name}-dark.webp" alt="" width="{w}" height="{h}" loading="lazy" decoding="async">')


# Form choices come from the API's reference data, so the page and the
# server always agree on what is valid.
REFERENCE = json.load(open(os.path.join(OUT, '..', 'api', 'src', 'reference.json'), encoding='utf-8'))


def options(key):
    import html as h
    items = REFERENCE[key]
    out = ['<option value="">Choose one</option>']
    for i, v in enumerate(items):
        out.append(f'<option>{h.escape(v)}</option>')
        if key == 'countries' and i == 0:
            out.append('<option disabled>──────────</option>')
    return ''.join(out)


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
    body = re.sub(r'\{\{options:([A-Za-z]+)\}\}', lambda x: options(x.group(1)), body)
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
