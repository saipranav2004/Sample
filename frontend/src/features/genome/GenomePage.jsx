import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Dna, Download, SearchX, SlidersHorizontal } from 'lucide-react';
import {
  ANOMALY_STATUSES,
  ANOMALY_TYPES,
  ANOMALY_TYPE_ORDER,
  BASELINE_STATES,
  fetchAnomalyFeed,
  fetchGenomeOverview,
  setAnomalyStatus,
} from '../../lib/demo/genome';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { SEVERITIES, SEVERITY_ORDER, severityMeta } from '../../lib/domain';
import { formatNumber, formatRelative, percentValue } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { DataGrid } from '../../ui/DataGrid';
import { SearchInput } from '../../ui/Field';
import { AppliedFilters, FacetRail, useFacetRail } from '../../ui/FacetRail';
import { Meter, ProportionBar } from '../../ui/Meter';
import { Panel, PanelHeader } from '../../ui/Panel';
import { StatStripSkeleton } from '../../ui/Skeleton';
import { MetricTile } from '../../ui/Stat';
import { EmptyState, ErrorState } from '../../ui/States';
import { SegmentedControl } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { RefreshButton, TableToolbar } from '../../ui/TableTools';
import { useToast } from '../../ui/Toast';
import { RecordBar, ResultCount, ShowFiltersButton, WorkArea } from '../../ui/WorkArea';
import { TrendChart } from '../../charts/TrendChart';
import { AnomalyDrawer } from './AnomalyDrawer';

const WINDOWS = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

/**
 * NHI Genome - fleet view.
 *
 * The screen answers one question in order: is the fleet baselined, what
 * departed from its baseline, and which departure should be worked first.
 *
 * The anomaly feed leads, because it is the work. Coverage, mix and trend are
 * reference: they tell you whether to trust the feed, which is a different job
 * from acting on it.
 *
 * Nothing here is a scan result - see `lib/demo/runtime.js`.
 */
