import { useMemo, useState } from 'react';
import { Check, Minus, RotateCcw, ShieldCheck, UserMinus, UserPlus, UsersRound, X } from 'lucide-react';
import { RequirePermission } from '../../app/RequirePermission';
import { fetchUsers, inviteUser, revokeInvite, updateUser } from '../../lib/api/endpoints';
import { USER_STATUSES } from '../../lib/demo/users';
import { useDemoQuery } from '../../lib/demo/useDemoQuery';
import { formatDateTime, formatNumber, formatRelative, initialsOf } from '../../lib/format';
import { PERMISSIONS, ROLE_ORDER, ROLES } from '../../lib/roles';
import { PageHeader } from '../../shell/PageHeader';
import { Button } from '../../ui/Button';
import { Field, Input, SearchInput, Select } from '../../ui/Field';
import { Modal } from '../../ui/Overlay';
import { Panel, PanelHeader } from '../../ui/Panel';
import { ListSkeleton, StatStripSkeleton } from '../../ui/Skeleton';
import { MetricTile } from '../../ui/Stat';
import { EmptyState, ErrorState } from '../../ui/States';
import { Tabs } from '../../ui/Tabs';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { cn } from '../../ui/cn';

const TABS = [
  { value: 'users', label: 'Users' },
  { value: 'roles', label: 'Roles & permissions' },
  { value: 'activity', label: 'Activity' },
];

const ROLE_OPTIONS = ROLE_ORDER.map((key) => ({ value: key, label: ROLES[key].label }));

const ROLE_TONE = { super_admin: 'brand', admin: 'info', analyst: 'neutral', viewer: 'neutral' };

/**
 * Users & roles.
 *
 * Who can sign in, with which role, and what each role may do - the three
 * questions an administrator comes here with, one tab each. The permission
 * matrix is the same table the rest of the console enforces, so it cannot
 * describe a role differently from how the role behaves.
 */
export default function UsersPage() {
  return (
    <RequirePermission permission="users.manage" title="Only a super admin can manage users">
      <UsersScreen />
    </RequirePermission>
  );
}

