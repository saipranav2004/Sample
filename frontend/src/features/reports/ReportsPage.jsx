import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  CalendarPlus,
  FileText,
  Inbox,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  CADENCES,
  REPORT_FORMATS,
  RUN_STATUSES,
  deleteRun,
  deleteSchedule,
  fetchReportLibrary,
  fetchRuns,
  fetchSchedules,
  generateReport,
  resetReportState,
  saveSchedule,
  setScheduleEnabled,
} from '../../lib/demo/reports';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { formatDateTime, formatNumber, formatRelative } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button, IconButton } from '../../ui/Button';
import { DataGrid } from '../../ui/DataGrid';
import { DemoBadge } from '../../ui/DemoBadge';
import { Modal } from '../../ui/Overlay';
import { Panel, PanelHeader } from '../../ui/Panel';
import { StatStripSkeleton } from '../../ui/Skeleton';
import { MetricTile } from '../../ui/Stat';
import { EmptyState, ErrorState } from '../../ui/States';
import { Tabs } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { OverflowMenu, RefreshButton, TableToolbar } from '../../ui/TableTools';
import { useToast } from '../../ui/Toast';
import { RecordBar, ResultCount } from '../../ui/WorkArea';
import { ScheduleDialog } from './ScheduleDialog';

/**
 * Reports.
 *
 * Three surfaces, separated because they answer different questions: what can
 * be produced (Library), what is produced without asking (Scheduled), and what
 * was actually produced (History).
 *
 * History is the one that matters operationally and is usually the one left
 * out: a report that failed silently is worse than one never scheduled, so a
 * failed run is a first-class row with its reason attached.
 *
 * Generating is asynchronous on purpose - a run appears queued, becomes
 * running, then ready - because those are the states this screen has to render
 * once a real backend produces the file.
 */
