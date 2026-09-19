import { Bot, ShieldAlert, ShieldOff, User, Vault } from 'lucide-react';
import { classificationMeta, ownerTypeMeta } from '../../lib/domain';
import { arnResource, formatNumber, formatRelative, titleCaseEnum } from '../../lib/format';
import { CellStack } from '../../ui/DataGrid';
import { Tag } from '../../ui/Tag';

/** Human identities read differently from machine ones; the icon says which. */
export function identityIcon(identity) {
  const meta = classificationMeta(identity.classification);
  return meta.kind === 'human' ? User : Bot;
}

export function IdentityNameCell({ identity }) {
  return (
    <CellStack
      icon={identityIcon(identity)}
      title={identity.name || arnResource(identity.arn)}
      meta={arnResource(identity.arn)}
      mono
    />
  );
}

export function ClassificationCell({ identity }) {
  const meta = classificationMeta(identity.classification);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-[3px]"
        style={{ background: meta.color }}
      />
      <span className="min-w-0 truncate text-[12.5px] text-ink-2">{meta.label}</span>
    </span>
  );
}

export function OwnerCell({ identity }) {
  const meta = ownerTypeMeta(identity.owner_type);
  const owner = identity.owner_name || identity.primary_owner || identity.created_by_name;
  return (
    <span className="block min-w-0">
      <span className="block truncate text-[12.5px] text-ink-2" title={owner || undefined}>
        {owner || 'Unassigned'}
      </span>
      <span className="block truncate text-[11px] text-ink-3">{meta.label}</span>
    </span>
  );
}

/**
 * Posture markers, shown only when true. Absence of a marker is not a claim
 * that the opposite is verified — it just means the flag is not set.
 */
export function RiskMarkersCell({ identity }) {
  const markers = [];
  if (identity.is_admin) markers.push({ key: 'admin', label: 'Admin', tone: 'critical', icon: ShieldAlert });
  if (String(identity.classification).toUpperCase() === 'HUMAN' && !identity.mfa_enabled) {
    markers.push({ key: 'mfa', label: 'No MFA', tone: 'critical', icon: ShieldOff });
  }
  if (identity.is_secret) markers.push({ key: 'secret', label: 'Secret', tone: 'medium', icon: Vault });
  if (String(identity.owner_type).toUpperCase() === 'ORPHANED') {
    markers.push({ key: 'orphan', label: 'Orphaned', tone: 'high' });
  }

  if (markers.length === 0) return <span className="text-[12.5px] text-ink-3">—</span>;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {markers.map((marker) => (
        <Tag key={marker.key} tone={marker.tone} size="sm" icon={marker.icon}>
          {marker.label}
        </Tag>
      ))}
    </span>
  );
}

export function ActivityCell({ identity }) {
  return (
    <span className="block min-w-0">
      <span className="block text-[12.5px] text-ink-2">{formatRelative(identity.last_active)}</span>
      <span className="block text-[11px] text-ink-3" data-numeric="">
        {formatNumber(identity.total_events)} events
      </span>
    </span>
  );
}

export function TrustCell({ identity }) {
  if (!identity.trust_type) return <span className="text-[12.5px] text-ink-3">—</span>;
  return (
    <span className="block min-w-0">
      <span className="block truncate text-[12.5px] text-ink-2">
        {titleCaseEnum(identity.trust_type)}
      </span>
      {identity.trust_service && (
        <span className="block truncate font-mono text-[11px] text-ink-3" title={identity.trust_service}>
          {identity.trust_service}
        </span>
      )}
    </span>
  );
}
