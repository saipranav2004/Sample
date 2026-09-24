import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import {
  EDGE_KINDS,
  NODE_KINDS,
  fetchIdentityAccess,
  preventionDocument,
} from '../../lib/demo/accessGraph';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { exportRowsToCsv, timestampedName } from '../../lib/csv';
import { actorTypeMeta, classificationMeta } from '../../lib/domain';
import { formatNumber } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { DataGrid } from '../../ui/DataGrid';
import { ProportionBar } from '../../ui/Meter';
import { Modal } from '../../ui/Overlay';
import { Panel, PanelHeader, SectionLabel } from '../../ui/Panel';
import { DetailSkeleton } from '../../ui/Skeleton';
import { MetricTile } from '../../ui/Stat';
import { EmptyState, ErrorState } from '../../ui/States';
import { Tabs } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';

/**
 * One identity's access, in full.
 *
 * The graph answers "is there a way in". This screen answers the question that
 * follows for a single identity: what exactly does it reach, by what route,
 * and what would be lost. It is the page somebody opens with a ticket in their
 * hand, so everything on it is a table or a number rather than a picture.
 *
 * Effective access is the table that matters, and it names the identity each
 * grant arrives through. A row that reads "customer-exports, administer, via
 * db-admin-77" is the difference between a policy review and an incident: the
 * grant is not in this identity's policies at all.
 */
const TABS = [
  { value: 'access', label: 'Effective access' },
  { value: 'routes', label: 'Routes in and out' },
  { value: 'escalations', label: 'Escalations' },
];

