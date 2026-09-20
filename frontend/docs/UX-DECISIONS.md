# NHI Console - UX decisions and screen validation

The plan the implementation follows. Revision 3: acts on review feedback about
the shell, the posture column, and the six screens that had not yet had a
proper design pass.

---

## 1. Product archetype

**Security / observability console** - the Wiz, CrowdStrike Falcon, Datadog
family. Chosen because the user's job here is *triage*, not authoring.

| Archetype | Why not |
|---|---|
| Cloud provider console (AWS/Azure) | Resource-detail-as-full-page loses the operator's place in a 137-row list. |
| Enterprise suite (Salesforce/ServiceNow) | Built for record creation, bulk edit, approval chains. This API has one write. |
| Modern B2B SaaS (Linear/Stripe) | Too airy for the data volume, and brand in the sidebar is wrong for a console. |

---

## 2. Shell specification (revised)

```
┌──────────────────────────────────────────────────────────────────┐
│ [DEEP ALGORITHMS]                        [ Search  ⌘K ]   (DA)  │  56px, follows theme
├────────────┬─────────────────────────────────────────────────────┤
│ NHI        │ ‹  Home › Code exposure › Findings   [prod ▾ scan]  │  40px context row
│ DISCOVERY ⟨│─────────────────────────────────────────────────────│
│            │ Secret findings                  [Export] [Refresh] │  title strip
│ POSTURE    │ ┌ All ─ GitHub ─ CodeCommit ┐                       │  view tabs
│  Overview  │ ├──────────┬────────────────┴────────────────────┐   │
│ INVENTORY  │ │ FILTERS  │ records                             │   │
│  ...       │ └──────────┴─────────────────────────────────────┘   │
└────────────┴─────────────────────────────────────────────────────┘
```

Three changes from revision 2, each one a correction:

**The top bar follows the theme.** It was permanently navy. In light mode it is
now a white surface with a hairline base and the dark wordmark; in dark mode
navy with the light wordmark. A permanently dark bar in a light product reads
as a marketing header, not as application chrome.

**The top bar holds exactly three things.** Logo in the left corner; a search
pill and the account avatar in the right corner. Nothing else. Specifically:

- *Search* is a proper pill - icon, the word "Search", a ⌘K chip - sized so it
  reads as a control rather than a cramped afterthought. The command palette
  behind it is the real surface.
- *The account* is the avatar alone. No name, no role, no job title strung out
  across the chrome. That is how Google, Atlassian and GitHub do it, and for a
  good reason: the name is not information the operator needs while working, it
  is information they need when they wonder *who am I signed in as*. So it
  lives inside the menu, with email, role and team.
- *Appearance* (Light / Dark / System) moved into that menu as a three-way
  control. A bare theme toggle in the chrome spends a permanent slot on a
  setting people change twice a year.

**Scan scope moved out of the top bar into a context row**, beside the
breadcrumb. Scope is not global chrome - it is a statement about the data on
*this* screen, so it belongs next to the words that say which screen that is.
The same row carries a **back control**, because a console is a place people
navigate into and the browser button is not a UI.

**The sidebar is titled.** A module header - "NHI DISCOVERY" - sits at the top
with the collapse control beside it, which is where an operator reaches for it.
The old footer ("138 identities in scope") is gone: it restated a number the
page already showed, and filler dressed as telemetry is not enterprise.

**Typography note.** Em and en dashes are replaced with plain hyphens
throughout the interface.

---

## 3. Status, not a fingerprint

Revision 2 rendered posture as five fixed colour slots. It optimised for an
expert scanning a long column and ignored the first-time reader, who has to
learn a legend before the column means anything. In a product where the
operator may open one screen a week, that is a failure.

**Replaced by one status and one reason, in words.**

```
● Critical    MFA disabled  +1 more
● Attention   Dormant 47 days
● Healthy     All checks clear
```

- **One dot, three states** - Critical, Attention, Healthy (plus Unknown when
  nothing was recorded). Three colours total, from the reserved status palette.
- **The leading reason is written out**, so no legend is required. When more
  than one check fails, `+N more` follows, and the full list is the tooltip and
  the accessible label.
- The underlying five checks are unchanged and still documented below - they
  now drive a sentence instead of a bar chart.

| Check | Critical when | Attention when | Source |
|---|---|---|---|
| MFA | human identity with MFA off | - | `mfa_enabled`, `classification` |
| Privilege | admin-equivalent policy attached | - | `is_admin` |
| Ownership | owner type is `ORPHANED` | no owner resolves | `owner_type`, `owner_name`, `primary_owner`, `created_by_name` |
| Activity | last active over 90 days | 30-90 days | `last_active` |
| Secret store | - | credentials in a secret entry | `is_secret` |

Still no score. No 0-100, no letter grade, no weighting: the API supplies none,
and a fabricated score is the most dangerous kind of fake analytics because
people act on it.

