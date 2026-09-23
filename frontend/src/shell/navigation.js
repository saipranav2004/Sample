import {
  Activity,
  BellRing,
  Dna,
  Waypoints,
  FileText,
  FileWarning,
  Fingerprint,
  Gauge,
  // History, - reinstate with the Scans nav item
  KeyRound,
  Plug,
  ShieldOff,
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
    /* Alerts sits beside the overview: the overview says how exposed the
       estate is, and the alert queue is what somebody does about it. */
    items: [
      { to: '/posture', label: 'Overview', icon: Gauge, end: true },
      { to: '/alerts', label: 'Alerts', icon: BellRing },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    items: [
      { to: '/identities', label: 'Identities', icon: Fingerprint },
      { to: '/credentials', label: 'Credentials', icon: KeyRound },
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
    key: 'access',
    label: 'Access',
    /* Separate from Behaviour on purpose. The genome is what an identity has
       done; the graph is what it could do. Conflating observed behaviour with
       granted entitlement is how a quiet identity with administrator access
       gets mistaken for a safe one. */
    items: [{ to: '/access-graph', label: 'Access graph', icon: Waypoints, end: true }],
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
      /* Scans is out of this build: there is one discovery run behind these
         screens, so a list of runs and a picker to choose between them would
         both be controls with nothing to do. Restore this line, the route in
         `app/App.jsx`, the breadcrumb below and `<ScanSwitcher />` in
         `shell/TopBar.jsx` together. */
      // { to: '/scans', label: 'Scans', icon: History },
      { to: '/reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    /* Last in the rail on purpose. Everything above reads the estate; this is
       the one group that changes how the estate is collected. */
    items: [{ to: '/integrations', label: 'Integrations', icon: Plug }],
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
  '/alerts': ['Posture', 'Alerts'],
  '/identities': ['Inventory', 'Identities'],
  '/credentials': ['Inventory', 'Credentials'],
  '/exposure': ['Credential exposure', 'Exposed credentials'],
  '/exposure/dismissed': ['Credential exposure', 'Accepted'],
  '/access-graph': ['Access', 'Access graph'],
  '/genome': ['Behaviour', 'NHI Genome'],
  '/activity': ['Operations', 'Activity'],
  // '/scans': ['Operations', 'Scans'],
  '/reports': ['Operations', 'Reports'],
  '/integrations': ['Settings', 'Integrations'],
};

/**
 * Breadcrumbs for routes with a parameter. Matched by prefix after the exact
 * table misses, so a record screen still says where it sits.
 */
export const BREADCRUMB_PREFIXES = [
  { prefix: '/access-graph/', trail: ['Access', 'Access graph', 'Identity'] },
  { prefix: '/genome/', trail: ['Behaviour', 'NHI Genome', 'Identity'] },
  { prefix: '/reports/', trail: ['Operations', 'Reports', 'Run'] },
];
