'use strict';

const { load } = require('../src/config');
const { buildApp } = require('../src/app');
const { createMailer } = require('../src/mail');

// An app with a fake SMTP transport that records what would be sent.
function makeApp(env = {}, { fail = null } = {}) {
  const config = load(Object.assign({ NODE_ENV: 'test', DOMAIN: 'zenstra.ai', SMTP_URL: 'smtp://localhost:1025', SALES_EMAIL: 'sales@zenstra.ai' }, env));
  const sent = [];
  const transport = { sendMail: async (m) => { if (fail && fail(m)) throw new Error('smtp down'); sent.push(m); } };
  const app = buildApp({ config, mailer: createMailer(config, transport), logger: false });
  return { app, sent, config };
}

const demo = (over = {}) => Object.assign({
  name: 'Dana Reyes', email: 'dana.reyes@northbankfcu.org', company: 'Northbank FCU',
  interest: 'Workflow Security', message: 'Copilot agents in lending',
  website: '', elapsedMs: 9000, utm: { source: 'linkedin', campaign: 'q4' }, page: 'https://zenstra.ai/demo'
}, over);

const post = (app, payload, headers = {}) => app.inject({ method: 'POST', url: '/api/demo-requests', payload, headers: Object.assign({ origin: 'https://zenstra.ai' }, headers) });

module.exports = { makeApp, demo, post };
