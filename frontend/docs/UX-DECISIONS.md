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

---

## 8. Revision: sign-in from measurement, toolbar from the design systems

Seven changes, each with the evidence that drove it.

### 8.1 The sign-in card went dark in Edge - and it was never an Edge bug

Reported as "Edge renders the right panel dark, Chrome renders it correctly".
Chrome was not correct; it was light-themed. The cause was in our CSS:

```css
/* before */
:root                  { --t-surface: #ffffff; /* light palette */ }
:root[data-theme='dark'] { --t-surface: #0c1626; /* dark palette */ }
```

The sign-in card carried `data-theme="light"` to opt out of theme inversion.
That did nothing. The light values existed only on `:root`, so there was no
rule for a nested `[data-theme='light']` to match, and the dark values
inherited straight through it. Anyone whose theme resolved to dark - Edge with
a dark OS, or our own Dark/System setting - got dark fields inside a white
card. Two fixes:

- The light palette is now declared for `:root, [data-theme='light']`, and the
  dark palette for `[data-theme='dark']` (no `:root` prefix), so either palette
  can be re-established on any subtree.
- Both blocks now declare `color-scheme`. Without it the UA picks form-control
  chrome from the OS preference, which is the *other* half of why Edge and
  Chrome disagreed. Declaring `color-scheme: light` on the card's subtree is
  what makes a browser paint light controls there regardless of OS.

The `dark:` variant is also scoped out of light subtrees, or `dark:hidden`
would still fire inside a card that is light in both themes.

Verified: with the root theme dark, the card is `rgb(255,255,255)`, the fields
`rgb(248,250,252)` and the ink `rgb(11,27,46)` - in light, dark and system.

### 8.2 The sign-in screen is measured from the supplied design, not eyeballed

Every colour was sampled and every size measured off the artwork:

| | Sampled / measured | Was |
|---|---|---|
| Canvas | `#0a192f`, flat - identical at top-left, centre and bottom | a 3-layer radial + linear gradient |
| Action button | `#1492c4`, flat - identical at both ends of its width | a cyan→blue gradient |
| Headline accent | `#53c9ed` | `--t-accent` `#12b0f0` |
| Body / trust text | `#94a3b8` (cool slate) | `#aec6df` / `#cfe0ef` (blue-tinted) |
| Card | `#ffffff` on a `#e2e8f0` border | white, borderless |
| Field fill | `#f8fafc` | `--t-surface` white |
| Link accent | `#1aa6d9` | - |
| Headline | 92px, line-height 1.08, 4 lines | 56px |
| Card | 620px wide, 54px padding | 416px wide, 32px padding |
| Action | 70px tall | 44px |
| Logo | tagline lockup, centred, 56px tall | wordmark, left-aligned, 30px |

Because the reference is a ~1894px rendering, every one of those is now a
`clamp()` against the viewport calibrated to hit the measured value at that
width - so the screen *is* the artwork at the artwork's size, and scales
down rather than being redrawn. Measured at 1894px: card 619px, action 70px,
headline 92px, badge 15px.

The decorative diagonal was removed: the reference canvas samples flat, so it
was invention.

**Both columns now start on the same line.** The grid was `items-center`,
which centres each column independently and is what pushed the statement below
the card. `items-start` with `content-center` aligns the tops and still centres
the pair vertically. Measured at 1894px: badge top 129px, card top 129px.

**Absent, deliberately.** The reference also shows "Forgot password?",
"Onboard Tenant" and "Try it now". There is no password-reset, tenant-signup or
demo endpoint anywhere in the API, and a dead control on a sign-in screen is
worse than a missing one. Colour, type, logo and layout were taken; the links
were not.

**Motion.** The page assembles in sequence rather than appearing at once:
badge → headline → body → trust marks → footnote, 80ms apart, 0.44s each, with
the card on its own slightly longer curve. The whole sequence finishes inside
0.8s, so it never delays a sign-in. Under `prefers-reduced-motion` both the
durations *and the delays* are zeroed - clamping only the duration would leave
a staggered item invisible for its delay.

