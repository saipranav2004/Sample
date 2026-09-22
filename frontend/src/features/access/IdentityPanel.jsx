import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crosshair, Radius } from 'lucide-react';
import { SEVERITY_ORDER, severityMeta } from '../../lib/domain';
import { formatNumber, formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Panel, SectionLabel } from '../../ui/Panel';
import { Meter } from '../../ui/Meter';
import { DetailSkeleton } from '../../ui/Skeleton';
import { Tag } from '../../ui/Tag';
import { cn } from '../../ui/cn';
import { KIND_LABEL, riskReason } from './graphTheme';

/**
 * The selected node, in tabs.
 *
 * ── Why tabs and not one scrolling column ───────────────────────────────────
 * This started as a stack of sections, which worked while there were four of
 * them. There are eleven now - the permissions, the observed behaviour, the
 * credentials, the trust, the baseline - and a 340px column holding all of it
 * is a 1,200px scroll where the thing you want is never the thing on screen.
 * Tabs make each question one click rather than one hunt, and the tab row
 * itself is the list of questions this screen can answer, which is worth
 * seeing.
 *
 * ── Why these tabs ──────────────────────────────────────────────────────────
 * One per question an analyst actually asks of a principal: what is it, what
 * can it reach, what does it hold, who can become it, how does it normally
 * behave, what was it granted, who is answerable for it. A tab is hidden when
 * the node has nothing to put in it - an entry point has no key hygiene - so
 * the row never offers a click that leads to "nothing here".
 */

const ALL_TABS = [
  { value: 'summary', label: 'Summary' },
  { value: 'access', label: 'Access' },
  { value: 'credentials', label: 'Credentials' },
  { value: 'keys', label: 'Key hygiene' },
  { value: 'trust', label: 'Trust & reach' },
  { value: 'behaviour', label: 'Behaviour' },
  { value: 'events', label: 'Top events' },
  { value: 'policies', label: 'Policies' },
  { value: 'ownership', label: 'Ownership' },
  { value: 'why', label: 'Why classified' },
];

