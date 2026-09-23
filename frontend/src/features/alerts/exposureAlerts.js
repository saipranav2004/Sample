import { applyTriage, isOpen } from '../../lib/alerts';
import { findingLink, normalisePlatform, platformMeta, repoVisibilityMeta } from '../../lib/domain';
import { humanizeToken, shortBranch, shortCommit } from '../../lib/format';
import { findingKey } from '../exposure/scannerState';

/**
 * Alerts raised from the Secret Scanner's live findings.
 *
 * Built here rather than with the rest because the findings only exist in the
 * browser: the scanner is reached through the proxy, and nothing else in this
 * build can read it. When the console has a backend, that backend ingests the
 * findings and this moves there - the shape does not change.
 *
 * High and medium risk tiers raise an alert; low stays on Exposed credentials.
 * A low-tier finding is worth reviewing, and not worth paging anybody for.
 *
 * They arrive untriaged. The scanner knows who committed a secret, not who
 * owns the credential inside it, so there is nobody to route to until a person
 * picks it up - which is what the New column is for.
 */

const RAISING_TIERS = new Set(['CRITICAL', 'HIGH', 'MEDIUM']);

export const EXPOSURE_ALERT_PREFIX = 'secret-exposed:';

export function exposureAlertId(finding) {
  return `${EXPOSURE_ALERT_PREFIX}${findingKey(finding)}`;
}

function raise(finding) {
  const tier = String(finding.risk_tier || '').toUpperCase();
  const platform = platformMeta(finding.platform);
  const visibility = repoVisibilityMeta(finding.repo_visibility);
  const detector = humanizeToken(finding.detector);
  const link = findingLink(finding);

  return {
    id: exposureAlertId(finding),
    rule: 'secret-exposed',
    source: 'exposure',
    severity: tier,
    createdAt: finding.created_at,
    title: `${detector} committed to ${finding.repository || 'a repository'}`,
    summary: `${finding.file_path}:${finding.line_number ?? '?'} on ${shortBranch(finding.branch) || 'the default branch'}, commit ${shortCommit(finding.commit_id)}. The value is masked as ${finding.redacted || 'unknown'}.`,
    impact:
      visibility?.label === 'Public'
        ? 'The repository is public, so the secret has been readable by anyone since the push - and deleting the commit does not unpublish it.'
        : 'Anyone with access to the repository, or to any clone or fork of it, can read the secret. Deleting the commit does not remove it from those copies.',
    recommendation:
      'Rotate the credential at its source first - that is the only step that closes the exposure. Then remove it from the code and, if the repository allows, from history.',
    evidence: [
      { label: 'Detector', value: detector },
      { label: 'Platform', value: platform.label },
      { label: 'Repository', value: finding.repository || '-' },
      { label: 'Committed by', value: finding.committer || finding.author || '-' },
      ...(visibility ? [{ label: 'Visibility', value: visibility.label }] : []),
    ],
    entity: {
      kind: 'Finding',
      name: finding.file_path,
      detail: `${platform.label} · ${finding.repository || 'unknown repository'}`,
      to: `/exposure?search=${encodeURIComponent(finding.file_path || '')}`,
      linkLabel: 'Open in Exposed credentials',
      externalHref: link?.href ?? null,
      externalLabel: link?.label ?? null,
    },
    account: null,
    ownerName: null,
    platform: normalisePlatform(finding.platform),
    finding,
    status: 'new',
    assignee: null,
    escalationLevel: 1,
    activity: [
      { at: finding.created_at, actor: 'Secret scanner', kind: 'created', text: 'Raised by rule: Secret committed to a repository.' },
    ],
  };
}

/**
 * Open exposure alerts from the live set, plus closed ones from the store.
 *
 * Closing one writes the scanner allowlist, which removes the finding from
 * the live set - so a closed exposure alert is listed from the copy the store
 * kept when it was closed. A finding that is live again after being closed has
 * been restored from the Accepted view, and is open again here too.
 */
export function exposureAlerts(findings, triage, policy, now = Date.now()) {
  const live = (findings ?? []).filter((finding) =>
    RAISING_TIERS.has(String(finding.risk_tier || '').toUpperCase()),
  );
  const liveIds = new Set();

  const open = live.map((finding) => {
    const base = raise(finding);
    liveIds.add(base.id);
    const entry = triage?.[base.id];
    /* Live means open, whatever the store remembers. */
    const stillOpen = entry && !isOpen({ status: entry.status }) ? { ...entry, status: 'new', closedAt: null } : entry;
    return applyTriage(base, stillOpen, policy, now);
  });

  const closed = Object.entries(triage ?? {})
    .filter(([id, entry]) => id.startsWith(EXPOSURE_ALERT_PREFIX) && !liveIds.has(id) && entry.snapshot)
    .filter(([, entry]) => !isOpen({ status: entry.status }))
    .map(([id, entry]) => {
      const { activity: snapshotActivity, ...snapshot } = entry.snapshot;
      return applyTriage(
        { ...snapshot, id, status: entry.status, assignee: null, escalationLevel: 1, activity: snapshotActivity ?? [] },
        entry,
        policy,
        now,
      );
    });

  return [...open, ...closed];
}
