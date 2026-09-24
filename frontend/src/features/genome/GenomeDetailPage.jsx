import { useCallback, useMemo, useState } from 'react';
import { useAccess } from '../../app/useAccess';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Dna,
  EyeOff,
  FileCode,
  Fingerprint as FingerprintIcon,
  Play,
  ShieldCheck,
  Snowflake,
} from 'lucide-react';
import {
  ANOMALY_STATUSES,
  ANOMALY_TYPES,
  BASELINE_STATES,
  FINGERPRINT_AXES,
  fetchGenomeIdentity,
  setAnomalyStatus,
  setPolicyApplied,
} from '../../lib/demo/genome';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { severityMeta } from '../../lib/domain';
import { formatDateTime, formatNumber, formatRelative } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { CopyableValue } from '../../ui/Copyable';
import { DataGrid } from '../../ui/DataGrid';
import { Meter } from '../../ui/Meter';
import { Modal } from '../../ui/Overlay';
import { Panel, PanelHeader, SectionLabel } from '../../ui/Panel';
import { DetailSkeleton } from '../../ui/Skeleton';
import { EmptyState, ErrorState } from '../../ui/States';
import { Tabs } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { TrendChart } from '../../charts/TrendChart';
import { ApiShareList, Fingerprint, ScheduleGrid, VolumeBand } from './visuals';

/**
 * One identity's genome.
 *
 * Six views of the same record, in the order an investigation actually runs:
 * what is normal for this identity (Genome), what departed (Anomalies), the
 * calls behind it (Activity), how it got here (Timeline), whether its peers do
 * the same (Peer group), and what can be done about it (Containment).
 *
 * Containment is last on purpose. A policy proposal is only meaningful once the
 * departure has been read, and every proposal here shows the exact document it
 * would attach rather than describing it.
 */
