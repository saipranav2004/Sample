import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Fingerprint } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { RESPONSE_STATES, alertStatusMeta, handoffOf, isOpen, spanText } from '../../lib/alerts';
import { severityMeta, SEVERITY_ORDER } from '../../lib/domain';
import { formatNumber, formatRelative } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Panel, PanelHeader } from '../../ui/Panel';
import { ListSkeleton, LoadingAnnouncement } from '../../ui/Skeleton';
import { ClearState, ErrorState } from '../../ui/States';
import { Tag } from '../../ui/Tag';
import { TONE_VAR, cn } from '../../ui/cn';
import { useAlertFeed } from '../alerts/AlertFeed';
import { LiveStatus, QueueSummary } from '../alerts/queueParts';

const SEVERITY_WEIGHT = Object.fromEntries(SEVERITY_ORDER.map((key, index) => [key, SEVERITY_ORDER.length - index]));
const CLOSED_WINDOW_DAYS = 7;

/**
 * An analyst's home: their own work, in the order to do it.
 *
 * An analyst sees only the alerts assigned or escalated to them, so the
 * organisation dashboard - totals across every identity - answers a question
 * that is not theirs. This answers theirs: what is late, what has just been
 * handed to them, what they are already on, and what they closed. No metric
 * tiles: one person's queue is a list to work through, not a trend to watch.
 * It is kept live by the shell's alert feed, like the sidebar count.
 */
