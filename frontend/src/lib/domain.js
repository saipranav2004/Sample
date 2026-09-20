/**
 * Colour policy.
 *
 * Colour in this product encodes STATUS and nothing else: the four severity
 * tiers plus neutral. Data marks get one hue - the brand - and context gets
 * grey.
 *
 * There is deliberately no categorical palette. Where several categories must
 * be compared, the chart form carries the comparison (a ranked bar list) and
 * the category name carries the identity, because hue is a poor primary cue
 * for category and cannot express magnitude at all. The one exception is
 * identity *kind* - two values, sitting beside a text label as a secondary
 * cue. See docs/UX-DECISIONS.md section 3.
 */
export const DATA_HUE = 'var(--t-data)';
export const KIND_HUMAN = 'var(--t-kind-human)';
export const KIND_MACHINE = 'var(--t-kind-machine)';

/* ── Identity classification ─────────────────────────────────────────────── */

/**
 * Canonical order, used to keep lists and legends stable between renders.
 * It no longer maps to colours - only to sequence.
 */
export const CLASSIFICATION_ORDER = [
  'HUMAN',
  'NHI_SERVICE',
  'NHI_AGENT',
  'NHI_CICD',
  'NHI_SAAS',
  'NHI_EPHEMERAL',
  'DUAL_IDENTITY',
  'UNCLASSIFIED',
];

export const CLASSIFICATIONS = {
  HUMAN: { label: 'Human', kind: 'human' },
  NHI_SERVICE: { label: 'Service', kind: 'nhi' },
  NHI_AGENT: { label: 'Agent', kind: 'nhi' },
  NHI_CICD: { label: 'CI/CD', kind: 'nhi' },
  NHI_SAAS: { label: 'SaaS', kind: 'nhi' },
  NHI_EPHEMERAL: { label: 'Ephemeral', kind: 'nhi' },
  DUAL_IDENTITY: { label: 'Dual identity', kind: 'nhi' },
  UNCLASSIFIED: { label: 'Unclassified', kind: 'unknown' },
};

/**
 * A classification the scanner starts emitting that is not in the table above
 * still resolves to a label and a kind, so nothing is dropped from a list.
 */
export function classificationMeta(value) {
  const key = String(value || '').toUpperCase();
  const entry = CLASSIFICATIONS[key];
  const kind = entry?.kind ?? 'unknown';
  return {
    label: entry?.label ?? (key ? key.replace(/_/g, ' ') : 'Unclassified'),
    kind,
    /* Two hues, never eight - and only ever beside the label, never alone. */
    color: kind === 'human' ? KIND_HUMAN : KIND_MACHINE,
  };
}

/* ── Severity / risk tier (credentials + code findings share this scale) ─── */

export const SEVERITIES = {
  CRITICAL: { label: 'Critical', tone: 'critical', weight: 4 },
  HIGH: { label: 'High', tone: 'high', weight: 3 },
  MEDIUM: { label: 'Medium', tone: 'medium', weight: 2 },
  LOW: { label: 'Low', tone: 'low', weight: 1 },
};

export const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export function severityMeta(value) {
  const key = String(value || '').toUpperCase();
  return SEVERITIES[key] || { label: value ? String(value) : 'Unrated', tone: 'neutral', weight: 0 };
}

/* ── Ownership ───────────────────────────────────────────────────────────── */

export const OWNER_TYPES = {
  HUMAN: { label: 'Human owner', tone: 'info' },
  NHI_CICD: { label: 'CI/CD managed', tone: 'brand' },
  NHI_IAC: { label: 'IaC managed', tone: 'brand' },
  AWS_SERVICE: { label: 'AWS service', tone: 'neutral' },
  ORPHANED: { label: 'Orphaned', tone: 'high' },
};

export function ownerTypeMeta(value) {
  const key = String(value || '').toUpperCase();
  return OWNER_TYPES[key] || { label: value ? String(value).replace(/_/g, ' ') : 'Unassigned', tone: 'neutral' };
}

/* ── Posture signals ─────────────────────────────────────────────────────────
   Each signal reads one real summary counter and links to the identity
   explorer using a filter the API genuinely supports.
   ------------------------------------------------------------------------- */

