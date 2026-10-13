# Zenstra AI website

A React app (Vite and React Router). Every page is prerendered to static HTML at build time, so it loads complete and search engines can read it. React then hydrates it in the browser. Production serves only static files from nginx; Node is used only to build.

## Develop

```sh
npm ci            # install the exact versions in package-lock.json
npm run dev       # http://127.0.0.1:5173 with hot reload
```

## Build and preview

```sh
npm run build     # client build + server render + prerender → dist/
npm run preview   # serve dist/ like production: http://127.0.0.1:4173
```

## Test end to end

The tests use Playwright and run against the production build.

```sh
npm run build
npx playwright install chromium   # once, if no Chromium is installed
npm run test:e2e
```

They cover:
- **Pages:** every page renders, hydrates and loads its images, with no console errors and no sideways scrolling on desktop or phone. Every internal link and anchor resolves.
- **Accessibility:** axe finds no violations, in light and dark themes.
- **Motion:**
  - rolling rows on every page, the scroll-drawn path and the pinned steps
  - the opening sequence and its timing
  - the hero
  - product panels
  - the Zenstra core canvas
  - tabs, FAQ
  - theme switching
  - the floating call-out
  - reduced motion
- **Navigation:** mega menus, the mobile menu, client-side navigation, the document head on each route, and hash links.
- **Demo form:** validation, success, the three failure paths, and the spam trap. FormSubmit is mocked, so no email is sent.

To test a running server instead, such as the Docker container, set `BASE_URL`:

```sh
BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

## Run it with Docker

```sh
docker build -t zenstra-ai .
docker run -d --name zenstra-ai -p 8080:8080 --read-only --tmpfs /tmp zenstra-ai
```

Open http://localhost:8080. Put HTTPS in front of the container with your load balancer, CDN or reverse proxy.

- **Clean URLs:** `/company` serves `company.html`, and `/platform/agent-identity` serves `platform/agent-identity.html`.
- **Errors and old links:** unknown paths get the 404 page with a 404 status. `/home.html` from the old site redirects to `/`.
- **Health check:** `GET /healthz` returns `ok`. The image also has a Docker `HEALTHCHECK`.
- **Security:**
  - nginx runs as a non-root user and works on a read-only filesystem.
  - Security headers, including a strict Content-Security-Policy with no inline scripts, are set in `nginx/security-headers.conf`.
- **Caching:** built assets have content hashes and are cached for a year; pages are revalidated on every visit.

## Where things are

| Path | What it is |
|---|---|
| `src/content/site.js` | The site map: capabilities, use cases, company links, and every route's title and description. The menus, footer, router, prerender and sitemap all read it. |
| `src/content/pages.js` | The copy for every capability and use-case page. |
| `src/content/media.js` | The product video setting (see below). |
| `src/pages/` | One component per page. `Template.jsx` is the shared layout for capability and use-case pages. |
| `src/components/` | Header and mega menus, footer, intro, floating call-out, video, the shared sections in `Sections.jsx`, and the rolling and scroll-driven pieces in `Motion.jsx` (`Marquee`, `FactCarousel`, `WorksWith`, `ScrollPath`, `ScrollSteps`). |
| `src/lib/` | Motion engines: the canvas engines (`fx5.js`), the Zenstra core (`core5.js`), text effects (`text.js`) and page motion (`pagefx.js`). Each page mounts them on load and removes them when you leave. |
| `src/styles/` | `v5.css` is the design system, `pages.css` holds page-specific styles, and `enterprise.css` holds the menus, template, call-out and video. |
| `public/` | Images, `boot.js` (theme and intro, run before first paint) and anything served as-is. |
| `scripts/prerender.mjs` | Renders each route to HTML and writes `sitemap.xml` and `robots.txt`. |
| `scripts/serve.mjs` | Local server with the same clean-URL rules as nginx. |
| `tests/` | End-to-end tests. |
| `nginx/`, `Dockerfile` | The production image. |

### Adding a page

- **A capability or use case:** add it to `src/content/site.js` and its copy to `src/content/pages.js`. The menu, footer, sitemap and prerender pick it up automatically.
- **A different kind of page:** add it to `ROUTES` in `site.js` and add a `<Route>` in `src/App.jsx`.

## The product video

1. Put the file at `public/media/zenstra-product-tour.mp4`.
2. In `src/content/media.js`, set `src: '/media/zenstra-product-tour.mp4'` and `length` to its running time.
3. Rebuild.

A "Watch the product tour" button then appears on the home page console and in the platform page's console section, and opens the video in a player. Until then, the platform page shows a tour of console screens.

## The demo form

`src/pages/Demo.jsx` sends requests through [FormSubmit](https://formsubmit.co) to `info@zenstra.ai`. No backend is needed, and nothing is stored in the browser.

- **Before launch:** submit the form once. FormSubmit then emails an "Activate Form" link to info@zenstra.ai. Click it, and from then on every request arrives in that inbox.
- **If delivery fails:** visitors are offered a prefilled email to send instead.
- **To change the address:** edit `ACTION` and `TO` in `Demo.jsx`.
- **To move to another form service:** update `connect-src` and `form-action` in `nginx/security-headers.conf` as well.
