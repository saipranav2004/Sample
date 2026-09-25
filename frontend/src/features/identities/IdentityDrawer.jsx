import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Globe, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import { actorTypeMeta, classificationMeta } from '../../lib/domain';
import { titleCaseEnum } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Drawer } from '../../ui/Overlay';
import { Tabs } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { CopyableValue } from '../../ui/Copyable';
import { IdentityRecordPanels, recordTabs } from './IdentityRecord';

/**
 * Identity record detail.
 *
 * A drawer rather than a page: triage means scanning a list and opening
 * records in sequence, and a full navigation would lose the list position and
 * the filters behind it. The full record - posture, alerts and all - is one
 * click away on the identity page.
 */
export function IdentityDrawer({ identity, open, onClose }) {
  const [tab, setTab] = useState('overview');
  if (!identity) return null;
  const meta = classificationMeta(identity.classification);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="xl"
      eyebrow={meta.label}
      title={identity.name || identity.arn}
      subtitle={<CopyableValue value={identity.arn} />}
      header={
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <IdentityTags identity={identity} />
          {identity.id && (
            <Button
              as={Link}
              to={`/identities/${encodeURIComponent(identity.id)}`}
              variant="link"
              size="sm"
              iconRight={ArrowUpRight}
              className="ml-auto text-[12px]"
            >
              Open full record
            </Button>
          )}
        </div>
      }
    >
      <div className="px-4 sm:px-5">
        <Tabs tabs={recordTabs(identity)} value={tab} onChange={setTab} size="sm" />
      </div>
      <div className="px-4 py-4 sm:px-5">
        <IdentityRecordPanels identity={identity} tab={tab} active={open} />
      </div>
    </Drawer>
  );
}

/** Type, admin, MFA and trust at a glance - the same tags on the drawer and the page. */
export function IdentityTags({ identity }) {
  return (
    <>
      {identity.identity_type && (
        <Tag tone="neutral" size="sm">
          {actorTypeMeta(identity.identity_type).label}
        </Tag>
      )}
      {identity.is_admin && (
        <Tag tone="critical" size="sm" icon={ShieldAlert}>
          Admin access
        </Tag>
      )}
      {identity.console_access &&
        (identity.mfa_enabled ? (
          <Tag tone="low" size="sm" icon={ShieldCheck}>
            MFA enabled
          </Tag>
        ) : identity.mfa_enforced ? (
          <Tag tone="medium" size="sm" icon={ShieldCheck}>
            MFA enforced, not enrolled
          </Tag>
        ) : (
          <Tag tone="critical" size="sm" icon={ShieldOff}>
            MFA disabled
          </Tag>
        ))}
      {identity.trust_type && (
        <Tag tone="info" size="sm" icon={Globe}>
          {titleCaseEnum(identity.trust_type)}
        </Tag>
      )}
    </>
  );
}
