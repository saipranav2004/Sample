import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, FileWarning, Fingerprint, KeyRound, LineChart, RotateCw } from 'lucide-react';
import { useScanContext } from '../../app/ScanContext';
import { fetchEvents, fetchFindings, fetchPostureOverview, fetchSummary } from '../../lib/api/endpoints';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { PILLARS } from '../../lib/posture';
import { BandTag, Delta, ScoreRing } from '../posture/parts';
import { useQuery } from '../../lib/hooks';
import {
  CLASSIFICATION_ORDER,
  classificationMeta,
  credentialKindMeta,
  severityMeta,
} from '../../lib/domain';
import {
  formatDate,
  formatNumber,
  humanizeToken,
  percentValue,
} from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { BarList } from '../../charts/BarList';
import { CompositionDonut } from '../../charts/CompositionDonut';
import { TrendChart } from '../../charts/TrendChart';
import { Button } from '../../ui/Button';
import { Panel, PanelHeader } from '../../ui/Panel';
import { MetricTile } from '../../ui/Stat';
import { ProportionBar } from '../../ui/Meter';
import { Tag } from '../../ui/Tag';
import {
  ChartSkeleton,
  DonutSkeleton,
  LoadingAnnouncement,
  Skeleton,
  StatStripSkeleton,
} from '../../ui/Skeleton';
import { ClearState, EmptyState, ErrorState, InlineError } from '../../ui/States';
import { ScanContextStrip } from './ScanContextStrip';
import { SignalList } from './SignalList';
import { ActivityFeed } from '../activity/ActivityFeed';
import { describeScannerError, summariseFindings } from '../exposure/scannerState';

