# NHI Console - frontend image.
#
# Two stages. The first has Node and the whole dependency tree; the second has
# nginx and 24 static files. Nothing from the build stage is carried forward
# except `dist`, so node_modules, the lockfile and any build-time environment
# never reach a running container.
#
# Build:
#   docker build -t nhi-console:latest .
#
# Run - note that the scanner key is supplied at RUN time, never at build time:
#   docker run --rm -p 8080:8080 \
#     -e SCANNER_UPSTREAM=https://js-dev.adapid.link \
#     -e SCANNER_DASHBOARD_KEY=the-key-the-scanner-issued \
#     -e API_UPSTREAM=http://nhi-api:8080 \
#     nhi-console:latest
#
# There is deliberately no ARG for the key. A build argument is recorded in the
# image history and readable with `docker history`, so a key passed that way is
# a published key. It is read from the environment by nginx at container start
# instead - see nginx/nginx.conf.template.

# ── Stage 1: build the bundle ────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# The manifest and lockfile alone, so this layer - the slow one - is reused on
# any commit that does not change dependencies.
COPY package.json package-lock.json ./

# `npm ci` rather than `npm install`: it installs exactly the lockfile, fails
# if the two have drifted, and never rewrites the lockfile inside the image.
RUN npm ci

# Then the sources. Everything irrelevant is excluded by .dockerignore, which
# is also what keeps a local .env out of this layer.
COPY . .

# Build-time variables, both with safe defaults:
#   VITE_API_URL             left empty so the browser calls same-origin /api,
#                            which nginx proxies. Set it only if the API is
#                            served from a different origin.
#   VITE_SCANNER_BASE_PATH   the same-origin path the browser uses for the
#                            scanner. It must match the nginx location.
ARG VITE_API_URL=""
ARG VITE_SCANNER_BASE_PATH="/secret-scanner"
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SCANNER_BASE_PATH=$VITE_SCANNER_BASE_PATH

RUN npm run build

# A build that silently produced nothing would otherwise be discovered as a
# 404 in production, so fail here instead.
RUN test -f dist/index.html

# The one check worth failing a build over: if a dashboard key ever reaches the
# bundle, this image must not be published. The guard looks for the header name
# rather than a key value, because the value is unknown at build time and the
# header name is the thing client code would have to write to use one.
RUN if grep -rl "X-Dashboard-Key" dist/ >/dev/null 2>&1; then \
      echo "BUILD FAILED: the scanner key header appears in the client bundle." >&2; \
      echo "It must be attached by the reverse proxy, never by browser code." >&2; \
      exit 1; \
    fi

# ── Stage 2: serve it ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# The image's own entrypoint substitutes variables in /etc/nginx/templates at
# start. Restricted to these four names so that nginx's own $variables - $uri,
# $host, $proxy_host and the rest - are left alone.
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d \
    NGINX_ENVSUBST_FILTER='(SCANNER_UPSTREAM|SCANNER_DASHBOARD_KEY|API_UPSTREAM|DNS_RESOLVER)$'

# Defaults that make `docker run` work with nothing but a key. Docker's
# embedded DNS lives at 127.0.0.11; override DNS_RESOLVER on Kubernetes.
ENV SCANNER_UPSTREAM="https://js-dev.adapid.link" \
    SCANNER_DASHBOARD_KEY="" \
    API_UPSTREAM="http://nhi-api:8080" \
    DNS_RESOLVER="127.0.0.11"

# The default site would otherwise be served alongside ours on the same port.
RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx/nginx.conf.template /etc/nginx/templates/nhi-console.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf

COPY --from=build /app/dist /usr/share/nginx/html

# Port 8080 and the unprivileged user, so the container needs no root and no
# NET_BIND_SERVICE capability. `nginx` already exists in this image; the
# directories it writes to are chowned because a read-only root filesystem plus
# tmpfs mounts is a reasonable way to run this.
# /etc/nginx/conf.d is chowned too, and that is not cosmetic: the image's
# entrypoint writes the substituted template there at start, and as a non-root
# user it cannot write into a root-owned directory - the container would come
# up serving nothing.
RUN chown -R nginx:nginx \
        /usr/share/nginx/html \
        /var/cache/nginx \
        /var/log/nginx \
        /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

# Served by nginx itself, so this reports on the web tier rather than on an
# upstream that may legitimately be down.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
