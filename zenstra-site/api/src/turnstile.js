'use strict';

// Cloudflare Turnstile server-side check. Returns 'ok', 'fail' (the token was
// checked and rejected) or 'unavailable' (Cloudflare could not be reached; the
// lead is accepted with a risk flag rather than losing a real buyer).
async function verifyTurnstile({ secret, token, ip, fetchImpl = fetch }) {
  if (!token) return 'fail';
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return 'unavailable';
    const j = await res.json();
    return j.success ? 'ok' : 'fail';
  } catch (e) {
    return 'unavailable';
  }
}

module.exports = { verifyTurnstile };