export default function OverviewPage() {
  const { selectedScanId, scans } = useScanContext();

  const summaryQuery = useQuery((signal) => fetchSummary({ scanId: selectedScanId }, signal), [
    selectedScanId,
  ]);
  const eventsQuery = useQuery(
    (signal) => fetchEvents({ scanId: selectedScanId, page: 1, pageSize: 8 }, signal),
    [selectedScanId],
  );
  const findingsQuery = useQuery((signal) => fetchFindings(signal), []);

  const summary = summaryQuery.data;

  /* Classification slices follow the canonical order so a colour always means
     the same category; anything the backend reports outside that order is
     appended rather than dropped. */
  const classificationSlices = useMemo(() => {
    const breakdown = summary?.classification_breakdown || {};
    const keys = [
      ...CLASSIFICATION_ORDER.filter((key) => key in breakdown),
      ...Object.keys(breakdown).filter((key) => !CLASSIFICATION_ORDER.includes(key)),
    ];
    return keys
      .map((key) => {
        const meta = classificationMeta(key);
        return { key, label: meta.label, value: Number(breakdown[key]) || 0, color: meta.color };
      })
      .filter((slice) => slice.value > 0);
  }, [summary]);

  const credentialItems = useMemo(() => {
    const breakdown = summary?.credentials_breakdown || {};
    return Object.entries(breakdown)
      .map(([key, value]) => ({ key, label: credentialKindMeta(key).label, value: Number(value) || 0 }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [summary]);

  /* Trend series: completed scans in chronological order. */
  const trendData = useMemo(
    () =>
      [...scans]
        .filter((scan) => String(scan.status).toUpperCase() === 'COMPLETED')
        .sort((a, b) => new Date(a.scan_start) - new Date(b.scan_start))
        .map((scan) => ({
          label: formatDate(scan.scan_start),
          subtitle: scan.target_name || scan.account_id || scan.scan_id,
          identities: Number(scan.total_identities) || 0,
          events: Number(scan.total_events) || 0,
          credentials: Number(scan.total_credentials) || 0,
        })),
    [scans],
  );

  const findingSummary = useMemo(
    () => summariseFindings(findingsQuery.data?.findings),
    [findingsQuery.data],
  );

  const refreshAll = () => {
    summaryQuery.refetch();
    eventsQuery.refetch();
    findingsQuery.refetch();
  };

  if (summaryQuery.isError && !summary) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Dashboard"
          lede="Discovery results could not be loaded."
        />
        <Panel>
          <ErrorState error={summaryQuery.error} onRetry={summaryQuery.refetch} />
        </Panel>
      </div>
    );
  }

  const loadingSummary = summaryQuery.isLoading && !summary;
  const totalIdentities = Number(summary?.total_identities) || 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        actions={
          <Button
            variant="secondary"
            icon={RotateCw}
            onClick={refreshAll}
            loading={summaryQuery.isRefreshing}
          >
            Refresh
          </Button>
        }
        meta={<ScanContextStrip />}
      />

      <PostureBanner />

      {/* ── Headline counters ───────────────────────────────────────────── */}
      {loadingSummary ? (
        <>
          <LoadingAnnouncement label="Loading posture metrics" />
          <StatStripSkeleton count={4} />
        </>
      ) : (
        <div className="grid gap-3 @min-[30rem]:grid-cols-2 @min-[54rem]:grid-cols-4">
          <MetricTile
            as={Link}
            to="/identities"
            data-stagger=""
            style={{ '--stagger': 0 }}
            className="animate-rise"
            label="Identities discovered"
            value={totalIdentities}
            sparkline={trendData.map((point) => point.identities)}
            icon={Fingerprint}
            tone="brand"
            caption={`${formatNumber(summary?.total_humans)} human · ${formatNumber(summary?.total_nhis)} non-human`}
          />
          <MetricTile
            data-stagger=""
            style={{ '--stagger': 1 }}
            className="animate-rise"
            label="Non-human identities"
            value={summary?.total_nhis}
            icon={Bot}
            tone="info"
            caption="Workloads, pipelines, agents and vendor platforms"
            meter={percentValue(summary?.total_nhis, totalIdentities)}
            meterLabel="Share of all identities"
          />
          <MetricTile
            as={Link}
            to="/credentials"
            data-stagger=""
            style={{ '--stagger': 2 }}
            className="animate-rise"
            label="Credentials in use"
            value={summary?.total_credentials}
            icon={KeyRound}
            tone="medium"
            caption="Keys, passwords and certificates held by identities"
          />
          <CodeExposureTile query={findingsQuery} summary={findingSummary} />
        </div>
      )}

      {/* ── Signals + population ────────────────────────────────────────── */}
      <div className="grid gap-4 @min-[52rem]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel prominence="lead" className="animate-rise" data-stagger="" style={{ '--stagger': 3 }}>
          <PanelHeader prominence="lead"
            title="Exposure signals"
          />
          <div className="mt-3">
            {summaryQuery.isError ? (
              <InlineError error={summaryQuery.error} onRetry={summaryQuery.refetch} label="Signals unavailable" />
            ) : (
              <SignalList summary={summary} loading={loadingSummary} />
            )}
          </div>
        </Panel>

        <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 4 }}>
          <PanelHeader prominence="quiet"
            title="Classification mix"
          />
          <div className="mt-4">
            {loadingSummary ? (
              <DonutSkeleton />
            ) : classificationSlices.length === 0 ? (
              <EmptyState
                compact
                title="Nothing classified yet"
                description="This scan produced no classified identities, so there is no mix to break down."
              />
            ) : (
              <>
                <CompositionDonut
                  data={classificationSlices}
                  total={totalIdentities}
                  centerLabel="Identities"
                />
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
                    Human vs non-human
                  </p>
                  <ProportionBar
                    className="mt-2"
                    total={totalIdentities}
                    ariaLabel={`${formatNumber(summary?.total_humans)} human and ${formatNumber(summary?.total_nhis)} non-human identities`}
                    segments={[
                      {
                        key: 'human',
                        label: 'Human',
                        value: Number(summary?.total_humans) || 0,
                        color: 'var(--t-series-1)',
                      },
                      {
                        key: 'nhi',
                        label: 'Non-human',
                        value: Number(summary?.total_nhis) || 0,
                        color: 'var(--t-series-5)',
                      },
                    ]}
                  />
                  <dl className="mt-2.5 flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-[2px]"
                        style={{ background: 'var(--t-series-1)' }}
                      />
                      <dt className="text-ink-3">Human</dt>
                      <dd data-numeric="" className="font-semibold text-ink">
                        {formatNumber(summary?.total_humans)}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-[2px]"
                        style={{ background: 'var(--t-series-5)' }}
                      />
                      <dt className="text-ink-3">Non-human</dt>
                      <dd data-numeric="" className="font-semibold text-ink">
                        {formatNumber(summary?.total_nhis)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Credential surface + trend ──────────────────────────────────── */}
      <div className="grid gap-4 @min-[52rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 5 }}>
          <PanelHeader prominence="quiet"
            title="Credential surface"
            actions={
              <Button as={Link} to="/credentials" variant="secondary" size="sm" iconRight={ArrowRight}>
                Inspect
              </Button>
            }
          />
          <div className="mt-3">
            {loadingSummary ? (
              <ChartSkeleton height={220} bars={6} />
            ) : credentialItems.length === 0 ? (
              <ClearState
                compact
                title="No credentials recorded"
                description="No identity in this scan holds an access key, password or certificate."
              />
            ) : (
              <>
                <BarList items={credentialItems} />
                <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-3">
                  <div>
                    <dt className="text-[10.5px] font-semibold tracking-[0.11em] text-ink-3 uppercase">
                      Total credentials
                    </dt>
                    <dd
                      data-numeric=""
                      className="mt-0.5 font-display text-[19px] leading-none font-bold text-ink"
                    >
                      {formatNumber(summary?.total_credentials)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-semibold tracking-[0.11em] text-ink-3 uppercase">
                      Distinct types
                    </dt>
                    <dd
                      data-numeric=""
                      className="mt-0.5 font-display text-[19px] leading-none font-bold text-ink"
                    >
                      {formatNumber(credentialItems.length)}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        </Panel>

        <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 6 }}>
          <PanelHeader prominence="quiet"
            title="Discovery trend"
            subtitle="One chart per measure: the three differ by orders of magnitude, so a shared axis would flatten two of them."
          />
          <div className="mt-4">
            {trendData.length === 0 ? (
              <EmptyState
                compact
                icon={LineChart}
                title="Not enough scan history"
                description="A trend needs at least one completed scan. Run a discovery scan to start the series."
              />
            ) : trendData.length === 1 ? (
              <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-3.5 py-3 text-[12.5px] text-ink-2">
                Only one completed scan exists, so there is no trend to plot yet - the current
                snapshot recorded{' '}
                <strong className="font-semibold text-ink" data-numeric="">
                  {formatNumber(trendData[0].identities)}
                </strong>{' '}
                identities and{' '}
                <strong className="font-semibold text-ink" data-numeric="">
                  {formatNumber(trendData[0].events)}
                </strong>{' '}
                events.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {[
                  { key: 'identities', label: 'Identities', color: 'var(--t-series-1)' },
                  { key: 'events', label: 'CloudTrail events', color: 'var(--t-series-5)' },
                  { key: 'credentials', label: 'Credentials', color: 'var(--t-series-2)' },
                ].map((series, index, list) => (
                  <div key={series.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[12px] font-semibold text-ink-2">{series.label}</p>
                      <p className="text-[11.5px] text-ink-3" data-numeric="">
                        latest {formatNumber(trendData[trendData.length - 1][series.key])}
                      </p>
                    </div>
                    <TrendChart
                      data={trendData}
                      dataKey={series.key}
                      label={series.label}
                      color={series.color}
                      height={index === list.length - 1 ? 124 : 104}
                      showXAxis={index === list.length - 1}
                      syncId="posture-trend"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Activity + newest findings ──────────────────────────────────── */}
      <div className="grid gap-4 @min-[52rem]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 7 }}>
          <PanelHeader prominence="quiet"
            title="Latest API activity"
            actions={
              <Button as={Link} to="/activity" variant="secondary" size="sm" iconRight={ArrowRight}>
                All activity
              </Button>
            }
          />
          <div className="mt-4">
            <ActivityFeed
              events={eventsQuery.data?.rows}
              loading={eventsQuery.isLoading && !eventsQuery.data}
              error={eventsQuery.error}
              onRetry={eventsQuery.refetch}
              limit={8}
            />
          </div>
        </Panel>

        <Panel prominence="default" className="animate-rise" data-stagger="" style={{ '--stagger': 8 }}>
          <PanelHeader
            title="Credential exposure"
            actions={
              <Button as={Link} to="/exposure" variant="secondary" size="sm" iconRight={ArrowRight}>
                Review findings
              </Button>
            }
          />
          <div className="mt-4">
            <FindingsMiniPanel query={findingsQuery} summary={findingSummary} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** Tile for the scanner service, which has its own availability story. */
function CodeExposureTile({ query, summary }) {
  if (query.isLoading && !query.data) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-4">
        <Skeleton className="h-3 w-28 rounded" />
        <Skeleton className="mt-3 h-8 w-16 rounded" />
        <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
      </div>
    );
  }

  if (query.isError) {
    const detail = describeScannerError(query.error);
    return (
      <div className="flex flex-col justify-between rounded-[var(--radius-panel)] border border-line bg-surface p-4">
        <p className="text-[11px] font-semibold tracking-[0.09em] text-ink-3 uppercase">
          Secrets in code
        </p>
        <p className="mt-2 text-[12.5px] leading-snug text-ink-2">{detail.title}</p>
        <Button variant="ghost" size="sm" icon={RotateCw} onClick={query.refetch} className="mt-2 self-start">
          Retry
        </Button>
      </div>
    );
  }

  const highish = (summary.byTier.CRITICAL || 0) + (summary.byTier.HIGH || 0);

  return (
    <MetricTile
      as={Link}
      to="/exposure"
      data-stagger=""
      style={{ '--stagger': 3 }}
      className="animate-rise"
      label="Secrets in code"
      value={summary.total}
      icon={FileWarning}
      tone={highish > 0 ? 'critical' : 'low'}
      caption={`${formatNumber(highish)} high or critical · ${formatNumber(summary.repositoryCount)} repositories`}
      meter={percentValue(highish, summary.total)}
      meterLabel="Share at high or critical risk"
    />
  );
}

function FindingsMiniPanel({ query, summary }) {
  if (query.isLoading && !query.data) {
    return <ChartSkeleton height={180} bars={4} />;
  }

  if (query.isError) {
    const detail = describeScannerError(query.error);
    return (
      <div className="flex flex-col gap-3">
        <InlineError error={{ message: detail.message }} onRetry={query.refetch} label={detail.title} />
      </div>
    );
  }

  if (summary.total === 0) {
    return (
      <ClearState
        compact
        title="No live exposures"
        description="Nothing is currently flagged across the connected repositories, or everything found has been reviewed and dismissed."
      />
    );
  }

  const tiers = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    .map((tier) => ({ tier, count: summary.byTier[tier] || 0 }))
    .filter((row) => row.count > 0);

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col divide-y divide-line">
        {tiers.map(({ tier, count }) => {
          const meta = severityMeta(tier);
          return (
            <li key={tier} className="flex items-center gap-3 py-2.5">
              <Tag tone={meta.tone} dot size="sm" className="w-24 justify-center">
                {meta.label}
              </Tag>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                <span
                  className="block h-full rounded-full transition-[width] duration-[900ms] ease-[var(--ease-out-quint)]"
                  style={{
                    width: `${percentValue(count, summary.total)}%`,
                    background: `var(--t-${meta.tone})`,
                  }}
                />
              </span>
              <span data-numeric="" className="w-10 text-right font-display text-[15px] font-bold text-ink">
                {formatNumber(count)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
        <div>
          <p className="text-[10.5px] font-semibold tracking-[0.11em] text-ink-3 uppercase">GitHub</p>
          <p data-numeric="" className="mt-0.5 font-display text-[17px] font-bold text-ink">
            {formatNumber(summary.byPlatform.github)}
          </p>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold tracking-[0.11em] text-ink-3 uppercase">CodeCommit</p>
          <p data-numeric="" className="mt-0.5 font-display text-[17px] font-bold text-ink">
            {formatNumber(summary.byPlatform.codecommit)}
          </p>
        </div>
      </div>

      {summary.detectors.length > 0 && (
        <div className="border-t border-line pt-3">
          <p className="text-[10.5px] font-semibold tracking-[0.11em] text-ink-3 uppercase">
            Most frequent detectors
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {summary.detectors.slice(0, 4).map((entry) => (
              <li key={entry.key} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[12.5px] text-ink-2">
                  {humanizeToken(entry.key)}
                </span>
                <span data-numeric="" className="text-[12.5px] font-semibold text-ink">
                  {formatNumber(entry.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The posture score leads the dashboard: it is the one number that says how
 * exposed the estate is, and everything below it is what that number is made
 * of. Its detail lives on Posture; this says where it stands, which way it is
 * moving, and the single fix that would move it most.
 */
function PostureBanner() {
  const query = useDemoQuery((signal) => fetchPostureOverview({ window: 30 }, signal), []);
  const data = query.data;
  if (query.isError && !data) {
    return <InlineError error={query.error} onRetry={query.refetch} label="Posture score unavailable" />;
  }
  if (!data) {
    return (
      <Panel prominence="lead" aria-busy="true">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-3 w-72 rounded" />
          </div>
        </div>
      </Panel>
    );
  }
  const weakest = [...data.pillars].sort((a, b) => a.score - b.score)[0];
  const win = data.quickWins[0];
  return (
    <Panel prominence="lead" className="animate-rise">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-4">
          <ScoreRing score={data.fleet.score} size={72} grade={data.fleet.grade} />
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Posture score</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <BandTag score={data.fleet.score} />
              <span>Grade {data.fleet.grade}</span>
              <Delta value={data.fleet.delta} />
              <span className="text-ink-3">in 30 days</span>
            </p>
          </div>
        </div>
        <dl className="grid flex-1 grid-cols-1 gap-x-6 gap-y-3 @min-[36rem]:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Weakest pillar</dt>
            <dd className="mt-0.5 truncate text-[13px] font-semibold text-ink">
              {PILLARS[weakest.key].label} <span className="font-normal text-ink-3">at {weakest.score}</span>
            </dd>
          </div>
          {win && (
            <div className="min-w-0">
              <dt className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Biggest quick win</dt>
              <dd className="mt-0.5 truncate text-[13px] font-semibold text-ink" title={win.title}>
                {win.title} <span className="font-normal text-low">+{win.fleetGain}</span>
              </dd>
            </div>
          )}
        </dl>
        <Button as={Link} to={win ? `/posture?check=${win.key}` : '/posture'} variant="secondary" size="sm" iconRight={ArrowRight}>
          Open Posture
        </Button>
      </div>
    </Panel>
  );
}
