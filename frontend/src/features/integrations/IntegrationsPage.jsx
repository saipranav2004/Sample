import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Cloud,
  ExternalLink,
  Plug,
  RotateCw,
  Settings2,
} from 'lucide-react';
import { fetchIntegrations } from '../../lib/api/endpoints';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { formatDateTime, formatNumber, formatRelative } from '../../lib/format';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Panel, PanelHeader, SectionLabel } from '../../ui/Panel';
import { ListSkeleton, StatStripSkeleton } from '../../ui/Skeleton';
import { MetricTile } from '../../ui/Stat';
import { ErrorState } from '../../ui/States';
import { Tag } from '../../ui/Tag';
import { PLATFORMS, PLATFORM_CATEGORIES, platformByKey } from './catalog';
import { AwsSetup } from './AwsSetup';

/**
 * Integrations.
 *
 * ── What this screen is ─────────────────────────────────────────────────────
 * Every other screen in this console reports something it was told. This is
 * the screen where it is told. So it is laid out around one question - what
 * does this console know, and where did it come from - rather than as a grid
 * of logos.
 *
 * ── Why AWS gets a panel of its own ─────────────────────────────────────────
 * Without the AWS connector there are no identities, so there is no inventory,
 * no behavioural baseline and no graph. Every other platform here would
 * enrich an estate that AWS defines. A layout that gave AWS the same card as
 * a Jira connector would be describing the product wrongly - so AWS is the
 * one platform with a full setup behind it, and the rest offer Connect and
 * nothing else, because there is nothing else honest to offer yet.
 *
 * ── Why the setup is not a route of its own ─────────────────────────────────
 * It is the same screen, zoomed in. Configure swaps this page for the setup
 * and the URL carries which one, so the browser's back button works and the
 * view is linkable - but the navigation still has one entry, because there is
 * one place an operator goes to change what is collected.
 */
