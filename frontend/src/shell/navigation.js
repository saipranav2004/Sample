import {
  Activity,
  FileWarning,
  Fingerprint,
  Gauge,
  History,
  KeyRound,
  ShieldOff,
  UserCircle,
  Vault,
} from 'lucide-react';

/**
 * Information architecture.
 *
 * Grouped by the question an operator is answering, not by the API surface:
 * "how exposed am I" (Posture), "what exists" (Inventory), "what leaked"
 * (Code exposure), "what happened" (Operations).
 */
export const NAV_GROUPS = [
  {
    key: 'overview',
    label: 'Posture',
    items: [{ to: '/posture', label: 'Overview', icon: Gauge, end: true }],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    items: [
      { to: '/identities', label: 'Identities', icon: Fingerprint },
      { to: '/credentials', label: 'Credentials', icon: KeyRound },
      { to: '/secrets', label: 'Secret-backed', icon: Vault },
    ],
  },
  {
    key: 'exposure',
    label: 'Code exposure',
    items: [
      { to: '/exposure', label: 'Findings', icon: FileWarning, end: true },
      { to: '/exposure/dismissed', label: 'Dismissed', icon: ShieldOff },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    items: [
      { to: '/activity', label: 'Activity', icon: Activity },
      { to: '/scans', label: 'Scans', icon: History },
    ],
  },
  {
    key: 'personal',
    label: 'Assigned to me',
    items: [{ to: '/my-resources', label: 'My resources', icon: UserCircle }],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label || 'Posture' })),
);

/**
 * Breadcrumb trail per route. A console is a place people get lost in, so
 * every screen states where it sits. Kept as data rather than derived from the
 * path so the labels match the navigation exactly.
 */
export const BREADCRUMBS = {
  '/posture': ['Posture'],
  '/identities': ['Inventory', 'Identities'],
  '/credentials': ['Inventory', 'Credentials'],
  '/secrets': ['Inventory', 'Secret-backed'],
  '/exposure': ['Code exposure', 'Findings'],
  '/exposure/dismissed': ['Code exposure', 'Dismissed'],
  '/activity': ['Operations', 'Activity'],
  '/scans': ['Operations', 'Scans'],
  '/my-resources': ['Assigned to me', 'My resources'],
};
