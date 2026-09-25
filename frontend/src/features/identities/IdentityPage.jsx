import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BellRing, Dna, Fingerprint, ShieldCheck, Waypoints } from 'lucide-react';
import { RESPONSE_STATES, isOpen } from '../../lib/alerts';
import { fetchAlerts, fetchIdentity, fetchPostureIdentity } from '../../lib/api/endpoints';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { useAccess } from '../../app/useAccess';
import { actorTypeMeta, classificationMeta, severityMeta } from '../../lib/domain';
import { formatRelative } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { CopyableValue } from '../../ui/Copyable';
import { Panel, PanelHeader } from '../../ui/Panel';
import { DetailSkeleton, ListSkeleton, Skeleton } from '../../ui/Skeleton';
import { ClearState, EmptyState, ErrorState } from '../../ui/States';
import { Tabs } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { TONE_VAR } from '../../ui/cn';
import { PostureRecord } from '../posture/PostureRecord';
import { BandTag, ScoreRing } from '../posture/parts';
import { IdentityTags } from './IdentityDrawer';
import { IdentityRecordPanels, recordTabs } from './IdentityRecord';

const RECORD_KEYS = new Set(['overview', 'credentials', 'roles', 'activity']);

/**
 * One identity, in one place.
 *
 * Everything the console knows about an identity used to live on four
 * screens - the Identities drawer, a Posture detail page, NHI Genome and the
 * access graph - each with its own header and its own idea of what mattered.
 * This page is the record: what it is and holds (the same panels the drawer
 * shows), its posture score and fixes, and its alerts. The genome and the
 * access graph stay specialist views, linked from here, because a behaviour
 * baseline and a reachability map each need a whole screen.
 *
 * The tab lives in the URL, so a link from an alert or a quick win lands on
 * the part that matters.
 */
export default function IdentityPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const identityQuery = useDemoQuery((signal) => fetchIdentity(id, signal), [id]);
  const postureQuery = useDemoQuery((signal) => fetchPostureIdentity(id, signal), [id]);
  const { can } = useAccess();
  /* Only for a role with the alert queue; for an analyst the API returns
     their own alerts, so the tab shows theirs on this identity. */
  const withAlerts = can('alerts.view');
  const scopedAlerts = !can('alerts.viewAll');
  const alertsQuery = useDemoQuery((signal) => fetchAlerts(signal), [], { enabled: withAlerts });
  const identity = identityQuery.data;
  const posture = postureQuery.data;

  const alerts = useMemo(
    () => (alertsQuery.data?.alerts ?? []).filter((alert) => alert.identityId === id),
    [alertsQuery.data, id],
  );
  const openAlerts = alerts.filter(isOpen).length;

  const tabs = identity
    ? [
        ...recordTabs(identity).slice(0, 1),
        { value: 'posture', label: 'Posture', icon: ShieldCheck },
        ...recordTabs(identity).slice(1),
        ...(withAlerts
          ? [{ value: 'alerts', label: scopedAlerts ? 'My alerts' : 'Alerts', icon: BellRing, count: openAlerts || undefined }]
          : []),
      ]
    : [];
  const requested = searchParams.get('tab') || 'overview';
  const tab = tabs.some((entry) => entry.value === requested) ? requested : 'overview';
  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'overview') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  const back = (
    <Button variant="secondary" as={Link} to="/identities" icon={ArrowLeft}>
      Identities
    </Button>
  );

  if (identityQuery.isError && !identity) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Identity" actions={back} />
        <Panel>
          {identityQuery.error?.status === 404 ? (
            <EmptyState
              icon={Fingerprint}
              title="No identity with that id"
              description="A later discovery run may have removed it. Find it again from Identities."
              action={back}
            />
          ) : (
            <ErrorState error={identityQuery.error} onRetry={identityQuery.refetch} />
          )}
        </Panel>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <PageHeader title={<Skeleton className="h-7 w-64 rounded" />} actions={back} />
        <Panel prominence="lead">
          <DetailSkeleton rows={8} />
        </Panel>
        <span role="status" className="sr-only">
          Loading identity
        </span>
      </div>
    );
  }

  const meta = classificationMeta(identity.classification);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-3">
            {posture && <ScoreRing score={posture.identity.score} size={40} grade={posture.identity.grade} />}
            <span className="min-w-0 truncate font-mono">{identity.name}</span>
          </span>
        }
        lede={`${actorTypeMeta(identity.identity_type).label} · ${meta.label} · ${identity.account_name} · ${identity.region}`}
        actions={
          <>
            {back}
            <Button variant="secondary" as={Link} to={`/access-graph/${encodeURIComponent(identity.id)}`} icon={Waypoints}>
              Access graph
            </Button>
            {posture?.identity.inGenome && (
              <Button variant="secondary" as={Link} to={`/genome/${encodeURIComponent(identity.id)}`} icon={Dna}>
                NHI Genome
              </Button>
            )}
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {posture && <BandTag score={posture.identity.score} />}
            <IdentityTags identity={identity} />
            <span className="min-w-0 max-w-full text-[11.5px] text-ink-3">
              <CopyableValue value={identity.arn} />
            </span>
          </div>
        }
        tabs={<Tabs size="sm" tabs={tabs} value={tab} onChange={setTab} />}
      />

      {RECORD_KEYS.has(tab) && (
        <Panel className="animate-rise">
          <IdentityRecordPanels identity={identity} tab={tab} />
        </Panel>
      )}

      {tab === 'posture' &&
        (postureQuery.isError && !posture ? (
          <Panel>
            <ErrorState error={postureQuery.error} onRetry={postureQuery.refetch} />
          </Panel>
        ) : !posture ? (
          <Panel prominence="lead">
            <DetailSkeleton rows={6} />
          </Panel>
        ) : (
          <PostureRecord data={posture} />
        ))}

      {tab === 'alerts' && <AlertsTab query={alertsQuery} alerts={alerts} scoped={scopedAlerts} />}
    </div>
  );
}