---

## 4. Counting without lying

Several screens want totals the summary endpoint does not carry - credentials
by severity, secret-backed identities that are also admin. Rather than compute
them from the loaded page and present them as global figures, the console asks
the API: the same list endpoint with the filter applied and `page_size=1`,
reading `total_count` off the envelope. Cheap, exact, and it cannot drift from
the list it labels.

Where even that is impossible - "mutating vs read-only events", which no
parameter filters - the figure is **either omitted or explicitly scoped**
("in view", "on this page"). A number whose scope is ambiguous is worse than no
number.

---

## 5. Screen-by-screen validation

Every screen answered against the same eleven questions.

### 5.1 Posture (`/posture`)

| Question | Answer |
|---|---|
| Primary goal | "What should I act on before I leave today?" |
| Most attention | The exposure-signal list - the only element ranked by consequence. |
| Easiest actions | Whole signal rows are links carrying the API filter. Scope and refresh are one click. |
| Progressive disclosure | Signal reason always visible; identities one click; a record's credentials two. |
| Fewer clicks | Every counter is a link. Classification slices and credential bars drill through too. |
| Complex data | Signals as meters against *their own* denominator. Composition as a donut whose legend is the value table. Trend as three small multiples, never a dual axis. |
| No data | Per panel: no completed scan, nothing classified, not enough history, and a *positive* state for zero findings. |
| Loading | Metric, donut, bar and timeline skeletons with the real geometry. Panels resolve independently. |
| API failure | Scoped to the failing panel; the scanner diagnoses its own 401 as "not configured". |
| Validation | No inputs. |
| Success | Refresh dims and restores in place. No toast for a read. |

**Analytics motion**: one hover moves a **synchronised crosshair across all
three trend charts**, so identities, events and secrets are compared at the
same scan without three separate hovers. KPI tiles reveal a **sparkline of
that measure across scan history** on hover - only for the three measures scan
history actually carries. Donut segments lift on hover and the centre swaps to
the hovered category.

### 5.2 Identity explorer (`/identities`)

| Question | Answer |
|---|---|
| Primary goal | Narrow 137 principals to the handful that are mine to fix. |
| Most attention | Identity name, then its status sentence. |
| Easiest actions | Facet toggles with live counts; row opens a drawer; copy-ARN on hover. |
| Progressive disclosure | Row - drawer overview - drawer tabs, each fetched on first open. |
| Fewer clicks | Single-parameter view presets; facet counts sized before applying. |
| Complex data | ARNs truncated at the resource segment with full value on hover; posture as a sentence. |
| No data | "None in this scan" and "none match these filters" are different states with different actions. |
| Loading | Column-matched row skeletons; a filter change dims rows instead of collapsing the table. |
| API failure | Full-panel error with retry. |
| Validation | Search cannot fail. |
| Success | Read-only screen. |

### 5.3 Credential register (`/credentials`)

Goal: **decide what to rotate.** The redesign is built around credential age,
which the previous version buried.

- **KPI strip**: total credentials and distinct types from the summary; counts
  per severity from four exact count queries (§4).
- **Severity distribution** as a proportional bar with drill-through, so the
  rotation queue is visible before any filtering.
- **Age column** - days since `created_at`, with a bar scaled against the
  oldest credential in view, because "how overdue is this" is the question.
- **Last used** as relative time over the consuming service, answering "is
  anything still calling it".
- Facet rail: credential type (summary counts), severity (exact counts).
- Row action: copy credential id. Drawer: full record plus its holder.
- Empty states distinguish "no credentials in this scan" from "none match".

### 5.4 Secret-backed identities (`/secrets`)

Goal: **the identities where a leaked secret grants working access.** The
`/api/secrets` endpoint accepts only a search term, so this screen reads
`/api/identities` with `is_secret=true` **locked on** - the same records, with
the full facet vocabulary available for refinement. The lock is shown as a
non-removable chip so the scoping is never invisible.

- **Cross-section KPIs from exact count queries**: secret-backed *and* admin,
  *and* without MFA, *and* stale. Those intersections are the actual risk, and
  the API supports every combination in one request.
- Table: the identity row design, with status.

### 5.5 Code exposure (`/exposure`)

| Question | Answer |
|---|---|
| Primary goal | Triage leaked secrets, clear the noise. |
| Most attention | Risk tier and detector, then repository and author - who fixes it. |
| Easiest actions | Platform tabs, risk facet, row menu with "Open in AWS/GitHub" - the fix is always in the source system. |
| Progressive disclosure | Row - drawer; the dismiss form appears only after intent and needs a second confirm. |
| Fewer clicks | Grouped "by push" view, because one commit routinely leaks several secrets. |
| Complex data | Whole live set arrives in one response, so sort/filter/group are client-side - the only place sorting is honest. |
| No data | Positive state, with a link to the dismissed view so zero is never ambiguous. |
| Loading | Metric strip and table skeletons. |
| API failure | 401 - "not configured", naming the env var. Network - proxy diagnosis. |
| Validation | Reason optional, length-capped; the four identifying fields are copied verbatim. |
| Success | Optimistic removal, one toast naming the file, and where to restore it. |

