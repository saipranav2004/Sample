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
    ('flow', 'Workflow Security', 'Every hop in every agent workflow', 'workflow-security.html'),
    ('cloud', 'Cloud Security', 'Runtime protection in your cloud', 'cloud-security.html'),
    ('scan', 'Zenstra EDR', 'Detection and response for AI on endpoints', 'edr.html'),
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
<script>(function(){{var r=document.documentElement;r.classList.add('js');try{{var t=localStorage.getItem('zx-theme');if(t)r.setAttribute('data-theme',t);}}catch(e){{}}var red=matchMedia('(prefers-reduced-motion: reduce)').matches;if(red)r.classList.add('reduce');var seen=false;try{{seen=sessionStorage.getItem('zx6-intro')==='1';}}catch(e){{}}if(!red&&((!seen&&!location.hash)||/[?&]intro=1/.test(location.search)))r.classList.add('intro-play');setTimeout(function(){{if(!window.__v6ok){{r.classList.remove('intro-play');r.classList.add('reveal-all');}}}},7000);}})();</script>
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
      <div class="dd"><button class="nav-link dd-btn{' is-current' if active == 'products' else ''}" type="button" aria-expanded="false" aria-controls="dd-products">Products {icon('chev')}</button>
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


# Compliance badges, shared by the home and company pages. Names and
# descriptions as Deep Algorithms publishes them; "kind" says what each one
# is, since HIPAA and GDPR are laws a programme complies with, not certificates.
CERTS = [
    ('iso', '27001', 'ISO 27001', 'Information Security Management', 'Certified'),
    ('soc2', '', 'SOC 2 Type II', 'Security, Availability & Confidentiality', 'Audit report'),
    ('hipaa', '', 'HIPAA', 'Health Data Privacy & Security', 'Compliance programme'),
    ('gdpr', '', 'GDPR', 'EU General Data Protection Regulation', 'Compliance programme'),
    ('iso', '42001', 'ISO/IEC 42001:2023', 'Artificial Intelligence Management System (AIMS)', 'Certified'),
    ('iso', '27701', 'ISO/IEC 27701:2025', 'Privacy Information Management', 'Certified'),
]


def badge(kind, num):
    import math
    if kind == 'iso':
        art = ('<circle class="o" cx="32" cy="32" r="30"/><circle class="d" cx="32" cy="32" r="25.5"/><circle class="i" cx="32" cy="32" r="21"/>'
               f'<text class="t" x="32" y="29.5" text-anchor="middle">ISO</text><line class="ln" x1="19" y1="34" x2="45" y2="34"/><text class="s" x="32" y="42.5" text-anchor="middle">{num}</text>')
    elif kind == 'soc2':
        art = ('<rect class="o" x="3" y="3" width="58" height="58" rx="17"/><rect class="d" x="7.5" y="7.5" width="49" height="49" rx="13"/><rect class="i" x="12" y="12" width="40" height="40" rx="10"/>'
               '<text class="t" x="32" y="31" text-anchor="middle">SOC 2</text><text class="s" x="32" y="41" text-anchor="middle">TYPE II</text>')
    elif kind == 'hipaa':
        art = ('<path class="o" d="M32 2.5 57 11.5V30c0 15.5-10.6 26.4-25 31.5C17.6 56.4 7 45.5 7 30V11.5Z"/>'
               '<path class="i" d="M32 9.5 51 16.4V30c0 11.7-7.8 20.2-19 24.6C20.8 50.2 13 41.7 13 30V16.4Z"/>'
               '<text class="t sm" x="32" y="35" text-anchor="middle">HIPAA</text>')
    else:
        stars = ''.join(f'<circle class="st" cx="{32 + 24 * math.cos(math.radians(k * 30 - 90)):.2f}" cy="{32 + 24 * math.sin(math.radians(k * 30 - 90)):.2f}" r="1.9"/>' for k in range(12))
        art = ('<circle class="o" cx="32" cy="32" r="30"/><circle class="i" cx="32" cy="32" r="19"/>' + stars +
               '<text class="t sm" x="32" y="35.5" text-anchor="middle">GDPR</text>')
    return f'<svg viewBox="0 0 64 64" aria-hidden="true">{art}</svg>'


