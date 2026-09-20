# NHI Console — UX decisions and screen validation

This is the plan the implementation follows. It exists so the layout, density
and interaction choices can be argued with before anyone reads a component.

---

## 1. Product archetype

**Security / observability console** — the Wiz, CrowdStrike Falcon, Datadog
family. Chosen over the alternatives because the user's job here is *triage*,
not authoring:

| Archetype | Why not |
|---|---|
| Cloud provider console (AWS/Azure) | Resource-detail-as-full-page loses the operator's place in a 137-row list. Triage is list-centric. |
| Enterprise suite (Salesforce/ServiceNow) | Built around record creation, bulk edit and approval chains. This API is read-only apart from one allowlist write — the chrome would be empty. |
| Modern B2B SaaS (Linear/Stripe) | Too airy for the data volume, and brand lives in the sidebar, which is the wrong place for a console. |

Consequences that follow from the archetype, not from taste:

- **Global top bar carries identity and scope.** Brand, global search, scan
  scope, account context, user. Full width, always visible.
- **Sidebar sits beneath the top bar**, not beside it. It is navigation only —
  no brand, no user chrome.
- **Facet rail on every list screen.** Filters are a persistent left panel with
  live counts, not a row of chips. This is the single biggest behavioural
  difference from the previous build.
- **Breadcrumbs everywhere.** A console is a place you get lost in.
- **Drawer for record detail**, so the list, the filters and the scroll
  position survive inspection.
- **Tables are instruments**: density control, column-level truncation, export
  of what is on screen, sticky header, row-level actions on hover.
- **Posture as a fingerprint, not a tag list** (see §4).

---

## 2. Shell specification

```
┌──────────────────────────────────────────────────────────────────┐
│ [DEEP ALGORITHMS]  ⌘K search…     scan: prod-platform ▾   ☾  DA▾ │  56px, navy, full width
├────────────┬─────────────────────────────────────────────────────┤
│ POSTURE    │ Home › Inventory › Identities                       │  breadcrumb 36px
│  Overview  │ Identity explorer                    [Export] [⟳]   │  title row
│            │ ┌ All ─ Needs attention ─ Admin ─ Stale ─┐          │  view tabs
│ INVENTORY  │ ├──────────┬──────────────────────────────┴───────┐ │
│  Identities│ │ FACETS   │ ▓▓ dense table, sticky head          │ │
│  Credentials│ │ ▸ Class  │ ▸ svc-deploy-0   Human  High   ⋯    │ │
│  Secrets   │ │ ▸ Owner  │ ▸ person.1@…     Service Med    ⋯    │ │
│            │ │ ▸ Posture│                                      │ │
│ EXPOSURE   │ └──────────┴──────────────────────────────────────┘ │
│  Findings  │                                                     │
│  Dismissed │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
   240 → 56px collapsible
```

**Top bar** is navy in both themes and spans the full viewport. Three reasons,
in order of weight: it is the one element that never changes, so it is where
brand belongs; keeping it fixed lets the canvas below flip light/dark without
the product losing its identity; and it separates chrome from data so the data
is the brightest thing on screen. The logo owns the left corner and *every*
control sits in the right corner — search, scan scope, theme, account — so the
bar reads as "identity … tools" rather than as four evenly spaced widgets.

**Sidebar** is a light (or dark-theme) application surface with a hairline
right edge, starting beneath the top bar. Navigation only: no brand, no user
chrome, no search. It should recede, not compete.

Nothing in the top bar is decorative. There is no notification bell, no
activity feed icon, no "what's new" — the API exposes no such data, and a
control that cannot be populated is a lie about the product's capability.

---

## 3. Screen-by-screen validation

Sections 4 and 5 then document the two patterns these screens lean on hardest.

Every screen is answered against the same eleven questions.

### 3.1 Posture (`/posture`)

| Question | Answer |
|---|---|
| Primary goal | "What should I act on before I leave today?" |
| Most visual attention | The exposure-signal list. It is the only element ranked by severity of consequence, so it is the largest panel and sits top-left in reading order. |
| Easiest actions | Drilling into a signal — the whole row is the hit target, and it carries the API filter with it. Refresh and scan scope are one click from anywhere. |
| Progressive disclosure | Signal rationale is always visible (one line); the identities behind it are one click away; a single identity's credentials are two. Nothing is three deep. |
| Reducing clicks | Every counter is a link. There is no "view report" intermediate. Classification slices and credential bars are click-through too. |
| Complex data | Signals as proportional meters against *their own* denominator (MFA against humans, not against everything). Composition as a donut whose legend doubles as the value table. Trend as three small multiples, never a dual axis. |
| No data | Per panel, not per page: "no completed scan yet" on the scope strip; "nothing classified yet" on the donut; "not enough scan history" on the trend; a *positive* state on code exposure, because zero findings is the good outcome. |
| Loading | Metric-strip skeleton with the real tile geometry, donut skeleton with legend rows, bar skeleton, timeline skeleton. Panels resolve independently — a slow scanner never blocks the posture numbers. |
| API failure | Scoped to the failing panel. The scanner has its own diagnosis: a 401 says "not configured" and names the env var, because that is what a 401 actually means here. |
| Validation errors | None — no inputs on this screen. |
| Success states | Refresh dims and restores in place rather than flashing skeletons. No toast for a read. |