### 8.3 Table tools: the controls were right, the presentation was wrong

The question was whether `Export page`, `Refresh`, `Compact` and `Comfortable`
belong in an enterprise product at all. They do - "comfortable" and "compact"
are literally Cloudscape's two density modes, and it *requires* a service to
offer a mechanism to choose between them and to persist the choice. What was
wrong is that ours sat in the open as four full-width controls.

Both Carbon and PatternFly give the same rule. PatternFly: *"No more than two
items should be exposed as buttons. If you have more than two items, use an
overflow menu component to save space,"* with secondary actions such as export
as icons. Carbon reserves the table toolbar for global table actions, caps it
at five, and moves the rest to an overflow menu. Cloudscape puts display
preferences behind collection preferences.

So, per screen: **Refresh** is an icon button. **Density** moved into a table
settings popover. **Export** moved into an overflow menu, where a disabled
entry still says why rather than vanishing. **View mode** (Findings/By push,
Table/Timeline) stayed in the open, because it changes *which records are
listed* - that is not a display preference.

Nothing lost a label, a tooltip, a keyboard path or an accessible name.

### 8.4 The filter rail closes

Filtering is a phase of work, not a permanent state. The rail header carries a
close control, the choice persists per viewer and across screens, and the
records take the freed width - the column is dropped, not just hidden, or
closing it would achieve nothing. Measured: table 1072px → 1318px. Applied
filters stay applied and stay visible as chips above the records, and the
reopen control carries the applied count, so a closed rail can never hide
active scoping.

### 8.5 Scan scope belongs in the top bar

It was in the context row, on the argument that it describes this screen. That
was wrong: changing it rescopes every screen in the product at once, which
makes it global state, and a console keeps global state in its global chrome -
the slot AWS gives its region selector. It now sits in the top bar beside the
account, styled against the top-bar tokens so it works on the light and the
dark bar. The context row keeps location, which is what a context row is for.

### 8.6 Chrome sized to be chrome

The bar was 56px with a 22px wordmark - a favicon in a strip. It is 64px with a
34px wordmark, and its controls are full 40px targets. The sidebar lost the rule
under the module name, and lost the "NHI" abbreviation it showed when collapsed:
collapsed, the rail is icons only, and an abbreviation is one more thing to
decode when the expand control already says what the rail is. The first group's
collapsed rule is suppressed too, or it would reinstate the same line.

Pagination's previous/next were 32px boxes around a 14px glyph - under the 40px
touch target every platform guideline asks for, on the most-clicked control of
a record screen. They are 40px boxes with a 17px glyph.

### 8.7 Large displays get a bigger console, not a wider void

On a 2560px monitor the console read as zoomed out: the container capped and
every control stayed at its 1440px size, marooned in whitespace. Widening the
container alone does not fix that - it just moves the controls further apart.

The root scales instead: `zoom` on `html`, 1.08 from 1800px, 1.18 from 2300px,
1.32 from 3000px, which enlarges type, controls and spacing together and holds
every proportion the design was tuned at. `zoom` is the only property that does
this without breaking fixed positioning; a transform would detach the fixed top
bar and the drawers from the viewport. The container cap moved 1640px → 1760px.

The factor is kept in `--app-zoom` so the sign-in screen can cancel it exactly
(`zoom: calc(1 / var(--app-zoom))`). It already scales itself through the
`clamp()`s in §8.2, and without the cancellation it was scaled twice - measured
669px against a 620px reference before the fix, 619px after.

### 8.8 My resources: yes, there is a real endpoint

`GET /api/dashboard/my-resources`, `routes.go:57` → `dashboard.go:43` →
`dashboard_service.go:29`. It takes the email from the JWT claims, paginates
with `page`/`page_size`, accepts `scan_id`, and returns the standard paginated
envelope of identities. The repository resolves ownership as:

