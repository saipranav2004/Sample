'use strict';

// All configuration comes from the environment. In production the service
// refuses to start without the settings it needs to be safe.

function bool(v, d) {
  if (v == null || v === '') return d;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
}

function int(v, d) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}

function list(v) {
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function trustProxy(v) {
  if (v == null || v === '') return false;
  if (/^\d+$/.test(v)) return int(v, 0);
  if (/^(true|false)$/i.test(v)) return bool(v, false);
  return list(v);
}

function load(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  const c = {
    env: env.NODE_ENV || 'development',
    prod,
    host: env.HOST || '0.0.0.0',
    port: int(env.PORT, 3000),
    logLevel: env.LOG_LEVEL || (prod ? 'info' : 'debug'),
    trustProxy: trustProxy(env.TRUST_PROXY),
    publicUrl: (env.PUBLIC_URL || '').replace(/\/+$/, ''),
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    databaseUrl: env.DATABASE_URL || '',
    databaseSsl: bool(env.DATABASE_SSL, false),
    ipHashSalt: env.IP_HASH_SALT || '',
    consentVersion: env.CONSENT_VERSION || '2026-10',
    retentionDays: int(env.LEAD_RETENTION_DAYS, 730),
    dedupeMinutes: int(env.DEDUPE_MINUTES, 10),
    minFillMs: int(env.MIN_FILL_MS, 2500),
    mxCheck: bool(env.EMAIL_DOMAIN_CHECK, true),
    rateLimit: { max: int(env.RATE_LIMIT_PER_MINUTE, 5), window: '1 minute' },
    turnstile: { siteKey: env.TURNSTILE_SITE_KEY || '', secret: env.TURNSTILE_SECRET || '' },
    bookingUrl: env.BOOKING_URL || '',
    company: {
      name: env.COMPANY_NAME || 'Zenstra AI',
      address: env.COMPANY_ADDRESS || '8 The Green, Suite B, Dover, DE 19901, USA',
      salesEmail: env.SALES_REPLY_TO || ''
    },
    smtp: {
      url: env.SMTP_URL || '',
      from: env.MAIL_FROM || '',
      salesTo: list(env.SALES_NOTIFY_EMAILS)
    },
    slackWebhook: env.SLACK_WEBHOOK_URL || '',
    hubspot: {
      portalId: env.HUBSPOT_PORTAL_ID || '',
      formId: env.HUBSPOT_DEMO_FORM_ID || '',
      subscriptionTypeId: env.HUBSPOT_SUBSCRIPTION_TYPE_ID || ''
    },
    crmWebhook: { url: env.CRM_WEBHOOK_URL || '', secret: env.CRM_WEBHOOK_SECRET || '' },
    worker: { intervalMs: int(env.OUTBOX_INTERVAL_MS, 5000), maxAttempts: int(env.OUTBOX_MAX_ATTEMPTS, 8) }
  };

  const problems = [];
  if (prod) {
    if (!c.databaseUrl) problems.push('DATABASE_URL is required');
    if (c.ipHashSalt.length < 16) problems.push('IP_HASH_SALT must be at least 16 characters');
    if (!/^https?:\/\//.test(c.publicUrl)) problems.push('PUBLIC_URL must be an absolute URL');
    if (!c.allowedOrigins.length) problems.push('ALLOWED_ORIGINS is required');
  }
  if (c.smtp.url && !c.smtp.from) problems.push('MAIL_FROM is required when SMTP_URL is set');
  if (c.crmWebhook.url && c.crmWebhook.secret.length < 16) problems.push('CRM_WEBHOOK_SECRET must be at least 16 characters when CRM_WEBHOOK_URL is set');
  if (c.turnstile.siteKey && !c.turnstile.secret) problems.push('TURNSTILE_SECRET is required when TURNSTILE_SITE_KEY is set');
  if (c.bookingUrl && !/^https:\/\//.test(c.bookingUrl)) problems.push('BOOKING_URL must use https');
  if (problems.length) throw new Error('Invalid configuration: ' + problems.join('; '));
  return c;
}

module.exports = { load };
