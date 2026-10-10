'use strict';

const crypto = require('node:crypto');
const nodemailer = require('nodemailer');

// Text shown next to the form. Stored by version with each lead, and sent to
// HubSpot as the consent record.
const NOTICE = 'By submitting, you agree that Zenstra may contact you about this request, as described in our privacy notice.';
const OPTIN = 'Send me occasional product updates and research. Unsubscribe any time.';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const who = (l) => l.name || [l.firstName, l.lastName].filter(Boolean).join(' ');
const KIND = { demo: 'Demo request', documents: 'Document request', newsletter: 'Newsletter' };

// Which notifications a lead needs, given what is configured.
function channelsFor(kind, config, phase = 'created') {
  const mail = !!config.smtp.url;
  const hub = config.hubspot.portalId && config.hubspot.forms[kind];
  const ch = [];
  if (kind === 'newsletter') {
    if (phase === 'created') { if (mail) ch.push('optin_email'); return ch; }
    if (hub) ch.push('hubspot');
    if (config.crmWebhook.url) ch.push('crm_webhook');
    return ch;
  }
  if (config.slackWebhook) ch.push('slack');
  if (mail && (kind === 'documents' ? (config.smtp.trustTo.length || config.smtp.salesTo.length) : config.smtp.salesTo.length)) ch.push('team_email');
  if (mail) ch.push('confirmation_email');
  if (hub) ch.push('hubspot');
  if (config.crmWebhook.url) ch.push('crm_webhook');
  return ch;
}

function rows(l) {
  return [
    ['Reference', l.ref], ['Name', who(l)], ['Email', l.email], ['Company', l.company], ['Role', l.role],
    ['Country', [l.region, l.country].filter(Boolean).join(', ')], ['Institution', l.institutionType],
    ['Interested in', (l.interests || []).join(', ')], ['Document', l.document], ['Message', l.message],
    ['Product updates', l.kind === 'newsletter' ? null : (l.marketingOptIn ? 'Yes' : 'No')],
    ['Source', [l.utm && l.utm.source, l.utm && l.utm.campaign].filter(Boolean).join(' / ') || l.referrer], ['Flags', (l.riskFlags || []).join(', ')]
  ].filter((r) => r[1]);
}

function layout(config, title, bodyHtml, bodyText, why) {
  const foot = `${config.company.name} · ${config.company.address}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f7fbff;font-family:Arial,Helvetica,sans-serif;color:#0a2545">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dbe7f3;border-radius:12px">
<tr><td style="padding:28px 32px 8px;font-size:13px;letter-spacing:2px;color:#005aa4;font-weight:bold">ZENSTRA AI</td></tr>
<tr><td style="padding:8px 32px 0;font-size:22px;font-weight:bold;line-height:1.3">${esc(title)}</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:15px;line-height:1.6;color:#33506e">${bodyHtml}</td></tr></table>
<p style="max-width:560px;font-size:12px;line-height:1.5;color:#6b87a6;margin:16px auto 0">${esc(why)}<br>${esc(foot)}</p>
</td></tr></table></body></html>`;
  const text = `${title}\n\n${bodyText}\n\n--\n${why}\n${foot}\n`;
  return { html, text };
}

function teamMail(config, l) {
  const r = rows(l);
  const title = `${KIND[l.kind]}: ${who(l)}${l.company ? ', ' + l.company : ''}`;
  const html = `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${r.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#6b87a6;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join('')}</table>`;
  const text = r.map(([k, v]) => `${k}: ${v}`).join('\n');
  return Object.assign({ subject: `${title} (${l.ref})` }, layout(config, title, html, text, 'Sent by the zenstra.ai lead intake.'));
}

function bookingLink(config, l) {
  if (!config.bookingUrl || l.kind !== 'demo') return '';
  return config.bookingUrl.replace('{name}', encodeURIComponent(who(l))).replace('{email}', encodeURIComponent(l.email)).replace('{ref}', encodeURIComponent(l.ref));
}

function visitorMail(config, l) {
  const first = l.firstName || (l.name || '').split(' ')[0] || 'there';
  const why = `You are receiving this because this address was entered on ${config.publicUrl || 'zenstra.ai'}. If that was not you, ignore this email and nothing else will be sent.`;
  if (l.kind === 'demo') {
    const book = bookingLink(config, l);
    const title = 'Your technical session request';
    const html = `<p>Hi ${esc(first)},</p><p>Thanks for asking to see Zenstra. A security engineer will reply within one business day to set a time.</p>`
      + (book ? `<p>Prefer to pick a time now? <a href="${esc(book)}" style="color:#005aa4">Choose a slot</a>.</p>` : '')
      + `<p>In 30 minutes we connect Zenstra to one of your agents, run a live prompt injection against it and walk you through the decision record. No slides.</p><p style="color:#6b87a6">Reference: ${esc(l.ref)}</p>`;
    const text = `Hi ${first},\n\nThanks for asking to see Zenstra. A security engineer will reply within one business day to set a time.${book ? '\n\nPick a time now: ' + book : ''}\n\nIn 30 minutes we connect Zenstra to one of your agents, run a live prompt injection against it and walk you through the decision record. No slides.\n\nReference: ${l.ref}`;
    return Object.assign({ subject: `We received your request (${l.ref})` }, layout(config, title, html, text, why));
  }
  const doc = l.document || 'our security documentation';
  const title = 'Your document request';
  const html = `<p>Hi ${esc(first)},</p><p>We received your request for ${esc(doc)}. Our trust team will email you a mutual NDA and a secure access link within one business day.</p><p style="color:#6b87a6">Reference: ${esc(l.ref)}</p>`;
  const text = `Hi ${first},\n\nWe received your request for ${doc}. Our trust team will email you a mutual NDA and a secure access link within one business day.\n\nReference: ${l.ref}`;
  return Object.assign({ subject: `We received your request (${l.ref})` }, layout(config, title, html, text, why));
}

