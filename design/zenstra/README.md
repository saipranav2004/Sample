# Zenstra website and console mockups (phase 1, v2)

Open the HTML files directly in a browser. Everything runs locally; only the
Google Fonts stylesheet is fetched from the network (system fonts are used if
it is unavailable).

| File | What it is |
|---|---|
| `home.html` | Homepage |
| `platform.html` | Platform / how it works |
| `console.html` | Product console: `#overview`, `#detections`, `#investigate`, `#agent`, `#deployment` |
| `assets/zx.css` | Design tokens (light + dark), core components, skeletons |
| `assets/site.css` | Marketing layout, header, hero, bands, footer |
| `assets/zx-core.js` | Theme switching (stored per viewer, circular reveal) and motion preferences |
| `assets/site-motion.js` | All marketing-site motion |
| `assets/vendor/` | Motion 11.11.13, anime.js 4.0.2, Lenis 1.1.13 (MIT) |

## Themes
Light and dark on every page. The first visit follows the operating system;
the sun/moon button switches and remembers the choice. The switch animates as
a circular reveal from the button (View Transitions API) where supported.

## Motion
- **Loading:** the Zenstra mark draws itself, the wordmark staggers in, and the
  page wipes open (first page of a session; later pages fade). The console
  shows shimmering skeletons on first visit to each screen, a top progress
  line on every navigation, then panels rise in sequence and numbers count up.
- **Background:** the hero canvas shows agent requests travelling to a policy
  gate: most pass, amber ones are held for a person, red ones are blocked with
  a ring at the gate. A slow glow drifts behind it; the CTA band has a rotating
  aurora and grid.
- **Scroll:** Lenis smooth scrolling, a reading-progress bar, a header that
  hides on the way down, blur-and-rise reveals, staggered groups, highlighter
  sweeps on key phrases, count-up metrics, incident replays that stamp
  BLOCKED / HELD, flowing packets along the architecture wires, the four
  checks lighting up in order, a pinned product tour that changes screens as
  you scroll, and a sequence diagram on the platform page that draws one
  message at a time (with Replay).
- **Live data:** the hero decision ledger streams new rows; the console's
  overview has a live decisions-per-second chart with a sliding 60 s window;
  a new critical detection arrives in the queue with a toast; the
  investigation replays the agent run step by step.
- **Micro-interactions:** button sheen and arrow nudge, mega-menu spring,
  card lift, ledger tilt toward the pointer, accordion height animation.

All motion stops under `prefers-reduced-motion`; content is never left hidden
if a script fails. Background animation pauses when off screen or when the tab
is hidden. The live ledger has a pause button.

All data is sample data for a fictional credit union.
