import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  FileWarning,
  GitCommitHorizontal,
  List,
  SearchX,
  ShieldOff,
} from 'lucide-react';
import { dismissFinding, fetchFindings } from '../../lib/api/endpoints';
import { useMutation, useQuery } from '../../lib/hooks';
import {
  findingLink,
  platformMeta,
  recommendedActionMeta,
  severityMeta,
  SEVERITY_ORDER,
  toAllowlistPayload,
} from '../../lib/domain';
import {
  formatNumber,
  formatRelative,
  humanizeToken,
  parseAuthor,
  percentValue,
  shortBranch,
  shortCommit,
} from '../../lib/format';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Panel } from '../../ui/Panel';
import { SearchInput } from '../../ui/Field';
import { AppliedFilters, FacetRail, useFacetRail } from '../../ui/FacetRail';
import { RecordBar, ResultCount, ShowFiltersButton, WorkArea } from '../../ui/WorkArea';
import { SegmentedControl, Tabs } from '../../ui/Tabs';
import { OverflowMenu, RefreshButton, TableSettings, TableToolbar } from '../../ui/TableTools';
import { CellStack, DataGrid } from '../../ui/DataGrid';
import { Menu } from '../../ui/Menu';
import { Tag } from '../../ui/Tag';
import { MetricTile } from '../../ui/Stat';
import { useToast } from '../../ui/Toast';
import { ClearState, EmptyState, ErrorState } from '../../ui/States';
import { cn, TONE_FG } from '../../ui/cn';
import { GridSkeleton, StatStripSkeleton } from '../../ui/Skeleton';
import { FindingDrawer } from './FindingDrawer';
import { describeScannerError, groupByPush, summariseFindings } from './scannerState';

const VIEWS = [
  { value: 'findings', label: 'Findings', icon: List },
  { value: 'pushes', label: 'By push', icon: GitCommitHorizontal },
];

/**
 * Code exposure triage.
 *
 * `GET /api/findings` returns the whole live set in one response, so search,
 * filtering, sorting and grouping all happen client-side here - that is the
 * shape the service defines, not a workaround. The only write is adding a
 * finding to the allowlist.
 */
