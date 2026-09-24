/**
 * Demo console users: who can sign in, with which role, and the changes a
 * super admin makes to them.
 *
 * The seeded directory is one account per role plus one invited and one
 * deactivated account, so every state the Users screen can show is on it from
 * the first load. The people are the estate's own - the alert escalation
 * policy already names Helena Brandt (on-call) and Marcus Oyelaran (security
 * engineering lead), so their console roles match the jobs they do there.
 *
 * Changes persist in localStorage like every other demo write. That makes the
 * directory per-browser: signing in as another user in the same browser sees
 * the same assignments and role changes, which is what lets the difference
 * between roles be shown on one machine.
 */
import { TOKEN_KEY } from '../api/http';
import { forbidden, roleCan, ROLES } from '../roles';
import { ESTATE_META, OPERATOR } from './estate';
import { OVERLAY_KEYS, readOverlay, writeOverlay } from './runtime';

const { NOW, DAY } = ESTATE_META;
const HOUR = 3_600_000;
const ago = (ms) => new Date(NOW - ms).toISOString();

/** The one password every demo account accepts. */
export const DEMO_PASSWORD = 'admin@123';

const SEED = [
  {
    id: 'user-das-admin',
    user: OPERATOR.user,
    email: OPERATOR.email,
    name: OPERATOR.name,
    title: 'Security administrator',
    team: 'Security Engineering',
    role: 'super_admin',
    status: 'active',
    createdAt: ago(210 * DAY),
    lastSignInAt: ago(2 * HOUR),
  },
  {
    id: 'user-marcus-oyelaran',
    user: 'marcus.oyelaran',
    email: 'marcus.oyelaran@example.com',
    name: 'Marcus Oyelaran',
    title: 'Security engineering lead',
    team: 'Security Engineering',
    role: 'admin',
    status: 'active',
    createdAt: ago(180 * DAY),
    lastSignInAt: ago(26 * HOUR),
  },
  {
    id: 'user-helena-brandt',
    user: 'helena.brandt',
    email: 'helena.brandt@example.com',
    name: 'Helena Brandt',
    title: 'Security on-call analyst',
    team: 'Security Engineering',
    role: 'analyst',
    status: 'active',
    createdAt: ago(150 * DAY),
    lastSignInAt: ago(5 * HOUR),
  },
  {
    id: 'user-sofia-marchetti',
    user: 'sofia.marchetti',
    email: 'sofia.marchetti@example.com',
    name: 'Sofia Marchetti',
    title: 'Compliance auditor',
    team: 'Compliance',
    role: 'viewer',
    status: 'active',
    createdAt: ago(90 * DAY),
    lastSignInAt: ago(6 * DAY),
  },
  {
    id: 'user-priya-raghavan',
    user: 'priya.raghavan',
    email: 'priya.raghavan@example.com',
    name: 'Priya Raghavan',
    title: 'Platform engineer',
    team: 'Platform Engineering',
    role: 'analyst',
    status: 'invited',
    createdAt: ago(3 * DAY),
    invitedBy: OPERATOR.name,
    lastSignInAt: null,
  },
  {
    id: 'user-liam-donnelly',
    user: 'liam.donnelly',
    email: 'liam.donnelly@example.com',
    name: 'Liam Donnelly',
    title: 'Identity engineer',
    team: 'Identity',
    role: 'analyst',
    status: 'deactivated',
    createdAt: ago(200 * DAY),
    lastSignInAt: ago(64 * DAY),
  },
];

export const USER_STATUSES = {
  active: { label: 'Active', tone: 'low' },
  invited: { label: 'Invited', tone: 'info' },
  deactivated: { label: 'Deactivated', tone: 'neutral' },
};

/* ── Store ────────────────────────────────────────────────────────────────── */

function readStore() {
  const raw = readOverlay(OVERLAY_KEYS.users, null);
  return {
    added: Array.isArray(raw?.added) ? raw.added : [],
    changes: raw?.changes && typeof raw.changes === 'object' ? raw.changes : {},
    activity: Array.isArray(raw?.activity) ? raw.activity : [],
  };
}

