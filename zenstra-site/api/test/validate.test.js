'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, clean } = require('../src/validate');
const { classify, checkMailDomain } = require('../src/domains');
const { demo } = require('./helpers');

test('a complete demo request is accepted and normalised', () => {
  const { value, errors } = validate('demo', demo({ email: 'Dana.Reyes@NorthbankFCU.ORG', company: '  Northbank\n FCU ' }));
  assert.equal(errors, null);
  assert.equal(value.email, 'Dana.Reyes@northbankfcu.org');
  assert.equal(value.domain, 'northbankfcu.org');
  assert.equal(value.company, 'Northbank FCU');
  assert.deepEqual(value.utm, { source: 'linkedin', campaign: 'q4' });
  assert.equal(value.firstName, 'Dana'); assert.equal(value.lastName, 'Reyes');
  assert.deepEqual(value.interests, ['Workflow Security']);
});

test('the form is four fields: name, work email, company and an optional note', () => {
  const { value, errors } = validate('demo', demo({ name: 'Cher', interest: '', message: '' }));
  assert.equal(errors, null);
  assert.equal(value.firstName, 'Cher'); assert.equal(value.lastName, null);
  assert.deepEqual(value.interests, []); assert.equal(value.message, null);
  assert.equal(validate('demo', demo({ name: '  Ana  María   López ' })).value.lastName, 'María López');
});

test('required fields report friendly messages', () => {
  const { errors } = validate('demo', { email: '' });
  assert.deepEqual(Object.keys(errors).sort(), ['company', 'email', 'name']);
  assert.equal(errors.email, 'Required.');
});

test('free and disposable mailboxes are refused, including subdomains', () => {
  assert.match(validate('demo', demo({ email: 'dana@gmail.com' })).errors.email, /work email/);
  assert.match(validate('demo', demo({ email: 'dana@mailinator.com' })).errors.email, /Temporary/);
  assert.equal(classify('eu.mailinator.com'), 'disposable');
  assert.equal(classify('northbankfcu.org'), 'work');
});

test('malformed emails are refused', () => {
  for (const e of ['dana', 'dana@', '@x.com', 'dana@x', 'da na@x.com', 'a'.repeat(65) + '@x.com']) {
    assert.ok(validate('demo', demo({ email: e })).errors.email, e);
  }
});

test('a product outside the list is refused', () => {
  assert.equal(validate('demo', demo({ interest: 'Free money' })).errors.interest, 'Choose one from the list.');
});

test('links in names and over-long text are refused', () => {
  assert.ok(validate('demo', demo({ name: 'Visit www.spam.ru' })).errors.name);
  assert.ok(validate('demo', demo({ name: '<script>' })).errors.name);
  assert.match(validate('demo', demo({ message: 'x'.repeat(501) })).errors.message, /under 500/);
});

test('control characters are stripped', () => {
  assert.equal(clean('a\u0000b\u0007 \t c'), 'ab c');
});

test('mail domain check: MX, address fallback, missing and timeout', async () => {
  const mk = (mx, a) => ({ resolveMx: async () => { if (mx instanceof Error) throw mx; return mx; }, resolve4: async () => { if (a instanceof Error) throw a; return a; } });
  const nf = Object.assign(new Error('nf'), { code: 'ENOTFOUND' });
  const nd = Object.assign(new Error('nd'), { code: 'ENODATA' });
  assert.equal(await checkMailDomain('a.com', { resolver: mk([{ exchange: 'mx.a.com' }], []) }), 'ok');
  assert.equal(await checkMailDomain('a.com', { resolver: mk(nd, ['1.2.3.4']) }), 'ok');
  assert.equal(await checkMailDomain('a.com', { resolver: mk(nf, nf) }), 'none');
  assert.equal(await checkMailDomain('a.com', { resolver: mk([{ exchange: '.' }], nd) }), 'none');
  assert.equal(await checkMailDomain('a.com', { resolver: mk([{ exchange: '' }], ['1.2.3.4']) }), 'none', 'null MX wins over an address record');
  const slow = { resolveMx: () => new Promise(() => {}), resolve4: () => new Promise(() => {}) };
  assert.equal(await checkMailDomain('a.com', { resolver: slow, timeoutMs: 30 }), 'unknown');
});