export default function GenomeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [tab, setTab] = useState('genome');
  const [policyPreview, setPolicyPreview] = useState(null);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const { lock } = useAccess();

  const query = useDemoQuery((signal) => fetchGenomeIdentity(id, signal), [id]);
  const identity = query.data;

  const openAnomalies = useMemo(
    () => (identity?.anomalies ?? []).filter((anomaly) => anomaly.status === 'open'),
    [identity],
  );

  const decide = useCallback(
    (anomaly, status) => {
      try {
        setAnomalyStatus(anomaly.id, status);
      } catch (error) {
        notify({ title: 'Not recorded', description: error.message, variant: 'error' });
        return;
      }
      notify({
        title: `${ANOMALY_STATUSES[status].label}: ${ANOMALY_TYPES[anomaly.type].label}`,
        description: `Recorded on ${anomaly.identityName}.`,
        variant: status === 'acknowledged' ? 'info' : 'success',
      });
    },
    [notify],
  );

  const applyPolicy = useCallback(
    (policy) => {
      try {
        setPolicyApplied(policy.id, true);
      } catch (error) {
        notify({ title: 'Policy not applied', description: error.message, variant: 'error' });
        return;
      }
      setPolicyPreview(null);
      notify({
        title: 'Policy applied',
        description: `${policy.name} is attached. In this demo the change is recorded locally.`,
        variant: 'success',
      });
    },
    [notify],
  );

  if (query.isError && !identity) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Genome"
          actions={
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/genome')}>
              Back to fleet
            </Button>
          }
        />
        <ErrorState error={query.error} onRetry={query.refetch} />
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Genome" />
        <Panel prominence="lead">
          <DetailSkeleton rows={8} />
        </Panel>
      </div>
    );
  }

  const state = BASELINE_STATES[identity.baselineState];

  const tabs = [
    { value: 'genome', label: 'Genome' },
    { value: 'anomalies', label: 'Anomalies', count: openAnomalies.length || undefined },
    { value: 'activity', label: 'Activity' },
    { value: 'timeline', label: 'Timeline' },
    { value: 'peers', label: 'Peer group' },
    { value: 'containment', label: 'Containment', count: identity.policies.length || undefined },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={identity.name}
        lede={`${identity.kind} · ${identity.account} · ${identity.region}`}
        actions={
          <>
            <Button variant="secondary" as={Link} to="/genome" icon={ArrowLeft}>
              Fleet
            </Button>
            <Button variant="ghost" as={Link} to={`/identities/${encodeURIComponent(identity.id)}`} icon={FingerprintIcon}>
              Identity record
            </Button>
            <Button variant="danger" icon={Snowflake} onClick={() => setFreezeOpen(true)} locked={lock('anomalies.contain')}>
              Freeze credential
            </Button>
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={state.tone} size="sm" dot>
              {state.label}
            </Tag>
            {identity.baselineState === 'learning' && (
              <span className="text-[11.5px] text-ink-3">
                {identity.learningProgress}% of a {identity.learningDays}-day learning period
              </span>
            )}
            <Tag tone="neutral" size="sm">
              Risk {identity.riskScore}/100
            </Tag>
            <Tag tone="neutral" size="sm">
              {identity.peerGroup}
            </Tag>
            <span className="text-[11.5px] text-ink-3">
              Last seen {formatRelative(identity.lastSeen)}
            </span>
          </div>
        }
        tabs={<Tabs size="sm" tabs={tabs} value={tab} onChange={setTab} />}
      />

      {/* An open departure is the reason anyone opened this record, so it is
          stated above the tabs rather than hidden inside one of them. */}
      {openAnomalies.length > 0 && (
        <Panel prominence="lead" className="animate-rise border-critical/30">
          <PanelHeader
            prominence="lead"
            title={`${openAnomalies.length} open ${openAnomalies.length === 1 ? 'departure' : 'departures'} from baseline`}
            actions={
              <Button variant="secondary" size="sm" onClick={() => setTab('anomalies')}>
                Read the evidence
              </Button>
            }
          />
          <ul className="mt-3 flex flex-col gap-2">
            {openAnomalies.map((anomaly) => {
              const severity = severityMeta(anomaly.severity);
              return (
                <li
                  key={anomaly.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2"
                >
                  <Tag tone={severity.tone} size="sm" dot>
                    {severity.label}
                  </Tag>
                  <span className="min-w-0 flex-1 text-[12.5px] text-ink">{anomaly.title}</span>
                  <span className="shrink-0 text-[11.5px] text-ink-3">
                    {anomaly.baseline.headline} <span aria-hidden="true">&rarr;</span>{' '}
                    {anomaly.observed.headline}
                  </span>
                  <span data-numeric="" className="shrink-0 text-[11.5px] font-semibold text-ink-2">
                    {anomaly.confidence}%
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {tab === 'genome' && <GenomeTab identity={identity} />}
      {tab === 'anomalies' && <AnomaliesTab identity={identity} onDecide={decide} />}
      {tab === 'activity' && <ActivityTab identity={identity} />}
      {tab === 'timeline' && <TimelineTab identity={identity} />}
      {tab === 'peers' && <PeersTab identity={identity} />}
      {tab === 'containment' && (
        <ContainmentTab
          identity={identity}
          onPreview={setPolicyPreview}
          onApply={applyPolicy}
        />
      )}

      <Modal
        open={Boolean(policyPreview)}
        onClose={() => setPolicyPreview(null)}
        title={policyPreview?.name}
        description="The document below is exactly what would be attached. Read it before applying."
        /* Not the flask: that icon means demonstration data everywhere else in
           this build, and this dialog is about a document, not about the data
           being generated. */
        icon={FileCode}
        tone="medium"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPolicyPreview(null)}>
              Cancel
            </Button>
            <Button variant="primary" icon={Check} onClick={() => applyPolicy(policyPreview)} locked={lock('anomalies.contain')}>
              Apply policy
            </Button>
          </>
        }
      >
        {policyPreview && (
          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] leading-relaxed text-ink-2">{policyPreview.impact}</p>
            <pre className="max-h-64 overflow-auto rounded-[var(--radius-control)] border border-line bg-inset p-3 font-mono text-[11.5px] leading-relaxed text-ink-2">
              {policyPreview.document}
            </pre>
          </div>
        )}
      </Modal>

      <Modal
        open={freezeOpen}
        onClose={() => setFreezeOpen(false)}
        title={`Freeze ${identity.name}?`}
        description="Freezing revokes this identity's active credentials immediately. Anything depending on it stops working until it is restored."
        icon={Snowflake}
        tone="critical"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFreezeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Snowflake}
              onClick={() => {
                setFreezeOpen(false);
                notify({
                  title: `${identity.name} would be frozen`,
                  description: 'This is demo data, so nothing was revoked. The confirmation flow is the real one.',
                  variant: 'info',
                });
              }}
            >
              Freeze credential
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          {identity.peerGroup} has {identity.peers.size} members. Freezing one of them does not
          affect the others, but any caller of this identity will fail closed.
        </p>
      </Modal>
    </div>
  );
}

/* ── Genome ───────────────────────────────────────────────────────────────── */

function GenomeTab({ identity }) {
  const newApis = identity.anomalies
    .filter((anomaly) => anomaly.type === 'NEW_API' || anomaly.type === 'PRIV_ESCALATION')
    .map((anomaly) => ({ api: anomaly.api, detail: anomaly.observed.detail }));

  /* Off-hours anomalies are placed on the schedule so the departure is visible
     against the hours that make it one. */
  const anomalyCells = identity.anomalies
    .filter((anomaly) => anomaly.type === 'OFF_HOURS')
    .map((anomaly) => {
      const when = new Date(anomaly.detectedAt);
      return [(when.getUTCDay() + 6) % 7, when.getUTCHours()];
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 @min-[52rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Panel prominence="lead" className="animate-rise">
          <PanelHeader
            prominence="lead"
            title="Behavioural fingerprint"
            subtitle="Baseline against the last 24 hours. The shape is the comparison, which is why all six axes are drawn at once."
          />
          <Fingerprint
            className="mt-4"
            series={[
              /* Two categorical hues, not a severity pair. The observed shape
                 sits inside the baseline on some axes and outside it on
                 others; painting the whole polygon critical would claim the
                 last 24 hours are wrong in six ways when the departures are
                 named individually above. The dashes carry the distinction
                 without colour. */
              { key: 'baseline', label: 'Baseline', values: identity.fingerprint.baseline, tone: 'var(--t-series-1)' },
              { key: 'observed', label: 'Last 24h', values: identity.fingerprint.observed, tone: 'var(--t-series-4)', dashed: true, fillOpacity: 0.1 },
            ]}
          />
        </Panel>

        <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 1 }}>
          <PanelHeader prominence="quiet" title="Typical actions" subtitle="Share of calls across the baseline window." />
          <ApiShareList className="mt-3" actions={identity.typicalActions} newApis={newApis} />
        </Panel>
      </div>

      <div className="grid gap-4 @min-[52rem]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel prominence="quiet" className="animate-rise">
          <PanelHeader prominence="quiet" title="Activity schedule" subtitle="Seven days by hour. Off-hours only means something next to the hours that are normal here." />
          <ScheduleGrid className="mt-3" weeks={identity.schedule} anomalyCells={anomalyCells} />
        </Panel>

        <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 1 }}>
          <PanelHeader prominence="quiet" title="Volume against baseline" />
          <VolumeBand className="mt-3" points={identity.volumeBaseline} />
        </Panel>
      </div>

      <div className="grid gap-4 @min-[52rem]:grid-cols-2">
        <Panel prominence="quiet" className="animate-rise">
          <PanelHeader prominence="quiet" title="Typical resources" />
          <ul className="mt-3 flex flex-col">
            {identity.typicalResources.map((resource) => (
              <li key={resource.resource} className="border-b border-line py-2 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-mono text-[12px] text-ink-2" title={resource.resource}>
                    {resource.resource}
                  </span>
                  <span data-numeric="" className="shrink-0 text-[11.5px] text-ink-3">
                    {formatNumber(resource.accesses)}
                  </span>
                </div>
                <span className="mt-0.5 block text-[11px] text-ink-3">{resource.kind}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 1 }}>
          <PanelHeader prominence="quiet" title="Baseline provenance" subtitle="What the verdicts on this identity are built from." />
          <dl className="mt-3 flex flex-col">
            <Row label="Learning period">{identity.learningDays} days</Row>
            <Row label="Data points">{formatNumber(identity.dataPoints)} events</Row>
            <Row label="Model confidence">{identity.modelConfidence}%</Row>
            <Row label="Last model update">{formatRelative(identity.lastModelUpdate)}</Row>
            <Row label="Baseline established">
              {identity.baselineEstablished ? formatDateTime(identity.baselineEstablished) : 'Still learning'}
            </Row>
            <Row label="Drift">
              {identity.drift.toFixed(2)} {identity.drift > 0.25 ? '(retrain recommended)' : '(stable)'}
            </Row>
            <Row label="Primary region">{identity.region}</Row>
            <Row label="VPC">
              <CopyableValue value={identity.vpc} />
            </Row>
            <Row label="ASN">{identity.asn}</Row>
          </dl>
        </Panel>
      </div>
    </div>
  );
}

/* ── Anomalies ────────────────────────────────────────────────────────────── */

function AnomaliesTab({ identity, onDecide }) {
  const { lock } = useAccess();
  const open = identity.anomalies.filter((anomaly) => anomaly.status === 'open');
  const decided = identity.anomalies.filter((anomaly) => anomaly.status !== 'open');

  return (
    <div className="flex flex-col gap-4">
      {identity.anomalies.length === 0 ? (
        <Panel prominence="lead">
          <EmptyState
            icon={ShieldCheck}
            title="No departures recorded"
            description={
              identity.baselineState === 'learning'
                ? 'This identity has no established baseline yet, so nothing can be judged a departure.'
                : 'Every observed call falls inside this identity\'s own baseline.'
            }
          />
        </Panel>
      ) : (
        [...open, ...decided].map((anomaly) => {
          const severity = severityMeta(anomaly.severity);
          return (
            <Panel
              key={anomaly.id}
              prominence={anomaly.status === 'open' ? 'lead' : 'quiet'}
              className="animate-rise"
            >
              <PanelHeader
                prominence={anomaly.status === 'open' ? 'lead' : 'quiet'}
                title={anomaly.title}
                subtitle={anomaly.rationale}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone={severity.tone} size="sm" dot>
                      {severity.label}
                    </Tag>
                    <Tag tone={ANOMALY_STATUSES[anomaly.status].tone} size="sm">
                      {ANOMALY_STATUSES[anomaly.status].label}
                    </Tag>
                  </div>
                }
              />

              <div className="mt-3 grid gap-3 @min-[30rem]:grid-cols-2">
                <div className="rounded-[var(--radius-control)] border border-line bg-surface p-3">
                  <p className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Baseline</p>
                  <p className="mt-1 text-[14px] font-semibold text-ink">{anomaly.baseline.headline}</p>
                  <p className="mt-1 text-[11.5px] text-ink-3">{anomaly.baseline.detail}</p>
                </div>
                <div className="rounded-[var(--radius-control)] border border-critical/30 bg-critical-soft p-3">
                  <p className="text-[10.5px] font-semibold tracking-[0.1em] text-critical uppercase">Observed</p>
                  <p className="mt-1 text-[14px] font-semibold text-ink">{anomaly.observed.headline}</p>
                  <p className="mt-1 text-[11.5px] text-ink-2">{anomaly.observed.detail}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 text-[11.5px] text-ink-3">Confidence</span>
                  <Meter value={anomaly.confidence} tone={severity.tone} height={4} className="min-w-0 flex-1" label="Detection confidence" />
                  <span data-numeric="" className="shrink-0 text-[12px] font-semibold text-ink">
                    {anomaly.confidence}%
                  </span>
                </span>
                <span className="shrink-0 text-[11.5px] text-ink-3">
                  Detected {formatRelative(anomaly.detectedAt)}
                </span>
              </div>

              {anomaly.status === 'open' && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <Button variant="primary" size="sm" icon={Check} onClick={() => onDecide(anomaly, 'acknowledged')} locked={lock('anomalies.work')}>
                    Acknowledge
                  </Button>
                  <Button variant="secondary" size="sm" icon={ShieldCheck} onClick={() => onDecide(anomaly, 'expected')} locked={lock('anomalies.dismiss')}>
                    Expected behaviour
                  </Button>
                  <Button variant="ghost" size="sm" icon={EyeOff} onClick={() => onDecide(anomaly, 'suppressed')} locked={lock('anomalies.dismiss')}>
                    Suppress this detector
                  </Button>
                </div>
              )}
            </Panel>
          );
        })
      )}

      <Panel prominence="quiet" flush className="animate-rise overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <PanelHeader prominence="quiet" title="Earlier departures" subtitle="Already dispositioned. Kept because a pattern of small departures is itself evidence." />
        </div>
        <DataGrid
          caption="Historical anomalies"
          columns={[
            {
              key: 'at',
              header: 'When',
              width: '14%',
              cell: (row) => <span className="whitespace-nowrap text-[12.5px] text-ink-2">{formatRelative(row.at)}</span>,
            },
            {
              key: 'type',
              header: 'Type',
              width: '15%',
              cell: (row) => <Tag tone="neutral" size="sm">{ANOMALY_TYPES[row.type].label}</Tag>,
            },
            {
              key: 'description',
              header: 'What departed',
              primary: true,
              width: '29%',
              cell: (row) => <span className="block truncate text-[12.5px] text-ink-2">{row.description}</span>,
            },
            {
              key: 'deviation',
              header: 'Baseline to observed',
              width: '22%',
              priority: 'wide',
              cell: (row) => <span className="block truncate text-[11.5px] text-ink-3">{row.deviation}</span>,
            },
            {
              key: 'confidence',
              header: 'Conf.',
              width: '8%',
              cell: (row) => <span data-numeric="" className="text-[12.5px] text-ink-2">{row.confidence}%</span>,
            },
            {
              key: 'status',
              header: 'Disposition',
              width: '12%',
              cell: (row) => (
                <Tag tone={ANOMALY_STATUSES[row.status].tone} size="sm">
                  {ANOMALY_STATUSES[row.status].label}
                </Tag>
              ),
            },
          ]}
          rows={identity.history}
          rowKey={(row) => row.id}
          density="compact"
          emptyState={<EmptyState icon={Dna} title="No earlier departures" description="Nothing before the current window." />}
        />
      </Panel>
    </div>
  );
}