function UsersScreen() {
  const { notify } = useToast();
  const [tab, setTab] = useState('users');
  const [search, setSearch] = useState('');
  const [inviting, setInviting] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState('');

  const query = useDemoQuery((signal) => fetchUsers(signal), []);
  const users = useMemo(() => query.data?.users ?? [], [query.data]);
  const me = query.data?.me ?? null;

  const counts = useMemo(() => {
    const byStatus = { active: 0, invited: 0, deactivated: 0 };
    const byRole = Object.fromEntries(ROLE_ORDER.map((key) => [key, 0]));
    for (const user of users) {
      byStatus[user.status] += 1;
      if (user.status !== 'deactivated') byRole[user.role] += 1;
    }
    return { byStatus, byRole };
  }, [users]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const statusOrder = { active: 0, invited: 1, deactivated: 2 };
    return users
      .filter(
        (user) =>
          !needle ||
          [user.name, user.email, user.user, ROLES[user.role]?.label, user.team, user.title]
            .filter(Boolean)
            .some((text) => text.toLowerCase().includes(needle)),
      )
      .sort(
        (a, b) =>
          statusOrder[a.status] - statusOrder[b.status] ||
          ROLES[b.role].rank - ROLES[a.role].rank ||
          a.name.localeCompare(b.name),
      );
  }, [users, search]);

  const act = async (user, run, success) => {
    setBusyId(user.id);
    try {
      await run();
      notify({ variant: 'success', ...success });
      return true;
    } catch (error) {
      notify({ variant: 'error', title: 'Not changed', description: error?.message });
      return false;
    } finally {
      setBusyId('');
    }
  };

  const changeRole = (user, role) =>
    act(user, () => updateUser(user.id, { role }), {
      title: `${user.name} is now ${ROLES[role].label}`,
      description: 'Takes effect the next time their session loads.',
    });

  if (query.isError && !query.data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Users & roles" lede="The user directory could not be loaded." />
        <Panel>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Panel>
      </div>
    );
  }

  const loading = query.isLoading && !query.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users & roles"
        lede="Who can sign in to this console, and what each role is allowed to do."
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setInviting(true)}>
            Invite user
          </Button>
        }
        tabs={<Tabs size="sm" tabs={TABS} value={tab} onChange={setTab} />}
      />

      {loading ? (
        <StatStripSkeleton count={4} />
      ) : (
        <div className="grid gap-3 @min-[30rem]:grid-cols-2 @min-[54rem]:grid-cols-4">
          <MetricTile label="Active users" value={counts.byStatus.active} tone="info" caption="Can sign in now" className="animate-rise" />
          <MetricTile
            label="Pending invitations"
            value={counts.byStatus.invited}
            tone={counts.byStatus.invited > 0 ? 'medium' : 'neutral'}
            caption="Become active at first sign-in"
            className="animate-rise"
          />
          <MetricTile
            label="Super admins"
            value={counts.byRole.super_admin}
            tone="brand"
            caption="Keep this small, and never zero"
            className="animate-rise"
          />
          <MetricTile
            label="Deactivated"
            value={counts.byStatus.deactivated}
            tone="neutral"
            caption="Kept for the audit trail, cannot sign in"
            className="animate-rise"
          />
        </div>
      )}

      {tab === 'users' && (
        <Panel flush className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-[13.5px] font-semibold text-ink">Directory</h2>
              <p className="mt-0.5 text-[12px] text-ink-3">
                Change a role from the list. You cannot change your own, and one active super admin
                always remains.
              </p>
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name, email or role"
              size="sm"
              className="w-full sm:w-64"
              aria-label="Search users"
            />
          </div>
          {loading ? (
            <div className="p-4">
              <ListSkeleton rows={5} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No user matches that search"
              description={`Nobody's name, email or role contains "${search.trim()}".`}
              action={
                <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left">
                <caption className="sr-only">Console users</caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                    <th scope="col" className="px-4 py-2.5">User</th>
                    <th scope="col" className="px-3 py-2.5">Role</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="px-3 py-2.5">Last sign-in</th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((user) => {
                    const self = user.id === me;
                    const status = USER_STATUSES[user.status];
                    const busy = busyId === user.id;
                    return (
                      <tr key={user.id} className={cn('align-middle', user.status === 'deactivated' && 'opacity-70')}>
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              aria-hidden="true"
                              className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[11.5px] font-semibold text-ink-2"
                            >
                              {initialsOf(user.name)}
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-[13px] font-semibold text-ink">{user.name}</span>
                                {self && (
                                  <Tag tone="brand" size="sm">
                                    You
                                  </Tag>
                                )}
                              </span>
                              <span className="block truncate text-[11.5px] text-ink-3">
                                {user.email}
                                {user.title ? ` · ${user.title}` : ''}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {self || user.status === 'deactivated' ? (
                            <Tag tone={ROLE_TONE[user.role]} size="sm">
                              {ROLES[user.role].label}
                            </Tag>
                          ) : (
                            <Select
                              size="sm"
                              aria-label={`Role for ${user.name}`}
                              value={user.role}
                              options={ROLE_OPTIONS}
                              disabled={busy}
                              className="w-36"
                              onChange={(event) => changeRole(user, event.target.value)}
                            />
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Tag tone={status.tone} size="sm" dot>
                            {status.label}
                          </Tag>
                          {user.status === 'invited' && user.invitedBy && (
                            <span className="mt-1 block text-[11px] text-ink-3">
                              By {user.invitedBy}, {formatRelative(user.createdAt)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[12px] text-ink-2">
                          {user.lastSignInAt ? (
                            <span title={formatDateTime(user.lastSignInAt)}>{formatRelative(user.lastSignInAt)}</span>
                          ) : (
                            <span className="text-ink-3">Never</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {self ? null : user.status === 'invited' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={X}
                              loading={busy}
                              onClick={() => setConfirm({ kind: 'revoke', user })}
                            >
                              Withdraw
                            </Button>
                          ) : user.status === 'deactivated' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={RotateCcw}
                              loading={busy}
                              onClick={() =>
                                act(user, () => updateUser(user.id, { status: 'active' }), {
                                  title: `${user.name} reactivated`,
                                  description: user.lastSignInAt
                                    ? 'They can sign in again with their existing role.'
                                    : 'They never signed in, so they are back to invited.',
                                })
                              }
                            >
                              Reactivate
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={UserMinus}
                              loading={busy}
                              onClick={() => setConfirm({ kind: 'deactivate', user })}
                            >
                              Deactivate
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === 'roles' && <RolesTab counts={counts.byRole} />}

      {tab === 'activity' && (
        <Panel>
          <PanelHeader
            title="Administration activity"
            subtitle="Invitations, role changes and deactivations, newest first. Kept for the last 50 changes."
          />
          {(query.data?.activity ?? []).length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No changes yet"
              description="Invite someone or change a role and it is recorded here, with who did it and when."
            />
          ) : (
            <ol className="mt-4 flex flex-col divide-y divide-line">
              {query.data.activity.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                  <span className="min-w-0 text-[12.5px] text-ink-2">
                    <span className="font-medium text-ink">{entry.actor}</span> - {entry.text}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-ink-3" title={formatDateTime(entry.at)}>
                    {formatRelative(entry.at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}

      {inviting && <InviteModal onClose={() => setInviting(false)} />}

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === 'revoke'
            ? `Withdraw the invitation for ${confirm.user.name}?`
            : `Deactivate ${confirm?.user.name ?? ''}?`
        }
        description={
          confirm?.kind === 'revoke'
            ? 'They will not be able to sign in. You can invite them again later.'
            : 'They are signed out and cannot sign in again until reactivated. Their alerts stay assigned to them, so reassign anything urgent first.'
        }
        icon={UserMinus}
        tone="critical"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={UserMinus}
              onClick={async () => {
                const target = confirm;
                setConfirm(null);
                if (target.kind === 'revoke') {
                  await act(target.user, () => revokeInvite(target.user.id), {
                    title: 'Invitation withdrawn',
                    description: `${target.user.name} cannot sign in.`,
                  });
                } else {
                  await act(target.user, () => updateUser(target.user.id, { status: 'deactivated' }), {
                    title: `${target.user.name} deactivated`,
                    description: 'They can no longer sign in.',
                  });
                }
              }}
            >
              {confirm?.kind === 'revoke' ? 'Withdraw invitation' : 'Deactivate'}
            </Button>
          </>
        }
      />
    </div>
  );
}

/**
 * The four roles, and a matrix of what each may do - read from the same
 * table the console enforces, so this screen cannot drift from behaviour.
 */
function RolesTab({ counts }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const permission of PERMISSIONS) {
      if (!map.has(permission.group)) map.set(permission.group, []);
      map.get(permission.group).push(permission);
    }
    return [...map.entries()];
  }, []);

  return (
    <>
      <div className="grid gap-3 @min-[40rem]:grid-cols-2 @min-[72rem]:grid-cols-4">
        {ROLE_ORDER.map((key) => (
          <Panel key={key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Tag tone={ROLE_TONE[key]}>{ROLES[key].label}</Tag>
              <span className="text-[12px] text-ink-3">
                {formatNumber(counts[key])} {counts[key] === 1 ? 'user' : 'users'}
              </span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-ink-2">{ROLES[key].summary}</p>
          </Panel>
        ))}
      </div>

      <Panel flush className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-semibold text-ink">What each role can do</h2>
          <p className="mt-0.5 text-[12px] text-ink-3">
            The console checks this same table before every action. When the backend arrives it
            has to enforce it too - a check in the browser alone is not security.
          </p>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left">
            <caption className="sr-only">Permissions by role</caption>
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
                <th scope="col" className="px-4 py-2.5">Permission</th>
                {ROLE_ORDER.map((key) => (
                  <th key={key} scope="col" className="w-28 px-3 py-2.5 text-center">
                    {ROLES[key].label}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map(([group, permissions]) => (
              <tbody key={group} className="divide-y divide-line border-b border-line last:border-b-0">
                <tr className="bg-surface-2/60">
                  <th scope="rowgroup" colSpan={ROLE_ORDER.length + 1} className="px-4 py-2 text-[11.5px] font-semibold text-ink-2">
                    {group}
                  </th>
                </tr>
                {permissions.map((permission) => (
                  <tr key={permission.key}>
                    <th scope="row" className="px-4 py-2.5 text-[12.5px] font-normal text-ink-2">
                      {permission.label}
                    </th>
                    {ROLE_ORDER.map((key) => {
                      const allowed = permission.roles.includes(key);
                      return (
                        <td key={key} className="px-3 py-2.5 text-center">
                          {allowed ? (
                            <Check aria-label="Allowed" className="mx-auto size-4 text-low" />
                          ) : (
                            <Minus aria-label="Not allowed" className="mx-auto size-4 text-ink-3/60" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Panel>
    </>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InviteModal({ onClose }) {
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('analyst');
  const [title, setTitle] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const nameError = !name.trim() ? "Enter the person's name." : '';
  const emailError = !EMAIL.test(email.trim()) ? 'Enter a valid email address.' : '';

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    setError('');
    if (nameError || emailError) return;
    setSaving(true);
    try {
      const user = await inviteUser({ name, email, role, title });
      notify({
        variant: 'success',
        title: `${user.name} invited as ${ROLES[role].label}`,
        description: `They sign in as ${user.user} or ${user.email}.`,
      });
      onClose();
    } catch (failure) {
      setError(failure?.message ?? 'The invitation was not sent.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title="Invite a user"
      description="They can sign in once invited, and become active at their first sign-in."
      icon={UserPlus}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" icon={UserPlus} loading={saving} type="submit" form="invite-user-form">
            Send invitation
          </Button>
        </>
      }
    >
      <form id="invite-user-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Full name" htmlFor="invite-name" required error={touched ? nameError || undefined : undefined}>
          <Input id="invite-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} invalid={touched && Boolean(nameError)} />
        </Field>
        <Field label="Work email" htmlFor="invite-email" required error={touched ? emailError || undefined : undefined}>
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            value={email}
            maxLength={120}
            onChange={(event) => setEmail(event.target.value)}
            invalid={touched && Boolean(emailError)}
          />
        </Field>
        <Field label="Job title" htmlFor="invite-title" hint="Optional. Shown next to their name.">
          <Input id="invite-title" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Role" htmlFor="invite-role" required hint={ROLES[role].summary}>
          <Select id="invite-role" value={role} options={ROLE_OPTIONS} onChange={(event) => setRole(event.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="rounded-[var(--radius-control)] border border-critical/30 bg-critical-soft px-3 py-2 text-[12.5px] text-critical">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
