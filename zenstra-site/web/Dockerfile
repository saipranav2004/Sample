# syntax=docker/dockerfile:1.7
# Build context: the repository root (the site is built from zenstra-site/site).

FROM node:22-alpine AS build
WORKDIR /src
COPY zenstra-site/web/package.json zenstra-site/web/package-lock.json zenstra-site/web/
# Optional: a corporate proxy's CA certificate, passed as the build secret
# "build_ca" (see BUILD_CA_FILE in .env.example). Never baked into the image.
RUN --mount=type=secret,id=build_ca,required=false \
    if [ -s /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    cd zenstra-site/web && npm ci --no-audit --no-fund
COPY zenstra-site/site zenstra-site/site
COPY zenstra-site/web zenstra-site/web
ARG SITE_URL=https://zenstra.ai
RUN cd zenstra-site/web && node build.mjs --out /out --site-url "$SITE_URL"

FROM nginxinc/nginx-unprivileged:1.27-alpine
# Defaults; override in the environment (see .env.example).
ENV API_UPSTREAM=api:3000 \
    SERVER_NAME=_ \
    REAL_IP_FROM=127.0.0.1 \
    CSP_SCRIPT_EXTRA="" \
    CSP_FRAME_SRC="'none'" \
    HSTS=""
COPY --chown=101:101 zenstra-site/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chown=101:101 zenstra-site/web/nginx/security-headers.conf zenstra-site/web/nginx/api-proxy.conf /etc/nginx/snippets/
COPY --chown=101:101 --from=build /out/nginx/csp-hashes.conf /etc/nginx/snippets/csp-hashes.conf
COPY --chown=101:101 --from=build /out/site /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