```sql
LOWER(owner_name) = LOWER(:1) OR LOWER(primary_owner) LIKE LOWER(:2) OR LOWER(created_by_name) = LOWER(:3)
```

Two consequences the screen has to be honest about: there is no assignment
feature - ownership comes from resource tags and CloudTrail, so tagging is what
makes something appear - and the page can legitimately be empty for a real user
whose resources carry a team address rather than theirs. The empty state says
both.

---

## 9. Revision: stacking order, and a stranded tab indicator

### 9.1 Sign-in stacks statement first

Requested. Neither column carries an `order` override any more: source order is
statement then card, which stacks that way on a phone and reads left to right
on a wide screen. Measured at 390px: statement top 32px, card top 499px. At
1894px both tops are 129px, unchanged.

The card's entrance step is now `6` stacked and `2` side by side. Stacked it is
the last thing on the page, so a fixed step of `2` had the element at the
bottom of a phone screen animating before the ones above it.

Noted for the record, since it is a real cost: stacked this way, signing in on
a phone means scrolling past the whole product statement to reach the form.

### 9.2 The tab indicator sat under the wrong tab

Reported on the dashboard's exposure signals: selecting one navigates to the
filtered identities, and the underline was left between two tabs. Reproduced at
`/identities?without_mfa=true`, with "No MFA" active and the indicator sitting
short of it.

The indicator is measured from the active tab's `offsetLeft` and `offsetWidth`.
It was re-measured on `[measure, value, tabs.length]`, and on a `ResizeObserver`
watching the tab list. Both missed the thing that actually moves the tabs: the
counts arrive from the summary query *after* the first paint, and each count
that lands widens its own tab and shifts every tab after it. `tabs.length` never
changes, `value` never changes, and the list is stretched by its parent so its
own box never changes either - so the observer never fired and the indicator
kept its first-paint geometry.

Three fixes:

- The measurement is keyed on what the tabs render, not how many there are: a
  signature of each tab's value, label and count.
- The `ResizeObserver` observes every tab element, not only the list.
- A `document.fonts.ready` pass re-measures once web fonts land, which changes
  every text width with them.

Verified by comparing the indicator's box against the active tab's on every
preset tab of `/identities`, on `/exposure`, on a cold load, on a reload, and
after arriving from an exposure signal: `left` and `width` both match to 0px in
every case.

---

## 10. Revision: container-relative density, and two broken controls

### 10.1 The metric row was refusing space it already had

Reported as a type-size problem: at 100% browser zoom the four metric tiles
broke to two per row, and at 90% they fitted. Measured, the cause was a
breakpoint, not type.

The row was `sm:grid-cols-2 xl:grid-cols-4`, so four-up required a **1280px
viewport**. At 1279px the content column is already **999px wide** - room for
four 250px tiles with gaps. The layout was keyed to the window while the
constraint is the column, and the sidebar takes 232px of that window before the
grid sees any of it. Zooming to 90% only worked by pushing the viewport past
1280.

Shrinking every text size by 10% would also have worked, by accident, at the
cost of legibility on every screen. Instead the content column is now a
**query container** and the rows read `@min-[30rem]:grid-cols-2
@min-[54rem]:grid-cols-4`, so the column count follows the width the grid
actually has:

| Viewport | Rail | Content | Columns (before → after) |
|---|---|---|---|
| 1024px | open | 744px | 2 → 2 |
| 1024px | collapsed | 916px | 2 → **4** |
| 1180px | open | 900px | 2 → **4** |
| 1252px | open | 972px | 2 → **4** |
| 1280px | open | 1000px | 4 → 4 |

Note the second row: collapsing the sidebar now re-flows the metric row,
because the grid is measuring the space it was given. A viewport breakpoint can
never do that, at any value.

The tile itself also runs about 10% tighter - 27px number, 10.5px label, 14px
padding - since four in a row makes the uppercase label the thing that decides
how narrow a readable tile can be. That is the requested reduction, applied
where the crowding actually was rather than to every string in the product.

