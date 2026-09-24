import { useMemo } from 'react';
import { deniedReason, roleCan, roleMeta } from '../lib/roles';
import { useAuth } from './AuthContext';

/**
 * What the signed-in user may do.
 *
 *   can(permission)   true when the role holds it
 *   lock(permission)  undefined when allowed, otherwise the reason string a
 *                     `<Button locked>` shows - so a call site reads
 *                     `<Button locked={lock('alerts.dismiss')}>`
 *
 * Presentation only. The demo data layer refuses the same requests on its
 * own, and the real API will have to as well.
 */
export function useAccess() {
  const { user } = useAuth();
  const role = user?.role ?? null;
  return useMemo(
    () => ({
      role,
      roleLabel: role ? roleMeta(role).label : '',
      can: (permission) => roleCan(role, permission),
      lock: (permission) => (roleCan(role, permission) ? undefined : deniedReason(permission)),
    }),
    [role],
  );
}
