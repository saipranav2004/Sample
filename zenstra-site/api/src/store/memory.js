'use strict';

const { newRef, toLead } = require('./shared');

// Same interface as the Postgres store, kept in memory. For local development
// and tests only; server.js refuses to use it in production.
function createMemoryStore() {
  let seq = 0, oseq = 0;
  const leads = [], outbox = [];
  const now = () => Date.now();
  const row = (v) => ({
    id: ++seq, ref: newRef(), kind: v.kind, created_at: new Date(), first_name: v.firstName || null, last_name: v.lastName || null,
    email: v.email, email_domain: v.domain, company: v.company || null, role: v.role || null, country: v.country || null,
    region: v.region || null, institution_type: v.institutionType || null, interests: v.interests || [], message: v.message || null,
    marketing_opt_in: !!v.marketingOptIn, consent_version: v.consentVersion, ip_hash: v.ipHash || null,
    user_agent: v.userAgent || null, referrer: v.referrer || null, page: v.page || null, utm: v.utm || {}, risk_flags: v.riskFlags || []
  });
  const enqueue = (leadId, channels) => {
    for (const ch of channels) if (!outbox.some((o) => o.lead_id === leadId && o.channel === ch)) outbox.push({ id: ++oseq, lead_id: leadId, channel: ch, attempts: 0, next_at: now(), locked_until: 0, sent_at: null, last_error: null });
  };
  return {
    kind: 'memory',
    leads, outbox,
    async init() {},
    async createLead(v, { channels, dedupeMinutes }) {
      const since = now() - dedupeMinutes * 60000;
      const dup = leads.filter((l) => l.email.toLowerCase() === v.email.toLowerCase() && l.kind === v.kind && l.created_at.getTime() > since).pop();
      if (dup) return { lead: toLead(dup), duplicate: true };
      const r = row(v);
      leads.push(r);
      enqueue(r.id, channels);
      return { lead: toLead(r), duplicate: false };
    },
    async claimDue(limit, maxAttempts) {
      const t = now();
      const due = outbox.filter((o) => !o.sent_at && o.attempts < maxAttempts && o.next_at <= t && o.locked_until < t).slice(0, limit);
      due.forEach((o) => { o.locked_until = t + 120000; });
      return due.map((o) => ({ id: o.id, channel: o.channel, attempts: o.attempts, lead: toLead(leads.find((l) => l.id === o.lead_id)) }));
    },
    async markSent(id) { const o = outbox.find((x) => x.id === id); if (o) { o.sent_at = now(); o.attempts++; o.locked_until = 0; o.last_error = null; } },
    async markFailed(id, error, delayMs) { const o = outbox.find((x) => x.id === id); if (o) { o.attempts++; o.last_error = String(error); o.locked_until = 0; o.next_at = now() + delayMs; } },
    async purge(days) {
      const cut = now() - days * 86400000;
      let n = 0;
      for (let i = leads.length - 1; i >= 0; i--) if (leads[i].created_at.getTime() < cut) {
        const id = leads[i].id; leads.splice(i, 1); n++;
        for (let j = outbox.length - 1; j >= 0; j--) if (outbox[j].lead_id === id) outbox.splice(j, 1);
      }
      return n;
    },
    async ping() {},
    async close() {}
  };
}

module.exports = { createMemoryStore };
