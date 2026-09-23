import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpCircle,
  BellRing,
  CheckCircle2,
  Hand,
  Info,
  SearchX,
  XCircle,
} from 'lucide-react';
import { dismissFinding, fetchAlerts, fetchFindings, restoreFinding, updateAlerts } from '../../lib/api/endpoints';
import { useAuth } from '../../app/AuthContext';
import { useQuery } from '../../lib/hooks';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import {
  ALERT_SOURCES,
  ALERT_SOURCE_ORDER,
  ALERT_STATUS_ORDER,
  DISMISS_REASONS,
  ESCALATION_LEVELS,
  RESPONSE_STATES,
  RESPONSE_STATE_ORDER,
  RESPONSE_TARGETS,
  alertStatusMeta,
  dismissReasonMeta,
  isOpen,
  responseState,
} from '../../lib/alerts';
import { SEVERITY_ORDER, severityMeta, toAllowlistPayload } from '../../lib/domain';
import { formatDateTime, formatNumber, formatRelativeShort } from '../../lib/format';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { PageHeader } from '../../shell/PageHeader';
import { Button, IconButton } from '../../ui/Button';
import { SearchInput, Select, Textarea } from '../../ui/Field';
import { AppliedFilters, FacetRail, useFacetRail } from '../../ui/FacetRail';
import { RecordBar, ResultCount, ShowFiltersButton, WorkArea } from '../../ui/WorkArea';
import { OverflowMenu, RefreshButton, TableSettings, TableToolbar } from '../../ui/TableTools';
import { DataGrid } from '../../ui/DataGrid';
import { Modal } from '../../ui/Overlay';
import { Pagination } from '../../ui/Pagination';
import { Panel } from '../../ui/Panel';
import { StatStripSkeleton } from '../../ui/Skeleton';
import { MetricTile } from '../../ui/Stat';
import { ClearState, EmptyState, ErrorState } from '../../ui/States';
import { Tabs } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { cn } from '../../ui/cn';
import { describeScannerError } from '../exposure/scannerState';
import { AlertDrawer, Avatar } from './AlertDrawer';
import { exposureAlerts } from './exposureAlerts';

const DEFAULT_PAGE_SIZE = 25;
const SEVERITY_WEIGHT = Object.fromEntries(SEVERITY_ORDER.map((key, index) => [key, SEVERITY_ORDER.length - index]));
const URGENCY = { overdue: 4, ack_overdue: 3, due_soon: 2, on_track: 1, closed: 0 };

/**
 * Alerts.
 *
 * ── What this screen is for ─────────────────────────────────────────────────
 * Every other screen raises problems; this is where somebody takes one. It
 * does not duplicate those screens - an alert is a pointer to a fact that
 * lives on its source screen, plus the triage that fact needs: who has it,
 * whether they have picked it up, how far it has escalated, and whether it is
 * late. That is the part no source screen has.
 *
 * ── Views before filters ────────────────────────────────────────────────────
 * The tabs are the questions a responder asks in order: what is open, what
 * has nobody picked up, what is mine, what has been escalated, what is late,
 * what was closed. The rail refines within whichever one is selected, and
 * every choice is in the URL so a filtered queue is a link.
 */
