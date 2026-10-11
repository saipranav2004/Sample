'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, clean } = require('../src/validate');
const { classify } = require('../src/domains');
const { demo } = require('./helpers');

test('a complete demo request is accepted and normalised', () => {
  const { value, errors } = validate(demo({ email: 'Dana.Reyes@NorthbankFCU.ORG', company: '  Northbank\n FCU ' }));
  assert.equal(errors, null);
  assert.equal(value.email, 'Dana.Reyes@northbankfcu.org');
  assert.equal(value.domain, 'northbankfcu.org');
  assert.equal(value.company, 'Northbank FCU');
  assert.deepEqual(value.utm, { source: 'linkedin', campaign: 'q4' });
  assert.equal(value.firstName, 'Dana'); assert.equal(value.lastName, 'Reyes');
  assert.deepEqual(value.interests, ['Workflow Security']);
});

test('the form is four fields: name, work email, company and an optional note', () => {
  const { value, errors } = validate(demo({ name: 'Cher', interest: '', message: '' }));
  assert.equal(errors, null);
  assert.equal(value.firstName, 'Cher'); assert.equal(value.lastName, null);
  assert.deepEqual(value.interests, []); assert.equal(value.message, null);
  assert.equal(validate(demo({ name: '  Ana  María   López ' })).value.lastName, 'María López');
});

test('required fields report friendly messages', () => {
  const { errors } = validate({ email: '' });
  assert.deepEqual(Object.keys(errors).sort(), ['company', 'email', 'name']);
  assert.equal(errors.email, 'Required.');
});

test('free and disposable mailboxes are refused, including subdomains', () => {
  assert.match(validate(demo({ email: 'dana@gmail.com' })).errors.email, /work email/);
  assert.match(validate(demo({ email: 'dana@mailinator.com' })).errors.email, /Temporary/);
  assert.equal(classify('eu.mailinator.com'), 'disposable');
  assert.equal(classify('northbankfcu.org'), 'work');
});

test('malformed emails are refused', () => {
  for (const e of ['dana', 'dana@', '@x.com', 'dana@x', 'da na@x.com', 'a'.repeat(65) + '@x.com']) {
    assert.ok(validate(demo({ email: e })).errors.email, e);
  }
});

test('a product outside the list is refused', () => {
  assert.equal(validate(demo({ interest: 'Free money' })).errors.interest, 'Choose one from the list.');
});

test('links in names and over-long text are refused', () => {
  assert.ok(validate(demo({ name: 'Visit www.spam.ru' })).errors.name);
  assert.ok(validate(demo({ name: '<script>' })).errors.name);
  assert.match(validate(demo({ message: 'x'.repeat(501) })).errors.message, /under 500/);
});

test('control characters are stripped', () => {
  assert.equal(clean('a\u0000b\u0007 \t c'), 'ab c');
});