export function IdentityPanel({ node, isFocusNode, detail, onTrace, onExpand, expandedIds }) {
  const [tab, setTab] = useState('summary');

  const data = detail?.data;
  const radius = data?.radius;
  const reach = data?.reach;
  const observed = data?.observed;
  const credentials = data?.credentials ?? [];
  const trustedBy = data?.trustedBy ?? [];
  const behaviour = data?.behaviour;
  const paths = data?.paths ?? [];

  /* Grouped by the far end, not one row per path.
     Every path here passes through the node named at the top of the panel, so
     the row shows the other end. When four routes share one entry point that
     printed the same name four times and told the reader nothing - so
     identical ends collapse into one row with a count, keeping the shortest
     route as the one Trace follows. */
  const pathsByEnd = useMemo(() => {
    const groups = new Map();
    for (const path of paths) {
      const isEntry = path.entryId === node?.id;
      const key = isEntry ? path.targetId : path.entryId;
      const name = isEntry ? path.targetName : path.entryName;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { key, name, count: 1, shortest: path, severity: path.severity });
        continue;
      }
      existing.count += 1;
      if (path.hops < existing.shortest.hops) existing.shortest = path;
      if (SEVERITY_ORDER.indexOf(path.severity) < SEVERITY_ORDER.indexOf(existing.severity)) {
        existing.severity = path.severity;
      }
    }
    return [...groups.values()].sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        b.count - a.count ||
        a.shortest.hops - b.shortest.hops,
    );
  }, [paths, node?.id]);

  /* A tab with nothing behind it is not offered. The counts sit on the tab so
     the reader can see what is there before they click. */
  const available = useMemo(() => {
    if (!node) return [];
    const has = {
      summary: true,
      access: Boolean(radius) || Boolean(reach && reach.paths > 0) || true,
      credentials: credentials.length > 0,
      keys: (node.accessKeyCount ?? 0) > 0,
      trust: trustedBy.length > 0 || Boolean(reach && reach.paths > 0),
      behaviour: Boolean(behaviour),
      events: Boolean(observed && observed.topActions?.length > 0),
      policies: Array.isArray(node.attachedPolicies) && node.attachedPolicies.length > 0,
      ownership: Boolean(node.ownerName || node.createdByName || node.assignedTo),
      why: Boolean(node.evidence),
    };
    const counts = {
      credentials: credentials.length,
      trust: trustedBy.length,
      policies: node.attachedPolicies?.length ?? 0,
    };
    return ALL_TABS.filter((entry) => has[entry.value]).map((entry) =>
      counts[entry.value] ? { ...entry, count: counts[entry.value] } : entry,
    );
  }, [node, radius, reach, credentials, trustedBy, behaviour, observed]);

  /* A different node is a different record, and its tabs differ, so an
     unavailable tab falls back rather than showing an empty pane. */
  const activeTab = available.some((entry) => entry.value === tab) ? tab : 'summary';

  if (!node) {
    return (
      <Panel prominence="quiet" className="animate-rise">
        <DetailSkeleton rows={5} />
      </Panel>
    );
  }

  const risk = riskReason(node);
  const isOpen = expandedIds.includes(node.id);

  return (
    /* The head does not scroll.
       With the whole panel scrolling, reading to the foot of a long pane took
       the tab row off screen with it - so changing tab meant scrolling back up
       to find the control. The title and the tabs are pinned and only the pane
       below them moves, which is what makes a bounded panel usable. */
    <Panel
      prominence="lead"
      className="access-inspector animate-rise flex flex-col gap-3 self-start overflow-hidden"
      style={{ '--graph-max-h': '560px' }}
    >
      <div className="shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
              {isFocusNode ? 'Focus' : 'Selected'} · {KIND_LABEL[node.kind] ?? node.kind}
            </p>
            <h2 className="mt-0.5 truncate text-[16px] font-semibold text-ink" title={node.name}>
              {node.name}
            </h2>
          </div>
          {node.unseenCount > 0 && !isFocusNode && (
            <Button variant="secondary" size="sm" onClick={() => onExpand(node)}>
              {isOpen ? 'Collapse' : `Open ${node.unseenCount}`}
            </Button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {risk && (
            <Tag tone="critical" size="sm" dot>
              {risk}
            </Tag>
          )}
          {node.accountName && (
            <Tag tone="neutral" size="sm">
              {node.accountName}
            </Tag>
          )}
          {node.env && (
            <Tag tone="neutral" size="sm">
              {node.env}
            </Tag>
          )}
          {typeof node.depth === 'number' && node.depth > 0 && (
            <Tag tone="info" size="sm">
              {node.depth} hop{node.depth === 1 ? '' : 's'} out
            </Tag>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <PanelTabs tabs={available} value={activeTab} onChange={setTab} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain">
        {activeTab === 'summary' && (
          <>
                  {observed && (
                    <div>
                      <SectionLabel>Observed behaviour</SectionLabel>
                      <dl className="mt-2 grid grid-cols-3 gap-1.5">
                        <Figure label="Events seen" value={formatNumber(observed.eventsSeen)} />
                        <Figure label="Distinct actions" value={formatNumber(observed.distinctActions)} />
                        <Figure
                          label="Errors"
                          value={formatNumber(observed.errors)}
                          tone={observed.errors > 0 ? 'critical' : 'neutral'}
                        />
                        <Figure label="Reads" value={formatNumber(observed.reads)} />
                        <Figure label="Writes" value={formatNumber(observed.writes)} tone={observed.writes > 0 ? 'medium' : 'neutral'} />
                        <Figure label="Regions" value={formatNumber(observed.regions)} />
                        <Figure label="Source IPs" value={formatNumber(observed.sourceIps)} />
                        <Figure label="Relationships" value={formatNumber(node.consumerCount ?? 0)} />
                        <Figure label="Credentials" value={formatNumber(node.credentialCount ?? 0)} />
                      </dl>
                      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
                        {observed.firstSeen ? `First seen ${formatRelative(observed.firstSeen)}, ` : ''}
                        last active {formatRelative(observed.lastActive)}.
                      </p>

                      {observed.topActions.length > 0 && (
                        <>
                          <SectionLabel className="mt-3">Most used actions</SectionLabel>
                          <ul className="mt-1.5 flex flex-col gap-1">
                            {observed.topActions.slice(0, 5).map((action) => (
                              <li key={action.name} className="flex items-baseline justify-between gap-2">
                                <span className="min-w-0 truncate font-mono text-[11px] text-ink-2">{action.name}</span>
                                <span data-numeric="" className="shrink-0 text-[11px] text-ink-3">
                                  {formatNumber(action.count)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}

                  {node.kind !== 'identity' && node.detail && (
                    <p className="text-[11.5px] leading-relaxed text-ink-3">{node.detail}</p>
                  )}
            {!observed && !node.detail && (
              <p className="text-[11.5px] leading-relaxed text-ink-3">
                No behaviour has been recorded against this node. The tabs beside this one carry
                what is known about it.
              </p>
            )}
          </>
        )}

        {activeTab === 'access' && (
          <>
                  {node.kind !== 'identity' && reach && reach.paths > 0 && (
                    <div>
                      <SectionLabel>{reach.fromHere ? 'Reachable from here' : 'On paths that reach'}</SectionLabel>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <RadiusFigure label="Identities on the way" value={reach.identities} tone="neutral" />
                        <RadiusFigure
                          label="Administrator equivalent"
                          value={reach.admins}
                          tone={reach.admins > 0 ? 'critical' : 'neutral'}
                        />
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {reach.crownJewels > 0 && (
                          <Tag tone="critical" size="sm" dot>
                            {formatNumber(reach.crownJewels)} crown jewel
                            {reach.crownJewels === 1 ? '' : 's'}
                          </Tag>
                        )}
                        <Tag tone="neutral" size="sm">
                          {formatNumber(reach.accounts)} account{reach.accounts === 1 ? '' : 's'}
                        </Tag>
                        <Tag tone="neutral" size="sm">
                          {reach.shortestHops} hop{reach.shortestHops === 1 ? '' : 's'} at the shortest
                        </Tag>
                      </div>
                    </div>
                  )}

                  {node.kind === 'identity' && (
                    <div>
                      <SectionLabel>Blast radius</SectionLabel>
                      {!radius ? (
                        <DetailSkeleton rows={3} />
                      ) : (
                        <>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <RadiusFigure label="Its own policies" value={radius.direct.total} tone="neutral" />
                            <RadiusFigure label="After assuming" value={radius.effective.total} tone="critical" />
                          </div>
                          <dl className="mt-2.5 flex flex-col gap-1.5">
                            <Split label="Read" value={radius.effective.read} total={radius.effective.total} tone="info" />
                            <Split label="Write" value={radius.effective.write} total={radius.effective.total} tone="medium" />
                            <Split label="Admin" value={radius.effective.admin} total={radius.effective.total} tone="critical" />
                          </dl>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            <Tag tone="neutral" size="sm">
                              {formatNumber(radius.effective.crownJewels)} crown jewel
                              {radius.effective.crownJewels === 1 ? '' : 's'}
                            </Tag>
                            <Tag tone="neutral" size="sm">
                              {formatNumber(radius.effective.accounts)} account
                              {radius.effective.accounts === 1 ? '' : 's'}
                            </Tag>
                            {radius.adminReached > 0 && (
                              <Tag tone="critical" size="sm" dot>
                                {radius.adminReached} admin reachable
                              </Tag>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            as={Link}
                            to={`/access-graph/${encodeURIComponent(node.id)}`}
                            className="mt-2"
                            iconRight={Radius}
                          >
                            Full access detail
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  <div>
                    <SectionLabel>Connections</SectionLabel>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                      <dt className="text-ink-3">Total</dt>
                      <dd data-numeric="" className="text-right font-semibold text-ink">
                        {formatNumber(node.neighbourCount ?? 0)}
                      </dd>
                      <dt className="text-ink-3">Shown</dt>
                      <dd data-numeric="" className="text-right font-semibold text-ink">
                        {formatNumber((node.neighbourCount ?? 0) - (node.unseenCount ?? 0))}
                      </dd>
                    </dl>
                  </div>

                  {paths.length > 0 && (
                    <div>
                      <SectionLabel>Paths through it</SectionLabel>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {pathsByEnd.slice(0, 4).map((group) => {
                          const meta = severityMeta(group.severity);
                          return (
                            <li key={group.key}>
                              <button
                                type="button"
                                onClick={() => onTrace(group.shortest)}
                                className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-1.5 text-left hover:bg-surface-3"
                              >
                                <Crosshair aria-hidden="true" className="size-3 shrink-0 text-ink-3" />
                                <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">
                                  {group.name}
                                  {group.count > 1 && (
                                    <span data-numeric="" className="ml-1 text-ink-3">
                                      ×{group.count}
                                    </span>
                                  )}
                                </span>
                                <Tag tone={meta.tone} size="sm" dot>
                                  {group.shortest.hops}
                                </Tag>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {pathsByEnd.length > 4 && (
                        <p className="mt-1 px-1.5 text-[11px] text-ink-3">{pathsByEnd.length - 4} more below.</p>
                      )}
                    </div>
                  )}
          </>
        )}

        {activeTab === 'credentials' && <CredentialList credentials={credentials} />}

        {activeTab === 'keys' && (
          <>
                  {(node.accessKeyCount ?? 0) > 0 && (
                    <div>
                      <SectionLabel>Key hygiene</SectionLabel>
                      <dl className="mt-1.5 flex flex-col gap-1 text-[11.5px]">
                        <Row label="Long-lived keys" value={formatNumber(node.accessKeyCount)} />
                        <Row
                          label="Oldest key"
                          value={`${formatNumber(node.accessKeyAgeDays)} days`}
                          warn={node.accessKeyAgeDays > 365}
                        />
                      </dl>
                      {node.accessKeyAgeDays > 365 && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
                          Past a year without rotation. A key this old has usually outlived the person who
                          created it.
                        </p>
                      )}
                    </div>
                  )}
          </>
        )}

        {activeTab === 'trust' && <TrustList trustedBy={trustedBy} reach={reach} />}

        {activeTab === 'behaviour' && <BehaviourPane behaviour={behaviour} nodeId={node.id} />}

        {activeTab === 'events' && <EventsPane observed={observed} />}

        {activeTab === 'policies' && (
          <>
                  {Array.isArray(node.attachedPolicies) && node.attachedPolicies.length > 0 && (
                    <div>
                      <SectionLabel>Attached policies</SectionLabel>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {node.attachedPolicies.map((policy) => (
                          <li key={policy} className="flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className={cn(
                                'size-1.5 shrink-0 rounded-full',
                                policy === 'AdministratorAccess' ? 'bg-critical' : 'bg-line-strong',
                              )}
                            />
                            <span className="min-w-0 truncate font-mono text-[11px] text-ink-2" title={policy}>
                              {policy}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
          </>
        )}

        {activeTab === 'ownership' && (
          <>
                  {(node.ownerName || node.createdByName || node.assignedTo) && (
                    <div>
                      <SectionLabel>Ownership</SectionLabel>
                      <dl className="mt-1.5 flex flex-col gap-1 text-[11.5px]">
                        <Row label="Owner" value={node.ownerName} fallback="Unassigned" warn={!node.ownerName} />
                        <Row label="Created by" value={node.createdByName} />
                        {node.assignedTo && <Row label="Assigned to" value={node.assignedTo} />}
                      </dl>
                    </div>
                  )}
          </>
        )}

        {activeTab === 'why' && (
          <>
                  {/* Why the classifier called it what it called it.
                      A classification nobody can check is a label; the rule that produced
                      it is a claim somebody can argue with. */}
                  {node.evidence && (
                    <div>
                      <SectionLabel>Why it is classified this way</SectionLabel>
                      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2">{node.evidence}</p>
                      {Array.isArray(node.matchedRules) && node.matchedRules.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {node.matchedRules.map((rule) => (
                            <Tag key={rule} tone="neutral" size="sm">
                              {rule.replace(/-/g, ' ')}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
          </>
        )}
      </div>
    </Panel>
  );
}

/**
 * The tab row, wrapping.
 *
 * Not the app's `Tabs`: that one is a single scrolling line with an absolutely
 * positioned sliding indicator, which cannot wrap - so ten labels in a 340px
 * column showed three and hid seven with no affordance to reach them. A
 * wrapping row of pills fits, states the full set of questions the panel can
 * answer, and marks the active one by fill rather than by an underline that
 * would have to know which row it is on.
 *
 * Still a real tablist: `aria-selected`, roving tabindex, and arrow-key
 * movement, because a control that looks like tabs has to behave like them.
 */
function PanelTabs({ tabs, value, onChange }) {
  const onKeyDown = (event) => {
    /* Movement is relative to the FOCUSED tab, not the selected one. Keying
       off selection meant that tabbing to a tab and pressing the arrow jumped
       from wherever the selection happened to be, which is not where the
       reader's attention was. */
    const focused = document.activeElement?.id?.replace('panel-tab-', '');
    const fromFocus = tabs.findIndex((tab) => tab.value === focused);
    const index = fromFocus === -1 ? tabs.findIndex((tab) => tab.value === value) : fromFocus;
    if (index === -1) return;
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].value);
    document.getElementById(`panel-tab-${tabs[next].value}`)?.focus();
  };

  return (
    <div role="tablist" onKeyDown={onKeyDown} className="flex flex-wrap items-center gap-1">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            id={`panel-tab-${tab.value}`}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex items-center gap-1 rounded-full border px-2 py-[3px] text-[11.5px] transition-colors duration-150',
              active
                ? 'border-brand bg-brand font-medium text-white'
                : 'border-line-strong bg-surface text-ink-2 hover:border-ink-3/50 hover:bg-surface-3',
            )}
          >
            {tab.label}
            {tab.count ? (
              <span data-numeric="" className={cn('text-[10.5px]', active ? 'text-white/80' : 'text-ink-3')}>
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The credentials this identity holds.
 *
 * The same records the credential register lists, read from the shared estate
 * rather than summarised - the panel used to show a count and nothing else,
 * which answered "how many" and not the question anybody asks next, which is
 * "how old, and has anything used them".
 */
function CredentialList({ credentials }) {
  if (credentials.length === 0) {
    return (
      <p className="text-[11.5px] leading-relaxed text-ink-3">
        This identity holds no credential of its own. Anything that assumes it gets short-lived
        credentials from STS, which is the arrangement you want.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {credentials.map((credential) => {
        const meta = severityMeta(credential.severity);
        return (
          <li
            key={credential.id}
            className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate font-mono text-[11px] text-ink" title={credential.cred_id}>
                  {credential.cred_id}
                </span>
                <span className="mt-0.5 block text-[10.5px] text-ink-3">
                  {CREDENTIAL_LABEL[credential.type] ?? credential.type}
                </span>
              </span>
              <Tag tone={meta.tone} size="sm" dot>
                {meta.label}
              </Tag>
            </div>
            <dl className="mt-2 flex flex-col gap-1 text-[11px]">
              <Row label="Age" value={`${formatNumber(credential.age_days)} days`} warn={credential.age_days > 365} />
              <Row
                label="Last used"
                value={credential.last_used_date ? formatRelative(credential.last_used_date) : 'Never'}
                warn={credential.last_used_days > 90}
              />
              <Row label="Status" value={credential.status} warn={credential.status !== 'ACTIVE'} />
              {credential.last_used_service && (
                <Row label="Against" value={credential.last_used_service.split('.')[0]} />
              )}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

const CREDENTIAL_LABEL = {
  ACCESS_KEY: 'Long-lived access key',
  SECRET_MANAGER: 'Secrets Manager entry',
  SSM_PARAMETER: 'Parameter Store entry',
  OIDC_TRUST: 'Federated trust, short-lived',
  SERVICE_TOKEN: 'Service token',
};

/**
 * Who can become this identity, and what it reaches once they have.
 *
 * Both halves on one tab because they are one question asked from two ends:
 * an inbound trust is how somebody arrives, and the reach is what arriving
 * gets them.
 */
function TrustList({ trustedBy, reach }) {
  return (
    <>
      <div>
        <SectionLabel>Trusted by</SectionLabel>
        {trustedBy.length === 0 ? (
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
            Nothing in the estate is recorded assuming this identity. Either it authenticates with
            its own credentials, or its trust policy names a principal the discovery has not seen
            used.
          </p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {trustedBy.slice(0, 8).map((trust) => (
              <li
                key={`${trust.name}-${trust.relationship}`}
                className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-2.5 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-[12px] font-medium text-ink" title={trust.name}>
                    {trust.name}
                  </span>
                  {trust.external && (
                    <Tag tone="high" size="sm" dot>
                      External
                    </Tag>
                  )}
                </div>
                <dl className="mt-1 flex flex-col gap-0.5 text-[10.5px]">
                  <Row label="Relationship" value={titleCase(trust.relationship)} />
                  {trust.via && <Row label="Via" value={trust.via} />}
                  <Row label="Sessions" value={formatNumber(trust.sessions)} />
                  <Row label="Last assumed" value={formatRelative(trust.lastAssumed)} />
                  {trust.sourceIp && <Row label="From" value={trust.sourceIp} />}
                </dl>
              </li>
            ))}
          </ul>
        )}
        {trustedBy.length > 8 && (
          <p className="mt-1.5 text-[11px] text-ink-3">{trustedBy.length - 8} more not shown.</p>
        )}
      </div>

      {reach && reach.paths > 0 && (
        <div>
          <SectionLabel>What arriving here reaches</SectionLabel>
          <dl className="mt-2 grid grid-cols-2 gap-1.5">
            <Figure label="Identities on the way" value={formatNumber(reach.identities)} />
            <Figure
              label="Administrator equivalent"
              value={formatNumber(reach.admins)}
              tone={reach.admins > 0 ? 'critical' : 'neutral'}
            />
            <Figure
              label="Crown jewels"
              value={formatNumber(reach.crownJewels)}
              tone={reach.crownJewels > 0 ? 'critical' : 'neutral'}
            />
            <Figure label="Accounts" value={formatNumber(reach.accounts)} />
          </dl>
        </div>
      )}
    </>
  );
}

const titleCase = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());

/**
 * How this identity normally behaves, from the genome's own model.
 *
 * Not a second opinion: the genome screen maintains a baseline for every
 * non-human identity in the estate, and this is the same principal, so this
 * reads that model rather than computing a rival one. A human has no entry -
 * the fleet is machine identities - and gets a statement to that effect rather
 * than an invented baseline.
 */
function BehaviourPane({ behaviour, nodeId }) {
  if (!behaviour) {
    return (
      <p className="text-[11.5px] leading-relaxed text-ink-3">
        No behavioural baseline. Baselines are built for machine identities, whose call patterns
        repeat; a person's do not, so a departure from one would mean nothing.
      </p>
    );
  }

  const learning = behaviour.baselineState === 'learning';

  return (
    <>
      <div>
        <SectionLabel>Baseline</SectionLabel>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Tag tone={learning ? 'medium' : 'low'} size="sm" dot>
            {learning ? `Learning, ${behaviour.learningProgress}%` : 'Established'}
          </Tag>
          <Tag tone="neutral" size="sm">
            {behaviour.runtime}
          </Tag>
        </div>
        {learning ? (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            Needs {behaviour.learningDays} days of activity before a departure means anything. Until
            then nothing here is an anomaly, only an observation.
          </p>
        ) : (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            Established {behaviour.baselineEstablished ? formatRelative(behaviour.baselineEstablished) : 'recently'},
            model confidence {behaviour.modelConfidence}%.
          </p>
        )}

        <dl className="mt-2.5 grid grid-cols-2 gap-1.5">
          <Figure
            label="Drift from baseline"
            value={behaviour.drift.toFixed(2)}
            tone={behaviour.drift > 0.25 ? 'medium' : 'neutral'}
          />
          <Figure
            label="Risk score"
            value={formatNumber(behaviour.riskScore)}
            tone={behaviour.riskScore > 70 ? 'critical' : behaviour.riskScore > 40 ? 'medium' : 'neutral'}
          />
        </dl>
        <p className="mt-1.5 text-[11px] text-ink-3">Compared against {behaviour.peerGroup}.</p>
      </div>

      {behaviour.anomalies.length > 0 && (
        <div>
          <SectionLabel>Open departures</SectionLabel>
          <ul className="mt-1.5 flex flex-col gap-1">
            {behaviour.anomalies.slice(0, 5).map((anomaly) => {
              const meta = severityMeta(anomaly.severity);
              return (
                <li key={anomaly.id} className="flex items-start gap-1.5">
                  <Tag tone={meta.tone} size="sm" dot>
                    {meta.label}
                  </Tag>
                  <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink-2">
                    {anomaly.title}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Button variant="ghost" size="sm" as={Link} to={`/genome/${encodeURIComponent(nodeId)}`}>
        Full behavioural profile
      </Button>
    </>
  );
}

/** What it calls, and what it calls into. */
function EventsPane({ observed }) {
  if (!observed) {
    return <p className="text-[11.5px] text-ink-3">No recorded activity.</p>;
  }

  return (
    <>
      <div>
        <SectionLabel>Most used actions</SectionLabel>
        <ul className="mt-1.5 flex flex-col gap-1">
          {observed.topActions.map((action) => (
            <li key={action.name} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-[11px] text-ink-2">{action.name}</span>
              <span data-numeric="" className="shrink-0 text-[11px] text-ink-3">
                {formatNumber(action.count)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {observed.topServices.length > 0 && (
        <div>
          <SectionLabel>Busiest services</SectionLabel>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {observed.topServices.map((service) => (
              <li key={service.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[11.5px] text-ink-2">
                    {service.name.split('.')[0]}
                  </span>
                  <span data-numeric="" className="shrink-0 text-[11px] text-ink-3">
                    {formatNumber(service.count)}
                  </span>
                </div>
                <Meter
                  className="mt-1"
                  value={service.count}
                  max={observed.topServices[0].count}
                  tone="info"
                  label={`${service.name} call share`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-ink-3">
        Counted from the CloudTrail window the activity screen pages through. Volume is the share of
        this identity&apos;s {formatNumber(observed.eventsSeen)} recorded calls.
      </p>
    </>
  );
}

function RadiusFigure({ label, value, tone }) {
  return (
    <div
      className={`rounded-[var(--radius-control)] border p-2 ${
        tone === 'critical' ? 'border-critical/30 bg-critical-soft' : 'border-line bg-surface-2'
      }`}
    >
      <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{label}</p>
      <p
        data-numeric=""
        className={`mt-1 text-[18px] leading-none font-semibold ${
          tone === 'critical' ? 'text-critical' : 'text-ink'
        }`}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}

function Split({ label, value, total, tone }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
        <dt className="text-ink-3">{label}</dt>
        <dd data-numeric="" className="font-medium text-ink-2">
          {formatNumber(value)}
        </dd>
      </div>
      <Meter className="mt-1" value={value} max={Math.max(1, total)} tone={tone} label={`${label} share`} />
    </div>
  );
}

/**
 * One figure in a metric grid.
 *
 * The label goes under the number rather than beside it: three of these to a
 * row at 340px gives each label about ninety pixels, and a truncated label is
 * worse than a stacked one.
 */
function Figure({ label, value, tone = 'neutral' }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-2 py-1.5">
      <dd
        data-numeric=""
        className={cn(
          'text-[14px] leading-none font-semibold',
          tone === 'critical' ? 'text-critical' : tone === 'medium' ? 'text-medium' : 'text-ink',
        )}
      >
        {value}
      </dd>
      <dt className="mt-1 text-[10px] leading-tight text-ink-3">{label}</dt>
    </div>
  );
}

/** A label and a value on one line, with the missing case called out. */
function Row({ label, value, fallback = '-', warn = false }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right', warn ? 'font-medium text-high' : 'text-ink-2')}>
        {value || fallback}
      </dd>
    </div>
  );
}
