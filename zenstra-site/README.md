# zenstra.ai — production site

The marketing site and its lead intake, ready to deploy with Docker:

| Service | What it is |
|---|---|
| `web` | nginx (non-root) serving the static site, with security headers, caching and the API proxy |
| `api` | Node 22 + Fastify service that receives demo requests, NDA document requests and newsletter sign-ups |
| `db` | Postgres 16, reachable only from the API |
| `mailpit` | Development only (`--profile dev`): catches outgoing email at http://localhost:8025 |

The pages are built from the design sources in `../design/zenstra-v6` (home, demo, credit unions) and `../design/zenstra` (every other page). There is no client-side framework: the pages are static HTML with small scripts, which keeps them fast and indexable. React would add a bundle to download before content without adding anything the site needs.

## Run it

```sh
cd zenstra-site
cp .env.example .env
# Set at least POSTGRES_PASSWORD and IP_HASH_SALT (openssl rand -hex 32 for each).
docker compose --profile dev up -d --build     # with Mailpit
# or, without the dev mail catcher:
docker compose up -d --build
```

Open http://localhost:8080. With the dev profile, set `SMTP_URL=smtp://mailpit:1025` and read the emails at http://localhost:8025.

Behind a corporate proxy that inspects TLS, point `BUILD_CA_FILE` at its CA certificate so the image build can install packages.

## What happens when someone requests a demo

1. **In the browser** (`design/zenstra-v6/assets/forms.js`):
   - required fields and work-email checks are validated as the visitor types;
   - the US state field appears only for the United States;
   - campaign parameters (`utm_*`) and the landing referrer are kept for the visit;
   - a Cloudflare Turnstile check is added if configured.
2. **At the edge** (nginx): the form endpoints are limited to 10 posts a minute per IP, with a burst of 5.
3. **In the API**, in this order:
   1. The origin must be the site itself.
   2. Bot traps: a hidden honeypot field and a minimum time on the form. Bots get a normal-looking success and nothing is stored.
   3. The Turnstile token is checked, if Turnstile is configured.
   4. Strict validation: unknown fields, wrong types and oversized input are rejected. Free and disposable email domains are refused.
   5. The email domain is looked up in DNS, so domains that cannot receive mail are refused.
   6. The lead is stored with:
      - the consent text version and time;
      - a salted hash of the IP address (raw IPs are never stored);
      - campaign data;
      - any risk flags.
4. **Notifications** go through an outbox table, so nothing is lost if a service is down or the API restarts. They are retried with backoff (30 s, 1 min, 2 min … up to 1 h, 8 attempts). Several API replicas can run safely: rows are claimed with `FOR UPDATE SKIP LOCKED`. Channels, each switched on by its settings:
   - Slack alert to sales;
   - email to sales (demos) or the trust team (NDA documents);
   - confirmation email to the visitor, with the reference and the postal address;
   - HubSpot Forms API, with the consent record;
   - any CRM or automation endpoint through a signed webhook.
5. **The visitor sees**:
   - a reference number (e.g. `ZX-7KQ4MD`);
   - a confirmation that an email was sent;
   - when `BOOKING_URL` is set, an **inline scheduler** prefilled with their name and email, so they can book a slot immediately (Cal.com, Calendly, Chili Piper or HubSpot Meetings).
6. **A repeat submission** of the same email within 10 minutes returns the same reference and sends nothing twice.

The newsletter uses double opt-in: the visitor confirms from an email link before they are subscribed. Leads older than `LEAD_RETENTION_DAYS` (default two years) are purged daily.

## Integrations