export default function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const configuring = searchParams.get('configure') || '';
  /* The demo query, so a discovery run finishing, an account being connected
     or a template change made on the setup screen refreshes this too. */
  const query = useDemoQuery((signal) => fetchIntegrations(signal), []);
  const data = query.data;

  const connected = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows
      .map((row) => ({ ...row, platform: platformByKey(row.key) }))
      .filter((row) => row.platform);
  }, [data]);

  const connectedKeys = useMemo(() => new Set(connected.map((row) => row.key)), [connected]);

  const available = useMemo(
    () => PLATFORMS.filter((platform) => !connectedKeys.has(platform.key)),
    [connectedKeys],
  );

  const availableByCategory = useMemo(() => {
    const groups = new Map();
    for (const platform of available) {
      if (!groups.has(platform.category)) groups.set(platform.category, []);
      groups.get(platform.category).push(platform);
    }
    return [...groups.entries()].map(([key, items]) => ({
      key,
      meta: PLATFORM_CATEGORIES[key],
      items,
    }));
  }, [available]);

  const openSetup = (key) => setSearchParams({ configure: key });
  const closeSetup = () => setSearchParams({});

  if (query.isError && !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Integrations" lede="Connector state could not be loaded." />
        <Panel>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Panel>
      </div>
    );
  }

  /* The setup is the same screen zoomed in, so it replaces the body rather
     than opening over it: a wizard inside a modal on top of the list it
     belongs to gives the reader two scroll positions to lose. */
  if (configuring === 'aws' && data) {
    return <AwsSetup data={data} onBack={closeSetup} onChanged={query.refetch} />;
  }

  const loading = query.isLoading && !data;
  const attention = connected.filter((row) => row.status !== 'connected').length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrations"
        lede="Where this console collects from. Nothing on any other screen exists without something connected here."
        actions={
          <Button
            variant="secondary"
            icon={RotateCw}
            onClick={query.refetch}
            loading={query.isRefreshing}
          >
            Refresh
          </Button>
        }
      />

      {loading ? (
        <StatStripSkeleton count={4} />
      ) : (
        <div className="grid gap-3 @min-[30rem]:grid-cols-2 @min-[54rem]:grid-cols-4">
          <MetricTile
            label="Platforms connected"
            value={connected.length}
            icon={Plug}
            tone="info"
            caption={`${formatNumber(available.length)} more planned`}
          />
          <MetricTile
            label="AWS accounts covered"
            value={data.coverage.accountsConnected}
            tone={data.coverage.accountsConnected < data.coverage.accountsTotal ? 'medium' : 'low'}
            caption={`of ${formatNumber(data.coverage.accountsTotal)} in the organisation`}
            meter={
              data.coverage.accountsTotal > 0
                ? Math.round((data.coverage.accountsConnected / data.coverage.accountsTotal) * 100)
                : 0
            }
            meterLabel="Share of accounts with the discovery role"
          />
          <MetricTile
            label="Needs attention"
            value={attention}
            tone={attention > 0 ? 'high' : 'low'}
            caption={
              attention > 0
                ? 'A connector is reading less than it should'
                : 'Every connector is reading cleanly'
            }
          />
          <MetricTile
            label="Regions in range"
            value={data.tenant.regions.length}
            tone="neutral"
            caption={data.tenant.regions.slice(0, 3).join(', ')}
          />
        </div>
      )}

      {/* AWS first, and larger. Not a design flourish: it is the connector
          every screen in this console depends on. */}
      <Panel prominence="lead">
        <PanelHeader
          prominence="lead"
          title="Amazon Web Services"
          subtitle="One read-only cross-account role gives this console every actor, every credential it holds, every trust relationship between them, and the CloudTrail history behind all three."
          actions={
            <Button variant="primary" icon={Settings2} onClick={() => openSetup('aws')}>
              Configure
            </Button>
          }
        />

        {loading ? (
          <div className="mt-4">
            <ListSkeleton rows={3} />
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 @min-[46rem]:grid-cols-3">
              <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5">
                <SectionLabel>What it collects</SectionLabel>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                  Actors - the EC2 instances, Lambda functions, ECS tasks, pipelines and agents
                  that act - and the IAM role each one assumes. The role is the credential; the
                  actor is the identity.
                </p>
              </div>
              <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5">
                <SectionLabel>What it never collects</SectionLabel>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                  Secret values, object contents and data-plane events. The role is read-only, and
                  the setup asks you to deny secret reads outright rather than trusting that it
                  will not use them.
                </p>
              </div>
              <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5">
                <SectionLabel>How it authenticates</SectionLabel>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                  A cross-account role with a per-tenant external id, and no access key anywhere.
                  Credentials issued to it expire in an hour.
                </p>
              </div>
            </div>

            {data.discovery && (
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
                <RotateCw aria-hidden="true" className="size-3.5" />
                {data.discovery.running ? (
                  <span className="font-medium text-ink-2">Discovery running now</span>
                ) : (
                  <span title={formatDateTime(data.discovery.lastRunAt)}>
                    Last discovery {formatRelative(data.discovery.lastRunAt)}
                  </span>
                )}
                <span aria-hidden="true">·</span>
                <span title={formatDateTime(data.discovery.nextRunAt)}>Next {formatRelative(data.discovery.nextRunAt)}</span>
                <span aria-hidden="true">·</span>
                <span>Every 24 hours</span>
              </p>
            )}

            {data.coverage.unconnected.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-medium/40 bg-medium-soft px-3.5 py-2.5">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-medium" />
                <p className="min-w-0 text-[12.5px] leading-relaxed text-ink-2">
                  {data.coverage.unconnected.map((account) => account.name).join(', ')} has no
                  discovery role, so nothing in it is discovered at all - it is absent from the
                  inventory rather than reported as empty.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  iconRight={ArrowRight}
                  onClick={() => openSetup('aws')}
                >
                  Connect it
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel flush className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-semibold text-ink">Connected</h2>
          <p className="mt-0.5 text-[12px] text-ink-3">
            Each row names the screens it feeds, so the cost of disconnecting it is legible before
            somebody does it.
          </p>
        </div>

        {loading ? (
          <div className="p-4">
            <ListSkeleton rows={3} />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {connected.map((row) => (
              <ConnectedRow key={row.key} row={row} onConfigure={() => openSetup(row.key)} />
            ))}
          </ul>
        )}
      </Panel>

      {/* Not a grid of Connect buttons: none of these connectors exists yet,
          and a wall of buttons that all say "not available" reads as a sales
          page. One folded list says what is planned and what each would add. */}
      <Panel flush className="overflow-hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-ink">
                Planned connectors <span className="font-normal text-ink-3">({formatNumber(available.length)})</span>
              </span>
              <span className="mt-0.5 block text-[12px] text-ink-3">
                Not built yet. Each would add to the screens named, and none is needed for the rest to work.
              </span>
            </span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {availableByCategory.flatMap((group) =>
              group.items.map((platform) => {
                const CategoryIcon = group.meta?.icon ?? Cloud;
                return (
                  <li key={platform.key} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] border border-line bg-surface-2 text-ink-3">
                      <CategoryIcon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink">{platform.name}</span>
                        <span className="text-[11px] text-ink-3">{group.meta?.label ?? group.key}</span>
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-2">{platform.summary}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10.5px] text-ink-3">Would feed</span>
                      {platform.provides.map((entry) => (
                        <span key={entry.to} className="rounded-full bg-surface-3 px-2 py-0.5 text-[10.5px] text-ink-3">
                          {entry.label}
                        </span>
                      ))}
                    </span>
                  </li>
                );
              }),
            )}
          </ul>
        </details>
      </Panel>
    </div>
  );
}

