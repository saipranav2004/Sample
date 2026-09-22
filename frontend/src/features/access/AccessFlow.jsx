import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { EDGE_KINDS } from '../../lib/demo/accessGraph';
import { EDGE_STYLE, toneFor } from './graphTheme';
import { hopLabels, layoutHops } from './hopLayout';
import { nodeTypes } from './GraphNodes';
import { IconButton } from '../../ui/Button';
import { cn } from '../../ui/cn';

/* Below this the 12px node labels stop being readable, so the fit stops
   shrinking and starts cropping instead. */
const MIN_FIT_ZOOM = 0.7;

/**
 * The canvas.
 *
 * React Flow handles panning, zooming, the viewport and hit testing; this
 * component decides what is on it. The division matters: everything here is
 * about *which* nodes exist and what they look like, and none of it is about
 * mouse maths, which is the part that was hand-rolled before and got the
 * zoom-space wrong on large displays.
 *
 * Three things this adds on top:
 *
 *   HOP HEADINGS   drawn above the canvas rather than in it, so they stay put
 *                  while the graph is panned - a column heading that scrolls
 *                  away from its column is worse than none.
 *   STABLE ROWS    the previous layout's row assignment is fed back in, so
 *                  expanding a node never moves what is already on screen.
 *   FULL SCREEN    the real Fullscreen API on the graph's own element, with a
 *                  fallback to a fixed overlay where the API is blocked, which
 *                  it is inside some embedded frames.
 */
export function AccessFlow(props) {
  return (
    <ReactFlowProvider>
      <FlowInner {...props} />
    </ReactFlowProvider>
  );
}

