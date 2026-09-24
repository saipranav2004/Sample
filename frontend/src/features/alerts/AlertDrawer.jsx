import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpCircle,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Hand,
  MessageSquare,
  Play,
  RotateCcw,
  UserRound,
  XCircle,
} from 'lucide-react';
import {
  ALERT_SOURCES,
  DISMISS_REASONS,
  ESCALATION_LEVELS,
  RESPONSE_STATES,
  alertStatusMeta,
  dismissReasonMeta,
  acknowledgedAt,
  isOpen,
  responseState,
  spanText,
} from '../../lib/alerts';
import { severityMeta } from '../../lib/domain';
import { formatDateTime, formatRelative, initialsOf } from '../../lib/format';
import { useAccess } from '../../app/useAccess';
import { Button } from '../../ui/Button';
import { Field, Select, Textarea } from '../../ui/Field';
import { Drawer } from '../../ui/Overlay';
import { DetailList, DetailRow, SectionLabel } from '../../ui/Panel';
import { Tag } from '../../ui/Tag';
import { cn } from '../../ui/cn';

const ACTIVITY_ICON = {
  created: CircleDot,
  assigned: UserRound,
  acknowledged: Hand,
  started: Play,
  escalated: ArrowUpCircle,
  resolved: CheckCircle2,
  dismissed: XCircle,
  reopened: RotateCcw,
  comment: MessageSquare,
};

/**
 * One alert, and everything that can be done to it.
 *
 * Read top to bottom the way a responder works it: what happened, why it
 * matters, what to do, the evidence - then who has it, how far it has
 * escalated, and where it stands against its response targets - then the
 * history. The actions live in the footer so they stay in reach however far
 * down the reader has scrolled.
 *
 * Resolve, dismiss and escalate open an inline confirmation rather than a
 * dialog. This panel already traps focus; a dialog on top of it would trap it
 * again, and two traps fight over the Tab key.
 */
