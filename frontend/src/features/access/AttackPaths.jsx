import { useMemo, useState } from 'react';
import { ChevronDown, Route, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { EDGE_KINDS } from '../../lib/demo/accessGraph';
import { severityMeta } from '../../lib/domain';
import { formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Panel, PanelHeader, SectionLabel } from '../../ui/Panel';
import { ListSkeleton } from '../../ui/Skeleton';
import { EmptyState, ErrorState } from '../../ui/States';
import { Tag } from '../../ui/Tag';
import { cn } from '../../ui/cn';

/**
 * Attack paths, grouped into findings.
 *
 * The previous version of this listed every path the analysis found: twenty-six
 * rows, most of them reading "Unconditioned OIDC trust -> something". That is a
 * query result rather than a piece of analysis. The reader had to notice for
 * themselves that six of those rows were the same mistake made six times, and
 * no row said what to do about any of it.
 *
 * Every enterprise tool that does this well groups first and counts second, and
 * the reason is not presentational: the group is the unit of work, because one
 * fix closes all of its instances. So a row here is a finding - a technique, or
 * a grant - carrying how many paths it accounts for, how much of the perimeter
 * it is reachable from, how much of the estate it touches, and, when it is
 * opened, the exact permission combination behind it and how to stop it.
 *
 * The instances are still there, one level down, because eventually somebody has
 * to go and look at one.
 */
export function AttackPaths({
  data,
  loading,
  error,
  filters,
  onFilter,
  tracedId,
  onTrace,
  onRetry,
}) {
  const [openKey, setOpenKey] = useState('');
  const findings = data?.findings ?? [];
  const options = data?.options;

  const active = useMemo(
    () => Object.entries(filters).filter(([, value]) => Boolean(value)),
    [filters],
  );

  return (
    <Panel prominence="default" className="animate-rise @container">
      <PanelHeader
        title="Attack paths"
        subtitle={
          data
            ? `${formatNumber(findings.length)} finding${findings.length === 1 ? '' : 's'} across ${formatNumber(data.matched)} path${data.matched === 1 ? '' : 's'}`
            : undefined
        }
        actions={
          active.length > 0 && (
            <Button variant="ghost" size="sm" icon={X} onClick={() => onFilter({ severity: '', account: '', vector: '', reach: '' })}>
              Clear {active.length} filter{active.length === 1 ? '' : 's'}
            </Button>
          )
        }
      />

      {options && <FilterBar options={options} filters={filters} onFilter={onFilter} />}

      {error ? (
        <ErrorState className="mt-3" error={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="mt-3">
          <ListSkeleton rows={4} />
        </div>
      ) : findings.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={ShieldCheck}
          title={active.length > 0 ? 'Nothing matches those filters' : 'No path reaches anything that matters'}
          description={
            active.length > 0
              ? 'Clear a filter to widen the set.'
              : 'No entry point leads to an administrator-equivalent identity or to write access on a crown jewel.'
          }
        />
      ) : (
        <>
          {/* A header row, not decoration: it is what makes the four figures
              beside each finding readable without repeating their names on
              every line. Hidden where the rows stack, because there it labels
              nothing. */}
          <div className="mt-3 hidden items-center gap-3 border-b border-line px-3 pb-1.5 @min-[52rem]:flex">
            <span className="min-w-0 flex-1 text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
              Finding
            </span>
            {['Paths', 'Exposure', 'Impact', 'Hops'].map((label) => (
              <span
                key={label}
                className="w-[74px] shrink-0 text-right text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase"
              >
                {label}
              </span>
            ))}
            <span className="w-[68px] shrink-0" />
          </div>

          <ul className="mt-1.5 flex flex-col gap-1.5">
            {findings.map((finding, index) => (
              <FindingRow
                key={finding.key}
                finding={finding}
                index={index}
                open={openKey === finding.key}
                tracedId={tracedId}
                onToggle={() => setOpenKey(openKey === finding.key ? '' : finding.key)}
                onTrace={onTrace}
              />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

const VECTOR_LABEL = {
  federation: 'Federated trust',
  credential: 'Leaked credential',
  public: 'Public exposure',
};

const REACH_LABEL = {
  admin: 'Reaches an administrator',
  crown: 'Reaches a crown jewel',
  'cross-account': 'Crosses an account',
};

/**
 * The filters.
 *
 * Four dimensions, stacking, each carrying the count it would leave. The counts
 * come from the unfiltered set, so a filter list never shrinks as it is used -
 * a list that did could not be undone without clearing everything.
 *
 * Chips rather than dropdowns: four short lists fit, and a chip shows its state
 * without being opened, which a dropdown cannot.
 */
function FilterBar({ options, filters, onFilter }) {
  const groups = [
    {
      key: 'severity',
      label: 'Severity',
      rows: options.severity.map((row) => ({ ...row, label: severityMeta(row.value).label, tone: severityMeta(row.value).tone })),
    },
    { key: 'reach', label: 'Reaches', rows: options.reach.map((row) => ({ ...row, label: REACH_LABEL[row.value] ?? row.value })) },
    { key: 'vector', label: 'Starts from', rows: options.vector.map((row) => ({ ...row, label: VECTOR_LABEL[row.value] ?? row.value })) },
    { key: 'account', label: 'Target account', rows: options.account },
  ].filter((group) => group.rows.length > 0);

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-surface-2 p-2.5">
      <div className="flex items-center gap-1.5">
        <SlidersHorizontal aria-hidden="true" className="size-3.5 shrink-0 text-ink-3" />
        <span className="text-[10px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Filter</span>
      </div>
      <div className="flex flex-col gap-2 @min-[46rem]:flex-row @min-[46rem]:flex-wrap @min-[46rem]:gap-x-5">
        {groups.map((group) => (
          <fieldset key={group.key} className="flex min-w-0 flex-col gap-1">
            <legend className="mb-1 text-[10.5px] text-ink-3">{group.label}</legend>
            <div className="flex flex-wrap items-center gap-1">
              {group.rows.map((row) => {
                const on = filters[group.key] === row.value;
                return (
                  <button
                    key={row.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onFilter({ [group.key]: on ? '' : row.value })}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[11.5px] transition-colors duration-150',
                      on
                        ? 'border-brand/55 bg-info-soft font-medium text-brand'
                        : 'border-line-strong bg-surface text-ink-2 hover:border-ink-3/50 hover:bg-surface-3',
                    )}
                  >
                    {row.label}
                    <span data-numeric="" className={cn('text-[10.5px]', on ? 'text-brand' : 'text-ink-3')}>
                      {formatNumber(row.count)}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

function FindingRow({ finding, index, open, tracedId, onToggle, onTrace }) {
  const [allInstances, setAllInstances] = useState(false);
  const meta = severityMeta(finding.severity);
  const shown = allInstances ? finding.paths : finding.paths.slice(0, 4);

  return (
    <li
      className={cn(
        'animate-rise overflow-hidden rounded-[var(--radius-control)] border transition-colors duration-150',
        open ? 'border-line-strong bg-surface' : 'border-line bg-surface-2 hover:border-line-strong',
      )}
      data-stagger=""
      style={{ '--stagger': Math.min(index, 5) }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-col gap-1.5 px-3 py-2.5 text-left @min-[52rem]:flex-row @min-[52rem]:items-center @min-[52rem]:gap-3"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-3.5 shrink-0 text-ink-3 transition-transform duration-200',
              !open && '-rotate-90',
            )}
          />
          <Tag tone={meta.tone} size="sm" dot>
            {meta.label}
          </Tag>
          <span className="min-w-0 flex-1 text-[13px] leading-snug font-semibold text-ink">
            {finding.title}
          </span>
          {finding.service && (
            <Tag tone="neutral" size="sm" className="hidden shrink-0 @min-[64rem]:inline-flex">
              {finding.service}
            </Tag>
          )}
        </span>

        {/* Four figures, in the same order as the header. Stacked below 52rem
            into one line of labelled pairs, because a bare column of numbers
            with its header hidden says nothing. */}
        <span className="flex shrink-0 items-center gap-3 pl-6 @min-[52rem]:pl-0">
          <Figure label="Paths" value={formatNumber(finding.instances)} />
          <Figure label="Exposure" value={`${finding.exposure}%`} />
          <Figure label="Impact" value={`${finding.impact}%`} />
          <Figure label="Hops" value={finding.shortestHops} />
        </span>
      </button>

      {open && (
        <div className="animate-fade border-t border-line px-3 py-3">
          <div className="flex flex-col gap-3.5 @min-[58rem]:flex-row @min-[58rem]:gap-5">
            <div className="min-w-0 flex-1">
              <SectionLabel>What this is</SectionLabel>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{finding.via}</p>

              {finding.permissions.length > 0 && (
                <>
                  {/* The permission combination, verbatim. "Privilege
                      escalation possible" is a claim nobody can check;
                      `iam:PassRole + lambda:CreateFunction` is one anybody
                      can, against the policy in front of them. */}
                  <p className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {finding.permissions.map((permission, permissionIndex) => (
                      <span key={permission} className="flex items-center gap-1.5">
                        {permissionIndex > 0 && (
                          <span aria-hidden="true" className="text-[11px] text-ink-3">
                            +
                          </span>
                        )}
                        <code className="rounded border border-line bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink">
                          {permission}
                        </code>
                      </span>
                    ))}
                  </p>
                </>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {finding.reachesAdmin > 0 && (
                  <Tag tone="critical" size="sm" dot>
                    {finding.reachesAdmin} reach an administrator
                  </Tag>
                )}
                {finding.crownJewels > 0 && (
                  <Tag tone="high" size="sm" dot>
                    {finding.crownJewels} reach a crown jewel
                  </Tag>
                )}
                {finding.crossAccount > 0 && (
                  <Tag tone="neutral" size="sm">
                    {finding.crossAccount} cross an account
                  </Tag>
                )}
                <Tag tone="neutral" size="sm">
                  {finding.accountCount} account{finding.accountCount === 1 ? '' : 's'}
                </Tag>
              </div>
            </div>

            {/* Prevention, given its own column rather than a footnote. It is
                the only part of a finding that changes the environment. */}
            <div className="min-w-0 @min-[58rem]:w-[19rem] @min-[58rem]:shrink-0">
              <SectionLabel>How to close it</SectionLabel>
              <div className="mt-1.5 flex gap-2 rounded-[var(--radius-control)] border border-brand/25 bg-info-soft p-2.5">
                <ShieldCheck aria-hidden="true" className="mt-px size-3.5 shrink-0 text-brand" />
                <p className="text-[12px] leading-relaxed text-ink-2">{finding.prevention}</p>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">
                Closing this removes {finding.instances} path
                {finding.instances === 1 ? '' : 's'}.
              </p>
            </div>
          </div>

          <div className="mt-3.5 border-t border-line pt-3">
            <SectionLabel>
              {finding.instances} path{finding.instances === 1 ? '' : 's'}
            </SectionLabel>
            <ul className="mt-1.5 flex flex-col gap-1">
              {shown.map((path) => (
                <InstanceRow
                  key={path.id}
                  path={path}
                  traced={tracedId === path.id}
                  onTrace={() => onTrace(path)}
                />
              ))}
            </ul>
            {finding.paths.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1.5"
                onClick={() => setAllInstances(!allInstances)}
              >
                {allInstances ? 'Show fewer' : `Show all ${finding.paths.length}`}
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Figure({ label, value }) {
  return (
    <span className="flex items-baseline gap-1 @min-[52rem]:w-[74px] @min-[52rem]:flex-col @min-[52rem]:items-end @min-[52rem]:gap-0">
      <span data-numeric="" className="text-[12.5px] font-semibold text-ink">
        {value}
      </span>
      <span className="text-[10.5px] text-ink-3 @min-[52rem]:hidden">{label}</span>
    </span>
  );
}

/**
 * One path inside a finding.
 *
 * The route, and the sequence when it is traced. The steps are not repeated
 * here in text: tracing draws them on the graph above, which is the whole
 * reason the graph is on this screen.
 */
function InstanceRow({ path, traced, onTrace }) {
  const [open, setOpen] = useState(false);

  return (
    <li
      className={cn(
        'rounded-[var(--radius-control)] border transition-colors duration-150',
        traced ? 'border-brand/50 bg-info-soft' : 'border-line bg-surface-2 hover:border-line-strong',
      )}
    >
      <div className="flex flex-col gap-1.5 px-2.5 py-2 @min-[40rem]:flex-row @min-[40rem]:items-center @min-[40rem]:gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn('size-3 shrink-0 text-ink-3 transition-transform duration-200', !open && '-rotate-90')}
          />
          <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink">
            <span className="font-medium">{path.entryName}</span>
            <span aria-hidden="true" className="mx-1.5 text-ink-3">
              →
            </span>
            <span className="font-medium">{path.targetName}</span>
          </span>
        </button>
        <span className="flex shrink-0 items-center gap-2 pl-5 @min-[40rem]:pl-0">
          <span data-numeric="" className="text-[11px] text-ink-3">
            {path.hops} hop{path.hops === 1 ? '' : 's'}
          </span>
          {path.targetAccountName && (
            <Tag tone="neutral" size="sm" className="hidden @min-[52rem]:inline-flex">
              {path.targetAccountName}
            </Tag>
          )}
          <Button variant={traced ? 'primary' : 'secondary'} size="sm" icon={Route} onClick={onTrace}>
            {traced ? 'Tracing' : 'Trace'}
          </Button>
        </span>
      </div>

      {open && (
        <ol className="animate-fade flex flex-col border-t border-line px-2.5 py-2.5">
          <Step index={0} label={path.entryName} first last={path.steps.length === 0} />
          {path.steps.map((step, stepIndex) => (
            <Step
              key={step.edgeId}
              index={stepIndex + 1}
              label={step.toName}
              kind={step.kind}
              last={stepIndex === path.steps.length - 1}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

function Step({ index, label, kind, first, last }) {
  const meta = EDGE_KINDS[kind];

  return (
    <li className={cn('relative flex gap-2.5 pl-0.5', last ? '' : 'pb-2')}>
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
      <span className="flex min-w-0 flex-wrap items-center gap-1.5 pb-0.5">
        {!first && meta && (
          <Tag tone={meta.tone} size="sm">
            {meta.label}
          </Tag>
        )}
        <span className="min-w-0 text-[12px] leading-snug font-medium text-ink">{label}</span>
      </span>
    </li>
  );
}