### 10.2 Sign-in entrance

Smoothness came from shape, not duration: travel cut to 8px so nothing appears
to fly in, an easing that settles without a late snap (`--ease-soft`), an
opacity ramp that completes at 60% of the movement, and 110ms steps against a
0.72s duration so the parts overlap into one settle instead of queueing. The
canvas fades up too, so the first frame is not a hard cut. `will-change` keeps
each part on its own layer, which is what removes the sub-pixel jitter on large
text.

The sidebar's "Identity & credential posture" subtitle is gone. The module name
is the label; the strapline underneath it was explaining the product to someone
already inside it.

### 10.3 The activity filter could not be used

`GET /api/events` takes `identity_arn`, `scan_id` and pagination. Nothing else,
and the ARN match is exact (`LOWER(TRIM(identity_arn)) = LOWER(TRIM(:1))`). A
free-text box against an exact match is unusable: nobody types a full ARN from
memory, so every attempt returned nothing and the filter read as broken.

The ARN is now chosen rather than typed. `IdentityPicker` lists the scan's
identities from `/api/identities` - an endpoint already in use, already scoped
to the selected scan - searches them client-side on name and ARN, and emits the
exact ARN the events endpoint requires. No endpoint gained a parameter and no
value is guessed. The trade-off is stated in the picker's own footer: it offers
the identities it has loaded, so on a very large account the search narrows a
page rather than the estate.

### 10.4 The timeline could only ever show page one

```jsx
{total > 0 && view === 'table' && <Pagination … />}
```

The pagination was gated on the table view, so switching to Timeline hid the
only way to reach page 2 - the remaining events were unreachable. The gate is
removed. Verified: Timeline now reads 1/10, and Next moves to 2/10 with
different events.

### 10.5 Sign out colours on hover

It is the one destructive action in the menu, so it takes the critical tone on
hover and on keyboard focus. Its resting state stays neutral: a permanently red
row in a profile menu reads as an error rather than an action. Measured:
`rgb(74,91,112)` at rest, `rgb(180,35,24)` on `rgb(253,236,235)` on hover.

---

## 11. Revision: the whole content area is container-relative

§10.1 fixed the metric row. The same fault ran through every other
multi-column layout in the product, and the clarification was right: the
composition should survive a narrowing window, with what is inside it getting
smaller, rather than re-flowing into a stack.

### 11.1 Nothing in the content area keys off the window any more

Converted from viewport breakpoints to container queries against the content
column:

| Layout | Was | Now |
|---|---|---|
| Metric row (8 screens) | `sm:` / `xl:` | `@min-[30rem]` / `@min-[54rem]` |
| Posture: signals + classification | `xl:` (1280px) | `@min-[52rem]` |
| Posture: credentials + trend | `xl:` (1280px) | `@min-[52rem]` |
| Posture: activity + exposure | `xl:` (1280px) | `@min-[52rem]` |
| Activity: window shape split | `lg:` (1024px) | `@min-[34rem]` (its panel) |
| Metric-row skeleton | `sm:` / `xl:` | matches the row it stands in for |

The skeleton mattered: it was still viewport-keyed, so the loading state showed
two columns and the loaded state four, and the page re-flowed the moment data
landed.

`Panel` is now a query container too. What a panel holds should respond to the
panel's width - a legend inside a 420px panel has no business consulting the
viewport - and the classification legend proves it: at a 1024px window it was
side by side with the donut and truncating every label to a single letter
("H 18", "S 17"). It now stacks the donut above the legend below `27rem` of
panel width, and the labels read in full at every width.

### 11.2 The content column scales on a narrow desktop

Keeping the composition is only half of it. Between `lg` and `xl` the content
column runs out of room before the window does, because the sidebar takes 232px
of it first. So the column scales: `--content-zoom` is 0.85 from 1024px, 0.9
from 1100px, and 1 from 1280px up, applied to the content wrapper only.

