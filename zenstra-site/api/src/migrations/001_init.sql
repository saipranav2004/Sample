-- Demo requests from the website, and an outbox of notifications to deliver for
-- each one (Slack, email, CRM). Rows in the outbox are retried until sent.

CREATE TABLE leads (
  id               BIGSERIAL PRIMARY KEY,
  ref              TEXT NOT NULL UNIQUE,
  kind             TEXT NOT NULL CHECK (kind IN ('demo')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_name       TEXT,
  last_name        TEXT,
  email            TEXT NOT NULL,
  email_domain     TEXT NOT NULL,
  company          TEXT,
  role             TEXT,
  country          TEXT,
  region           TEXT,
  institution_type TEXT,
  interests        TEXT[] NOT NULL DEFAULT '{}',
  message          TEXT,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  consent_version  TEXT NOT NULL,
  consent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash          TEXT,
  user_agent       TEXT,
  referrer         TEXT,
  page             TEXT,
  utm              JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_flags       TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX leads_dedupe_idx ON leads (lower(email), kind, created_at DESC);
CREATE INDEX leads_created_idx ON leads (created_at);

CREATE TABLE outbox (
  id           BIGSERIAL PRIMARY KEY,
  lead_id      BIGINT NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  channel      TEXT NOT NULL,
  attempts     INT NOT NULL DEFAULT 0,
  next_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, channel)
);

CREATE INDEX outbox_due_idx ON outbox (next_at) WHERE sent_at IS NULL;
