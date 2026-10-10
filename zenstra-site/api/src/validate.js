'use strict';

const REF = require('./reference.json');
const { domainOf, classify } = require('./domains');

const MSG = {
  required: 'Required.',
  email: 'Enter an email address like name@company.com.',
  free: 'Use your work email so we can prepare for your environment.',
  disposable: 'Use your work email. Temporary inboxes are not accepted.',
  noDomain: 'We could not find that email domain. Check it for typos.',
  choose: 'Choose one from the list.',
  state: 'Choose a state.',
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
  turnstileToken: str(4096),
  referrer: str(1000),
  page: str(1000),
  utm: {
    type: 'object', additionalProperties: false,
    properties: { source: str(200), medium: str(200), campaign: str(200), term: str(200), content: str(200) }
  }
};
const schemas = {
  demo: {
    type: 'object', additionalProperties: false, required: ['email'],
    properties: Object.assign({
      firstName: str(200), lastName: str(200), company: str(300), role: str(100), country: str(100), region: str(100),
      institutionType: str(100), interests: { type: 'array', maxItems: 8, items: str(60) }, message: str(2000),
      marketingOptIn: { type: 'boolean' }
    }, common)
  },
  documents: {
    type: 'object', additionalProperties: false, required: ['email'],
    properties: Object.assign({ name: str(300), company: str(300), document: str(200) }, common)
  },
  newsletter: {
    type: 'object', additionalProperties: false, required: ['email'],
    properties: Object.assign({}, common)
  }
};

function checkEmail(raw, errors, { allowFree = false } = {}) {
  const email = clean(raw);
  if (!email) { errors.email = MSG.required; return null; }
  const [local] = email.split('@');
  if (email.length > 254 || !EMAIL.test(email) || local.length > 64) { errors.email = MSG.email; return null; }
  const domain = domainOf(email);
  const kind = classify(domain);
  if (kind === 'free' && !allowFree) { errors.email = MSG.free; return null; }
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

function pick(raw, field, options, errors, { required = false } = {}) {
  const v = clean(raw);
  if (!v) { if (required) errors[field] = MSG.required; return null; }
  if (!options.includes(v)) { errors[field] = MSG.choose; return null; }
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
function validate(kind, body) {
  const errors = {};
  const out = { kind };
  // Demos and NDA documents need a work address; the newsletter does not.
  const em = checkEmail(body.email, errors, { allowFree: kind === 'newsletter' });
  if (em) { out.email = em.email; out.domain = em.domain; }

  if (kind === 'demo') {
    out.firstName = text(body.firstName, 'firstName', errors, { required: true, max: 80, name: true });
    out.lastName = text(body.lastName, 'lastName', errors, { required: true, max: 80, name: true });
    out.company = text(body.company, 'company', errors, { required: true, max: 120 });
    out.role = pick(body.role, 'role', REF.roles, errors, { required: true });
    out.country = pick(body.country, 'country', REF.countries, errors, { required: true });
    out.region = null;
    if (out.country === 'United States') {
      if (!clean(body.region)) errors.region = MSG.state;
      else out.region = pick(body.region, 'region', REF.usStates, errors);
    }
    out.institutionType = pick(body.institutionType, 'institutionType', REF.institutionTypes, errors);
    const interests = Array.isArray(body.interests) ? body.interests.map(clean) : [];
    if (interests.some((i) => !REF.interests.includes(i))) errors.interests = MSG.choose;
    out.interests = [...new Set(interests)].filter((i) => REF.interests.includes(i));
    out.message = text(body.message, 'message', errors, { max: 500 });
    out.marketingOptIn = body.marketingOptIn === true;
  } else if (kind === 'documents') {
    out.name = text(body.name, 'name', errors, { required: true, max: 160, name: true });
    out.company = text(body.company, 'company', errors, { required: true, max: 120 });
    out.document = text(body.document, 'document', errors, { max: 120 });
    out.marketingOptIn = false;
  } else if (kind === 'newsletter') {
    out.marketingOptIn = true;
  } else {
    throw new Error('unknown kind ' + kind);
  }
  Object.assign(out, tracking(body));
  return Object.keys(errors).length ? { value: null, errors } : { value: out, errors: null };
}

module.exports = { validate, schemas, clean, MSG };