Two columns of slightly smaller panels beat one column of full-size ones, which
is what "decrease accordingly and fit" asks for. The scale is on the content
column alone - the top bar, the sidebar and every portalled overlay (drawer,
modal, toast, command palette) sit outside it, so nothing fixed is disturbed.
Because `container-type: inline-size` reports the scaled width, the container
queries inside see the extra room and hold their columns; the two mechanisms
compound in the same direction by design.

The one offset that has to know about it is the sticky facet rail, which hangs
below 104px of unscaled chrome: `top-[calc(104px/var(--content-zoom))]`.
Verified sticking at exactly 104px.

### 11.3 Result

Every multi-column row on every screen renders as one row at 1024px, 1252px and
1440px, in both sidebar states, with no horizontal overflow:

```
 1024 /posture:4/4 /credentials:1/1 /secrets:1/1 /exposure:1/1
      /dismissed:1/1 /activity:2/2 /scans:1/1 /my-resources:1/1
```

Checked for regressions from layout containment: every absolutely positioned
element inside a panel already had a `relative` parent, so no containing block
moved, and each popover was probed at three points with `elementFromPoint` to
confirm nothing paints over it.

**Known, not fixed:** on a short viewport the identity picker's list can extend
below the fold. It scrolls internally and the scan switcher has the same shape,
so it is a pre-existing pattern rather than a regression - but placing these
popovers against available space is still open work.

---

## 12. Revision: hierarchy, copy, rhythm, and popover placement

Acting on the audit in §5 of the review notes. Four of the five findings were
worth doing as written; one needed qualifying first.

### 12.1 What was not done, and why

The finding said six of nine screens are the same screen, and that the fix is
to design each for its task. That framing is half wrong. Consoles of this kind
repeat a list pattern deliberately - AWS Console, Datadog and Splunk all ship
near-identical record screens - because consistency across a register is what
makes the tenth screen free to learn. Rearchitecting six screens into six
archetypes trades learnability for novelty, and the honest version of it would
mean stripping the metric rows from list pages, which was explicitly asked for
and then reverted.

So the emphasis differentiates instead of the skeleton. Each screen names the
one panel that carries its work, and demotes the rest; the layout stays shared.

### 12.2 Prominence: one thing leads, the rest support

`Panel` and `PanelHeader` take a `prominence` of `lead`, `default` or `quiet`,
carried by surface, border, padding and title weight rather than by colour, so
the severity palette keeps its meaning.

| | Surface | Elevation | Padding | Title |
|---|---|---|---|---|
| `lead` | base | raised | 24px | 17px bold |
| `default` | base | none | 20px | 14.5px semibold |
| `quiet` | recessed | none | 16px | 13px semibold |

Posture went from six identical panels to one lead (Exposure signals - the
ranked work, every row drilling into identities), one default (Code exposure -
the other actionable queue) and four quiet (classification, credential surface,
trend, activity feed - all reference). On a record screen the table leads and
any analysis panel above it is quiet, which is the per-task differentiation
§12.1 describes.

Verified in both themes: lead 17px/700 raised on the base surface, quiet
13px/600 recessed, text contrast 15:1 and above throughout.

Recessing panels exposed a real defect: meter tracks were `surface-3` on a
`surface-2` panel, 10/255 apart, so the bars looked like they were floating.
Tracks are now `--t-track`, an ink wash at 20% (30% in dark), which holds the
same contrast on any panel. Pills and hover fills keep `surface-3` - they are
solid chips, not a backdrop a coloured bar has to read against.

### 12.3 The product stopped explaining itself

Nine pages each opened with a two-line paragraph, and thirteen panels carried a
subtitle. A screen that describes itself on every visit is documentation; an
operator reads it once and then it is furniture.

The rule applied: keep a line only where it states something the interface
cannot show - a constraint, a definition, or a consequence. Cut everything that
describes what the title already says.

Kept, shortened to the load-bearing clause:

