# Zenstra v6 — motion experiment

A copy of v5 (`../zenstra-v5/`) with three changes, kept separate so the two can
be compared side by side. Open `home.html`. Links to pages not redesigned here
go to the v3 pages in `../zenstra/`.

Type: Hanken Grotesk for headings and text, JetBrains Mono for the technical
voice, Sora only in the logo wordmark. Palette from zenstra.ai.

## What changed from v5

- **Intro** (first page of a session, or add `?intro=1`). The grid is gone. The
  backdrop is plain navy with one soft light, fine grain and a quiet field of
  agents. "Zenstra for workflow security / cloud security / EDR" ripples in
  letter by letter. The line gives way to the logo, every agent converges into
  the mark, and the page opens through a mark-shaped window that grows from it.
  Skippable by click or any key.
- **Home hero.** The pointer is Zenstra's lens. Outside it, agents and their
  calls are anonymous grey traffic. Inside it, each agent and system is named,
  each call passes a checkpoint, and the decision shows where it happens:
  allowed, held for approval, or blocked with the reason. The lens wanders on
  its own when the pointer is still. Credit unions and demo keep the v5 lens.
- **How a decision happens.** A pinned section scrubbed by scroll. One real
  tool call (an injected `email.send` of member records) drops through four
  discs: identity verifies the agent, intent flags the mismatch, policy closes
  like an iris and blocks it, record chains the evidence. Callouts, the matching
  log lines and a millisecond clock follow along. Phones and reduced motion get
  the same four steps as cards.

Everything pauses off screen, stops under `prefers-reduced-motion`, and content
is never left hidden if a script fails.

## Editing

Page bodies are in `_build/pages/`; shared head, intro, header and footer in
`_build/build.py`. Rebuild with `python3 _build/build.py`.

All figures, names and documents are sample content.