export default function AlertsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { notify } = useToast();
  const { railOpen, toggleRail } = useFacetRail();
  const operatorUser = user?.username ?? null;

  const alertsQuery = useDemoQuery((signal) => fetchAlerts(signal), []);
  const findingsQuery = useQuery((signal) => fetchFindings(signal), []);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [bulkDismiss, setBulkDismiss] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [density, setDensity] = useState('comfortable');
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('q') || '');
  /* Response targets are clocks. Re-rendered every minute so "due in 3m"
     becomes "overdue" without a reload. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const view = VIEWS.some((entry) => entry.value === searchParams.get('view')) ? searchParams.get('view') : 'open';
  const filters = useMemo(
    () => ({
      severity: searchParams.get('severity') || '',
      source: searchParams.get('source') || '',
      status: searchParams.get('status') || '',
      response: searchParams.get('response') || '',
      assignee: searchParams.get('assignee') || '',
    }),
    [searchParams],
  );
  const search = searchParams.get('q') || '';
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('size')) || DEFAULT_PAGE_SIZE;
  const sort = { key: searchParams.get('sort') || 'priority', direction: searchParams.get('dir') || 'desc' };
  const openId = searchParams.get('alert') || '';

  const setParams = useCallback(
    (changes, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, String(value));
        else next.delete(key);
      }
      if (resetPage && !('page' in changes)) next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  /* The search box writes to the URL a beat after typing stops. */
  useEffect(() => {
    if (searchDraft === search) return undefined;
    const timer = setTimeout(() => setParams({ q: searchDraft.trim() }), 300);
    return () => clearTimeout(timer);
  }, [searchDraft, search, setParams]);

  const data = alertsQuery.data;
  const people = useMemo(() => data?.people ?? [], [data]);
  const policy = data?.policy;
  const peopleByUser = useMemo(() => new Map(people.map((person) => [person.user, person])), [people]);

  /* Estate alerts arrive from the API; exposure alerts are raised here from
     the live scanner feed with the same triage store. */
  const all = useMemo(() => {
    if (!data) return [];
    const exposure = exposureAlerts(findingsQuery.data?.findings ?? [], data.triage, data.policy, now);
    return [...data.alerts, ...exposure].map((alert) => ({ ...alert, response: responseState(alert, now) }));
  }, [data, findingsQuery.data, now]);

  const inView = useMemo(() => {
    const test = VIEWS.find((entry) => entry.value === view)?.test ?? (() => true);
    return all.filter((alert) => test(alert, operatorUser));
  }, [all, view, operatorUser]);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    return inView.filter((alert) => {
      if (filters.severity && alert.severity !== filters.severity) return false;
      if (filters.source && alert.source !== filters.source) return false;
      if (filters.status && alert.status !== filters.status) return false;
      if (filters.response && alert.response.state !== filters.response) return false;
      if (filters.assignee) {
        if (filters.assignee === 'none' ? alert.assignee : alert.assignee !== filters.assignee) return false;
      }
      if (!needle) return true;
      return [alert.title, alert.summary, alert.entity?.name, alert.entity?.detail, alert.account, alert.id]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [inView, search, filters]);

  const sorted = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    const rows = [...filtered];
    rows.sort((a, b) => {
      if (sort.key === 'raised') return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * factor;
      if (sort.key === 'due') return (a.response.resolveBy - b.response.resolveBy) * factor;
      /* Priority: severity, then how late, then newest - the order a
         responder would work the queue in without being told. */
      return (
        ((SEVERITY_WEIGHT[a.severity] ?? 0) - (SEVERITY_WEIGHT[b.severity] ?? 0)) * factor ||
        (URGENCY[b.response.state] - URGENCY[a.response.state]) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt)
      );
    });
    return rows;
  }, [filtered, sort.key, sort.direction]);

  /* Clamped: a filter that shrinks the set, or closing the last alert on the
     last page, must not leave the reader on a page past the end. */
  const safePage = Math.min(page, Math.max(1, Math.ceil(sorted.length / pageSize)));
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  /* Selection only ever holds alerts that are still on screen, so a bulk
     action can never reach something the reader cannot see. */
  const visibleIds = useMemo(() => new Set(pageRows.map((alert) => alert.id)), [pageRows]);
  const selected = useMemo(
    () => pageRows.filter((alert) => selectedIds.has(alert.id)),
    [pageRows, selectedIds],
  );
  useEffect(() => {
    setSelectedIds((current) => {
      const kept = [...current].filter((id) => visibleIds.has(id));
      return kept.length === current.size ? current : new Set(kept);
    });
  }, [visibleIds]);

  const openAlert = openId ? all.find((alert) => alert.id === openId) ?? null : null;

  const counts = useMemo(() => {
    const out = {};
    for (const entry of VIEWS) out[entry.value] = all.filter((alert) => entry.test(alert, operatorUser)).length;
    return out;
  }, [all, operatorUser]);

  const openAlerts = useMemo(() => all.filter(isOpen), [all]);
  const bySeverity = useMemo(() => {
    const out = {};
    for (const alert of openAlerts) out[alert.severity] = (out[alert.severity] ?? 0) + 1;
    return out;
  }, [openAlerts]);

  /* ── Actions ────────────────────────────────────────────────────────── */

  const runAction = useCallback(
    async (targets, action, options = {}) => {
      if (targets.length === 0) return false;
      setBusy(true);
      try {
        /* Exposure alerts close by writing the scanner's allowlist - the same
           write as Mark safe on Exposed credentials - and reopen by removing
           the entry. Each write is its own request, so one failure does not
           take the rest down with it, and only the ones that landed are
           recorded as closed. */
        let succeeded = targets;
        let failed = 0;
        const closing = action === 'resolve' || action === 'dismiss';
        const exposure = targets.filter(
          (alert) => alert.source === 'exposure' && alert.finding && (closing ? isOpen(alert) : action === 'reopen' && !isOpen(alert)),
        );
        if (exposure.length > 0) {
          const reasonText =
            action === 'resolve'
              ? `Resolved from Alerts${options.note ? `: ${options.note}` : ' - rotated at the source'}`
              : `${dismissReasonMeta(options.reason)?.label ?? 'Dismissed'} (from Alerts)${options.note ? `: ${options.note}` : ''}`;
          const results = await Promise.allSettled(
            exposure.map((alert) =>
              action === 'reopen'
                ? restoreFinding(toAllowlistPayload(alert.finding))
                : dismissFinding(toAllowlistPayload(alert.finding, reasonText.slice(0, 200))),
            ),
          );
          const rejected = new Set(
            exposure.filter((_, index) => results[index].status === 'rejected').map((alert) => alert.id),
          );
          failed = rejected.size;
          succeeded = targets.filter((alert) => !rejected.has(alert.id));
        }

        const { changed } = await updateAlerts({
          alerts: succeeded,
          action,
          assignee: options.assignee ?? null,
          reason: options.reason ?? null,
          note: options.note ?? '',
        });
        if (exposure.length > 0) findingsQuery.refetch();

        if (failed > 0) {
          notify({
            variant: 'error',
            title: `${failed} exposure alert${failed === 1 ? '' : 's'} could not be closed`,
            description: 'The scanner allowlist write failed for those, so they are still open. The rest went through.',
          });
        } else if (action !== 'comment' && action !== 'assign') {
          notify({
            variant: 'success',
            title: ACTION_DONE[action]?.(changed.length) ?? 'Updated',
            description:
              changed.length < targets.length
                ? `${targets.length - changed.length} were already in that state and were left alone.`
                : undefined,
          });
        } else if (action === 'assign' && changed.length > 0) {
          const name = options.assignee ? peopleByUser.get(options.assignee)?.name ?? options.assignee : null;
          notify({
            variant: 'success',
            title: name ? `Assigned to ${name}` : 'Unassigned',
            description: changed.length > 1 ? `${changed.length} alerts.` : undefined,
          });
        }
        return true;
      } catch (error) {
        notify({ variant: 'error', title: 'That did not go through', description: error?.message });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [findingsQuery, notify, peopleByUser],
  );

  const onBulk = async (action, options) => {
    const ok = await runAction(selected, action, options);
    if (ok) setSelectedIds(new Set());
    return ok;
  };

  const onExport = () => {
    exportRowsToCsv({
      filename: timestampedName(`alerts-${view}`),
      columns: [
        { header: 'Alert id', value: (row) => row.id },
        { header: 'Severity', value: (row) => severityMeta(row.severity).label },
        { header: 'Title', value: (row) => row.title },
        { header: 'Source', value: (row) => ALERT_SOURCES[row.source]?.label ?? row.source },
        { header: 'Entity', value: (row) => row.entity?.name ?? '' },
        { header: 'Status', value: (row) => alertStatusMeta(row.status).label },
        { header: 'Dismiss reason', value: (row) => dismissReasonMeta(row.dismissReason)?.label ?? '' },
        { header: 'Assignee', value: (row) => peopleByUser.get(row.assignee)?.name ?? '' },
        { header: 'Escalation level', value: (row) => row.escalationLevel },
        { header: 'Response', value: (row) => RESPONSE_STATES[row.response.state].label },
        { header: 'Raised', value: (row) => row.createdAt },
        { header: 'Resolve by', value: (row) => new Date(row.response.resolveBy).toISOString() },
        { header: 'What to do', value: (row) => row.recommendation },
      ],
      rows: sorted,
    });
  };

  /* ── Facets ─────────────────────────────────────────────────────────── */

  const facetGroups = useMemo(() => {
    const countOf = (read) => {
      const map = new Map();
      for (const alert of inView) {
        const key = read(alert);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return map;
    };
    const toggle = (param) => (value) => setParams({ [param]: filters[param] === value ? '' : value });
    const severities = countOf((alert) => alert.severity);
    const sources = countOf((alert) => alert.source);
    const statuses = countOf((alert) => alert.status);
    const responses = countOf((alert) => alert.response.state);
    const assignees = countOf((alert) => alert.assignee ?? 'none');

    return [
      {
        key: 'severity',
        label: 'Severity',
        options: SEVERITY_ORDER.filter((key) => severities.has(key)).map((key) => ({
          value: key,
          label: severityMeta(key).label,
          count: severities.get(key),
          active: filters.severity === key,
        })),
        onToggle: toggle('severity'),
      },
      {
        key: 'response',
        label: 'Response target',
        options: RESPONSE_STATE_ORDER.filter((key) => responses.has(key)).map((key) => ({
          value: key,
          label: RESPONSE_STATES[key].label,
          count: responses.get(key),
          active: filters.response === key,
        })),
        onToggle: toggle('response'),
      },
      {
        key: 'source',
        label: 'Raised by',
        options: ALERT_SOURCE_ORDER.filter((key) => sources.has(key)).map((key) => ({
          value: key,
          label: ALERT_SOURCES[key].label,
          count: sources.get(key),
          active: filters.source === key,
        })),
        onToggle: toggle('source'),
      },
      {
        key: 'status',
        label: 'Status',
        options: ALERT_STATUS_ORDER.filter((key) => statuses.has(key)).map((key) => ({
          value: key,
          label: alertStatusMeta(key).label,
          count: statuses.get(key),
          active: filters.status === key,
        })),
        onToggle: toggle('status'),
      },
      {
        key: 'assignee',
        label: 'Assigned to',
        options: [
          ...(assignees.has('none')
            ? [{ value: 'none', label: 'Unassigned', count: assignees.get('none'), active: filters.assignee === 'none' }]
            : []),
          ...people
            .filter((person) => assignees.has(person.user))
            .map((person) => ({
              value: person.user,
              label: person.user === operatorUser ? `${person.name} (you)` : person.name,
              count: assignees.get(person.user),
              active: filters.assignee === person.user,
            }))
            .sort((a, b) => b.count - a.count),
        ],
        onToggle: toggle('assignee'),
      },
    ];
  }, [inView, filters, people, operatorUser, setParams]);

  const chips = [
    filters.severity && { key: 'severity', label: 'Severity', value: severityMeta(filters.severity).label },
    filters.response && { key: 'response', label: 'Response', value: RESPONSE_STATES[filters.response]?.label },
    filters.source && { key: 'source', label: 'Raised by', value: ALERT_SOURCES[filters.source]?.label },
    filters.status && { key: 'status', label: 'Status', value: alertStatusMeta(filters.status).label },
    filters.assignee && {
      key: 'assignee',
      label: 'Assigned to',
      value: filters.assignee === 'none' ? 'Unassigned' : peopleByUser.get(filters.assignee)?.name ?? filters.assignee,
    },
    search && { key: 'q', label: 'Search', value: search },
  ].filter(Boolean);

  const clearAll = () => {
    setSearchDraft('');
    setParams({ severity: '', response: '', source: '', status: '', assignee: '', q: '' });
  };

  /* ── Columns ────────────────────────────────────────────────────────── */

  const allOnPage = pageRows.length > 0 && pageRows.every((alert) => selectedIds.has(alert.id));
  const columns = [
    {
      key: 'select',
      priority: 'wide',
      width: '40px',
      header: (
        <input
          type="checkbox"
          aria-label={allOnPage ? 'Clear the selection' : 'Select every alert on this page'}
          checked={allOnPage}
          ref={(node) => {
            if (node) node.indeterminate = !allOnPage && selected.length > 0;
          }}
          onChange={() =>
            setSelectedIds(allOnPage ? new Set() : new Set(pageRows.map((alert) => alert.id)))
          }
          className="size-4 cursor-pointer accent-[var(--t-brand)]"
        />
      ),
      cell: (row) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.title}`}
          checked={selectedIds.has(row.id)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onChange={() =>
            setSelectedIds((current) => {
              const next = new Set(current);
              if (next.has(row.id)) next.delete(row.id);
              else next.add(row.id);
              return next;
            })
          }
          className="size-4 cursor-pointer accent-[var(--t-brand)]"
        />
      ),
    },
    {
      key: 'alert',
      header: 'Alert',
      primary: true,
      width: '34%',
      cell: (row) => {
        const meta = severityMeta(row.severity);
        return (
          <span className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-1.5 size-2 shrink-0 rounded-full"
              style={{ background: `var(--t-${meta.tone})` }}
            />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink" title={row.title}>
                {row.title}
              </span>
              <span className="block truncate text-[11.5px] text-ink-3" title={row.entity?.detail}>
                <span className="font-mono">{row.entity?.name}</span>
                {row.entity?.detail ? ` · ${row.entity.detail}` : ''}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      key: 'priority',
      header: 'Severity',
      width: '10%',
      sortable: true,
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
      header: 'Status',
      width: '13%',
      cell: (row) => {
        const meta = alertStatusMeta(row.status);
        return (
          <span className="flex flex-wrap items-center gap-1">
            <Tag tone={meta.tone} size="sm">
              {meta.label}
            </Tag>
            {row.escalationLevel >= 2 && isOpen(row) && (
              <span title={`Escalated to level ${row.escalationLevel}`}>
                <ArrowUpCircle aria-label={`Escalated to level ${row.escalationLevel}`} className="size-3.5 text-high" />
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'assignee',
      header: 'Assigned to',
      width: '16%',
      cell: (row) => {
        const person = row.assignee ? peopleByUser.get(row.assignee) : null;
        return (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar person={person} size="sm" />
            <span className={cn('truncate text-[12.5px]', person ? 'text-ink-2' : 'text-ink-3')}>
              {person ? (person.user === operatorUser ? `${person.name} (you)` : person.name) : 'Unassigned'}
            </span>
          </span>
        );
      },
    },
    {
      key: 'due',
      header: 'Response',
      width: '13%',
      sortable: true,
      cell: (row) => {
        const meta = RESPONSE_STATES[row.response.state];
        const by = row.response.state === 'ack_overdue' ? row.response.acknowledgeBy : row.response.resolveBy;
        return (
          <span className="block min-w-0">
            <span className={cn('block text-[12px] font-medium', TONE_TEXT[meta.tone])}>{meta.label}</span>
            {isOpen(row) && (
              <span className="block truncate text-[11px] text-ink-3" title={formatDateTime(new Date(by))}>
                {row.response.state === 'ack_overdue' ? 'ack due ' : 'due '}
                {formatRelativeShort(new Date(by))}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'raised',
      header: 'Raised',
      width: '10%',
      sortable: true,
      priority: 'wide',
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block text-[12.5px] text-ink-2" title={formatDateTime(row.createdAt)}>
            {formatRelativeShort(row.createdAt)}
          </span>
          <span className="block truncate text-[11px] text-ink-3">{ALERT_SOURCES[row.source]?.label}</span>
        </span>
      ),
    },
  ];

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (alertsQuery.isError && !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Alerts" lede="The alert queue could not be loaded." />
        <Panel>
          <ErrorState error={alertsQuery.error} onRetry={alertsQuery.refetch} />
        </Panel>
      </div>
    );
  }

  const loading = alertsQuery.isLoading && !data;
  const exposureError = findingsQuery.isError && !findingsQuery.data ? describeScannerError(findingsQuery.error) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alerts"
        lede="Every problem the other screens raise, in one queue - with an owner, a deadline and an escalation path."
        actions={
          <IconButton icon={Info} label="Escalation policy and response targets" onClick={() => setPolicyOpen(true)} />
        }
        tabs={
          <Tabs
            size="sm"
            value={view}
            onChange={(value) => {
              setSelectedIds(new Set());
              setParams({ view: value === 'open' ? '' : value, status: '', response: '' });
            }}
            tabs={VIEWS.map((entry) => ({ value: entry.value, label: entry.label, count: loading ? undefined : counts[entry.value] }))}
          />
        }
      />

      {loading ? (
        <StatStripSkeleton count={4} />
      ) : (
        <div className="grid gap-3 @min-[30rem]:grid-cols-2 @min-[54rem]:grid-cols-4">
          <MetricTile
            as={Link}
            to="/alerts"
            label="Open"
            value={openAlerts.length}
            icon={BellRing}
            tone="info"
            caption={`${formatNumber(bySeverity.CRITICAL ?? 0)} critical, ${formatNumber(bySeverity.HIGH ?? 0)} high`}
          />
          <MetricTile
            as={Link}
            to="/alerts?view=triage"
            label="Needs triage"
            value={counts.triage}
            tone={counts.triage > 0 ? 'high' : 'low'}
            caption="New, and nobody has it yet"
          />
          <MetricTile
            as={Link}
            to="/alerts?view=overdue"
            label="Past a response target"
            value={counts.overdue}
            tone={counts.overdue > 0 ? 'critical' : 'low'}
            caption="Not acknowledged, or not resolved, in time"
          />
          <MetricTile
            as={Link}
            to="/alerts?view=escalated"
            label="Escalated"
            value={counts.escalated}
            tone={counts.escalated > 0 ? 'medium' : 'low'}
            caption="Above the responder it was routed to"
          />
        </div>
      )}

      {exposureError && (
        <div className="flex flex-wrap items-start gap-2.5 rounded-[var(--radius-panel)] border border-medium/40 bg-medium-soft px-4 py-3">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-medium" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">
              Credential exposure alerts are missing from this queue
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">
              {exposureError.title}. {exposureError.message} Every other source is complete.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={findingsQuery.refetch} loading={findingsQuery.isRefreshing}>
            Try again
          </Button>
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
            mobileTitle="Filter alerts"
          />
        }
      >
        <Panel prominence="lead" flush className="animate-rise overflow-hidden">
          <RecordBar
            trailing={
              <TableToolbar>
                {!railOpen && <ShowFiltersButton onClick={toggleRail} appliedCount={chips.length} />}
                <RefreshButton
                  onRefresh={() => {
                    alertsQuery.refetch();
                    findingsQuery.refetch();
                  }}
                  refreshing={alertsQuery.isRefreshing}
                />
                <TableSettings density={density} onDensityChange={setDensity} />
                <OverflowMenu
                  items={[
                    {
                      key: 'export',
                      label: 'Export this view',
                      hint: `CSV of all ${sorted.length} matching alerts`,
                      onSelect: onExport,
                      disabled: sorted.length === 0,
                      disabledHint: 'Nothing to export - no alerts match',
                    },
                  ]}
                />
              </TableToolbar>
            }
          >
            <SearchInput
              size="sm"
              value={searchDraft}
              onChange={setSearchDraft}
              placeholder="Search alert, identity, credential, repository…"
              className="w-full min-w-0 sm:max-w-sm"
            />
            <ResultCount
              shown={formatNumber(sorted.length)}
              total={formatNumber(inView.length)}
              unit="alerts"
              filtered={chips.length > 0}
              loading={loading}
            />
          </RecordBar>

          <AppliedFilters
            filters={chips}
            onRemove={(key) => {
              if (key === 'q') setSearchDraft('');
              setParams({ [key]: '' });
            }}
            onClearAll={clearAll}
          />

          {selected.length > 0 && (
            <BulkBar
              count={selected.length}
              people={people}
              operatorUser={operatorUser}
              busy={busy}
              anyOpen={selected.some(isOpen)}
              anyClosed={selected.some((alert) => !isOpen(alert))}
              anyNew={selected.some((alert) => alert.status === 'new')}
              canEscalate={selected.some((alert) => isOpen(alert) && (alert.escalationLevel ?? 1) < 3)}
              onAction={onBulk}
              onDismiss={() => setBulkDismiss(true)}
              onClear={() => setSelectedIds(new Set())}
            />
          )}

          <DataGrid
            caption="Alerts"
            columns={columns}
            rows={pageRows}
            rowKey={(row) => row.id}
            loading={loading}
            refreshing={alertsQuery.isRefreshing}
            density={density}
            sort={sort}
            onSortChange={(next) => setParams({ sort: next.key === 'priority' && next.direction === 'desc' ? '' : next.key, dir: next.direction === 'desc' ? '' : next.direction })}
            onRowClick={(row) => setParams({ alert: row.id }, { resetPage: false })}
            skeletonRows={8}
            emptyState={
              chips.length > 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No alerts match these filters"
                  description="Nothing in this view matches the current severity, source, status and search combination."
                  action={
                    <Button variant="secondary" size="sm" onClick={clearAll}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <ClearState
                  title={VIEWS.find((entry) => entry.value === view)?.empty ?? 'Nothing here'}
                  description={VIEWS.find((entry) => entry.value === view)?.emptyDetail}
                />
              )
            }
          />

          {!loading && sorted.length > pageSize && (
            <Pagination
              page={safePage}
              pageSize={pageSize}
              total={sorted.length}
              unit="alerts"
              onPageChange={(next) => setParams({ page: next > 1 ? next : '' }, { resetPage: false })}
              onPageSizeChange={(next) => setParams({ size: next === DEFAULT_PAGE_SIZE ? '' : next })}
            />
          )}
        </Panel>
      </WorkArea>

      <AlertDrawer
        key={openAlert?.id ?? 'none'}
        alert={openAlert}
        people={people}
        policy={policy}
        operatorUser={operatorUser}
        busy={busy}
        onClose={() => setParams({ alert: '' }, { resetPage: false })}
        onAction={runAction}
      />

      <BulkDismissModal
        open={bulkDismiss}
        count={selected.filter(isOpen).length}
        busy={busy}
        onClose={() => setBulkDismiss(false)}
        onConfirm={async (reason, note) => {
          const ok = await onBulk('dismiss', { reason, note });
          if (ok) setBulkDismiss(false);
        }}
      />

      <Modal
        open={policyOpen}
        onClose={() => setPolicyOpen(false)}
        title="How alerts are handled"
        description="The escalation policy and response targets every alert in this queue runs against."
        icon={Info}
        footer={
          <Button variant="secondary" onClick={() => setPolicyOpen(false)}>
            Close
          </Button>
        }
      >
        <PolicySummary policy={policy} />
      </Modal>
    </div>
  );
}

const TONE_TEXT = {
  critical: 'text-critical',
  high: 'text-high',
  medium: 'text-medium',
  low: 'text-low',
  neutral: 'text-ink-3',
  info: 'text-info',
};

const ACTION_DONE = {
  acknowledge: (n) => `${n} alert${n === 1 ? '' : 's'} acknowledged`,
  start: (n) => `Work started on ${n} alert${n === 1 ? '' : 's'}`,
  resolve: (n) => `${n} alert${n === 1 ? '' : 's'} resolved`,
  dismiss: (n) => `${n} alert${n === 1 ? '' : 's'} dismissed`,
  reopen: (n) => `${n} alert${n === 1 ? '' : 's'} reopened`,
  escalate: (n) => `${n} alert${n === 1 ? '' : 's'} escalated`,
};

/**
 * The views, as the questions a responder asks - in the order they ask them.
 * `test` decides membership; everything else about the view is copy.
 */
const VIEWS = [
  {
    value: 'open',
    label: 'Open',
    test: (alert) => isOpen(alert),
    empty: 'No open alerts',
    emptyDetail: 'Every alert has been resolved or dismissed.',
  },
  {
    value: 'triage',
    label: 'Needs triage',
    test: (alert) => alert.status === 'new' && !alert.assignee,
    empty: 'Nothing waiting for triage',
    emptyDetail: 'Every new alert has somebody assigned to it.',
  },
  {
    value: 'mine',
    label: 'Assigned to me',
    test: (alert, me) => isOpen(alert) && Boolean(me) && alert.assignee === me,
    empty: 'Nothing assigned to you',
    emptyDetail: 'Alerts assigned to you, or escalated to you, appear here.',
  },
  {
    value: 'escalated',
    label: 'Escalated',
    test: (alert) => isOpen(alert) && (alert.escalationLevel ?? 1) >= 2,
    empty: 'Nothing escalated',
    emptyDetail: 'No open alert has gone above the responder it was routed to.',
  },
  {
    value: 'overdue',
    label: 'Overdue',
    test: (alert) => ['overdue', 'ack_overdue'].includes(alert.response?.state),
    empty: 'Nothing is late',
    emptyDetail: 'Every open alert is inside its response targets.',
  },
  {
    value: 'closed',
    label: 'Closed',
    test: (alert) => !isOpen(alert),
    empty: 'Nothing closed yet',
    emptyDetail: 'Resolved and dismissed alerts are kept here, with the reason they were closed.',
  },
];

/**
 * The actions for everything selected.
 *
 * Only actions that apply to at least one selected alert are offered - a
 * button that would do nothing to every row it is pointed at is not offered.
 */
function BulkBar({ count, people, operatorUser, busy, anyOpen, anyClosed, anyNew, canEscalate, onAction, onDismiss, onClear }) {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="animate-fade flex flex-wrap items-center gap-2 border-b border-line bg-info-soft px-4 py-2.5"
    >
      <span className="text-[12.5px] font-semibold text-ink" data-numeric="">
        {formatNumber(count)} selected
      </span>
      {anyOpen && (
        <>
          <div className="w-56">
            <Select
              size="sm"
              aria-label="Assign selected alerts to"
              value=""
              placeholder="Assign to…"
              options={[
                { value: '__none', label: 'Nobody (unassign)' },
                ...people.map((person) => ({
                  value: person.user,
                  label: person.user === operatorUser ? `${person.name} (you)` : person.name,
                })),
              ]}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return;
                onAction('assign', { assignee: value === '__none' ? null : value });
              }}
              disabled={busy}
            />
          </div>
          {anyNew && (
            <Button variant="secondary" size="sm" icon={Hand} onClick={() => onAction('acknowledge')} disabled={busy}>
              Acknowledge
            </Button>
          )}
          {canEscalate && (
            <Button variant="secondary" size="sm" icon={ArrowUpCircle} onClick={() => onAction('escalate')} disabled={busy}>
              Escalate
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={CheckCircle2} onClick={() => onAction('resolve')} disabled={busy}>
            Resolve
          </Button>
          <Button variant="secondary" size="sm" icon={XCircle} onClick={onDismiss} disabled={busy}>
            Dismiss…
          </Button>
        </>
      )}
      {anyClosed && (
        <Button variant="secondary" size="sm" onClick={() => onAction('reopen')} disabled={busy}>
          Reopen
        </Button>
      )}
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear} disabled={busy}>
        Clear selection
      </Button>
    </div>
  );
}

function BulkDismissModal({ open, count, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const close = () => {
    setReason('');
    setNote('');
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={`Dismiss ${formatNumber(count)} alert${count === 1 ? '' : 's'}`}
      description="Closes them without a fix. The reason is recorded on every one, so whoever reviews them later knows why."
      icon={XCircle}
      tone="medium"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onConfirm(reason, note)} disabled={!reason} loading={busy}>
            Dismiss
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="text-[12.5px] font-medium text-ink-2">Reason</legend>
        <div className="mt-2 flex flex-col gap-1.5">
          {DISMISS_REASONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border px-3 py-2 transition-colors',
                reason === option.value ? 'border-brand bg-info-soft' : 'border-line hover:border-line-strong',
              )}
            >
              <input
                type="radio"
                name="bulk-dismiss-reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="mt-0.5 accent-[var(--t-brand)]"
              />
              <span>
                <span className="block text-[12.5px] font-medium text-ink">{option.label}</span>
                <span className="block text-[11.5px] text-ink-3">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 block text-[12.5px] font-medium text-ink-2" htmlFor="bulk-dismiss-note">
        Note (optional)
      </label>
      <Textarea
        id="bulk-dismiss-note"
        className="mt-1.5"
        rows={2}
        maxLength={300}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
    </Modal>
  );
}

/** What the Info button opens: the policy the whole queue runs against. */
function PolicySummary({ policy }) {
  const hours = (value) => (value < 24 ? `${value} hour${value === 1 ? '' : 's'}` : `${value / 24} days`);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[12.5px] font-semibold text-ink">Escalation policy</p>
        <ol className="mt-2 flex flex-col gap-2">
          {ESCALATION_LEVELS.map((entry) => (
            <li key={entry.level} className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2">
              <p className="text-[12.5px] font-medium text-ink">
                Level {entry.level} - {entry.label}
                {policy?.[entry.level] ? `: ${policy[entry.level].name}` : ''}
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-3">
                {entry.level === 1
                  ? 'Alerts about an identity go to its owner. With no owner on record, security on-call takes them.'
                  : entry.detail}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
          A Critical alert still New an hour after it was raised escalates to level 2 automatically.
          Anyone can escalate by hand. Acknowledging stops the automatic step.
        </p>
      </div>
      <div>
        <p className="text-[12.5px] font-semibold text-ink">Response targets</p>
        <table className="mt-2 w-full text-left text-[12px]">
          <thead>
            <tr className="text-ink-3">
              <th className="py-1 font-medium">Severity</th>
              <th className="py-1 font-medium">Acknowledge within</th>
              <th className="py-1 font-medium">Resolve within</th>
            </tr>
          </thead>
          <tbody>
            {SEVERITY_ORDER.map((key) => (
              <tr key={key} className="border-t border-line">
                <td className="py-1.5">
                  <Tag tone={severityMeta(key).tone} size="sm" dot>
                    {severityMeta(key).label}
                  </Tag>
                </td>
                <td className="py-1.5 text-ink-2">{hours(RESPONSE_TARGETS[key].acknowledge)}</td>
                <td className="py-1.5 text-ink-2">{hours(RESPONSE_TARGETS[key].resolve)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
          This console's default policy, not a regulatory standard. Both clocks start when an alert is
          raised, and restart when it is reopened.
        </p>
      </div>
    </div>
  );
}

export { AlertsPage };