- Secrets: "A leaked secret grants working access to every identity on this list."
- Dismissed: "Everything listed here is filtered out of live findings automatically."
- Findings: "Values are masked by the scanner, so rotate at the source."
- Scans: "Selecting a scan scopes every screen in the product to it."
- My resources: how "mine" is actually resolved, and that there is no assignment setting.

Cut: the posture, identities, credentials and activity ledes, and six panel
subtitles that restated their own titles. Kept in full: the two subtitles that
name an API limitation (my-resources has no filters beyond the scan; the events
endpoint cannot separate read-only from mutating), because those are the reason
a figure is scoped the way it is.

Ledes went from nine paragraphs of 150-200 characters to five lines of 48-70.
Seven decorative icons came off panel headers; icons that encode something - a
severity, a mode, a row type - stayed.

### 12.4 Spacing rhythm

One gap everywhere is what made the pages read flat. There is now a ratio:
**24px between sections**, 16px between columns within a section, 12px between
cards in a group. The eye gets a grouping cue instead of an even field.

### 12.5 Metric numbers are printed, not counted up to

`useCountUp` ran on every mount. An operator reads these figures dozens of
times a day and compares them against what they saw an hour ago; a 620ms
roll-up delays every read and leaves the digits unstable while it runs. It is a
first-impression effect on a screen nobody sees for the first time twice. The
hook is deleted, not just unwired.

### 12.6 Popovers are placed against the space available

Every dropdown opened downward at a fixed height, so a tall one on a short
window ran off the bottom and its last options were unreachable. `usePopover`
now measures the room below the trigger and above it, then either caps the
panel to what is there or flips it above the trigger when that is roomier. It
re-measures on scroll and resize, uses `visualViewport` where available, and
places the panel before paint so it never appears in the wrong spot.

Applied to all five: the identity picker, the scan switcher, table settings,
the overflow menu and the account menu. Each panel clips to its rounded corners
and scrolls internally, so a capped panel can never hide its last row - the two
flat menus were previously relying on their content happening to be short.

Verified at 620px, 760px and 900px viewport heights, at the top of a page and
scrolled to the bottom: every popover sits inside the viewport, and at 760px
the identity picker correctly flips above its trigger.

## 13. Revision: two features on generated data, and a rename

Two features were added - NHI Genome and Reports - plus a rename in the code
exposure group. The information architecture was taken from the reference
console; none of its design was.

### 13.1 The honesty problem, and where the boundary sits

Every previous phase held one rule: invent nothing the backend does not serve.
These two features have no backend. That rule was suspended for them, on
request, and the suspension is contained rather than quiet:

- All generated data lives under `src/lib/demo/`. No other module produces a
  figure the API did not send, so the boundary is a directory, not a habit.
- Both screens carry a `DemoBadge` in the page header - a labelled control, not
  a tooltip - which states plainly that the figures are generated in the
  browser, that they are seeded, and that actions persist locally.
- The demo layer mimics the real transport instead of short-circuiting it.

That last point is the load-bearing one. `demoRequest` is async, cancellable
through an `AbortSignal`, sets `error.code = 'CANCELLED'` on abort exactly as
the axios client does, and honours `dna.demo.latency` and `dna.demo.fail`
switches in `localStorage`. So the skeletons, empty states, error states and
disabled buttons on these two screens are the real ones, exercised under real
latency and real failure - not decoration that would collapse the day an
endpoint appears. When one does, only the module's fetchers change.

Data is deterministic: a mulberry32 PRNG seeded by `hashSeed(name)`, so the
fleet is identical on every reload and a screenshot taken today matches one
taken next week. A reporting screen whose numbers reshuffle on refresh teaches
an operator that the numbers do not mean anything.

Actions are real. Every mutation writes through a `localStorage` overlay and
publishes on an event bus; `useDemoQuery` subscribes, so acknowledging an
anomaly in the drawer updates the feed, the counters and the identity's own
timeline at once, and survives a reload. There is one `Reset demo` control per
feature, because state a user cannot clear is a trap.

