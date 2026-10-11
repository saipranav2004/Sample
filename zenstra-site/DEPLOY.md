# Deploying zenstra.ai

One Linux host with Docker runs everything: Caddy (HTTPS) → nginx (the site) → a small API that emails each demo request to sales. There is no database: the sales inbox is the record of every request.

## You need

| | |
|---|---|
| A host | 1 vCPU, 1 GB RAM; Docker Engine 24+ with the Compose plugin |
| DNS | `A`/`AAAA` records for `zenstra.ai` and `www.zenstra.ai` pointing at the host |
| Firewall | Inbound 80 and 443 (TCP, and UDP 443 for HTTP/3). Nothing else. |
| Email | SMTP credentials (SES, Postmark, Google Workspace relay…), with SPF and DKIM set up for the sending domain so the emails are not marked as spam |

## Settings

Four, in `.env` (copy `.env.example`):

| Setting | Example |
|---|---|
| `DOMAIN` | `zenstra.ai` |
| `ACME_EMAIL` | `ops@zenstra.ai` (Let's Encrypt certificate notices) |
| `SMTP_URL` | `smtps://user:password@smtp.example.com:465` |
| `SALES_EMAIL` | `sales@zenstra.ai` (comma-separate several) |

Optional: `MAIL_FROM` (default `Zenstra <no-reply@DOMAIN>`).

## First deploy

```sh
git clone <repo> && cd <repo>/zenstra-site
cp .env.example .env      # fill in the four settings
./deploy.sh
```

`deploy.sh` checks `.env`, builds, starts, waits for health, then smoke-tests the live site: pages, API, HTTPS redirect, 404, security headers and the form's origin check. It stops on the first problem and says what to fix. Caddy gets the certificate from Let's Encrypt on first start, so the DNS records must already point at the host.

Then submit the form on the live site once and check that both emails arrive: the request in the sales inbox, the confirmation in yours.

## Day to day

| Task | Command |
|---|---|
| Ship a new version | `git pull && ./deploy.sh` |
| Check the live site | `./deploy.sh check` |
| Roll back | `git checkout <previous commit> && ./deploy.sh` |
| Logs | `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f web api` |

## If email is down

The form tells the visitor their request could not be sent and gives them info@zenstra.ai to email instead. Nothing is lost silently.

## Behind a CDN or load balancer instead

If TLS ends at a load balancer or CDN, skip `docker-compose.prod.yml` and run `docker compose up -d --build`; the site listens on port 8080.

## CI

`.github/workflows/zenstra-site.yml` runs on every change under `zenstra-site/`: API tests, generated pages up to date with their sources, the production build, both Docker images, and a check that the built site serves every page.