const TABS = [
  { value: 'library', label: 'Library' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'history', label: 'History' },
];

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { notify } = useToast();

  const tab = TABS.some((entry) => entry.value === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'library';

  const [scheduleFor, setScheduleFor] = useState(null);
  const [editing, setEditing] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const library = useDemoQuery((signal) => fetchReportLibrary(signal), []);
  const schedules = useDemoQuery((signal) => fetchSchedules(signal), []);
  const runs = useDemoQuery((signal) => fetchRuns({}, signal), []);

  const setTab = useCallback(
    (value) => {
      const next = new URLSearchParams(searchParams);
      if (value === 'library') next.delete('tab');
      else next.set('tab', value);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const totals = library.data?.totals;

  const onGenerate = useCallback(
    (template, format) => {
      generateReport({ templateId: template.id, format: format ?? template.formats[0] });
      notify({
        title: `${template.name} queued`,
        description: 'Follow it in History. It becomes readable once the run finishes.',
        variant: 'info',
      });
      setTab('history');
    },
    [notify, setTab],
  );

  const onSaveSchedule = useCallback(
    (schedule) => {
      const existing = Boolean(schedule.id);
      saveSchedule(schedule);
      setScheduleOpen(false);
      setEditing(null);
      setScheduleFor(null);
      notify({
        title: existing ? 'Schedule updated' : 'Schedule created',
        description: `${CADENCES[schedule.cadence].label}, to ${schedule.recipients.length} recipient${schedule.recipients.length === 1 ? '' : 's'}.`,
        variant: 'success',
      });
      if (!existing) setTab('scheduled');
    },
    [notify, setTab],
  );

  const tabsWithCounts = useMemo(
    () => [
      { ...TABS[0], count: library.data?.templates.length },
      { ...TABS[1], count: schedules.data?.total || undefined },
      { ...TABS[2], count: runs.data?.total || undefined },
    ],
    [library.data, schedules.data, runs.data],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        lede="A scheduled report is produced whether or not anyone is watching, so every run is recorded with its outcome."
        actions={
          <>
            <DemoBadge detail="The catalogue is real; the runs and schedules are generated. What you create here is stored in this browser and survives a reload." />
            <Button
              variant="secondary"
              icon={RotateCcw}
              onClick={() => {
                resetReportState();
                notify({ title: 'Demo reports reset', description: 'Schedules and history are back to their seeded state.', variant: 'info' });
              }}
            >
              Reset demo
            </Button>
            <Button
              variant="primary"
              icon={CalendarPlus}
              onClick={() => {
                setEditing(null);
                setScheduleFor(null);
                setScheduleOpen(true);
              }}
            >
              Schedule a report
            </Button>
          </>
        }
        tabs={<Tabs size="sm" tabs={tabsWithCounts} value={tab} onChange={setTab} />}
      />

      {library.isError && !library.data ? (
        <ErrorState error={library.error} onRetry={library.refetch} />
      ) : library.isLoading && !library.data ? (
        <StatStripSkeleton count={4} />
      ) : (
        <div className="grid gap-3 @min-[30rem]:grid-cols-2 @min-[54rem]:grid-cols-4">
          <MetricTile label="Report types" value={totals.templates} tone="info" caption="Available in the catalogue" className="animate-rise" />
          <MetricTile
            label="Produced, last 30 days"
            value={totals.generated30d}
            tone="brand"
            caption="Manual and scheduled runs"
            className="animate-rise"
            data-stagger=""
            style={{ '--stagger': 1 }}
          />
          <MetricTile
            label="Active schedules"
            value={totals.schedules}
            tone="medium"
            caption="Producing without being asked"
            className="animate-rise"
            data-stagger=""
            style={{ '--stagger': 2 }}
          />
          <MetricTile
            label="Failed runs"
            value={totals.failed30d}
            tone={totals.failed30d > 0 ? 'critical' : 'low'}
            caption={totals.failed30d > 0 ? 'A silent failure is worse than no report' : 'Every run in the window succeeded'}
            className="animate-rise"
            data-stagger=""
            style={{ '--stagger': 3 }}
          />
        </div>
      )}

      {tab === 'library' && (
        <LibraryTab
          query={library}
          onGenerate={onGenerate}
          onSchedule={(template) => {
            setEditing(null);
            setScheduleFor(template.id);
            setScheduleOpen(true);
          }}
        />
      )}

      {tab === 'scheduled' && (
        <ScheduledTab
          query={schedules}
          onCreate={() => {
            setEditing(null);
            setScheduleFor(null);
            setScheduleOpen(true);
          }}
          onEdit={(schedule) => {
            setScheduleFor(null);
            setEditing(schedule);
            setScheduleOpen(true);
          }}
          onToggle={(schedule) => {
            setScheduleEnabled(schedule.id, !schedule.enabled);
            notify({
              title: schedule.enabled ? 'Schedule paused' : 'Schedule resumed',
              description: `${schedule.templateName} will ${schedule.enabled ? 'not run' : 'run'} on its cadence.`,
              variant: 'info',
            });
          }}
          onDelete={(schedule) =>
            setConfirm({
              kind: 'schedule',
              title: `Delete the ${schedule.templateName} schedule?`,
              description: `${CADENCES[schedule.cadence].label} delivery to ${schedule.recipients.join(', ')} stops. Reports already produced are kept.`,
              confirmLabel: 'Delete schedule',
              run: () => {
                deleteSchedule(schedule.id);
                notify({ title: 'Schedule deleted', description: `${schedule.templateName} no longer runs on a cadence.`, variant: 'info' });
              },
            })
          }
        />
      )}

      {tab === 'history' && (
        <HistoryTab
          query={runs}
          onRegenerate={(run) => {
            generateReport({ templateId: run.templateId, format: run.format });
            notify({ title: `${run.templateName} queued again`, description: 'The new run appears at the top of History.', variant: 'info' });
          }}
          onDelete={(run) =>
            setConfirm({
              kind: 'run',
              title: `Delete this ${run.templateName} run?`,
              description: 'The record of the run is removed. Deleting a failed run also removes the reason it failed.',
              confirmLabel: 'Delete run',
              run: () => {
                deleteRun(run.id);
                notify({ title: 'Run deleted', variant: 'info' });
              },
            })
          }
        />
      )}

      <ScheduleDialog
        open={scheduleOpen}
        initial={editing}
        presetTemplateId={scheduleFor}
        onClose={() => {
          setScheduleOpen(false);
          setEditing(null);
          setScheduleFor(null);
        }}
        onSave={onSaveSchedule}
      />

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        description={confirm?.description}
        icon={Trash2}
        tone="critical"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                confirm.run();
                setConfirm(null);
              }}
            >
              {confirm?.confirmLabel}
            </Button>
          </>
        }
      />
    </div>
  );
}

