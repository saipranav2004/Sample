import { useMemo, useState } from 'react';
import { ChevronDown, Route, ShieldCheck } from 'lucide-react';
import { EDGE_KINDS, escalationById } from '../../lib/demo/accessGraph';
import { severityMeta, SEVERITY_ORDER } from '../../lib/domain';
import { Button } from '../../ui/Button';
import { Panel, PanelHeader } from '../../ui/Panel';
import { SegmentedControl } from '../../ui/Tabs';
import { ListSkeleton } from '../../ui/Skeleton';
import { EmptyState, ErrorState } from '../../ui/States';
import { Tag } from '../../ui/Tag';
import { cn } from '../../ui/cn';

/**
 * Attack paths, as rows that open.
 *
 * Not a table. A path is a sequence, and a table forces a sequence into one
 * cell where it gets truncated - which is how the last version ended up
 * showing "token.actions.githubusercontent.com → session-reaper-146 → ..." and
 * telling nobody anything. A row here is one line closed, and the sequence
 * when opened, which is the shape of the data rather than the shape of a grid.
 *
 * Severity says what it reaches; the hop count says how far away it is. Those
 * two are the whole triage decision, so they are the only two figures on the
 * closed row.
 */
export function PathList({ rows, loading, error, tracedId, onTrace, onRetry }) {
  const [severity, setSeverity] = useState('');
  const [openId, setOpenId] = useState('');

  const filtered = useMemo(
    () => (severity ? rows.filter((row) => row.severity === severity) : rows),
    [rows, severity],
  );

  const counts = useMemo(() => {
    const out = {};
    for (const row of rows) out[row.severity] = (out[row.severity] ?? 0) + 1;
    return out;
  }, [rows]);

  return (
    <Panel prominence="default" className="animate-rise @container">
      <PanelHeader
        title="Attack paths"
        actions={
          <SegmentedControl
            label="Severity"
            options={[
              { value: '', label: `All ${rows.length}` },
              ...SEVERITY_ORDER.filter((key) => counts[key]).map((key) => ({
                value: key,
                label: `${severityMeta(key).label} ${counts[key]}`,
              })),
            ]}
            value={severity}
            onChange={setSeverity}
          />
        }
      />

      {error ? (
        <ErrorState className="mt-3" error={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="mt-3">
          <ListSkeleton rows={4} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={ShieldCheck}
          title={severity ? 'None at that severity' : 'Nothing reachable ends anywhere that matters'}
          description={
            severity
              ? 'Clear the filter to see the rest.'
              : 'No entry point leads to an administrator-equivalent identity or to write access on a crown jewel.'
          }
        />
      ) : (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {filtered.map((path, index) => (
            <PathRow
              key={path.id}
              path={path}
              index={index}
              open={openId === path.id}
              traced={tracedId === path.id}
              onToggle={() => setOpenId(openId === path.id ? '' : path.id)}
              onTrace={() => onTrace(path)}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function PathRow({ path, index, open, traced, onToggle, onTrace }) {
  const meta = severityMeta(path.severity);

  return (
    <li
      className={cn(
        'animate-rise overflow-hidden rounded-[var(--radius-control)] border transition-colors duration-150',
        traced ? 'border-brand/50 bg-info-soft' : 'border-line bg-surface-2 hover:border-line-strong',
      )}
      data-stagger=""
      style={{ '--stagger': Math.min(index, 5) }}
    >
      {/* Stacked while there is no room for both, side by side once there is.
          Flex-wrap alone put the meta cluster on the first line and squeezed
          the route to nothing, which at phone width left rows showing a hop
          count and no names at all. */}
      <div className="flex flex-col gap-2 px-3 py-2.5 @min-[34rem]:flex-row @min-[34rem]:items-center @min-[34rem]:gap-x-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-2.5 text-left @min-[34rem]:flex-1"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn('size-3.5 shrink-0 text-ink-3 transition-transform duration-200', open && 'rotate-0', !open && '-rotate-90')}
          />
          {/* Wraps rather than truncates. The target is the whole point of the
              row - "Third-party account trust -> entitle..." names the thing
              the reader already knew and hides the thing they came for. Two
              lines only happen at phone width; there is room for one above it. */}
          <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink line-clamp-2">
            <span className="font-semibold">{path.entryName}</span>
            <span aria-hidden="true" className="mx-1.5 text-ink-3">
              →
            </span>
            <span className="font-semibold">{path.targetName}</span>
          </span>
        </button>

        <span className="flex shrink-0 flex-wrap items-center gap-2 pl-6 @min-[34rem]:pl-0">
          <span data-numeric="" className="text-[11.5px] text-ink-3">
            {path.hops} hop{path.hops === 1 ? '' : 's'}
          </span>
          {path.escalationCount > 0 && (
            <Tag tone="critical" size="sm">
              {path.escalationCount} escalation{path.escalationCount === 1 ? '' : 's'}
            </Tag>
          )}
          <Tag tone={meta.tone} size="sm" dot>
            {meta.label}
          </Tag>
          <Button variant={traced ? 'primary' : 'secondary'} size="sm" icon={Route} onClick={onTrace}>
            {traced ? 'Tracing' : 'Trace'}
          </Button>
        </span>
      </div>

      {open && (
        <div className="animate-fade border-t border-line px-3 py-3">
          <ol className="flex flex-col">
            <Step index={0} label={path.entryName} kind="entry" first />
            {path.steps.map((step, stepIndex) => (
              <Step
                key={step.edgeId}
                index={stepIndex + 1}
                label={step.toName}
                kind={step.kind}
                method={step.method ? escalationById(step.method) : null}
                last={stepIndex === path.steps.length - 1}
              />
            ))}
          </ol>
        </div>
      )}
    </li>
  );
}

/**
 * One step.
 *
 * The edge label says how the step was taken; where it is an escalation the
 * permission combination is named, because "privilege escalation possible" is
 * a claim nobody can check and `iam:PassRole + lambda:CreateFunction` is one
 * anybody can.
 */
function Step({ index, label, kind, method, first, last }) {
  const meta = EDGE_KINDS[kind];

  return (
    <li className={cn('relative flex gap-2.5 pl-1', last ? '' : 'pb-2.5')}>
      <span className="relative flex shrink-0 flex-col items-center">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-4 shrink-0 place-items-center rounded-full border text-[8.5px] font-bold',
            meta?.escalation
              ? 'border-critical/45 bg-critical-soft text-critical'
              : 'border-line-strong bg-surface text-ink-3',
          )}
        >
          {index}
        </span>
        {!last && <span aria-hidden="true" className="mt-0.5 w-px flex-1 bg-line" />}
      </span>

      <span className="min-w-0 flex-1 pb-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          {!first && meta && (
            <Tag tone={meta.tone} size="sm">
              {meta.label}
            </Tag>
          )}
          <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">{label}</span>
        </span>
        {method && (
          <span className="mt-1 block font-mono text-[10.5px] leading-relaxed break-words text-ink-2">
            {method.permissions.join(' + ')}
          </span>
        )}
      </span>
    </li>
  );
}
