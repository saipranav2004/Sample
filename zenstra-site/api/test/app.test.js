'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeApp, demo } = require('./helpers');

const post = (app, url, payload, headers = {}) => app.inject({ method: 'POST', url, payload, headers: Object.assign({ origin: 'https://zenstra.ai' }, headers) });
const ENV = { ALLOWED_ORIGINS: 'https://zenstra.ai', SMTP_URL: 'smtp://localhost:1025', MAIL_FROM: 'Zenstra <hello@zenstra.ai>', SALES_NOTIFY_EMAILS: 'sales@zenstra.ai', SLACK_WEBHOOK_URL: 'https://hooks.slack.test/x' };

test('a valid demo request is stored with its notifications queued', async () => {
  const { app, store, kicks } = makeApp(ENV);
  const r = await post(app, '/api/demo-requests', demo());
  assert.equal(r.statusCode, 201);
  const j = r.json();
  assert.match(j.ref, /^ZX-[A-Z2-9]{6}$/);
  assert.equal(store.leads.length, 1);
  assert.equal(store.leads[0].consent_version, '2026-10');
  assert.equal(store.leads[0].ip_hash.length, 32);
  assert.deepEqual(store.outbox.map((o) => o.channel).sort(), ['confirmation_email', 'slack', 'team_email']);
  assert.equal(kicks.n, 1);
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('booking link is returned, prefilled, when a scheduler is configured', async () => {
  const { app } = makeApp(Object.assign({ BOOKING_URL: 'https://cal.com/zenstra/session?name={name}&email={email}' }, ENV));
  const j = (await post(app, '/api/demo-requests', demo())).json();
  assert.equal(j.bookingUrl, 'https://cal.com/zenstra/session?name=Dana%20Reyes&email=dana.reyes%40northbankfcu.org');
});

test('field errors come back as 422 with per-field messages', async () => {
  const { app, store } = makeApp(ENV);
  const r = await post(app, '/api/demo-requests', demo({ email: 'dana@gmail.com', region: '' }));
  assert.equal(r.statusCode, 422);
  assert.deepEqual(Object.keys(r.json().fields).sort(), ['email', 'region']);
  assert.equal(store.leads.length, 0);
});

test('an email domain that does not exist is refused', async () => {
  const { app } = makeApp(ENV, { domain: 'none' });
  const r = await post(app, '/api/demo-requests', demo());
  assert.equal(r.statusCode, 422);
  assert.match(r.json().fields.email, /could not find/);
});

test('an unverifiable domain is accepted and flagged', async () => {
  const { app, store } = makeApp(ENV, { domain: 'unknown' });
  assert.equal((await post(app, '/api/demo-requests', demo())).statusCode, 201);
  assert.deepEqual(store.leads[0].risk_flags, ['mail_domain_unverified']);
});

test('unknown fields and wrong types are rejected as bad requests', async () => {
  const { app } = makeApp(ENV);
  assert.equal((await post(app, '/api/demo-requests', demo({ admin: true }))).statusCode, 400);
  assert.equal((await post(app, '/api/demo-requests', demo({ interests: 'x' }))).statusCode, 400);
  assert.equal((await post(app, '/api/demo-requests', 'email=x', { 'content-type': 'application/x-www-form-urlencoded' })).statusCode, 415);
});

test('bodies over 16 KB are refused', async () => {
  const { app } = makeApp(ENV);
  const r = await post(app, '/api/demo-requests', JSON.stringify(demo({ message: 'x'.repeat(20000) })), { 'content-type': 'application/json' });
  assert.equal(r.statusCode, 413);
});

test('honeypot and too-fast submissions look successful but store nothing', async () => {
  const { app, store } = makeApp(ENV);
  const a = await post(app, '/api/demo-requests', demo({ website: 'http://spam' }));
  const b = await post(app, '/api/demo-requests', demo({ elapsedMs: 400 }));
  assert.equal(a.statusCode, 201); assert.equal(b.statusCode, 201);
  assert.match(a.json().ref, /^ZX-/);
  assert.equal(store.leads.length, 0);
});

test('posts from other origins are refused', async () => {
  const { app, store } = makeApp(ENV);
  assert.equal((await post(app, '/api/demo-requests', demo(), { origin: 'https://evil.example' })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/demo-requests', payload: demo() })).statusCode, 403);
  assert.equal(store.leads.length, 0);
});

test('a repeat within the dedupe window returns the same reference without new notifications', async () => {
  const { app, store, kicks } = makeApp(ENV);
  const a = (await post(app, '/api/demo-requests', demo())).json();
  const b = (await post(app, '/api/demo-requests', demo({ email: 'DANA.REYES@northbankfcu.org' }))).json();
  assert.equal(a.ref, b.ref);
  assert.equal(store.leads.length, 1);
  assert.equal(store.outbox.length, 3);
  assert.equal(kicks.n, 1);
});

test('rate limit: the sixth post in a minute from one address gets 429', async () => {
  const { app } = makeApp(ENV);
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await post(app, '/api/demo-requests', demo({ email: `p${i}@northbankfcu.org` }))).statusCode);
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 429]);
});

test('Turnstile: a rejected token blocks, an unreachable service is flagged', async () => {
  const env = Object.assign({ TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET: 'secret' }, ENV);
  const bad = makeApp(env, { captcha: 'fail' });
  assert.equal((await post(bad.app, '/api/demo-requests', demo())).statusCode, 400);
  const down = makeApp(env, { captcha: 'unavailable' });
  assert.equal((await post(down.app, '/api/demo-requests', demo())).statusCode, 201);
  assert.deepEqual(down.store.leads[0].risk_flags, ['captcha_unavailable']);
  const cfg = (await down.app.inject({ method: 'GET', url: '/api/config' })).json();
  assert.deepEqual(cfg, { turnstileSiteKey: 'site', booking: false });
});

test('health and unknown routes', async () => {
  const { app } = makeApp(ENV);
  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/health' })).json(), { status: 'ok', store: 'memory' });
  assert.equal((await app.inject({ method: 'GET', url: '/api/nope' })).statusCode, 404);
});