function AlertsTab({ query, alerts, scoped }) {
  if (query.isError && !query.data) {
    return (
      <Panel>
        <ErrorState error={query.error} onRetry={query.refetch} />
      </Panel>
    );
  }
  if (!query.data) {
    return (
      <Panel>
        <ListSkeleton rows={4} />
      </Panel>
    );
  }
  const ordered = [...alerts].sort(
    (a, b) => Number(isOpen(b)) - Number(isOpen(a)) || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  return (
    <Panel flush className="animate-rise overflow-hidden">
      <div className="px-4 pt-4 pb-3 sm:px-5">
        <PanelHeader
          title={scoped ? 'Your alerts on this identity' : 'Alerts on this identity'}
          subtitle={
            scoped
              ? 'Only the alerts assigned or escalated to you. Open first, then closed; alerts on its credentials are included.'
              : 'Open first, then closed. Alerts on the credentials it holds are included.'
          }
        />
      </div>
      {ordered.length === 0 ? (
        <div className="px-4 pb-4 sm:px-5">
          <ClearState
            compact
            title="No alerts"
            description={
              scoped
                ? 'Nothing on this identity or its credentials is assigned to you.'
                : 'Nothing has been raised on this identity or its credentials.'
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {ordered.map((alert) => {
            const severity = severityMeta(alert.severity);
            const response = RESPONSE_STATES[alert.response?.state] ?? RESPONSE_STATES.closed;
            return (
              <li key={alert.id}>
                <Link
                  to={`/alerts?alert=${encodeURIComponent(alert.id)}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
                >
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: TONE_VAR[severity.tone] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{alert.title}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">
                      {severity.label}
                      {alert.entity?.kind === 'Credential' ? ` · ${alert.entity.name}` : ''} · raised {formatRelative(alert.createdAt)}
                    </span>
                  </span>
                  <Tag tone={response.tone} size="sm">
                    {response.label}
                  </Tag>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
