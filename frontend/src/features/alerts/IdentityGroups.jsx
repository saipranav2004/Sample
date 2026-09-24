import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { RESPONSE_STATES, isOpen } from '../../lib/alerts';
import { SEVERITY_ORDER, severityMeta } from '../../lib/domain';
import { formatNumber, formatRelative } from '../../lib/format';
import { Tag } from '../../ui/Tag';
import { cn, TONE_BG } from '../../ui/cn';

/**
 * Group alerts by the thing they are about - an identity, a credential's
 * holder, a repository file - so everything wrong with one identity reads in
 * one place instead of scattered through a list sorted by severity.
 *
 * `alerts` arrive filtered and sorted by priority; a group's rank is the rank
 * of its most urgent alert, so the order still answers "what first".
 */
export function groupByEntity(alerts) {
  const groups = new Map();
  for (const alert of alerts) {
    /* `subject` is the identity an alert is about - the holder, for a
       credential alert. Alerts without one (exposure, connector health) group
       by what they name. */
    const subject = alert.subject ?? {
      key: `${alert.entity?.kind ?? 'Other'}:${alert.entity?.name ?? alert.id}`,
      kind: alert.entity?.kind,
      name: alert.entity?.name,
      detail: alert.entity?.detail,
    };
    const key = subject.key;
    if (!groups.has(key)) {
      groups.set(key, { key, entity: subject, account: alert.account, alerts: [] });
    }
    groups.get(key).alerts.push(alert);
  }
  return [...groups.values()].map((group) => {
    const bySeverity = {};
    for (const alert of group.alerts) bySeverity[alert.severity] = (bySeverity[alert.severity] ?? 0) + 1;
    const top = SEVERITY_ORDER.find((severity) => bySeverity[severity]) ?? group.alerts[0].severity;
    return {
      ...group,
      bySeverity,
      top,
      open: group.alerts.filter(isOpen).length,
      overdue: group.alerts.filter((alert) => ['overdue', 'ack_overdue'].includes(alert.response?.state)).length,
      assignees: [...new Set(group.alerts.map((alert) => alert.assignee).filter(Boolean))],
    };
  });
}

export function IdentityGroups({ groups, peopleByUser, onOpen, operatorUser }) {
  /* The first group starts open, so the view shows what it is for at once. */
  const [expanded, setExpanded] = useState(() => new Set(groups[0] ? [groups[0].key] : []));
  const toggle = (key) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <ul className="divide-y divide-line" aria-label="Alerts grouped by identity">
      {groups.map((group) => {
        const open = expanded.has(group.key);
        const top = severityMeta(group.top);
        const panelId = `group-${group.key.replace(/[^a-z0-9]+/gi, '-')}`;
        return (
          <li key={group.key}>
            <button
              type="button"
              onClick={() => toggle(group.key)}
              aria-expanded={open}
              aria-controls={panelId}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn('size-4 shrink-0 text-ink-3 transition-transform duration-200', open && 'rotate-90')}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-mono text-[13px] font-semibold text-ink">{group.entity?.name ?? 'Unknown'}</span>
                  <Tag tone={top.tone} size="sm" dot>
                    {top.label}
                  </Tag>
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">
                  {group.entity?.kind}
                  {group.entity?.detail ? ` · ${group.entity.detail}` : ''}
                </span>
              </span>
              <span className="hidden shrink-0 flex-wrap items-center justify-end gap-1.5 sm:flex">
                {SEVERITY_ORDER.filter((severity) => group.bySeverity[severity]).map((severity) => (
                  <Tag key={severity} tone={severityMeta(severity).tone} size="sm">
                    {group.bySeverity[severity]} {severityMeta(severity).label.toLowerCase()}
                  </Tag>
                ))}
              </span>
              <span className="w-24 shrink-0 text-right">
                <span className="block text-[13px] font-semibold text-ink" data-numeric="">
                  {formatNumber(group.alerts.length)} alert{group.alerts.length === 1 ? '' : 's'}
                </span>
                {group.overdue > 0 ? (
                  <span className="block text-[11px] font-medium text-critical">{group.overdue} late</span>
                ) : (
                  <span className="block text-[11px] text-ink-3">{group.open} open</span>
                )}
              </span>
            </button>

            {open && (
              <ul id={panelId} className="animate-fade border-t border-line bg-surface-2/50">
                {group.alerts.map((alert) => {
                  const severity = severityMeta(alert.severity);
                  const response = RESPONSE_STATES[alert.response?.state] ?? RESPONSE_STATES.closed;
                  const person = alert.assignee ? peopleByUser.get(alert.assignee) : null;
                  return (
                    <li key={alert.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(alert)}
                        className="flex w-full items-center gap-3 py-2.5 pr-4 pl-11 text-left transition-colors hover:bg-surface-2"
                      >
                        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', TONE_BG[severity.tone] ?? TONE_BG.neutral)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-ink">{alert.title}</span>
                          <span className="block truncate text-[11.5px] text-ink-3">
                            {severity.label}
                            {/* A credential alert says which credential. */}
                            {alert.entity?.kind === 'Credential' ? ` · ${alert.entity.name}` : ''} · raised{' '}
                            {formatRelative(alert.createdAt)} ·{' '}
                            {person ? (person.user === operatorUser ? `${person.name} (you)` : person.name) : 'Unassigned'}
                          </span>
                        </span>
                        <Tag tone={response.tone} size="sm">
                          {response.label}
                        </Tag>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
