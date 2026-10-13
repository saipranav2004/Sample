import { test, expect } from '@playwright/test';
import { prep } from './helpers.js';

test('navigating between pages is client-side and resets scroll, title and focus', async ({ page, isMobile }) => {
  const errors = await prep(page);
  await page.goto('/company');
  await page.evaluate(() => { window.__same = 1; });
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(300);
  // The header slides away while reading down; scrolling up brings it back.
  await page.evaluate(() => window.scrollTo(0, 1300));
  await expect(page.locator('.head')).not.toHaveClass(/hide/);
  if (isMobile) {
    await page.locator('.menu-btn').tap();
    await page.locator('.mgroup-btn', { hasText: 'Platform' }).tap();
    await page.locator('.menu a[href="/platform/mcp-security"]').tap();
    await expect(page.locator('body')).not.toHaveClass(/menu-open/);
  } else {
    await page.locator('.dd-btn', { hasText: 'Platform' }).hover();
    await expect(page.locator('#dd-platform')).toBeVisible();
    await page.locator('#dd-platform a[href="/platform/mcp-security"]').click();
  }
  await expect(page).toHaveURL(/\/platform\/mcp-security$/);
  await expect(page).toHaveTitle('MCP & tool security · Zenstra AI');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /gateway in your cloud/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://zenstra.ai/platform/mcp-security');
  expect(await page.evaluate(() => window.__same)).toBe(1); // no full page load
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(5);
  await expect(page.locator('main h1')).toContainText('A gateway in your cloud');
  await expect(page.locator('.phero.hero-ready')).toHaveCount(1, { timeout: 5000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/company$/);
  await expect(page).toHaveTitle('Company · Zenstra AI');
  expect(errors).toEqual([]);
});

test('use-case menu and related links lead through the site', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop menus');
  await prep(page);
  await page.goto('/');
  await page.locator('.dd-btn', { hasText: 'Use cases' }).click();
  await expect(page.locator('#dd-uses')).toBeVisible();
  await page.locator('#dd-uses a[href="/use-cases/prompt-injection"]').click();
  await expect(page.locator('main h1')).toContainText('Hidden instructions');
  await page.locator('.rel-card').first().click();
  await expect(page).toHaveURL(/\/platform\/runtime-enforcement$/);
  await page.keyboard.press('Escape');
});

test('in-page and cross-page hash links land on their target', async ({ page }) => {
  await prep(page);
  await page.goto('/');
  await page.locator('.hero .ctas a[href="#core"]').click();
  await page.waitForTimeout(1600);
  const top = await page.evaluate(() => document.getElementById('core').getBoundingClientRect().top);
  expect(Math.abs(top)).toBeLessThan(100);
  await page.goto('/company#contact');
  await page.waitForTimeout(800);
  const t2 = await page.evaluate(() => document.getElementById('contact').getBoundingClientRect().top);
  expect(t2).toBeGreaterThan(-5);
  expect(t2).toBeLessThan(200);
});

test('header logo, footer and demo buttons all go where they say', async ({ page }) => {
  await prep(page);
  await page.goto('/terms');
  await page.locator('.foot a[href="/use-cases/coding-agents"]').click();
  await expect(page.locator('main h1')).toContainText('AI on every laptop');
  await page.locator('.head .logo').click();
  await expect(page).toHaveURL(/\/$/);
  await page.locator('main a[href="/demo"]').first().click();
  await expect(page.locator('main h1')).toContainText('See Zenstra stop');
});

test('crossing another menu on the way into an open panel keeps the panel open', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop menus');
  // Timing-based by nature: a heavily loaded machine can stall between two moves.
  test.info().annotations.push({ type: 'retries', description: 'retried once if the machine stalls' });
  await prep(page);
  await page.goto('/company');
  const plat = await page.locator('.dd-btn', { hasText: 'Platform' }).boundingBox();
  const uses = await page.locator('.dd-btn', { hasText: 'Use cases' }).boundingBox();
  await page.mouse.move(plat.x + plat.width / 2, plat.y + plat.height / 2);
  await expect(page.locator('#dd-platform')).toBeVisible();
  // Sweep across "Use cases" and down into the Platform panel, as a hand would
  // (well under the 200 ms it takes to rest on a menu).
  await page.mouse.move(uses.x + uses.width / 2, uses.y + uses.height / 2);
  await page.mouse.move(uses.x + uses.width / 2 + 60, uses.y + 140);
  await page.waitForTimeout(400);
  await expect(page.locator('.dd.open')).toHaveCount(1);
  await expect(page.locator('#dd-platform')).toBeVisible();
  // Resting on "Use cases" does switch.
  await page.mouse.move(uses.x + uses.width / 2, uses.y + uses.height / 2, { steps: 3 });
  await page.waitForTimeout(400);
  await expect(page.locator('#dd-uses')).toBeVisible();
});