/* ── Library ──────────────────────────────────────────────────────────────── */

function LibraryTab({ query, onGenerate, onSchedule }) {
  if (query.isError && !query.data) {
    return <ErrorState error={query.error} onRetry={query.refetch} />;
  }

  return (
    <div className="grid gap-4 @min-[34rem]:grid-cols-2 @min-[64rem]:grid-cols-3">
      {(query.data?.templates ?? []).map((template, index) => (
        <Panel
          key={template.id}
          prominence="default"
          className="animate-rise flex flex-col"
          data-stagger=""
          style={{ '--stagger': index % 3 }}
        >
          <PanelHeader
            title={template.name}
            actions={
              <OverflowMenu
                label={`More actions for ${template.name}`}
                items={[
                  {
                    key: 'schedule',
                    label: 'Schedule this report',
                    hint: template.scheduled ? 'Already on a schedule' : `Suggested: ${CADENCES[template.cadenceHint].label.toLowerCase()}`,
                    icon: CalendarClock,
                    onSelect: () => onSchedule(template),
                  },
                  ...template.formats.map((format) => ({
                    key: `gen-${format}`,
                    label: `Generate as ${REPORT_FORMATS[format].label}`,
                    hint: REPORT_FORMATS[format].hint,
                    icon: FileText,
                    onSelect: () => onGenerate(template, format),
                  })),
                ]}
              />
            }
          />

          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{template.purpose}</p>

          <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px]">
            <div className="flex items-center gap-1.5">
              <dt className="text-ink-3">For</dt>
              <dd className="font-medium text-ink-2">{template.audience}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-ink-3">Formats</dt>
              <dd className="font-medium text-ink-2">
                {template.formats.map((format) => REPORT_FORMATS[format].label).join(', ')}
              </dd>
            </div>
          </dl>

          <ul className="mt-3 flex flex-col gap-1">
            {template.sections.map((section) => (
              <li key={section.key} className="flex items-baseline gap-2 text-[11.5px] text-ink-3">
                <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-3/60" />
                {section.title}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <Button variant="primary" size="sm" icon={Play} onClick={() => onGenerate(template)}>
              Generate
            </Button>
            <Button variant="ghost" size="sm" icon={CalendarClock} onClick={() => onSchedule(template)}>
              Schedule
            </Button>
            <span className="ml-auto text-[11px] text-ink-3">
              {template.lastGeneratedAt ? `Last ${formatRelative(template.lastGeneratedAt)}` : 'Never generated'}
            </span>
          </div>

          {template.scheduled && (
            <p className="mt-2">
              <Tag tone="low" size="sm" dot>
                On a schedule
              </Tag>
            </p>
          )}
        </Panel>
      ))}

      {query.isLoading && !query.data && (
        <>
          {Array.from({ length: 6 }).map((_, index) => (
            <Panel key={index} prominence="default">
              <div className="skeleton h-4 w-40 rounded" />
              <div className="skeleton mt-3 h-3 w-full rounded" />
              <div className="skeleton mt-2 h-3 w-3/4 rounded" />
              <div className="skeleton mt-5 h-8 w-28 rounded" />
            </Panel>
          ))}
        </>
      )}
    </div>
  );
}

/* ── Scheduled ────────────────────────────────────────────────────────────── */

function ScheduledTab({ query, onCreate, onEdit, onToggle, onDelete }) {
  const rows = query.data?.rows ?? [];

  return (
    <Panel prominence="lead" flush className="animate-rise overflow-hidden">
      <RecordBar
        trailing={
          <TableToolbar>
            <RefreshButton onRefresh={query.refetch} refreshing={query.isRefreshing} label="Refresh schedules" />
          </TableToolbar>
        }
      >
        <ResultCount
          shown={formatNumber(rows.length)}
          total={formatNumber(query.data?.total ?? 0)}
          unit="schedules"
          loading={query.isLoading && !query.data}
        />
      </RecordBar>

      {query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : (
        <DataGrid
          caption="Scheduled reports"
          columns={[
            {
              key: 'report',
              header: 'Report',
              primary: true,
              width: '26%',
              cell: (row) => (
                <span className="block min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">{row.templateName}</span>
                  <span className="block truncate text-[11.5px] text-ink-3">
                    {REPORT_FORMATS[row.format]?.label ?? row.format}
                  </span>
                </span>
              ),
            },
            {
              key: 'cadence',
              header: 'Cadence',
              width: '16%',
              cell: (row) => (
                <span className="block min-w-0">
                  <span className="block text-[12.5px] text-ink-2">{CADENCES[row.cadence].label}</span>
                  <span className="block text-[11px] text-ink-3">
                    {String(row.hour).padStart(2, '0')}:00 UTC
                  </span>
                </span>
              ),
            },
            {
              key: 'recipients',
              header: 'Recipients',
              width: '24%',
              priority: 'wide',
              cell: (row) => (
                <span className="block min-w-0 truncate text-[12px] text-ink-2" title={row.recipients.join(', ')}>
                  {row.recipients.join(', ')}
                </span>
              ),
            },
            {
              key: 'next',
              header: 'Next run',
              width: '16%',
              cell: (row) =>
                row.nextRunAt ? (
                  <span className="whitespace-nowrap text-[12.5px] text-ink-2" title={formatDateTime(row.nextRunAt)}>
                    {formatRelative(row.nextRunAt)}
                  </span>
                ) : (
                  <span className="text-[12px] text-ink-3">Paused</span>
                ),
            },
            {
              key: 'state',
              header: 'State',
              width: '10%',
              cell: (row) => (
                <Tag tone={row.enabled ? 'low' : 'neutral'} size="sm" dot>
                  {row.enabled ? 'Active' : 'Paused'}
                </Tag>
              ),
            },
          ]}
          rows={rows}
          rowKey={(row) => row.id}
          loading={query.isLoading && !query.data}
          refreshing={query.isRefreshing}
          density="comfortable"
          rowActions={(row) => (
            <>
              <IconButton
                icon={row.enabled ? Pause : Play}
                label={row.enabled ? `Pause ${row.templateName}` : `Resume ${row.templateName}`}
                size="sm"
                onClick={() => onToggle(row)}
              />
              <IconButton icon={Pencil} label={`Edit ${row.templateName} schedule`} size="sm" onClick={() => onEdit(row)} />
              <IconButton icon={Trash2} label={`Delete ${row.templateName} schedule`} size="sm" onClick={() => onDelete(row)} />
            </>
          )}
          emptyState={
            <EmptyState
              icon={CalendarClock}
              title="Nothing is scheduled"
              description="A scheduled report keeps producing without anyone asking, which is the point. Nothing is scheduled yet."
              action={
                <Button variant="primary" size="sm" icon={CalendarPlus} onClick={onCreate}>
                  Schedule a report
                </Button>
              }
            />
          }
        />
      )}
    </Panel>
  );
}

/* ── History ──────────────────────────────────────────────────────────────── */

function HistoryTab({ query, onRegenerate, onDelete }) {
  const rows = query.data?.rows ?? [];
  const running = rows.filter((row) => row.status === 'queued' || row.status === 'running').length;

  return (
    <Panel prominence="lead" flush className="animate-rise overflow-hidden">
      <RecordBar
        trailing={
          <TableToolbar>
            <RefreshButton onRefresh={query.refetch} refreshing={query.isRefreshing} label="Refresh run history" />
          </TableToolbar>
        }
      >
        <ResultCount
          shown={formatNumber(rows.length)}
          total={formatNumber(query.data?.total ?? 0)}
          unit="runs"
          loading={query.isLoading && !query.data}
        />
        {running > 0 && (
          <span className="text-[11.5px] text-medium">
            {running} in progress
          </span>
        )}
      </RecordBar>

      {query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : (
        <DataGrid
          caption="Report run history"
          columns={[
            {
              key: 'report',
              header: 'Report',
              primary: true,
              width: '26%',
              cell: (row) => (
                <span className="block min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">{row.templateName}</span>
                  <span className="block truncate text-[11.5px] text-ink-3">
                    {REPORT_FORMATS[row.format]?.label ?? row.format} ·{' '}
                    {row.trigger === 'schedule' ? 'Scheduled' : `Requested by ${row.requestedBy}`}
                  </span>
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Outcome',
              width: '18%',
              cell: (row) => (
                <span className="block min-w-0">
                  <Tag tone={RUN_STATUSES[row.status].tone} size="sm" dot>
                    {RUN_STATUSES[row.status].label}
                  </Tag>
                  {row.error && (
                    <span className="mt-1 block truncate text-[11px] text-critical" title={row.error}>
                      {row.error}
                    </span>
                  )}
                </span>
              ),
            },
            {
              key: 'size',
              header: 'Contents',
              width: '16%',
              priority: 'wide',
              cell: (row) =>
                row.rows ? (
                  <span className="block min-w-0">
                    <span data-numeric="" className="block text-[12.5px] text-ink-2">
                      {formatNumber(row.rows)} rows
                    </span>
                    <span data-numeric="" className="block text-[11px] text-ink-3">
                      {formatNumber(row.sizeKb)} KB
                    </span>
                  </span>
                ) : (
                  <span className="text-[12px] text-ink-3">-</span>
                ),
            },
            {
              key: 'duration',
              header: 'Took',
              width: '11%',
              priority: 'wide',
              cell: (row) =>
                row.durationMs ? (
                  <span data-numeric="" className="text-[12.5px] text-ink-2">
                    {(row.durationMs / 1000).toFixed(1)}s
                  </span>
                ) : (
                  <span className="text-[12px] text-ink-3">-</span>
                ),
            },
            {
              key: 'started',
              header: 'Started',
              width: '15%',
              cell: (row) => (
                <span className="whitespace-nowrap text-[12.5px] text-ink-2" title={formatDateTime(row.startedAt)}>
                  {formatRelative(row.startedAt)}
                </span>
              ),
            },
            {
              key: 'open',
              header: '',
              width: '10%',
              cell: (row) =>
                row.status === 'ready' ? (
                  <Link
                    to={`/reports/${row.id}`}
                    className="text-[12px] font-medium text-brand hover:underline"
                  >
                    Open
                  </Link>
                ) : null,
            },
          ]}
          rows={rows}
          rowKey={(row) => row.id}
          loading={query.isLoading && !query.data}
          refreshing={query.isRefreshing}
          density="comfortable"
          rowActions={(row) => (
            <>
              <IconButton icon={RotateCcw} label={`Generate ${row.templateName} again`} size="sm" onClick={() => onRegenerate(row)} />
              <IconButton icon={Trash2} label={`Delete this ${row.templateName} run`} size="sm" onClick={() => onDelete(row)} />
            </>
          )}
          emptyState={
            <EmptyState
              icon={Inbox}
              title="No report has been produced yet"
              description="Generate one from the Library. Every run lands here with its outcome, including the ones that fail."
            />
          }
        />
      )}
    </Panel>
  );
}
