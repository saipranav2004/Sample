# Zenstra v6 — motion experiment

A copy of v5 (`../zenstra-v5/`) with the changes below, kept separate so the two can
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
- **Home and credit-union heroes.** The pointer is a glass lens: what it
  covers is magnified and a highlight travels round its rim. Outside it,
  agents and their calls are anonymous grey traffic. Inside it, each agent and
  system is named, each call passes a checkpoint, and the decision shows where
  it happens: allowed, held for approval, or blocked with the reason. The lens
  wanders on its own when the pointer is still. The demo page has no
  background animation, so attention stays on the form.
- **How a decision happens: the perimeter.** A pinned section scrubbed by
  scroll. Four rings stand like terraces around a protected core (member data
  and email). One tool call, an injected `email.send` of member records, comes
  in from outside and stops at each gate:
  - identity scans and turns green;
  - intent shows the declared and attempted tasks pulling apart;
  - policy swings its gate shut, and the call is turned back;
  - the evidence goes to the record ring, which fills link by link.

  The core is marked untouched. Callouts, the matching log lines and a
  millisecond clock follow along. Phones and reduced motion get the same four
  steps as cards.
- **Forms are live** (`assets/forms.js`, also used by the trust-center and
  newsletter forms in `../zenstra/`). They post to the lead API in
  `../../zenstra-site/`. Opened from disk, a form explains that it sends only
  when the site runs on its server.

Everything pauses off screen, stops under `prefers-reduced-motion`, and content
is never left hidden if a script fails.

## Editing

Page bodies are in `_build/pages/`; shared head, intro, header and footer in
`_build/build.py`. Rebuild with `python3 _build/build.py`.

All figures, names and documents are sample content.
