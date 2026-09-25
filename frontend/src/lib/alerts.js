/**
 * Alerts: one queue for every problem any other screen can raise.
 *
 * ── The model, and where it comes from ──────────────────────────────────────
 * The lifecycle is the one incident tooling has converged on, not one invented
 * here:
 *
 *   New           raised, nobody has said they are on it. (PagerDuty calls this
 *                 "triggered"; Sentinel "New".)
 *   Acknowledged  somebody owns it. Acknowledging is what stops escalation -
 *                 it says "a person is on this", not "this is fixed".
 *   In progress   work has started on the fix.
 *   Resolved      fixed at the source.
 *   Dismissed     closed without a fix, with a stated reason. Sentinel makes a
 *                 classification mandatory on close for the same reason this
 *                 does: "closed" alone does not say whether the detection was
 *                 wrong or the risk was accepted, and those two answers mean
 *                 opposite things for the rule that fired.
 *
 * Assignment is separate from status. An alert can be assigned and still New
 * - handed to somebody who has not picked it up yet - and that is exactly the
 * state escalation exists for.
 *
 * ── Escalation ──────────────────────────────────────────────────────────────
 * Three levels, the shape of an escalation policy: the responder the alert was
 * routed to, then the security engineering lead, then the security
 * administrator. Anyone can escalate by hand. Critical alerts also escalate
 * on their own: one that is still New an hour after it was raised moves to
 * level two, the way an unacknowledged high-urgency incident does. That is
 * computed from the alert's own timestamps rather than stored, so it cannot
 * drift - a Critical alert that has sat unacknowledged for an hour is
 * escalated, on every screen, whenever it is looked at.
 *
 * ── Response targets ────────────────────────────────────────────────────────
 * Two clocks per alert, both started when it was raised (or reopened):
 * acknowledge within, and resolve within. The figures are this console's
 * default policy, stated as such - not a regulatory standard.
 */

const HOUR = 3_600_000;

export const ALERT_STATUSES = {
  new: { label: 'New', tone: 'high', open: true },
  acknowledged: { label: 'Acknowledged', tone: 'medium', open: true },
  in_progress: { label: 'In progress', tone: 'info', open: true },
  resolved: { label: 'Resolved', tone: 'low', open: false },
  dismissed: { label: 'Dismissed', tone: 'neutral', open: false },
};

export const ALERT_STATUS_ORDER = ['new', 'acknowledged', 'in_progress', 'resolved', 'dismissed'];

export function alertStatusMeta(value) {
  return ALERT_STATUSES[value] ?? { label: value ? String(value) : 'Unknown', tone: 'neutral', open: true };
}

export function isOpen(alert) {
  return alertStatusMeta(alert?.status).open;
}

/** Where alerts come from - every one of them a screen in this console. */
export const ALERT_SOURCES = {
  identities: { label: 'Identities', to: '/identities' },
  credentials: { label: 'Credentials', to: '/credentials' },
  genome: { label: 'NHI Genome', to: '/genome' },
  exposure: { label: 'Credential exposure', to: '/exposure' },
  integrations: { label: 'Integrations', to: '/integrations' },
};

export const ALERT_SOURCE_ORDER = Object.keys(ALERT_SOURCES);

/** Hours, per severity. The console's default policy. */
export const RESPONSE_TARGETS = {
  CRITICAL: { acknowledge: 1, resolve: 24 },
  HIGH: { acknowledge: 4, resolve: 24 * 7 },
  MEDIUM: { acknowledge: 24, resolve: 24 * 30 },
  LOW: { acknowledge: 72, resolve: 24 * 90 },
};