function FlowInner({
  data,
  selectedId,
  tracedNodeIds,
  tracedEdgeIds,
  onSelect,
  onToggleExpand,
  onReveal,
  onFullscreenChange,
  className,
  height = 560,
}) {
  const shellRef = useRef(null);
  const rowsRef = useRef(new Map());
  const { fitView } = useReactFlow();
  const [fullscreen, setFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [hoverId, setHoverId] = useState('');

  const layout = useMemo(() => {
    const result = layoutHops(data ?? { nodes: [], edges: [], groups: [] }, rowsRef.current);
    rowsRef.current = result.rows;
    return result;
  }, [data]);

  /* Hover dims everything not joined to the hovered node. Cheap to compute and
     the single most useful thing a graph can do on hover: it answers "what is
     this connected to" without a click. */
  const hoverSets = useMemo(() => {
    if (!hoverId) return null;
    const nodes = new Set([hoverId]);
    const edges = new Set();
    for (const edge of data?.edges ?? []) {
      if (edge.from === hoverId) {
        edges.add(edge.id);
        nodes.add(edge.to);
      } else if (edge.to === hoverId) {
        edges.add(edge.id);
        nodes.add(edge.from);
      }
    }
    return { nodes, edges };
  }, [hoverId, data]);

  const flowNodes = useMemo(
    () =>
      layout.nodes.map((node) => ({
        ...node,
        selected: node.id === selectedId,
        data:
          node.type === 'more'
            ? node.data
            : {
                ...node.data,
                traced: tracedNodeIds?.has(node.id) ?? false,
              },
        className: cn(
          hoverSets && !hoverSets.nodes.has(node.id) && 'access-node-dim',
        ),
      })),
    [layout.nodes, selectedId, tracedNodeIds, hoverSets],
  );

  const flowEdges = useMemo(() => {
    const byId = new Map((data?.nodes ?? []).map((node) => [node.id, node]));
    return (data?.edges ?? []).map((edge) => {
      const meta = EDGE_KINDS[edge.kind];
      const traced = tracedEdgeIds?.has(edge.id) ?? false;
      const escalation = Boolean(meta?.escalation);
      const style = traced ? EDGE_STYLE.traced : escalation ? EDGE_STYLE.escalation : EDGE_STYLE.base;

      /* The label is on the edge only where the relationship is not obvious
         from the two nodes it joins. "Authenticates" between a key and a role
         says nothing; "Escalates to" between two roles is the whole point. */
      const worthLabelling = escalation || edge.crossAccount;

      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        type: 'smoothstep',
        animated: false,
        label: worthLabelling ? (escalation ? 'escalates' : 'cross-account') : undefined,
        labelShowBg: true,
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        markerEnd: {
          type: 'arrowclosed',
          width: 14,
          height: 14,
          color: style.stroke,
        },
        style: {
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.dash,
        },
        className: cn(
          traced && 'access-edge-traced',
          hoverSets && !hoverSets.edges.has(edge.id) && 'access-edge-dimmed',
        ),
        data: {
          kind: edge.kind,
          fromName: byId.get(edge.from)?.name,
          toName: byId.get(edge.to)?.name,
        },
      };
    });
  }, [data, tracedEdgeIds, hoverSets]);

  /* Refit whenever the drawn graph changes shape, so an expansion brings the
     new nodes into view instead of leaving them off the right edge.

     With one exception, and it is the whole of the phone case: three columns
     of 304px do not fit in 390px at any zoom worth reading, so fitting the
     lot shrinks the labels past legibility. Below that threshold the fit
     targets the focus and its first hop instead - the reader opens on the
     node they asked for and pans right for the rest, which is the correct
     trade when the alternative is a graph nobody can read. */
  const shape = `${layout.nodes.length}-${layout.columnCount}`;
  const refit = useCallback(
    (duration) => {
      const frame = shellRef.current?.querySelector('.access-canvas');
      const available = frame?.clientWidth ?? 0;
      const tooWide = available > 0 && layout.width * MIN_FIT_ZOOM > available;
      const near = tooWide
        ? layout.nodes.filter((node) => node.data.depth <= 1).map((node) => ({ id: node.id }))
        : undefined;
      fitView({
        padding: 0.18,
        duration,
        minZoom: MIN_FIT_ZOOM,
        maxZoom: 1.15,
        ...(near?.length ? { nodes: near } : null),
      });
    },
    [fitView, layout.nodes, layout.width],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => refit(420));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, fullscreen, refit]);

  /* Full screen. The API can be refused - inside a sandboxed frame, or by
     policy - so the promise rejection falls back to a fixed overlay, which
     looks the same to the reader and needs no permission. */
  const toggleFullscreen = useCallback(() => {
    const element = shellRef.current;
    if (!element) return;

    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      return;
    }
    if (fullscreen) {
      setFullscreen(false);
      return;
    }
    const request = element.requestFullscreen?.({ navigationUI: 'hide' });
    if (request?.catch) {
      request.catch(() => setFullscreen(true));
    } else if (!element.requestFullscreen) {
      setFullscreen(true);
    }
  }, [fullscreen]);

  useEffect(() => {
    const onChange = () => {
      const active = document.fullscreenElement === shellRef.current;
      setNativeFullscreen(active);
      if (!active) setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const expanded = nativeFullscreen || fullscreen;
  useEffect(() => {
    onFullscreenChange?.(expanded);
  }, [expanded, onFullscreenChange]);

  /* Escape leaves the fallback overlay. The native API already handles it. */
  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  /* One click, two meanings, decided by where it landed.
     The chevron is the expand control and the rest of the card selects. This
     was a double-click before, which was wrong twice over: React Flow v12
     never delivers `onNodeDoubleClick` for a custom node type, and a chevron
     that has to be double-clicked is a control nobody finds. */
  const onNodeClick = useCallback(
    (event, node) => {
      if (node.type === 'more') {
        onReveal?.(node.data.parentId);
        return;
      }
      if (event.target instanceof Element && event.target.closest('[data-expand]')) {
        onToggleExpand?.(node.data);
        return;
      }
      onSelect?.(node.data);
    },
    [onReveal, onSelect, onToggleExpand],
  );

  const labels = hopLabels(layout.columnCount);

  return (
    <div
      ref={shellRef}
      className={cn(
        'access-shell flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-inset',
        fullscreen && 'fixed inset-0 z-[80] rounded-none border-0',
        nativeFullscreen && 'rounded-none border-0',
        className,
      )}
      /* Taller as the window allows, never taller than the window. A fixed
         560px is most of a phone screen spent on a graph that only needs a
         third of it, and pushes the panel that explains it out of sight. */
      style={expanded ? undefined : { height: `min(${height}px, 62vh)`, minHeight: 340 }}
    >
      {/* Hop headings. Outside the canvas so they do not pan away from the
          columns they name. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden">
          {labels.map((label, index) => (
            <span key={label} className="access-hop-label shrink-0">
              {index === 0 ? label : `→ ${label}`}
            </span>
          ))}
        </div>
        <span className="shrink-0 text-[10.5px] text-ink-3">
          {(data?.nodes?.length ?? 0)} of {data?.totalNodes ?? 0} shown
        </span>
        <IconButton
          icon={RotateCcw}
          label="Fit the graph to the view"
          size="sm"
          onClick={() => refit(420)}
        />
        <IconButton
          icon={expanded ? Minimize2 : Maximize2}
          label={expanded ? 'Leave full screen' : 'Show the graph full screen'}
          size="sm"
          onClick={toggleFullscreen}
        />
      </div>

      <div className="access-canvas min-h-0 flex-1">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={(_event, node) => setHoverId(node.id)}
          onNodeMouseLeave={() => setHoverId('')}
          onPaneClick={() => onSelect?.(null)}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          elevateEdgesOnSelect={false}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: false }}
          fitView
          fitViewOptions={{ padding: 0.18, minZoom: MIN_FIT_ZOOM, maxZoom: 1.15 }}
          /* Two-finger and wheel zoom without a modifier: an analyst reaches
             for the wheel before they reach for a button. */
          zoomOnScroll
          panOnScroll={false}
          panOnDrag
          selectionOnDrag={false}
          nodeOrigin={[0, 0.5]}
          translateExtent={[
            [-600, -600],
            [layout.width + 600, layout.height + 600],
          ]}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
          <Controls showInteractive={false} position="bottom-left" />
          {layout.nodes.length > 6 && (
            <MiniMap
              pannable
              zoomable
              position="bottom-right"
              nodeStrokeWidth={2}
              nodeColor={(node) =>
                node.type === 'more'
                  ? 'var(--t-line-strong)'
                  : toneFor(node.data) === 'critical'
                    ? 'var(--t-graph-risk)'
                    : 'var(--t-ink-3)'
              }
              maskColor="color-mix(in oklab, var(--t-ink) 10%, transparent)"
              style={{ width: 132, height: 88 }}
            />
          )}
        </ReactFlow>
      </div>

      {/* One line, three verbs. The chevron and the fold are self-evident once
          named; everything past that is a manual nobody reads. */}
      <p className="shrink-0 border-t border-line bg-surface-2 px-3 py-1.5 text-[10.5px] text-ink-3">
        Click a node to inspect · the chevron to open its next hop · drag to pan
      </p>
    </div>
  );
}
