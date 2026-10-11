'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../src/config');
const { makeApp, demo, post } = require('./helpers');

test('a valid request emails sales and confirms to the visitor', async () => {
  const { app, sent } = makeApp();
  const r = await post(app, demo());
  assert.equal(r.statusCode, 201);
  const { ref } = r.json();
  assert.match(ref, /^ZX-[A-Z2-9]{6}$/);
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.equal(sent.length, 2);
  const [sales, visitor] = sent;
  assert.deepEqual(sales.to, ['sales@zenstra.ai']);
  assert.equal(sales.replyTo, 'dana.reyes@northbankfcu.org');
  assert.equal(sales.subject, `Demo request: Dana Reyes, Northbank FCU (${ref})`);
  assert.match(sales.text, /Product: Workflow Security/);
  assert.match(sales.text, /Message: Copilot agents in lending/);
  assert.match(sales.text, /Source: linkedin \/ q4/);
  assert.equal(sales.from, 'Zenstra <no-reply@zenstra.ai>');
  assert.equal(visitor.to, 'dana.reyes@northbankfcu.org');
  assert.match(visitor.text, /^Your demo request\n\nHi Dana,/);
});

test('names and messages are escaped in the HTML email', async () => {
  const { app, sent } = makeApp();
  await post(app, demo({ company: 'Acme & <Co>', message: '<img src=x>' }));
  assert.match(sent[0].html, /Acme &amp; &lt;Co&gt;/);
  assert.doesNotMatch(sent[0].html, /<img src=x>/);
});

test('if the sales email cannot be sent, the visitor is told (502), never a false success', async () => {
  const { app } = makeApp({}, { fail: (m) => Array.isArray(m.to) });
  const r = await post(app, demo());
  assert.equal(r.statusCode, 502);
  assert.equal(r.json().error, 'send_failed');
});

test('a failed confirmation email does not fail the request', async () => {
  const { app, sent } = makeApp({}, { fail: (m) => !Array.isArray(m.to) });
  assert.equal((await post(app, demo())).statusCode, 201);
  assert.equal(sent.length, 1);
});

test('field errors come back as 422 with per-field messages', async () => {
  const { app, sent } = makeApp();
  const r = await post(app, demo({ email: 'dana@gmail.com', company: '' }));
  assert.equal(r.statusCode, 422);
  assert.deepEqual(Object.keys(r.json().fields).sort(), ['company', 'email']);
  assert.equal(sent.length, 0);
});

test('unknown fields and wrong types are rejected as bad requests', async () => {
  const { app } = makeApp();
  assert.equal((await post(app, demo({ admin: true }))).statusCode, 400);
  assert.equal((await post(app, demo({ interest: ['x'] }))).statusCode, 400);
  assert.equal((await post(app, demo({ role: 'CISO' }))).statusCode, 400);
  assert.equal((await post(app, JSON.stringify(demo({ message: 'x'.repeat(20000) })), { 'content-type': 'application/json' })).statusCode, 400, 'over the 16 KB body limit');
});

test('bot traps look like success and send nothing', async () => {
  const { app, sent } = makeApp();
  const a = await post(app, demo({ website: 'http://spam' }));
  const b = await post(app, demo({ elapsedMs: 400 }));
  assert.equal(a.statusCode, 201); assert.equal(b.statusCode, 201);
  assert.match(a.json().ref, /^ZX-/);
  assert.equal(sent.length, 0);
});

test('only our own site may post: other origins and no origin are refused', async () => {
  const { app } = makeApp();
  assert.equal((await post(app, demo(), { origin: 'https://evil.example' })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/demo-requests', payload: demo() })).statusCode, 403);
  assert.equal((await post(app, demo(), { origin: 'https://www.zenstra.ai' })).statusCode, 201);
});

test('rate limited to five requests a minute per address', async () => {
  const { app } = makeApp();
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await post(app, demo())).statusCode);
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 429]);
});

test('health and not found', async () => {
  const { app } = makeApp();
  assert.deepEqual((await app.inject({ url: '/api/health' })).json(), { status: 'ok' });
  assert.equal((await app.inject({ url: '/api/nope' })).statusCode, 404);
});

test('configuration: four settings, checked in production', () => {
  assert.throws(() => load({ NODE_ENV: 'production' }), /SMTP_URL is required; SALES_EMAIL is required/);
  assert.throws(() => load({ SMTP_URL: 'http://x' }), /must start with smtp/);
  const c = load({ NODE_ENV: 'production', DOMAIN: 'https://zenstra.ai/', SMTP_URL: 'smtps://u:p@smtp.x.com:465', SALES_EMAIL: 'a@zenstra.ai, b@zenstra.ai', MAIL_FROM: 'Zenstra <hello@zenstra.ai>' });
  assert.deepEqual(c.allowedOrigins, ['https://zenstra.ai', 'https://www.zenstra.ai']);
  assert.deepEqual(c.salesTo, ['a@zenstra.ai', 'b@zenstra.ai']);
  assert.equal(c.mailFrom, 'Zenstra <hello@zenstra.ai>');
  assert.deepEqual(load({}).allowedOrigins, ['http://localhost:8080', 'https://localhost']);
});