### 3.2 Identity explorer (`/identities`)

| Question | Answer |
|---|---|
| Primary goal | "Narrow 137 principals to the handful that are my problem." |
| Most visual attention | The identity name and its risk markers. Classification, owner and trust are supporting columns. |
| Easiest actions | Facet toggles (single click, live counts), then row → drawer. Copy-ARN and open-record surface on row hover. |
| Progressive disclosure | Row → drawer overview → drawer tabs (credentials, service access, consumers, activity), each fetched only when opened. |
| Reducing clicks | Preset view tabs ("Needs attention" = no-MFA ∪ admin ∪ orphaned is *not* expressible in one API call, so presets only combine what the API supports in a single request). Facet counts come from the scan summary, so the operator knows the size of a filter before applying it. |
| Complex data | ARNs truncated at the resource segment with the full value on hover and a copy affordance; posture flags as markers rather than six boolean columns. |
| No data | Two distinct states — "no identities in this scan" (pick another scan) vs. "no identities match these filters" (with a clear-filters action). Conflating them is the common failure. |
| Loading | Row skeletons using the real column template. A filter change dims existing rows instead of collapsing the table, so the operator keeps their place. |
| API failure | Full-panel error with retry, because a failed list has nothing partial worth showing. |
| Validation errors | Search is free-text and cannot fail. The ARN filter on Activity states that it matches exactly, because a partial ARN silently returns nothing. |
| Success states | Not applicable — read-only screen. |

### 3.3 Credential register (`/credentials`)

| Question | Answer |
|---|---|
| Primary goal | "Which credentials need rotating?" |
| Most visual attention | Credential type + severity, then age/last-used. |
| Easiest actions | Severity and type facets; row → drawer for the full record. |
| Progressive disclosure | Flat row → drawer with credential, holder and description. |
| Reducing clicks | Flattened one-row-per-credential, so no identity expansion step. Type facet options are generated from the scan's own breakdown. |
| Complex data | Last-used shown as relative time with the service beneath it — "4 months ago · s3.amazonaws.com" answers the rotation question in one line. |
| No data | "No credentials in this scan" vs. filtered-empty, as above. |
| Loading | Column-matched row skeletons. |
| API failure | Panel error with retry. |
| Validation errors | n/a |
| Success states | n/a |

### 3.4 Code exposure (`/exposure`)

| Question | Answer |
|---|---|
| Primary goal | "Triage leaked secrets, and clear the noise." |
| Most visual attention | Risk tier and detector; then repository and author, because those determine who fixes it. |
| Easiest actions | Platform tabs, risk facet, and the row-level menu with "Open in AWS/GitHub" — the actual next step is always in the source system. |
| Progressive disclosure | Row → drawer with the masked value, location, attribution, assessment; the dismiss form only appears after intent is signalled, and requires a second confirm. |
| Reducing clicks | Grouped "by push" view, because one commit routinely introduces several secrets and triaging them as N unrelated rows wastes the reviewer's time. |
| Complex data | The whole live set arrives in one response, so search, sort, filter and grouping are client-side — sorting is offered *here and nowhere else*, because elsewhere it would sort one server page and misrepresent the order. |
| No data | Positive state: "no secrets exposed in code", with a link to the dismissed view so zero is never ambiguous. |
| Loading | Metric strip + table skeletons. |
| API failure | 401 → "not configured", with the reason the key is server-side. Network → proxy diagnosis. Neither pretends to be a permissions problem. |
| Validation errors | Dismiss reason is optional and length-capped; the four identifying fields are copied verbatim from the finding, never re-typed. |
| Success states | Optimistic removal from the list, one toast naming the file, and a pointer to where it can be restored. The undo path is a real endpoint, not a promise. |

### 3.5 Sign-in (`/login`)

Layout follows the supplied design exactly: the navy canvas runs edge to edge
and the credential card floats on top of it at the right. It is not a split
layout, and the card is not a panel on a light half.

| Question | Answer |
|---|---|
| Primary goal | Get in, on the first attempt. |
| Most visual attention | The two fields and the submit button. |
| Easiest actions | Username is auto-focused; Enter submits. |
| Progressive disclosure | Nothing to disclose — the form is two fields. |
| Reducing clicks | No "remember me", no SSO button, and **no password-reset link**: no endpoint backs any of them, and a dead control on a sign-in screen is worse than its absence. |
| Complex data | n/a |
| No data | n/a |
| Loading | Button enters a pending state; the form stays interactive-disabled rather than being replaced. |
| API failure | The service's own message is surfaced, and the password field is cleared while the username is kept. |
| Validation errors | Inline, per field, on submit — not on blur, which punishes people who tab through. `aria-invalid` plus a described error, never colour alone. |
| Success states | Navigation is the confirmation. No success toast on sign-in. |