| Setting | Effect |
|---|---|
| `SMTP_URL`, `MAIL_FROM`, `SALES_NOTIFY_EMAILS`, `TRUST_NOTIFY_EMAILS` | Team notifications, visitor confirmations, newsletter opt-in |
| `SLACK_WEBHOOK_URL` | Slack alert for each demo or document request |
| `HUBSPOT_PORTAL_ID` + `HUBSPOT_*_FORM_ID` | Submissions to HubSpot forms (contact created with consent) |
| `CRM_WEBHOOK_URL` + `CRM_WEBHOOK_SECRET` | JSON POST to any endpoint, signed `x-zenstra-signature: t=<unix>,v1=<HMAC-SHA256 of "t.body">` |
| `BOOKING_URL` | Instant booking after a demo request. Add its origin to `CSP_FRAME_SRC` |
| `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET` | Cloudflare Turnstile. Add `https://challenges.cloudflare.com` to `CSP_SCRIPT_EXTRA` and `CSP_FRAME_SRC` |

Verifying the CRM webhook signature (Node):

```js
const [, t, v1] = header.match(/^t=(\d+),v1=([a-f0-9]{64})$/);
const ok = crypto.timingSafeEqual(Buffer.from(v1, 'hex'),
  crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest());
// Also reject timestamps older than a few minutes.
```

## Security

**Web (nginx):**
- Content Security Policy:
  - scripts only from the site itself plus hashes of the inline scripts, which are computed at build;
  - no third-party fonts, since fonts are self-hosted;
  - `frame-ancestors 'none'`.
- Other headers: `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, and optional HSTS (`HSTS=`, enable once HTTPS is in place).
- Fingerprinted CSS, JS and fonts are cached for a year; HTML is always revalidated. Dotfiles are never served.

**API:**
- Runs as a non-root user on a read-only filesystem, with no Linux capabilities and no privilege escalation.
- Responses are `no-store`.
- Request bodies are limited to 16 KB.
- Logs carry no IP addresses or query strings.
- In production it refuses to start without `DATABASE_URL`, `IP_HASH_SALT`, `PUBLIC_URL` and `ALLOWED_ORIGINS`.

**Database:** on an internal Docker network with no route to the internet.

**Images:** the build context excludes the zip archives at the repository root, which contain credentials.

Put TLS in front of `web`: a load balancer, CDN or reverse proxy. Set `REAL_IP_FROM` to its address range so rate limits apply to real visitors, not to the balancer.

## Operations

- **Health:** `GET /healthz` (nginx) and `GET /api/health` (API, checks the database). Both containers have Docker health checks.
- **Logs:** JSON lines from the API (`docker compose logs api`). Search for `"notification failed permanently"` to find deliveries that need attention.
- **Backups:** back up the `db-data` volume, or use `pg_dump`:
  `docker compose exec db pg_dump -U zenstra zenstra > leads.sql`
- **Undelivered notifications:**
  `docker compose exec db psql -U zenstra -c "select l.ref, o.channel, o.attempts, o.last_error from outbox o join leads l on l.id = o.lead_id where o.sent_at is null"`
- **Migrations:** run automatically at API start, under an advisory lock.

## Development

```sh
cd api && npm ci && npm test        # 32 tests: validation, routes, rate limits, outbox, notifications
cd web && npm ci && npm run build   # writes web/dist/site and web/dist/nginx/csp-hashes.conf
```

The API runs without a database for local development (`node src/server.js` keeps leads in memory and warns). Production never does.

To change page content, edit the generators and pages under `../design/zenstra-v6/_build` or `../design/zenstra/_build`, run `python3 _build/build.py` there, then rebuild the `web` image. Form choices (roles, countries, US states) come from `api/src/reference.json`, which both the API and the page generator read.

## Before going live

- Replace the example `BOOKING_URL` with the real scheduler and test a booking.
- Set the real postal address (`COMPANY_ADDRESS`); it appears in every email, as CAN-SPAM requires.
- Configure SPF, DKIM and DMARC for the `MAIL_FROM` domain, or confirmations will land in spam.
- Have the privacy notice (`legal.html#privacy`) reviewed. It should mention the processors you enable: email provider, Slack, HubSpot, Cloudflare and the scheduler.
- Set `HSTS` once the site is served only over HTTPS.