export default function GenomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { railOpen, toggleRail } = useFacetRail();
  const [selected, setSelected] = useState(null);

  const window = searchParams.get('window') || '24h';
  const severity = searchParams.get('severity') || '';
  const type = searchParams.get('type') || '';
  const status = searchParams.get('status') || '';
  const search = searchParams.get('q') || '';

  const setParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams();
    if (window !== '24h') next.set('window', window);
    setSearchParams(next, { replace: true });
  }, [setSearchParams, window]);

  const overview = useDemoQuery((signal) => fetchGenomeOverview({ window }, signal), [window]);
  const feed = useDemoQuery(
    (signal) => fetchAnomalyFeed({ window, severity, type, status }, signal),
    [window, severity, type, status],
  );

  const totals = overview.data?.totals;
  /* Memoised so the `?? []` fallback does not hand every dependent memo a new
     array on each render while the first request is still in flight. */
  const allRows = useMemo(() => feed.data?.rows ?? [], [feed.data]);
  const loading = feed.isLoading && !feed.data;

  /* Searched here rather than in the selector, so the facet counts keep
     describing the window while the grid describes the search. A rail whose
     numbers move as you type cannot be used to navigate. */
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return allRows;
    return allRows.filter((row) =>
      [row.identityName, row.account, row.api, row.resource, row.title, row.region]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }, [allRows, search]);

  const chips = useMemo(
    () =>
      [
        severity && { key: 'severity', label: 'Severity', value: severityMeta(severity).label },
        type && { key: 'type', label: 'Type', value: ANOMALY_TYPES[type]?.label ?? type },
        status && { key: 'status', label: 'State', value: ANOMALY_STATUSES[status]?.label ?? status },
        search.trim() && { key: 'q', label: 'Search', value: search.trim() },
      ].filter(Boolean),
    [severity, type, status, search],
  );

  const facetGroups = useMemo(
    () => [
      {
        key: 'severity',
        label: 'Severity',
        options: SEVERITY_ORDER.map((key) => ({
          value: key,
          label: SEVERITIES[key].label,
          active: severity === key,
          count: allRows.filter((row) => row.severity === key).length,
        })),
        onToggle: (value) => setParam('severity', severity === value ? '' : value),
        note: 'Severity follows detection confidence, so a low-confidence departure never outranks a certain one.',
      },
      {
        key: 'type',
        label: 'Departure type',
        options: ANOMALY_TYPE_ORDER.map((key) => ({
          value: key,
          label: ANOMALY_TYPES[key].label,
          active: type === key,
          count: allRows.filter((row) => row.type === key).length,
        })),
        onToggle: (value) => setParam('type', type === value ? '' : value),
      },
      {
        key: 'status',
        label: 'Disposition',
        options: Object.entries(ANOMALY_STATUSES).map(([key, meta]) => ({
          value: key,
          label: meta.label,
          active: status === key,
          count: allRows.filter((row) => row.status === key).length,
        })),
        onToggle: (value) => setParam('status', status === value ? '' : value),
      },
    ],
    [allRows, severity, type, status, setParam],
  );

  /* The rows on screen, in the order they are on screen - an export that
     silently returns the unfiltered set is a different answer to the one the
     operator was looking at. */
  const onExport = useCallback(() => {
    exportRowsToCsv({
      filename: timestampedName('nhi-genome-anomalies'),
      columns: [
        { header: 'Identity', value: (row) => row.identityName },
        { header: 'Kind', value: (row) => row.identityKind },
        { header: 'Account', value: (row) => row.account },
        { header: 'Departure type', value: (row) => ANOMALY_TYPES[row.type]?.label ?? row.type },
        { header: 'Severity', value: (row) => severityMeta(row.severity).label },
        { header: 'Confidence', value: (row) => `${row.confidence}%` },
        { header: 'Baseline', value: (row) => row.baseline?.headline ?? '' },
        { header: 'Observed', value: (row) => row.observed?.headline ?? '' },
        { header: 'API', value: (row) => row.api ?? '' },
        { header: 'Resource', value: (row) => row.resource ?? '' },
        { header: 'Region', value: (row) => row.region ?? '' },
        { header: 'Disposition', value: (row) => ANOMALY_STATUSES[row.status]?.label ?? row.status },
        { header: 'Detected (UTC)', value: (row) => row.detectedAt },
      ],
      rows,
    });
    notify({
      title: 'Exported current view',
      description: `${formatNumber(rows.length)} anomalies written, in the order shown.`,
      variant: 'success',
    });
  }, [rows, notify]);

  const decide = useCallback(
    (anomaly, nextStatus) => {
      setAnomalyStatus(anomaly.id, nextStatus);
      notify({
        title: `${ANOMALY_STATUSES[nextStatus].label}: ${anomaly.identityName}`,
        description: `${ANOMALY_TYPES[anomaly.type].label} recorded as ${ANOMALY_STATUSES[nextStatus].label.toLowerCase()}.`,
        variant: nextStatus === 'resolved' ? 'success' : 'info',
      });
      setSelected(null);
    },
    [notify],
  );

  const columns = [
    {
      key: 'identity',
      header: 'Identity',
      primary: true,
      width: '24%',
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block truncate text-[13px] font-semibold text-ink" title={row.identityName}>
            {row.identityName}
          </span>
          <span className="block truncate text-[11.5px] text-ink-3">{row.identityKind}</span>
        </span>
      ),
    },
    {
      key: 'anomaly',
      header: 'What departed',
      width: '30%',
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block truncate text-[12.5px] text-ink-2" title={row.title}>
            {row.title}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-ink-3">
            {row.baseline.headline} <span aria-hidden="true">&rarr;</span> {row.observed.headline}
          </span>
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: '13%',
      priority: 'wide',
      cell: (row) => (
        <Tag tone="neutral" size="sm">
          {ANOMALY_TYPES[row.type].label}
        </Tag>
      ),
    },
    {
      key: 'confidence',
      header: 'Confidence',
      width: '11%',
      cell: (row) => (
        <span className="block min-w-0">
          <span data-numeric="" className="text-[12.5px] font-semibold text-ink">
            {row.confidence}%
          </span>
          <Meter value={row.confidence} tone={severityMeta(row.severity).tone} height={3} className="mt-1" label="Detection confidence" />
        </span>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      width: '10%',
      cell: (row) => {
        const meta = severityMeta(row.severity);
        return (
          <Tag tone={meta.tone} size="sm" dot>
            {meta.label}
          </Tag>
        );
      },
    },
    {
      key: 'status',
      header: 'State',
      width: '10%',
      priority: 'wide',
      cell: (row) => (
        <Tag tone={ANOMALY_STATUSES[row.status].tone} size="sm">
          {ANOMALY_STATUSES[row.status].label}
        </Tag>
      ),
    },
    {
      key: 'age',
      header: 'Detected',
      width: '12%',
      cell: (row) => (
        <span className="block whitespace-nowrap text-[12.5px] text-ink-2">
          {formatRelative(row.detectedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="NHI Genome"
        lede="An anomaly is a measured departure from an identity's own baseline, never from a fleet average."
        actions={
          <>
            <SegmentedControl
              label="Detection window"
              options={WINDOWS}
              value={window}
              onChange={(value) => setParam('window', value === '24h' ? '' : value)}
            />
            <Button variant="secondary" icon={Download} onClick={onExport} disabled={rows.length === 0}>
              Export
            </Button>
          </>
        }
      />

      {overview.isError && !overview.data ? (
        <ErrorState error={overview.error} onRetry={overview.refetch} />
      ) : overview.isLoading && !overview.data ? (
        <StatStripSkeleton count={4} />
      ) : (
        <>
          <div className="grid gap-3 @min-[30rem]:grid-cols-2 @min-[54rem]:grid-cols-4">
            <MetricTile
              label="Baselines established"
              value={totals.established}
              tone="info"
              caption={`of ${formatNumber(totals.fleet)} identities watched`}
              meter={percentValue(totals.established, totals.fleet)}
              meterLabel="Share of the fleet baselined"
              className="animate-rise"
            />
            <MetricTile
              label="Still learning"
              value={totals.learning}
              tone="medium"
              caption="No baseline yet, so no anomaly can be raised"
              className="animate-rise"
              data-stagger=""
              style={{ '--stagger': 1 }}
            />
            <MetricTile
              label="Open anomalies"
              value={totals.openAnomalies}
              tone="high"
              caption={`${formatNumber(totals.anomalousIdentities)} identities, ${formatNumber(totals.anomalies)} total in window`}
              className="animate-rise"
              data-stagger=""
              style={{ '--stagger': 2 }}
            />
            <MetricTile
              label="Critical anomalies"
              value={totals.critical}
              tone="critical"
              caption="Highest confidence departures"
              className="animate-rise"
              data-stagger=""
              style={{ '--stagger': 3 }}
            />
          </div>

          <div className="grid gap-4 @min-[52rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            {/* Two panels stacked against one, because the coverage figures
                alone are a quarter of the height of the type list and a panel
                stretched to fill a row is mostly hole. The trend also reads
                better with a title of its own than buried under a ranked
                list - they answer different questions. */}
            <div className="flex flex-col gap-4">
              <Panel prominence="quiet" className="animate-rise">
                <PanelHeader prominence="quiet" title="Baseline coverage" />
                <ProportionBar
                  className="mt-3"
                  height={10}
                  total={totals.fleet}
                  ariaLabel={`${totals.established} established and ${totals.learning} learning of ${totals.fleet}`}
                  segments={[
                    { key: 'established', label: 'Established', value: totals.established, color: 'var(--t-low)' },
                    { key: 'learning', label: 'Learning', value: totals.learning, color: 'var(--t-medium)' },
                  ]}
                />
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Fact label="Mean confidence" value={totals.meanConfidence ? `${totals.meanConfidence}%` : '-'} />
                  <Fact label="Fleet risk" value={`${overview.data.fleetRisk}/100`} />
                  <Fact label="Drifting baselines" value={formatNumber(totals.drifting)} />
                  <Fact label="Window" value={WINDOWS.find((entry) => entry.value === window)?.label ?? window} />
                </dl>
                <p className="mt-4 text-[11.5px] leading-relaxed text-ink-3">
                  A drifting baseline is not an anomaly. It means the model needs retraining before
                  its verdicts are worth much.
                </p>
              </Panel>

              <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 1 }}>
                <PanelHeader prominence="quiet" title="Anomalies per day" />
                <TrendChart
                  className="mt-3"
                  data={overview.data.trend}
                  dataKey="anomalies"
                  label="Anomalies per day"
                  height={132}
                />
                <p className="mt-1 text-[11.5px] text-ink-3">Last 14 days, all severities.</p>
              </Panel>
            </div>

            <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 2 }}>
              <PanelHeader prominence="quiet" title="Departures by type" />
              <ul className="mt-3 flex flex-col">
                {overview.data.byType.map((entry) => (
                  <li key={entry.key} className="border-b border-line py-2 last:border-0">
                    <button
                      type="button"
                      onClick={() => setParam('type', type === entry.key ? '' : entry.key)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cnLabel(type === entry.key)}>{entry.label}</span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-track">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${totals.anomalies ? (entry.count / totals.anomalies) * 100 : 0}%`,
                              background: 'var(--t-series-1)',
                            }}
                          />
                        </span>
                      </span>
                      <span data-numeric="" className="shrink-0 text-[12.5px] font-semibold text-ink">
                        {entry.count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-4 @min-[52rem]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <Panel prominence="quiet" flush className="animate-rise overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <PanelHeader prominence="quiet" title="Most anomalous identities" />
              </div>
              {overview.data.topAnomalous.length === 0 ? (
                <p className="px-4 py-6 text-[12.5px] text-ink-3">
                  No identity departed from its baseline in this window.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {overview.data.topAnomalous.map((identity) => (
                    <li key={identity.id}>
                      <Link
                        to={`/genome/${identity.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-3"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">
                            {identity.name}
                          </span>
                          <span className="block truncate text-[11.5px] text-ink-3">
                            {identity.kind} · {identity.account}
                          </span>
                        </span>
                        <span data-numeric="" className="shrink-0 text-[12px] text-ink-3">
                          {identity.anomalyCount} open
                        </span>
                        <span data-numeric="" className="w-10 shrink-0 text-right text-[13px] font-semibold text-ink">
                          {identity.riskScore}
                        </span>
                        {identity.worstSeverity && (
                          <Tag tone={severityMeta(identity.worstSeverity).tone} size="sm" dot>
                            {severityMeta(identity.worstSeverity).label}
                          </Tag>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 1 }}>
              <PanelHeader
                prominence="quiet"
                title="Peer-group outliers"
                subtitle="A group is identities doing the same job. Being the only member doing something is stronger evidence than any single departure."
              />
              {overview.data.peerOutliers.length === 0 ? (
                <p className="mt-3 text-[12.5px] text-ink-3">No group has an outlier in this window.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {overview.data.peerOutliers.map((entry) => (
                    <li key={entry.group} className="border-b border-line pb-3 last:border-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">
                          {entry.group}
                        </span>
                        <span data-numeric="" className="shrink-0 text-[11.5px] text-ink-3">
                          {entry.outliers} of {entry.size}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">{entry.statement}</p>
                      <Link
                        to={`/genome/${entry.leadId}`}
                        className="mt-1.5 inline-flex text-[11.5px] font-medium text-brand hover:underline"
                      >
                        Open the outlier
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <PanelHeader prominence="quiet" title="Recently baselined" className="mt-5" />
              <ul className="mt-2 flex flex-col gap-1.5">
                {overview.data.recentlyBaselined.map((identity) => (
                  <li key={identity.id} className="flex items-center gap-2">
                    <Link
                      to={`/genome/${identity.id}`}
                      className="min-w-0 flex-1 truncate text-[12px] text-ink-2 hover:text-ink hover:underline"
                    >
                      {identity.name}
                    </Link>
                    <span className="shrink-0 text-[11px] text-ink-3">
                      {formatRelative(identity.baselineEstablished)}
                    </span>
                    <Tag tone={BASELINE_STATES[identity.baselineState].tone} size="sm">
                      {BASELINE_STATES[identity.baselineState].label}
                    </Tag>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}

      <WorkArea
        railOpen={railOpen}
        rail={
          <FacetRail
            groups={facetGroups}
            appliedCount={chips.length}
            onClearAll={clearAll}
            onClose={toggleRail}
            mobileTitle="Filter anomalies"
          />
        }
      >
        <Panel prominence="lead" flush className="animate-rise overflow-hidden">
          <RecordBar
            trailing={
              <TableToolbar>
                <SearchInput
                  value={search}
                  onChange={(value) => setParam('q', value)}
                  placeholder="Search identity or API..."
                  size="sm"
                  className="w-full sm:w-64"
                />
                {!railOpen && <ShowFiltersButton onClick={toggleRail} appliedCount={chips.length} />}
                <RefreshButton onRefresh={feed.refetch} refreshing={feed.isRefreshing} label="Refresh anomalies" />
              </TableToolbar>
            }
          >
            <ResultCount
              shown={formatNumber(rows.length)}
              total={formatNumber(feed.data?.total ?? 0)}
              unit="anomalies"
              filtered={chips.length > 0}
              loading={loading}
            />
            <span className="hidden text-[11.5px] text-ink-3 xl:inline">
              Open a row to read the baseline it departed from
            </span>
          </RecordBar>

          <AppliedFilters filters={chips} onRemove={(key) => setParam(key, '')} onClearAll={clearAll} />

          {feed.isError && !feed.data ? (
            <ErrorState error={feed.error} onRetry={feed.refetch} />
          ) : (
            <DataGrid
              caption="Behavioural anomalies"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              loading={loading}
              refreshing={feed.isRefreshing}
              onRowClick={setSelected}
              density="comfortable"
              skeletonRows={8}
              emptyState={
                chips.length > 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No anomaly matches those filters"
                    description="Every departure in this window is outside the current selection."
                    action={
                      <Button variant="secondary" size="sm" onClick={clearAll}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Dna}
                    title="No departures in this window"
                    description="Every baselined identity behaved inside its own baseline. Widen the window to look further back."
                    action={
                      <Button variant="secondary" size="sm" icon={SlidersHorizontal} onClick={() => setParam('window', '30d')}>
                        Look back 30 days
                      </Button>
                    }
                  />
                )
              }
            />
          )}
        </Panel>
      </WorkArea>

      <AnomalyDrawer
        anomaly={selected}
        onClose={() => setSelected(null)}
        onDecide={decide}
        onInvestigate={(anomaly) => {
          setSelected(null);
          navigate(`/genome/${anomaly.identityId}`);
        }}
      />
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">{label}</dt>
      <dd data-numeric="" className="mt-0.5 truncate text-[13px] font-semibold text-ink">
        {value}
      </dd>
    </div>
  );
}

function cnLabel(active) {
  return active
    ? 'block truncate text-[12.5px] font-semibold text-brand'
    : 'block truncate text-[12.5px] text-ink-2';
}