/** Why an alert was closed without a fix. One is required to dismiss. */
export const DISMISS_REASONS = [
  {
    value: 'accepted_risk',
    label: 'Accepted risk',
    hint: 'Real and understood, and deliberately left as it is.',
  },
  {
    value: 'false_positive',
    label: 'False positive',
    hint: 'The rule fired on something that is not the problem it describes.',
  },
  {
    value: 'expected',
    label: 'Expected behaviour',
    hint: 'Correct as observed - a planned change, a known job.',
  },
  {
    value: 'duplicate',
    label: 'Duplicate',
    hint: 'Already tracked by another alert or ticket.',
  },
];

export function dismissReasonMeta(value) {
  return DISMISS_REASONS.find((entry) => entry.value === value) ?? null;
}

/** The three rungs. Who fills each is supplied with the data. */
export const ESCALATION_LEVELS = [
  { level: 1, label: 'Responder', detail: 'The owner the alert was routed to, or security on-call.' },
  { level: 2, label: 'Security engineering lead', detail: 'Takes anything the responder cannot close in time.' },
  { level: 3, label: 'Security administrator', detail: 'Final level. Decides on accepted risk and exceptions.' },
];

/** Critical alerts still New this long after being raised move up a level. */
export const AUTO_ESCALATION = { severity: 'CRITICAL', afterHours: RESPONSE_TARGETS.CRITICAL.acknowledge, toLevel: 2 };

/**
 * Where an open alert stands against its two clocks.
 *
 *   ack_overdue  still New past the acknowledge target
 *   overdue      past the resolve target
 *   due_soon     inside the last fifth of the resolve window
 *   on_track     everything else
 *   closed       resolved or dismissed - no clock applies
 */
export function responseState(alert, now = Date.now()) {
  const target = RESPONSE_TARGETS[alert?.severity] ?? RESPONSE_TARGETS.LOW;
  const start = Date.parse(alert?.openedAt ?? alert?.createdAt);
  const acknowledgeBy = start + target.acknowledge * HOUR;
  const resolveBy = start + target.resolve * HOUR;
  if (!isOpen(alert)) return { state: 'closed', acknowledgeBy, resolveBy };
  if (now > resolveBy) return { state: 'overdue', acknowledgeBy, resolveBy };
  if (alert.status === 'new' && now > acknowledgeBy) return { state: 'ack_overdue', acknowledgeBy, resolveBy };
  if (resolveBy - now < (resolveBy - start) / 5) return { state: 'due_soon', acknowledgeBy, resolveBy };
  return { state: 'on_track', acknowledgeBy, resolveBy };
}

export const RESPONSE_STATES = {
  overdue: { label: 'Overdue', tone: 'critical' },
  ack_overdue: { label: 'Not acknowledged', tone: 'high' },
  due_soon: { label: 'Due soon', tone: 'medium' },
  on_track: { label: 'On track', tone: 'low' },
  closed: { label: 'Closed', tone: 'neutral' },
};

export const RESPONSE_STATE_ORDER = ['overdue', 'ack_overdue', 'due_soon', 'on_track', 'closed'];

/* A person responding - any of these stops the acknowledge clock, the way an
   on-call tool treats starting work or resolving outright as acknowledging. */
const RESPONSE_KINDS = new Set(['acknowledged', 'started', 'resolved', 'dismissed']);

/**
 * When the alert was first responded to in its current life, or null.
 *
 * Read from the timeline, counting only events since it was last (re)opened,
 * so a reopened alert starts its acknowledge clock again. Genome alerts can be
 * decided on the Genome screen, which records the time on the anomaly, so
 * that is the fallback; a closed alert with neither was answered by closing.
 */
export function acknowledgedAt(alert) {
  const since = Date.parse(alert?.openedAt ?? alert?.createdAt ?? 0) || 0;
  const hit = [...(alert?.activity ?? [])]
    .filter((item) => RESPONSE_KINDS.has(item.kind) && Date.parse(item.at) >= since)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
  if (hit) return hit.at;
  if (alert?.status !== 'new' && alert?.anomalyDecidedAt) return alert.anomalyDecidedAt;
  if (!isOpen(alert) && alert?.closedAt) return alert.closedAt;
  return null;
}

