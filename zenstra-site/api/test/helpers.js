'use strict';

const { load } = require('../src/config');
const { buildApp } = require('../src/app');
const { createMemoryStore } = require('../src/store/memory');

function makeApp(env = {}, { domain = 'ok', captcha = 'ok' } = {}) {
  const config = load(Object.assign({ NODE_ENV: 'test', LOG_LEVEL: 'silent', EMAIL_DOMAIN_CHECK: 'true' }, env));
  const store = createMemoryStore();
  const kicks = { n: 0 };
  const app = buildApp({
    config, store, logger: false,
    worker: { kick: () => { kicks.n++; } },
    checkDomain: async () => domain,
    verifyCaptcha: async () => captcha
  });
  return { app, store, config, kicks };
}

const demo = (over = {}) => Object.assign({
  firstName: 'Dana', lastName: 'Reyes', email: 'dana.reyes@northbankfcu.org', company: 'Northbank FCU',
  role: 'CISO or security leader', country: 'United States', region: 'Ohio', institutionType: 'Credit union',
  interests: ['Workflow Security'], message: 'Copilot agents in lending', marketingOptIn: false,
  website: '', elapsedMs: 9000, utm: { source: 'linkedin', campaign: 'q4' }, page: 'https://zenstra.ai/demo'
}, over);

module.exports = { makeApp, demo };