/* ── Activity ─────────────────────────────────────────────────────────────── */

function ActivityTab({ identity }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel prominence="quiet" className="animate-rise">
        <PanelHeader prominence="quiet" title="Call volume, last 14 days" />
        <TrendChart className="mt-3" data={identity.callsPerDay} dataKey="calls" label="API calls per day" height={150} />
      </Panel>

      <Panel prominence="lead" flush className="animate-rise overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <PanelHeader
            prominence="lead"
            title="Recent calls"
            subtitle="Newest first. Rows tied to an open departure are marked, so the evidence sits in its own context."
          />
        </div>
        <DataGrid
          caption="Recent API calls"
          columns={[
            {
              key: 'at',
              header: 'When',
              width: '15%',
              cell: (row) => (
                <span className="whitespace-nowrap text-[12.5px] text-ink-2" title={formatDateTime(row.at)}>
                  {formatRelative(row.at)}
                </span>
              ),
            },
            {
              key: 'api',
              header: 'API call',
              primary: true,
              width: '27%',
              cell: (row) => (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate font-mono text-[12px] text-ink" title={row.api}>
                    {row.api}
                  </span>
                  {row.anomalyId && (
                    <Tag tone="critical" size="sm">
                      {ANOMALY_TYPES[row.anomalyType].label}
                    </Tag>
                  )}
                </span>
              ),
            },
            {
              key: 'resource',
              header: 'Resource',
              width: '30%',
              cell: (row) => (
                <span className="block min-w-0 truncate font-mono text-[11.5px] text-ink-3" title={row.resource}>
                  {row.resource}
                </span>
              ),
            },
            {
              key: 'source',
              header: 'Source',
              width: '16%',
              priority: 'wide',
              cell: (row) => <span className="font-mono text-[11.5px] text-ink-3">{row.sourceIp}</span>,
            },
            {
              key: 'region',
              header: 'Region',
              width: '12%',
              priority: 'wide',
              cell: (row) => <span className="text-[12px] text-ink-2">{row.region}</span>,
            },
          ]}
          rows={identity.events}
          rowKey={(row) => row.id}
          density="compact"
          skeletonRows={10}
        />
      </Panel>
    </div>
  );
}

