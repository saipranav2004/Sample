'use strict';

const crypto = require('node:crypto');

// Short, unambiguous reference shown to the visitor, e.g. ZX-7KQ4MD.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newRef() {
  const b = crypto.randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return 'ZX-' + s;
}

// Database row (snake_case) to the lead object used everywhere else.
function toLead(r) {
  return {
    id: r.id, ref: r.ref, kind: r.kind, createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    firstName: r.first_name, lastName: r.last_name, email: r.email, domain: r.email_domain, company: r.company,
    role: r.role, country: r.country, region: r.region, institutionType: r.institution_type, interests: r.interests || [],
    message: r.message, marketingOptIn: !!r.marketing_opt_in, consentVersion: r.consent_version,
    utm: r.utm || {}, referrer: r.referrer, page: r.page, riskFlags: r.risk_flags || []
  };
}

module.exports = { newRef, toLead };
