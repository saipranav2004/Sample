import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, SearchX, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { useAccess } from '../../app/useAccess';
import { fetchPostureOverview, remediatePostureMany } from '../../lib/api/endpoints';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { SEVERITY_ORDER, severityMeta } from '../../lib/domain';
import { formatNumber } from '../../lib/format';
import { bandFor, BANDS, bandMeta, PILLARS } from '../../lib/posture';
import { PageHeader } from '../../shell/PageHeader';
import { TrendChart } from '../../charts/TrendChart';
import { Button, IconButton } from '../../ui/Button';
import { DataGrid } from '../../ui/DataGrid';
import { SearchInput } from '../../ui/Field';
import { AppliedFilters, FacetRail, useFacetRail } from '../../ui/FacetRail';
import { Modal } from '../../ui/Overlay';
import { Pagination } from '../../ui/Pagination';
import { Panel, PanelHeader } from '../../ui/Panel';
import { ChartSkeleton, ListSkeleton, Skeleton } from '../../ui/Skeleton';
import { EmptyState, ErrorState } from '../../ui/States';
import { SegmentedControl } from '../../ui/Tabs';
import { RefreshButton, TableToolbar } from '../../ui/TableTools';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { RecordBar, ResultCount, ShowFiltersButton, WorkArea } from '../../ui/WorkArea';
import { cn, TONE_VAR } from '../../ui/cn';
import { BandTag, Delta, PillarBars, ScoreRing } from './parts';

const WINDOWS = [
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
];

const SORTS = {
  score: (a, b) => a.score - b.score || b.failed - a.failed,
  failed: (a, b) => a.failed - b.failed || a.score - b.score,
  trend: (a, b) => (a.trend ?? 0) - (b.trend ?? 0),
};

/**
 * Posture - identity security posture management.
 *
 * Every identity scored against the same checks in six pillars, so the page
 * answers three questions in order: how is the estate doing and which way is
 * it moving (the score and its trend), where is it weakest (distribution,
 * pillars, categories, accounts), and what single fix buys the most (quick
 * wins). The table below is where any of those leads.
 *
 * Every figure comes from one evaluation, so a count in a panel and the rows
 * its filter shows always agree.
 */