def certs():
    cells = ''.join(f'<div class="cert" data-reveal data-delay="{(i % 3) * 70}">{badge(k, n)}<b>{label}</b><small>{sub}</small><span class="kind">{kind}</span></div>'
                    for i, (k, n, label, sub, kind) in enumerate(CERTS))
    return f'<div class="certs">{cells}</div>'


# Product pages: one template, content from zenstra.ai and the home panels.
PRODUCT_PAGES = {
    'workflow': dict(
        icon='flow', name='Workflow Security', full='Zenstra Workflow Security', viz='workflow', interest='workflow',
        h1=('Every hop in every', 'agent workflow,', 'decided.'),
        lede='Multi-agent pipelines fail one hop at a time. Zenstra checks each hop against policy and the task the workflow declared, before the next step runs.',
        caps=[('grid', 'Workflow graph', 'Every agent, tool and MCP hop in n8n, Zapier, LangGraph and CrewAI, mapped and owned.'),
              ('hand', 'Per-hop decisions', 'Allow, hold for a person, or block before the next step executes.'),
              ('target', 'Intent across agents', 'Agent-to-agent hand-offs checked against the original task.'),
              ('eye', 'Shadow automation', 'Unregistered agents and no-code workflows surfaced with the owner and the detection signal.')],
        steps=[('Connect', 'Register workflows, agents, MCP servers and A2A peers through the SDK, proxy or gateway.'),
               ('Monitor', 'Zenstra learns each workflow\'s normal path, tools and data reach.'),
               ('Detect', 'Injection, escalation, poisoning and identity anomalies are scored in real time.'),
               ('Enforce', 'Allow, step up to a person, or block and quarantine before the hop lands.')],
        works=['n8n', 'Zapier', 'LangGraph', 'CrewAI', 'Copilot Studio', 'MCP', 'A2A'],
        shot=('screen-investigation', 'Investigation showing the outcome, blast radius and the full agent run', 'An investigation opens on the outcome, the blast radius and the agent run.'),
        faq=[('Do we have to rebuild our workflows?', 'No. Zenstra connects through the SDK, a proxy or the gateway, with no agent rewrite.'),
             ('What happens when a hop is blocked?', 'The next step does not run. The decision, the policy that made it and the full run are recorded.'),
             ('Does it slow workflows down?', 'Decisions are made inline in 18 ms at p95.')]),
    'cloud': dict(
        icon='cloud', name='Cloud Security', full='Zenstra Cloud Security', viz='cloud', interest='cloud',
        h1=('Runtime protection,', 'inside your cloud.'),
        lede='A gateway in your VPC or Kubernetes cluster sits in front of every MCP server, model and API your agents call. Payloads never leave your environment.',
        caps=[('plug', 'Gateway for MCP and APIs', 'Deployed with Helm or Terraform in AWS, Azure or Google Cloud.'),
              ('key', 'Scoped credentials', 'Per-agent identity and short-lived grants for Bedrock, Azure OpenAI and Vertex AI.'),
              ('lock', 'Context vault', 'Scoped secrets and retrieved context, never raw.'),
              ('shield', 'Fail-closed, fast', 'Decisions at 18 ms p95. If Zenstra is unreachable, actions are held.')],
        steps=[('Deploy', 'Install the gateway in your VPC or cluster with Helm or Terraform.'),
               ('Register', 'Agents, MCP servers and models get an identity and scoped, expiring grants.'),
               ('Enforce', 'Guardrails as code, evaluated on every call.'),
               ('Record', 'A tamper-evident trail with live risk scoring.')],
        works=['AWS', 'Azure', 'Google Cloud', 'Kubernetes', 'Amazon Bedrock', 'Azure OpenAI', 'Vertex AI', 'MCP'],
        shot=('screen-agent', 'Agent profile with identity, scoped grants, expiry and last use', 'One agent\'s identity, grants, baseline and history.'),
        faq=[('Does our data leave our cloud?', 'No. The gateway runs in your VPC or Kubernetes cluster, and payloads never leave your environment.'),
             ('What if the gateway is unavailable?', 'It fails closed: actions are held, never waved through.'),
             ('Which clouds and models are supported?', 'AWS, Azure and Google Cloud, including Amazon Bedrock, Azure OpenAI and Vertex AI.')]),
    'edr': dict(
        icon='scan', name='Zenstra EDR', full='Zenstra EDR', viz='edr', interest='edr',
        h1=('Detection and response', 'for AI agents', 'on every endpoint.'),
        lede='Classic EDR sees a coding agent read credentials and cannot tell help from hijack. Zenstra EDR sees the prompt, the tool call and the device together.',
        caps=[('device', 'Every AI, every device', 'Copilot, ChatGPT, Claude Code, Cursor and unregistered agents on Windows and macOS.'),
              ('flow', 'Context, not noise', 'Prompt-to-action lineage tells a helpful agent from a hijacked one.'),
              ('hand', 'Contain in seconds', 'Stop one agent on one device.'),
              ('eye', 'Shadow AI discovery', 'Unsanctioned AI tools and agents detected, and your team alerted, the moment one appears.')],
        steps=[('Deploy', 'Roll out through the device management you already run: Intune, Jamf or Kandji.'),
               ('Discover', 'Every AI tool and agent on every device, with its owner.'),
               ('Detect', 'Hijacks caught from the prompt, the tool call and the device together.'),
               ('Contain', 'Stop the agent, not the person or the machine.')],
        works=['Windows', 'macOS', 'Microsoft Intune', 'Jamf', 'Kandji', 'Microsoft Copilot', 'ChatGPT', 'Claude Code', 'Cursor'],
        shot=('screen-detections', 'Detections queue ranked by severity, with the agent and the policy that caught each one', 'Detections ranked by severity, with the agent and the policy that caught them.'),
        faq=[('How is it deployed?', 'Through the device management you already run: Microsoft Intune, Jamf or Kandji.'),
             ('Which AI tools does it see?', 'Copilot, ChatGPT, Claude Code, Cursor and unregistered agents, on Windows and macOS.'),
             ('Can it stop one agent without stopping the device?', 'Yes. Containment stops one agent on one device.')]),
}


