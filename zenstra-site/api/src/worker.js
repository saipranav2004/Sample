'use strict';

// Delivers outbox notifications in the background. A failed delivery is
// retried with exponential backoff (30 s, 1 min, 2 min ... capped at 1 h) until
// it succeeds or reaches maxAttempts. Also purges leads past retention daily.
function createWorker({ store, notifier, log, intervalMs = 5000, maxAttempts = 8, retentionDays = 730 }) {
  let timer = null, purgeTimer = null, busy = null, stopped = false;

  async function run() {
    for (;;) {
      const jobs = await store.claimDue(20, maxAttempts);
      if (!jobs.length) return;
      for (const j of jobs) {
        try {
          await notifier.send(j.channel, j.lead);
          await store.markSent(j.id);
          log.info({ ref: j.lead.ref, channel: j.channel }, 'notification sent');
        } catch (e) {
          const attempt = j.attempts + 1;
          const delay = Math.min(3600000, 30000 * 2 ** (attempt - 1));
          await store.markFailed(j.id, e.message, delay);
          const level = attempt >= maxAttempts ? 'error' : 'warn';
          log[level]({ ref: j.lead.ref, channel: j.channel, attempt, err: e.message }, attempt >= maxAttempts ? 'notification failed permanently' : 'notification failed, will retry');
        }
      }
      if (stopped) return;
    }
  }

  function tick() {
    if (busy || stopped) return busy;
    busy = run().catch((e) => log.error({ err: e }, 'outbox run failed')).finally(() => { busy = null; });
    return busy;
  }

  async function purge() {
    try {
      const n = await store.purge(retentionDays);
      if (n) log.info({ removed: n, retentionDays }, 'expired leads purged');
    } catch (e) {
      log.error({ err: e }, 'purge failed');
    }
  }

  return {
    start() {
      timer = setInterval(tick, intervalMs);
      purgeTimer = setInterval(purge, 24 * 3600 * 1000);
      timer.unref(); purgeTimer.unref();
      setTimeout(purge, 60000).unref();
      tick();
    },
    kick() { setImmediate(tick); },
    tick,
    async stop() {
      stopped = true;
      clearInterval(timer); clearInterval(purgeTimer);
      if (busy) await busy;
    }
  };
}

module.exports = { createWorker };
