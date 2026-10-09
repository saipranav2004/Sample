# Zenstra website and console mockups (v3)

Open `home.html` in a browser. Every link in the header, mega menus, mobile
menu and footer goes to a working page. Everything runs locally; only the
Google Fonts stylesheet is fetched from the network (system fonts are used if
it is unavailable).

## Pages

| File | What it is |
|---|---|
| `home.html` | Homepage: product showcase with real console screens, Trust Center summary |
| `platform.html` | Platform overview and the interactive architecture explorer |
| `discover.html` | Shadow AI discovery, agent inventory and identity, coverage |
| `enforce.html` | Verdicts, tool access, injection and memory defense, policy as code, approvals |
| `prove.html` | Decision ledger, runtime detection, investigations, evidence packs |
| `solutions.html` | By industry (banking, healthcare) and by agent type |
| `credit-unions.html` | Credit union programme |
| `resources.html` | Documentation, filterable library with search, glossary, newsletter |
| `trust-center.html` | Trust Center (security, privacy and compliance): verifiable certifications, privacy agreements, data handling, security practices, subprocessors, documentation (SOC 2 report under NDA), service status, disclosure |
| `company.html` | About, leadership, careers, newsroom, contact |
| `demo.html` | Technical demo request (validated form, success state) |
| `legal.html` | Privacy, terms, cookies, accessibility |
| `console.html` | Product console (unchanged in v3) |

## Editing pages

Marketing pages are generated so the header, menus and footer stay identical
everywhere. Edit the page bodies in `_build/pages/*.html` and the shared parts
in `_build/build.py`, then run:

```
python3 _build/build.py
```

The first line of each page body is a JSON comment with its title,
description, active menu and extra scripts. `{{icon:name}}`,
`{{shot:image|alt text}}` and `{{cta}}` are expanded at build time.

## Assets

| File | What it is |
|---|---|
| `assets/zx.css` | Design tokens (light + dark), core components |
| `assets/site.css` | Header, mega menus, hero, bands, footer |
| `assets/pages.css` | Shared page components (features, tables, forms, modals, trust center, status, resources) |
| `assets/zx-core.js` | Theme switching and motion preferences |
| `assets/site-motion.js` | Site motion and interactions |
| `assets/arch.js` | Platform architecture explorer and comparison diagrams |
| `assets/img/` | Console screenshots in light and dark (WebP) |
| `assets/vendor/` | Motion 11.11.13, anime.js 4.0.2, Lenis 1.1.13 (MIT) |

## Themes and motion

Light and dark on every page. The first visit follows the operating system;
the sun/moon button switches and remembers the choice.

Motion includes a loading sequence, smooth scrolling, a hero network animation
kept to the right of the text, scroll reveals, a product showcase that cycles
through console screens, live ledger and status bars,
and an architecture explorer that walks one tool call through each deployment
mode. All motion stops under `prefers-reduced-motion`, and content is never
left hidden if a script fails.

All figures, names and documents are sample content.
