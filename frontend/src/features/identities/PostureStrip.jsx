import { HelpCircle } from 'lucide-react';
import { classificationMeta } from '../../lib/domain';
import { daysSince, formatDateTime, formatNumber, formatRelative, formatRelativeShort } from '../../lib/format';
import { cn } from '../../ui/cn';

/**
 * Posture fingerprint.
 *
 * Five checks in a fixed order, one slot each. Because the slots never move,
 * a column of these reads vertically: an operator sees at a glance that column
 * two is red down the page and knows privilege is the systemic problem — which
 * is impossible with a variable-length list of tags.
 *
 * Every slot maps to fields the API returns. Nothing is scored or weighted;
 * "2 issues" is a count of failing checks, not an invented risk number.
 */
const SLOT_ORDER = ['mfa', 'privilege', 'ownership', 'activity', 'secret'];

const SLOT_LABELS = {
  mfa: 'MFA',
  privilege: 'Privilege',
  ownership: 'Ownership',
  activity: 'Activity',
  secret: 'Secret store',
};

const STATE_STYLE = {
  fail: 'bg-critical',
  warn: 'bg-medium',
  pass: 'bg-low/55',
  na: 'bg-line-strong/70',
};

const STATE_WORD = {
  fail: 'failing',
  warn: 'attention',
  pass: 'clear',
  na: 'not applicable',
};

/** Evaluates the five checks for one identity. */
export function evaluatePosture(identity) {
  const isHuman = classificationMeta(identity.classification).kind === 'human';
  const age = daysSince(identity.last_active);

  const mfa = !isHuman
    ? { state: 'na', detail: 'MFA does not apply to a non-human identity' }
    : identity.mfa_enabled
      ? { state: 'pass', detail: 'MFA enabled' }
      : { state: 'fail', detail: 'MFA disabled on a console identity' };

  const privilege = identity.is_admin
    ? { state: 'fail', detail: 'Administrator-equivalent policy attached' }
    : { state: 'pass', detail: 'No administrator-equivalent policy recorded' };

  const orphaned = String(identity.owner_type).toUpperCase() === 'ORPHANED';
  const owner = identity.owner_name || identity.primary_owner || identity.created_by_name;
  const ownership = orphaned
    ? { state: 'fail', detail: 'Orphaned — no owner could be resolved' }
    : owner
      ? { state: 'pass', detail: `Owned by ${owner}` }
      : { state: 'warn', detail: 'No owner recorded on this identity' };

  const activity =
    age === null
      ? { state: 'na', detail: 'No activity has ever been recorded' }
      : age > 90
        ? { state: 'fail', detail: `Stale — last active ${formatRelative(identity.last_active)}` }
        : age > 30
          ? { state: 'warn', detail: `Dormant — last active ${formatRelative(identity.last_active)}` }
          : { state: 'pass', detail: `Active ${formatRelative(identity.last_active)}` };

  const secret = identity.is_secret
    ? { state: 'warn', detail: 'Credentials held in a secret store entry' }
    : { state: 'pass', detail: 'No secret store entry recorded' };

  const slots = { mfa, privilege, ownership, activity, secret };
  const issues = SLOT_ORDER.filter((key) => slots[key].state === 'fail').length;
  const warnings = SLOT_ORDER.filter((key) => slots[key].state === 'warn').length;

  return { slots, issues, warnings };
}

export function PostureStrip({ identity, size = 'md' }) {
  const { slots, issues, warnings } = evaluatePosture(identity);

  const summary = SLOT_ORDER.map(
    (key) => `${SLOT_LABELS[key]}: ${STATE_WORD[slots[key].state]} — ${slots[key].detail}`,
  ).join('\n');

  const height = size === 'sm' ? 'h-3' : 'h-4';

  return (
    <span className="flex items-center gap-2" title={summary}>
      <span
        className="flex items-center gap-[3px]"
        role="img"
        aria-label={`Posture checks — ${summary.replace(/\n/g, '; ')}`}
      >
        {SLOT_ORDER.map((key) => (
          <span
            key={key}
            className={cn(
              'w-[5px] rounded-full transition-[transform,filter] duration-150 group-hover:brightness-110',
              height,
              STATE_STYLE[slots[key].state],
            )}
          />
        ))}
      </span>

      {issues > 0 ? (
        <span
          data-numeric=""
          className="rounded-full border border-critical/25 bg-critical-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-critical"
        >
          {issues} issue{issues === 1 ? '' : 's'}
        </span>
      ) : warnings > 0 ? (
        <span
          data-numeric=""
          className="rounded-full border border-medium/25 bg-medium-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-medium"
        >
          {warnings} to review
        </span>
      ) : (
        <span className="text-[11px] font-medium text-low">Clear</span>
      )}
    </span>
  );
}

/** Column-header legend so the strip is self-explanatory without a manual. */
export function PostureLegend() {
  return (
    <span className="inline-flex items-center gap-1.5">
      Posture
      <span
        className="cursor-help text-ink-3/80"
        title={`Five checks, always in this order:\n${SLOT_ORDER.map(
          (key, index) => `${index + 1}. ${SLOT_LABELS[key]}`,
        ).join('\n')}\n\nRed = failing · amber = needs review · green = clear · grey = not applicable`}
      >
        <HelpCircle aria-hidden="true" className="size-3" />
        <span className="sr-only">
          Five posture checks in fixed order: MFA, privilege, ownership, activity, secret store.
        </span>
      </span>
    </span>
  );
}

/**
 * Event volume as a proportional bar against the largest value on the page.
 * Relative scale only — it answers "is this one busy compared with its peers",
 * which is the question a reviewer actually has.
 */
export function ActivityCell({ identity, maxEvents }) {
  const events = Number(identity.total_events) || 0;
  const share = maxEvents > 0 ? Math.max(2, (events / maxEvents) * 100) : 0;
  const age = daysSince(identity.last_active);
  const tone = age === null ? 'bg-line-strong' : age > 90 ? 'bg-high' : age > 30 ? 'bg-medium' : 'bg-brand';

  return (
    <span
      className="block min-w-0"
      title={`Last active ${formatRelative(identity.last_active)} (${formatDateTime(identity.last_active)}) · ${formatNumber(events)} recorded events`}
    >
      <span className="block text-[12.5px] whitespace-nowrap text-ink-2">
        {formatRelativeShort(identity.last_active)}
      </span>
      <span className="mt-1.5 flex items-center gap-2">
        <span className="block h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3">
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
