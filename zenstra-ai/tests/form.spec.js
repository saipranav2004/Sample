import { test, expect } from '@playwright/test';
import { prep } from './helpers.js';

/* FormSubmit is mocked: a real submission would email a real inbox. */
async function fill(page, email = 'dana.reyes@northbank.org') {
  await page.fill('#f-first', 'Dana');
  await page.fill('#f-last', 'Reyes');
  await page.fill('#f-email', email);
  await page.fill('#f-co', 'Northbank FCU');
  await page.selectOption('#f-role', 'CISO or security leader');
  await page.check('input[name=consent]');
}

test('validation explains each problem and focuses the first one', async ({ page }) => {
  const errors = await prep(page);
  let calls = 0;
  await page.route('https://formsubmit.co/**', (r) => { calls++; r.abort(); });
  await page.goto('/demo');
  await page.getByRole('button', { name: /Request the session/ }).click();
  await expect(page.locator('#f-first')).toBeFocused();
  await expect(page.locator('.field.invalid')).toHaveCount(5);
  await fill(page, 'dana@gmail.com');
  await page.getByRole('button', { name: /Request the session/ }).click();
  await expect(page.locator('#f-email')).toBeFocused();
  await expect(page.locator('.field.invalid .err')).toHaveText('Use your work email so we can prepare for your environment.');
  expect(calls).toBe(0);
  expect(errors).toEqual([]);
});

test('a successful request shows what happens next and the summary', async ({ page }) => {
  const errors = await prep(page);
  let body = null;
  await page.route('https://formsubmit.co/**', async (r) => { body = JSON.parse(r.request().postData()); await r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}' }); });
  await page.goto('/demo');
  await fill(page);
  await page.getByRole('button', { name: /Request the session/ }).click();
  await expect(page.locator('[data-next]')).toBeVisible();
  await expect(page.locator('[data-before]')).toBeHidden();
  await expect(page.locator('.next-h')).toContainText('Thanks, Dana.');
  await expect(page.locator('.next-h')).toBeFocused();
  await expect(page.locator('[data-success] .sum')).toContainText('dana.reyes@northbank.org');
  expect(body.company).toBe('Northbank FCU');
  expect(body._honey).toBeUndefined();
  // Preparation checklist counts up, nothing stored.
  const boxes = page.locator('.prep input[type=checkbox]');
  for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  await expect(page.locator('.prep-h span')).toHaveText('Ready for your session');
  // Edit and send again brings the filled form back.
  await page.getByRole('button', { name: /Edit and send again/ }).click();
  await expect(page.locator('#f-email')).toHaveValue('dana.reyes@northbank.org');
  await expect(page.locator('#f-email')).toBeFocused();
  expect(errors).toEqual([]);
});

for (const [name, handler] of [
  ['a server error', (r) => r.fulfill({ status: 500, body: 'error' })],
  ['an unactivated inbox', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"false","message":"This form needs Activation."}' })],
  ['no network', (r) => r.abort()],
]) {
  test(`${name} offers a prefilled email instead`, async ({ page }) => {
    await prep(page);
    await page.route('https://formsubmit.co/**', handler);
    await page.goto('/demo');
    await fill(page);
    await page.getByRole('button', { name: /Request the session/ }).click();
    const status = page.locator('[data-status]');
    await expect(status).toBeVisible();
    await expect(status).toContainText('did not go through');
    const href = await status.getByRole('link', { name: 'Email the request' }).getAttribute('href');
    expect(href).toMatch(/^mailto:info@zenstra\.ai\?subject=Demo%20request/);
    expect(decodeURIComponent(href)).toContain('Work email: dana.reyes@northbank.org');
    await expect(page.locator('[data-success]')).toBeHidden();
  });
}

test('a bot filling the hidden field is not sent', async ({ page }) => {
  await prep(page);
  let calls = 0;
  await page.route('https://formsubmit.co/**', (r) => { calls++; r.abort(); });
  await page.goto('/demo');
  await fill(page);
  await page.evaluate(() => { document.getElementById('f-hp').value = 'spam'; });
  await page.getByRole('button', { name: /Request the session/ }).click();
  await expect(page.locator('[data-success]')).toBeVisible();
  expect(calls).toBe(0);
});
