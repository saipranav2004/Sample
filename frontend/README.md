# NHI Console - Deep Algorithms

Operator console for non-human identity discovery, posture and credential
exposure across AWS. This directory contains **only the frontend**; it reads
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

Until the backend exists, sign-in, users and roles run in the browser (`src/lib/demo/users.js`). Every account uses the password `admin@123`, and signs in with its username or email.

| Username | Email | Role | State |
|---|---|---|---|
| `cirm@admin` | `das.admin@gmail.com` | Super admin | Active |
| `marcus.oyelaran` | `marcus.oyelaran@example.com` | Admin | Active |
| `helena.brandt` | `helena.brandt@example.com` | Analyst | Active |
| `sofia.marchetti` | `sofia.marchetti@example.com` | Viewer | Active |
| `priya.raghavan` | `priya.raghavan@example.com` | Analyst | Invited (active after first sign-in) |
| `liam.donnelly` | `liam.donnelly@example.com` | Analyst | Deactivated (sign-in refused) |

What each role may do is one table, `src/lib/roles.js`, shown as a matrix on **Settings > Users & roles**. The screens read it to lock controls (`useAccess`, `<Button locked>`), and the demo data layer reads it to refuse the same requests. **A check in the browser is not security: the backend must enforce this table on the server.**

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

| Route | Screen | Reads |
|---|---|---|
| `/posture` | Posture - exposure signals, classification mix, credential surface, scan trend, activity, code exposure | `dashboard/summary`, `scans`, `events`, `findings` |
| `/identities` | Identity explorer + record drawer (overview, credentials, service access, consumers, activity) | `identities`, `identities/lineage`, `identities/consumers`, `events` |
| `/credentials` | Flattened credential register | `credentials` |
| `/secrets` | Secret-backed identities | `secrets` |
| `/exposure` | Code exposure triage, per-finding and grouped by push | `findings`, `POST allowlist` |
| `/exposure/dismissed` | Allowlist review and restore | `GET allowlist`, `DELETE allowlist` |
| `/activity` | CloudTrail events | `events` |
| `/scans` | Scan history and global scope selection | `scans` |
| `/my-resources` | Owner-scoped inventory | `dashboard/my-resources` |

Every screen is scoped to one discovery scan, chosen once in the top bar. An
empty selection tracks the latest completed scan, which is the API's own
default.

## Structure

```
src/
  app/        providers (auth, theme, scan scope), route table, auth gate
  shell/      navigation rail, top bar, scan switcher, command palette, page header
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
