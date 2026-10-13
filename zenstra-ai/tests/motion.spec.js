import { test, expect } from '@playwright/test';
import { prep } from './helpers.js';

test('opening sequence: one line, the logo, then the page opens through the mark', async ({ page }) => {
  const errors = await prep(page, { intro: true });
  // Measured in the page from its very first frame: from every letter of the first
  // line being readable to the moment it starts to swap out.
  await page.addInitScript(() => {
    window.__introHold = new Promise((res) => {
      let tAll = 0;
      const loop = () => {
        const ls = [...document.querySelectorAll('.intro-word .sw:not(.out) .l')];
        if (!tAll && ls.length && ls.map((l) => l.textContent).join('') === 'workflow security' && ls.every((l) => +getComputedStyle(l).opacity > 0.5)) tAll = performance.now();
        if (tAll && document.querySelector('.intro-word .sw.out')) { res(performance.now() - tAll); return; }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  });
  await page.goto('/?intro=1');
  await expect(page.locator('html')).toHaveClass(/intro-play/);
  // "Zenstra for workflow security" appears as one line (never "Zenstra for" alone for long).
  const line = page.locator('.intro-line');
  await expect(line).toContainText('Zenstra for');
  const held = await page.evaluate(() => window.__introHold);
  // Fully readable for ~1.3 s; with its fade in and out the line is on screen ~1.5 s.
  expect(held, 'first line holds').toBeGreaterThan(1100);
  expect(held).toBeLessThan(2200);
  await page.waitForFunction(() => [...document.querySelectorAll('.intro-word .sw:not(.out) .l')].map((l) => l.textContent).join('') === 'EDR', null, { timeout: 8000 });
  // The wordmark image, not typed text.
  await expect(page.locator('.intro-logo .logo-word img').first()).toHaveAttribute('src', /zenstra-wordmark/);
  await expect(page.locator('html')).not.toHaveClass(/intro-play/, { timeout: 12000 });
  await expect(page.locator('.hero.hero-ready')).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator('.hero h1')).toHaveClass(/scanned/);
  expect(errors).toEqual([]);
});

test('skipping the intro opens the page at once', async ({ page }) => {
  await prep(page, { intro: true });
  await page.goto('/?intro=1');
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).not.toHaveClass(/intro-play/, { timeout: 4000 });
});

test('the intro plays once per visit, and never when landing on another page', async ({ page }) => {
  await prep(page, { intro: true });
  await page.goto('/company');
  await expect(page.locator('html')).not.toHaveClass(/intro-play/);
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/intro-play/);
});

test('home hero: scan-line headline, rotating line, live decision chips, lens canvas', async ({ page }) => {
  const errors = await prep(page);
  await page.goto('/');
  await expect(page.locator('.hero.hero-ready')).toHaveCount(1, { timeout: 6000 });
  await expect(page.locator('.hero .lens canvas')).toHaveCount(1);
  await expect(page.locator('.dchip.on')).toHaveCount(3, { timeout: 4000 });
  const first = await page.locator('.hero [data-switch] .sw:not(.out)').innerText();
  await page.waitForTimeout(3300);
  const next = await page.locator('.hero [data-switch] .sw:not(.out)').last().innerText();
  expect(next).not.toBe(first);
  expect(errors).toEqual([]);
});

test('product panels switch on click and hover', async ({ page }) => {
  await prep(page);
  await page.goto('/');
  await page.locator('#products').scrollIntoViewIfNeeded();
  await page.locator('.prod').nth(2).click();
  await expect(page.locator('.prod').nth(2)).toHaveClass(/\bon\b/);
  await page.locator('.prod').nth(1).hover();
  await expect(page.locator('.prod').nth(1)).toHaveClass(/\bon\b/);
  await expect(page.locator('.prod .viz canvas')).toHaveCount(3);
});

test('the Zenstra core draws and advances with scroll', async ({ page }) => {
  await prep(page);
  await page.goto('/');
  const stage = async () => page.locator('[data-core-t]').innerText();
  await page.locator('#core').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const painted = await page.evaluate(() => {
    const c = document.querySelector('[data-core] canvas'); const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++;
    return n;
  });
  expect(painted).toBeGreaterThan(50);
  const s1 = await stage();
  await page.evaluate(() => { const t = document.querySelector('.core-track'); window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY + t.offsetHeight * 0.55); });
  await page.waitForTimeout(1200);
  expect(await stage()).not.toBe(s1);
});

test('console tabs and capability tabs switch panels', async ({ page }) => {
  await prep(page);
  await page.goto('/');
  await page.locator('#console').scrollIntoViewIfNeeded();
  await page.locator('.show-tab').nth(2).click();
  await expect(page.locator('.show-tab').nth(2)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.show-slide').nth(2)).toHaveClass(/\bon\b/);

  await page.goto('/platform/runtime-enforcement');
  await page.locator('#how').scrollIntoViewIfNeeded();
  await page.getByRole('tab', { name: /Decide/ }).click();
  await expect(page.locator('.how-panel h3')).toHaveText('Allow, hold or block');
  await page.getByRole('tab', { name: /Decide/ }).press('ArrowRight');
  await expect(page.locator('.how-panel h3')).toHaveText('Why, for every decision');
});

test('FAQ answers open and close', async ({ page }) => {
  await prep(page);
  await page.goto('/use-cases/shadow-ai');
  const d = page.locator('.faq details').first();
  await d.locator('summary').click();
  await expect(d).toHaveAttribute('open', '');
  await page.waitForTimeout(700);
  await d.locator('summary').click();
  await page.waitForTimeout(700);
  await expect(d).not.toHaveAttribute('open', '');
});

test('theme toggle switches and persists', async ({ page }) => {
  await prep(page, { theme: 'light' });
  await page.goto('/platform');
  await page.getByRole('button', { name: /light and dark/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('floating call-out: rolls, leads to the demo, hides there, can be dismissed', async ({ page }) => {
  await prep(page, { pill: true });
  await page.goto('/company');
  const pill = page.locator('.askpill');
  await expect(pill).toBeVisible({ timeout: 5000 });
  const a = await pill.locator('.askpill-line.cur').innerText();
  await page.waitForTimeout(3500);
  expect(await pill.locator('.askpill-line.cur').innerText()).not.toBe(a);
  await pill.locator('.askpill-link').click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator('.askpill')).toHaveCount(0);
  await page.goto('/platform');
  await expect(page.locator('.askpill')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Hide this message' }).click();
  await expect(page.locator('.askpill')).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(2500);
  await expect(page.locator('.askpill')).toHaveCount(0);
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('content is fully visible without animation, the core is a still frame', async ({ page }) => {
    const errors = await prep(page, { intro: true });
    await page.goto('/?intro=1');
    await expect(page.locator('html')).not.toHaveClass(/intro-play/);
    await expect(page.locator('html')).toHaveClass(/reduce/);
    const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal],[data-after]')].filter((e) => getComputedStyle(e).opacity === '0').length);
    expect(hidden).toBe(0);
    await expect(page.locator('[data-core]')).toHaveClass(/core-static/);
    await page.goto('/platform/agent-discovery');
    const hidden2 = await page.evaluate(() => [...document.querySelectorAll('[data-reveal],[data-after]')].filter((e) => getComputedStyle(e).opacity === '0').length);
    expect(hidden2).toBe(0);
    expect(errors).toEqual([]);
  });
});
