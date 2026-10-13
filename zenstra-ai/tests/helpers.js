import { expect } from '@playwright/test';

export const ROUTES = [
  '/', '/platform',
  '/platform/agent-discovery', '/platform/agent-identity', '/platform/runtime-enforcement', '/platform/mcp-security', '/platform/detection-response', '/platform/decision-record',
  '/use-cases/shadow-ai', '/use-cases/prompt-injection', '/use-cases/tool-poisoning', '/use-cases/data-leakage', '/use-cases/workflow-agents', '/use-cases/cloud-agents', '/use-cases/coding-agents', '/use-cases/audit-readiness',
  '/credit-unions', '/company', '/demo', '/privacy', '/terms',
];

/* Skip the opening sequence (unless asked) and keep the floating call-out out of the
   way, then record every console error and page error. */
export async function prep(page, { intro = false, pill = false, theme } = {}) {
  await page.addInitScript(({ intro, pill, theme }) => {
    try {
      if (!intro) sessionStorage.setItem('zx5-intro', '1');
      if (!pill) sessionStorage.setItem('zx-pill-off', '1');
      // Only on the first load, so a test can change the theme and reload.
      if (theme && !sessionStorage.getItem('zx-test-theme')) { localStorage.setItem('zx-theme', theme); sessionStorage.setItem('zx-test-theme', '1'); }
    } catch (e) { /* ignore */ }
  }, { intro, pill, theme });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

/* Scroll through the page so every reveal and lazy image gets its turn. */
export async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 600) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function noOverflow(page) {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sw, 'page scrolls sideways').toBeLessThanOrEqual(0);
}
