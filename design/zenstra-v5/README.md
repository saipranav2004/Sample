# Zenstra v5 — home, demo and credit unions

Open `home.html`. Links to pages not redesigned here go to the v3 pages in
`../zenstra/`, so keep both folders side by side.

Brand: Zenstra's own mark, palette (#005aa4, #00a8ef, navy #0a2545) and type
(Sora, Manrope, JetBrains Mono), taken from zenstra.ai.

## Pages

| File | What it is |
|---|---|
| `home.html` | Intro, decision-line hero, three product lines (Workflow Security, Cloud Security, Zenstra EDR), how a decision happens, console, numbers, credit-union band, Trust Center, CTA |
| `credit-unions.html` | Hero with an examination pack that assembles itself, statistics, products mapped to a credit union, where agents run, the gap, eight controls, examination evidence, FAQ, CTA |
| `demo.html` | Agenda with scroll progress and a request form (product choice, work email only, success state), FAQ |

## Motion

- **Intro** (first page of a session, or add `?intro=1`): "Zenstra for workflow
  security → cloud security → EDR" decodes letter by letter, resolves to the
  Zenstra logo, then a light beam splits the screen open. Skippable.
- **Hero**: headline lines revealed by a scanning bar; the product line under
  it decodes in place. Behind it, agent actions stream into a decision line:
  most pass (cyan), some wait for a person (amber), some are stopped (coral).
  The stream is masked away from the text.
- **Products**: expanding panels, each with its own live visual: a workflow
  graph with a blocked hop, a cloud boundary payloads never leave, and a
  device fleet scan that contains a rogue agent.
- **How a decision happens**: a pinned section that scrolls sideways through
  identity, intent, policy and record.
- Console tabs with a scan sweep and scroll tilt, ring gauges, an examination
  pack that ticks itself off, smooth scrolling (Lenis).

Everything pauses off screen, stops under `prefers-reduced-motion`, and
content is never left hidden if a script fails.

## Editing

Page bodies are in `_build/pages/`; shared head, intro, header and footer in
`_build/build.py`. Rebuild with `python3 _build/build.py`.

All figures, names and documents are sample content.
