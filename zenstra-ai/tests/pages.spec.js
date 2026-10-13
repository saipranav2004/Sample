import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ROUTES, prep, scrollThrough, noOverflow } from './helpers.js';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

for (const route of ROUTES) {
  test(`${route} renders, hydrates and loads every image`, async ({ page }) => {
    const errors = await prep(page);
    const res = await page.goto(route, { waitUntil: 'networkidle' });
    expect(res.status()).toBe(200);
    // Prerendered: the content is in the HTML before any script runs.
    expect(await res.text()).toContain('<h1');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page).toHaveTitle(/Zenstra/);
    await page.waitForFunction(() => window.__v5ok === true);
    await scrollThrough(page);
    await page.waitForLoadState('networkidle');
    const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && getComputedStyle(i).display !== 'none').map((i) => i.currentSrc || i.src));
    expect(broken, 'broken images').toEqual([]);
    await noOverflow(page);
    expect(errors, 'console and page errors').toEqual([]);
  });
}

test('unknown paths get the 404 page with a 404 status', async ({ page }) => {
  const errors = await prep(page);
  const res = await page.goto('/no-such-page');
  expect(res.status()).toBe(404);
  await expect(page.locator('main h1')).toContainText('isn’t here');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  expect(errors.filter((e) => !e.includes('404'))).toEqual([]);
});

test('every internal link on every page resolves', async ({ page, request }) => {
  await prep(page);
  const seen = new Set();
  for (const route of ROUTES) {
    await page.goto(route);
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
    for (const h of hrefs) {
      if (/^(mailto:|tel:|https?:|#)/.test(h)) continue;
      const [path, hash] = h.split('#');
      const key = path + '#' + (hash || '');
      if (seen.has(key)) continue;
      seen.add(key);
      const r = await request.get(path || route);
      expect(r.status(), `${route} → ${h}`).toBe(200);
      if (hash) {
        await page.goto(path || route);
        expect(await page.locator('#' + hash).count(), `${route} → ${h} (anchor)`).toBe(1);
        await page.goto(route);
      }
    }
  }
  expect(seen.size).toBeGreaterThanOrEqual(21);
});

test.describe('accessibility', () => {
  // The page's CSP (rightly) blocks injected scripts; axe is injected by the test.
  test.use({ bypassCSP: true });
  for (const theme of ['light', 'dark']) {
  test(`no accessibility violations (${theme})`, async ({ page }) => {
    test.setTimeout(180_000);
    await prep(page, { theme });
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await scrollThrough(page);
      // Finish every entrance so contrast is measured on the settled page.
      await page.evaluate(() => document.querySelectorAll('[data-reveal],[data-words]').forEach((e) => e.classList.add('in')));
      await page.waitForTimeout(1200);
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((x) => x.id + ': ' + x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')));
      expect(v, route).toEqual([]);
    }
  });
  }
});

test('sitemap lists every page and robots.txt points to it', async ({ request }) => {
  const sm = await (await request.get('/sitemap.xml')).text();
  for (const r of ROUTES) expect(sm).toContain('<loc>https://zenstra.ai' + r + '</loc>');
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap: https://zenstra.ai/sitemap.xml');
});
