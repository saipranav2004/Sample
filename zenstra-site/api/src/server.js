'use strict';

const { load } = require('./config');
const { buildApp } = require('./app');
const { createMailer } = require('./mail');

let config;
try { config = load(); } catch (e) { console.error(e.message); process.exit(1); }
const logger = {
  level: 'info',
  // Keep personal data (IP addresses, query strings) out of the logs.
  serializers: { req: (r) => ({ method: r.method, url: String(r.url).split('?')[0] }), res: (r) => ({ statusCode: r.statusCode }) }
};
if (!config.smtpUrl) console.warn('SMTP_URL is not set: demo requests will fail to send. Fine for a quick local look, never in production.');
const mailer = config.smtpUrl ? createMailer(config) : { send: async () => { throw new Error('SMTP_URL is not set'); } };
const app = buildApp({ config, mailer, logger });

app.listen({ host: '0.0.0.0', port: config.port }).then(() => app.log.info('demo request API ready'), (e) => { console.error(e.message); process.exit(1); });
const stop = () => app.close().then(() => process.exit(0), () => process.exit(1));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
