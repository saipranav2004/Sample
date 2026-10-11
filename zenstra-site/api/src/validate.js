'use strict';

const { domainOf, classify } = require('./domains');

// The products a visitor can arrive from (/demo?interest=...).
const PRODUCTS = ['Workflow Security', 'Cloud Security', 'Zenstra EDR'];

const MSG = {
  required: 'Required.',
  email: 'Enter an email address like name@company.com.',
  free: 'Use your work email so we can prepare for your environment.',
  disposable: 'Use your work email. Temporary inboxes are not accepted.',
  choose: 'Choose one from the list.',
  tooLong: (n) => `Keep this under ${n} characters.`,
  name: 'Use letters only, without links.'
};

const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
const LINKISH = /(https?:\/\/|www\.|\.(com|net|org|ru|io|xyz)\b|<|>)/i;

// Trim, drop control characters and collapse runs of whitespace.
function clean(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/[ \t\r\n]+/g, ' ').trim();
}

// Request bodies are checked twice: this JSON schema rejects malformed input
// early (wrong types, unknown fields, absurd sizes), then validate() applies
// the business rules and returns per-field messages the form can show.
const str = (max) => ({ type: 'string', maxLength: max });
const common = {
  email: str(320),
  website: str(200),
  elapsedMs: { type: 'integer', minimum: 0, maximum: 86400000 },
  referrer: str(1000),
  page: str(1000),
  utm: {
    type: 'object', additionalProperties: false,
    properties: { source: str(200), medium: str(200), campaign: str(200), term: str(200), content: str(200) }
  }
};
const schema = {
  type: 'object', additionalProperties: false, required: ['email'],
  properties: Object.assign({ name: str(300), company: str(300), interest: str(60), message: str(2000) }, common)
};

function checkEmail(raw, errors) {
  const email = clean(raw);
  if (!email) { errors.email = MSG.required; return null; }
  const [local] = email.split('@');
  if (email.length > 254 || !EMAIL.test(email) || local.length > 64) { errors.email = MSG.email; return null; }
  const domain = domainOf(email);
  const kind = classify(domain);
  if (kind === 'free') { errors.email = MSG.free; return null; }
  if (kind === 'disposable') { errors.email = MSG.disposable; return null; }
  return { email: email.slice(0, email.lastIndexOf('@') + 1) + domain, domain };
}

function text(raw, field, errors, { required = false, max = 120, name = false } = {}) {
  const v = clean(raw);
  if (!v) { if (required) errors[field] = MSG.required; return null; }
  if (v.length > max) { errors[field] = MSG.tooLong(max); return null; }
  if (name && LINKISH.test(v)) { errors[field] = MSG.name; return null; }
  return v;
}

function tracking(body) {
  const utm = {};
  for (const k of ['source', 'medium', 'campaign', 'term', 'content']) {
    const v = clean(body.utm && body.utm[k]).slice(0, 100);
    if (v) utm[k] = v;
  }
  return { utm, referrer: clean(body.referrer).slice(0, 500) || null, page: clean(body.page).slice(0, 500) || null };
}

// Returns { value, errors }. value is null when there are errors.
function validate(body) {
  const errors = {};
  const out = {};
  // A demo is prepared for the visitor's environment, so it needs a work address.
  const em = checkEmail(body.email, errors);
  if (em) { out.email = em.email; out.domain = em.domain; }

  // Four fields: name, work email, company and an optional note. The product
  // comes from the page the visitor arrived from, when there is one.
  const name = text(body.name, 'name', errors, { required: true, max: 120, name: true });
  if (name) { const parts = name.split(' '); out.firstName = parts[0]; out.lastName = parts.slice(1).join(' ') || null; }
  out.company = text(body.company, 'company', errors, { required: true, max: 120 });
  const interest = clean(body.interest);
  if (interest && !PRODUCTS.includes(interest)) errors.interest = MSG.choose;
  out.interests = interest && PRODUCTS.includes(interest) ? [interest] : [];
  out.message = text(body.message, 'message', errors, { max: 500 });
  Object.assign(out, tracking(body));
  return Object.keys(errors).length ? { value: null, errors } : { value: out, errors: null };
}

module.exports = { validate, schema, clean, MSG, PRODUCTS };
