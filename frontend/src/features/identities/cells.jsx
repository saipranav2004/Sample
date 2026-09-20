import { Bot, User } from 'lucide-react';
import { classificationMeta, ownerTypeMeta } from '../../lib/domain';
import { arnResource, titleCaseEnum } from '../../lib/format';
import { CellStack } from '../../ui/DataGrid';

/** Human identities read differently from machine ones; the icon says which. */
function identityIcon(identity) {
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