function writeStore(store) {
  writeOverlay(OVERLAY_KEYS.users, store);
}

/** Every console user with the stored changes applied, seeded order first. */
export function directory() {
  const { added, changes } = readStore();
  return [...SEED, ...added].map((row) => ({ ...row, ...(changes[row.id] ?? {}) }));
}

export function directoryActivity() {
  return readStore().activity;
}

const lower = (value) => String(value ?? '').trim().toLowerCase();

function findByIdentifier(identifier) {
  const needle = lower(identifier);
  if (!needle) return null;
  return directory().find((row) => lower(row.user) === needle || lower(row.email) === needle) ?? null;
}

/* ── Session ──────────────────────────────────────────────────────────────── */

/** What the app keeps as "the signed-in user". */
export function sessionUser(row) {
  return {
    id: row.id,
    username: row.user,
    email: row.email,
    name: row.name,
    title: row.title,
    team: row.team,
    role: row.role,
    roleLabel: ROLES[row.role]?.label ?? row.role,
  };
}

function tokenFor(row) {
  return `demo.${row.id}`;
}

/**
 * The directory row behind the stored session token, or null. Read on every
 * call rather than cached, so a role change reaches the next request.
 */
export function currentUserRow() {
  let token = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    token = null;
  }
  if (!token?.startsWith('demo.')) return null;
  const id = token.slice('demo.'.length);
  return directory().find((row) => row.id === id) ?? null;
}

/**
 * The acting user for a demo write. Falls back to the seeded super admin only
 * when there is no session at all (a unit test, say) - never when the session
 * belongs to a deactivated account, which is refused instead.
 */
export function actingUser() {
  const row = currentUserRow();
  return row ?? SEED[0];
}

/** Refuse a write the signed-in role may not make, as the API would. */
export function assertCan(permission) {
  const row = currentUserRow();
  if (!row || row.status === 'deactivated') {
    const error = new Error('Your session has ended. Sign in again.');
    error.status = 401;
    throw error;
  }
  if (!roleCan(row.role, permission)) throw forbidden(permission);
  return row;
}

function unauthorised(message) {
  const error = new Error(message);
  error.status = 401;
  return error;
}

/**
 * Sign-in. Accepts the username or the email, case-insensitively. An invited
 * account becomes active on its first sign-in; a deactivated one is refused
 * with a reason, because "wrong password" would send its owner hunting for a
 * password that is not the problem.
 */
export function verifySignIn(identifier, password) {
  const row = findByIdentifier(identifier);
  if (!row || password !== DEMO_PASSWORD) {
    throw unauthorised('That username and password do not match an account.');
  }
  if (row.status === 'deactivated') {
    throw unauthorised('This account has been deactivated. Ask a super admin to reactivate it.');
  }
  const store = readStore();
  const change = { ...(store.changes[row.id] ?? {}), lastSignInAt: new Date().toISOString() };
  if (row.status === 'invited') {
    change.status = 'active';
    store.activity = [
      { at: change.lastSignInAt, actor: row.name, text: `${row.name} accepted the invitation and signed in for the first time.` },
      ...store.activity,
    ].slice(0, 50);
  }
  store.changes = { ...store.changes, [row.id]: change };
  writeStore(store);
  const next = { ...row, ...change };
  return { token: tokenFor(next), user: sessionUser(next) };
}

/* ── Administration ───────────────────────────────────────────────────────── */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function activeSuperAdmins(rows) {
  return rows.filter((row) => row.role === 'super_admin' && row.status !== 'deactivated');
}

function log(store, actor, text) {
  store.activity = [{ at: new Date().toISOString(), actor: actor.name, text }, ...store.activity].slice(0, 50);
}

/**
 * Invite a user. The username is the part of the email before the `@`, which
 * is what the seeded accounts use, and has to be unique like the email.
 */
