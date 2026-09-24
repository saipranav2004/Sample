import { classificationMeta } from '../../lib/domain';
import {
  daysSince,
  formatDateTime,
  formatNumber,
  formatRelative,
  formatRelativeShort,
} from '../../lib/format';
import { cn, TONE_BG, TONE_FG } from '../../ui/cn';

/**
 * Identity status.
 *
 * Five checks are evaluated, but the table shows one state and one reason in
 * plain words. An earlier revision rendered the checks as five coloured slots;
 * it read well for an expert scanning a long column and badly for everyone
 * else, who had to learn a legend before the column meant anything. A sentence
 * needs no legend.
 *
 * Three states only - Critical, Attention, Healthy - drawn from the reserved
 * status palette, plus Unknown when nothing was recorded. There is no score:
 * the API supplies none, and inventing a weighting would be fabricated
 * analytics that people then act on.
 */
const CHECK_ORDER = ['mfa', 'privilege', 'ownership', 'activity', 'credential'];

export function evaluatePosture(identity) {
  const isHuman = classificationMeta(identity.classification).kind === 'human';
  const age = daysSince(identity.last_active);

  const checks = {
    mfa: !isHuman
      ? { state: 'na', label: 'MFA not applicable' }
      : identity.mfa_enabled
        ? { state: 'pass', label: 'MFA enabled' }
        : { state: 'fail', label: 'MFA disabled' },

    privilege: identity.is_admin
      ? { state: 'fail', label: 'Admin-level access' }
      : { state: 'pass', label: 'No admin policy' },

    ownership:
      String(identity.owner_type).toUpperCase() === 'ORPHANED'
        ? { state: 'fail', label: 'Orphaned - no owner' }
        : identity.owner_name || identity.primary_owner || identity.created_by_name
          ? { state: 'pass', label: 'Owner resolved' }
          : { state: 'warn', label: 'No owner recorded' },

    activity:
      age === null
        ? { state: 'na', label: 'Never active' }
        : age > 90
          ? { state: 'fail', label: `Stale ${formatNumber(age)} days` }
          : age > 45
            ? { state: 'warn', label: `Dormant ${formatNumber(age)} days` }
            : { state: 'pass', label: 'Recently active' },

    /* The credential the actor holds, not where it is stored.
       This check used to flag "credentials in secret store" as a warning,
       which had it backwards: a credential in a managed store with a rotation
       schedule is the good case, and a raw long-lived access key is the bad
       one. It also put a fact about a credential into a judgement about an
       identity. What matters here is what this actor holds - an unrotated
       long-lived key is the thing an attacker wants, and federation is the
       thing that removes it. */
    credential:
      identity.access_key_count > 0 && identity.access_key_age_days > 365
        ? {
            state: 'fail',
            label: `Access key unrotated for ${formatNumber(identity.access_key_age_days)} days`,
          }
        : identity.access_key_count > 0
          ? { state: 'warn', label: `Holds ${formatNumber(identity.access_key_count)} long-lived key${identity.access_key_count === 1 ? '' : 's'}` }
          : identity.is_federated
            ? { state: 'pass', label: 'Federated - no long-lived key' }
            : { state: 'pass', label: 'No long-lived key' },
  };

  const failing = CHECK_ORDER.filter((key) => checks[key].state === 'fail');
  const warning = CHECK_ORDER.filter((key) => checks[key].state === 'warn');
  const unknown = CHECK_ORDER.filter((key) => checks[key].state === 'na');

  const state =
    failing.length > 0
      ? 'critical'
      : warning.length > 0
        ? 'attention'
        : unknown.length === CHECK_ORDER.length
          ? 'unknown'
          : 'healthy';

  const flagged = [...failing, ...warning];

  return {
    checks,
    state,
    failing: failing.length,
    warning: warning.length,
    /* The reason shown in the table is the most severe one; the rest are
       reachable as `+N more` and in the tooltip. */
    leadReason: flagged.length > 0 ? checks[flagged[0]].label : 'All checks clear',
    extra: Math.max(0, flagged.length - 1),
    detail: CHECK_ORDER.map((key) => checks[key].label).join(' · '),
  };
}

const STATE_META = {
  critical: { tone: 'critical', word: 'Critical' },
  attention: { tone: 'medium', word: 'Attention' },
  healthy: { tone: 'low', word: 'Healthy' },
  unknown: { tone: 'neutral', word: 'Unknown' },
};

export function StatusCell({ identity }) {
  const posture = evaluatePosture(identity);
  const meta = STATE_META[posture.state];

  return (
    <span
      className="block min-w-0"
      title={posture.detail}
      aria-label={`${meta.word}. ${posture.detail}`}
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', TONE_BG[meta.tone])} />
        <span className={cn('text-[12.5px] font-semibold', TONE_FG[meta.tone])}>{meta.word}</span>
      </span>
      <span className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
        <span className="min-w-0 truncate text-[11.5px] text-ink-3">{posture.leadReason}</span>
        {posture.extra > 0 && (
          <span
            data-numeric=""
            className="shrink-0 rounded-full bg-surface-3 px-1.5 text-[10.5px] font-semibold text-ink-3"
          >
            +{posture.extra}
          </span>
        )}
      </span>
    </span>
  );
}

/** Full check list, for the record drawer where there is room for all five. */
export function StatusBreakdown({ identity }) {
  const posture = evaluatePosture(identity);
  const rows = CHECK_ORDER.map((key) => ({ key, ...posture.checks[key] }));

  const tone = { fail: 'critical', warn: 'medium', pass: 'low', na: 'neutral' };
  const word = { fail: 'Failing', warn: 'Review', pass: 'Clear', na: 'N/A' };

  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-3 py-2">
          <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', TONE_BG[tone[row.state]])} />
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{row.label}</span>
          <span className={cn('shrink-0 text-[11.5px] font-semibold', TONE_FG[tone[row.state]])}>
            {word[row.state]}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Event volume as a bar against the busiest row in view. A page-local scale,
 * because "is this one busy compared with its peers" is the question a
 * reviewer actually has.
 */
export function ActivityCell({ identity, maxEvents }) {
  const events = Number(identity.total_events) || 0;
  const share = maxEvents > 0 ? Math.max(2, (events / maxEvents) * 100) : 0;
  const age = daysSince(identity.last_active);
  const tone = age === null ? 'bg-line-strong' : age > 90 ? 'bg-high' : age > 45 ? 'bg-medium' : 'bg-brand';

  return (
    <span
      className="block min-w-0"
      title={`Last active ${formatRelative(identity.last_active)} (${formatDateTime(identity.last_active)}) · ${formatNumber(events)} recorded events`}
    >
      <span className="block text-[12.5px] whitespace-nowrap text-ink-2">
        {formatRelativeShort(identity.last_active)}
      </span>
      <span className="mt-1.5 flex items-center gap-2">
        <span className="block h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-track">
          <span
            className={cn(
              'block h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-quint)]',
              tone,
            )}
            style={{ width: `${share}%` }}
          />
        </span>
        <span data-numeric="" className="shrink-0 text-[11px] whitespace-nowrap text-ink-3">
          {formatNumber(events)}
        </span>
      </span>
    </span>
  );
}
