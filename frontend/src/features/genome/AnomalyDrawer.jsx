import { ArrowRight, Check, EyeOff, ShieldCheck, Undo2 } from 'lucide-react';
import { ANOMALY_STATUSES, ANOMALY_TYPES } from '../../lib/demo/genome';
import { severityMeta } from '../../lib/domain';
import { formatDateTime, formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { CopyableValue } from '../../ui/Copyable';
import { Drawer } from '../../ui/Overlay';
import { Meter } from '../../ui/Meter';
import { SectionLabel } from '../../ui/Panel';
import { Tag } from '../../ui/Tag';

/**
 * One anomaly, in the form an operator has to judge it in.
 *
 * The layout is deliberate: baseline and observed sit side by side and equally
 * weighted, because the whole claim of this feature is the comparison. A single
 * "anomaly detected" figure with no baseline beside it is an assertion; the
 * pair is evidence.
 *
 * The three dispositions are the three real answers to a departure: it is a
 * problem (acknowledge and work it), it is how this identity is supposed to
 * behave now (expected, which is a statement about the baseline), or it is
 * noise from this detector for this identity (suppress).
 */
export function AnomalyDrawer({ anomaly, onClose, onDecide, onInvestigate }) {
  if (!anomaly) return null;

  const severity = severityMeta(anomaly.severity);
  const type = ANOMALY_TYPES[anomaly.type];
  const decided = anomaly.status !== 'open';

  return (
    <Drawer
      open={Boolean(anomaly)}
      onClose={onClose}
      eyebrow={type.label}
      title={anomaly.title}
      subtitle={`${anomaly.identityName} · ${anomaly.identityKind} · ${anomaly.account}`}
      header={
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={severity.tone} size="sm" dot>
            {severity.label}
          </Tag>
          <Tag tone={ANOMALY_STATUSES[anomaly.status].tone} size="sm">
            {ANOMALY_STATUSES[anomaly.status].label}
          </Tag>
          <span className="text-[11.5px] text-ink-3">
            Detected {formatRelative(anomaly.detectedAt)}
          </span>
        </div>
      }
      footer={
        <>
          {/* A disposition is a judgement, and judgements are made with partial
              information. Without a way back, one wrong click removes a
              departure from the queue permanently - so a decided anomaly can
              be returned to the queue, and the other three actions step aside
              for it rather than inviting the same decision twice. */}
          {decided ? (
            <Button variant="secondary" onClick={() => onDecide(anomaly, 'open')} icon={Undo2}>
              Reopen
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onDecide(anomaly, 'suppressed')} icon={EyeOff}>
                Suppress
              </Button>
              <Button variant="secondary" onClick={() => onDecide(anomaly, 'expected')} icon={ShieldCheck}>
                Expected
              </Button>
              <Button variant="primary" onClick={() => onDecide(anomaly, 'acknowledged')} icon={Check}>
                Acknowledge
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => onInvestigate(anomaly)} iconRight={ArrowRight}>
            Open genome
          </Button>
        </>
      }
    >
      {/* The drawer body carries no padding of its own, the same as the record
          drawers, so the content supplies it. */}
      <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
        {/* The comparison, first and largest. Everything else is context. */}
        <div>
          <SectionLabel>What changed</SectionLabel>
          <div className="mt-2 grid gap-3 @min-[26rem]:grid-cols-2">
            <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3">
              <p className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
                Baseline
              </p>
              <p className="mt-1 text-[14px] font-semibold text-ink">{anomaly.baseline.headline}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{anomaly.baseline.detail}</p>
            </div>
            <div className="rounded-[var(--radius-control)] border border-critical/30 bg-critical-soft p-3">
              <p className="text-[10.5px] font-semibold tracking-[0.1em] text-critical uppercase">
                Observed
              </p>
              <p className="mt-1 text-[14px] font-semibold text-ink">{anomaly.observed.headline}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">{anomaly.observed.detail}</p>
            </div>
          </div>
        </div>

        <div>
          <SectionLabel>Why this is graded {severity.label.toLowerCase()}</SectionLabel>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{anomaly.rationale}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[11.5px] text-ink-3">Detection confidence</span>
            <Meter
              value={anomaly.confidence}
              tone={severity.tone}
              height={4}
              className="min-w-0 flex-1"
              label="Detection confidence"
            />
            <span data-numeric="" className="shrink-0 text-[12.5px] font-semibold text-ink">
              {anomaly.confidence}%
            </span>
          </div>
        </div>

        <div>
          <SectionLabel>Detail</SectionLabel>
          <dl className="mt-2 flex flex-col">
            <Row label="Identity">{anomaly.identityName}</Row>
            <Row label="Account">{anomaly.account}</Row>
            <Row label="Region">{anomaly.region}</Row>
            <Row label="API">
              <CopyableValue value={anomaly.api} />
            </Row>
            <Row label="Resource">
              <CopyableValue value={anomaly.resource} />
            </Row>
            {anomaly.sourceIp && <Row label="Source address">{anomaly.sourceIp}</Row>}
            <Row label="Detected at">{formatDateTime(anomaly.detectedAt)}</Row>
            {decided && (
              <Row label="Disposition">
                {ANOMALY_STATUSES[anomaly.status].label}
                {anomaly.decidedAt ? ` · ${formatRelative(anomaly.decidedAt)}` : ''}
              </Row>
            )}
          </dl>
        </div>
      </div>
    </Drawer>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid gap-0.5 border-b border-line py-2 last:border-0 @min-[26rem]:grid-cols-[minmax(0,140px)_minmax(0,1fr)] @min-[26rem]:gap-4">
      <dt className="text-[11.5px] text-ink-3">{label}</dt>
      <dd className="min-w-0 text-[12.5px] text-ink-2">{children}</dd>
    </div>
  );
}
