import { useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, RotateCcw } from 'lucide-react';
import { REPORT_FORMATS, RUN_STATUSES, fetchRun, generateReport } from '../../lib/demo/reports';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { fetchAllowlist, fetchFindings } from '../../lib/api/endpoints';
import { useQuery } from '../../lib/hooks';
import { describeScannerError, summariseFindings } from '../exposure/scannerState';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { formatDateTime, formatNumber, formatRelative } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Panel, PanelHeader, SectionLabel } from '../../ui/Panel';
import { DetailSkeleton } from '../../ui/Skeleton';
import { ErrorState } from '../../ui/States';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';

/**
 * A produced report, readable in the product.
 *
 * A reporting feature whose only output is a file download is a black box: you
 * cannot tell whether the numbers are right without opening something else. So
 * a run renders here, section by section, and the download is generated from
 * the same rows the page is showing - not from a second source that could
 * disagree with it.
 *
 * The CSV is built with the same `lib/csv` helper the record screens use, so
 * the export is real even though the figures are demonstration data.
 */
export default function ReportViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const query = useDemoQuery((signal) => fetchRun(id, signal), [id]);
  const baseRun = query.data;

  /* Exposure sections are read from the scanner when the report is opened -
     the only source those figures have - and only for reports that have them. */
  const needsScanner = Boolean(baseRun?.preview.sections.some((section) => section.live === 'exposure'));
  const scanner = useQuery(
    async (signal) => {
      const [findings, allowlist] = await Promise.all([fetchFindings(signal), fetchAllowlist(signal)]);
      return { findings: findings.findings, allowlist };
    },
    [needsScanner],
    { enabled: needsScanner },
  );

  const run = useMemo(() => {
    if (!baseRun) return baseRun;
    const scannerError = scanner.isError && !scanner.data ? describeScannerError(scanner.error) : null;
    return {
      ...baseRun,
      preview: {
        ...baseRun.preview,
        sections: baseRun.preview.sections.map((section) => {
          if (section.live !== 'exposure') return section;
          if (scannerError) return { ...section, metrics: [], unavailable: scannerError.title };
          if (!scanner.data) return { ...section, metrics: [], loading: true };
          return { ...section, metrics: exposureMeasures(section.key, scanner.data) };
        }),
      },
    };
  }, [baseRun, scanner.data, scanner.isError, scanner.error]);

  const onExport = useCallback(() => {
    if (!run) return;
    /* Flattened from what is on screen: one row per metric, with its section,
       so the file and the page can never disagree. */
    const rows = run.preview.sections.flatMap((section) =>
      section.metrics.map((metric) => ({
        section: section.title,
        measure: metric.label,
        value: metric.value,
      })),
    );
    exportRowsToCsv({
      filename: timestampedName(`${run.templateId}-report`),
      columns: [
        { header: 'Section', value: (row) => row.section },
        { header: 'Measure', value: (row) => row.measure },
        { header: 'Value', value: (row) => row.value },
      ],
      rows,
    });
    notify({
      title: 'Report exported',
      description: `${rows.length} rows written from what is on screen.`,
      variant: 'success',
    });
  }, [run, notify]);

  if (query.isError && !run) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Report"
          actions={
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/reports?tab=history')}>
              Back to history
            </Button>
          }
        />
        <ErrorState error={query.error} onRetry={query.refetch} />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Report" />
        <Panel prominence="lead">
          <DetailSkeleton rows={8} />
        </Panel>
      </div>
    );
  }

  const status = RUN_STATUSES[run.status];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={run.templateName}
        lede={run.template?.purpose}
        actions={
          <>
            <Button variant="secondary" as={Link} to="/reports?tab=history" icon={ArrowLeft}>
              History
            </Button>
            <Button
              variant="secondary"
              icon={RotateCcw}
              onClick={() => {
                generateReport({ templateId: run.templateId, format: run.format });
                notify({ title: 'Queued again', description: 'The new run appears at the top of History.', variant: 'info' });
                navigate('/reports?tab=history');
              }}
            >
              Run again
            </Button>
            <Button variant="primary" icon={Download} onClick={onExport} disabled={run.status !== 'ready'}>
              Export CSV
            </Button>
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={status.tone} size="sm" dot>
              {status.label}
            </Tag>
            <Tag tone="neutral" size="sm">
              {REPORT_FORMATS[run.format]?.label ?? run.format}
            </Tag>
            <span className="text-[11.5px] text-ink-3">
              {run.trigger === 'schedule' ? 'Produced on a schedule' : `Requested by ${run.requestedBy}`} ·{' '}
              {formatRelative(run.startedAt)}
            </span>
          </div>
        }
      />

      {run.status === 'failed' ? (
        <Panel prominence="lead" className="animate-rise border-critical/30">
          <PanelHeader prominence="lead" title="This run failed" />
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{run.error}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
            The reason is kept with the run rather than discarded, because a report that failed
            silently is worse than one that was never scheduled.
          </p>
        </Panel>
      ) : (
        <>
          <Panel prominence="quiet" className="animate-rise">
            <PanelHeader prominence="quiet" title="What this run covers" />
            <dl className="mt-3 grid gap-x-6 gap-y-3 @min-[30rem]:grid-cols-2 @min-[54rem]:grid-cols-4">
              <Fact label="Audience" value={run.preview.audience} />
              <Fact label="Accounts" value={formatNumber(run.preview.coverage.accounts)} />
              <Fact label="Identities" value={formatNumber(run.preview.coverage.identities)} />
              <Fact label="Window" value={run.preview.coverage.window} />
              <Fact label="Generated" value={formatDateTime(run.preview.generatedAt)} />
              <Fact label="Rows" value={run.rows ? formatNumber(run.rows) : '-'} />
              <Fact label="Size" value={run.sizeKb ? `${formatNumber(run.sizeKb)} KB` : '-'} />
              <Fact label="Took" value={run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '-'} />
            </dl>
          </Panel>

          {run.preview.sections.map((section, index) => (
            <Panel
              key={section.key}
              prominence={index === 0 ? 'lead' : 'default'}
              className="animate-rise"
              data-stagger=""
              style={{ '--stagger': Math.min(index, 3) }}
            >
              <PanelHeader
                prominence={index === 0 ? 'lead' : 'default'}
                title={section.title}
                actions={
                  <span className="text-[11px] text-ink-3">
                    Section {index + 1} of {run.preview.sections.length}
                  </span>
                }
              />

              {section.loading && <p className="mt-3 text-[12.5px] text-ink-3">Reading the Secret Scanner…</p>}
              {section.unavailable && (
                <p className="mt-3 rounded-[var(--radius-control)] border border-medium/40 bg-medium-soft px-3 py-2 text-[12.5px] text-ink-2">
                  {section.unavailable}. This section is read from the scanner when the report is opened, so it is
                  empty until the scanner answers.
                </p>
              )}
              <dl className="mt-3 grid gap-3 @min-[26rem]:grid-cols-2 @min-[46rem]:grid-cols-4">
                {section.metrics.map((metric) => (
                  <div
                    key={metric.key}
                    className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3"
                  >
                    {/* Wraps rather than truncating: the measures are sentences
                        ("Administrators unused 90+ days"), and a clipped one
                        changes what the number means. */}
                    <dt className="text-[11px] leading-snug font-semibold tracking-[0.06em] text-ink-3 uppercase">
                      {metric.label}
                    </dt>
                    <dd className="mt-1.5">
                      <span data-numeric="" className="font-display text-[22px] leading-none font-extrabold text-ink">
                        {formatNumber(metric.value)}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>

              {section.note && (
                <>
                  <SectionLabel className="mt-4">How to read this</SectionLabel>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">{section.note}</p>
                </>
              )}
            </Panel>
          ))}
        </>
      )}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">{label}</dt>
      <dd data-numeric="" className="mt-0.5 truncate text-[13px] font-semibold text-ink" title={String(value)}>
        {value}
      </dd>
    </div>
  );
}

/**
 * The exposure sections, from the scanner's own findings and allowlist - the
 * same figures the Exposed credentials and Accepted screens show.
 */
function exposureMeasures(key, { findings, allowlist }) {
  const summary = summariseFindings(findings);
  switch (key) {
    case 'by-platform':
      return [
        { key: 'github', label: 'GitHub', value: summary.byPlatform.github },
        { key: 'codecommit', label: 'CodeCommit', value: summary.byPlatform.codecommit },
        { key: 'repos', label: 'Repositories affected', value: summary.repositoryCount },
      ];
    case 'by-tier':
      return [
        { key: 'high', label: 'High', value: summary.byTier.HIGH + summary.byTier.CRITICAL },
        { key: 'medium', label: 'Medium', value: summary.byTier.MEDIUM },
        { key: 'low', label: 'Low', value: summary.byTier.LOW },
      ];
    case 'review':
      return [
        { key: 'open', label: 'Still open', value: summary.total },
        { key: 'accepted', label: 'Accepted', value: allowlist.length },
        {
          key: 'reason',
          label: 'Accepted with a reason',
          value: allowlist.filter((entry) => String(entry.reason ?? '').trim()).length,
        },
      ];
    case 'detail':
      return [
        { key: 'total', label: 'Exposed credentials', value: summary.total },
        { key: 'repos', label: 'Repositories', value: summary.repositoryCount },
        { key: 'detectors', label: 'Detector types', value: summary.detectors.length },
      ];
    default:
      return [];
  }
}