export function inviteUser({ name, email, role, title = '', team = '' }) {
  const actor = assertCan('users.manage');
  const cleanName = String(name ?? '').trim();
  const cleanEmail = lower(email);
  if (!cleanName) throw new Error("Enter the person's name.");
  if (!EMAIL.test(cleanEmail)) throw new Error('Enter a valid email address.');
  if (!ROLES[role]) throw new Error('Choose a role.');
  const rows = directory();
  const user = cleanEmail.split('@')[0];
  if (rows.some((row) => lower(row.email) === cleanEmail)) throw new Error('Someone with that email is already a user.');
  if (rows.some((row) => lower(row.user) === user)) throw new Error(`The username ${user} is already taken.`);

  const store = readStore();
  const row = {
    id: `user-${user.replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
    user,
    email: cleanEmail,
    name: cleanName,
    title: String(title).trim() || null,
    team: String(team).trim() || null,
    role,
    status: 'invited',
    createdAt: new Date().toISOString(),
    invitedBy: actor.name,
    lastSignInAt: null,
  };
  store.added = [...store.added, row];
  log(store, actor, `Invited ${cleanName} as ${ROLES[role].label}.`);
  writeStore(store);
  return row;
}

/**
 * Change a user's role or status. Two guards keep the console administrable:
 * nobody changes their own role or deactivates themselves (a slip would lock
 * them out mid-session), and the last active super admin cannot be demoted or
 * deactivated (nobody would be left to undo it).
 */
export function updateUser(id, patch) {
  const actor = assertCan('users.manage');
  const rows = directory();
  const row = rows.find((entry) => entry.id === id);
  if (!row) throw new Error('That user no longer exists.');

  const next = { ...row };
  if (patch.role !== undefined) {
    if (!ROLES[patch.role]) throw new Error('Choose a role.');
    next.role = patch.role;
  }
  if (patch.status !== undefined) {
    if (!['active', 'deactivated'].includes(patch.status)) throw new Error('Unknown status.');
    /* Reactivating someone who never signed in puts them back to invited. */
    next.status = patch.status === 'active' && !row.lastSignInAt ? 'invited' : patch.status;
  }
  if (next.role === row.role && next.status === row.status) return row;

  if (row.id === actor.id) {
    throw new Error('You cannot change your own role or deactivate yourself. Ask another super admin.');
  }
  const after = rows.map((entry) => (entry.id === id ? next : entry));
  if (activeSuperAdmins(rows).length > 0 && activeSuperAdmins(after).length === 0) {
    throw new Error('At least one active super admin has to remain.');
  }

  const store = readStore();
  store.changes = {
    ...store.changes,
    [id]: { ...(store.changes[id] ?? {}), role: next.role, status: next.status },
  };
  if (next.role !== row.role) {
    log(store, actor, `Changed ${row.name} from ${ROLES[row.role].label} to ${ROLES[next.role].label}.`);
  }
  if (next.status !== row.status) {
    log(store, actor, next.status === 'deactivated' ? `Deactivated ${row.name}.` : `Reactivated ${row.name}.`);
  }
  writeStore(store);
  return next;
}

/** Withdraw an invitation that was never accepted. */
export function revokeInvite(id) {
  const actor = assertCan('users.manage');
  const row = directory().find((entry) => entry.id === id);
  if (!row) throw new Error('That user no longer exists.');
  if (row.status !== 'invited') throw new Error('Only a pending invitation can be withdrawn.');
  const store = readStore();
  if (store.added.some((entry) => entry.id === id)) {
    store.added = store.added.filter((entry) => entry.id !== id);
    const { [id]: _removed, ...rest } = store.changes;
    store.changes = rest;
  } else {
    /* A seeded invitation cannot be deleted from the seed, so it is kept as
       deactivated - the same outcome from the directory's point of view. */
    store.changes = { ...store.changes, [id]: { ...(store.changes[id] ?? {}), status: 'deactivated' } };
  }
  log(store, actor, `Withdrew the invitation for ${row.name}.`);
  writeStore(store);
}