function optinMail(config, l) {
  const link = `${config.publicUrl}/api/subscriptions/confirm?token=${encodeURIComponent(l.confirmToken)}`;
  const title = 'Confirm your subscription';
  const html = `<p>Please confirm that you want product updates and research from Zenstra.</p><p><a href="${esc(link)}" style="display:inline-block;background:#005aa4;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Confirm subscription</a></p><p style="color:#6b87a6">If you did not ask for this, ignore this email and you will not be subscribed.</p>`;
  const text = `Please confirm that you want product updates and research from Zenstra:\n${link}\n\nIf you did not ask for this, ignore this email and you will not be subscribed.`;
  return Object.assign({ subject: 'Confirm your Zenstra subscription' }, layout(config, title, html, text, 'Sent because this address was entered in the newsletter form.'));
}

function publicLead(l) {
  const { confirmToken, ...rest } = l;
  return rest;
}

async function post(fetchImpl, url, body, headers) {
  const res = await fetchImpl(url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers), body, signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${t.slice(0, 200)}`);
  }
}

function createNotifier(config, { mailer, fetchImpl = fetch } = {}) {
  let transport = mailer || null;
  const mail = (msg) => {
    if (!transport) transport = nodemailer.createTransport(config.smtp.url);
    return transport.sendMail(Object.assign({ from: config.smtp.from }, msg));
  };
  const handlers = {
    async slack(l) {
      const r = rows(l).filter(([k]) => !['Message', 'Flags'].includes(k));
      const text = `*${KIND[l.kind]}* · ${who(l)}${l.company ? ' · ' + l.company : ''} (${l.ref})`;
      const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text } },
        { type: 'section', fields: r.slice(0, 10).map(([k, v]) => ({ type: 'mrkdwn', text: `*${k}*\n${String(v).slice(0, 200)}` })) }
      ];
      if (l.message) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `>${l.message.slice(0, 500)}` } });
      if ((l.riskFlags || []).length) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `Flags: ${l.riskFlags.join(', ')}` }] });
      await post(fetchImpl, config.slackWebhook, JSON.stringify({ text, blocks }));
    },
    async team_email(l) {
      const to = l.kind === 'documents' && config.smtp.trustTo.length ? config.smtp.trustTo : config.smtp.salesTo;
      await mail(Object.assign({ to, replyTo: l.email }, teamMail(config, l)));
    },
    async confirmation_email(l) {
      await mail(Object.assign({ to: l.email, replyTo: config.company.salesEmail || undefined }, visitorMail(config, l)));
    },
    async optin_email(l) {
      await mail(Object.assign({ to: l.email }, optinMail(config, l)));
    },
    async hubspot(l) {
      const fields = [['email', l.email], ['firstname', l.firstName || (l.name || '').split(' ')[0]], ['lastname', l.lastName || (l.name || '').split(' ').slice(1).join(' ')],
        ['company', l.company], ['jobtitle', l.role], ['country', l.country], ['state', l.region],
        ['message', [l.message, l.institutionType && 'Institution: ' + l.institutionType, (l.interests || []).length && 'Interests: ' + l.interests.join(', '), l.document && 'Document: ' + l.document, 'Reference: ' + l.ref].filter(Boolean).join('\n')]]
        .filter(([, v]) => v).map(([name, value]) => ({ objectTypeId: '0-1', name, value: String(value) }));
      const consent = { consentToProcess: true, text: NOTICE, communications: [] };
      if (config.hubspot.subscriptionTypeId && l.marketingOptIn) consent.communications.push({ value: true, subscriptionTypeId: Number(config.hubspot.subscriptionTypeId), text: OPTIN });
      const body = { submittedAt: String(Date.parse(l.createdAt) || Date.now()), fields, context: { pageUri: l.page || config.publicUrl, pageName: KIND[l.kind] }, legalConsentOptions: { consent } };
      await post(fetchImpl, `https://api.hsforms.com/submissions/v3/integration/submit/${encodeURIComponent(config.hubspot.portalId)}/${encodeURIComponent(config.hubspot.forms[l.kind])}`, JSON.stringify(body));
    },
    async crm_webhook(l) {
      const body = JSON.stringify({ event: l.status === 'confirmed' ? 'lead.confirmed' : 'lead.created', sentAt: new Date().toISOString(), lead: publicLead(l) });
      const t = Math.floor(Date.now() / 1000);
      const sig = crypto.createHmac('sha256', config.crmWebhook.secret).update(`${t}.${body}`).digest('hex');
      await post(fetchImpl, config.crmWebhook.url, body, { 'x-zenstra-signature': `t=${t},v1=${sig}` });
    }
  };
  return {
    async send(channel, lead) {
      const h = handlers[channel];
      if (!h) throw new Error('unknown channel ' + channel);
      await h(lead);
    }
  };
}

module.exports = { createNotifier, channelsFor, bookingLink, NOTICE, OPTIN, teamMail, visitorMail, optinMail };