/** "3 hours", "12 days": a length of time in its largest sensible unit. */
export function spanText(ms, { short = false } = {}) {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  const steps = [
    [60, 1, 'minute', 'm'],
    [60 * 24, 60, 'hour', 'h'],
    [Infinity, 60 * 24, 'day', 'd'],
  ];
  for (const [limit, divisor, unit, abbr] of steps) {
    if (minutes < limit) {
      const amount = Math.max(1, Math.round(minutes / divisor));
      return short ? `${amount}${abbr}` : `${amount} ${unit}${amount === 1 ? '' : 's'}`;
    }
  }
  return '';
}

/**
 * An alert with its stored triage applied, and automatic escalation derived.
 *
 * `base` is the alert as raised, including any triage it arrived with.
 * `entry` is what operators have done since, from the store: it replaces the
 * base's status, assignee and level where it sets them, and its activity is
 * appended to the base's. `policy` names who sits at each level.
 */
export function applyTriage(base, entry, policy, now = Date.now()) {
  const merged = {
    ...base,
    status: entry?.status ?? base.status,
    assignee: entry && 'assignee' in entry ? entry.assignee : base.assignee,
    escalationLevel: entry?.escalationLevel ?? base.escalationLevel ?? 1,
    dismissReason: entry?.dismissReason ?? base.dismissReason ?? null,
    openedAt: entry?.openedAt ?? base.openedAt ?? base.createdAt,
    closedAt: entry?.closedAt ?? base.closedAt ?? null,
    activity: [...(base.activity ?? []), ...(entry?.activity ?? [])],
  };

  /* Derived, never stored: see the header. Only while the alert is still New
     and has not already been taken above level one by hand. */
  const escalateAt = Date.parse(merged.openedAt) + AUTO_ESCALATION.afterHours * HOUR;
  if (
    merged.severity === AUTO_ESCALATION.severity &&
    merged.status === 'new' &&
    merged.escalationLevel < AUTO_ESCALATION.toLevel &&
    now > escalateAt
  ) {
    const target = policy?.[AUTO_ESCALATION.toLevel];
    merged.escalationLevel = AUTO_ESCALATION.toLevel;
    merged.autoEscalated = true;
    if (target) merged.assignee = target.user;
    merged.activity = [
      ...merged.activity,
      {
        at: new Date(escalateAt).toISOString(),
        actor: 'Escalation policy',
        kind: 'escalated',
        text: `Escalated to level ${AUTO_ESCALATION.toLevel}${target ? `, ${target.name}` : ''}: not acknowledged within ${AUTO_ESCALATION.afterHours} hour.`,
      },
    ];
  }

  merged.activity.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return merged;
}

/**
 * How the alert reached whoever holds it now: the latest hand-off on its
 * timeline. An analyst's queue shows only their own alerts, so "why is this
 * mine" - routed as owner or on-call, escalated to me, handed over by an
 * admin, or taken myself - is the one thing the assignee column can no longer
 * answer.
 */
export function handoffOf(alert, me) {
  const last = [...(alert?.activity ?? [])]
    .filter((item) => item.kind === 'assigned' || item.kind === 'escalated')
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .pop();
  if (!last) return null;
  if (last.kind === 'escalated') {
    return { kind: 'escalated', at: last.at, label: last.actor === 'Escalation policy' ? 'Auto-escalated' : `Escalated by ${last.actor}` };
  }
  if (last.actor === 'Routing rule') {
    if (/^Reassigned/.test(last.text)) return { kind: 'routed', at: last.at, label: 'Handed back to you' };
    return { kind: 'routed', at: last.at, label: /on-call/.test(last.text) ? 'On-call routing' : 'You own the identity' };
  }
  if (me && last.actorUser === me) return { kind: 'took', at: last.at, label: 'You took it' };
  return { kind: 'assigned', at: last.at, label: `Assigned by ${last.actor}` };
}
