import { Lock } from 'lucide-react';
import { roleMeta } from '../lib/roles';
import { Panel } from '../ui/Panel';
import { EmptyState } from '../ui/States';
import { useAccess } from './useAccess';

/**
 * A screen a role cannot use at all says so, with the role that can - rather
 * than rendering controls that would all be locked, or a 404 that implies the
 * screen does not exist. The navigation already hides it; this covers a
 * typed or bookmarked URL.
 */
export function RequirePermission({ permission, title, children }) {
  const { can, lock, role } = useAccess();
  if (can(permission)) return children;
  return (
    <Panel>
      <EmptyState
        icon={Lock}
        title={title ?? 'Your role cannot open this screen'}
        description={`You are signed in as ${roleMeta(role).label}. ${lock(permission)}`}
      />
    </Panel>
  );
}