export function AlertDrawer({ alert, people, policy, operatorUser, busy, onClose, onAction, now }) {
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const { can, lock } = useAccess();

  if (!alert) return null;

  const severity = severityMeta(alert.severity);
  const status = alertStatusMeta(alert.status);
  /* The page computes the clock once a minute and hands it down, so the
     drawer and the list never disagree about what is overdue. */
  const response = alert.response ?? responseState(alert, now);
  const ackAt = acknowledgedAt(alert);
  const responseMeta = RESPONSE_STATES[response.state];
  const open = isOpen(alert);
  const level = alert.escalationLevel ?? 1;
  const next = policy?.[level + 1];
  const peopleByUser = new Map(people.map((person) => [person.user, person]));
  const assignee = alert.assignee ? peopleByUser.get(alert.assignee) : null;
  const source = ALERT_SOURCES[alert.source];
  const isExposure = alert.source === 'exposure';
  /* Closing or reopening an exposure alert writes the scanner's allowlist,
     which is the exposure-review permission on top of the alert one. */
  const closeLock = (permission) => lock(permission) ?? (isExposure ? lock('exposure.review') : undefined);

  const reset = () => {
    setPending(null);
    setReason('');
    setNote('');
  };

  const confirm = async () => {
    const ok = await onAction([alert], pending, { reason: reason || null, note });
    if (ok) reset();
  };

  const footer = open ? (
    <>
      {alert.status === 'new' && (
        <Button variant="secondary" icon={Hand} onClick={() => onAction([alert], 'acknowledge')} disabled={busy} locked={lock('alerts.work')}>
          Acknowledge
        </Button>
      )}
      {alert.status !== 'in_progress' && (
        <Button variant="secondary" icon={Play} onClick={() => onAction([alert], 'start')} disabled={busy} locked={lock('alerts.work')}>
          Start work
        </Button>
      )}
      <Button variant="secondary" icon={XCircle} onClick={() => setPending('dismiss')} disabled={busy} locked={closeLock('alerts.dismiss')}>
        Dismiss
      </Button>
      <Button variant="primary" icon={CheckCircle2} onClick={() => setPending('resolve')} disabled={busy} locked={closeLock('alerts.work')}>
        Resolve
      </Button>
    </>
  ) : (
    <Button variant="secondary" icon={RotateCcw} onClick={() => onAction([alert], 'reopen')} loading={busy} locked={closeLock('alerts.dismiss')}>
      Reopen
    </Button>
  );

  return (
    <Drawer
      open={Boolean(alert)}
      onClose={() => {
        reset();
        onClose();
      }}
      width="lg"
      eyebrow={`${source?.label ?? alert.source} · ${alert.entity?.kind ?? 'Alert'}`}
      title={alert.title}
      header={
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Tag tone={severity.tone} size="sm" dot>
            {severity.label}
          </Tag>
          <Tag tone={status.tone} size="sm">
            {status.label}
            {alert.status === 'dismissed' && alert.dismissReason
              ? ` - ${dismissReasonMeta(alert.dismissReason)?.label ?? alert.dismissReason}`
              : ''}
          </Tag>
          {open && (
            <Tag tone={responseMeta.tone} size="sm">
              {responseMeta.label}
            </Tag>
          )}
          {level >= 2 && (
            <Tag tone="high" size="sm" icon={ArrowUpCircle}>
              Escalated to level {level}
            </Tag>
          )}
        </div>
      }
      footer={footer}
    >
      <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
        {pending && (
          <ConfirmPanel
            action={pending}
            alert={alert}
            next={next}
            reason={reason}
            onReason={setReason}
            note={note}
            onNote={setNote}
            busy={busy}
            onCancel={reset}
            onConfirm={confirm}
          />
        )}

        <div className="flex flex-col gap-3">
          <Block label="What happened">{alert.summary}</Block>
          <Block label="Why it matters">{alert.impact}</Block>
          <Block label="What to do" emphasis>
            {alert.recommendation}
          </Block>
        </div>

        {alert.evidence?.length > 0 && (
          <div>
            <SectionLabel>Evidence</SectionLabel>
            <DetailList className="mt-1">
              {alert.evidence.map((item) => (
                <DetailRow key={item.label} label={item.label}>
                  <span className="break-words">{item.value}</span>
                </DetailRow>
              ))}
            </DetailList>
          </div>
        )}

        {alert.entity && (
          <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5">
            <SectionLabel>{alert.entity.kind}</SectionLabel>
            <p className="mt-1 truncate font-mono text-[12.5px] text-ink" title={alert.entity.name}>
              {alert.entity.name}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-3">{alert.entity.detail}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button as={Link} to={alert.entity.to} variant="secondary" size="sm" iconRight={ExternalLink}>
                {alert.entity.linkLabel}
              </Button>
              {/* The score impact of what this alert is about, and the fix. */}
              {alert.identityId && (
                <Button
                  as={Link}
                  to={`/identities/${encodeURIComponent(alert.identityId)}?tab=posture`}
                  variant="ghost"
                  size="sm"
                  iconRight={ExternalLink}
                >
                  Posture and fixes
                </Button>
              )}
              {alert.entity.externalHref && (
                <Button
                  as="a"
                  href={alert.entity.externalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="ghost"
                  size="sm"
                  iconRight={ExternalLink}
                >
                  {alert.entity.externalLabel}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Ownership, escalation and the clock - the triage state. */}
        <div className="grid gap-3 @min-[34rem]:grid-cols-2">
          <div className="rounded-[var(--radius-control)] border border-line bg-surface p-3.5">
            <SectionLabel>Assigned to</SectionLabel>
            <div className="mt-2 flex items-center gap-2">
              <Avatar person={assignee} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {assignee?.name ?? 'Unassigned'}
                </span>
                <span className="block truncate text-[11.5px] text-ink-3">
                  {assignee?.team ?? 'Nobody owns this yet'}
                </span>
              </span>
            </div>
            {open && (can('alerts.assign') || can('alerts.take')) && (
              <div className="mt-3 flex flex-col gap-2">
                {can('alerts.assign') ? (
                <Select
                  size="sm"
                  aria-label="Assign to"
                  value={alert.assignee ?? ''}
                  placeholder="Unassigned"
                  options={people.map((person) => ({
                    value: person.user,
                    label: `${person.name} - ${person.team}`,
                  }))}
                  onChange={(event) => onAction([alert], 'assign', { assignee: event.target.value || null })}
                  disabled={busy}
                />
                ) : (
                  <p className="text-[11.5px] leading-relaxed text-ink-3">
                    Reassigning to someone else needs the Admin role. You can take it yourself.
                  </p>
                )}
                {alert.assignee !== operatorUser && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => onAction([alert], 'assign', { assignee: operatorUser })}
                    disabled={busy}
                  >
                    Assign to me
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-[var(--radius-control)] border border-line bg-surface p-3.5">
            <SectionLabel>Escalation</SectionLabel>
            <ol className="mt-2 flex flex-col gap-1.5">
              {ESCALATION_LEVELS.map((entry) => {
                /* Level one is whoever the alert was routed to - the owner, or
                   on-call when there is none - so while it sits at level one
                   the row names the current assignee, not on-call regardless. */
                const person = entry.level === 1 && level === 1 && assignee ? assignee : policy?.[entry.level];
                const current = entry.level === level;
                const passed = entry.level < level;
                return (
                  <li key={entry.level} className="flex items-center gap-2 text-[12px]">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-full border text-[10.5px] font-semibold',
                        current
                          ? 'border-brand bg-brand text-white'
                          : passed
                            ? 'border-line-strong bg-surface-3 text-ink-3'
                            : 'border-line bg-surface text-ink-3',
                      )}
                      data-numeric=""
                    >
                      {entry.level}
                    </span>
                    <span className={cn('min-w-0 truncate', current ? 'font-semibold text-ink' : 'text-ink-3')}>
                      {entry.label}
                      {person ? ` - ${person.name}` : ''}
                    </span>
                    {current && <span className="sr-only">(current level)</span>}
                  </li>
                );
              })}
            </ol>
            {open && (
              <Button
                variant="secondary"
                size="sm"
                icon={ArrowUpCircle}
                className="mt-3"
                onClick={() => setPending('escalate')}
                disabled={busy || !next}
                locked={next ? lock('alerts.work') : undefined}
              >
                {next ? `Escalate to ${next.name}` : 'At the final level'}
              </Button>
            )}
            {alert.autoEscalated && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
                Escalated automatically: Critical and not acknowledged within an hour.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[var(--radius-control)] border border-line bg-surface p-3.5">
          <SectionLabel>Response targets</SectionLabel>
          <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-[12px] @min-[30rem]:grid-cols-3">
            <div>
              <dt className="text-ink-3">Raised</dt>
              <dd className="font-medium text-ink-2" title={formatDateTime(alert.createdAt)}>
                {formatRelative(alert.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-3">{ackAt ? 'Acknowledged' : 'Acknowledge by'}</dt>
              <Deadline
                at={ackAt}
                now={now}
                due={response.acknowledgeBy}
                open={open && !ackAt}
                lateTone="text-high"
                missing={alert.status !== 'new' ? 'Time not recorded' : null}
              />
            </div>
            <div>
              <dt className="text-ink-3">{open ? 'Resolve by' : alert.status === 'dismissed' ? 'Dismissed' : 'Resolved'}</dt>
              <Deadline at={open ? null : alert.closedAt} now={now} due={response.resolveBy} open={open} lateTone="text-critical" />
            </div>
          </dl>
        </div>

        <div>
          <SectionLabel>Activity</SectionLabel>
          <ol className="mt-2 flex flex-col">
            {[...alert.activity].reverse().map((item, index) => {
              const Icon = ACTIVITY_ICON[item.kind] ?? CircleDot;
              return (
                <li key={`${item.at}-${index}`} className="relative flex gap-2.5 pb-3 last:pb-0">
                  <span
                    aria-hidden="true"
                    className="relative z-[1] mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-ink-3"
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] leading-relaxed text-ink-2">
                      <span className="font-medium text-ink">{item.actor}</span>{' '}
                      {item.kind === 'comment' ? 'noted:' : ''} {item.text}
                    </span>
                    <span className="block text-[11px] text-ink-3" title={formatDateTime(item.at)}>
                      {formatRelative(item.at)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          {can('alerts.work') ? (
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const ok = await onAction([alert], 'comment', { note: comment });
              if (ok) setComment('');
            }}
          >
            <Textarea
              aria-label="Add a note"
              rows={2}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a note for whoever picks this up next…"
              maxLength={500}
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              icon={MessageSquare}
              className="self-start"
              disabled={busy || !comment.trim()}
            >
              Add note
            </Button>
          </form>
          ) : (
            <p className="mt-3 text-[12px] text-ink-3">Your role can read this timeline but not add to it.</p>
          )}
        </div>

        {isExposure && (
          <p className="text-[11.5px] leading-relaxed text-ink-3">
            Resolving or dismissing this alert adds the finding to the Secret Scanner allowlist, the same
            write as Mark safe on Exposed credentials, and it moves to the Accepted view there.
          </p>
        )}
      </div>
    </Drawer>
  );
}

function Block({ label, children, emphasis = false }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-control)] border p-3.5',
        emphasis ? 'border-brand/30 bg-info-soft' : 'border-line bg-surface-2',
      )}
    >
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

export function Avatar({ person, size = 'md' }) {
  const box = size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-[11.5px]';
  if (!person) {
    return (
      <span
        aria-hidden="true"
        className={cn('grid shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-ink-3', box)}
      >
        <UserRound className="size-3.5" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-surface-3 font-semibold text-ink-2',
        box,
      )}
    >
      {initialsOf(person.name)}
    </span>
  );
}

/**
 * The confirmation for the three actions that need more than a click.
 *
 * Dismiss requires a reason - a closed alert with no reason cannot tell anyone
 * later whether the rule was wrong or the risk was accepted. Resolve and
 * escalate take an optional note, which lands in the activity log.
 */
function ConfirmPanel({ action, alert, next, reason, onReason, note, onNote, busy, onCancel, onConfirm }) {
  const isExposure = alert.source === 'exposure';
  const copy = {
    resolve: {
      title: 'Resolve this alert',
      body: isExposure
        ? 'Confirms the secret has been rotated at its source. The finding is added to the scanner allowlist with this note as its reason.'
        : 'Confirms the problem is fixed at its source. If the condition is still there at the next discovery run, the alert reopens.',
      button: 'Resolve',
    },
    dismiss: {
      title: 'Dismiss this alert',
      body: isExposure
        ? 'Closes it without a fix. The finding is added to the scanner allowlist with the reason below.'
        : 'Closes it without a fix. Say why, so whoever reviews it later knows whether the rule or the risk was the problem.',
      button: 'Dismiss',
    },
    escalate: {
      title: next ? `Escalate to ${next.name}` : 'Escalate',
      body: next
        ? `Moves the alert to level ${alert.escalationLevel + 1} and assigns it to ${next.name}, ${next.role}. Say what you need from them.`
        : 'This alert is already at the final level.',
      button: 'Escalate',
    },
  }[action];

  const needsReason = action === 'dismiss';

  return (
    <div className="animate-fade rounded-[var(--radius-control)] border border-medium/30 bg-medium-soft p-3.5">
      <p className="text-[13px] font-semibold text-ink">{copy.title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{copy.body}</p>

      {needsReason && (
        <fieldset className="mt-3">
          <legend className="text-[12px] font-medium text-ink-2">Reason</legend>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {DISMISS_REASONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border px-3 py-2 transition-colors',
                  reason === option.value ? 'border-brand bg-surface' : 'border-line bg-surface hover:border-line-strong',
                )}
              >
                <input
                  type="radio"
                  name="dismiss-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => onReason(option.value)}
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
      )}

      <Field className="mt-3" label="Note (optional)" htmlFor="alert-action-note">
        <Textarea
          id="alert-action-note"
          rows={2}
          value={note}
          onChange={(event) => onNote(event.target.value)}
          maxLength={300}
          placeholder={action === 'escalate' ? 'What do you need from them?' : 'What was done, and where?'}
        />
      </Field>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onConfirm}
          loading={busy}
          disabled={(needsReason && !reason) || (action === 'escalate' && !next)}
        >
          {copy.button}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * One response clock. Before it is met: the deadline, as "in 3 hours" or
 * "Overdue by 12 days" - a missed deadline is lateness, not history, so it
 * never reads "12 days ago". After it is met: when, and whether that was
 * within the target or how late.
 */
function Deadline({ at, due, open, lateTone, now, missing = null }) {
  if (at) {
    const late = Date.parse(at) - due;
    return (
      <dd className="font-medium text-ink-2">
        <span title={formatDateTime(at)}>{formatRelative(at)}</span>
        <span className={cn('block text-[11.5px] font-normal', late > 0 ? lateTone : 'text-low')}>
          {late > 0 ? `${spanText(late)} past the target` : 'Within the target'}
        </span>
      </dd>
    );
  }
  if (!open) {
    return <dd className="font-medium text-ink-3">{missing ?? 'Not recorded'}</dd>;
  }
  const overdue = now > due;
  return (
    <dd className={cn('font-medium', overdue ? lateTone : 'text-ink-2')} title={formatDateTime(new Date(due))}>
      {overdue ? `Overdue by ${spanText(now - due)}` : formatRelative(new Date(due))}
      <span className="block text-[11.5px] font-normal text-ink-3">{formatDateTime(new Date(due))}</span>
    </dd>
  );
}
