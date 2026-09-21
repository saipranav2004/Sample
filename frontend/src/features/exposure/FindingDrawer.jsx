import { useState } from 'react';
import { ExternalLink, FileWarning, ShieldOff } from 'lucide-react';
import {
  commitSize,
  confidenceMeta,
  findingLink,
  hasCommitContext,
  hasRepoContext,
  missingFieldReason,
  parseCommitAuthoredAt,
  platformMeta,
  recommendedActionMeta,
  repoVisibilityMeta,
  severityMeta,
} from '../../lib/domain';
import {
  formatDateTime,
  formatNumber,
  formatRelative,
  humanizeToken,
  parseAuthor,
  shortBranch,
  shortCommit,
} from '../../lib/format';
import { Drawer } from '../../ui/Overlay';
import { DetailList, DetailRow, SectionLabel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import { Field, Input } from '../../ui/Field';
import { Tag } from '../../ui/Tag';
import { CopyableValue } from '../../ui/Copyable';

/**
 * Finding detail plus the one write this product performs: adding the finding
 * to the scanner's allowlist. The four identifying fields are sent back
 * verbatim, as the service requires.
 */
export function FindingDrawer({ finding, onClose, onDismiss, dismissing }) {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (!finding) return null;

  const risk = severityMeta(finding.risk_tier);
  const action = recommendedActionMeta(finding.recommended_action);
  const platform = platformMeta(finding.platform);
  const link = findingLink(finding);
  const author = parseAuthor(finding.author);
  const confidence = confidenceMeta(finding.confidence);
  const visibility = repoVisibilityMeta(finding.repo_visibility);
  const authoredAt = parseCommitAuthoredAt(finding.commit_authored_at);
  const size = commitSize(finding);
  const committer = finding.committer ? parseAuthor(finding.committer) : null;
  /* Same person in the overwhelming majority of commits; worth a row only when
     they differ, which is the case that tells an operator something. */
  const committerDiffers = Boolean(committer?.name && committer.name !== author.name);

  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      eyebrow={humanizeToken(finding.detector)}
      title={finding.file_path || 'Finding'}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <Tag tone={risk.tone} size="sm" dot>
            {risk.label} risk
          </Tag>
          <Tag tone={platform.tone} size="sm">
            {platform.label}
          </Tag>
          <Tag tone={action.tone} size="sm">
            {action.label}
          </Tag>
        </span>
      }
      footer={
        <>
          {link && (
            <Button
              as="a"
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              variant="secondary"
              iconRight={ExternalLink}
            >
              {link.label}
            </Button>
          )}
          <Button
            variant={confirming ? 'danger' : 'primary'}
            icon={ShieldOff}
            loading={dismissing}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              onDismiss(finding, reason.trim());
            }}
          >
            {confirming ? 'Confirm - mark as safe' : 'Mark as safe'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
        <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5">
          <SectionLabel>Redacted value</SectionLabel>
          <p className="mt-1.5 font-mono text-[13px] break-all text-ink">{finding.redacted || '-'}</p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
            The scanner never returns the real secret - this masked form is the only version
            available through the API.
          </p>
        </div>

        {/* The line the secret sits on, masked by the scanner the same way the
            value is. Shown next to the value because "what does this code
            actually look like" is the first question a reviewer asks, and the
            answer decides whether it is a fixture or a live credential. */}
        {finding.line_preview && (
          <div>
            <SectionLabel>The line it was found on</SectionLabel>
            <pre className="mt-1.5 overflow-x-auto rounded-[var(--radius-control)] border border-line bg-inset p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-2">
              {finding.line_preview}
            </pre>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
              Line {finding.line_number ?? '-'} of {finding.file_path || 'the file'}. The secret is
              masked here exactly as it is in the value above.
            </p>
          </div>
        )}

        <div>
          <SectionLabel>Location</SectionLabel>
          <DetailList className="mt-1">
            <DetailRow label="Repository" mono>
              <CopyableValue value={finding.repository} />
            </DetailRow>
            <DetailRow label="File">
              <CopyableValue value={finding.file_path} />
            </DetailRow>
            <DetailRow label="Line">
              <span data-numeric="">{finding.line_number ?? '-'}</span>
            </DetailRow>
            <DetailRow label="Branch" mono>
              {shortBranch(finding.branch)}
            </DetailRow>
            <DetailRow label="Commit" mono>
              <CopyableValue value={finding.commit_id}>{shortCommit(finding.commit_id)}</CopyableValue>
            </DetailRow>
            <DetailRow label="Platform">{platform.label}</DetailRow>
          </DetailList>
        </div>

        <div>
          <SectionLabel>Attribution</SectionLabel>
          <DetailList className="mt-1">
            <DetailRow label="Author">{author.name}</DetailRow>
            <DetailRow label="Email" mono>
              {author.email || '-'}
            </DetailRow>
            <DetailRow label="Detected">
              {formatRelative(finding.created_at)}
              <span className="ml-1.5 text-ink-3">({formatDateTime(finding.created_at)})</span>
            </DetailRow>
            <DetailRow label="Tenant" mono>
              {finding.client_id || '-'}
            </DetailRow>
          </DetailList>
        </div>

        <div>
          <SectionLabel>Assessment</SectionLabel>
          <DetailList className="mt-1">
            <DetailRow label="Detector">{humanizeToken(finding.detector)}</DetailRow>
            <DetailRow label="Detector severity">
              {finding.severity ? humanizeToken(finding.severity) : '-'}
            </DetailRow>
            <DetailRow label="Match confidence">
              {confidence ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <Tag tone={confidence.tone} size="sm">
                    {confidence.short}
                  </Tag>
                  <span className="text-[11.5px] text-ink-3">
                    How certain the pattern match is, not how bad the secret is.
                  </span>
                </span>
              ) : (
                <MissingValue finding={finding} field="confidence" />
              )}
            </DetailRow>
            <DetailRow label="Category">
              {finding.category ? (
                humanizeToken(finding.category)
              ) : (
                <MissingValue finding={finding} field="category" />
              )}
            </DetailRow>
            <DetailRow label="Actionable risk">{risk.label}</DetailRow>
            <DetailRow label="Recommended action">{action.label}</DetailRow>
            <DetailRow label="Verification">
              {finding.verification_status === 'UNSUPPORTED'
                ? 'Not checked - liveness verification is unavailable on this deployment'
                : humanizeToken(finding.verification_status)}
            </DetailRow>
          </DetailList>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
            “Not checked” means the scanner has no permission to test whether the credential still
            works. It is not a statement that the secret is inactive.
          </p>
        </div>

        {hasCommitContext(finding) && (
          <div>
            <SectionLabel>The commit that introduced it</SectionLabel>
            {finding.commit_message && (
              <p className="mt-1.5 rounded-[var(--radius-control)] border border-line bg-surface-2 p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-2">
                {finding.commit_message}
              </p>
            )}
            <DetailList className="mt-1">
              {committerDiffers && (
                <DetailRow label="Committed by">
                  {committer.name}
                  {committer.email && <span className="ml-1.5 text-ink-3">{committer.email}</span>}
                  <span className="mt-0.5 block text-[11.5px] text-ink-3">
                    Different from the author, which happens on a rebase, a squash or a bot commit.
                  </span>
                </DetailRow>
              )}
              <DetailRow label="Written">
                {authoredAt ? (
                  <>
                    {formatRelative(authoredAt)}
                    <span className="ml-1.5 text-ink-3">({formatDateTime(authoredAt)})</span>
                  </>
                ) : (
                  <MissingValue finding={finding} field="commit_authored_at" />
                )}
                <span className="mt-0.5 block text-[11.5px] text-ink-3">
                  When the commit was written, not when the scanner found it.
                </span>
              </DetailRow>
              <DetailRow label="Files in the commit">
                {size.files !== null ? (
                  <>
                    <span data-numeric="">{formatNumber(size.files)}</span>
                    {!size.filesAreExact && (
                      <span className="mt-0.5 block text-[11.5px] text-ink-3">
                        CodeCommit reports no diff stats, so this counts the files the scanner read.
                        It can undercount a commit that also touched a binary or oversized file.
                      </span>
                    )}
                  </>
                ) : (
                  <MissingValue finding={finding} field="files_changed" />
                )}
              </DetailRow>
              <DetailRow label="Lines changed">
                {size.hasLineStats ? (
                  <span data-numeric="">
                    {size.additions !== null ? `+${formatNumber(size.additions)}` : '+?'}
                    {' / '}
                    {size.deletions !== null ? `-${formatNumber(size.deletions)}` : '-?'}
                  </span>
                ) : (
                  <MissingValue finding={finding} field="additions" />
                )}
              </DetailRow>
            </DetailList>
          </div>
        )}

        {hasRepoContext(finding) && (
          <div>
            <SectionLabel>The repository it sits in</SectionLabel>
            <DetailList className="mt-1">
              <DetailRow label="Visibility">
                {visibility ? (
                  <span className="flex flex-col gap-0.5">
                    <Tag tone={visibility.tone} size="sm" dot={visibility.tone !== 'neutral'}>
                      {visibility.label}
                    </Tag>
                    <span className="text-[11.5px] leading-relaxed text-ink-3">{visibility.note}</span>
                  </span>
                ) : (
                  <MissingValue finding={finding} field="repo_visibility" />
                )}
              </DetailRow>
              <DetailRow label="Stars">
                {Number.isFinite(finding.repo_stars) ? (
                  <span data-numeric="">{formatNumber(finding.repo_stars)}</span>
                ) : (
                  <MissingValue finding={finding} field="repo_stars" />
                )}
              </DetailRow>
              <DetailRow label="Forks">
                {Number.isFinite(finding.repo_forks) ? (
                  <>
                    <span data-numeric="">{formatNumber(finding.repo_forks)}</span>
                    {finding.repo_forks > 0 && (
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-3">
                        A fork keeps its own copy of the history, so rotating the secret matters more
                        than deleting the commit.
                      </span>
                    )}
                  </>
                ) : (
                  <MissingValue finding={finding} field="repo_forks" />
                )}
              </DetailRow>
              <DetailRow label="Repository last pushed">
                {finding.repo_pushed_at ? (
                  formatRelative(finding.repo_pushed_at)
                ) : (
                  <MissingValue finding={finding} field="repo_pushed_at" />
                )}
              </DetailRow>
            </DetailList>
          </div>
        )}

        {confirming && (
          <div className="animate-fade rounded-[var(--radius-control)] border border-medium/30 bg-medium-soft p-3.5">
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Marking this safe adds it to the scanner allowlist. It disappears from findings
              immediately and can be restored from the Accepted view.
            </p>
            <Field
              className="mt-3"
              label="Reason (optional)"
              htmlFor="dismiss-reason"
              hint="Shown to whoever reviews the allowlist later."
            >
              <Input
                id="dismiss-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. rotated, test fixture"
                maxLength={200}
              />
            </Field>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        )}

        {!link && (
          <p className="flex items-start gap-2 text-[12px] text-ink-3">
            <FileWarning aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            No console link is available for this finding - the scanner had no region on file for the
            tenant when it was recorded.
          </p>
        )}
      </div>
    </Drawer>
  );
}

/**
 * Why a value is absent.
 *
 * A dash is ambiguous: it could mean the platform cannot report this, or that
 * the finding predates the field. Those lead to different conclusions, so each
 * says which it is rather than leaving the reader to guess.
 */
function MissingValue({ finding, field }) {
  const reason = missingFieldReason(finding, field);
  const platform = platformMeta(finding.platform);
  return (
    <span className="text-[12px] text-ink-3">
      {reason === 'not-applicable'
        ? `Not reported by ${platform.label}`
        : 'Not recorded for this finding'}
    </span>
  );
}
