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