export default function PosturePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { railOpen, toggleRail } = useFacetRail();

  const window = searchParams.get('window') === '90' ? '90' : '30';
  const band = searchParams.get('band') || '';
  const severity = searchParams.get('severity') || '';
  const category = searchParams.get('category') || '';
  const account = searchParams.get('account') || '';
  const pillar = searchParams.get('pillar') || '';
  const check = searchParams.get('check') || '';
  const flag = searchParams.get('flag') || '';
  const search = searchParams.get('q') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('size')) || 25));
  const sortKey = SORTS[searchParams.get('sort')] ? searchParams.get('sort') : 'score';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';

  const setParams = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      /* Any change to what is listed returns to the first page. */
      if (!('page' in patch)) next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const setParam = useCallback((key, value) => setParams({ [key]: value }), [setParams]);

  const clearAll = useCallback(() => {
    const next = new URLSearchParams();
    if (window !== '30') next.set('window', window);
    setSearchParams(next, { replace: true });
  }, [setSearchParams, window]);

  const query = useDemoQuery((signal) => fetchPostureOverview({ window: Number(window) }, signal), [window]);
  const data = query.data;
  const loading = query.isLoading && !data;
  const allRows = useMemo(() => data?.rows ?? [], [data]);
  const flagMeta = data?.flags.find((entry) => entry.key === flag);
  const checkTitle = data?.checks.find((entry) => entry.key === check)?.title;

  /* Facets narrow by everything except themselves, so each count says what
     choosing that option would show. */
  const matches = useCallback(
    (row, skip) => {
      if (skip !== 'band' && band && row.band !== band) return false;
      if (skip !== 'severity' && severity && !row.failedBySeverity[severity]) return false;
      if (skip !== 'category' && category && row.category !== category) return false;
      if (skip !== 'account' && account && row.account !== account) return false;
      if (skip !== 'pillar' && pillar && row.weakestPillar !== pillar) return false;
      if (skip !== 'check' && check && !row.failingChecks.includes(check)) return false;
      if (skip !== 'flag' && flagMeta && !row.failingChecks.some((key) => flagMeta.checks.includes(key))) return false;
      return true;
    },
    [band, severity, category, account, pillar, check, flagMeta],
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = allRows.filter(
      (row) =>
        matches(row) &&
        (!needle || [row.name, row.arn, row.account, row.category, row.type].some((field) => String(field).toLowerCase().includes(needle))),
    );
    const sorted = [...filtered].sort(SORTS[sortKey]);
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [allRows, matches, search, sortKey, sortDirection]);

  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, (safePage - 1) * pageSize + pageSize),
    [rows, safePage, pageSize],
  );

  const chips = [
    band && { key: 'band', label: 'Band', value: bandMeta(band).label },
    severity && { key: 'severity', label: 'Failing', value: severityMeta(severity).label },
    category && { key: 'category', label: 'Category', value: category },
    account && { key: 'account', label: 'Account', value: account },
    pillar && { key: 'pillar', label: 'Weakest pillar', value: PILLARS[pillar]?.label ?? pillar },
    check && { key: 'check', label: 'Check', value: checkTitle ?? check },
    flagMeta && { key: 'flag', label: 'Risk', value: flagMeta.label },
    search.trim() && { key: 'q', label: 'Search', value: search.trim() },
  ].filter(Boolean);

  const countOf = (skip, test) => allRows.filter((row) => matches(row, skip) && test(row)).length;
  const distinct = (field) => [...new Set(allRows.map((row) => row[field]))].sort();

  const facetGroups = [
    {
      key: 'band',
      label: 'Posture band',
      options: BANDS.map((entry) => ({
        value: entry.key,
        label: `${entry.label} (${entry.min === 0 ? '0' : entry.min}${entry.key === 'healthy' ? '+' : `-${BANDS[BANDS.indexOf(entry) - 1].min - 1}`})`,
        active: band === entry.key,
        count: countOf('band', (row) => row.band === entry.key),
      })),
      onToggle: (value) => setParam('band', band === value ? '' : value),
    },
    {
      key: 'severity',
      label: 'Failing severity',
      options: SEVERITY_ORDER.map((key) => ({
        value: key,
        label: severityMeta(key).label,
        active: severity === key,
        count: countOf('severity', (row) => Boolean(row.failedBySeverity[key])),
      })),
      onToggle: (value) => setParam('severity', severity === value ? '' : value),
      note: 'Identities failing at least one check of this severity.',
    },
    {
      key: 'category',
      label: 'Category',
      options: distinct('category').map((value) => ({
        value,
        label: value,
        active: category === value,
        count: countOf('category', (row) => row.category === value),
      })),
      onToggle: (value) => setParam('category', category === value ? '' : value),
    },
    {
      key: 'pillar',
      label: 'Weakest pillar',
      options: Object.entries(PILLARS).map(([key, meta]) => ({
        value: key,
        label: meta.label,
        active: pillar === key,
        count: countOf('pillar', (row) => row.weakestPillar === key),
      })),
      onToggle: (value) => setParam('pillar', pillar === value ? '' : value),
    },
    {
      key: 'account',
      label: 'Account',
      options: distinct('account').map((value) => ({
        value,
        label: value,
        active: account === value,
        count: countOf('account', (row) => row.account === value),
      })),
      onToggle: (value) => setParam('account', account === value ? '' : value),
    },
  ];

  const onExport = useCallback(() => {
    exportRowsToCsv({
      filename: timestampedName('identity-posture'),
      columns: [
        { header: 'Identity', value: (row) => row.name },
        { header: 'ARN', value: (row) => row.arn },
        { header: 'Type', value: (row) => row.type },
        { header: 'Category', value: (row) => row.category },
        { header: 'Account', value: (row) => row.account },
        { header: 'Score', value: (row) => row.score },
        { header: 'Grade', value: (row) => row.grade },
        { header: 'Band', value: (row) => bandMeta(row.band).label },
        { header: 'Weakest pillar', value: (row) => (row.weakestPillar ? PILLARS[row.weakestPillar].label : '') },
        { header: 'Failed checks', value: (row) => row.failed },
        { header: 'Change over 30 days', value: (row) => (row.trend ?? '') },
      ],
      rows,
    });
    notify({
      title: 'Exported current view',
      description: `${formatNumber(rows.length)} identities written, in the order shown.`,
      variant: 'success',
    });
  }, [rows, notify]);

  const columns = [
    {
      key: 'identity',
      header: 'Identity',
      primary: true,
      width: '26%',
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block truncate font-mono text-[12.5px] font-semibold text-ink" title={row.arn}>
            {row.name}
          </span>
          <span className="block truncate text-[11.5px] text-ink-3">
            {row.type} · {row.category}
          </span>
        </span>
      ),
    },
    {
      key: 'account',
      header: 'Account',
      width: '12%',
      priority: 'wide',
      cell: (row) => <span className="block truncate text-[12.5px] text-ink-2">{row.account}</span>,
    },
    {
      key: 'score',
      header: 'Score',
      width: '14%',
      sortable: true,
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <ScoreRing score={row.score} size={34} grade={row.grade} />
          <BandTag score={row.score} />
        </span>
      ),
    },
    {
      key: 'pillar',
      header: 'Weakest pillar',
      width: '14%',
      priority: 'wide',
      cell: (row) =>
        row.weakestPillar ? (
          <span className="block truncate text-[12.5px] text-ink-2">{PILLARS[row.weakestPillar].label}</span>
        ) : (
          <span className="text-[12.5px] text-ink-3">None</span>
        ),
    },
    {
      key: 'failed',
      header: 'Failed checks',
      width: '13%',
      sortable: true,
      cell: (row) =>
        row.failed === 0 ? (
          <span className="text-[12.5px] text-ink-3">None</span>
        ) : (
          <span
            className="flex items-center gap-2"
            title={SEVERITY_ORDER.filter((key) => row.failedBySeverity[key])
              .map((key) => `${row.failedBySeverity[key]} ${severityMeta(key).label.toLowerCase()}`)
              .join(', ')}
          >
            <span data-numeric="" className="text-[13px] font-semibold text-ink">
              {row.failed}
            </span>
            <span className="flex items-center gap-1.5">
              {SEVERITY_ORDER.filter((key) => row.failedBySeverity[key]).map((key) => (
                <span key={key} className="inline-flex items-center gap-0.5 text-[11px] text-ink-3" data-numeric="">
                  <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: TONE_VAR[severityMeta(key).tone] }} />
                  {row.failedBySeverity[key]}
                  <span className="sr-only"> {severityMeta(key).label.toLowerCase()}</span>
                </span>
              ))}
            </span>
          </span>
        ),
    },
    {
      key: 'credential',
      header: 'Credential',
      width: '12%',
      priority: 'wide',
      cell: (row) =>
        row.credential ? (
          <span className="block min-w-0">
            <span className="block truncate text-[12.5px] text-ink-2">{row.credential.label}</span>
            <span className="block truncate text-[11px] text-ink-3">
              {row.credential.ageDays !== null && row.credential.ageDays !== undefined ? `${formatNumber(row.credential.ageDays)} days old` : ''}
            </span>
          </span>
        ) : (
          <span className="text-[12.5px] text-ink-3">None</span>
        ),
    },
    {
      key: 'trend',
      header: '30 days',
      width: '9%',
      sortable: true,
      cell: (row) => <Delta value={row.trend} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Posture"
        lede="Every identity scored against the same checks in six pillars. A failed check costs points by severity; fixing it earns them back."
        actions={
          <>
            <SegmentedControl
              label="Trend window"
              options={WINDOWS}
              value={window}
              onChange={(value) => setParam('window', value === '30' ? '' : value)}
            />
            <Button variant="secondary" icon={Download} onClick={onExport} disabled={rows.length === 0}>
              Export
            </Button>
          </>
        }
      />

      {query.isError && !data ? (
        <Panel>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Panel>
      ) : loading ? (
        <OverviewSkeleton />
      ) : (
        <>
          <div className="grid gap-4 @min-[64rem]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <FleetScore data={data} window={window} />
            <Distribution data={data} band={band} flag={flag} onBand={(value) => setParam('band', band === value ? '' : value)} onFlag={(value) => setParam('flag', flag === value ? '' : value)} />
            <QuickWins data={data} active={check} onPick={(value) => setParam('check', check === value ? '' : value)} />
          </div>

          <div className="grid gap-4 @min-[64rem]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Panel prominence="quiet" className="animate-rise">
              <PanelHeader prominence="quiet" title="Posture by pillar" subtitle="Mean pillar score across every identity." />
              <div className="mt-4">
                <PillarBars
                  pillars={data.pillars}
                  detail={(entry) => `${formatNumber(entry.failing)} of ${formatNumber(entry.evaluated)} evaluated failing`}
                />
              </div>
            </Panel>
            <WeakestIdentities rows={allRows} />
            <Breakdowns data={data} window={window} onCategory={(value) => setParam('category', value)} onAccount={(value) => setParam('account', value)} />
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
            mobileTitle="Filter identities"
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
                  placeholder="Search identity, ARN or account..."
                  size="sm"
                  className="w-full sm:w-64"
                />
                {!railOpen && <ShowFiltersButton onClick={toggleRail} appliedCount={chips.length} />}
                <RefreshButton onRefresh={query.refetch} refreshing={query.isRefreshing} label="Refresh posture" />
              </TableToolbar>
            }
          >
            <ResultCount
              shown={formatNumber(rows.length)}
              total={formatNumber(allRows.length)}
              unit="identities"
              filtered={chips.length > 0}
              loading={loading}
            />
            <span className="hidden text-[11.5px] text-ink-3 xl:inline">Lowest score first. Open a row to see why and fix it.</span>
          </RecordBar>

          <AppliedFilters filters={chips} onRemove={(key) => setParam(key, '')} onClearAll={clearAll} />

          {check && data && rows.length > 0 && (
            <BulkFix check={check} title={checkTitle} rows={rows} gain={data.checkGains?.[check]} total={allRows.length} />
          )}

          {query.isError && !data ? null : (
            <DataGrid
              caption="Identity posture"
              columns={columns}
              rows={pageRows}
              rowKey={(row) => row.id}
              loading={loading}
              refreshing={query.isRefreshing}
              onRowClick={(row) => navigate(`/identities/${encodeURIComponent(row.id)}?tab=posture`)}
              sort={{ key: sortKey, direction: sortDirection }}
              onSortChange={(next) =>
                setParams({ sort: next.key === 'score' ? '' : next.key, dir: next.direction === 'desc' ? 'desc' : '' })
              }
              rowActions={(row) => (
                <IconButton
                  as={Link}
                  to={`/identities/${encodeURIComponent(row.id)}?tab=posture`}
                  icon={ArrowRight}
                  size="sm"
                  label={`Investigate ${row.name}`}
                />
              )}
              emptyState={
                <EmptyState
                  icon={SearchX}
                  title="No identity matches those filters"
                  description="Every scored identity is outside the current selection."
                  action={
                    <Button variant="secondary" size="sm" onClick={clearAll}>
                      Clear filters
                    </Button>
                  }
                />
              }
            />
          )}

          {!loading && rows.length > pageSize && (
            <Pagination
              page={safePage}
              pageSize={pageSize}
              total={rows.length}
              unit="identities"
              onPageChange={(next) => setParams({ page: next > 1 ? String(next) : '' })}
              onPageSizeChange={(next) => setParam('size', next === 25 ? '' : String(next))}
            />
          )}
        </Panel>
      </WorkArea>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-4 @min-[64rem]:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((index) => (
        <Panel key={index} prominence="quiet">
          <Skeleton className="h-4 w-32 rounded" />
          <div className="mt-4">{index === 0 ? <ChartSkeleton height={150} /> : <ListSkeleton rows={4} />}</div>
        </Panel>
      ))}
      <span role="status" className="sr-only">
        Scoring identities
      </span>
    </div>
  );
}

