# NHI Console - Deep Algorithms

Operator console for non-human identity discovery, posture and credential
exposure across AWS. It shows non-human identities only: people appear as
creators and owners of identities, never as identities themselves. This directory contains **only the frontend**; it reads
two backends and modifies neither.

---

## What it talks to

| Upstream | Purpose | Auth |
|---|---|---|
| NHI Discovery API (Go service, `aws-backend`) | identities, credentials, secrets, scans, CloudTrail events, lineage, role consumers | JWT bearer token held by the browser |
| Secret Scanner API (`API_Integration_Guide`) | secrets committed into CodeCommit / GitHub, and the review allowlist | `X-Dashboard-Key`, **attached server-side only** |

The scanner integration follows the **updated** guide - the one that merges both
scanners behind a single `/api/findings` and adds the `platform` and
`github_uri` fields. The older single-source guide in the repository root
predates that change; a finding whose `platform` comes back `null` is treated as
CodeCommit, exactly as the updated guide specifies.

### The dashboard key never reaches the browser

The scanner's integration guide is explicit: the key must stay on a server, or
anyone who opens devtools gains permanent read access to every finding. So the
browser only ever calls a same-origin path - `/secret-scanner/...` - and
something upstream attaches the header.

* **Development:** the Vite dev server does it (`vite.config.js`), reading
  `SCANNER_DASHBOARD_KEY` from `.env` on the Node side. That value is never
  bundled.
* **Production:** this app ships as static files, so a dev server is not in the
  path. You must serve `/secret-scanner/*` from your own backend route or a
  reverse proxy that strips the prefix, forwards to the scanner and adds the
  header. Until that exists, the code-exposure screens render a clear
  "not configured" state rather than failing silently - they do not fall back to
  sample data.

## Running it

```bash
cp .env.example .env     # then fill in SCANNER_DASHBOARD_KEY
npm install
npm run dev              # http://localhost:3000
```

`npm run build` emits `dist/`. `npm run lint` runs oxlint.

Environment variables:

| Variable | Side | Meaning |
|---|---|---|
| `VITE_API_URL` | client | Base URL of the Go API. Leave empty in development so requests go through the Vite proxy and stay same-origin. |
| `VITE_SCANNER_BASE_PATH` | client | Same-origin path that fronts the scanner. Default `/secret-scanner`. |
| `API_UPSTREAM` | dev server | Where `/api/*` is proxied. Default `http://localhost:8080`. |
| `SCANNER_UPSTREAM` | dev server | Scanner origin. Default `https://js-dev.adapid.link`. |
| `SCANNER_DASHBOARD_KEY` | dev server | The scanner key. Never exposed to the client. |

## Demo accounts and roles

Until the backend exists, sign-in, users and roles run in the browser (`src/lib/demo/users.js`). People are identified by username and full name only - no email is stored or shown. A person with IAM users in several accounts has the same username in each. The seeded accounts use the password `NHI.admin@345`; people invited from User management choose their own password instead. **Download sign-ins** on that screen (all users, or one row) writes these details to a text file.

| Username | Full name | Role | State |
|---|---|---|---|
| `cirm@admin` | Admin | Super admin | Active |
| `rahul.sharma` | Rahul Sharma | Admin | Active |
| `kavya.reddy` | Kavya Reddy | Analyst | Active |
| `sneha.kulkarni` | Sneha Kulkarni | Viewer | Active |
| `priya.raghavan` | Priya Raghavan | Analyst | Invited, link expired (use Resend) |
| `karthik.rao` | Karthik Rao | Analyst | Deactivated (sign-in refused) |

**Each role gets its own console.** Every role lands on `/overview`, which is a different page per role:

| Role | Home (`/overview`) | Alerts | Credential exposure |
|---|---|---|---|
| Super admin, Admin | Organisation dashboard | Every alert, with tiles, all views and bulk actions | Yes |
| Analyst | **My work** - their own alerts: late, just handed to them, in progress, closed this week, and the identities behind them. No metric tiles | **My alerts** - only what is assigned or escalated to them, with "how it reached you" (on-call routing, owner, escalated by, assigned by) | Yes - they triage exposure alerts |
| Viewer | Dashboard without exposure: read-only oversight of posture and inventory | No queue (screen and API refused) | No (screens, dashboard panels, report and links removed) |

User management > Roles & permissions shows, per role, where it lands, its alert scope and which screens it does not get - derived from the same permission table and navigation, so it cannot drift.