def productpage(key):
    d = PRODUCT_PAGES[key]
    caps = ''.join(f'<div class="pp-cap" data-reveal data-delay="{i * 60}"><span class="ic">{icon(ic)}</span><b>{t}</b><p>{x}</p></div>' for i, (ic, t, x) in enumerate(d['caps']))
    steps = ''.join(f'<li data-reveal data-delay="{i * 60}"><span class="n">0{i + 1}</span><b>{t}</b><p>{x}</p></li>' for i, (t, x) in enumerate(d['steps']))
    works = ''.join(f'<span>{w}</span>' for w in d['works'])
    faq = ''.join(f'<details><summary>{q}</summary><div class="a"><p>{a}</p></div></details>' for q, a in d['faq'])
    others = ''.join(f'<a class="pp-other" href="{h}" data-reveal><span class="ic">{icon(i)}</span><span><b>{n}</b><small>{x}</small></span>{icon("arrow")}</a>' for i, n, x, h in PRODUCTS if n != d['name'])
    shot_name, shot_alt, shot_cap = d['shot']
    h1 = ''.join(f'<span class="scanline"><span class="in{" grad" if i else ""}">{t}</span><i class="bar"></i></span>' for i, t in enumerate(d['h1']))
    return f'''<section class="pp-hero rails" aria-labelledby="hero-h">
    <div class="wrap pp-grid">
      <div class="pp-copy">
        <span class="chip-live" data-after><i></i>{d['full']}</span>
        <h1 class="display" id="hero-h" data-scan>{h1}</h1>
        <p class="lede" data-after>{d['lede']}</p>
        <div class="ctas" data-after><a class="btn primary lg" href="demo.html?interest={d['interest']}">Request a demo {icon('arrow')}</a><a class="btn secondary lg" href="home.html#how">How a decision happens</a></div>
      </div>
      <div class="pp-visual" data-after><div class="pp-viz" data-pviz="{d['viz']}" aria-hidden="true"></div><span class="pp-badge">{icon(d['icon'])}{d['name']}</span></div>
    </div>
    <div class="wrap pp-facts" data-after>
      <div><b>18 ms</b><span>p95 decision time, inline</span></div>
      <div><b>Fail-closed</b><span>unreachable means held, never waved through</span></div>
      <div><b>No rewrite</b><span>your agents, framework, model and cloud</span></div>
    </div>
  </section>

  <section class="sec" aria-labelledby="cap-h">
    <div class="wrap">
      <div class="sec-head"><span class="eyebrow" data-reveal>Capabilities</span><h2 class="h2" id="cap-h" data-reveal>What {d['name']} does.</h2></div>
      <div class="pp-caps">{caps}</div>
    </div>
  </section>

  <section class="sec alt" aria-labelledby="how-h">
    <div class="wrap">
      <div class="sec-head"><span class="eyebrow" data-reveal>How it works</span><h2 class="h2" id="how-h" data-reveal>Live in four steps.</h2></div>
      <ol class="pp-steps">{steps}</ol>
      <div class="pp-works" data-reveal><span class="mono-label">Works with</span><div class="tags">{works}</div></div>
    </div>
  </section>

  <section class="sec" aria-labelledby="con-h">
    <div class="wrap pp-console">
      <div style="display:grid;gap:18px;align-content:start">
        <span class="eyebrow" data-reveal>In the console</span>
        <h2 class="h3" id="con-h" style="font-size:clamp(26px,2.6vw,36px)" data-reveal>{shot_cap}</h2>
        <a class="link" href="home.html#console" data-reveal>Tour the console {icon('arrow')}</a>
      </div>
      <div class="show-frame pp-shot" data-reveal><div class="show-bar"><i></i><i></i><i></i><span>console.zenstra.ai</span><span class="live">Live</span></div><div class="show-view">{{{{shot:{shot_name}|{shot_alt}}}}}</div></div>
    </div>
  </section>

  <section class="sec alt" aria-labelledby="faq-h">
    <div class="wrap faq">
      <div style="display:grid;gap:18px;align-content:start"><span class="eyebrow" data-reveal>FAQ</span><h2 class="h2" id="faq-h" style="font-size:clamp(28px,3vw,42px)" data-reveal>Questions teams ask first.</h2>
        <p class="pp-comp" data-reveal>ISO 27001 · SOC 2 Type II · ISO/IEC 42001 · ISO/IEC 27701 · <a href="company.html#compliance">Compliance</a></p></div>
      <div data-reveal>{faq}</div>
    </div>
  </section>

  <section class="sec" aria-label="Other products" style="padding-top:clamp(56px,6vw,80px);padding-bottom:0">
    <div class="wrap"><span class="mono-label">Also on the platform</span><div class="pp-others">{others}</div></div>
  </section>

  <section aria-labelledby="cta-h" style="padding:clamp(56px,6vw,80px) 0 clamp(80px,9vw,128px)">
    <div class="wrap">
      <div class="cta">
        <div class="stream" aria-hidden="true"></div>
        <div class="cta-inner">
          <span class="eyebrow" style="color:#5cd2ff" data-reveal>30-minute technical session</span>
          <h2 class="h2" id="cta-h" data-reveal>See {d['name']} on one of your agents.</h2>
          <p data-reveal>A security engineer runs it live against your environment. No slides.</p>
          <div class="ctas" data-reveal><a class="btn white lg" href="demo.html?interest={d['interest']}">Request a demo {icon('arrow')}</a><a class="btn glass lg" href="company.html#contact">Talk to us</a></div>
        </div>
      </div>
    </div>
  </section>'''


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
    body = body.replace('{{certs}}', certs())
    body = re.sub(r'\{\{productpage:([a-z]+)\}\}', lambda x: productpage(x.group(1)), body)
    body = re.sub(r'\{\{options:([A-Za-z]+)\}\}', lambda x: options(x.group(1)), body)
    body = re.sub(r'\{\{icon:([a-z]+)\}\}', lambda x: icon(x.group(1)), body)
    body = re.sub(r'\{\{shot:([a-z0-9-]+)\|([^}]*)\}\}', lambda x: shot(x.group(1), x.group(2)), body)
    # The intro plays only when a visit starts on the home page. Anyone who
    # lands elsewhere (a product page, the demo form) goes straight to it,
    # and is not shown the intro later in the same visit.
    top = head(meta, style)
    if name != 'home':
        top = top.replace("if(!red&&((!seen&&!location.hash)||/[?&]intro=1/.test(location.search)))r.classList.add('intro-play');", "try{sessionStorage.setItem('zx6-intro','1');}catch(e){}")
    html = top + (intro() if name == 'home' else '') + header(meta.get('active', '')) + '<main id="main">\n' + body.strip() + '\n</main>\n' + footer() + scripts(meta)
    with open(os.path.join(OUT, name + '.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    return name


if __name__ == '__main__':
    names = sorted(f[:-5] for f in os.listdir(os.path.join(HERE, 'pages')) if f.endswith('.html'))
    for n in names:
        build(n)
    print('built:', ', '.join(names))
