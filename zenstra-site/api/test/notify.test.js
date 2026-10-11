'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { load } = require('../src/config');
const { createNotifier, channelsFor, teamMail, visitorMail } = require('../src/notify');

const config = load({
  NODE_ENV: 'test', PUBLIC_URL: 'https://zenstra.ai', SMTP_URL: 'smtp://x', MAIL_FROM: 'Zenstra <hello@zenstra.ai>', SALES_NOTIFY_EMAILS: 'a@zenstra.ai,b@zenstra.ai',
  SLACK_WEBHOOK_URL: 'https://hooks.slack.test/x', HUBSPOT_PORTAL_ID: '123', HUBSPOT_DEMO_FORM_ID: 'form-1',
  CRM_WEBHOOK_URL: 'https://crm.test/hook', CRM_WEBHOOK_SECRET: 'a-very-long-secret-value', BOOKING_URL: 'https://cal.com/z?email={email}'
});
const lead = { id: 1, ref: 'ZX-ABC234', kind: 'demo', createdAt: '2026-10-10T10:00:00.000Z', firstName: 'Dana', lastName: '<b>Reyes</b>', email: 'dana@acme.com', company: 'Acme & Co', role: 'CISO or security leader', country: 'United States', region: 'Ohio', interests: ['Zenstra EDR'], message: 'hi', marketingOptIn: true, utm: {}, riskFlags: [] };

test('channels follow configuration', () => {
  assert.deepEqual(channelsFor(config), ['slack', 'team_email', 'confirmation_email', 'hubspot', 'crm_webhook']);
  assert.deepEqual(channelsFor(load({ NODE_ENV: 'test' })), []);
});

test('emails escape visitor input and carry the reference and postal address', () => {
  const t = teamMail(config, lead);
  assert.ok(!t.html.includes('<b>Reyes</b>'));
  assert.ok(t.html.includes('&lt;b&gt;Reyes&lt;/b&gt;'));
  assert.ok(t.html.includes('Acme &amp; Co'));
  assert.match(t.subject, /ZX-ABC234/);
  const v = visitorMail(config, lead);
  assert.ok(v.text.includes('https://cal.com/z?email=dana%40acme.com'));
  assert.ok(v.text.includes('Dover, DE'));
});

test('HubSpot and CRM payloads', async () => {
  const sent = [];
  const fetchImpl = async (url, opts) => { sent.push({ url, opts }); return { ok: true, text: async () => '' }; };
  const n = createNotifier(config, { fetchImpl, mailer: { sendMail: async () => {} } });
  await n.send('hubspot', lead);
  await n.send('crm_webhook', lead);
  await n.send('slack', lead);
  const hub = JSON.parse(sent[0].opts.body);
  assert.equal(sent[0].url, 'https://api.hsforms.com/submissions/v3/integration/submit/123/form-1');
  assert.equal(hub.legalConsentOptions.consent.consentToProcess, true);
  assert.deepEqual(hub.legalConsentOptions.consent.communications, []);
  assert.ok(hub.fields.some((f) => f.name === 'message' && /Product: Zenstra EDR/.test(f.value)));
  assert.ok(hub.fields.some((f) => f.name === 'email' && f.value === 'dana@acme.com'));
  const sig = sent[1].opts.headers['x-zenstra-signature'];
  const [, t, v1] = sig.match(/^t=(\d+),v1=([a-f0-9]{64})$/);
  assert.equal(v1, crypto.createHmac('sha256', 'a-very-long-secret-value').update(`${t}.${sent[1].opts.body}`).digest('hex'));
  assert.equal(JSON.parse(sent[1].opts.body).lead.ref, 'ZX-ABC234');
  assert.equal(JSON.parse(sent[2].opts.body).blocks[0].type, 'section');
});

test('a failing endpoint throws so the outbox retries', async () => {
  const n = createNotifier(config, { fetchImpl: async () => ({ ok: false, status: 502, text: async () => 'bad gateway' }) });
  await assert.rejects(n.send('slack', lead), /HTTP 502/);
});

test('production refuses to start without required settings', () => {
  assert.throws(() => load({ NODE_ENV: 'production' }), /DATABASE_URL.*IP_HASH_SALT.*PUBLIC_URL.*ALLOWED_ORIGINS/);
  assert.throws(() => load({ NODE_ENV: 'test', BOOKING_URL: 'http://cal.com/x' }), /https/);
});
