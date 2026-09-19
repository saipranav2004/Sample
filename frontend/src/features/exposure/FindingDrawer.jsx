import { useState } from 'react';
import { ExternalLink, FileWarning, ShieldOff } from 'lucide-react';
import {
  findingLink,
  platformMeta,
  recommendedActionMeta,
  severityMeta,
} from '../../lib/domain';
import {
  formatDateTime,
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
            {confirming ? 'Confirm — mark as safe' : 'Mark as safe'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
        <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5">
          <SectionLabel>Redacted value</SectionLabel>
          <p className="mt-1.5 font-mono text-[13px] break-all text-ink">{finding.redacted || '—'}</p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
            The scanner never returns the real secret — this masked form is the only version
            available through the API.
          </p>
        </div>

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
              <span data-numeric="">{finding.line_number ?? '—'}</span>
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
              {author.email || '—'}
            </DetailRow>
            <DetailRow label="Detected">
              {formatRelative(finding.created_at)}
              <span className="ml-1.5 text-ink-3">({formatDateTime(finding.created_at)})</span>
            </DetailRow>
            <DetailRow label="Tenant" mono>
              {finding.client_id || '—'}
            </DetailRow>
          </DetailList>
        </div>

        <div>
          <SectionLabel>Assessment</SectionLabel>
          <DetailList className="mt-1">
            <DetailRow label="Detector">{humanizeToken(finding.detector)}</DetailRow>
            <DetailRow label="Detector severity">
              {finding.severity ? humanizeToken(finding.severity) : '—'}
            </DetailRow>
            <DetailRow label="Actionable risk">{risk.label}</DetailRow>
            <DetailRow label="Recommended action">{action.label}</DetailRow>
            <DetailRow label="Verification">
              {finding.verification_status === 'UNSUPPORTED'
                ? 'Not checked — liveness verification is unavailable on this deployment'
                : humanizeToken(finding.verification_status)}
            </DetailRow>
          </DetailList>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
            “Not checked” means the scanner has no permission to test whether the credential still
            works. It is not a statement that the secret is inactive.
          </p>
        </div>

        {confirming && (
          <div className="animate-fade rounded-[var(--radius-control)] border border-medium/30 bg-medium-soft p-3.5">
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Marking this safe adds it to the scanner allowlist. It disappears from findings
              immediately and can be restored from the Dismissed view.
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
            No console link is available for this finding — the scanner had no region on file for the
            tenant when it was recorded.
          </p>
        )}
      </div>
    </Drawer>
  );
}
