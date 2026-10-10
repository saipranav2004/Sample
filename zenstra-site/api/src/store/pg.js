'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { newRef, toLead } = require('./shared');

const MIGRATIONS = path.join(__dirname, '..', 'migrations');
const LOCK_ID = 727274; // advisory lock so only one replica migrates at a time

function createPgStore({ url, ssl, log }) {
  const pool = new Pool({ connectionString: url, ssl: ssl ? { rejectUnauthorized: true } : undefined, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
  pool.on('error', (e) => log.error({ err: e }, 'postgres pool error'));

  async function tx(fn) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }

  return {
    kind: 'postgres',

    async init() {
      const c = await pool.connect();
      try {
        await c.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
        await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
        const done = new Set((await c.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
        for (const f of fs.readdirSync(MIGRATIONS).filter((x) => x.endsWith('.sql')).sort()) {
          if (done.has(f)) continue;
          await c.query('BEGIN');
          try {
            await c.query(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));
            await c.query('INSERT INTO schema_migrations (version) VALUES ($1)', [f]);
            await c.query('COMMIT');
            log.info({ migration: f }, 'migration applied');
          } catch (e) {
            await c.query('ROLLBACK');
            throw e;
          }
        }
      } finally {
        await c.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
        c.release();
      }
    },

    // Inserts the lead and its outbox rows in one transaction. A repeat of the
    // same email and form within the dedupe window returns the first lead.
    async createLead(v, { channels, dedupeMinutes }) {
      return tx(async (c) => {
        const dup = await c.query(
          `SELECT * FROM leads WHERE lower(email) = lower($1) AND kind = $2 AND created_at > now() - make_interval(mins => $3) ORDER BY created_at DESC LIMIT 1`,
          [v.email, v.kind, dedupeMinutes]
        );
        if (dup.rows[0]) return { lead: toLead(dup.rows[0]), duplicate: true };
        let row;
        for (let i = 0; i < 5 && !row; i++) {
          const r = await c.query(
            `INSERT INTO leads (ref, kind, status, first_name, last_name, full_name, email, email_domain, company, role, country, region,
               institution_type, interests, document, message, marketing_opt_in, consent_version, confirm_token, ip_hash, user_agent, referrer, page, utm, risk_flags)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
             ON CONFLICT (ref) DO NOTHING RETURNING *`,
            [newRef(), v.kind, v.status || 'new', v.firstName || null, v.lastName || null, v.name || null, v.email, v.domain, v.company || null,
              v.role || null, v.country || null, v.region || null, v.institutionType || null, v.interests || [], v.document || null, v.message || null,
              !!v.marketingOptIn, v.consentVersion, v.confirmToken || null, v.ipHash || null, v.userAgent || null, v.referrer || null, v.page || null,
              JSON.stringify(v.utm || {}), v.riskFlags || []]
          );
          row = r.rows[0];
        }
        if (!row) throw new Error('could not allocate a reference');
        for (const ch of channels) await c.query('INSERT INTO outbox (lead_id, channel) VALUES ($1, $2) ON CONFLICT DO NOTHING', [row.id, ch]);
        return { lead: toLead(row), duplicate: false };
      });
    },

    async confirm(token, channels) {
      return tx(async (c) => {
        const r = await c.query(`UPDATE leads SET status = 'confirmed', confirmed_at = now() WHERE confirm_token = $1 AND status = 'pending' RETURNING *`, [token]);
        if (!r.rows[0]) {
          const seen = await c.query(`SELECT * FROM leads WHERE confirm_token = $1`, [token]);
          return seen.rows[0] ? { lead: toLead(seen.rows[0]), already: true } : null;
        }
        for (const ch of channels) await c.query('INSERT INTO outbox (lead_id, channel) VALUES ($1, $2) ON CONFLICT DO NOTHING', [r.rows[0].id, ch]);
        return { lead: toLead(r.rows[0]), already: false };
      });
    },

    // Claims due notifications. SKIP LOCKED lets several API replicas share
    // the outbox without sending anything twice.
    async claimDue(limit, maxAttempts) {
      const r = await pool.query(
        `WITH due AS (
           SELECT id FROM outbox
           WHERE sent_at IS NULL AND attempts < $2 AND next_at <= now() AND (locked_until IS NULL OR locked_until < now())
           ORDER BY next_at LIMIT $1 FOR UPDATE SKIP LOCKED)
         UPDATE outbox o SET locked_until = now() + interval '2 minutes'
         FROM due WHERE o.id = due.id
         RETURNING o.id, o.channel, o.attempts, o.lead_id`,
        [limit, maxAttempts]
      );
      if (!r.rows.length) return [];
      const leads = await pool.query('SELECT * FROM leads WHERE id = ANY($1)', [r.rows.map((x) => x.lead_id)]);
      const byId = new Map(leads.rows.map((l) => [String(l.id), toLead(l)]));
      return r.rows.map((x) => ({ id: x.id, channel: x.channel, attempts: x.attempts, lead: byId.get(String(x.lead_id)) })).filter((x) => x.lead);
    },

    async markSent(id) {
      await pool.query('UPDATE outbox SET sent_at = now(), locked_until = NULL, last_error = NULL, attempts = attempts + 1 WHERE id = $1', [id]);
    },

    async markFailed(id, error, delayMs) {
      await pool.query(
        `UPDATE outbox SET attempts = attempts + 1, last_error = $2, locked_until = NULL, next_at = now() + make_interval(secs => $3) WHERE id = $1`,
        [id, String(error).slice(0, 500), Math.round(delayMs / 1000)]
      );
    },

    async purge(days) {
      const r = await pool.query('DELETE FROM leads WHERE created_at < now() - make_interval(days => $1)', [days]);
      return r.rowCount;
    },

    async ping() {
      await pool.query('SELECT 1');
    },

    async close() {
      await pool.end();
    }
  };
}

module.exports = { createPgStore };
