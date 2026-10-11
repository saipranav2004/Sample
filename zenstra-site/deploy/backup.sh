#!/bin/sh
# Database backups, run by the "backup" service in docker-compose.prod.yml.
#
#   backup.sh once    take one dump now
#   backup.sh loop    take one now, then every 24 hours (the service default)
#
# Dumps go to /backups (the db-backups volume) as zenstra-YYYYmmdd-HHMMSS.sql.gz;
# those older than BACKUP_KEEP_DAYS are deleted.
#
# Take one now:   docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backup backup.sh once
# List:           docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backup ls -lh /backups
# Restore:        docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backup \
#                   sh -c 'gunzip -c /backups/<file>.sql.gz | psql -v ON_ERROR_STOP=1'
set -eu
set -o pipefail
# Dumps hold lead contact details: owner-only.
umask 077
KEEP="${BACKUP_KEEP_DAYS:-14}"

dump() {
  f="/backups/zenstra-$(date -u +%Y%m%d-%H%M%S).sql.gz"
  if pg_dump --clean --if-exists --no-owner | gzip -9 > "$f.part"; then
    mv "$f.part" "$f"
    echo "backup: wrote $f ($(du -h "$f" | cut -f1))"
  else
    rm -f "$f.part"; echo "backup: FAILED" >&2; return 1
  fi
  find /backups -name 'zenstra-*.sql.gz' -mtime +"$KEEP" -print -delete | sed 's/^/backup: removed /'
}

case "${1:-once}" in
  once) dump ;;
  loop) while true; do dump || true; sleep 86400; done ;;
  *) echo "usage: backup.sh once|loop" >&2; exit 2 ;;
esac
