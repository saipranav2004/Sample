import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  CalendarPlus,
  Download,
  FileText,
  Inbox,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  SearchX,
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
  saveSchedule,
  setScheduleEnabled,
} from '../../lib/demo/reports';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { formatDateTime, formatNumber, formatRelative } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button, IconButton } from '../../ui/Button';
import { DataGrid } from '../../ui/DataGrid';
import { Modal } from '../../ui/Overlay';
import { Panel, PanelHeader } from '../../ui/Panel';
import { StatStripSkeleton } from '../../ui/Skeleton';
import { MetricTile } from '../../ui/Stat';
import { EmptyState, ErrorState } from '../../ui/States';
import { SearchInput } from '../../ui/Field';
import { Tabs } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { OverflowMenu, RefreshButton, TableToolbar } from '../../ui/TableTools';
import { useToast } from '../../ui/Toast';
import { RecordBar, ResultCount } from '../../ui/WorkArea';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
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

/* Named per tab, because "Search" alone leaves the operator guessing which of
   the three lists they are about to narrow. */
/* Named per tab, because "Search" alone leaves the operator guessing which of
   the three lists they are about to narrow. Kept short enough to render inside
   a 16rem field - a placeholder clipped mid-word tells them less than a vague
   one would. */
const SEARCH_PLACEHOLDERS = {
  library: 'Search report types...',
  scheduled: 'Search schedules...',
  history: 'Search produced reports...',
};

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { notify } = useToast();

  const tab = TABS.some((entry) => entry.value === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'library';

  const search = searchParams.get('q') || '';
  const setSearch = useCallback(
    (value) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set('q', value);
      else next.delete('q');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

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
    /* The state setters are listed even though React guarantees they are
       stable: the compiler infers them as dependencies, and a dependency list
       that disagrees with the inferred one makes it skip optimising the whole
       component. */
    [notify, setTab, setScheduleOpen, setEditing, setScheduleFor],
  );

  /* One search box filters the tab you are looking at. Three separate boxes
     would be three states to keep straight for one question, and a schedule
     and a run are searched by the same words anyway: the report's name. */
  const needle = search.trim().toLowerCase();
  const matches = useCallback(
    (fields) =>
      !needle ||
      fields.filter(Boolean).some((field) => String(field).toLowerCase().includes(needle)),
    [needle],
  );

  const templates = useMemo(
    () =>
      (library.data?.templates ?? []).filter((template) =>
        matches([template.name, template.purpose, template.audience, ...template.sections.map((section) => section.title)]),
      ),
    [library.data, matches],
  );

  const scheduleRows = useMemo(
    () =>
      (schedules.data?.rows ?? []).filter((row) =>
        matches([row.templateName, row.format, row.cadence, ...(row.recipients ?? [])]),
      ),
    [schedules.data, matches],
  );

  const runRows = useMemo(
    () =>
      (runs.data?.rows ?? []).filter((row) =>
        matches([row.templateName, row.format, row.status, row.requestedBy, row.error]),
      ),
    [runs.data, matches],
  );

  const exportable =
    (tab === 'library' && templates.length > 0) ||
    (tab === 'scheduled' && scheduleRows.length > 0) ||
    (tab === 'history' && runRows.length > 0);

  /* Exports the tab in front of you, filtered the way it is filtered. A single
     Export that always wrote the catalogue would be a different answer to the
     one the operator is looking at. */
  const onExport = useCallback(() => {
    if (tab === 'scheduled') {
      exportRowsToCsv({
        filename: timestampedName('report-schedules'),
        columns: [
          { header: 'Report', value: (row) => row.templateName },
          { header: 'Cadence', value: (row) => CADENCES[row.cadence]?.label ?? row.cadence },
          { header: 'Hour (UTC)', value: (row) => String(row.hour).padStart(2, '0') },
          { header: 'Format', value: (row) => REPORT_FORMATS[row.format]?.label ?? row.format },
          { header: 'Recipients', value: (row) => (row.recipients ?? []).join('; ') },
          { header: 'State', value: (row) => (row.enabled ? 'Active' : 'Paused') },
          { header: 'Next run (UTC)', value: (row) => row.nextRunAt ?? '' },
          { header: 'Last run (UTC)', value: (row) => row.lastRunAt ?? '' },
        ],
        rows: scheduleRows,
      });
      notify({
        title: 'Schedules exported',
        description: `${formatNumber(scheduleRows.length)} schedule${scheduleRows.length === 1 ? '' : 's'} written.`,
        variant: 'success',
      });
      return;
    }

    if (tab === 'history') {
      exportRowsToCsv({
        filename: timestampedName('report-history'),
        columns: [
          { header: 'Report', value: (row) => row.templateName },
          { header: 'Outcome', value: (row) => RUN_STATUSES[row.status]?.label ?? row.status },
          { header: 'Format', value: (row) => REPORT_FORMATS[row.format]?.label ?? row.format },
          { header: 'Requested by', value: (row) => row.requestedBy },
          { header: 'Trigger', value: (row) => row.trigger },
          { header: 'Rows', value: (row) => row.rows ?? '' },
          { header: 'Size (KB)', value: (row) => row.sizeKb ?? '' },
          { header: 'Duration (ms)', value: (row) => row.durationMs ?? '' },
          { header: 'Started (UTC)', value: (row) => row.startedAt },
          { header: 'Failure reason', value: (row) => row.error ?? '' },
        ],
        rows: runRows,
      });
      notify({
        title: 'History exported',
        description: `${formatNumber(runRows.length)} run${runRows.length === 1 ? '' : 's'} written, including failures.`,
        variant: 'success',
      });
      return;
    }

    exportRowsToCsv({
      filename: timestampedName('report-catalogue'),
      columns: [
        { header: 'Report', value: (row) => row.name },
        { header: 'Purpose', value: (row) => row.purpose },
        { header: 'Audience', value: (row) => row.audience },
        { header: 'Formats', value: (row) => row.formats.map((key) => REPORT_FORMATS[key]?.label ?? key).join('; ') },
        { header: 'Sections', value: (row) => row.sections.map((section) => section.title).join('; ') },
        { header: 'On a schedule', value: (row) => (row.scheduled ? 'Yes' : 'No') },
        { header: 'Last produced (UTC)', value: (row) => row.lastGeneratedAt ?? '' },
      ],
      rows: templates,
    });
    notify({
      title: 'Catalogue exported',
      description: `${formatNumber(templates.length)} report type${templates.length === 1 ? '' : 's'} written.`,
      variant: 'success',
    });
  }, [tab, templates, scheduleRows, runRows, notify]);

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
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={SEARCH_PLACEHOLDERS[tab]}
              size="sm"
              className="w-full sm:w-64"
            />
            <Button variant="secondary" icon={Download} onClick={onExport} disabled={!exportable}>
              Export
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
          templates={templates}
          search={search}
          onClearSearch={() => setSearch('')}
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
          rows={scheduleRows}
          search={search}
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
          rows={runRows}
          search={search}
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

function LibraryTab({ query, templates, search, onClearSearch, onGenerate, onSchedule }) {
  if (query.isError && !query.data) {
    return <ErrorState error={query.error} onRetry={query.refetch} />;
  }

  if (search.trim() && templates.length === 0) {
    return (
      <Panel prominence="lead" className="animate-rise">
        <EmptyState
          icon={SearchX}
          title="No report type matches that search"
          description={`Nothing in the catalogue mentions "${search.trim()}". The search covers a report's name, purpose, audience and section titles.`}
          action={
            <Button variant="secondary" size="sm" onClick={onClearSearch}>
              Clear search
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 @min-[34rem]:grid-cols-2 @min-[64rem]:grid-cols-3">
      {templates.map((template, index) => (
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
            {/* Status belongs with the other facts, not in the action row: a
                pill down there wraps to a second line on the cards that have
                one, which knocks their Generate button out of line with the
                rest of the row. */}
            {template.scheduled && (
              <Tag tone="low" size="sm" dot>
                On a schedule
              </Tag>
            )}
          </dl>

          <ul className="mt-3 mb-4 flex flex-col gap-1">
            {template.sections.map((section) => (
              <li key={section.key} className="flex items-baseline gap-2 text-[11.5px] text-ink-3">
                <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-3/60" />
                {section.title}
              </li>
            ))}
          </ul>

          {/* mt-auto: the action row sits on the card floor, so Generate lands
              on one line across a row of cards whose descriptions and section
              lists are different lengths. The schedule pill rides in the same
              row rather than below it, for the same reason - and because it is
              status, not an action. */}
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
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

function ScheduledTab({ query, rows, search, onCreate, onEdit, onToggle, onDelete }) {

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
          filtered={Boolean(search.trim())}
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
            /* Two different nothings: nothing matched the search, or nothing
               has been scheduled at all. The second is the first thing an
               operator sees on this tab, so it points at the control. */
            search.trim() ? (
              <EmptyState
                icon={SearchX}
                title="No schedule matches that search"
                description={`Nothing scheduled mentions "${search.trim()}". Clear the search to see every schedule.`}
              />
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="Nothing is scheduled yet"
                description="A scheduled report keeps producing without anyone asking, which is the point of scheduling one. Create a schedule and it appears here, with its cadence, recipients and next run."
                action={
                  <Button variant="primary" size="sm" icon={CalendarPlus} onClick={onCreate}>
                    Schedule a report
                  </Button>
                }
              />
            )
          }
        />
      )}
    </Panel>
  );
}

/* ── History ──────────────────────────────────────────────────────────────── */

function HistoryTab({ query, rows, search, onRegenerate, onDelete }) {
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
          filtered={Boolean(search.trim())}
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
              /* A failed run opens too. Its reason is truncated in the table
                 and the run page states it in full, so withholding the link
                 would leave the one row that needs explaining as the only one
                 that cannot be read. */
              cell: (row) =>
                row.status === 'ready' || row.status === 'failed' ? (
                  <Link
                    to={`/reports/${row.id}`}
                    className="text-[12px] font-medium text-brand hover:underline"
                  >
                    {row.status === 'failed' ? 'Why' : 'Open'}
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
            search.trim() ? (
              <EmptyState
                icon={SearchX}
                title="No produced report matches that search"
                description={`No run mentions "${search.trim()}". Clear the search to see the full history.`}
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title="No report has been produced yet"
                description="Generate one from the Library. Every run lands here with its outcome, including the ones that fail."
              />
            )
          }
        />
      )}
    </Panel>
  );
}
