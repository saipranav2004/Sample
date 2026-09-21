import {
  Activity,
  Dna,
  FileText,
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
 * (Credential exposure), how it behaves (Behaviour), "what happened"
 * (Operations).
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
    label: 'Credential exposure',
    items: [
      { to: '/exposure', label: 'Exposed credentials', icon: FileWarning, end: true },
      { to: '/exposure/dismissed', label: 'Accepted', icon: ShieldOff },
    ],
  },
  {
    key: 'behaviour',
    label: 'Behaviour',
    items: [{ to: '/genome', label: 'NHI Genome', icon: Dna }],
  },
  {
    key: 'operations',
    label: 'Operations',
    items: [
      { to: '/activity', label: 'Activity', icon: Activity },
      { to: '/scans', label: 'Scans', icon: History },
      { to: '/reports', label: 'Reports', icon: FileText },
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
  '/exposure': ['Credential exposure', 'Exposed credentials'],
  '/exposure/dismissed': ['Credential exposure', 'Accepted'],
  '/genome': ['Behaviour', 'NHI Genome'],
  '/activity': ['Operations', 'Activity'],
  '/scans': ['Operations', 'Scans'],
  '/reports': ['Operations', 'Reports'],
  '/my-resources': ['Assigned to me', 'My resources'],
};

/**
 * Breadcrumbs for routes with a parameter. Matched by prefix after the exact
 * table misses, so a record screen still says where it sits.
 */
export const BREADCRUMB_PREFIXES = [
  { prefix: '/genome/', trail: ['Behaviour', 'NHI Genome', 'Identity'] },
  { prefix: '/reports/', trail: ['Operations', 'Reports', 'Run'] },
];
