'use strict';

const nodemailer = require('nodemailer');

const COMPANY = 'Zenstra AI · 8 The Green, Suite B, Dover, DE 19901, USA';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const who = (l) => [l.firstName, l.lastName].filter(Boolean).join(' ');

function layout(title, bodyHtml, bodyText, why) {
  const html = `<!doctype html><html><body style="margin:0;background:#f7fbff;font-family:Arial,Helvetica,sans-serif;color:#0a2545">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dbe7f3;border-radius:12px">
<tr><td style="padding:28px 32px 8px;font-size:13px;letter-spacing:2px;color:#005aa4;font-weight:bold">ZENSTRA AI</td></tr>
<tr><td style="padding:8px 32px 0;font-size:22px;font-weight:bold;line-height:1.3">${esc(title)}</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:15px;line-height:1.6;color:#33506e">${bodyHtml}</td></tr></table>
<p style="max-width:560px;font-size:12px;line-height:1.5;color:#6b87a6;margin:16px auto 0">${esc(why)}<br>${esc(COMPANY)}</p>
</td></tr></table></body></html>`;
  return { html, text: `${title}\n\n${bodyText}\n\n--\n${why}\n${COMPANY}\n` };
}

// To sales: everything the visitor entered. Replying goes straight to them.
function salesMail(l) {
  const rows = [
    ['Reference', l.ref], ['Name', who(l)], ['Email', l.email], ['Company', l.company],
    ['Product', (l.interests || []).join(', ')], ['Message', l.message],
    ['Source', [l.utm && l.utm.source, l.utm && l.utm.campaign].filter(Boolean).join(' / ') || l.referrer]
  ].filter((r) => r[1]);
  const title = `Demo request: ${who(l)}${l.company ? ', ' + l.company : ''}`;
  const html = `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#6b87a6;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join('')}</table>`;
  return Object.assign({ subject: `${title} (${l.ref})` }, layout(title, html, rows.map(([k, v]) => `${k}: ${v}`).join('\n'), 'Sent by the zenstra.ai demo form.'));
}

// To the visitor: a short confirmation.
function visitorMail(l, publicUrl) {
  const first = l.firstName || 'there';
  const why = `You are receiving this because this address was entered on ${publicUrl}. If that was not you, ignore this email and nothing else will be sent.`;
  const html = `<p>Hi ${esc(first)},</p><p>Thanks for asking to see Zenstra. A security engineer will reply within one business day to set a time.</p><p>In 30 minutes we connect Zenstra to one of your agents, run a live prompt injection against it and walk you through the decision record. No slides.</p><p style="color:#6b87a6">Reference: ${esc(l.ref)}</p>`;
  const text = `Hi ${first},\n\nThanks for asking to see Zenstra. A security engineer will reply within one business day to set a time.\n\nIn 30 minutes we connect Zenstra to one of your agents, run a live prompt injection against it and walk you through the decision record. No slides.\n\nReference: ${l.ref}`;
  return Object.assign({ subject: `We received your request (${l.ref})` }, layout('Your demo request', html, text, why));
}

function createMailer(config, transport) {
  const t = transport || nodemailer.createTransport(config.smtpUrl, { connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 });
  return {
    // The sales email must go out, or the request fails and the visitor is
    // told to email us instead. The confirmation is a courtesy: if it fails,
    // the request still counts.
    async send(lead, log) {
      await t.sendMail(Object.assign({ from: config.mailFrom, to: config.salesTo, replyTo: lead.email }, salesMail(lead)));
      try { await t.sendMail(Object.assign({ from: config.mailFrom, to: lead.email, replyTo: config.salesTo[0] }, visitorMail(lead, config.publicUrl))); }
      catch (e) { if (log) log.warn({ err: e.message, ref: lead.ref }, 'confirmation email failed'); }
    }
  };
}

module.exports = { createMailer, salesMail, visitorMail };
