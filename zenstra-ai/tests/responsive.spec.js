import { test, expect } from '@playwright/test';
import { ROUTES, prep, scrollThrough, noOverflow } from './helpers.js';

test('every page fits the screen without sideways scrolling', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await prep(page);
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await scrollThrough(page);
    await noOverflow(page);
    await expect(page.locator('main h1'), route).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('the floating call-out waits on phones until the visitor scrolls', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone behaviour');
  await prep(page, { pill: true });
  await page.goto('/platform');
  await page.waitForTimeout(2500);
  await expect(page.locator('.askpill')).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect(page.locator('.askpill')).toBeVisible({ timeout: 4000 });
  const box = await page.locator('.askpill').boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});
