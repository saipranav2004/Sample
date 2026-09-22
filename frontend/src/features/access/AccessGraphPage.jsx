import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Crosshair, Download, Info, Radius, Route } from 'lucide-react';
import {
  EDGE_KINDS,
  GRAPH_INPUTS,
  REVEAL_STEP,
  fetchAttackPaths,
  fetchFocusOptions,
  fetchNeighbourhood,
  fetchNode,
} from '../../lib/demo/accessGraph';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { severityMeta } from '../../lib/domain';
import { formatNumber } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button, IconButton } from '../../ui/Button';
import { Panel, SectionLabel } from '../../ui/Panel';
import { Meter } from '../../ui/Meter';
import { Modal } from '../../ui/Overlay';
import { DetailSkeleton } from '../../ui/Skeleton';
import { ErrorState } from '../../ui/States';
import { Tag } from '../../ui/Tag';
import { KIND_LABEL, riskReason } from './graphTheme';
import { AccessFlow } from './AccessFlow';
import { FocusPicker } from './FocusPicker';
import { PathList } from './PathList';

/**
 * Access graph.
 *
 * ── The shape of the screen ─────────────────────────────────────────────────
 * Graph on the left, one panel on the right, one list below. Nothing else.
 *
 * There are no headline counters, on purpose. A count of principals or edges
 * is a fact about the dataset, not about the account: it does not change what
 * anybody does next, and four of them across the top pushed the graph - the
 * only thing on this screen that answers a question - below the fold.
 *
 * ── Why it opens almost empty ───────────────────────────────────────────────
 * Overview first, then zoom and filter, then details on demand. The graph
 * starts on one focus node and its first hop, and grows only where somebody
 * opens it. Each hop shows its three most interesting neighbours and folds the
 * rest behind a count, which is the degree-of-interest approach: keep the drawn
 * graph inside a fixed budget and represent what was left out rather than
 * dropping it silently.
 *
 * The state that decides what is drawn - focus, what is expanded, what has
 * been revealed - all lives in the URL, so a link reproduces exactly what
 * somebody was looking at when they asked a colleague to come and look.
 */
