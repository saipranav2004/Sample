'use strict';

const { load } = require('./config');
const { buildApp } = require('./app');
const { createPgStore } = require('./store/pg');
const { createMemoryStore } = require('./store/memory');
const { createNotifier } = require('./notify');
const { createWorker } = require('./worker');
const { checkMailDomain } = require('./domains');
const { verifyTurnstile } = require('./turnstile');

async function main() {
  const config = load();
  const logger = {
    level: config.logLevel,
    // Keep personal data (IP addresses, query strings) out of the logs.
    serializers: {
      req: (r) => ({ id: r.id, method: r.method, url: String(r.url).split('?')[0] }),
      res: (r) => ({ statusCode: r.statusCode })
    },
    redact: ['req.headers.cookie', 'req.headers.authorization']
  };

  // Placeholder log until the app's own logger exists.
  const early = { info: console.log, warn: console.warn, error: console.error };
  let store;
  if (config.databaseUrl) store = createPgStore({ url: config.databaseUrl, ssl: config.databaseSsl, log: early });
  else {
    early.warn('DATABASE_URL is not set: using the in-memory store. Leads will be lost on restart. Never run like this in production.');
    store = createMemoryStore();
  }
  await store.init();

  const notifier = createNotifier(config);
  let worker = null;
  const app = buildApp({
    config, store, logger,
    worker: { kick: () => worker && worker.kick() },
    checkDomain: (d) => checkMailDomain(d),
    verifyCaptcha: verifyTurnstile
  });
  worker = createWorker({ store, notifier, log: app.log, intervalMs: config.worker.intervalMs, maxAttempts: config.worker.maxAttempts, retentionDays: config.retentionDays });

  await app.listen({ host: config.host, port: config.port });
  worker.start();
  app.log.info({ store: store.kind, env: config.env }, 'lead intake API ready');

  let closing = false;
  const shutdown = async (sig) => {
    if (closing) return;
    closing = true;
    app.log.info({ sig }, 'shutting down');
    const force = setTimeout(() => process.exit(1), 15000);
    force.unref();
    try {
      await app.close();
      await worker.stop();
      await store.close();
      process.exit(0);
    } catch (e) {
      app.log.error({ err: e }, 'shutdown failed');
      process.exit(1);
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('unhandledRejection', (e) => app.log.error({ err: e }, 'unhandled rejection'));
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
