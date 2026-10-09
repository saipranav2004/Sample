# Zenstra v4 — motion-led redesign (home, demo, credit unions)

Open `home.html`. Pages not yet redesigned link to their v3 versions in
`../zenstra/`, so keep both folders side by side.

| File | What it is |
|---|---|
| `home.html` | Typed hero over the particle ring, scroll-typed statement, agent coverage wave, sticky product explorer (Discover, Enforce, Prove, Respond), morphing "how it works", numbers, Trust Center strip, audience cards, CTA |
| `demo.html` | Typed hero, agenda with scroll progress, request form with validation and success state, FAQ |
| `credit-unions.html` | Typed hero with rotating outcome, sector statistics, where agents already run, vendor defaults vs Zenstra, eight controls, examination explorer, how it connects, FAQ, CTA |

## Editing

Page bodies live in `_build/pages/`. The shared head, intro, header and
footer are in `_build/build.py` (it reuses the icon set from the v3
generator). Rebuild with:

```
python3 _build/build.py
```

## Motion

- **Intro** (first page of a session, or add `?intro=1`): "Zenstra for credit
  unions / banks / healthcare" with a blur word swap, then the page fades in.
  Skippable by click or any key.
- **Hero**: the headline types itself behind a gradient caret; the line under it
  rotates with a blur swap. Behind it, a WebGL field of small dashes lights up
  around a slow ring that drifts and follows the pointer gently. A soft mask
  keeps the particles faint behind the headline.
- **Scroll**: a statement that types as you scroll, a wave of agent bubbles,
  descriptions that fade in letter by letter, a sticky product explorer with a
  glowing frame, particles that morph into a radar, a shield and a hash chain,
  rippling dot fields on the audience cards, and a footer star that rises.
- Smooth scrolling with Lenis. Everything pauses off screen, stops under
  `prefers-reduced-motion`, and content is never left hidden if a script fails.

Assets: `assets/v4.css`, `assets/v4.js`, `assets/particles.js`,
`assets/vendor/lenis-1.1.13.min.js`, `assets/img/` (console screenshots).
Fonts: Geist and Geist Mono from Google Fonts.

All figures, names and documents are sample content.
