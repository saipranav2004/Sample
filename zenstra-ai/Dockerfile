# Zenstra AI website: a React app, prerendered to static HTML at build time and
# served by unprivileged nginx. Node is only used to build; it is not in the image.
#   docker build -t zenstra-ai .
#   docker run -d --name zenstra-ai -p 8080:8080 --read-only --tmpfs /tmp zenstra-ai

# 1. Build: install exact dependencies from the lockfile, build and prerender.
FROM node:22.20.0-alpine AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY public/ public/
COPY src/ src/
COPY scripts/ scripts/
RUN npm run build

# 2. Serve: only the built site and the nginx config.
FROM nginxinc/nginx-unprivileged:1.29.1-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist/ /usr/share/nginx/zenstra/

# Served from its own folder, so none of the base image's sample pages are reachable.
# The base image runs as the unprivileged "nginx" user and listens on 8080.
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
