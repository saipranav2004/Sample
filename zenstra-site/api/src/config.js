'use strict';

// Four settings, all from the environment:
//   DOMAIN       the site's domain; the form is accepted only from it
//   SMTP_URL     smtp://user:pass@host:587 or smtps://user:pass@host:465
//   SALES_EMAIL  who receives demo requests (comma-separated)
//   MAIL_FROM    optional sender; defaults to "Zenstra <no-reply@DOMAIN>"
// In production the service refuses to start without the ones it needs.
function load(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  const domain = String(env.DOMAIN || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const local = !domain || domain === 'localhost';
  const c = {
    prod,
    port: Number.parseInt(env.PORT, 10) || 3000,
    // Behind the web container (and Caddy in production): trust one proxy hop for the client IP.
    trustProxy: env.TRUST_PROXY ? Number.parseInt(env.TRUST_PROXY, 10) || true : false,
    publicUrl: local ? 'http://localhost:8080' : `https://${domain}`,
    allowedOrigins: local ? ['http://localhost:8080', 'https://localhost'] : [`https://${domain}`, `https://www.${domain}`],
    smtpUrl: String(env.SMTP_URL || '').trim(),
    mailFrom: String(env.MAIL_FROM || '').trim() || `Zenstra <no-reply@${local ? 'localhost' : domain}>`,
    salesTo: String(env.SALES_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean),
    // Fixed choices that used to be settings.
    rateLimitPerMinute: 5,
    minFillMs: 2500
  };
  const problems = [];
  if (prod && !c.smtpUrl) problems.push('SMTP_URL is required');
  if (prod && !c.salesTo.length) problems.push('SALES_EMAIL is required');
  if (c.smtpUrl && !/^smtps?:\/\//.test(c.smtpUrl)) problems.push('SMTP_URL must start with smtp:// or smtps://');
  if (problems.length) throw new Error('Invalid configuration: ' + problems.join('; '));
  return c;
}

module.exports = { load };
