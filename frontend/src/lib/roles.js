/**
 * Console roles and what each one may do.
 *
 * Four roles, ordered by reach. The split follows the one most security
 * consoles settle on: whoever administers the console itself (people and
 * integrations) is separate from whoever runs the security programme, and
 * accepting a risk - dismissing an alert, allowlisting a leaked secret - is
 * reserved for the people accountable for that decision rather than for
 * everyone who works the queue.
 *
 * This file is the single source of truth for both halves of the demo: the
 * screens read it to decide what to show, and the demo data layer reads it to
 * refuse a request the role may not make, the way a backend would. A check in
 * the browser alone is presentation, not security - when the real API
 * arrives it has to enforce this same table on the server.
 */

export const ROLES = {
  super_admin: {
    key: 'super_admin',
    label: 'Super admin',
    rank: 4,
    summary: 'Full control of the console, including users, roles and integrations.',
  },
  admin: {
    key: 'admin',
    label: 'Admin',
    rank: 3,
    summary: 'Runs the security programme: triage, risk acceptance, exposure review and reporting. Cannot manage users or change integrations.',
  },
  analyst: {
    key: 'analyst',
    label: 'Analyst',
    rank: 2,
    summary: 'Works the alert queue: acknowledge, investigate, resolve and escalate. Cannot accept a risk or reassign other people.',
  },
  viewer: {
    key: 'viewer',
    label: 'Viewer',
    rank: 1,
    summary: 'Read-only access for audit and oversight. Can export what they can see.',
  },
};

export const ROLE_ORDER = ['super_admin', 'admin', 'analyst', 'viewer'];

/**
 * Every permission the console checks, grouped the way the matrix on the
 * User management screen shows them. `roles` lists who holds it.
 */
export const PERMISSIONS = [
  { key: 'data.view', group: 'Visibility', label: 'View every screen and record', roles: ['super_admin', 'admin', 'analyst', 'viewer'] },
  { key: 'data.export', group: 'Visibility', label: 'Export tables to CSV', roles: ['super_admin', 'admin', 'analyst', 'viewer'] },

  { key: 'alerts.work', group: 'Alerts', label: 'Acknowledge, start, resolve, escalate and add notes', roles: ['super_admin', 'admin', 'analyst'] },
  { key: 'alerts.take', group: 'Alerts', label: 'Assign an alert to themselves', roles: ['super_admin', 'admin', 'analyst'] },
  { key: 'alerts.assign', group: 'Alerts', label: 'Assign alerts to anyone', roles: ['super_admin', 'admin'] },
  { key: 'alerts.dismiss', group: 'Alerts', label: 'Dismiss (accept a risk) and reopen closed alerts', roles: ['super_admin', 'admin'] },
  { key: 'alerts.bulk', group: 'Alerts', label: 'Act on many alerts at once', roles: ['super_admin', 'admin'] },

  { key: 'anomalies.work', group: 'NHI Genome', label: 'Acknowledge and resolve anomalies', roles: ['super_admin', 'admin', 'analyst'] },
  { key: 'anomalies.dismiss', group: 'NHI Genome', label: 'Mark an anomaly expected or suppress a detector, and reopen', roles: ['super_admin', 'admin'] },
  { key: 'anomalies.contain', group: 'NHI Genome', label: 'Apply a containment policy or freeze a credential', roles: ['super_admin', 'admin'] },

  { key: 'exposure.deepScan', group: 'Credential exposure', label: 'Request a deep scan of a repository', roles: ['super_admin', 'admin', 'analyst'] },
  { key: 'exposure.review', group: 'Credential exposure', label: 'Accept a finding as reviewed, or restore it', roles: ['super_admin', 'admin'] },

  { key: 'posture.remediate', group: 'Posture', label: 'Apply a remediation to an identity', roles: ['super_admin', 'admin'] },

  { key: 'reports.generate', group: 'Reports', label: 'Generate a report', roles: ['super_admin', 'admin', 'analyst'] },
  { key: 'reports.schedule', group: 'Reports', label: 'Create, pause and delete schedules, and delete past runs', roles: ['super_admin', 'admin'] },

  { key: 'integrations.operate', group: 'Administration', label: 'Re-run connector checks and start a discovery run', roles: ['super_admin', 'admin'] },
  { key: 'integrations.manage', group: 'Administration', label: 'Connect platforms and change integration setup', roles: ['super_admin'] },
  { key: 'users.manage', group: 'Administration', label: 'Invite users, change roles, deactivate accounts', roles: ['super_admin'] },
];

const BY_KEY = new Map(PERMISSIONS.map((permission) => [permission.key, permission]));

export function roleMeta(role) {
  return ROLES[role] ?? ROLES.viewer;
}

/** Whether `role` holds `permission`. Unknown permissions are refused. */
export function roleCan(role, permission) {
  return Boolean(BY_KEY.get(permission)?.roles.includes(role));
}

/** The least-privileged role that holds `permission`, for "needs X" hints. */
export function minimumRoleFor(permission) {
  const holders = BY_KEY.get(permission)?.roles ?? [];
  return [...ROLE_ORDER].reverse().find((role) => holders.includes(role)) ?? 'super_admin';
}

/**
 * Where a role lands after signing in. An analyst works a queue, so they land
 * on their own assigned alerts - the rest of the queue, and every other
 * screen, stays one click away, because unassigned work is theirs to pick up.
 * Everyone else lands on the dashboard.
 */
export function homeFor(role) {
  return role === 'analyst' ? '/alerts?view=mine' : '/overview';
}

/** One sentence for a disabled control: why it is disabled and who can. */
export function deniedReason(permission) {
  const needed = roleMeta(minimumRoleFor(permission)).label;
  return needed === ROLES.super_admin.label
    ? 'Only a super admin can do this.'
    : `Needs the ${needed} role or higher.`;
}

/** A refusal shaped like the API's, so screens handle it as a 403. */
export function forbidden(permission) {
  const error = new Error(`Your role does not allow this. ${deniedReason(permission)}`);
  error.status = 403;
  error.code = 'FORBIDDEN';
  return error;
}
