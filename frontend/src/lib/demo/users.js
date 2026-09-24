/**
 * Demo console users: who can sign in, with which role, and the changes a
 * super admin makes to them.
 *
 * The seeded directory is one account per role plus one invited and one
 * deactivated account, so every state the User management screen can show is on it from
 * the first load. The people are the estate's own - the alert escalation
 * policy already names Kavya Reddy (on-call) and Rahul Sharma (security
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
import { randomHex, sha256Hex } from './sha256';

const { NOW, DAY } = ESTATE_META;
const HOUR = 3_600_000;
const ago = (ms) => new Date(NOW - ms).toISOString();

/**
 * The password every seeded account accepts. People invited from the Users
 * screen choose their own when they accept, and this one does not work for
 * them.
 */
export const DEMO_PASSWORD = 'NHI.admin@345';

/** How long an invitation link works. */
export const INVITE_TTL_HOURS = 72;

const SEED = [
  {
    id: 'user-das-admin',
    user: OPERATOR.user,
    /* The earlier sign-in by email keeps working for this one account, but
       emails are no longer shown or asked for anywhere. */
    aliases: [OPERATOR.email],
    name: OPERATOR.name,
    title: 'Security administrator',
    team: 'Security Engineering',
    role: 'super_admin',
    status: 'active',
    createdAt: ago(210 * DAY),
    lastSignInAt: ago(2 * HOUR),
  },
  {
    id: 'user-rahul-sharma',
    user: 'rahul.sharma',
    name: 'Rahul Sharma',
    title: 'Security engineering lead',
    team: 'Security Engineering',
    role: 'admin',
    status: 'active',
    createdAt: ago(180 * DAY),
    lastSignInAt: ago(26 * HOUR),
  },
  {
    id: 'user-kavya-reddy',
    user: 'kavya.reddy',
    name: 'Kavya Reddy',
    title: 'Security on-call analyst',
    team: 'Security Engineering',
    role: 'analyst',
    status: 'active',
    createdAt: ago(150 * DAY),
    lastSignInAt: ago(5 * HOUR),
  },
  {
    id: 'user-sneha-kulkarni',
    user: 'sneha.kulkarni',
    name: 'Sneha Kulkarni',
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
    id: 'user-karthik-rao',
    user: 'karthik.rao',
    name: 'Karthik Rao',
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

/* The seeded invitation was sent three days ago with a 72-hour link, so it
   has just run out - the state an administrator most often has to deal with,
   and the one that shows what Resend is for. */
const SEED_INVITES = [
  {
    token: 'seed-priya-raghavan-7c1e0a',
    userId: 'user-priya-raghavan',
    createdAt: ago(3 * DAY),
    expiresAt: ago(3 * DAY - INVITE_TTL_HOURS * HOUR),
    createdBy: OPERATOR.name,
    status: 'pending',
  },
];

/* ── Store ────────────────────────────────────────────────────────────────── */

function readStore() {
  const raw = readOverlay(OVERLAY_KEYS.users, null);
  return {
    added: Array.isArray(raw?.added) ? raw.added : [],
    changes: raw?.changes && typeof raw.changes === 'object' ? raw.changes : {},
    activity: Array.isArray(raw?.activity) ? raw.activity : [],
    invites: Array.isArray(raw?.invites) ? raw.invites : SEED_INVITES.map((invite) => ({ ...invite })),
    /* userId -> { salt, hash }. Only people who accepted an invitation. */
    passwords: raw?.passwords && typeof raw.passwords === 'object' ? raw.passwords : {},
  };
}

function writeStore(store) {
  writeOverlay(OVERLAY_KEYS.users, store);
}

function pendingInviteOf(store, userId) {
  return (
    store.invites
      .filter((invite) => invite.userId === userId && invite.status === 'pending')
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null
  );
}

const isExpired = (invite, now = Date.now()) => Date.parse(invite.expiresAt) <= now;

/**
 * Every console user with the stored changes applied, seeded order first.
 * An invited user carries `invite`: whether their link still works, and until
 * when. The token itself is never in the directory - like a real API, it is
 * shown once, when the link is created.
 */
export function directory() {
  const store = readStore();
  return [...SEED, ...store.added].map((seed) => {
    /* Whether they chose their own password (by accepting an invitation) -
       never the password or its hash. The sign-in download reads this. */
    const row = { ...seed, ...(store.changes[seed.id] ?? {}), ownPassword: Boolean(store.passwords[seed.id]) };
    if (row.status !== 'invited') return row;
    const invite = pendingInviteOf(store, row.id);
    return {
      ...row,
      invite: invite
        ? { state: isExpired(invite) ? 'expired' : 'pending', expiresAt: invite.expiresAt, sentAt: invite.createdAt }
        : { state: 'none', expiresAt: null, sentAt: null },
    };
  });
}

export function directoryActivity() {
  return readStore().activity;
}

const lower = (value) => String(value ?? '').trim().toLowerCase();

function findByIdentifier(identifier) {
  const needle = lower(identifier);
  if (!needle) return null;
  return (
    directory().find(
      (row) => lower(row.user) === needle || (row.aliases ?? []).some((alias) => lower(alias) === needle),
    ) ?? null
  );
}

/* ── Session ──────────────────────────────────────────────────────────────── */

/** What the app keeps as "the signed-in user". */
export function sessionUser(row) {
  return {
    id: row.id,
    username: row.user,
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

/* ── Passwords ────────────────────────────────────────────────────────────── */

/** The rules a chosen password has to meet, as the accept screen lists them. */
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 10 characters', test: (value) => value.length >= 10 },
  { key: 'letter', label: 'A letter', test: (value) => /[A-Za-z]/.test(value) },
  { key: 'number', label: 'A number', test: (value) => /\d/.test(value) },
  {
    key: 'distinct',
    label: 'Not your username, and not the shared demo password',
    test: (value, username = '') =>
      value !== DEMO_PASSWORD && (!username || !value.toLowerCase().includes(String(username).toLowerCase())),
  },
];

function hashPassword(password, salt) {
  return sha256Hex(`${salt}:${password}`);
}

function passwordMatches(store, row, password) {
  const record = store.passwords[row.id];
  if (!record) return password === DEMO_PASSWORD;
  return hashPassword(password, record.salt) === record.hash;
}

/**
 * Sign-in by username, case-insensitively.
 *
 * Seeded accounts use the demo password; anyone who accepted an invitation
 * uses the password they chose. An account that has not accepted yet, or has
 * been deactivated, is refused with the reason - "wrong password" would send
 * its owner hunting for a password that is not the problem.
 */
export function verifySignIn(identifier, password) {
  const row = findByIdentifier(identifier);
  const store = readStore();
  if (row?.status === 'invited') {
    throw unauthorised('This account has not been set up yet. Open the invitation link you were sent to choose a password.');
  }
  if (!row || !passwordMatches(store, row, password)) {
    throw unauthorised('That username and password do not match an account.');
  }
  if (row.status === 'deactivated') {
    throw unauthorised('This account has been deactivated. Ask a super admin to reactivate it.');
  }
  const change = { ...(store.changes[row.id] ?? {}), lastSignInAt: new Date().toISOString() };
  store.changes = { ...store.changes, [row.id]: change };
  writeStore(store);
  const next = { ...row, ...change };
  return { token: tokenFor(next), user: sessionUser(next) };
}

/* ── Invitations ──────────────────────────────────────────────────────────── */

function issueInvite(store, row, actor) {
  const now = Date.now();
  /* One live link per person: issuing a new one retires the old, so a link
     forwarded by mistake can be killed by sending a fresh one. */
  store.invites = store.invites.map((invite) =>
    invite.userId === row.id && invite.status === 'pending' ? { ...invite, status: 'superseded' } : invite,
  );
  const invite = {
    token: randomHex(24),
    userId: row.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + INVITE_TTL_HOURS * HOUR).toISOString(),
    createdBy: actor.name,
    status: 'pending',
  };
  store.invites = [...store.invites, invite].slice(-200);
  return { token: invite.token, expiresAt: invite.expiresAt };
}

function revokePending(store, userId) {
  store.invites = store.invites.map((invite) =>
    invite.userId === userId && invite.status === 'pending' ? { ...invite, status: 'revoked' } : invite,
  );
}

/**
 * What an invitation link resolves to, for the accept screen. Public: the
 * person opening it is not signed in. Every way a link can fail has its own
 * state, so the screen can say which one and what to do about it.
 *
 *   valid     can be accepted now
 *   expired   past its 72 hours
 *   used      already accepted
 *   replaced  a newer link was sent to the same person
 *   revoked   withdrawn, or the account was deactivated
 *   invalid   no such link (mistyped, or created in another browser)
 */
export function lookupInvite(token) {
  const store = readStore();
  const invite = store.invites.find((entry) => entry.token === String(token ?? '').trim());
  if (!invite) return { state: 'invalid' };
  const row = directory().find((entry) => entry.id === invite.userId);
  const base = row
    ? {
        name: row.name,
        username: row.user,
        role: row.role,
        roleLabel: ROLES[row.role]?.label ?? row.role,
        invitedBy: invite.createdBy,
        expiresAt: invite.expiresAt,
      }
    : { invitedBy: invite.createdBy, expiresAt: invite.expiresAt };
  if (invite.status === 'accepted' || row?.status === 'active') return { state: 'used', ...base };
  if (invite.status === 'revoked' || !row || row.status === 'deactivated') return { state: 'revoked', ...base };
  if (invite.status === 'superseded') return { state: 'replaced', ...base };
  if (isExpired(invite)) return { state: 'expired', ...base };
  return { state: 'valid', ...base };
}

/**
 * Accept an invitation: check the link, set the password, activate the
 * account. Signing in is a separate step, done with the new password, so the
 * first sign-in proves the password works.
 */
export function acceptInvite({ token, password, confirm }) {
  const found = lookupInvite(token);
  if (found.state !== 'valid') {
    const error = new Error(INVITE_PROBLEMS[found.state]?.title ?? 'This invitation cannot be used.');
    error.code = `INVITE_${found.state.toUpperCase()}`;
    throw error;
  }
  const value = String(password ?? '');
  const failed = PASSWORD_RULES.find((rule) => !rule.test(value, found.username));
  if (failed) throw new Error(`The password needs: ${failed.label.toLowerCase()}.`);
  if (value !== confirm) throw new Error('The two passwords do not match.');

  const store = readStore();
  const invite = store.invites.find((entry) => entry.token === token);
  const salt = randomHex(16);
  store.passwords = { ...store.passwords, [invite.userId]: { salt, hash: hashPassword(value, salt) } };
  store.invites = store.invites.map((entry) =>
    entry.token === token ? { ...entry, status: 'accepted', acceptedAt: new Date().toISOString() } : entry,
  );
  store.changes = {
    ...store.changes,
    [invite.userId]: { ...(store.changes[invite.userId] ?? {}), status: 'active' },
  };
  store.activity = [
    { at: new Date().toISOString(), actor: found.name, text: `${found.name} accepted the invitation and set a password.` },
    ...store.activity,
  ].slice(0, 50);
  writeStore(store);
  return { username: found.username };
}

/** Why a link cannot be used, in the words the accept screen shows. */
export const INVITE_PROBLEMS = {
  expired: {
    title: 'This invitation has expired',
    detail: `Invitation links work for ${INVITE_TTL_HOURS} hours. Ask the person who invited you to send a new one.`,
  },
  used: {
    title: 'This invitation has already been used',
    detail: 'The account is set up. Sign in with the password chosen when it was accepted.',
  },
  replaced: {
    title: 'A newer invitation was sent',
    detail: 'Only the most recent link works. Use the newest one you received.',
  },
  revoked: {
    title: 'This invitation was withdrawn',
    detail: 'An administrator cancelled it. Ask them if you still need access.',
  },
  invalid: {
    title: 'This invitation link is not valid',
    detail: 'Check that the whole link was copied. In this demo a link also only works in the browser it was created in.',
  },
};

/** Send a new link to someone who has not accepted yet. Retires the old one. */
export function resendInvite(id) {
  const actor = assertCan('users.manage');
  const store = readStore();
  const row = directory().find((entry) => entry.id === id);
  if (!row) throw new Error('That user no longer exists.');
  if (row.status !== 'invited') throw new Error('Only someone who has not accepted yet can be sent a new link.');
  const invite = issueInvite(store, row, actor);
  log(store, actor, `Sent ${row.name} a new invitation link.`);
  writeStore(store);
  return { user: row, invite };
}

/* ── Administration ───────────────────────────────────────────────────────── */

/** Usernames: lowercase, starting with a letter, like `kavya.reddy`. */
function activeSuperAdmins(rows) {
  return rows.filter((row) => row.role === 'super_admin' && row.status !== 'deactivated');
}

function log(store, actor, text) {
  store.activity = [{ at: new Date().toISOString(), actor: actor.name, text }, ...store.activity].slice(0, 50);
}

export const USERNAME = /^[a-z][a-z0-9._-]{2,31}$/;

/**
 * Invite a user by full name and username. Emails are not collected: the
 * console identifies people by username, and the invitation is a link the
 * administrator hands over.
 */
export function inviteUser({ name, username, role, title = '', team = '' }) {
  const actor = assertCan('users.manage');
  const cleanName = String(name ?? '').trim();
  const user = lower(username);
  if (!cleanName) throw new Error("Enter the person's full name.");
  if (!USERNAME.test(user)) {
    throw new Error('A username is 3 to 32 characters: lowercase letters, numbers, dots, dashes or underscores, starting with a letter.');
  }
  if (!ROLES[role]) throw new Error('Choose a role.');
  const rows = directory();
  if (rows.some((row) => lower(row.user) === user || (row.aliases ?? []).some((alias) => lower(alias) === user))) {
    throw new Error(`The username ${user} is already taken.`);
  }

  const store = readStore();
  const row = {
    id: `user-${user.replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
    user,
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
  const invite = issueInvite(store, row, actor);
  log(store, actor, `Invited ${cleanName} as ${ROLES[role].label}.`);
  writeStore(store);
  return { user: row, invite };
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
    /* A deactivated account's outstanding link must stop working too. */
    if (next.status === 'deactivated') revokePending(store, id);
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
  revokePending(store, id);
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