export const POSTURE_SIGNALS = [
  {
    key: 'without_mfa',
    label: 'Humans without MFA',
    field: 'total_humans_without_mfa',
    denominator: 'total_humans',
    denominatorLabel: 'of human identities',
    tone: 'critical',
    query: { without_mfa: 'true' },
    rationale: 'Console identities that can authenticate with a password alone.',
  },
  {
    key: 'admin',
    label: 'Admin-level access',
    field: 'total_admin',
    denominator: 'total_identities',
    denominatorLabel: 'of all identities',
    tone: 'critical',
    query: { is_admin: 'true' },
    rationale: 'Identities carrying an administrator-equivalent policy.',
  },
  {
    key: 'orphaned',
    label: 'Orphaned identities',
    field: 'total_orphaned',
    denominator: 'total_identities',
    denominatorLabel: 'of all identities',
    tone: 'high',
    query: { owner_type: 'ORPHANED' },
    rationale: 'No owner, team or creator could be resolved from tags or CloudTrail.',
  },
  {
    key: 'stale',
    label: 'Stale for 90+ days',
    field: 'total_stale_90plus',
    denominator: 'total_identities',
    denominatorLabel: 'of all identities',
    tone: 'high',
    query: { is_stale: 'true' },
    rationale: 'No recorded activity in over 90 days - candidates for removal.',
  },
  {
    key: 'inactive',
    label: 'Inactive 30-90 days',
    field: 'total_inactive_30plus',
    denominator: 'total_identities',
    denominatorLabel: 'of all identities',
    tone: 'medium',
    query: { is_inactive: 'true' },
    rationale: 'Dormant but not yet stale. Worth confirming they are still needed.',
  },
  {
    key: 'secrets',
    label: 'Secret-backed identities',
    field: 'total_secrets',
    denominator: 'total_identities',
    denominatorLabel: 'of all identities',
    tone: 'medium',
    query: { is_secret: 'true' },
    rationale: 'Identities whose credentials are held in a secret store entry.',
  },
  {
    key: 'federated',
    label: 'Federated trust',
    field: 'total_federated',
    denominator: 'total_identities',
    denominatorLabel: 'of all identities',
    tone: 'info',
    query: { is_federated: 'true' },
    rationale: 'Assumed through SAML or OIDC rather than long-lived keys.',
  },
];

/* ── Code exposure (Secret Scanner) ──────────────────────────────────────── */

export const RECOMMENDED_ACTIONS = {
  TRIGGER_REMEDIATION: { label: 'Trigger remediation', tone: 'critical', rank: 4 },
  PAGE_ON_CALL: { label: 'Page on-call', tone: 'critical', rank: 3 },
  NOTIFY_SOC: { label: 'Notify SOC', tone: 'high', rank: 2 },
  LOG_ONLY: { label: 'Log only', tone: 'neutral', rank: 1 },
};

export function recommendedActionMeta(value) {
  const key = String(value || '').toUpperCase();
  return (
    RECOMMENDED_ACTIONS[key] || {
      label: value ? String(value).replace(/_/g, ' ') : 'No action recorded',
      tone: 'neutral',
      rank: 0,
    }
  );
}

export const PLATFORMS = {
  github: { label: 'GitHub', tone: 'brand' },
  codecommit: { label: 'CodeCommit', tone: 'info' },
};

/**
 * Per the integration guide a finding recorded before platform tracking
 * existed can come back with `platform: null`, and those are always
 * CodeCommit. Normalise here so no screen repeats the null check.
 */
export function normalisePlatform(value) {
  return String(value || '').toLowerCase() === 'github' ? 'github' : 'codecommit';
}

export function platformMeta(value) {
  return PLATFORMS[normalisePlatform(value)];
}

/** Exactly one of the two URI fields is populated; label the link accordingly. */
export function findingLink(finding) {
  if (finding?.codecommit_uri) return { href: finding.codecommit_uri, label: 'Open in AWS' };
  if (finding?.github_uri) return { href: finding.github_uri, label: 'Open on GitHub' };
  return null;
}

/** Identity key for allowlist writes - the four fields the service requires. */
export function allowlistKey(finding) {
  return [finding?.client_id, finding?.file_path, finding?.detector, finding?.redacted].join('␟');
}

export function toAllowlistPayload(finding, reason) {
  return {
    clientId: finding.client_id,
    filePath: finding.file_path,
    detector: finding.detector,
    redacted: finding.redacted,
    ...(reason ? { reason } : {}),
  };
}

/* ── Scans ───────────────────────────────────────────────────────────────── */

export const SCAN_STATUSES = {
  COMPLETED: { label: 'Completed', tone: 'low' },
  RUNNING: { label: 'Running', tone: 'info' },
  FAILED: { label: 'Failed', tone: 'critical' },
  PARTIAL: { label: 'Partial', tone: 'medium' },
};

export function scanStatusMeta(value) {
  const key = String(value || '').toUpperCase();
  return SCAN_STATUSES[key] || { label: value ? String(value) : 'Unknown', tone: 'neutral' };
}

/* ── Lineage ─────────────────────────────────────────────────────────────── */

export function lineageDirectionMeta(direction) {
  const key = String(direction || '').toUpperCase();
  if (key === 'OUTBOUND') return { label: 'Accesses', tone: 'brand' };
  if (key === 'INBOUND') return { label: 'Accessed by', tone: 'info' };
  return { label: direction ? String(direction) : 'Related', tone: 'neutral' };
}