### 5.6 Dismissed findings (`/exposure/dismissed`)

Goal: **audit what was accepted, and undo mistakes.** Previously a bare table.

- **KPI strip** computed from the full allowlist the service returns: entries,
  distinct detectors, distinct reviewers, oldest entry. All exact - the whole
  set is client-side.
- **Facet rail**: detector, reviewer, and whether a reason was recorded -
  because an entry dismissed with no reason is the audit risk.
- **Two views**: a table, and a **review timeline** grouped by dismissal day,
  which is how an auditor reads this.
- Restore stays a confirmed action, and states the service's own caveat: the
  finding returns only if the scanner still holds the record.

### 5.7 API activity (`/activity`)

Goal: **what did these identities actually do.** 

- **Scan-level totals** from the scan record (exact), never derived from a page.
- **"Shape of recent activity"** panel over the loaded window, labelled with
  the window size, splitting mutating from read-only and naming the top event
  sources. Page-scoped and *said to be* page-scoped.
- **Two views**: a dense table, and the event **timeline**, which is the better
  read for a single identity's history.
- Exact-ARN filter, labelled as exact, because a partial value silently
  matches nothing. Arriving from an identity's Activity tab fills it in.

### 5.8 Discovery scans (`/scans`)

Goal: **pick the snapshot, and see what changed.**

- **Change since the previous scan** - identities, events, secrets - computed
  from the ordered scan list. Real arithmetic on real records, and the most
  useful thing this endpoint can say.
- **Trend** across completed scans, as small multiples.
- Table: status, totals, duration, delta, and the scope action.
- Selecting a scan here is the same action as the context-row switcher: one
  source of truth for scope.

### 5.9 My resources (`/my-resources`)

Goal: **what is mine, and what is wrong with it.**

- Count from the endpoint's own `total_count`; composition **in view** by
  classification, explicitly labelled.
- Status column, so the screen answers "what is wrong with mine" rather than
  only listing them.
- Empty state explains that ownership is resolved from tags and CloudTrail, so
  the fix is tagging - not a setting in this product.

### 5.10 Sign-in (`/login`)

Navy canvas edge to edge, credential card floating on it at the right. Not a
split layout.

| Question | Answer |
|---|---|
| Primary goal | Get in, first attempt. |
| Most attention | Two fields and the submit button. |
| Easiest actions | Username auto-focused; Enter submits. |
| Progressive disclosure | Nothing to disclose - two fields. |
| Fewer clicks | No "remember me", no SSO, **no password reset**: no endpoint backs any of them. |
| Loading | Button pending; form interactive-disabled, not replaced. |
| API failure | The service's message surfaced; password cleared, username kept. |
| Validation | Inline per field on submit, `aria-invalid` plus described error, never colour alone. |
| Success | Navigation is the confirmation. |

---

## 6. Motion inventory

Every animation has a stated job. Anything that could not earn one is absent.

| Motion | Job | Duration |
|---|---|---|
| Panel stagger on mount | Establishes reading order | 420ms, 55ms step |
| Metric count-up | The number was just computed; re-runs when scope changes | 620ms |
| Meter / proportion grow | Reads as a measurement being taken | 900ms |
| Donut sweep, segment lift on hover | Connects legend row to slice without a click | 720ms / 160ms |
| **Synchronised trend crosshair** | One hover compares three measures at the same scan | instant |
| **KPI sparkline reveal** | Adds history to a headline number, where history exists | 240ms |
| Row hover accent and action reveal | Confirms the hit target without permanent clutter | 100ms |
| Sliding tab indicator | Shows which sibling view you moved to | 260ms |
| Drawer slide, backdrop blur | The list is still there behind it | 340ms |
| Refresh dim | Distinguishes background refresh from first load | 200ms |

All disabled under `prefers-reduced-motion`; none blocks input.

---

## 7. Deliberately absent

- **Notifications, alerts, assignment, comments, tickets** - no endpoints.
- **Bulk actions** - the API has one write, on a single allowlist entry.
- **Server-persisted saved views** - nowhere to persist them.
- **Sorting on server-paginated tables** - would sort one page and imply a
  global order.
- **Password reset, remember-me, SSO** - no endpoints.
- **A numeric risk score or grade** - unsupported, and dangerous if invented.
- **Bulk export** - no export endpoint, so the control says "Export page" or
  "Export view" and means it.
- **Mutating-vs-read-only totals for the whole scan** - no filter exists, so
  the split is shown only over the loaded window and labelled as such.
