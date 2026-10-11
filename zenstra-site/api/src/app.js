'use strict';

const crypto = require('node:crypto');
const Fastify = require('fastify');
const { validate, schemas, MSG } = require('./validate');
const { channelsFor, bookingLink } = require('./notify');
const { newRef } = require('./store/shared');

function buildApp({ config, store, worker, checkDomain, verifyCaptcha, logger }) {
  const app = Fastify({
    logger,
    trustProxy: config.trustProxy,
    bodyLimit: 16 * 1024,
    requestIdHeader: 'x-request-id',
    ajv: { customOptions: { allErrors: false, coerceTypes: false, removeAdditional: false } }
  });

  app.register(require('@fastify/rate-limit'), {
    global: false,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({ statusCode: 429, error: 'rate_limited', message: 'Too many requests. Please try again in a minute.' })
  });

  const salt = config.ipHashSalt || 'development-only-salt';
  const hashIp = (ip) => (ip ? crypto.createHash('sha256').update(salt + ip).digest('hex').slice(0, 32) : null);

  // Nothing the API returns may be cached by a browser or proxy.
  app.addHook('onSend', async (req, reply, payload) => { reply.header('cache-control', 'no-store'); return payload; });

  // Form posts must come from our own pages.
  app.addHook('onRequest', async (req, reply) => {
    if (req.method !== 'POST' || !config.allowedOrigins.length) return;
    const origin = req.headers.origin;
    if (!origin || !config.allowedOrigins.includes(origin)) {
      req.log.warn({ origin: origin || null }, 'post from a disallowed origin');
      return reply.code(403).send({ error: 'forbidden_origin', message: 'This form only accepts requests from the Zenstra website.' });
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err.validation) return reply.code(400).send({ error: 'bad_request', message: 'The request was not in the expected format.' });
    if (err.statusCode === 429) return reply.code(429).send({ error: 'rate_limited', message: 'Too many requests. Please try again in a minute.' });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'bad_request', message: 'The request was not in the expected format.' });
    req.log.error({ err }, 'request failed');
    return reply.code(500).send({ error: 'internal', message: 'Something went wrong on our side. Please try again, or email us.' });
  });
  app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: 'not_found' }));

  // Routes are registered after the rate-limit plugin has loaded, so its
  // per-route limits attach to them.
  app.register(async (r) => {
    r.get('/api/health', async (req, reply) => {
      try {
        await store.ping();
        return { status: 'ok', store: store.kind };
      } catch (e) {
        req.log.error({ err: e }, 'health check failed');
        return reply.code(503).send({ status: 'unavailable' });
      }
    });

    // Public, non-secret settings the forms need.
    r.get('/api/config', async () => ({ turnstileSiteKey: config.turnstile.siteKey || null, booking: !!config.bookingUrl }));

    const limit = { rateLimit: { max: config.rateLimit.max, timeWindow: config.rateLimit.window } };

    // Demo requests: the only form on the site.
    r.post('/api/demo-requests', { schema: { body: schemas.demo }, config: limit }, async (req, reply) => {
      const kind = 'demo', body = req.body || {};
      const flags = [];

      // Bot traps answer exactly like a success so they teach a bot nothing.
      if (body.website) { req.log.info({ kind, trap: 'honeypot' }, 'submission dropped'); return reply.code(201).send({ ok: true, ref: newRef() }); }
      if (typeof body.elapsedMs === 'number' && body.elapsedMs < config.minFillMs) { req.log.info({ kind, trap: 'too_fast', elapsedMs: body.elapsedMs }, 'submission dropped'); return reply.code(201).send({ ok: true, ref: newRef() }); }
      if (typeof body.elapsedMs !== 'number') flags.push('no_timing');

      if (config.turnstile.secret) {
        const v = await verifyCaptcha({ secret: config.turnstile.secret, token: body.turnstileToken, ip: req.ip });
        if (v === 'fail') return reply.code(400).send({ error: 'verification_failed', message: 'Please complete the verification and try again.' });
        if (v === 'unavailable') flags.push('captcha_unavailable');
      }

      const { value, errors } = validate(kind, body);
      if (errors) return reply.code(422).send({ error: 'validation_failed', message: 'Please check the highlighted fields.', fields: errors });

      if (config.mxCheck) {
        const mx = await checkDomain(value.domain);
        if (mx === 'none') return reply.code(422).send({ error: 'validation_failed', message: 'Please check the highlighted fields.', fields: { email: MSG.noDomain } });
        if (mx === 'unknown') flags.push('mail_domain_unverified');
      }

      const lead = Object.assign(value, {
        consentVersion: config.consentVersion,
        ipHash: hashIp(req.ip),
        userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
        riskFlags: flags
      });

      const { lead: saved, duplicate } = await store.createLead(lead, { channels: channelsFor(config), dedupeMinutes: config.dedupeMinutes });
      if (!duplicate) worker.kick();
      req.log.info({ kind, ref: saved.ref, duplicate, flags }, 'lead received');

      const res = { ok: true, ref: saved.ref };
      const b = bookingLink(config, saved); if (b) res.bookingUrl = b;
      return reply.code(201).send(res);
    });
  });

  return app;
}

module.exports = { buildApp };
