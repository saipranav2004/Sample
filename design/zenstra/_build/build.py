#!/usr/bin/env python3
"""Build the Zenstra marketing pages.

Each file in pages/ starts with a one-line JSON comment holding the page's
metadata, an optional <style> block, then the <main> content. This script wraps
every page in the same head, header, menus, footer and scripts, so navigation is
identical everywhere. Run:  python3 _build/build.py
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

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

STAR = 'M12 0C12.9 7.6 16.4 11.1 24 12 16.4 12.9 12.9 16.4 12 24 11.1 16.4 7.6 12.9 0 12 7.6 11.1 11.1 7.6 12 0Z'

MEGA = {
  'platform': {
    'label': 'Platform', 'cols': 3, 'cls': '',
    'groups': [
      ('Discover', [('Shadow AI discovery', 'Agents and AI tools nobody registered', 'eye', 'discover.html#shadow-ai'),
                    ('Agent inventory and identity', 'One record, one owner, one key per agent', 'key', 'discover.html#identity')]),
      ('Enforce', [('Secure tool access', 'Scoped, expiring grants per call', 'lock', 'enforce.html#tool-access'),
                   ('Injection and memory defense', 'Untrusted content never steers the agent', 'shield', 'enforce.html#injection'),
                   ('Policy as code', 'One guardrail set for every agent', 'code', 'enforce.html#policy'),
                   ('Approvals and emergency stop', 'A person decides the risky calls', 'hand', 'enforce.html#approvals')]),
      ('Prove', [('Decision ledger', 'Tamper-evident record of every decision', 'list', 'prove.html#ledger'),
                 ('Runtime detection', 'Drift against each agent’s baseline', 'pulse', 'prove.html#detection'),
                 ('Compliance evidence', 'Exam-ready exports for auditors', 'file', 'prove.html#evidence')]),
    ],
    'foot': [('Platform overview', 'platform.html'), ('Architecture', 'platform.html#architecture'), ('Integrations', 'platform.html#integrations'), ('Documentation', 'resources.html#docs')],
  },
  'solutions': {
    'label': 'Solutions', 'cols': 2, 'cls': '',
    'groups': [
      ('By industry', [('Credit unions', 'Exam-ready evidence for every agent', 'bank', 'credit-unions.html'),
                       ('Banking and lending', 'Core, LOS and fraud agents', 'card', 'solutions.html#banking'),
                       ('Healthcare', 'Clinical and claims agents', 'plus', 'solutions.html#healthcare')]),
      ('By agent type', [('Employee copilots', 'Copilot, ChatGPT and Gemini at work', 'user', 'solutions.html#copilots'),
                         ('Member-facing agents', 'Untrusted input all day', 'chat', 'solutions.html#member-facing'),
                         ('Coding agents', 'Repo, CI and production shell access', 'terminal', 'solutions.html#coding'),
                         ('MCP servers', 'Every connector is an access grant', 'plug', 'solutions.html#mcp')]),
    ],
    'foot': [('All solutions', 'solutions.html'), ('Request a demo', 'demo.html')],
  },
  'resources': {
    'label': 'Resources', 'cols': 2, 'cls': '',
    'groups': [
      ('Learn', [('Documentation', 'Quickstarts, deployment and API reference', 'book', 'resources.html#docs'),
                 ('Threat research', 'How agents get attacked, with real techniques', 'target', 'resources.html#research'),
                 ('Guides and reports', 'Programme guides for security leaders', 'file', 'resources.html#guides')]),
      ('Stay current', [('Blog', 'Product and engineering notes', 'pen', 'resources.html#blog'),
                        ('Webinars and events', 'Live sessions with our engineers', 'video', 'resources.html#webinars'),
                        ('Glossary', 'Agentic AI security terms, defined', 'abc', 'resources.html#glossary')]),
    ],
    'foot': [('Resource library', 'resources.html'), ('Trust center', 'trust.html')],
  },
  'company': {
    'label': 'Company', 'cols': 2, 'cls': 'right',
    'groups': [
      ('About Zenstra', [('About us', 'Why we build runtime security for agents', 'building', 'company.html#about'),
                         ('Leadership', 'The team accountable for the product', 'people', 'company.html#leadership'),
                         ('Careers', 'Open roles', 'brief', 'company.html#careers')]),
      ('Get in touch', [('Newsroom', 'Announcements and coverage', 'news', 'company.html#news'),
                        ('Contact', 'Sales, security and press', 'mail', 'company.html#contact'),
                        ('Trust center', 'Security, compliance and status', 'shield', 'trust.html')]),
    ],
    'foot': [('Request a demo', 'demo.html')],
  },
}

FOOT = [
  ('Platform', [('Overview', 'platform.html'), ('Discover', 'discover.html'), ('Enforce', 'enforce.html'), ('Prove', 'prove.html'), ('Architecture', 'platform.html#architecture'), ('Integrations', 'platform.html#integrations')]),
  ('Solutions', [('Credit unions', 'credit-unions.html'), ('Banking and lending', 'solutions.html#banking'), ('Healthcare', 'solutions.html#healthcare'), ('Employee copilots', 'solutions.html#copilots'), ('MCP servers', 'solutions.html#mcp')]),
  ('Resources', [('Documentation', 'resources.html#docs'), ('Threat research', 'resources.html#research'), ('Blog', 'resources.html#blog'), ('Webinars', 'resources.html#webinars'), ('Glossary', 'resources.html#glossary')]),
  ('Trust', [('Trust center', 'trust.html'), ('Compliance', 'trust.html#compliance'), ('Subprocessors', 'trust.html#subprocessors'), ('System status', 'trust.html#status'), ('Report a vulnerability', 'trust.html#disclosure')]),
  ('Company', [('About', 'company.html#about'), ('Leadership', 'company.html#leadership'), ('Careers', 'company.html#careers'), ('Newsroom', 'company.html#news'), ('Contact', 'company.html#contact')]),
]

def head(meta, style):
    title = meta['title']
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{meta['description']}">
<script>try{{var t=localStorage.getItem('zx-theme');if(t)document.documentElement.dataset.theme=t}}catch(e){{}}document.documentElement.classList.add('js');</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wdth,wght@0,75..100,400..700;1,75..100,400..700&family=JetBrains+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="assets/zx.css">
<link rel="stylesheet" href="assets/site.css">
<link rel="stylesheet" href="assets/pages.css">
{style}
</head>
<body data-page="{meta['name']}">
<a class="skip" href="#main">Skip to content</a>
'''

def intro():
    return f'''<div class="intro" aria-hidden="true">
  <div class="intro-inner">
    <svg class="star" viewBox="0 0 24 24"><defs><linearGradient id="introGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12b0f0"/><stop offset="1" stop-color="#0c6eb4"/></linearGradient></defs><path class="star-fill" style="transform-box:fill-box;transform-origin:center" d="{STAR}"/><path class="star-stroke" d="{STAR}"/></svg>
    <div class="word"><span>Z</span><span>E</span><span>N</span><span>S</span><span>T</span><span>R</span><span>A</span></div>
    <div class="bar"><i></i></div>
  </div>
</div>
<div class="progress" aria-hidden="true"></div>
'''

def mega(key, active):
    m = MEGA[key]
    cols = ''
    for gname, items in m['groups']:
        links = ''.join(f'<a href="{href}"><span class="ic">{icon(ic)}</span><b>{t}</b><small>{s}</small></a>' for t, s, ic, href in items)
        cols += f'<div><span class="label">{gname}</span>{links}</div>'
    foot = ''.join(f'<a href="{h}">{t}</a>' for t, h in m['foot'])
    cur = ' aria-current="page"' if active == key else ''
    return f'''      <li>
        <button class="nav-trigger" aria-haspopup="true" aria-expanded="false"{cur}>{m['label']} {icon('chev')}</button>
        <div class="mega cols-{m['cols']} {m['cls']}" role="group" aria-label="{m['label']}">{cols}<div class="foot">{foot}</div></div>
      </li>
'''

def header(active):
    nav = mega('platform', active) + mega('solutions', active) + mega('resources', active)
    tcur = ' aria-current="page"' if active == 'trust' else ''
    nav += f'      <li><a class="nav-trigger" href="trust.html"{tcur}>Trust center</a></li>\n'
    nav += mega('company', active)
    groups = ''
    for key in ['platform', 'solutions', 'resources', 'company']:
        m = MEGA[key]
        links = ''.join(f'<a href="{href}">{t}</a>' for g, items in m['groups'] for t, s, ic, href in items)
        groups += f'<details><summary>{m["label"]}</summary><div>{links}</div></details>'
    return f'''<header class="site-head">
  <div class="wrap">
    <a class="brand" href="home.html" aria-label="Zenstra home">
      <svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="zg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12b0f0"/><stop offset="1" stop-color="#0c6eb4"/></linearGradient></defs><path fill="url(#zg)" d="{STAR}"/></svg>
      <span>ZENSTRA</span>
    </a>
    <ul class="nav" aria-label="Primary">
{nav}    </ul>
    <div class="head-actions">
      <button class="theme-toggle" data-theme-toggle aria-label="Switch between light and dark theme">
        <svg class="moon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z"/></svg>
        <svg class="sun" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1"/></svg>
      </button>
      <a class="btn btn-ghost btn-sm signin" href="console.html">Sign in</a>
      <a class="btn btn-primary btn-sm" href="demo.html">Request a demo</a>
      <button class="btn btn-ghost btn-sm menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">{icon('menu')}</button>
    </div>
  </div>
</header>
<nav class="mobile-menu" id="mobile-menu" aria-label="Mobile">{groups}<a href="trust.html">Trust center</a><a href="console.html">Sign in</a><a class="btn btn-primary" href="demo.html">Request a demo</a></nav>
'''

def footer():
    cols = ''.join(f'<div><span class="label">{t}</span><ul>' + ''.join(f'<li><a href="{h}">{n}</a></li>' for n, h in links) + '</ul></div>' for t, links in FOOT)
    return f'''<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="home.html"><svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22"><path fill="url(#zg)" d="{STAR}"/></svg><span>ZENSTRA</span></a>
        <p>Runtime security for AI agents: identity, policy and evidence for every autonomous action.</p>
        <a class="btn btn-secondary btn-sm" href="demo.html" style="margin-top:18px">Request a demo</a>
      </div>
      {cols}
    </div>
    <div class="legal"><span>&copy; 2026 Zenstra AI. All rights reserved.</span><a class="status" href="trust.html#status"><i></i>All systems operational</a><span><a href="legal.html#privacy">Privacy</a> &middot; <a href="legal.html#terms">Terms</a> &middot; <a href="legal.html#cookies">Cookies</a> &middot; <a href="legal.html#accessibility">Accessibility</a></span></div>
  </div>
</footer>
'''

def scripts(meta):
    extra = ''.join(f'<script src="assets/{s}"></script>\n' for s in meta.get('scripts', []))
    return f'''<script src="assets/vendor/motion-11.11.13.js"></script>
<script src="assets/vendor/anime-4.0.2.umd.min.js"></script>
<script src="assets/vendor/lenis-1.1.13.min.js"></script>
<script src="assets/zx-core.js"></script>
<script src="assets/site-motion.js"></script>
{extra}</body>
</html>
'''

CTA = '''<section class="band cta" id="demo-cta" aria-labelledby="cta-h">
    <div class="aurora" aria-hidden="true"></div>
    <div class="wrap">
      <div>
        <span class="label eyebrow" data-reveal>Technical demo</span>
        <h2 id="cta-h" data-reveal>Bring one real agent. <br>Leave with the evidence.</h2>
        <ol data-stagger>
          <li><span><b>Connect your agent.</b> Any framework, any model provider.</span></li>
          <li><span><b>Watch a policy stop it.</b> Live injection and exfiltration attempts.</span></li>
          <li><span><b>Keep the ledger.</b> The decision record and a security review pack.</span></li>
        </ol>
      </div>
      <div class="cta-box" data-reveal="scale">
        <span class="label" style="color:var(--band-ink-3)">30 minutes &middot; with a security engineer</span>
        <a class="btn btn-primary" href="demo.html">Request a technical demo {{icon:arrow}}</a>
        <p>No slideware. Runs against your own agent, in your own cloud.</p>
      </div>
    </div>
  </section>'''

def shot(name, alt, cls='shot'):
    from PIL import Image
    w, h = Image.open(os.path.join(OUT, 'assets', 'img', name + '-light.webp')).size
    return (f'<figure class="{cls}"><img class="th-light" src="assets/img/{name}-light.webp" alt="{alt}" width="{w}" height="{h}" loading="lazy" decoding="async">'
            f'<img class="th-dark" src="assets/img/{name}-dark.webp" alt="" width="{w}" height="{h}" loading="lazy" decoding="async"></figure>')

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
    body = body.replace('{{cta}}', CTA)
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
