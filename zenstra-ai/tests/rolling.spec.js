import { test, expect } from '@playwright/test';
import { ROUTES, prep, noOverflow } from './helpers.js';

const ROLLING = ROUTES.filter((r) => !['/privacy', '/terms'].includes(r));

for (const route of ROLLING) {
  test(`${route} has a row that rolls sideways`, async ({ page }) => {
    await prep(page);
    await page.goto(route, { waitUntil: 'networkidle' });
    const names = await page.evaluate(() => [...document.querySelectorAll('.rm-track, .marquee-track')].map((e) => getComputedStyle(e).animationName + ' ' + getComputedStyle(e).animationPlayState));
    expect(names.length, 'rolling rows').toBeGreaterThan(0);
    expect(names.every((n) => /^(rmRoll|marq) running$/.test(n)), names.join(', ')).toBe(true);
    await noOverflow(page);
  });
}

test('a rolling row pauses under the pointer and keeps its text readable', async ({ page, isMobile }) => {
  test.skip(isMobile, 'pointer');
  await prep(page);
  await page.goto('/');
  const row = page.locator('.rm-facts').first();
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  await expect.poll(() => row.locator('.rm-track').evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('paused');
  // The looped copy is hidden from assistive technology; the first set is read once.
  expect(await row.locator('.rm-set[aria-hidden="true"]').count()).toBe(1);
  expect(await row.locator('.rm-set:not([aria-hidden]) .fact').count()).toBe(6);
});

test('the line draws as you scroll and each step lights once passed', async ({ page }) => {
  await prep(page);
  await page.goto('/platform');
  const lit = () => page.locator('#changes .sp-row.on').count();
  const dash = () => page.locator('#changes .sp-fill').evaluate((e) => parseFloat(e.style.strokeDasharray));
  const top = await page.evaluate(() => document.getElementById('changes').getBoundingClientRect().top + scrollY);
  await page.evaluate((y) => window.scrollTo(0, y - 700), top);
  await page.waitForTimeout(500);
  const d0 = await dash(), l0 = await lit();
  await page.evaluate((y) => window.scrollTo(0, y + 500), top);
  await page.waitForTimeout(500);
  expect(await dash()).toBeGreaterThan(d0);
  expect(await lit()).toBeGreaterThan(l0);
  await page.evaluate((y) => window.scrollTo(0, y + 1400), top);
  await page.waitForTimeout(500);
  expect(await lit()).toBe(5);
  // Scrolling back up un-lights the steps again.
  await page.evaluate((y) => window.scrollTo(0, y - 700), top);
  await page.waitForTimeout(500);
  expect(await lit()).toBe(0);
});

test('pinned steps move from one step to the next with scroll, and a click jumps to one', async ({ page, isMobile }) => {
  test.skip(isMobile, 'pinned on larger screens');
  await prep(page);
  await page.goto('/platform');
  const cur = () => page.locator('#layers .ss-list li.on button').innerText();
  const box = await page.evaluate(() => { const r = document.getElementById('layers').getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; });
  const at = async (f) => { await page.evaluate((y) => window.scrollTo(0, y), box.top + (box.h - 900) * f); await page.waitForTimeout(400); };
  await at(0.05); expect(await cur()).toBe('Discover');
  await at(0.5); expect(await cur()).toBe('Decide');
  await at(0.95); expect(await cur()).toBe('Prove');
  await at(0.05);
  await page.locator('#layers .ss-list button', { hasText: 'Prove' }).click();
  await expect.poll(cur, { timeout: 4000 }).toBe('Prove');
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('nothing loops; the path and the steps show their finished state', async ({ page }) => {
    await prep(page);
    await page.goto('/platform');
    expect(await page.evaluate(() => [...document.querySelectorAll('.rm-track, .marquee-track')].filter((e) => getComputedStyle(e).animationName !== 'none').length)).toBe(0);
    await expect(page.locator('#changes .sp-row.on')).toHaveCount(5);
    expect(await page.locator('#changes .sp-fill').evaluate((e) => getComputedStyle(e).strokeDasharray)).toBe('none');
    await expect(page.locator('#layers .ss-list li.on button')).toHaveText('Prove');
  });
});
