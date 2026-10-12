# Zenstra AI website

A static site: plain HTML, CSS and JavaScript in this folder. There is no build step and no Node.js, so nothing like `npm install` or `npm run dev` is needed.

## Run it with Docker

```sh
docker build -t zenstra-ai .
docker run -d --name zenstra-ai -p 8080:8080 --read-only --tmpfs /tmp zenstra-ai
```

Open http://localhost:8080. Put HTTPS in front of the container with your load balancer, CDN or reverse proxy. The container serves plain HTTP on port 8080.

- Pages work with or without `.html`: `/company` and `/company.html` both serve the company page. `/` serves `home.html`.
- `GET /healthz` returns `ok` for health checks. The image also has a Docker `HEALTHCHECK`.
- nginx runs as a non-root user and works on a read-only filesystem.
- Security headers, including a Content-Security-Policy, are set in `nginx/security-headers.conf`.

## Preview without Docker

Any static file server works, for example:

```sh
python3 -m http.server 8080
```

Then open http://localhost:8080/home.html.

## The demo form

`demo.html` sends requests through [FormSubmit](https://formsubmit.co) to `info@zenstra.ai`. No backend is needed.

- **Before launch:** submit the form once. FormSubmit then emails an "Activate Form" link to info@zenstra.ai. Click it, and from then on every request arrives in that inbox.
- **If delivery fails:** visitors are offered a prefilled email to send instead.
- **To change the address:** edit the form's `action` in `demo.html`.
- **To move to another form service:** update `connect-src` and `form-action` in `nginx/security-headers.conf` as well.

## Files

| Path | What it is |
|---|---|
| `*.html` | The pages: home, credit unions, company, demo, privacy, terms, 404 |
| `assets/` | Styles, scripts, images, and the vendored smooth-scroll library |
| `nginx/` | Server config and security headers used by the image |
| `Dockerfile`, `.dockerignore` | The image, which contains only the pages, assets and config |