### 13.2 NHI Genome: a baseline is only useful next to what broke it

A behavioural anomaly is a claim about a difference, and a screen that shows
only the anomaly is asking to be taken on faith. So the drawer puts the
baseline and the observed behaviour side by side, at equal weight, and names
both in words (`baselineStatement` / `observedStatement`) before showing either
as a chart.

Four visuals, all in `--t-series-1` rather than the severity palette, so a
colour never implies a verdict the data has not made:

| Visual | Answers |
|---|---|
| Fingerprint (radar, 6 axes) | how this identity behaves in shape, and where the peer group differs |
| Schedule grid (7x24) | when it works, with anomalous hours marked in the critical tone |
| Volume band | whether today's call volume sits inside the learned band |
| Ranked API share | what it calls, and what it has never called before |

Dispositions are three, not two: `Suppress`, `Expected` and `Acknowledge`.
A binary of dismiss-or-keep forces an operator to lie about a true-but-intended
departure, and `Expected` is the state that actually describes most of them.

The detail screen is six tabs - Genome, Anomalies, Activity, Timeline, Peer
group, Containment - with open departures banner-ed above the tabs, because a
tab is a place you have to think to visit. Containment shows the generated IAM
policy as its exact JSON in a preview modal before anything is applied: a
remediation screen that hides what it is about to do is worse than none.

### 13.3 Reports: a report you cannot read is a file, not a feature

A reporting feature whose only output is a download is a black box - you cannot
tell whether the figures are right without opening something else. So a run
renders in the product, section by section, and the CSV export is built from
exactly the rows on screen, through the same `lib/csv` helper the record
screens use. The file and the page cannot disagree.

Three tabs, in the order the work happens: Library (what can be produced),
Scheduled (what is produced without asking), History (what was produced). The
tab is in the URL, so a link points at a tab.

A run has real states - `queued`, `running`, `ready`, `failed` - and advances
through them on timers rather than appearing finished instantly. The seeded
history deliberately includes one failed run, and the failure reason is kept
with the run instead of discarded, because a report that failed silently is
worse than one that was never scheduled.

`ScheduleDialog` validates rather than merely collects: a schedule with no
recipients is a report nobody reads, and an hour outside 0-23 is not a time.
Errors appear per field on submit and clear as the field is corrected.

### 13.4 Findings became Exposed credentials

`Findings` names the tool's internal object, not the user's problem. Every
scanner in the category calls its output findings, which is precisely why it
carries no information. The group is now `Credential exposure`, with
`Exposed credentials` and `Accepted` beneath it, and the unit of count reads
`exposed credentials` throughout - titles, captions, empty states and the
dismissal screen.

`Accepted` rather than `Dismissed` for the second screen: dismissing describes
what the operator clicked, accepting describes the decision they made and now
own.

### 13.5 A chart that rendered nothing

The fleet trend painted a 104px recharts surface with no area and no line.
`TrendChart` reads `label` for its x axis; the generator emitted `day`. With
every category resolving to `undefined`, all fourteen points mapped to one
x coordinate and the monotone curve degenerated to an empty path - a silent
failure, since the chart still occupied its box.

Both daily generators now emit the shape the chart documents (`label` for the
axis, `subtitle` for the tooltip). Verified: area and line paths present, no
`NaN` in either path, ticks reading `Sep 8` through `Sep 21`, and the tooltip
showing the date in full.

The same pass fixed a cavern in `Baseline coverage`. The first attempt pushed
its closing note to the panel floor, which equalised the heights and left the
hole in the middle instead - the measurement said the panel matched its sibling,
and the screenshot said it was mostly air. Four figures are not half a row.

The row is now two panels stacked against one: coverage above the daily trend
on the left, departures by type on the right. The trend was previously buried
under that ranked list, which put two questions in one panel and gave the chart
104px; it now has its own title and 132px, and the column comes out level with
the list. Verified at 1440px, 1024px and 390px.
