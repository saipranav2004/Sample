import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Info } from 'lucide-react';
import {
  EDGE_KINDS,
  GRAPH_INPUTS,
  REVEAL_STEP,
  fetchFocusOptions,
  fetchNeighbourhood,
  fetchNode,
} from '../../lib/demo/accessGraph';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { PageHeader } from '../../shell/PageHeader';
import { Button, IconButton } from '../../ui/Button';
import { Modal } from '../../ui/Overlay';
import { ErrorState } from '../../ui/States';
import { Tag } from '../../ui/Tag';
import { AccessFlow } from './AccessFlow';
import { FocusPicker } from './FocusPicker';
import { IdentityPanel } from './IdentityPanel';

/**
 * Access graph.
 *
 * ── The shape of the screen ─────────────────────────────────────────────────
 * Graph on the left, one panel on the right. Nothing else.
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

  /* One row per drawn relationship.
     The export is the graph on screen, written down: whoever opens the file
     gets the same edges in the same words, with the sentence that explains
     each one. Exporting the node list instead would hand the reader an
     inventory they already have on the Identities screen - the edges are what
     only this screen knows. */
  const exportRows = useMemo(() => {
    const nodes = new Map((graph.data?.nodes ?? []).map((node) => [node.id, node]));
    return (graph.data?.edges ?? []).map((edge) => ({
      edge,
      from: nodes.get(edge.from),
      to: nodes.get(edge.to),
    }));
  }, [graph.data]);

  const onExport = useCallback(() => {
    exportRowsToCsv({
      filename: timestampedName('access-graph-relationships'),
      columns: [
        { header: 'Relationship', value: (row) => EDGE_KINDS[row.edge.kind]?.label ?? row.edge.kind },
        { header: 'From', value: (row) => row.from?.name ?? row.edge.from },
        { header: 'From kind', value: (row) => row.from?.kind ?? '' },
        { header: 'From account', value: (row) => row.from?.accountName ?? '' },
        { header: 'To', value: (row) => row.to?.name ?? row.edge.to },
        { header: 'To kind', value: (row) => row.to?.kind ?? '' },
        { header: 'To account', value: (row) => row.to?.accountName ?? '' },
        { header: 'Cross-account', value: (row) => (row.edge.crossAccount ? 'yes' : 'no') },
        { header: 'Privilege escalation', value: (row) => (row.edge.kind === 'ESCALATES_TO' ? 'yes' : 'no') },
        { header: 'Wildcard grant', value: (row) => (row.edge.wildcard ? 'yes' : 'no') },
        { header: 'What it means', value: (row) => row.edge.detail ?? '' },
      ],
      rows: exportRows,
    });
  }, [exportRows]);

  const missingInputs = GRAPH_INPUTS.filter((input) => !input.covered);

  /* Declared once and rendered in one of two places - the grid, or a dock
     inside full screen - so the two arrangements cannot drift apart. */
  const inspectorPanel = (
    <IdentityPanel
      node={selected ?? focusNode}
      isFocusNode={!selected}
      detail={detail}
      onExpand={onToggleExpand}
      expandedIds={expanded}
    />
  );

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
                setParams({ focus: id, open: '', more: '' });
              }}
            />
            <IconButton
              icon={Info}
              label="What this graph is built from"
              onClick={() => setInputsOpen(true)}
            />
            <Button variant="secondary" icon={Download} onClick={onExport} disabled={exportRows.length === 0}>
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
          {/* A column, so the graph can take whatever height the panel beside it
              ends up needing. The graph used to be a fixed 560px next to a
              panel that is often taller, which left a band of empty page under
              the graph on every desktop. */}
          <div className="flex min-w-0 flex-col">
            <AccessFlow
              data={graph.data}
              selectedId={selected?.id ?? ''}
              onSelect={setSelected}
              onToggleExpand={onToggleExpand}
              onReveal={onReveal}
              onFullscreenChange={setFullscreen}
              /* Full screen has to contain everything: leaving it to read the
                 details and then re-entering is not a workflow. The panel
                 docks inside the full-screen shell. */
              inspector={inspectorPanel}
              height={560}
            />
          </div>

          {!fullscreen && inspectorPanel}
        </div>
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

export { AccessGraphPage };
