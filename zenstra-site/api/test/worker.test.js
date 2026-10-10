'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryStore } = require('../src/store/memory');
const { createWorker } = require('../src/worker');
const { validate } = require('../src/validate');
const { demo } = require('./helpers');

const silent = { info() {}, warn() {}, error() {} };

test('outbox: sends each channel once, retries failures with backoff, gives up after max attempts', async () => {
  const store = createMemoryStore();
  const { value } = validate('demo', demo());
  await store.createLead(Object.assign(value, { consentVersion: 'v' }), { channels: ['slack', 'team_email', 'crm_webhook'], dedupeMinutes: 10 });
  const calls = [];
  let slackFails = 1;
  const notifier = { async send(ch) { calls.push(ch); if (ch === 'slack' && slackFails-- > 0) throw new Error('slack down'); if (ch === 'crm_webhook') throw new Error('crm down'); } };
  const w = createWorker({ store, notifier, log: silent, maxAttempts: 2 });
  await w.tick();
  const by = Object.fromEntries(store.outbox.map((o) => [o.channel, o]));
  assert.ok(by.team_email.sent_at);
  assert.equal(by.slack.sent_at, null);
  assert.equal(by.slack.attempts, 1);
  assert.ok(by.slack.next_at > Date.now() + 25000, 'first retry waits about 30 s');
  // Make retries due now and run again.
  store.outbox.forEach((o) => { o.next_at = 0; });
  await w.tick();
  assert.ok(by.slack.sent_at);
  assert.equal(by.crm_webhook.attempts, 2);
  store.outbox.forEach((o) => { o.next_at = 0; });
  await w.tick();
  assert.equal(by.crm_webhook.attempts, 2, 'no attempts beyond the maximum');
  assert.deepEqual(calls.filter((c) => c === 'team_email').length, 1);
});

test('purge removes leads past retention with their outbox rows', async () => {
  const store = createMemoryStore();
  const { value } = validate('demo', demo());
  await store.createLead(Object.assign(value, { consentVersion: 'v' }), { channels: ['slack'], dedupeMinutes: 10 });
  store.leads[0].created_at = new Date(Date.now() - 800 * 86400000);
  assert.equal(await store.purge(730), 1);
  assert.equal(store.leads.length, 0);
  assert.equal(store.outbox.length, 0);
});