---

## 4. The posture fingerprint

The first build showed posture as a variable-length row of coloured tags —
"No MFA", "Admin", "Orphaned". It is the weakest pattern in a dense table:
the tags move horizontally from row to row, so nothing lines up, long rows
wrap, and the column cannot be read vertically at all.

It is replaced by five checks in a **fixed order**, one slot each:

| # | Check | Fails when | Source fields |
|---|---|---|---|
| 1 | MFA | a human identity has MFA off (not applicable to non-human) | `mfa_enabled`, `classification` |
| 2 | Privilege | an administrator-equivalent policy is attached | `is_admin` |
| 3 | Ownership | the owner is `ORPHANED`, or no owner resolves (amber) | `owner_type`, `owner_name`, `primary_owner`, `created_by_name` |
| 4 | Activity | last active > 90 days (amber at 30–90, grey if never) | `last_active` |
| 5 | Secret store | credentials sit in a secret store entry (amber) | `is_secret` |

Because the slots never move, a column of fingerprints reads **down** the
page: an operator sees that slot two is red for twelve consecutive rows and
knows privilege is the systemic problem. That is impossible with tags.

Red = failing · amber = needs review · green = clear · grey = not applicable.
The badge beside the strip counts failing checks — `2 issues` is a count, not
a score. **No risk number is invented**; there is no weighting, no 0–100, and
no letter grade, because the backend supplies none and a fabricated score is
the most dangerous kind of fake analytics.

The column header carries the legend, so the pattern is self-explanatory
without documentation, and each row exposes the full per-check reasoning as
its accessible label and tooltip.

## 5. The facet rail

Filters are a persistent left panel, not a row of chips, because the operator
is refining continuously rather than setting a filter once. Every option
carries a **count drawn from a real aggregate** — the scan summary for
identities and credentials, the live finding set for code exposure — so the
size of a filter is known before it is applied. `has_credentials` is the one
facet with no counterpart counter on the summary endpoint, and it simply shows
no number rather than an estimate.

**View tabs** above the rail are single-parameter presets that *replace* the
current filters; the rail then refines additively. Each preset maps to exactly
one API parameter, so "Needs attention" as a union of no-MFA ∪ admin ∪
orphaned is deliberately absent — it would need three requests merged
client-side, and the pagination and counts would then be wrong.

---

## 6. Motion inventory

Every animation below has a stated job. Anything that failed to earn one is
not in the product.

| Motion | Job | Duration |
|---|---|---|
| Panel stagger on mount | Establishes reading order top-left → bottom-right | 420ms, 55ms step |
| Metric count-up | Signals the number is freshly computed; re-runs when the scan scope changes | 620ms |
| Meter / proportion grow | Reads as a measurement being taken rather than a static bar | 900ms |
| Donut progressive sweep + hover segment lift | Connects legend row to slice without a click | 720ms / 160ms |
| Synchronised crosshair across the three trend charts | Lets one hover compare identities, events and secrets at the same scan | instant |
| Sparkline reveal on KPI hover | Adds history to a headline number, only for the three measures scan history actually carries | 240ms |
| Row hover accent + action reveal | Confirms the hit target and surfaces row actions without permanent clutter | 100ms |
| Sliding tab indicator | Shows which of several sibling views you moved to | 260ms |
| Drawer slide + backdrop blur | Preserves the sense that the list is still there behind it | 340ms |
| Refresh dim | Distinguishes a background refresh from a first load | 200ms |

All of it is disabled under `prefers-reduced-motion`, and no animation blocks
input.

---

## 7. Deliberately absent

Listed so their absence reads as a decision rather than an omission.

- **Notifications, alerts, assignment, comments, tickets** — no endpoints.
- **Bulk actions** — the API has one write, scoped to a single allowlist entry.
- **Saved views with server persistence** — nowhere to persist them. Preset
  view tabs cover the same need honestly.
- **Password reset, "remember me", SSO** — no endpoints.
- **A numeric risk score or letter grade** — nothing in the API supports one,
  and inventing a weighting would be fabricated analytics dressed as fact.
- **Bulk export of a whole table** — no export endpoint and no unbounded page
  size, so the control says "Export page"/"Export view" and means it.
- **Sorting on server-paginated tables** — would sort one page and imply a
  global order.
- **"Critical" risk tier in code exposure** — the guide states it cannot
  currently occur; tiles are generated from the tiers actually present.
- **Any claim about whether a secret is live** — `verification_status` is
  always `UNSUPPORTED`, and the UI says "not checked", not "safe".
