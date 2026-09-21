/**
 * Categorical slots in fixed order. The order is validated (OKLab CVD
 * separation, chroma floor, contrast against both surfaces) and must not be
 * reshuffled or cycled: slot 8 is a reserved neutral for
 * "Unclassified"/"Other" and is never used as an eighth hue.
 */
export const SERIES_TOKENS = [
  'var(--t-series-1)',
  'var(--t-series-2)',
  'var(--t-series-3)',
  'var(--t-series-4)',
  'var(--t-series-5)',
  'var(--t-series-6)',
  'var(--t-series-7)',
];

export const NEUTRAL_SERIES = 'var(--t-series-8)';

export const RAMP_TOKENS = [
  'var(--t-ramp-1)',
  'var(--t-ramp-2)',
  'var(--t-ramp-3)',
  'var(--t-ramp-4)',
  'var(--t-ramp-5)',
];

/** Magnitude ramp step for a value within [0, max] - one hue, light to dark. */
export function rampColor(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return RAMP_TOKENS[0];
  const index = Math.min(RAMP_TOKENS.length - 1, Math.floor((value / max) * RAMP_TOKENS.length));
  return RAMP_TOKENS[Math.max(0, index)];
}

/* ── Identity classification ─────────────────────────────────────────────── */

/**
 * Canonical order. Charts render classifications in this order rather than by
 * value so a colour always means the same category and adjacent slices keep
 * the separation the palette was validated for.
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
  HUMAN: { label: 'Human', tone: 'info', color: SERIES_TOKENS[0], kind: 'human' },
  NHI_SERVICE: { label: 'Service', tone: 'brand', color: SERIES_TOKENS[1], kind: 'nhi' },
  NHI_AGENT: { label: 'Agent', tone: 'brand', color: SERIES_TOKENS[2], kind: 'nhi' },
  NHI_CICD: { label: 'CI/CD', tone: 'brand', color: SERIES_TOKENS[3], kind: 'nhi' },
  NHI_SAAS: { label: 'SaaS', tone: 'brand', color: SERIES_TOKENS[4], kind: 'nhi' },
  NHI_EPHEMERAL: { label: 'Ephemeral', tone: 'brand', color: SERIES_TOKENS[5], kind: 'nhi' },
  DUAL_IDENTITY: { label: 'Dual identity', tone: 'high', color: SERIES_TOKENS[6], kind: 'nhi' },
  UNCLASSIFIED: { label: 'Unclassified', tone: 'neutral', color: NEUTRAL_SERIES, kind: 'unknown' },
};

/**
 * A classification the scanner starts emitting that is not in the table above
 * folds into the reserved neutral rather than inventing a hue.
 */
export function classificationMeta(value) {
  const key = String(value || '').toUpperCase();
  return (
    CLASSIFICATIONS[key] || {
      label: key ? key.replace(/_/g, ' ') : 'Unclassified',
      tone: 'neutral',
      color: NEUTRAL_SERIES,
      kind: 'unknown',
    }
  );
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

/* ── Credential exposure (Secret Scanner) ────────────────────────────────── */

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

/* ── Finding enrichment (added by the scanner, additive to the original shape) ─
   The service now returns thirteen extra fields per finding. Nothing existing
   changed, so everything below is read defensively: any of them can be null on
   a finding recorded before the enrichment existed, and six of them are
   permanently null on CodeCommit because CodeCommit has no equivalent concept.
   The distinction matters in the UI - "not recorded" and "does not apply" are
   different statements - so it is made once, here, rather than guessed at by
   each screen.                                                              */

/** Fields that never populate for CodeCommit, per the integration guide. */
const GITHUB_ONLY_FIELDS = [
  'additions',
  'deletions',
  'repo_visibility',
  'repo_stars',
  'repo_forks',
  'repo_pushed_at',
];

export function isGithubOnlyField(field) {
  return GITHUB_ONLY_FIELDS.includes(field);
}

/**
 * Why a field is empty: because this platform cannot supply it, or because the
 * finding predates the field. Screens render a different note for each.
 */
export function missingFieldReason(finding, field) {
  if (finding?.[field] !== null && finding?.[field] !== undefined && finding[field] !== '') {
    return null;
  }
  if (isGithubOnlyField(field) && normalisePlatform(finding?.platform) !== 'github') {
    return 'not-applicable';
  }
  return 'not-recorded';
}

/**
 * Detector certainty, which is not severity.
 *
 * `confidence` is how sure the pattern match is; `risk_tier` is how bad the
 * secret would be if real. Deliberately outside the severity palette so a
 * "high confidence" label can never be misread as "high risk".
 */
export const CONFIDENCE_LEVELS = {
  high: { label: 'High confidence', short: 'High', tone: 'info' },
  medium: { label: 'Medium confidence', short: 'Medium', tone: 'neutral' },
};

export function confidenceMeta(value) {
  const key = String(value || '').toLowerCase();
  return CONFIDENCE_LEVELS[key] ?? null;
}

/**
 * Repository exposure. A committed secret in a public repository has been
 * readable by anyone since the push, which is a material fact about this
 * finding rather than a guess - so it carries a tone. Private is stated
 * neutrally, because private is the baseline expectation, not good news.
 */
export function repoVisibilityMeta(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'public') {
    return { label: 'Public', tone: 'high', note: 'Readable by anyone for as long as the commit has existed.' };
  }
  if (key === 'private') {
    return { label: 'Private', tone: 'neutral', note: 'Limited to accounts with repository access.' };
  }
  return null;
}

/**
 * `commit_authored_at` arrives in two raw shapes, passed through by the service
 * exactly as each platform gave it:
 *   github     ISO 8601, e.g. "2026-09-21T12:46:25Z"
 *   codecommit git's own raw format, e.g. "1758454920 +0530"
 * Parsing the second as a date string yields Invalid Date, so branch on the
 * shape rather than on the platform - a finding can carry either.
 */
export function parseCommitAuthoredAt(value) {
  if (!value) return null;
  const raw = String(value).trim();

  const gitRaw = /^(\d{9,11})\s*([+-]\d{4})?$/.exec(raw);
  if (gitRaw) {
    const date = new Date(Number(gitRaw[1]) * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * How large the commit was. `files_changed` counts different things on each
 * platform (GitHub's diff stats versus what the scanner actually read), so the
 * two are never presented as comparable.
 */
export function commitSize(finding) {
  const platform = normalisePlatform(finding?.platform);
  const files = Number.isFinite(finding?.files_changed) ? finding.files_changed : null;
  const additions = Number.isFinite(finding?.additions) ? finding.additions : null;
  const deletions = Number.isFinite(finding?.deletions) ? finding.deletions : null;
  return {
    files,
    additions,
    deletions,
    /* On CodeCommit this is "files we scanned", which can undercount. */
    filesAreExact: platform === 'github',
    hasLineStats: additions !== null || deletions !== null,
  };
}

/** Whether a finding carries any of the enrichment at all. */
export function hasCommitContext(finding) {
  return Boolean(
    finding?.commit_message ||
      finding?.committer ||
      finding?.commit_authored_at ||
      Number.isFinite(finding?.files_changed),
  );
}

export function hasRepoContext(finding) {
  return Boolean(
    finding?.repo_visibility ||
      Number.isFinite(finding?.repo_stars) ||
      Number.isFinite(finding?.repo_forks) ||
      finding?.repo_pushed_at,
  );
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