export default function AccessGraphPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [inputsOpen, setInputsOpen] = useState(false);

  const focusId = searchParams.get('focus') || '';
  const expanded = useMemo(
    () => (searchParams.get('open') || '').split(',').filter(Boolean),
    [searchParams],
  );
  const revealed = useMemo(() => {
    const raw = searchParams.get('more') || '';
    const out = {};
    for (const part of raw.split(',').filter(Boolean)) {
      const [id, count] = part.split(':');
      if (id && Number.isFinite(Number(count))) out[id] = Number(count);
    }
    return out;
  }, [searchParams]);
  const tracedPathId = searchParams.get('path') || '';

  const setParams = useCallback(
    (changes) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const options = useDemoQuery((signal) => fetchFocusOptions(signal), []);
  const graph = useDemoQuery(
    (signal) => fetchNeighbourhood({ focusId, expanded, revealed }, signal),
    [focusId, expanded.join(','), JSON.stringify(revealed)],
  );
  const paths = useDemoQuery((signal) => fetchAttackPaths({}, signal), []);


  /* The first hop of the most interesting neighbour opens itself, so the graph
     arrives with a shape to read rather than as two boxes and a line. One hop,
     not two: past that it stops being an overview. */
  useEffect(() => {
    if (expanded.length > 0 || !graph.data) return;
    const first = graph.data.nodes
      .filter((node) => !node.isFocus && node.unseenCount > 0)
      .sort((a, b) => b.interest - a.interest)[0];
    if (first) setParams({ open: first.id });
  }, [graph.data, expanded.length, setParams]);

  /* The enriched focus, not `graph.data.focus`: the raw node carries no
     connection counts, so the panel reported "0 connections" for a node the
     graph had just drawn three edges from. */
  const focusNode = useMemo(
    () => graph.data?.nodes.find((node) => node.isFocus) ?? graph.data?.focus ?? null,
    [graph.data],
  );

  /* Loaded for whatever the panel is showing, so the panel is useful on
     arrival rather than only after the first click. */
  const inspectedId = selected?.id ?? focusNode?.id ?? '';
  const detail = useDemoQuery(
    (signal) => (inspectedId ? fetchNode(inspectedId, signal) : Promise.resolve(null)),
    [inspectedId],
  );

  const pathRows = useMemo(() => paths.data?.rows ?? [], [paths.data]);
  const tracedPath = useMemo(
    () => pathRows.find((path) => path.id === tracedPathId) ?? null,
    [pathRows, tracedPathId],
  );

  const tracedNodeIds = useMemo(
    () => new Set(tracedPath ? tracedPath.nodeIds : []),
    [tracedPath],
  );
  const tracedEdgeIds = useMemo(
    () => new Set(tracedPath ? tracedPath.edgeIds : []),
    [tracedPath],
  );

  const onToggleExpand = useCallback(
    (node) => {
      const isOpen = expanded.includes(node.id);
      const next = isOpen
        ? expanded.filter((id) => id !== node.id)
        : [...expanded, node.id];
      setParams({ open: next.join(',') });
    },
    [expanded, setParams],
  );

  const onReveal = useCallback(
    (parentId) => {
      const next = { ...revealed, [parentId]: (revealed[parentId] ?? 0) + REVEAL_STEP };
      setParams({
        more: Object.entries(next)
          .map(([id, count]) => `${id}:${count}`)
          .join(','),
      });
    },
    [revealed, setParams],
  );

  /* Tracing a path opens every node on it, so the path is actually visible
     rather than highlighted somewhere off screen. */
  const onTrace = useCallback(
    (path) => {
      if (!path) {
        setParams({ path: '' });
        return;
      }
      setParams({
        focus: path.entryId,
        open: path.nodeIds.join(','),
        more: '',
        path: path.id,
      });
    },
    [setParams],
  );

  const onExport = useCallback(() => {
    exportRowsToCsv({
      filename: timestampedName('access-attack-paths'),
      columns: [
        { header: 'Severity', value: (row) => severityMeta(row.severity).label },
        { header: 'Hops', value: (row) => row.hops },
        { header: 'Entry point', value: (row) => row.entryName },
        { header: 'Target', value: (row) => row.targetName },
        { header: 'Reaches admin', value: (row) => (row.reachesAdmin ? 'yes' : 'no') },
        { header: 'Controls crown jewel', value: (row) => (row.controlsCrownJewel ? 'yes' : 'no') },
        { header: 'Escalation edges', value: (row) => row.escalationCount },
        { header: 'Accounts crossed', value: (row) => row.crossAccountCount },
        {
          header: 'Route',
          value: (row) =>
            `${row.entryName} -> ${row.steps.map((step) => `[${EDGE_KINDS[step.kind]?.label ?? step.kind}] ${step.toName}`).join(' -> ')}`,
        },
      ],
      rows: pathRows,
    });
  }, [pathRows]);

  const missingInputs = GRAPH_INPUTS.filter((input) => !input.covered);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Access graph"
        actions={
          <>
            <FocusPicker
              options={options.data?.rows ?? []}
              value={focusId || graph.data?.focus?.id || ''}
              onChange={(id) => {
                setSelected(null);
                setParams({ focus: id, open: '', more: '', path: '' });
              }}
            />
            <IconButton
              icon={Info}
              label="What this graph is built from"
              onClick={() => setInputsOpen(true)}
            />
            <Button variant="secondary" icon={Download} onClick={onExport} disabled={pathRows.length === 0}>
              Export
            </Button>
          </>
        }
      />

      {graph.isError && !graph.data ? (
        <ErrorState error={graph.error} onRetry={graph.refetch} />
      ) : (
        <div
          className={
            fullscreen
              ? 'contents'
              : 'grid gap-4 @min-[70rem]:grid-cols-[minmax(0,1fr)_320px] @min-[90rem]:grid-cols-[minmax(0,1fr)_364px]'
          }
        >
          <div className="min-w-0">
            {tracedPath && (
              <div className="animate-fade mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-brand/30 bg-info-soft px-3 py-2">
                <Route aria-hidden="true" className="size-3.5 shrink-0 text-brand" />
                <span className="min-w-0 text-[12px] text-ink-2">
                  Tracing <span className="font-semibold text-ink">{tracedPath.entryName}</span> to{' '}
                  <span className="font-semibold text-ink">{tracedPath.targetName}</span>
                </span>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onTrace(null)}>
                  Stop tracing
                </Button>
              </div>
            )}

            <AccessFlow
              data={graph.data}
              selectedId={selected?.id ?? ''}
              tracedNodeIds={tracedNodeIds}
              tracedEdgeIds={tracedEdgeIds}
              onSelect={setSelected}
              onToggleExpand={onToggleExpand}
              onReveal={onReveal}
              onFullscreenChange={setFullscreen}
              height={560}
            />
          </div>

          {!fullscreen && (
            <Inspector
              node={selected ?? focusNode}
              isFocusNode={!selected}
              detail={detail}
              onTrace={onTrace}
              onExpand={onToggleExpand}
              expandedIds={expanded}
            />
          )}
        </div>
      )}

      {!fullscreen && (
        <PathList
          rows={pathRows}
          loading={paths.isLoading && !paths.data}
          error={paths.isError && !paths.data ? paths.error : null}
          onRetry={paths.refetch}
          tracedId={tracedPathId}
          onTrace={onTrace}
        />
      )}

      <Modal
        open={inputsOpen}
        onClose={() => setInputsOpen(false)}
        title="What this graph is built from"
        description="An identity list gives the nodes. Every edge comes from somewhere else, so this is what is collected and what is not."
        icon={Info}
        tone="brand"
        footer={
          <Button variant="secondary" onClick={() => setInputsOpen(false)}>
            Close
          </Button>
        }
      >
        <ul className="flex flex-col gap-2">
          {GRAPH_INPUTS.map((input) => (
            <li
              key={input.key}
              className={`rounded-[var(--radius-control)] border p-2.5 ${
                input.covered ? 'border-line bg-surface-2' : 'border-medium/40 bg-medium-soft'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-semibold text-ink">{input.label}</span>
                {input.covered ? (
                  <Tag tone="low" size="sm">
                    Collected
                  </Tag>
                ) : (
                  <Tag tone="medium" size="sm" dot>
                    Not yet
                  </Tag>
                )}
                {input.from && (
                  <Link
                    to={input.from === 'Identities' ? '/identities' : '/credentials'}
                    className="text-[11px] text-brand hover:underline"
                  >
                    {input.from}
                  </Link>
                )}
              </div>
              <p className="mt-1 font-mono text-[10.5px] break-words text-ink-3">{input.source}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">{input.gives}</p>
              {input.note && (
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{input.note}</p>
              )}
            </li>
          ))}
        </ul>
        {missingInputs.length > 0 && (
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
            Until those two arrive, an edge here is what the identity and resource policies allow,
            before any organisation-level deny.
          </p>
        )}
      </Modal>
    </div>
  );
}

/**
 * The panel beside the graph.
 *
 * Always present, never a drawer. A drawer covers the graph, which is the one
 * thing an analyst is trying to keep in view while they read about a node; and
 * it needs opening and closing, which is two more actions per node on a screen
 * whose whole point is clicking through nodes quickly.
 */
function Inspector({ node, isFocusNode, detail, onTrace, onExpand, expandedIds }) {
  if (!node) {
    return (
      <Panel prominence="quiet" className="animate-rise">
        <DetailSkeleton rows={5} />
      </Panel>
    );
  }

  const risk = riskReason(node);
  const radius = detail?.data?.radius;
  const paths = detail?.data?.paths ?? [];
  const isOpen = expandedIds.includes(node.id);

  return (
    <Panel prominence="lead" className="animate-rise flex flex-col gap-4 self-start">
      <div>
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

      {/* Blast radius. Two numbers, because the gap between them is the only
          thing on this screen that a policy review cannot find. */}
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

      {/* What it connects to, as counts rather than a list: the list is the
          graph, one click away, and repeating it here would be a second copy
          to keep in step. */}
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
            {paths.slice(0, 4).map((path) => {
              const meta = severityMeta(path.severity);
              return (
                <li key={path.id}>
                  <button
                    type="button"
                    onClick={() => onTrace(path)}
                    className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-1.5 py-1.5 text-left hover:bg-surface-3"
                  >
                    <Crosshair aria-hidden="true" className="size-3 shrink-0 text-ink-3" />
                    {/* The other end only. Every path listed here passes
                        through the node named at the top of this panel, so
                        repeating that name in each row spends the line on
                        something the reader already knows and truncates the
                        one word they do not. */}
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">
                      {path.entryId === node.id ? path.targetName : path.entryName}
                    </span>
                    <Tag tone={meta.tone} size="sm" dot>
                      {path.hops}
                    </Tag>
                  </button>
                </li>
              );
            })}
          </ul>
          {paths.length > 4 && (
            <p className="mt-1 px-1.5 text-[11px] text-ink-3">{paths.length - 4} more below.</p>
          )}
        </div>
      )}

      {node.kind !== 'identity' && node.detail && (
        <p className="text-[11.5px] leading-relaxed text-ink-3">{node.detail}</p>
      )}
    </Panel>
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
      <p data-numeric="" className="mt-0.5 font-display text-[20px] leading-none font-extrabold text-ink">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function Split({ label, value, total, tone }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px]">
      <dt className="w-11 shrink-0 text-ink-3">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2">
        <Meter
          value={total > 0 ? (value / total) * 100 : 0}
          tone={tone}
          height={4}
          className="min-w-0 flex-1"
          label={`${label}: ${value} of ${total}`}
        />
        <span data-numeric="" className="w-5 shrink-0 text-right font-semibold text-ink">
          {value}
        </span>
      </dd>
    </div>
  );
}

export { AccessGraphPage };