const STATUS_META = {
  connected: { label: 'Collecting', tone: 'low', icon: CheckCircle2 },
  attention: { label: 'Partial coverage', tone: 'medium', icon: AlertTriangle },
  error: { label: 'Not collecting', tone: 'critical', icon: AlertTriangle },
};

/**
 * One connected platform.
 *
 * Configure appears only where there is something on this side to configure.
 * The two source-control connectors are onboarded by the credential scanner
 * rather than here, so they say so and link to the screen that proves they are
 * working - rather than offering a button that would open an empty wizard.
 */
function ConnectedRow({ row, onConfigure }) {
  const status = STATUS_META[row.status] ?? STATUS_META.connected;
  const StatusIcon = status.icon;
  const CategoryIcon = PLATFORM_CATEGORIES[row.platform.category]?.icon ?? Cloud;

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] border border-line bg-surface-2 text-ink-2">
            <CategoryIcon aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-ink">{row.platform.name}</p>
              <Tag tone={status.tone} size="sm" icon={StatusIcon}>
                {status.label}
              </Tag>
              {row.platform.primary && (
                <Tag tone="brand" size="sm">
                  Primary
                </Tag>
              )}
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{row.detail}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
              <span>Last read {formatRelative(row.lastSyncedAt)}</span>
              {row.roleName && <span className="font-mono">{row.roleName}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-3">Feeds</span>
              {row.platform.provides.map((entry) => (
                <Link
                  key={entry.to}
                  to={entry.to}
                  className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                >
                  {entry.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {row.configurable ? (
          <Button variant="secondary" size="sm" icon={Settings2} onClick={onConfigure}>
            Configure
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <Button
              as={Link}
              to={row.platform.provides[0]?.to ?? '/exposure'}
              variant="ghost"
              size="sm"
              iconRight={ExternalLink}
            >
              See what it reads
            </Button>
            <span className="text-[11px] text-ink-3">Managed by {row.managedBy}</span>
          </div>
        )}
      </div>
    </li>
  );
}

export { IntegrationsPage };