export default function FindingsPage() {
  const { notify } = useToast();
  const query = useQuery((signal) => fetchFindings(signal), []);
  const dismissal = useMutation((input) => dismissFinding(input));

  const [platform, setPlatform] = useState('all');
  const [tier, setTier] = useState('');
  const [detector, setDetector] = useState('');
  const [repository, setRepository] = useState('');
  const [search, setSearch] = useState('');
  const { railOpen, toggleRail } = useFacetRail();
  const [density, setDensity] = useState('comfortable');
  const [view, setView] = useState('findings');
  const [sort, setSort] = useState({ key: 'detected', direction: 'desc' });
  const [selected, setSelected] = useState(null);
  /* Locally dismissed ids, so a row leaves the list the moment the write
     succeeds rather than after a full refetch. */
  const [dismissed, setDismissed] = useState(() => new Set());

  const allFindings = useMemo(
    () => (query.data?.findings ?? []).filter((finding) => !dismissed.has(finding.finding_id)),
    [query.data, dismissed],
  );

  const summary = useMemo(() => summariseFindings(allFindings), [allFindings]);

  const platformFiltered = useMemo(() => {
    if (platform === 'all') return allFindings;
    /* A finding recorded before platform tracking existed reports null and is
       always CodeCommit, so the CodeCommit filter is "not GitHub". */
    if (platform === 'github')
      return allFindings.filter((finding) => String(finding.platform).toLowerCase() === 'github');
    return allFindings.filter((finding) => String(finding.platform).toLowerCase() !== 'github');
  }, [allFindings, platform]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return platformFiltered.filter((finding) => {
      if (tier && String(finding.risk_tier).toUpperCase() !== tier) return false;
      if (detector && finding.detector !== detector) return false;
      if (repository && finding.repository !== repository) return false;
      if (!needle) return true;
      return [finding.repository, finding.file_path, finding.author, finding.detector, finding.branch]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [platformFiltered, tier, detector, repository, search]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const factor = sort.direction === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (sort.key === 'risk') {
        const delta = severityMeta(a.risk_tier).weight - severityMeta(b.risk_tier).weight;
        if (delta !== 0) return delta * factor;
        return (new Date(b.created_at) - new Date(a.created_at)) * -1;
      }
      if (sort.key === 'repository') {
        return String(a.repository || '').localeCompare(String(b.repository || '')) * factor;
      }
      return (new Date(a.created_at) - new Date(b.created_at)) * factor;
    });
    return rows;
  }, [filtered, sort]);

  const pushes = useMemo(() => {
    const groups = groupByPush(sorted);
    return groups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [sorted]);

  /* Every facet count is computed from the live set the service returned, so
     the numbers and the rows can never disagree. */
  const repositoryOptions = useMemo(() => {
    const counts = new Map();
    for (const finding of platformFiltered) {
      if (!finding.repository) continue;
      counts.set(finding.repository, (counts.get(finding.repository) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ value: key, label: key, count, active: repository === key }));
  }, [platformFiltered, repository]);

  const facetGroups = useMemo(
    () => [
      {
        key: 'tier',
        label: 'Risk tier',
        options: SEVERITY_ORDER.filter((value) => (summary.byTier[value] || 0) > 0).map((value) => ({
          value,
          label: severityMeta(value).label,
          count: summary.byTier[value],
          active: tier === value,
        })),
        onToggle: (value) => setTier((current) => (current === value ? '' : value)),
        note: 'Critical cannot occur on this deployment - liveness verification is unavailable, so the scanner never raises that tier.',
      },
      {
        key: 'detector',
        label: 'Detector',
        options: summary.detectors.map((entry) => ({
          value: entry.key,
          label: humanizeToken(entry.key),
          count: entry.value,
          active: detector === entry.key,
        })),
        onToggle: (value) => setDetector((current) => (current === value ? '' : value)),
      },
      {
        key: 'repository',
        label: 'Repository',
        options: repositoryOptions,
        onToggle: (value) => setRepository((current) => (current === value ? '' : value)),
      },
    ],
    [summary, tier, detector, repositoryOptions],
  );

  const chips = useMemo(() => {
    const list = [];
    if (search.trim()) list.push({ key: 'search', label: 'Search', value: search.trim() });
    if (tier) list.push({ key: 'tier', label: 'Risk', value: severityMeta(tier).label });
    if (detector) list.push({ key: 'detector', label: 'Detector', value: humanizeToken(detector) });
    if (repository) list.push({ key: 'repository', label: 'Repo', value: repository });
    return list;
  }, [search, tier, detector, repository]);

  const removeChip = (key) => {
    if (key === 'search') setSearch('');
    if (key === 'tier') setTier('');
    if (key === 'detector') setDetector('');
    if (key === 'repository') setRepository('');
  };

  const clearAll = () => {
    setSearch('');
    setTier('');
    setDetector('');
    setRepository('');
  };

  const onExport = () => {
    exportRowsToCsv({
      filename: timestampedName('code-exposure-findings'),
      columns: [
        { header: 'Detector', value: (row) => row.detector },
        { header: 'Risk tier', value: (row) => row.risk_tier },
        { header: 'Recommended action', value: (row) => row.recommended_action },
        { header: 'Platform', value: (row) => row.platform || 'codecommit' },
        { header: 'Repository', value: (row) => row.repository },
        { header: 'Branch', value: (row) => row.branch },
        { header: 'Commit', value: (row) => row.commit_id },
        { header: 'File', value: (row) => row.file_path },
        { header: 'Line', value: (row) => row.line_number },
        { header: 'Masked value', value: (row) => row.redacted },
        { header: 'Author', value: (row) => row.author },
        { header: 'Detected (UTC)', value: (row) => row.created_at },
        { header: 'Link', value: (row) => row.codecommit_uri || row.github_uri || '' },
      ],
      rows: sorted,
    });
    notify({
      variant: 'success',
      title: 'Exported current view',
      description: `${formatNumber(sorted.length)} findings written to CSV, with masked values only.`,
    });
  };

  const onDismiss = useCallback(
    async (finding, reason) => {
      const result = await dismissal.mutate(toAllowlistPayload(finding, reason));
      if (!result.ok) {
        notify({
          variant: 'error',
          title: 'Could not mark as safe',
          description: result.error?.message || 'The scanner rejected the request.',
        });
        return;
      }
      setDismissed((current) => new Set(current).add(finding.finding_id));
      setSelected(null);
      notify({
        variant: 'success',
        title: 'Added to allowlist',
        description: `${finding.file_path} will no longer appear in findings. Restore it from the Dismissed view.`,
      });
    },
    [dismissal, notify],
  );

  if (query.isError && !query.data) {
    const detail = describeScannerError(query.error);
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Secret findings"
          lede="Credentials committed to connected repositories."
        />
        <Panel>
          <ErrorState error={{ message: detail.message }} title={detail.title} onRetry={query.refetch} />
          {detail.configuration && (
            <div className="mx-auto mt-2 max-w-md rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5 text-[12px] leading-relaxed text-ink-3">
              The dashboard key is attached server-side on purpose: putting it in browser code would
              hand every visitor permanent read access to every finding.
            </div>
          )}
        </Panel>
      </div>
    );
  }

  const loading = query.isLoading && !query.data;
  const highish = (summary.byTier.CRITICAL || 0) + (summary.byTier.HIGH || 0);

  const columns = [
    {
      key: 'finding',
      header: 'Secret',
      primary: true,
      width: '28%',
      cell: (row) => (
        <CellStack
          icon={FileWarning}
          title={humanizeToken(row.detector)}
          meta={`${row.file_path}:${row.line_number ?? '?'}`}
          mono
        />
      ),
    },
    {
      key: 'risk',
      header: 'Risk',
      width: '10%',
      sortable: true,
      cell: (row) => {
        const meta = severityMeta(row.risk_tier);
        return (
          <Tag tone={meta.tone} size="sm" dot>
            {meta.label}
          </Tag>
        );
      },
    },
    {
      key: 'repository',
      header: 'Repository',
      width: '20%',
      sortable: true,
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block truncate text-[12.5px] text-ink-2" title={row.repository}>
            {row.repository || '-'}
          </span>
          <span className="block truncate font-mono text-[11px] text-ink-3">
            {shortBranch(row.branch)} · {shortCommit(row.commit_id)}
          </span>
        </span>
      ),
    },
    {
      key: 'author',
      header: 'Author',
      width: '16%',
      priority: 'wide',
      cell: (row) => {
        const author = parseAuthor(row.author);
        return (
          <span className="block min-w-0">
            <span className="block truncate text-[12.5px] text-ink-2">{author.name}</span>
            {author.email && (
              <span className="block truncate text-[11px] text-ink-3">{author.email}</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'action',
      header: 'Recommended',
      width: '13%',
      priority: 'wide',
      cell: (row) => {
        const meta = recommendedActionMeta(row.recommended_action);
        return (
          <span className={cn('text-[12px] font-medium', TONE_FG[meta.tone])}>{meta.label}</span>
        );
      },
    },
    {
      key: 'detected',
      header: 'Detected',
      width: '13%',
      sortable: true,
      cell: (row) => <span className="text-[12.5px] text-ink-2">{formatRelative(row.created_at)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Secret findings"
        lede="Credentials committed into connected CodeCommit and GitHub repositories. Values are masked by the scanner - triage by risk, then rotate at the source."
        tabs={
          <Tabs
            size="sm"
            value={platform}
            onChange={setPlatform}
            tabs={[
              { value: 'all', label: 'All platforms', count: summary.total },
              { value: 'github', label: 'GitHub', count: summary.byPlatform.github },
              { value: 'codecommit', label: 'CodeCommit', count: summary.byPlatform.codecommit },
            ]}
          />
        }
        actions={
          <>
            <Button as={Link} to="/exposure/dismissed" variant="ghost" icon={ShieldOff}>
              Dismissed
            </Button>
          </>
        }
      />

      {loading ? (
        <StatStripSkeleton count={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Live findings"
            value={summary.total}
            icon={FileWarning}
            tone={summary.total > 0 ? 'high' : 'low'}
            caption="Excludes anything already allowlisted"
          />
          <MetricTile
            label="High or critical"
            value={highish}
            tone={highish > 0 ? 'critical' : 'low'}
            caption="Actionable risk tier, not detector severity"
            meter={percentValue(highish, summary.total)}
            meterLabel="Share of live findings"
          />
          <MetricTile
            label="Repositories affected"
            value={summary.repositoryCount}
            tone="info"
            caption="Distinct repositories across both platforms"
          />
          <MetricTile
            label="Detector types"
            value={summary.detectors.length}
            tone="medium"
            caption={
              summary.detectors[0]
                ? `Most common: ${humanizeToken(summary.detectors[0].key)}`
                : 'No detections'
            }
          />
        </div>
      )}

      <WorkArea
        railOpen={railOpen}
        rail={
          <FacetRail
            groups={facetGroups}
            appliedCount={chips.length}
            onClearAll={clearAll}
            onClose={toggleRail}
            mobileTitle="Filter findings"
          />
        }
      >
      <Panel flush className="animate-rise overflow-hidden">
        <RecordBar
          trailing={
            <TableToolbar>
              {/* View mode stays in the open: it changes which records are
                  listed, which is not a display preference. */}
              <SegmentedControl label="View mode" options={VIEWS} value={view} onChange={setView} />
              {!railOpen && (
                <ShowFiltersButton onClick={toggleRail} appliedCount={chips.length} />
              )}
              <RefreshButton onRefresh={query.refetch} refreshing={query.isRefreshing} />
              <TableSettings density={density} onDensityChange={setDensity} />
              <OverflowMenu
                items={[
                  {
                    key: 'export',
                    label: 'Export this view',
                    hint: `CSV of all ${sorted.length} matching findings`,
                    onSelect: onExport,
                    disabled: sorted.length === 0,
                    disabledHint: 'Nothing to export - no findings match',
                  },
                ]}
              />
            </TableToolbar>
          }
        >
          <SearchInput
            size="sm"
            value={search}
            onChange={setSearch}
            placeholder="Search repository, file, branch, detector or author…"
            className="w-full min-w-0 sm:max-w-sm"
          />
          <ResultCount
            shown={formatNumber(sorted.length)}
            total={formatNumber(summary.total)}
            unit="findings"
            filtered={chips.length > 0 || platform !== 'all'}
            loading={loading}
          />
        </RecordBar>

        <AppliedFilters filters={chips} onRemove={removeChip} onClearAll={clearAll} />

        {loading ? (
          <GridSkeleton columns={5} rows={10} />
        ) : view === 'findings' ? (
          <DataGrid
            caption="Secret findings"
            columns={columns}
            rows={sorted}
            rowKey={(row) => row.finding_id}
            refreshing={query.isRefreshing}
            onRowClick={setSelected}
            density={density}
            sort={sort}
            onSortChange={setSort}
            rowActions={(row) => {
              const link = findingLink(row);
              return (
                <Menu
                  label={`Actions for ${row.file_path}`}
                  items={[
                    link && {
                      key: 'open',
                      label: link.label,
                      icon: ExternalLink,
                      onSelect: () => window.open(link.href, '_blank', 'noopener,noreferrer'),
                    },
                    {
                      key: 'inspect',
                      label: 'Inspect finding',
                      icon: FileWarning,
                      onSelect: () => setSelected(row),
                    },
                  ]}
                />
              );
            }}
            emptyState={
              chips.length > 0 || platform !== 'all' ? (
                <EmptyState
                  icon={SearchX}
                  title="No findings match this view"
                  description="Nothing in the live set matches the current platform, risk tier and search combination."
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        clearAll();
                        setPlatform('all');
                      }}
                    >
                      Reset view
                    </Button>
                  }
                />
              ) : (
                <ClearState
                  title="No secrets exposed in code"
                  description="The scanner found nothing outstanding across the connected repositories. Anything previously reviewed lives in the Dismissed view."
                  action={
                    <Button as={Link} to="/exposure/dismissed" variant="secondary" size="sm">
                      View dismissed
                    </Button>
                  }
                />
              )
            }
          />
        ) : (
          <PushList pushes={pushes} onSelect={setSelected} />
        )}
      </Panel>
      </WorkArea>

      <FindingDrawer
        finding={selected}
        onClose={() => setSelected(null)}
        onDismiss={onDismiss}
        dismissing={dismissal.pending}
      />
    </div>
  );
}

/**
 * Grouped view: one push can introduce several secrets at once, and the guide
 * recommends grouping by (repository, commit) so the blast radius of a single
 * commit reads as one item.
 */
function PushList({ pushes, onSelect }) {
  if (pushes.length === 0) {
    return (
      <EmptyState
        compact
        icon={GitCommitHorizontal}
        title="No pushes to group"
        description="No findings match the current filters, so there is nothing to group by commit."
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {pushes.map((push) => {
        const author = parseAuthor(push.author);
        const worst = push.findings.reduce((acc, finding) => {
          const meta = severityMeta(finding.risk_tier);
          return meta.weight > acc.weight ? meta : acc;
        }, severityMeta(null));
        const platform = platformMeta(push.platform);

        return (
          <li key={push.key} className="px-4 py-3.5">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <GitCommitHorizontal aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
                  <p className="min-w-0 truncate text-[13px] font-semibold text-ink" title={push.repository}>
                    {push.repository || '-'}
                  </p>
                  <span className="shrink-0 font-mono text-[11.5px] text-ink-3">
                    {shortCommit(push.commitId)}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11.5px] text-ink-3">
                  {shortBranch(push.branch)} · {author.name} · {formatRelative(push.createdAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Tag tone={platform.tone} size="sm">
                  {platform.label}
                </Tag>
                <Tag tone={worst.tone} size="sm" dot>
                  {worst.label}
                </Tag>
                <span
                  data-numeric=""
                  className="rounded-full bg-surface-3 px-2 py-0.5 text-[11.5px] font-semibold text-ink-2"
                >
                  {formatNumber(push.findings.length)} secrets
                </span>
              </div>
            </div>

            <ul className="mt-2.5 flex flex-col gap-1">
              {push.findings.map((finding) => {
                const meta = severityMeta(finding.risk_tier);
                return (
                  <li key={finding.finding_id}>
                    <button
                      type="button"
                      onClick={() => onSelect(finding)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: `var(--t-${meta.tone})` }}
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2">
                        {finding.file_path}:{finding.line_number ?? '?'}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-ink-3">
                        {humanizeToken(finding.detector)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
