'use strict';

const crypto = require('node:crypto');
const Fastify = require('fastify');
const { validate, schema } = require('./validate');

// Reference shown to the visitor and in both emails, e.g. ZX-7KQ2MD.
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newRef = () => 'ZX-' + Array.from(crypto.randomBytes(6), (b) => ALPHA[b % ALPHA.length]).join('');

function buildApp({ config, mailer, logger }) {
  const app = Fastify({ logger, trustProxy: config.trustProxy, bodyLimit: 16 * 1024, ajv: { customOptions: { allErrors: false, coerceTypes: false, removeAdditional: false } } });
  app.register(require('@fastify/rate-limit'), {
    global: false,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({ statusCode: 429, error: 'rate_limited', message: 'Too many requests. Please try again in a minute.' })
  });

  app.addHook('onSend', async (req, reply, payload) => { reply.header('cache-control', 'no-store'); return payload; });

  // The form only accepts posts from our own pages.
  app.addHook('onRequest', async (req, reply) => {
    if (req.method !== 'POST') return;
    if (!config.allowedOrigins.includes(req.headers.origin)) {
      req.log.warn({ origin: req.headers.origin || null }, 'post from a disallowed origin');
      return reply.code(403).send({ error: 'forbidden_origin', message: 'This form only accepts requests from the Zenstra website.' });
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err.statusCode === 429) return reply.code(429).send({ error: 'rate_limited', message: 'Too many requests. Please try again in a minute.' });
    if (err.validation || (err.statusCode && err.statusCode < 500)) return reply.code(400).send({ error: 'bad_request', message: 'The request was not in the expected format.' });
    req.log.error({ err }, 'request failed');
    return reply.code(500).send({ error: 'internal', message: 'Something went wrong on our side. Please try again, or email us.' });
  });
  app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: 'not_found' }));

  app.register(async (r) => {
    r.get('/api/health', async () => ({ status: 'ok' }));

    r.post('/api/demo-requests', { schema: { body: schema }, config: { rateLimit: { max: config.rateLimitPerMinute, timeWindow: '1 minute' } } }, async (req, reply) => {
      const body = req.body || {};
      // Bot traps answer exactly like a success so they teach a bot nothing.
      if (body.website || (typeof body.elapsedMs === 'number' && body.elapsedMs < config.minFillMs)) {
        req.log.info('submission dropped by a bot trap');
        return reply.code(201).send({ ok: true, ref: newRef() });
      }
      const { value, errors } = validate(body);
      if (errors) return reply.code(422).send({ error: 'validation_failed', message: 'Please check the highlighted fields.', fields: errors });

      const lead = Object.assign(value, { ref: newRef() });
      try {
        await mailer.send(lead, req.log);
      } catch (e) {
        req.log.error({ err: e.message, ref: lead.ref }, 'sales email failed');
        return reply.code(502).send({ error: 'send_failed', message: 'We could not send your request just now.' });
      }
      req.log.info({ ref: lead.ref }, 'demo request sent');
      return reply.code(201).send({ ok: true, ref: lead.ref });
    });
  });
  return app;
}

module.exports = { buildApp, newRef };