/* ── Timeline ─────────────────────────────────────────────────────────────── */

const TIMELINE_TONES = {
  anomaly: 'border-critical/40 bg-critical-soft text-critical',
  model: 'border-brand/30 bg-info-soft text-brand',
  baseline: 'border-low/40 bg-low-soft text-low',
  learning: 'border-line-strong bg-surface-3 text-ink-3',
};

function TimelineTab({ identity }) {
  return (
    <Panel prominence="lead" className="animate-rise">
      <PanelHeader
        prominence="lead"
        title="How this identity got here"
        subtitle="Newest first. A baseline is a claim about history, so the history that produced it is on the record."
      />
      <ol className="mt-4 flex flex-col">
        {identity.timeline.map((entry, index) => (
          <li key={entry.id} className="flex gap-3">
            <div className="flex shrink-0 flex-col items-center">
              <span
                aria-hidden="true"
                className={`grid size-7 place-items-center rounded-full border text-[11px] font-bold ${TIMELINE_TONES[entry.kind]}`}
              >
                {index + 1}
              </span>
              {index < identity.timeline.length - 1 && (
                <span aria-hidden="true" className="min-h-8 w-px flex-1 bg-line" />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[13px] font-semibold text-ink">{entry.title}</p>
                <p className="shrink-0 text-[11.5px] text-ink-3" title={formatDateTime(entry.at)}>
                  {formatRelative(entry.at)}
                </p>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{entry.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* ── Peer group ───────────────────────────────────────────────────────────── */

function PeersTab({ identity }) {
  const { peers } = identity;
  const selfAxes = identity.fingerprint.baseline;
  const divergent = FINGERPRINT_AXES.map((axis) => ({
    ...axis,
    self: selfAxes[axis.key],
    peer: peers.average[axis.key],
    gap: selfAxes[axis.key] - peers.average[axis.key],
  })).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  return (
    <div className="flex flex-col gap-4">
      <Panel prominence="lead" className="animate-rise">
        <PanelHeader
          prominence="lead"
          title={`Against ${peers.group}`}
          subtitle={`${peers.size} identities doing the same job. Being the only member of a group doing something is stronger evidence than any single departure.`}
        />
        <div className="mt-4 grid gap-5 @min-[46rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Fingerprint
            series={[
              /* Being different from the group is evidence, not a verdict, so
                 the same two categorical hues as the genome tab. */
              { key: 'self', label: identity.name, values: selfAxes, tone: 'var(--t-series-4)' },
              { key: 'peer', label: 'Group average', values: peers.average, tone: 'var(--t-series-1)', dashed: true, fillOpacity: 0.08 },
            ]}
          />
          <div className="min-w-0">
            <SectionLabel>Largest divergences</SectionLabel>
            <ul className="mt-2 flex flex-col">
              {divergent.slice(0, 4).map((axis) => (
                <li key={axis.key} className="border-b border-line py-2 last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[12.5px] text-ink-2">{axis.label}</span>
                    {/* A gap from the group average is neutral ink with a sign,
                        not a severity tier: sitting 31 points above the group is
                        the evidence, and calling it critical here would rate it
                        against the same scale as the named departures above. */}
                    <span
                      data-numeric=""
                      className={`shrink-0 text-[12.5px] font-semibold ${axis.gap > 0 ? 'text-ink' : 'text-ink-3'}`}
                    >
                      {axis.gap > 0 ? '+' : ''}
                      {axis.gap}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    This identity {axis.self}, group average {axis.peer}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      <Panel prominence="quiet" flush className="animate-rise overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <PanelHeader prominence="quiet" title="Group members" />
        </div>
        <DataGrid
          caption="Peer group members"
          columns={[
            {
              key: 'name',
              header: 'Identity',
              primary: true,
              width: '44%',
              cell: (row) => (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">{row.name}</span>
                  {row.isSelf && (
                    <Tag tone="info" size="sm">
                      This identity
                    </Tag>
                  )}
                </span>
              ),
            },
            {
              key: 'risk',
              header: 'Risk',
              width: '16%',
              cell: (row) => (
                <span className="flex min-w-0 items-center gap-2">
                  <span data-numeric="" className="w-7 shrink-0 text-[12.5px] font-semibold text-ink">
                    {row.riskScore}
                  </span>
                  <Meter value={row.riskScore} tone={row.isSelf ? 'critical' : 'neutral'} height={3} className="min-w-0 flex-1" label="Risk score" />
                </span>
              ),
            },
            {
              key: 'anomalies',
              header: 'Departures',
              width: '18%',
              cell: (row) => (
                <span data-numeric="" className="text-[12.5px] text-ink-2">
                  {row.anomalyCount}
                </span>
              ),
            },
            {
              key: 'state',
              header: 'Baseline',
              width: '22%',
              cell: (row) => (
                <Tag tone={BASELINE_STATES[row.baselineState].tone} size="sm">
                  {BASELINE_STATES[row.baselineState].label}
                </Tag>
              ),
            },
          ]}
          rows={peers.members}
          rowKey={(row) => row.id}
          density="compact"
        />
      </Panel>
    </div>
  );
}

/* ── Containment ──────────────────────────────────────────────────────────── */

function ContainmentTab({ identity, onPreview, onApply }) {
  const { lock } = useAccess();
  if (identity.policies.length === 0) {
    return (
      <Panel prominence="lead">
        <EmptyState
          icon={ShieldCheck}
          title="Nothing to contain"
          description="Containment proposals are generated from open departures. This identity has none."
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {identity.policies.map((policy) => (
        <Panel key={policy.id} prominence={policy.applied ? 'quiet' : 'lead'} className="animate-rise">
          <PanelHeader
            prominence={policy.applied ? 'quiet' : 'lead'}
            title={policy.name}
            subtitle={policy.trigger}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone="neutral" size="sm">
                  {policy.kind}
                </Tag>
                {policy.autoApplySafe ? (
                  <Tag tone="low" size="sm">
                    Safe to auto-apply
                  </Tag>
                ) : (
                  <Tag tone="high" size="sm">
                    Review before applying
                  </Tag>
                )}
                {policy.applied && (
                  <Tag tone="low" size="sm" dot>
                    Applied {formatRelative(policy.appliedAt)}
                  </Tag>
                )}
              </div>
            }
          />

          <dl className="mt-3 flex flex-col">
            <Row label="What it does">{policy.action}</Row>
            <Row label="What it costs">{policy.impact}</Row>
          </dl>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon={Play} onClick={() => onPreview(policy)}>
              Preview document
            </Button>
            {!policy.applied && (
              <Button variant="primary" size="sm" icon={Check} onClick={() => onApply(policy)} locked={lock('anomalies.contain')}>
                Apply policy
              </Button>
            )}
          </div>
        </Panel>
      ))}
    </div>
  );
}

/* ── Shared ───────────────────────────────────────────────────────────────── */

function Row({ label, children }) {
  return (
    <div className="grid gap-0.5 border-b border-line py-2 last:border-0 @min-[26rem]:grid-cols-[minmax(0,160px)_minmax(0,1fr)] @min-[26rem]:gap-4">
      <dt className="text-[11.5px] text-ink-3">{label}</dt>
      <dd className="min-w-0 text-[12.5px] leading-relaxed text-ink-2">{children}</dd>
    </div>
  );
}
