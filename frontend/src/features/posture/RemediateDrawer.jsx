import { useState } from 'react';
import { AlertTriangle, ArrowRight, BellRing, Wrench } from 'lucide-react';
import { useAccess } from '../../app/useAccess';
import { remediatePosture } from '../../lib/api/endpoints';
import { severityMeta } from '../../lib/domain';
import { bandFor, PILLARS } from '../../lib/posture';
import { Button } from '../../ui/Button';
import { CopyButton } from '../../ui/Copyable';
import { Field, Select } from '../../ui/Field';
import { Drawer } from '../../ui/Overlay';
import { SectionLabel } from '../../ui/Panel';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { ScoreRing } from './parts';

/**
 * Remediate one failed check.
 *
 * Shows everything before anything is applied: the score it moves from and
 * to, what the fix does, what it can break, and the exact policy and commands
 * it applies - a remediation screen that will not show what it is about to do
 * is worse than one that does nothing. Mounted only while open, so every
 * opening starts clean.
 */
export function RemediateDrawer({ identity, check, onClose }) {
  const { lock } = useAccess();
  const { notify } = useToast();
  const plan = check.remediation;
  const [owner, setOwner] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const needsOwner = Boolean(plan.needsOwner);
  const ownerMissing = needsOwner && !owner;
  const before = bandFor(plan.scoreBefore);
  const after = bandFor(plan.scoreAfter);
  const severity = severityMeta(check.severity);

  const apply = async () => {
    setTouched(true);
    setError('');
    if (ownerMissing) return;
    setBusy(true);
    try {
      const result = await remediatePosture({ identityId: identity.id, checkKey: check.key, owner: owner || null });
      notify({
        variant: 'success',
        title: 'Remediation applied',
        description: `${identity.name}: score ${result.before} to ${result.after}.${
          result.resolvedAlerts > 0 ? ` ${result.resolvedAlerts} open ${result.resolvedAlerts === 1 ? 'alert' : 'alerts'} resolved.` : ''
        }`,
      });
      onClose();
    } catch (failure) {
      setError(failure?.message ?? 'The remediation could not be applied.');
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={busy ? () => {} : onClose}
      eyebrow="Remediate"
      title={plan.action}
      subtitle={`${check.title} · ${identity.name}`}
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" icon={Wrench} loading={busy} onClick={apply} locked={lock('posture.remediate')}>
            {busy ? 'Applying…' : 'Apply remediation'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
        <section aria-label="Score impact" className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-4 py-3.5">
          <SectionLabel>Score impact</SectionLabel>
          <div className="mt-2.5 flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2.5">
              <ScoreRing score={plan.scoreBefore} size={52} />
              <span className="text-[11.5px] text-ink-3">
                Now
                <span className="block text-[12.5px] font-medium text-ink-2">{before.label}</span>
              </span>
            </span>
            <ArrowRight aria-hidden="true" className="size-4 text-ink-3" />
            <span className="flex items-center gap-2.5">
              <ScoreRing score={plan.scoreAfter} size={52} />
              <span className="text-[11.5px] text-ink-3">
                After
                <span className="block text-[12.5px] font-medium text-ink-2">{after.label}</span>
              </span>
            </span>
            <span data-numeric="" className="ml-auto text-[22px] font-extrabold tracking-[-0.02em] text-low">
              +{plan.gain}
            </span>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-3">
            This {severity.label.toLowerCase()} check in {PILLARS[check.pillar].label} costs {check.weight} points.
            {plan.gain > check.weight ? ' The same fix also clears another check, so it earns more.' : ''} Risk goes down as the score goes up.
          </p>
        </section>

        <section>
          <SectionLabel>What it does</SectionLabel>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{plan.summary}</p>
          {plan.caution && (
            <p className="mt-2.5 flex items-start gap-2 rounded-[var(--radius-control)] border border-medium/25 bg-medium-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-medium" />
              {plan.caution}
            </p>
          )}
          {plan.alertsResolved > 0 && (
            <p className="mt-2.5 flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-2">
              <BellRing aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
              Resolves {plan.alertsResolved} open {plan.alertsResolved === 1 ? 'alert' : 'alerts'} on this identity, with a note saying it was fixed here.
            </p>
          )}
        </section>

        {needsOwner && (
          <Field
            label="Owner"
            htmlFor="remediate-owner"
            required
            hint="The person accountable for this identity. Recorded as its owner tag."
            error={touched && ownerMissing ? 'Choose who owns this identity.' : undefined}
          >
            <Select
              id="remediate-owner"
              value={owner}
              invalid={touched && ownerMissing}
              onChange={(event) => setOwner(event.target.value)}
              options={[{ value: '', label: 'Choose a person' }, ...plan.owners]}
            />
          </Field>
        )}

        {plan.artifacts.map((artifact) => {
          const content = artifact.content.replaceAll('{owner}', owner || '<owner>');
          return (
            <section key={artifact.label}>
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>{artifact.label}</SectionLabel>
                <span className="flex items-center gap-1.5">
                  <Tag tone="neutral" size="sm">
                    {artifact.language === 'json' ? 'IAM policy' : 'AWS CLI'}
                  </Tag>
                  <CopyButton value={content} label={`Copy ${artifact.label}`} size="sm" />
                </span>
              </div>
              <pre className="mt-1.5 max-h-72 overflow-auto rounded-[var(--radius-control)] border border-line bg-inset p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre text-ink-2">
                {content}
              </pre>
            </section>
          );
        })}

        {error && (
          <p role="alert" className="rounded-[var(--radius-control)] border border-critical/30 bg-critical-soft px-3 py-2 text-[12.5px] text-critical">
            {error}
          </p>
        )}
      </div>
    </Drawer>
  );
}