**Every alert has an owner.** As in an on-call tool ([PagerDuty incidents](https://support.pagerduty.com/main/docs/incidents)), an alert is assigned the moment it is raised: to the identity's owner when they work alerts in this console, otherwise to security on-call (level 1). A Critical alert still New after an hour escalates to level 2. Alerts can be reassigned but never unassigned, so the analyst-only view can never hide an alert from everyone. When a user is deactivated or moved to a role without the queue, their open alerts go back to whoever holds their escalation level, with a timeline entry saying why. The "Needs an owner" view is now **Not acknowledged** (PagerDuty's Triggered state).

**Live.** The shell keeps the signed-in person's queue live (`src/features/alerts/AlertFeed.jsx`): the sidebar shows how many open alerts are theirs, and anything newly routed, assigned or escalated to them arrives as a notice with a link, on any screen - never for their own actions, never on first load. In the demo this is a 20-second poll of the visible tab plus an immediate refresh on every change, in the same tab or another (the `storage` event). A role change or deactivation reaches an open session without a reload. With the real API, replace the poll with server push (SSE or WebSocket) or poll the alerts endpoint.

**Two roles side by side.** Each tab keeps its own session (`src/lib/api/session.js`): account menu > **Switch account** signs this tab in as someone else while other tabs keep theirs. Open the admin in one tab and Kavya in another, assign an alert to Kavya, and it appears in her tab with a notice. Signing out ends that session in every tab holding it, and only that one.

**Enforcement.** The demo data layer applies the same scope an API would: `fetchAlerts` returns only an analyst's own alerts and refuses a viewer, and reports built from the Secret Scanner are not listed or generated for a viewer. The Secret Scanner itself is reached through the proxy, which cannot tell roles apart - **the backend or proxy must check the user's role before serving exposure data**, or a viewer can still call it directly.

`das.admin@gmail.com` still signs in as Admin, as a hidden legacy alias; it is not displayed anywhere.

**Invitations.** Invite user takes a full name and a username (suggested from the name) and creates a one-time link (`/accept-invite?token=...`, valid 72 hours) that is shown once, to copy and send - there is no mail service yet. The invitee opens it, chooses a password (stored salted and SHA-256 hashed, never in plain text) and is signed in. Resend issues a new link and retires the old one; Withdraw and deactivation kill it. An expired, used, replaced, withdrawn or unknown link each gets its own message. In the demo a link only works in the browser that created it. The backend needs three calls to replace this: create invite, look up a token, accept.

What each role may do is one table, `src/lib/roles.js`, shown as a matrix on **User management** (account menu, super admin only). The screens read it to lock controls (`useAccess`, `<Button locked>`), and the demo data layer reads it to refuse the same requests. **A check in the browser is not security: the backend must enforce this table on the server.**

**AWS connector.** Settings > Integrations > Amazon Web Services opens on per-account coverage and health, with Health (fixes to copy for failing checks), Activity (the connector's change log) and Setup reference (StackSet deployment, how data is collected, permissions, rules). Discovery runs every 24 hours; Run discovery now and Re-run checks need Admin or higher, while connecting or removing accounts and changing the template need Super admin. Only accounts connected from the console can be removed; removing one with discovered data needs the backend to delete its records.

**Other connectors.** GitLab, Okta, Entra ID, Vault, Datadog, Splunk, Jira and ServiceNow each have a Connect flow with that platform's real fields and formats, a connection test and a Manage / Disconnect view (Super admin). In the demo the test is simulated and a connected platform stays "Awaiting first sync": no data reaches other screens until the backend connector exists. Secrets are never stored - only their last four characters, for display.

**Scanner not responding.** If Exposed credentials says "The Secret Scanner is not responding", the proxy reached its timeout (15s in dev, nginx's 10s connect timeout in production) without an answer from `SCANNER_UPSTREAM`. That is the scanner service or the network path to it, not the dashboard key - a wrong key is rejected at once with a 401.

Demo state (assignments, role changes, connected accounts, report runs) lives in `localStorage` under `dna.demo.*`, so it is per browser. Clearing site data resets it.

## Deploying it

```bash
docker build -t nhi-console:latest .

docker run --rm -p 8080:8080 \
  -e SCANNER_UPSTREAM=https://js-dev.adapid.link \
  -e SCANNER_DASHBOARD_KEY=the-key-the-scanner-issued \
  -e API_UPSTREAM=http://nhi-api:8080 \
  nhi-console:latest
```

Two stages: Node builds the bundle, nginx serves it. Nothing from the build
stage survives except `dist`, so `node_modules` and any local `.env` never
reach a running container.

The container takes over the one job the Vite dev proxy does in development:
attaching `X-Dashboard-Key` to scanner requests, server side. The key is read
from the environment **at container start**, not at build time - there is
deliberately no `ARG` for it, because a build argument is recorded in the image
history and readable with `docker history`. The build also fails outright if
`X-Dashboard-Key` ever appears in `dist/`, since that would mean client code
was trying to send it itself.

| Variable | When | Meaning |
|---|---|---|
| `SCANNER_UPSTREAM` | run | Scanner origin. Default `https://js-dev.adapid.link`. |
| `SCANNER_DASHBOARD_KEY` | run | The scanner key. Never enters the image or the bundle. |
| `API_UPSTREAM` | run | Where `/api/*` is proxied. Default `http://nhi-api:8080`. |
| `DNS_RESOLVER` | run | `127.0.0.11` under Docker; the cluster DNS service on Kubernetes. |
| `VITE_API_URL` | build | Leave empty so the browser calls same-origin `/api`. |
| `VITE_SCANNER_BASE_PATH` | build | Must match the nginx location. Default `/secret-scanner`. |

The image listens on 8080 as an unprivileged user, so it needs no root and no
added capability, and `/healthz` is answered by nginx itself - it reports
whether the web tier is serving, not whether the APIs are reachable, which is a
different question the app already answers on screen.

`nginx/nginx.conf.template` carries the full reasoning, including why `set`
must precede `rewrite ... break` in the scanner location and why the security
headers live in an included snippet.

## Design documents

Read these before changing layout or adding a control:

* **`docs/UX-DECISIONS.md`** - the product archetype and why, the shell
  specification, every screen validated against the same eleven UX questions,
  the posture-fingerprint and facet-rail patterns, the motion inventory, and
  the list of things deliberately left out with the reason for each.
* **`docs/mockups/index.html`** - static mockups of sign-in, posture, the
  identity explorer, the record drawer and code exposure. Open it directly in
  a browser; it is the visual reference the implementation follows.

## Shell

A fixed full-width top bar that **follows the theme** carries the brand in the
left corner and two controls in the right: a search pill (the command palette's
handle) and the account avatar. Identity details and the three-way appearance
control live inside the account menu, not in the chrome.

Beneath it, a **context row** holds a back control, the breadcrumb, and the
scan-scope switcher - scope is a statement about the records on this screen, so
it sits beside the words naming the screen rather than in global chrome.

The sidebar starts below the top bar, is titled ("NHI DISCOVERY") with the
collapse control at its top, and is navigation only. Each screen then owns a
title strip with its primary actions, optional view tabs, and a work area that
pairs a persistent facet rail with the record surface.

## Information architecture

Grouped by the question an operator is answering, not by the API surface.

| Route | Screen | Data |
|---|---|---|
| `/overview` | Each role's home: Dashboard (exposure signals, classification mix, credential surface, discovery trend, activity, code exposure); for an analyst, My work; for a viewer, the Dashboard without exposure | demo estate, alerts, Secret Scanner |
| `/posture` | Posture (ISPM) - fleet score and trend, distribution, quick wins with bulk fix, pillars, category and account breakdowns | demo estate, access graph, genome, alerts |
| `/alerts` | Alert queue, as a list or grouped by identity; an analyst's own alerts only; not for viewers | demo estate, Secret Scanner |
| `/identities` | Identity explorer + record drawer | demo estate |
| `/identities/:id` | Identity page. Overview answers what it is, where, who owns it, the IAM role or user it acts as, its permissions, what it authenticates with, who uses it and when it was last used. Tabs: Posture (checks, remediate, roll back, history), Credentials, Role use (who assumes its role, and which roles it assumes, from CloudTrail AssumeRole events), Activity, Alerts. `/posture/:id` redirects here | demo estate, posture, alerts |
| `/credentials` | Credential register | demo estate |
| `/exposure`, `/exposure/dismissed` | Exposed credentials and the accepted (allowlisted) set; not for viewers | Secret Scanner (live) |
| `/access-graph`, `/access-graph/:id` | Access graph and blast radius | demo graph |
| `/genome`, `/genome/:id` | NHI Genome - behavioural baselines and anomalies | demo genome |
| `/activity` | CloudTrail events | demo estate |
| `/reports`, `/reports/:id` | Reports and schedules | demo reports |
| `/integrations` | Connectors, AWS coverage and health | demo connector state |
| `/users` | User management (super admin) | demo users |

The top-bar search (Ctrl/Cmd K) finds sections, identities by name or ARN, and credentials by key id, secret or parameter name, role or IAM user.

The sidebar groups open and close on click (not hover); the group holding the current page always opens, and the rest remember how they were left.

## Posture (ISPM)

Every identity is scored out of 100 against 14 checks in six pillars - Least privilege, Credential hygiene, Trust & access, Escalation, Exposure, Lifecycle (`src/lib/demo/posture.js`, vocabulary in `src/lib/posture.js`). A failed check costs 25 / 15 / 8 / 3 points for Critical / High / Medium / Low. Bands: Healthy 80+, Fair 60-79, Poor 40-59, Critical below 40; grades A-B are Healthy, C Fair, D Poor, F Critical. Where a check has a published equivalent it names the CIS AWS Foundations requirement and AWS Security Hub control (IAM.1, IAM.2, IAM.3, IAM.5, IAM.22).

The checks read the same records the other screens show - policies, MFA, key age, expiry, owner, last activity, the access graph's escalation edges and the genome's open anomalies - so a failed check always matches another screen. History is derived from when each condition began and when it was fixed, so the trend and the change log agree.

Each identity's posture is the **Posture tab of its identity page**. **Remediate** (Admin or higher) shows the score before and after, what the fix does, what it can break, and the exact IAM policy and AWS CLI commands. Applying it passes the check at once (the score goes up as risk goes down), records who applied it, and resolves the matching open alerts - and genome anomalies - through the Alerts action path with a note. A quick win can be applied to every identity in the filtered list at once (except recording an owner, which needs a person per identity). A fix in force can be **rolled back** from the Checks view: the check fails again, the history keeps both steps, and the alerts the fix resolved reopen.

**Fixes show everywhere.** Screens that describe the account as it is now - Identities, Credentials, the Dashboard, Reports, the access graph - read the estate with fixes applied (`src/lib/demo/effective.js`): a detached policy, a rotated key, a recorded owner or a permission boundary (the escalation edge is drawn as blocked) appears on all of them. Alerts keep the condition as found and are resolved, not deleted, so their record survives. Enforcing MFA is the one fix that changes no fact: the console user still has no device until someone enrols one, so the identity shows "MFA enforced, not enrolled".

In the demo nothing is sent to AWS; a real implementation needs a write-capable role, which the read-only discovery role deliberately is not.

Every screen reads the latest completed discovery run. The scan picker is out
of this build: with one run behind the screens it would have nothing to do.

## Structure

```
src/
  app/        providers (auth, theme, scan scope), route table, auth gate
  shell/      navigation rail, top bar, command palette, page header
  features/   one folder per screen; drawers live beside the screen that opens them
  ui/         design system - controls, panels, grid, overlays, states, skeletons
  charts/     chart components (the only place recharts is imported)
  lib/        api clients + endpoint layer, domain vocabulary, formatting, hooks
  styles/     design tokens and base layer
  public/brand/  supplied logo assets
```

## Conventions worth knowing

**No invented capability.** Each filter maps to a query parameter the API
accepts. `/api/secrets` takes only a search term, so that screen shows only a
search box. Sorting appears only on the code-exposure screens, where the whole
dataset is client-side - sorting one page of a server-paginated result would
misrepresent the data, so it is absent elsewhere.

**Option lists come from the data.** Classification and credential-type filters
are built from the scan's own breakdown, so they can never offer a value this
snapshot does not contain.

**Status is a sentence, not a colour code.** Five checks are evaluated, and the
table shows one state - Critical, Attention, Healthy - plus the leading reason
in words ("MFA disabled +1"). No legend to learn. The full five-check breakdown
lives in the record drawer. No risk score is invented, because nothing in the
API supports one; see `docs/UX-DECISIONS.md` §3.

**Totals are asked for, not inferred.** Where the summary endpoint has no
counter - credentials by severity, secret-backed identities that are also admin
- the console asks the list endpoint with the filter applied and `page_size=1`,
reading `total_count`. Where even that is impossible (mutating vs read-only
events, which no parameter filters) the figure is labelled "in view" or omitted.
See §4.

**Filters are a rail with real counts.** Option counts come from the scan
summary (identities, credentials) or the live finding set (code exposure), so
an operator knows the size of a filter before applying it. A facet with no
counterpart aggregate shows no number rather than an estimate.

**Export means what it says.** There is no export endpoint, so the control is
labelled "Export page" / "Export view" and writes exactly the rows on screen.

**Loading states mirror their content.** Table skeletons use the grid's column
template; the dashboard has its own metric, donut and chart placeholders. A
background refresh dims the existing rows instead of replacing them with
skeletons, so the operator never loses their place.

**Colour is validated, not chosen by eye.** The categorical palette is a fixed
seven-slot order with a reserved neutral for "unclassified", checked for
colour-vision separation, chroma and contrast against both surfaces. Charts
render categories in a canonical order so a colour always means the same thing,
and status colours (critical/high/medium/low) are never reused as series
colours. Measures of different magnitude get separate charts - there are no
dual-axis charts.

**Timestamps.** The Go API returns RFC3339. The scanner returns
`YYYY-MM-DD HH:MM:SS` in UTC with no zone marker, which most engines parse as
local time; `parseDate` normalises it explicitly before display.

**Verification status.** The scanner always reports `UNSUPPORTED` on this
deployment. The UI says "not checked" and states that this is not a claim the
secret is inactive.

**Accessibility.** Keyboard reachable throughout, focus visible, focus trapped
in overlays, `aria-sort` on sortable headers, live regions on loading and
pagination, and every animation disabled under `prefers-reduced-motion`.