export default function AccessDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [tab, setTab] = useState('access');
  const [preview, setPreview] = useState(null);

  const query = useDemoQuery((signal) => fetchIdentityAccess(decodeURIComponent(id), signal), [id]);
  const data = query.data;
  const identity = data?.identity;
  const radius = data?.radius;

  const accessRows = useMemo(() => {
    if (!radius) return [];
    return [...radius.effective.rows]
      .map((row) => ({
        id: `${row.resource.id}-${row.level}`,
        resource: row.resource,
        level: row.level,
        viaIdentityId: row.viaIdentityId,
        viaSelf: row.viaIdentityId === identity?.id,
        wildcard: row.wildcard,
      }))
      .sort((a, b) => {
        const rank = { CAN_ADMIN: 0, CAN_WRITE: 1, CAN_READ: 2 };
        if (rank[a.level] !== rank[b.level]) return rank[a.level] - rank[b.level];
        if (a.resource.crownJewel !== b.resource.crownJewel) return a.resource.crownJewel ? -1 : 1;
        return String(a.resource.name).localeCompare(String(b.resource.name));
      });
  }, [radius, identity?.id]);

  const onExport = useCallback(() => {
    exportRowsToCsv({
      filename: timestampedName(`access-${identity?.name ?? 'identity'}`),
      columns: [
        { header: 'Resource', value: (row) => row.resource.name },
        { header: 'Resource kind', value: (row) => row.resource.resourceLabel },
        { header: 'Service', value: (row) => row.resource.service },
        { header: 'Account', value: (row) => row.resource.accountName },
        { header: 'Region', value: (row) => row.resource.region },
        { header: 'Crown jewel', value: (row) => (row.resource.crownJewel ? 'yes' : 'no') },
        { header: 'Level', value: (row) => EDGE_KINDS[row.level]?.label ?? row.level },
        { header: 'Granted directly', value: (row) => (row.viaSelf ? 'yes' : 'no') },
        { header: 'Arrives via', value: (row) => (row.viaSelf ? identity?.name : row.viaIdentityId) },
        { header: 'Wildcard action', value: (row) => (row.wildcard ? 'yes' : 'no') },
      ],
      rows: accessRows,
    });
    notify({
      title: 'Effective access exported',
      description: `${formatNumber(accessRows.length)} resources written, each with the identity the grant arrives through.`,
      variant: 'success',
    });
  }, [accessRows, identity, notify]);

  if (query.isError && !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Identity access"
          actions={
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/access-graph')}>
              Back to the graph
            </Button>
          }
        />
        <ErrorState error={query.error} onRetry={query.refetch} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Identity access" />
        <Panel prominence="lead">
          <DetailSkeleton rows={8} />
        </Panel>
      </div>
    );
  }

  const gap = radius.effective.total - radius.direct.total;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={identity.name}
        lede={identity.arn}
        actions={
          <>
            <Button variant="secondary" as={Link} to="/access-graph" icon={ArrowLeft}>
              Graph
            </Button>
            <Button
              variant="ghost"
              as={Link}
              to={`/identities/${encodeURIComponent(identity.id)}`}
              iconRight={ExternalLink}
            >
              Identity record
            </Button>
            <Button variant="secondary" icon={Download} onClick={onExport} disabled={accessRows.length === 0}>
              Export access
            </Button>
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={classificationMeta(identity.classification).tone} size="sm">
              {classificationMeta(identity.classification).label}
            </Tag>
            <Tag tone="neutral" size="sm">
              {identity.accountName}
            </Tag>
            {identity.isAdmin && (
              <Tag tone="critical" size="sm" dot>
                Administrator equivalent
              </Tag>
            )}
            <span className="text-[11.5px] text-ink-3">
              {actorTypeMeta(identity.identityType).label}
            </span>
          </div>
        }
      />

      {/* The four numbers that decide whether this identity is a problem. */}
      <div className="grid gap-3 @min-[30rem]:grid-cols-2 @min-[54rem]:grid-cols-4">
        <MetricTile
          label="Resources it reaches"
          value={radius.effective.total}
          tone="critical"
          caption={`${formatNumber(radius.direct.total)} from its own policies`}
          className="animate-rise"
        />
        <MetricTile
          label="Beyond its own policies"
          value={gap}
          tone={gap > 0 ? 'high' : 'low'}
          caption={gap > 0 ? 'Arrives through identities it can become' : 'Stated and effective access agree'}
          className="animate-rise"
          data-stagger=""
          style={{ '--stagger': 1 }}
        />
        <MetricTile
          label="Crown jewels in range"
          value={radius.effective.crownJewels}
          tone="medium"
          caption={`across ${formatNumber(radius.effective.accounts)} account${radius.effective.accounts === 1 ? '' : 's'}`}
          className="animate-rise"
          data-stagger=""
          style={{ '--stagger': 2 }}
        />
        <MetricTile
          label="Identities it can become"
          value={radius.identitiesReached}
          tone="info"
          caption={
            radius.adminReached > 0
              ? `${formatNumber(radius.adminReached)} of them administrator equivalent`
              : 'None of them administrator equivalent'
          }
          className="animate-rise"
          data-stagger=""
          style={{ '--stagger': 3 }}
        />
      </div>

      {/* Stated versus effective, side by side and equally weighted: the claim
          of this whole feature is the difference between them. */}
      <Panel prominence="lead" className="animate-rise">
        <PanelHeader
          prominence="lead"
          title="Stated access against effective access"
          subtitle="What the policies attached to this identity grant, next to what it can reach after assuming everything it can assume."
        />
        <div className="mt-3 grid gap-4 @min-[44rem]:grid-cols-2">
          <div>
            <SectionLabel>Its own policies grant</SectionLabel>
            <ProportionBar
              className="mt-2"
              height={10}
              total={Math.max(1, radius.direct.total)}
              ariaLabel={`${radius.direct.read} read, ${radius.direct.write} write, ${radius.direct.admin} administer`}
              segments={[
                { key: 'read', label: 'Read', value: radius.direct.read, color: 'var(--t-info)' },
                { key: 'write', label: 'Write', value: radius.direct.write, color: 'var(--t-medium)' },
                { key: 'admin', label: 'Administer', value: radius.direct.admin, color: 'var(--t-critical)' },
              ]}
            />
            <p className="mt-2 text-[12.5px] text-ink-2">
              <span data-numeric="" className="font-semibold text-ink">
                {formatNumber(radius.direct.total)}
              </span>{' '}
              resources, {formatNumber(radius.direct.crownJewels)} of them crown jewels.
            </p>
          </div>
          <div>
            <SectionLabel>It actually reaches</SectionLabel>
            <ProportionBar
              className="mt-2"
              height={10}
              total={Math.max(1, radius.effective.total)}
              ariaLabel={`${radius.effective.read} read, ${radius.effective.write} write, ${radius.effective.admin} administer`}
              segments={[
                { key: 'read', label: 'Read', value: radius.effective.read, color: 'var(--t-info)' },
                { key: 'write', label: 'Write', value: radius.effective.write, color: 'var(--t-medium)' },
                { key: 'admin', label: 'Administer', value: radius.effective.admin, color: 'var(--t-critical)' },
              ]}
            />
            <p className="mt-2 text-[12.5px] text-ink-2">
              <span data-numeric="" className="font-semibold text-ink">
                {formatNumber(radius.effective.total)}
              </span>{' '}
              resources, {formatNumber(radius.effective.crownJewels)} of them crown jewels, across{' '}
              {formatNumber(radius.effective.accounts)} account{radius.effective.accounts === 1 ? '' : 's'}.
            </p>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
          {gap > 0
            ? `${gap} of those resources appear in no policy attached to this identity. A policy review would not find them, because they arrive through the ${formatNumber(radius.identitiesReached)} identit${radius.identitiesReached === 1 ? 'y' : 'ies'} it can become.`
            : 'Nothing arrives indirectly: this identity reaches exactly what its own policies grant, which is the state every identity should be in.'}
        </p>
      </Panel>

      <Panel prominence="default" flush className="animate-rise overflow-hidden" data-stagger="" style={{ '--stagger': 1 }}>
        <div className="border-b border-line px-4 py-3">
          <Tabs size="sm" tabs={TABS} value={tab} onChange={setTab} />
        </div>

        {tab === 'access' && (
          <DataGrid
            caption="Effective access"
            columns={accessColumns(identity)}
            rows={accessRows}
            rowKey={(row) => row.id}
            density="comfortable"
            emptyState={
              <EmptyState
                icon={ShieldCheck}
                title="It reaches nothing"
                description="No policy on this identity, and none on anything it can assume, grants access to a resource in the graph."
              />
            }
          />
        )}

        {tab === 'routes' && (
          <div className="grid gap-4 p-4 @min-[52rem]:grid-cols-2">
            <RouteList
              title="What can become this identity"
              subtitle="Every one of these is a way to hold this identity's access without holding its credentials."
              edges={data.inbound.filter((edge) => edge.kind !== 'ATTACHED_POLICY')}
              empty="Nothing in the graph can become this identity."
            />
            <RouteList
              title="What this identity can become"
              subtitle="Each one adds everything it reaches to this identity's blast radius."
              edges={data.outbound.filter((edge) => !['CAN_READ', 'CAN_WRITE', 'CAN_ADMIN'].includes(edge.kind))}
              empty="This identity can become nothing else."
            />
          </div>
        )}

        {tab === 'escalations' && (
          <div className="flex flex-col gap-3 p-4">
            {data.escalations.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No escalation edge leaves this identity"
                description="It holds no permission combination that would let it become another identity. Anything it reaches, it reaches because a policy says so."
              />
            ) : (
              data.escalations.map((edge, index) => (
                <div
                  key={edge.id}
                  className={
                    edge.blocked
                      ? 'animate-rise rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5'
                      : 'animate-rise rounded-[var(--radius-control)] border border-critical/25 bg-critical-soft p-3.5'
                  }
                  data-stagger=""
                  style={{ '--stagger': Math.min(index, 4) }}
                >
                  <p className="flex flex-wrap items-center gap-1.5">
                    <Tag tone={edge.blocked ? 'neutral' : 'critical'} size="sm" dot>
                      {edge.method?.label ?? 'Escalation'}
                    </Tag>
                    <span className="text-[13px] font-semibold text-ink">
                      {edge.blocked ? 'could become' : 'becomes'} {edge.otherName}
                    </span>
                    {edge.blocked && (
                      <Tag tone="low" size="sm">
                        Blocked by {edge.blockedBy}
                      </Tag>
                    )}
                  </p>
                  <p className="mt-1.5 font-mono text-[11.5px] leading-relaxed break-words text-ink-2">
                    {edge.method?.permissions.join(' + ')}
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{edge.method?.via}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={ShieldCheck}
                      onClick={() => setPreview({ key: edge.method?.key, name: edge.method?.label })}
                    >
                      Show what would stop it
                    </Button>
                    <span className="text-[11.5px] text-ink-3">{edge.method?.prevention}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </Panel>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.name ?? 'Prevention'}
        description="The statement below is what would close this escalation. Read it before attaching it: a deny this broad can stop legitimate work as easily as an attack."
        icon={ShieldCheck}
        tone="medium"
        footer={
          <Button variant="secondary" onClick={() => setPreview(null)}>
            Close
          </Button>
        }
      >
        {preview && (
          <pre className="max-h-72 overflow-auto rounded-[var(--radius-control)] border border-line bg-inset p-3 font-mono text-[11.5px] leading-relaxed text-ink-2">
            {preventionDocument(preview.key, identity.name)}
          </pre>
        )}
      </Modal>
    </div>
  );
}

function accessColumns(identity) {
  return [
    {
      key: 'resource',
      header: 'Resource',
      primary: true,
      width: '30%',
      cell: (row) => (
        <span className="block min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-ink">{row.resource.name}</span>
            {row.resource.crownJewel && (
              <Tag tone="medium" size="sm">
                crown jewel
              </Tag>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">
            {row.resource.resourceLabel} · {row.resource.accountName} · {row.resource.region}
          </span>
        </span>
      ),
    },
    {
      key: 'level',
      header: 'Level',
      width: '14%',
      cell: (row) => (
        <Tag tone={EDGE_KINDS[row.level]?.tone ?? 'neutral'} size="sm" dot={row.level === 'CAN_ADMIN'}>
          {EDGE_KINDS[row.level]?.label ?? row.level}
        </Tag>
      ),
    },
    {
      key: 'via',
      header: 'How it arrives',
      width: '26%',
      cell: (row) =>
        row.viaSelf ? (
          <span className="text-[12.5px] text-ink-2">Directly, from its own policies</span>
        ) : (
          <span className="block min-w-0">
            <span className="block text-[12.5px] text-ink-2">Indirectly</span>
            <span className="block truncate text-[11px] text-ink-3">
              after becoming another identity it can assume
            </span>
          </span>
        ),
    },
    {
      key: 'holds',
      header: 'What it holds',
      width: '22%',
      cell: (row) => <span className="block truncate text-[12px] text-ink-3">{row.resource.holds}</span>,
    },
    {
      key: 'flags',
      header: 'Flags',
      width: '8%',
      cell: (row) =>
        row.wildcard ? (
          <Tag tone="high" size="sm" title={`A wildcard action in the policy attached to ${identity.name}`}>
            wildcard
          </Tag>
        ) : null,
    },
  ];
}

function RouteList({ title, subtitle, edges, empty }) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{subtitle}</p>
      {edges.length === 0 ? (
        <p className="mt-2 text-[12px] text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {edges.map((edge) => {
            const meta = EDGE_KINDS[edge.kind];
            return (
              <li key={edge.id} className="border-b border-line py-2 last:border-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag tone={meta?.tone ?? 'neutral'} size="sm">
                    {meta?.label ?? edge.kind}
                  </Tag>
                  <span className="min-w-0 truncate text-[12.5px] text-ink">{edge.otherName}</span>
                  <span className="text-[11px] text-ink-3">{NODE_KINDS[edge.otherKind]?.label}</span>
                  {edge.crossAccount && (
                    <Tag tone="high" size="sm">
                      crosses accounts
                    </Tag>
                  )}
                </div>
                {(edge.methodMeta || edge.detail) && (
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
                    {edge.methodMeta
                      ? `${edge.methodMeta.label}: ${edge.methodMeta.permissions.join(' + ')}`
                      : edge.detail}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
