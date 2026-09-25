import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { useAccess } from '../../app/useAccess';
import { handoffOf, isOpen, responseState } from '../../lib/alerts';
import { fetchAlerts, fetchFindings } from '../../lib/api/endpoints';
import { useQuery } from '../../lib/hooks';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { severityMeta } from '../../lib/domain';
import { useToast } from '../../ui/Toast';
import { exposureAlerts } from './exposureAlerts';

/* How often an open console re-reads the queue. Short enough that a hand-over
   lands while the person is still looking; the demo also refreshes at once on
   any write, in this tab or another. */
export const ALERT_REFRESH_MS = 20_000;

const AlertFeedContext = createContext({ mine: [], all: [], data: null, loaded: false, query: null });

/**
 * The signed-in person's slice of the alert queue, kept live for the whole
 * console.
 *
 * On-call tools deliver a hand-over to the person, wherever they are - not to
 * a page they happen to have open. So the queue is read here, in the shell:
 * the sidebar shows how many open alerts are yours, and a new one - routed,
 * assigned or escalated to you - arrives as a notice with a link to it.
 * Nothing is announced for what you did yourself, or on first load (that is
 * the queue, not news).
 */
export function AlertFeedProvider({ children }) {
  const { user } = useAuth();
  const { can } = useAccess();
  const { notify } = useToast();
  const navigate = useNavigate();
  const me = user?.username ?? null;
  const enabled = Boolean(me) && can('alerts.view');

  const query = useDemoQuery((signal) => fetchAlerts(signal), [me], { enabled, refreshMs: ALERT_REFRESH_MS });
  /* The scanner feed is read once, not polled: findings change when a scan
     runs, not by the minute, and the scanner is a separate service. */
  const findingsQuery = useQuery((signal) => fetchFindings(signal), [me], { enabled: enabled && can('exposure.view') });

  const data = query.data;
  const all = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    const exposure = exposureAlerts(findingsQuery.data?.findings ?? [], data.triage, data.policy, now).filter(
      (alert) => data.scope === 'all' || alert.assignee === me,
    );
    return [...data.alerts, ...exposure].map((alert) => ({ ...alert, response: responseState(alert, now) }));
  }, [data, findingsQuery.data, me]);
  const mine = useMemo(() => all.filter((alert) => isOpen(alert) && alert.assignee === me), [all, me]);

  /* Arrivals: ids open and mine now that were not on the last read. */
  const seen = useRef(null);
  useEffect(() => {
    seen.current = null;
  }, [me]);
  const findingsSettled = !findingsQuery.isLoading;
  useEffect(() => {
    if (!data) return;
    const ids = new Set(mine.map((alert) => alert.id));
    const previous = seen.current;
    seen.current = { ids, settled: findingsSettled };
    /* The first complete read is the baseline, not news: a read taken while
       the scanner feed was still loading would otherwise announce every
       exposure alert the moment it arrived. */
    if (!previous || !previous.settled) return;
    const arrived = mine.filter((alert) => !previous.ids.has(alert.id)).filter((alert) => {
      const last = alert.activity?.[alert.activity.length - 1];
      return last?.actorUser !== me;
    });
    if (arrived.length === 0) return;
    if (arrived.length > 2) {
      notify({
        title: `${arrived.length} alerts are now yours`,
        description: 'Assigned or escalated to you since you last looked.',
        duration: 12_000,
        action: { label: 'Open Alerts', onSelect: () => navigate('/alerts') },
      });
      return;
    }
    for (const alert of arrived) {
      const handoff = handoffOf(alert, me);
      notify({
        title: handoff?.kind === 'escalated' ? 'Escalated to you' : 'Assigned to you',
        description: `${severityMeta(alert.severity).label} - ${alert.title}`,
        duration: 12_000,
        action: { label: 'Open alert', onSelect: () => navigate(`/alerts?alert=${encodeURIComponent(alert.id)}`) },
      });
    }
  }, [data, mine, me, notify, navigate, findingsSettled]);

  const value = useMemo(
    () => ({ mine, all, data, loaded: Boolean(data), query, findingsQuery }),
    [mine, all, data, query, findingsQuery],
  );
  return <AlertFeedContext.Provider value={value}>{children}</AlertFeedContext.Provider>;
}

export function useAlertFeed() {
  return useContext(AlertFeedContext);
}
