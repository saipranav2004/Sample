import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, RotateCcw } from 'lucide-react';
import { REPORT_FORMATS, RUN_STATUSES, fetchRun, generateReport } from '../../lib/demo/reports';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
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
  const run = query.data;

  const onExport = useCallback(() => {
    if (!run) return;
    /* Flattened from what is on screen: one row per metric, with its section,
       so the file and the page can never disagree. */
    const rows = run.preview.sections.flatMap((section) =>
      section.metrics.map((metric) => ({
        section: section.title,
        measure: metric.label,
        value: metric.value,
        change: metric.delta,
      })),
    );
    exportRowsToCsv({
      filename: timestampedName(`${run.templateId}-report`),
      columns: [
        { header: 'Section', value: (row) => row.section },
        { header: 'Measure', value: (row) => row.measure },
        { header: 'Value', value: (row) => row.value },
        { header: 'Change', value: (row) => row.change },
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

              <dl className="mt-3 grid gap-3 @min-[26rem]:grid-cols-2 @min-[46rem]:grid-cols-4">
                {section.metrics.map((metric) => (
                  <div
                    key={metric.key}
                    className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3"
                  >
                    <dt className="truncate text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase" title={metric.label}>
                      {metric.label}
                    </dt>
                    <dd className="mt-1 flex items-baseline gap-2">
                      <span data-numeric="" className="font-display text-[22px] leading-none font-extrabold text-ink">
                        {formatNumber(metric.value)}
                      </span>
                      <span
                        data-numeric=""
                        className={`text-[11.5px] font-semibold ${metric.delta > 0 ? 'text-ink-2' : 'text-ink-3'}`}
                        title="Change against the previous report"
                      >
                        {metric.delta > 0 ? '+' : ''}
                        {metric.delta}
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