export default function MyWorkPage() {
  const { user } = useAuth();
  const { all, loaded, query } = useAlertFeed();
  const me = user?.username ?? null;

  /* Due times are clocks; re-rendered each minute so "due in 3m" turns into
     "overdue" without a reload. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const sections = useMemo(() => {
    const mine = all.filter((alert) => alert.assignee === me);
    const open = mine.filter(isOpen);
    const late = (alert) => ['overdue', 'ack_overdue'].includes(alert.response?.state);
    const bySeverity = (a, b) =>
      (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0) ||
      a.response.resolveBy - b.response.resolveBy;
    const since = now - CLOSED_WINDOW_DAYS * 86_400_000;
    return {
      open,
      late: open.filter(late).sort(bySeverity),
      fresh: open.filter((alert) => !late(alert) && alert.status === 'new').sort(bySeverity),
      working: open
        .filter((alert) => !late(alert) && alert.status !== 'new')
        .sort((a, b) => a.response.resolveBy - b.response.resolveBy),
      closed: mine
        .filter((alert) => !isOpen(alert) && alert.closedAt && Date.parse(alert.closedAt) >= since)
        .sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt))
        .slice(0, 6),
    };
  }, [all, me, now]);

  /* Which identities the open work is about: an analyst investigates an
     identity, not an alert at a time. */
  const identities = useMemo(() => {
    const groups = new Map();
    for (const alert of sections.open) {
      const subject = alert.subject ?? alert.entity;
      if (!subject) continue;
      const key = alert.identityId ?? subject.key ?? subject.name;
      const entry = groups.get(key) ?? { key, subject, identityId: alert.identityId ?? null, alerts: [] };
      entry.alerts.push(alert);
      groups.set(key, entry);
    }
    return [...groups.values()]
      .sort(
        (a, b) =>
          b.alerts.length - a.alerts.length ||
          Math.max(...b.alerts.map((alert) => SEVERITY_WEIGHT[alert.severity] ?? 0)) -
            Math.max(...a.alerts.map((alert) => SEVERITY_WEIGHT[alert.severity] ?? 0)),
      )
      .slice(0, 6);
  }, [sections.open]);

  const counts = useMemo(
    () => ({
      unacked: sections.open.filter((alert) => alert.status === 'new').length,
      overdue: sections.late.length,
    }),
    [sections],
  );

  const header = (
    <PageHeader
      title="My work"
      lede="The alerts assigned or escalated to you, in the order to work them. Anything handed to you appears here, and as a notice on any screen, as soon as it happens."
      actions={
        <>
          <LiveStatus refreshing={query?.isRefreshing} />
          <Button as={Link} to="/alerts" variant="secondary" iconRight={ArrowRight}>
            My alerts
          </Button>
        </>
      }
    />
  );

  if (query?.isError && !loaded) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Panel>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      {!loaded && <LoadingAnnouncement label="Loading your alerts" />}
      <QueueSummary loading={!loaded} open={sections.open} counts={counts} />

      <div className="grid gap-4 @min-[60rem]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section
            title="Needs you now"
            subtitle="Past a response target: not acknowledged, or not resolved, in time."
            tone="critical"
            alerts={sections.late}
            loaded={loaded}
            now={now}
            me={me}
            empty="Nothing of yours is late."
          />
          <Section
            title="Just handed to you"
            subtitle="Routed, assigned or escalated to you and not acknowledged yet."
            tone="high"
            alerts={sections.fresh}
            loaded={loaded}
            now={now}
            me={me}
            empty="You have acknowledged everything handed to you."
          />
          <Section
            title="In progress"
            subtitle="Acknowledged or being worked, soonest deadline first."
            tone="info"
            alerts={sections.working}
            loaded={loaded}
            now={now}
            me={me}
            empty="Nothing in progress."
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel prominence="quiet" className="animate-rise">
            <PanelHeader
              prominence="quiet"
              title="Identities behind your alerts"
              subtitle="Where your open work concentrates. Open one to see its whole record."
            />
            <div className="mt-3">
              {!loaded ? (
                <ListSkeleton rows={4} />
              ) : identities.length === 0 ? (
                <ClearState compact title="No open alerts" description="No identity is waiting on you." />
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {identities.map((entry) => {
                    const worst = [...entry.alerts].sort(
                      (a, b) => (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0),
                    )[0];
                    const body = (
                      <>
                        <Fingerprint aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-[12.5px] text-ink">{entry.subject.name}</span>
                          <span className="block truncate text-[11.5px] text-ink-3">{entry.subject.detail}</span>
                        </span>
                        <Tag tone={severityMeta(worst.severity).tone} size="sm">
                          {formatNumber(entry.alerts.length)} open
                        </Tag>
                      </>
                    );
                    return (
                      <li key={entry.key}>
                        {entry.identityId ? (
                          <Link
                            to={`/identities/${encodeURIComponent(entry.identityId)}`}
                            className="-mx-2 flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-2.5 transition-colors hover:bg-surface-2"
                          >
                            {body}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-2.5 py-2.5">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Panel>

          <Section
            title="Closed recently"
            subtitle={`Resolved or dismissed in the last ${CLOSED_WINDOW_DAYS} days.`}
            tone="neutral"
            alerts={sections.closed}
            loaded={loaded}
            now={now}
            me={me}
            empty="Nothing closed in the last week."
            quiet
          />
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, tone, alerts, loaded, now, me, empty, quiet = false }) {
  return (
    <Panel prominence={quiet ? 'quiet' : 'default'} flush className="animate-rise overflow-hidden">
      <div className="px-4 pt-4 pb-3 sm:px-5">
        <PanelHeader
          prominence={quiet ? 'quiet' : undefined}
          title={
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: TONE_VAR[tone] ?? 'var(--t-ink-3)' }} />
              {title}
              {loaded && alerts.length > 0 && (
                <span className="text-[12px] font-medium text-ink-3" data-numeric="">
                  {formatNumber(alerts.length)}
                </span>
              )}
            </span>
          }
          subtitle={subtitle}
        />
      </div>
      {!loaded ? (
        <div className="px-4 pb-4 sm:px-5">
          <ListSkeleton rows={3} />
        </div>
      ) : alerts.length === 0 ? (
        <div className="px-4 pb-4 sm:px-5">
          <p className="text-[12.5px] text-ink-3">{empty}</p>
        </div>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {alerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} now={now} me={me} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function AlertRow({ alert, now, me }) {
  const severity = severityMeta(alert.severity);
  const open = isOpen(alert);
  const handoff = handoffOf(alert, me);
  const response = alert.response ?? { state: 'closed' };
  const responseMeta = RESPONSE_STATES[response.state] ?? RESPONSE_STATES.closed;
  const by = response.state === 'ack_overdue' ? response.acknowledgeBy : response.resolveBy;
  const clock = !open
    ? `closed ${formatRelative(alert.closedAt)}`
    : now > by
      ? `${response.state === 'ack_overdue' ? 'ack ' : ''}overdue ${spanText(now - by, { short: true })}`
      : `due in ${spanText(by - now, { short: true })}`;
  return (
    <li>
      <Link
        to={`/alerts?alert=${encodeURIComponent(alert.id)}`}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
      >
        <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: TONE_VAR[severity.tone] }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink" title={alert.title}>
            {alert.title}
          </span>
          <span className="block truncate text-[11.5px] text-ink-3">
            <span className="font-mono">{alert.entity?.name}</span>
            {handoff ? ` · ${handoff.label}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Tag tone={open ? responseMeta.tone : alertStatusMeta(alert.status).tone} size="sm">
            {open ? responseMeta.label : alertStatusMeta(alert.status).label}
          </Tag>
          <span className={cn('text-[11px]', open && now > by ? 'text-critical' : 'text-ink-3')}>{clock}</span>
        </span>
      </Link>
    </li>
  );
}
