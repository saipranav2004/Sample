# Zenstra AI website: a static site served by nginx. No build step, no Node.
#   docker build -t zenstra-ai .
#   docker run -d --name zenstra-ai -p 8080:8080 --read-only --tmpfs /tmp zenstra-ai
FROM nginxinc/nginx-unprivileged:1.29.1-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY *.html /usr/share/nginx/zenstra/
COPY assets/ /usr/share/nginx/zenstra/assets/

# Served from its own folder, so none of the base image's sample pages are reachable.
# The base image runs as the unprivileged "nginx" user and listens on 8080.
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
