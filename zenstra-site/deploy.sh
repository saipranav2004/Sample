#!/usr/bin/env bash
# Deploy zenstra.ai on this host: check .env, build, start, then smoke-test.
#
#   ./deploy.sh          build and start production (HTTPS on DOMAIN)
#   ./deploy.sh check    only check .env and the running site
#
# First time: cp .env.example .env and fill in the required values; point
# DOMAIN's DNS at this host; open ports 80 and 443.
set -euo pipefail
cd "$(dirname "$0")"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
red() { printf '\033[31m%s\033[0m\n' "$*"; }
ok() { printf '\033[32mok\033[0m  %s\n' "$*"; }
fail=0

[ -f .env ] || { red ".env missing: cp .env.example .env and fill it in"; exit 1; }
# .env is Compose syntax (values may hold spaces, < and >), so read it rather
# than sourcing it. Later lines win, as in Compose.
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
  k=${BASH_REMATCH[1]} v=${BASH_REMATCH[2]}
  [[ "$v" =~ ^\"(.*)\"$ || "$v" =~ ^\'(.*)\'$ ]] && v=${BASH_REMATCH[1]}
  printf -v "$k" '%s' "$v"
done < .env

need() { if [ -z "${!1:-}" ]; then red "missing in .env: $1 ($2)"; fail=1; else ok "$1 set"; fi; }
need DOMAIN "the site's domain, e.g. zenstra.ai"
need ACME_EMAIL "email for Let's Encrypt notices"
need POSTGRES_PASSWORD "openssl rand -base64 32"
need IP_HASH_SALT "openssl rand -hex 32"
need SMTP_URL "smtp(s)://user:pass@host:port for confirmations and sales notices"
need SALES_NOTIFY_EMAILS "who receives demo requests"
[ "${#IP_HASH_SALT}" -ge 32 ] || { red "IP_HASH_SALT must be at least 32 characters"; fail=1; }
[ "${PUBLIC_URL:-}" = "https://${DOMAIN:-}" ] || { red "PUBLIC_URL must be https://$DOMAIN"; fail=1; }
case ",${ALLOWED_ORIGINS:-}," in *",https://${DOMAIN:-},"*) ok "ALLOWED_ORIGINS includes https://$DOMAIN" ;; *) red "ALLOWED_ORIGINS must include https://$DOMAIN"; fail=1 ;; esac
[ "$fail" = 0 ] || { red "fix .env and run again"; exit 1; }

if [ "${1:-}" != "check" ]; then
  "${COMPOSE[@]}" build --pull
  "${COMPOSE[@]}" up -d --remove-orphans
  echo "waiting for the services to report healthy..."
  for i in $(seq 1 60); do
    unhealthy=$("${COMPOSE[@]}" ps --format '{{.Service}} {{.Health}}' | awk '$2 != "" && $2 != "healthy"' || true)
    [ -z "$unhealthy" ] && break; sleep 3
  done
  [ -z "${unhealthy:-}" ] || { red "not healthy: $unhealthy"; "${COMPOSE[@]}" ps; exit 1; }
fi

# Smoke test the public site. A new certificate can take a minute to issue.
url="https://$DOMAIN"
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@" || true; }
for i in $(seq 1 30); do [ "$(code "$url/healthz")" = 200 ] && break; sleep 4; done
check() { if [ "$2" = "$3" ]; then ok "$1"; else red "$1: expected $3, got $2"; fail=1; fi; }
check "home page"               "$(code "$url/")" 200
check "product page"            "$(code "$url/edr")" 200
check "API health"              "$(curl -s --max-time 15 "$url/api/health" | tr -d ' ' || true)" '{"status":"ok","store":"postgres"}'
check "http redirects to https" "$(code "http://$DOMAIN/")" 308
check "unknown page is 404"     "$(code "$url/no-such-page")" 404
hdr=$(curl -sI --max-time 15 "$url/" || true)
for h in content-security-policy strict-transport-security x-content-type-options x-frame-options; do
  echo "$hdr" | grep -qi "^$h:" && ok "header $h" || { red "missing header $h"; fail=1; }
done
check "foreign-origin form post refused" "$(code -X POST -H 'origin: https://example.com' -H 'content-type: application/json' -d '{}' "$url/api/demo-requests")" 403
[ "$fail" = 0 ] && ok "deployed: $url" || { red "smoke test failed"; exit 1; }