function FleetScore({ data, window }) {
  const { fleet } = data;
  const lowest = Math.min(...data.trend.map((point) => point.score));
  const trend = data.trend.map((point) => ({
    ...point,
    label: new Date(point.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
  }));
  return (
    <Panel prominence="lead" className="animate-rise">
      <PanelHeader prominence="lead" title="Fleet posture score" subtitle={`The mean score of ${formatNumber(fleet.identities)} identities.`} />
      <div className="mt-4 flex flex-wrap items-center gap-5">
        <ScoreRing score={fleet.score} size={112} grade={fleet.grade} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <BandTag score={fleet.score} size="md" />
            <Tag tone="neutral" size="md">
              Grade {fleet.grade}
            </Tag>
          </div>
          <p className="mt-2 flex flex-wrap items-baseline gap-1.5 text-[12.5px] text-ink-2">
            <Delta value={fleet.delta} />
            <span>
              vs {window} days ago ({fleet.previous})
            </span>
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
            Grades follow the bands: A and B are Healthy, C Fair, D Poor, F Critical.
          </p>
        </div>
      </div>
      <TrendChart
        className="mt-4"
        data={trend}
        dataKey="score"
        label="Fleet score"
        height={176}
        color={TONE_VAR[bandMeta(fleet.band).tone]}
        yDomain={[Math.max(0, Math.floor((lowest - 5) / 5) * 5), 100]}
      />
    </Panel>
  );
}

function Distribution({ data, band, flag, onBand, onFlag }) {
  const total = data.fleet.identities;
  return (
    <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 1 }}>
      <PanelHeader prominence="quiet" title="Posture distribution" subtitle="How many identities sit in each band." />
      <div className="mt-4 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-track" role="img" aria-label={data.distribution.map((entry) => `${entry.label}: ${entry.count}`).join(', ')}>
        {data.distribution.map((entry) =>
          entry.count > 0 ? (
            <span key={entry.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(entry.count / total) * 100}%`, background: TONE_VAR[entry.tone] }} />
          ) : null,
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {data.distribution.map((entry) => (
          <li key={entry.key}>
            <button
              type="button"
              onClick={() => onBand(entry.key)}
              aria-pressed={band === entry.key}
              className={cn(
                'flex w-full items-center gap-2 rounded-[var(--radius-control)] border px-2.5 py-2 text-left transition-colors',
                band === entry.key ? 'border-brand bg-info-soft' : 'border-line hover:bg-surface-2',
              )}
            >
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: TONE_VAR[entry.tone] }} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{entry.label}</span>
              <span data-numeric="" className="text-[13px] font-semibold text-ink">
                {formatNumber(entry.count)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Identities with</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {data.flags.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => onFlag(entry.key)}
            aria-pressed={flag === entry.key}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors',
              flag === entry.key ? 'border-brand bg-info-soft text-brand' : 'border-line text-ink-2 hover:bg-surface-2',
            )}
          >
            {entry.label}
            <span data-numeric="" className="font-semibold text-ink">
              {formatNumber(entry.count)}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function QuickWins({ data, active, onPick }) {
  return (
    <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 2 }}>
      <PanelHeader
        prominence="quiet"
        icon={Sparkles}
        title="Quick wins"
        subtitle="One check fixed everywhere it fails, and what it adds to the fleet score."
      />
      {data.quickWins.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-ink-3">Every check passes on every identity.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {data.quickWins.map((win) => (
            <li key={win.key}>
              <button
                type="button"
                onClick={() => onPick(win.key)}
                aria-pressed={active === win.key}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors',
                  active === win.key ? 'border-brand bg-info-soft' : 'border-line hover:bg-surface-2',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-ink">{win.title}</span>
                  <span className="block truncate text-[11px] text-ink-3">
                    {PILLARS[win.pillar].label} · {formatNumber(win.identities)} {win.identities === 1 ? 'identity' : 'identities'}
                  </span>
                </span>
                <span data-numeric="" className="shrink-0 text-[13px] font-bold text-low">
                  +{win.fleetGain}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">Choose one to list the identities it applies to.</p>
    </Panel>
  );
}

function WeakestIdentities({ rows }) {
  const weakest = [...rows].sort((a, b) => a.score - b.score || b.failed - a.failed).slice(0, 5);
  return (
    <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 1 }}>
      <PanelHeader prominence="quiet" icon={ShieldCheck} title="Weakest identities" subtitle="The lowest scores in the estate." />
      <ul className="mt-3 divide-y divide-line">
        {weakest.map((row) => (
          <li key={row.id}>
            <Link to={`/identities/${encodeURIComponent(row.id)}?tab=posture`} className="flex items-center gap-3 py-2 transition-colors hover:text-brand">
              <ScoreRing score={row.score} size={36} grade={row.grade} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[12.5px] font-semibold text-ink">{row.name}</span>
                <span className="block truncate text-[11px] text-ink-3">
                  {row.category} · {row.account} · {row.failed} failed
                </span>
              </span>
              <BandTag score={row.score} />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Breakdowns({ data, window, onCategory, onAccount }) {
  return (
    <Panel prominence="quiet" className="animate-rise" data-stagger="" style={{ '--stagger': 2 }}>
      <PanelHeader prominence="quiet" title="By category and account" subtitle={`Mean score, and its change over ${window} days.`} />
      <BreakdownList title="Category" items={data.byCategory} onPick={onCategory} />
      <BreakdownList title="Account" items={data.byAccount} onPick={onAccount} />
    </Panel>
  );
}

function BreakdownList({ title, items, onPick }) {
  return (
    <div className="mt-4">
      <p className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">{title}</p>
      <ul className="mt-1.5 flex flex-col">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onPick(item.key)}
              className="grid w-full grid-cols-[minmax(0,1fr)_3rem_3.25rem] items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-surface-2"
            >
              <span className="truncate text-[12.5px] text-ink-2">
                {item.key} <span className="text-ink-3">({formatNumber(item.identities)})</span>
              </span>
              <span className="flex items-center justify-end gap-1.5">
                <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: TONE_VAR[bandFor(item.score).tone] }} />
                <span data-numeric="" className="text-[12.5px] font-semibold text-ink">
                  {item.score}
                </span>
              </span>
              <span className="text-right">
                <Delta value={item.delta} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One check fixed on every identity the list shows - a quick win applied in
 * one go. Shown only while the list is narrowed to a single check, so what it
 * will act on is exactly the rows on screen. Recording an owner is left out:
 * each identity needs its own.
 */
function BulkFix({ check, title, rows, gain, total }) {
  const { can } = useAccess();
  const { notify } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!can('posture.remediate')) return null;
  const perIdentity = check === 'no-owner';
  /* The fleet gain is for fixing it everywhere; a narrower list earns its share. */
  const share = gain && gain.identities ? Math.round(((gain.fleetGain * rows.length) / gain.identities) * 10) / 10 : null;

  const apply = async () => {
    setBusy(true);
    try {
      const result = await remediatePostureMany({ checkKey: check, identityIds: rows.map((row) => row.id) });
      notify({
        variant: 'success',
        title: `Fixed on ${formatNumber(result.count)} identities`,
        description: `${title}.${result.resolvedAlerts ? ` ${result.resolvedAlerts} open ${result.resolvedAlerts === 1 ? 'alert' : 'alerts'} resolved.` : ''}`,
      });
      setConfirming(false);
    } catch (failure) {
      notify({ variant: 'error', title: 'Not applied', description: failure?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-info-soft/60 px-4 py-2.5">
      <Wrench aria-hidden="true" className="size-4 shrink-0 text-brand" />
      <p className="min-w-0 flex-1 text-[12.5px] text-ink-2">
        {perIdentity
          ? 'Owners are recorded one identity at a time - each needs its own person. Open a row to record one.'
          : `${formatNumber(rows.length)} ${rows.length === 1 ? 'identity fails' : 'identities fail'} "${title}".${share !== null ? ` Fixing ${rows.length === 1 ? 'it' : 'them all'} adds ${share} to the fleet score.` : ''}`}
      </p>
      {!perIdentity && (
        <Button variant="primary" size="sm" icon={Wrench} onClick={() => setConfirming(true)}>
          Fix {rows.length === 1 ? '1 identity' : `all ${formatNumber(rows.length)}`}
        </Button>
      )}
      <Modal
        open={confirming}
        onClose={() => (busy ? null : setConfirming(false))}
        title={`Fix ${formatNumber(rows.length)} ${rows.length === 1 ? 'identity' : 'identities'}?`}
        description={`Applies "${title}" to every identity in this list${rows.length < total ? ' - the filtered rows, not the whole estate' : ''}. Each one gets the same remediation it would get on its own, including resolving its matching alerts, and each can be rolled back from its Posture tab.`}
        icon={Wrench}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" icon={Wrench} loading={busy} onClick={apply}>
              {busy ? 'Applying…' : `Apply to ${formatNumber(rows.length)}`}
            </Button>
          </>
        }
      >
        <ul className="max-h-48 overflow-y-auto rounded-[var(--radius-control)] border border-line text-[12px]">
          {rows.slice(0, 50).map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5 last:border-b-0">
              <span className="truncate font-mono text-ink">{row.name}</span>
              <span className="shrink-0 text-ink-3">{row.account}</span>
            </li>
          ))}
          {rows.length > 50 && <li className="px-3 py-1.5 text-ink-3">and {formatNumber(rows.length - 50)} more</li>}
        </ul>
      </Modal>
    </div>
  );
}
