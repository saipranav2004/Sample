# Deploying zenstra.ai

One Linux host with Docker runs everything: Caddy (HTTPS) → nginx (site) → API → Postgres, plus nightly database backups.

## You need

| | |
|---|---|
| A host | 2 vCPU, 2 GB RAM, 20 GB disk; Docker Engine 24+ with the Compose plugin |
| DNS | `A`/`AAAA` records for `zenstra.ai` and `www.zenstra.ai` pointing at the host |
| Firewall | Inbound 80 and 443 (TCP, and UDP 443 for HTTP/3). Nothing else. |
| Email | SMTP credentials for confirmations and sales notices (SES, Postmark, Google Workspace relay…) with SPF and DKIM set up for the sending domain |
| Inboxes | Who receives demo requests (`SALES_NOTIFY_EMAILS`) |

## First deploy

```sh
git clone <repo> && cd <repo>/zenstra-site
cp .env.example .env      # fill in: DOMAIN, ACME_EMAIL, PUBLIC_URL, ALLOWED_ORIGINS,
                          # POSTGRES_PASSWORD, IP_HASH_SALT, SMTP_URL, MAIL_FROM,
                          # SALES_NOTIFY_EMAILS, COMPANY_ADDRESS
./deploy.sh
```

`deploy.sh` checks `.env`, builds, starts, waits for health, then smoke-tests the live site: pages, API, HTTPS redirect, 404, security headers and the form origin check. It stops on the first problem and tells you what to fix. Caddy gets the certificate from Let's Encrypt on first start, which needs the DNS records to be in place already.

## Day to day

| Task | Command |
|---|---|
| Ship a new version | `git pull && ./deploy.sh` |
| Check the live site | `./deploy.sh check` |
| Roll back | `git checkout <previous commit> && ./deploy.sh` |
| Logs | `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f web api` |
| Backup now | `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backup backup.sh once` |
| List backups | `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backup ls -lh /backups` |

## Backups

The `backup` service dumps the database every 24 hours into the `db-backups` volume and keeps `BACKUP_KEEP_DAYS` (default 14) days. The volume is on the same host, so copy it off the host as well: a nightly `rsync` or object-storage sync of `/var/lib/docker/volumes/zenstra-site_db-backups`.

Restore (replaces the current data):

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backup \
  sh -c 'gunzip -c /backups/<file>.sql.gz | psql -q -v ON_ERROR_STOP=1'
```

## Behind a CDN or load balancer instead

If TLS ends at a load balancer or CDN, skip `docker-compose.prod.yml` and run `docker compose up -d --build` with `REAL_IP_FROM` set to the balancer's address range and `HSTS` set once HTTPS works end to end. The CDN must pass `X-Forwarded-For`.

## CI

`.github/workflows/zenstra-site.yml` runs on every change under `zenstra-site/`: API tests, generated pages up to date with their sources, the production build, both Docker images, and a check that the built site serves every page.
