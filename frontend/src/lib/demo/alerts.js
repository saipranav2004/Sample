/**
 * Alerts, raised from the demonstration estate.
 *
 * ── Every alert is a fact another screen already shows ──────────────────────
 * Nothing here invents a problem. Each rule reads the same records the source
 * screen reads - an alert for "administrator role unused for 140 days" exists
 * because that exact credential is on the Credentials screen with those exact
 * figures - so following the link from an alert always lands on the thing it
 * describes, with the numbers it quoted.
 *
 * ── When an alert was raised ────────────────────────────────────────────────
 * Discovery runs once a day (the same fourteen runs the scan history holds).
 * An alert is raised by the first run at or after its condition became true,
 * so a condition older than monitoring was raised by the first run - the
 * onboarding backlog every real deployment starts with - and a newer one by
 * the run that first saw it. Genome anomalies carry their own detection time.
 *
 * ── State ───────────────────────────────────────────────────────────────────
 * Operators' actions are stored in the demo overlay, keyed by alert id, and
 * applied over the alert as raised (`applyTriage` in `lib/alerts`). Two kinds
 * of alert keep their status somewhere else on purpose:
 *
 *   NHI Genome   the anomaly's own status is the truth, because the genome
 *                screen triages the same anomaly. Acting here writes there, and
 *                a decision made there shows here.
 *   Exposure     raised in the page from the live scanner feed, since only the
 *                browser holds it. Closing one writes the scanner's allowlist,
 *                exactly as "Mark safe" does on Exposed credentials.
 */

import { applyTriage, isOpen } from '../alerts';
import { actorTypeMeta, credentialKindMeta } from '../domain';
import { estate, ESTATE_META, OPERATOR } from './estate';
import { genomeAnomalies, genomeFleet, setAnomalyStatus } from './genome';
import { AWS_VERIFIED_AT, awsCheckResults } from './integrations';
import { hashSeed, intBetween, OVERLAY_KEYS, readOverlay, rng, writeOverlay } from './runtime';
import { assertCan, directory } from './users';

const DAY = ESTATE_META.DAY;
const MINUTE = 60_000;

/* ── Who ──────────────────────────────────────────────────────────────────── */

/**
 * The people alerts can be assigned to: the estate's people, plus the
 * signed-in operator.
 */
export function alertPeople() {
  const people = [
    { user: OPERATOR.user, name: OPERATOR.name, team: OPERATOR.role },
    ...estate().people.map((person) => ({ user: person.user, name: person.name, team: person.team })),
  ];
  /* Console users who are not identity owners - someone a super admin just
     invited - can be assigned work too. Deactivated accounts cannot. */
  const known = new Set(people.map((person) => person.user));
  const inactive = new Set();
  for (const row of directory()) {
    if (row.status === 'deactivated') inactive.add(row.user);
    else if (!known.has(row.user)) people.push({ user: row.user, name: row.name, team: row.team ?? row.title ?? null });
  }
  return people.filter((person) => !inactive.has(person.user));
}

/** The permission an alert action needs, for the acting user. */
function permissionFor(action, { alerts, assignee, actorUser }) {
  if (alerts.length > 1 && action !== 'comment') return 'alerts.bulk';
  if (action === 'assign') return assignee && assignee === actorUser ? 'alerts.take' : 'alerts.assign';
  if (action === 'dismiss' || action === 'reopen') return 'alerts.dismiss';
  return 'alerts.work';
}

/**
 * Who sits at each level of the escalation policy.
 *
 * Level one is security on-call - the fallback responder when an alert has no
 * owner to route to. Level three is the operator, whose role is security
 * administrator: the top of the policy is the person who can accept a risk.
 */
export function escalationPolicy() {
  const people = alertPeople();
  const byUser = new Map(people.map((person) => [person.user, person]));
  /* A level whose person has been deactivated falls to an active super
     admin, so an escalation always lands on somebody who can sign in. */
  const fallback =
    directory()
      .filter((row) => row.role === 'super_admin' && row.status !== 'deactivated')
      .map((row) => byUser.get(row.user))
      .find(Boolean) ?? people[0];
  const at = (user) => byUser.get(user) ?? fallback;
  return {
    1: { ...at('helena.brandt'), role: 'Security on-call' },
    2: { ...at('marcus.oyelaran'), role: 'Security engineering lead' },
    3: { ...at(OPERATOR.user), role: 'Security administrator' },
  };
}

/**
 * Owner-first routing: an alert about an identity goes to the person who owns
 * that identity, the attribution model NHI tools are built around. With no
 * owner - orphaned, or a source with no identity - it goes to on-call.
 */
function routeTo(ownerName) {
  const person = ownerName ? alertPeople().find((entry) => entry.name === ownerName) : null;
  if (person) return { person, why: 'owner of the identity' };
  /* An owner whose console account is deactivated cannot take work, so the
     alert goes to on-call - and says why, rather than claiming there is no
     owner. */
  if (ownerName && estate().people.some((entry) => entry.name === ownerName)) {
    return { person: escalationPolicy()[1], why: `security on-call - ${ownerName}'s console account is deactivated` };
  }
  return { person: escalationPolicy()[1], why: 'security on-call - no owner on record' };
}

/* ── When ─────────────────────────────────────────────────────────────────── */

/** The fourteen daily discovery runs, oldest first - the same as the scan history. */
function discoveryRuns() {
  const runs = [];
  for (let back = 13; back >= 0; back -= 1) {
    /* Alerts are raised part-way through a run, never before it started. */
    runs.push(ESTATE_META.NOW - back * DAY - 27 * MINUTE + 18 * MINUTE);
  }
  return runs;
}

function raisedAt(conditionAt) {
  const at = Date.parse(conditionAt);
  const runs = discoveryRuns();
  const run = runs.find((time) => time >= at) ?? runs[runs.length - 1];
  return new Date(run).toISOString();
}

const plusDays = (iso, days) => new Date(Date.parse(iso) + days * DAY).toISOString();

/* ── What: the rules ──────────────────────────────────────────────────────── */

export const ALERT_RULES = {
  'nhi-admin-orphaned': { label: 'Administrator-equivalent identity with no owner', source: 'identities' },
  'human-no-mfa': { label: 'Console user without MFA', source: 'identities' },
  'admin-stale': { label: 'Administrator-equivalent identity unused for 90+ days', source: 'identities' },
  'dual-identity': { label: 'IAM user used as a service account', source: 'identities' },
  'credential-critical': { label: 'Critical credential', source: 'credentials' },
  'credential-expired': { label: 'Expired credential still attached', source: 'credentials' },
  'genome-anomaly': { label: 'Behavioural anomaly', source: 'genome' },
  'connector-health': { label: 'Connector health check not passing', source: 'integrations' },
  'secret-exposed': { label: 'Secret committed to a repository', source: 'exposure' },
};

function identityLink(row) {
  return `/identities?search=${encodeURIComponent(row.name)}`;
}

function identityAlerts() {
  const out = [];
  for (const row of estate().identities) {
    const actor = actorTypeMeta(row.identity_type).label;
    const entity = {
      kind: 'Identity',
      name: row.name,
      detail: `${actor} · ${row.account_name}`,
      to: identityLink(row),
      linkLabel: 'Open in Identities',
    };
    const common = { source: 'identities', entity, account: row.account_name, ownerName: row.owner_name, identityId: row.id };

    if (row.classification !== 'HUMAN' && row.is_admin && row.owner_type === 'ORPHANED') {
      out.push({
        ...common,
        rule: 'nhi-admin-orphaned',
        severity: 'CRITICAL',
        conditionAt: row.discovered_at,
        title: `Administrator-equivalent ${actor.toLowerCase()} with no owner`,
        summary: `${row.name} holds an administrator-equivalent policy and no owner, team or creator could be resolved for it.`,
        impact: 'Full control of the account, and nobody to ask whether it is still needed or who would notice it being misused.',
        recommendation: `Find who deployed it${row.created_by_name ? ` - CloudTrail names ${row.created_by_name} as its creator` : ''}, record an owner tag, and replace AdministratorAccess with a policy scoped to what it calls.`,
        evidence: [
          { label: 'Attached policies', value: (row.attached_policies ?? []).join(', ') },
          { label: 'Owner', value: 'None resolved from tags or CloudTrail' },
          { label: 'Last active', value: `${row.last_active_days} days ago` },
        ],
      });
    }

    if (row.classification === 'HUMAN' && !row.mfa_enabled) {
      out.push({
        ...common,
        rule: 'human-no-mfa',
        severity: row.is_admin ? 'CRITICAL' : 'HIGH',
        conditionAt: row.discovered_at,
        title: row.is_admin ? 'Administrator console user without MFA' : 'Console user without MFA',
        summary: `${row.name} can sign in to the console with a password alone.`,
        impact: row.is_admin
          ? 'A phished or reused password is a full administrator session.'
          : 'A phished or reused password is a console session with everything this user can reach.',
        recommendation: 'Require MFA for this user, or move it to federated sign-in through the identity provider.',
        evidence: [
          { label: 'MFA', value: 'Not enabled' },
          { label: 'Password age', value: `${row.password_age_days} days` },
          { label: 'Administrator', value: row.is_admin ? 'Yes' : 'No' },
        ],
      });
    }

    if (row.is_admin && row.last_active_days > 90 && row.owner_type !== 'ORPHANED') {
      out.push({
        ...common,
        rule: 'admin-stale',
        severity: 'HIGH',
        conditionAt: plusDays(row.last_active, 90),
        title: `Administrator-equivalent identity unused for ${row.last_active_days} days`,
        summary: `${row.name} has administrator-equivalent access and no recorded activity for ${row.last_active_days} days.`,
        impact: 'Standing access nobody is using is access nobody would miss - and nobody would notice being used.',
        recommendation: `Confirm with ${row.owner_name ?? 'the owner'} whether it is still needed; remove it, or remove the administrator policy.`,
        evidence: [
          { label: 'Last active', value: `${row.last_active_days} days ago` },
          { label: 'Attached policies', value: (row.attached_policies ?? []).join(', ') },
        ],
      });
    }

    if (row.classification === 'DUAL_IDENTITY') {
      out.push({
        ...common,
        rule: 'dual-identity',
        severity: 'MEDIUM',
        conditionAt: row.discovered_at,
        title: 'IAM user used as a service account',
        summary: `${row.name} is an IAM user with console access that is also used by a workload.`,
        impact: 'A person and a machine share one set of credentials, so a key rotation breaks the workload and a leaver keeps its access.',
        recommendation: 'Move the workload to a role it assumes, and leave the user to the person.',
        evidence: [
          { label: 'Console access', value: row.console_access ? 'Yes' : 'No' },
          { label: 'Long-lived keys', value: String(row.access_key_count ?? 0) },
        ],
      });
    }
  }
  return out;
}

function credentialAlerts() {
  const { credentials, byArn } = estate();
  const out = [];
  for (const credential of credentials) {
    const identity = byArn.get(credential.identity_arn);
    const kind = credentialKindMeta(credential.type).label;
    const entity = {
      kind: 'Credential',
      name: credential.cred_id,
      detail: `${kind} · held by ${credential.identity_name}`,
      to: `/credentials?search=${encodeURIComponent(credential.cred_id)}`,
      linkLabel: 'Open in Credentials',
    };
    const common = {
      source: 'credentials',
      entity,
      account: credential.account_name,
      ownerName: identity?.owner_name ?? null,
      identityId: identity?.id ?? null,
    };

    if (credential.severity === 'CRITICAL') {
      const isRole = credential.type === 'ASSUMED_ROLE';
      out.push({
        ...common,
        rule: 'credential-critical',
        severity: 'CRITICAL',
        conditionAt: isRole
          ? plusDays(credential.last_used_date, 90)
          : plusDays(credential.created_at, 365),
        title: isRole
          ? `Administrator role unused for ${credential.last_used_days} days`
          : `Administrator access key ${credential.age_days} days old`,
        summary: isRole
          ? `${credential.cred_id} carries administrator-equivalent permissions and has not been assumed for ${credential.last_used_days} days.`
          : `${credential.cred_id} is a long-lived key on an administrator-equivalent identity, created ${credential.age_days} days ago and never rotated.`,
        impact: isRole
          ? 'Full permissions nobody is exercising. A role this broad that nothing uses is pure exposure.'
          : 'A key that never expires, with full permissions, old enough to have been copied anywhere it was ever used.',
        recommendation: isRole
          ? 'Remove the administrator policy, or delete the role if the workload behind it is gone.'
          : 'Rotate the key now, then replace it with a role the workload assumes so there is no key to rotate.',
        evidence: [
          { label: 'Type', value: kind },
          { label: 'Age', value: `${credential.age_days} days` },
          { label: 'Last used', value: `${credential.last_used_days} days ago` },
        ],
      });
    }

    if (credential.status === 'EXPIRED' && credential.expires_at) {
      const expiredDays = Math.max(1, Math.round((ESTATE_META.NOW - Date.parse(credential.expires_at)) / DAY));
      out.push({
        ...common,
        rule: 'credential-expired',
        severity: 'HIGH',
        conditionAt: credential.expires_at,
        title: `${kind} expired ${expiredDays} days ago`,
        summary: `${credential.cred_id} passed its expiry ${expiredDays} days ago and is still attached to ${credential.identity_name}.`,
        impact: 'Either the workload is already failing, or it has switched to a credential nobody has recorded.',
        recommendation: 'Rotate it and confirm the workload picked up the new value; remove the old one once nothing references it.',
        evidence: [
          { label: 'Type', value: kind },
          { label: 'Expired', value: `${expiredDays} days ago` },
        ],
      });
    }
  }
  return out;
}

function genomeAlerts() {
  const byId = new Map(estate().identities.map((row) => [row.id, row]));
  const fleet = new Map(genomeFleet().map((row) => [row.id, row]));
  return genomeAnomalies().map((anomaly) => {
    const row = byId.get(anomaly.identityId);
    return {
      source: 'genome',
      rule: 'genome-anomaly',
      anomalyId: anomaly.id,
      anomalyStatus: anomaly.status,
      anomalyDecidedAt: anomaly.decidedAt ?? null,
      severity: anomaly.severity,
      conditionAt: anomaly.detectedAt,
      createdAt: anomaly.detectedAt,
      title: anomaly.title,
      summary: `${anomaly.identityName}: ${anomaly.observed.headline} - ${anomaly.observed.detail}.`,
      impact: anomaly.rationale,
      recommendation:
        'Confirm with the owner whether the change was planned. If it was not, rotate what the identity holds and review what it touched.',
      evidence: [
        { label: 'Baseline', value: `${anomaly.baseline.headline} (${anomaly.baseline.detail})` },
        { label: 'Observed', value: `${anomaly.observed.headline} (${anomaly.observed.detail})` },
        { label: 'Confidence', value: `${Math.round((anomaly.confidence ?? 0) * 100)}%` },
      ],
      entity: {
        kind: 'Identity',
        name: anomaly.identityName,
        detail: `${fleet.get(anomaly.identityId)?.kind ?? 'Machine identity'} · ${anomaly.account}`,
        to: `/genome/${encodeURIComponent(anomaly.identityId)}`,
        linkLabel: 'Open in NHI Genome',
      },
      account: anomaly.account,
      ownerName: row?.owner_name ?? null,
      identityId: anomaly.identityId,
    };
  });
}

function connectorAlerts() {
  const results = awsCheckResults();
  return Object.entries(results)
    .filter(([, result]) => result.state !== 'pass')
    .map(([key, result]) => ({
      source: 'integrations',
      rule: 'connector-health',
      checkKey: key,
      severity: result.state === 'fail' ? 'HIGH' : 'MEDIUM',
      /* The condition has held since the connector was set up, so the first
         run raised it. */
      conditionAt: new Date(discoveryRuns()[0]).toISOString(),
      title: result.alert,
      summary: result.note,
      impact:
        key === 'organisation'
          ? 'Every edge the access graph draws is what the identity and resource policies allow, before any organisation-level deny.'
          : key === 'accounts'
            ? 'Identities in that account are not in any count, graph or alert in this console.'
            : 'Baselines cannot see past 90 days, so long-idle identities read as never used.',
      recommendation:
        key === 'organisation'
          ? 'Grant the organisation read permissions in a delegated administrator account.'
          : key === 'accounts'
            ? 'Deploy the discovery role to the account - the Deploy tab has the StackSet commands.'
            : 'Turn on a multi-region organisation trail.',
      evidence: [{ label: 'Check result', value: result.note }],
      entity: {
        kind: 'Connector',
        name: 'Amazon Web Services',
        detail: `Health check: ${key}`,
        to: '/integrations?configure=aws&tab=health',
        linkLabel: 'Open the health checks',
      },
      account: null,
      ownerName: null,
      verifiedAt: AWS_VERIFIED_AT,
    }));
}

/* ── How it starts: seeded triage ─────────────────────────────────────────── */

const RAISED_BY = {
  identities: 'Discovery run',
  credentials: 'Discovery run',
  genome: 'NHI Genome',
  integrations: 'Connector health check',
  exposure: 'Secret scanner',
};

function hash01(value) {
  return rng(hashSeed(value))();
}

/**
 * What had already happened to an alert before the operator opened the page.
 *
 * Deterministic per alert, so the queue is the same on every load, and every
 * seeded state comes with the activity that produced it: an alert that reads
 * "acknowledged by Priya Raghavan" has an entry saying when she did it. A
 * queue where everything is untouched, or where states appear with no
 * history, is not what a queue two weeks into a deployment looks like.
 */
export function seedTriage(alert, now = ESTATE_META.NOW) {
  const h = hash01(`triage:${alert.id}`);
  const created = Date.parse(alert.createdAt);
  const route = routeTo(alert.ownerName);
  const activity = [
    {
      at: alert.createdAt,
      actor: RAISED_BY[alert.source] ?? 'Console',
      kind: 'created',
      text: `Raised by rule: ${ALERT_RULES[alert.rule]?.label ?? alert.rule}.`,
    },
  ];
  const at = (minutes) => new Date(Math.min(now - MINUTE, created + minutes * MINUTE)).toISOString();

  /* The estate's own assignments come first: an identity already recorded as
     assigned to the operator has its alerts on the operator's list. */
  const identity = alert.identityId ? estate().identities.find((row) => row.id === alert.identityId) : null;
  if (identity?.assigned_to === OPERATOR.user) {
    activity.push({ at: at(4), actor: 'Routing rule', kind: 'assigned', text: `Assigned to ${OPERATOR.name} - the identity is on their list.` });
    const started = h < 0.4;
    activity.push({ at: at(35), actor: OPERATOR.name, kind: 'acknowledged', text: 'Acknowledged.' });
    if (started) activity.push({ at: at(180), actor: OPERATOR.name, kind: 'started', text: 'Work started.' });
    return { status: started ? 'in_progress' : 'acknowledged', assignee: OPERATOR.user, escalationLevel: 1, activity };
  }

  const assignedShare = alert.severity === 'CRITICAL' ? 0.65 : alert.severity === 'HIGH' ? 0.55 : 0.4;
  if (h >= assignedShare) {
    /* Left in the queue: New and unassigned, which is the state triage exists for. */
    return { status: 'new', assignee: null, escalationLevel: 1, activity };
  }

  activity.push({
    at: at(3),
    actor: 'Routing rule',
    kind: 'assigned',
    text: `Assigned to ${route.person.name} - ${route.why}.`,
  });
  const acknowledged = h < assignedShare * 0.7;
  if (!acknowledged) return { status: 'new', assignee: route.person.user, escalationLevel: 1, activity };

  activity.push({ at: at(intBetween(rng(hashSeed(`ack:${alert.id}`)), 12, 50)), actor: route.person.name, kind: 'acknowledged', text: 'Acknowledged.' });
  if (h < assignedShare * 0.3) {
    activity.push({ at: at(240), actor: route.person.name, kind: 'started', text: 'Work started.' });
    return { status: 'in_progress', assignee: route.person.user, escalationLevel: 1, activity };
  }
  return { status: 'acknowledged', assignee: route.person.user, escalationLevel: 1, activity };
}

/* ── The store ────────────────────────────────────────────────────────────── */

function readStore() {
  return readOverlay(OVERLAY_KEYS.alerts, {});
}

export function alertTriageStore() {
  return readStore();
}

/* A genome alert's open/closed state is the anomaly's; see the header. */
const ANOMALY_TO_ALERT = {
  open: 'new',
  acknowledged: 'acknowledged',
  expected: 'dismissed',
  suppressed: 'dismissed',
  resolved: 'resolved',
};

function genomeStatus(alert, entry) {
  const status = ANOMALY_TO_ALERT[alert.anomalyStatus] ?? 'new';
  if (status === 'acknowledged' && entry?.inProgress) return 'in_progress';
  return status;
}

/**
 * Every estate-derived alert, raised, seeded and with stored triage applied.
 *
 * Exposure alerts are not here - they are built in the page from the live
 * scanner feed, with the same `applyTriage` and the store this returns.
 */
export function estateAlerts(now = Date.now()) {
  const store = readStore();
  const policy = escalationPolicy();
  const raised = [...identityAlerts(), ...credentialAlerts(), ...genomeAlerts(), ...connectorAlerts()];

  return raised.map((raw) => {
    const id = `${raw.rule}:${raw.anomalyId ?? raw.checkKey ?? raw.identityId ?? raw.entity.name}${
      raw.source === 'credentials' ? `:${raw.entity.name}` : ''
    }`;
    const createdAt = raw.createdAt ?? raisedAt(raw.conditionAt);
    const base = { ...raw, id, createdAt };
    const seeded = seedTriage(base);
    const entry = store[id];

    if (raw.source === 'genome') {
      /* Status from the anomaly; assignment, escalation and notes from here. */
      const status = genomeStatus(raw, entry);
      const activity = [...seeded.activity];
      const decidedHere = (entry?.activity ?? []).some(
        (item) => raw.anomalyDecidedAt && Math.abs(Date.parse(item.at) - Date.parse(raw.anomalyDecidedAt)) < 5_000,
      );
      if (raw.anomalyDecidedAt && !decidedHere) {
        activity.push({
          at: raw.anomalyDecidedAt,
          actor: 'NHI Genome',
          kind: status === 'resolved' ? 'resolved' : status === 'dismissed' ? 'dismissed' : 'acknowledged',
          text: `Marked ${raw.anomalyStatus} on the NHI Genome screen.`,
        });
      }
      return applyTriage(
        {
          ...base,
          ...seeded,
          status,
          dismissReason:
            raw.anomalyStatus === 'expected' ? 'expected' : raw.anomalyStatus === 'suppressed' ? entry?.dismissReason ?? 'accepted_risk' : null,
          activity,
        },
        entry ? { ...entry, status: undefined } : null,
        policy,
        now,
      );
    }

    return applyTriage({ ...base, ...seeded }, entry, policy, now);
  });
}

/* ── Changing it ──────────────────────────────────────────────────────────── */

const ACTIONS = ['assign', 'acknowledge', 'start', 'resolve', 'dismiss', 'reopen', 'escalate', 'comment'];

/**
 * Apply one action to one or more alerts.
 *
 * `alerts` are the alerts as the page currently holds them - with their merged
 * state - because the result of an action depends on it: acknowledging an
 * unassigned alert assigns it to whoever acknowledged it, and escalating moves
 * from whatever level it is at now, automatic escalation included.
 * Returns the ids that changed. Throws on a request that cannot be honoured,
 * so the screen can say why instead of silently doing half of it.
 */
export function applyAlertAction({ alerts, action, assignee = null, reason = null, note = '' }) {
  if (!ACTIONS.includes(action)) throw new Error(`Unknown alert action: ${action}`);
  if (action === 'dismiss' && !reason) throw new Error('Choose a reason to dismiss.');
  if (action === 'comment' && !note.trim()) throw new Error('Write a note first.');

  /* Checked before anything is written, the way the API would refuse the
     whole request rather than apply part of it. */
  const me = assertCan('data.view');
  assertCan(permissionFor(action, { alerts, assignee, actorUser: me.user }));
  if (['resolve', 'dismiss', 'reopen'].includes(action) && alerts.some((alert) => alert.source === 'exposure')) {
    assertCan('exposure.review');
  }

  const store = readStore();
  const policy = escalationPolicy();
  const people = new Map(alertPeople().map((person) => [person.user, person]));
  if (action === 'assign' && assignee && !people.has(assignee)) {
    throw new Error('That person cannot be assigned alerts.');
  }
  const actor = me.name;
  const nowIso = new Date().toISOString();
  const changed = [];
  const trimmed = note.trim();

  for (const alert of alerts) {
    const entry = { ...(store[alert.id] ?? {}) };
    const log = [...(entry.activity ?? [])];
    /* `target` is who an assignment or escalation lands on, which is what
       the notification bell reads; the title travels with it so the bell
       needs nothing but this store. */
    const push = (kind, text, target = null) =>
      log.push({
        at: nowIso,
        actor,
        actorUser: me.user,
        kind,
        text: trimmed && kind !== 'comment' ? `${text} Note: ${trimmed}` : text,
        ...(target ? { target, alertTitle: alert.title, severity: alert.severity } : {}),
      });
    /* A closed alert takes only a reopen or a note. Everything else would be a
       change to something that is no longer being worked. */
    if (!isOpen(alert) && !['reopen', 'comment'].includes(action)) continue;
    if (isOpen(alert) && action === 'reopen') continue;

    /* Automatic escalation is derived, not stored - until somebody acts on
       the alert. From then on it is fixed where it stands, with its timeline
       entry, so that the action being taken now (an explicit assignment, say)
       is not overwritten by the derivation running again on the next render. */
    if (alert.autoEscalated && entry.escalationLevel === undefined) {
      entry.escalationLevel = alert.escalationLevel;
      if (!('assignee' in entry)) entry.assignee = alert.assignee;
      const automatic = alert.activity.find((item) => item.actor === 'Escalation policy');
      if (automatic) log.unshift(automatic);
    }

    switch (action) {
      case 'assign': {
        if ((alert.assignee ?? null) === (assignee ?? null)) continue;
        entry.assignee = assignee;
        push('assigned', assignee ? `Assigned to ${people.get(assignee)?.name ?? assignee}.` : 'Unassigned.', assignee);
        break;
      }
      case 'acknowledge': {
        if (alert.status !== 'new') continue;
        entry.status = 'acknowledged';
        /* Acknowledging is "I have this", so an unowned alert becomes the
           acknowledger's, the way an on-call tool assigns it. */
        if (!alert.assignee) entry.assignee = me.user;
        push('acknowledged', 'Acknowledged.');
        break;
      }
      case 'start': {
        if (alert.status === 'in_progress') continue;
        entry.status = 'in_progress';
        if (!alert.assignee) entry.assignee = me.user;
        push('started', 'Work started.');
        break;
      }
      case 'resolve': {
        entry.status = 'resolved';
        entry.closedAt = nowIso;
        push('resolved', 'Resolved at the source.');
        break;
      }
      case 'dismiss': {
        entry.status = 'dismissed';
        entry.dismissReason = reason;
        entry.closedAt = nowIso;
        push('dismissed', `Dismissed: ${reason.replace(/_/g, ' ')}.`);
        break;
      }
      case 'reopen': {
        entry.status = 'new';
        entry.dismissReason = null;
        entry.closedAt = null;
        /* Both clocks restart: a reopened alert is a new problem to respond
           to, not an old one that was late all along. */
        entry.openedAt = nowIso;
        push('reopened', 'Reopened.');
        break;
      }
      case 'escalate': {
        const level = alert.escalationLevel ?? 1;
        if (level >= 3) continue;
        const target = policy[level + 1];
        entry.escalationLevel = level + 1;
        entry.assignee = target.user;
        push('escalated', `Escalated to level ${level + 1}, ${target.name} (${target.role}).`, target.user);
        break;
      }
      case 'comment': {
        log.push({ at: nowIso, actor, actorUser: me.user, kind: 'comment', text: trimmed });
        break;
      }
      default:
        continue;
    }

    /* Genome alerts write their status back to the anomaly, so the genome
       screen shows the same decision. */
    if (alert.source === 'genome' && alert.anomalyId) {
      if (action === 'acknowledge') setAnomalyStatus(alert.anomalyId, 'acknowledged');
      if (action === 'start') {
        setAnomalyStatus(alert.anomalyId, 'acknowledged');
        entry.inProgress = true;
      }
      if (action === 'resolve') setAnomalyStatus(alert.anomalyId, 'resolved', trimmed || null);
      if (action === 'dismiss') {
        setAnomalyStatus(alert.anomalyId, reason === 'expected' ? 'expected' : 'suppressed', trimmed || null);
      }
      if (action === 'reopen') {
        setAnomalyStatus(alert.anomalyId, 'open');
        entry.inProgress = false;
      }
    }

    /* A closed exposure alert no longer exists in the live feed once the
       allowlist write lands, so it keeps a copy of itself to be listed with. */
    if (alert.source === 'exposure' && (action === 'resolve' || action === 'dismiss')) {
      entry.snapshot = {
        rule: alert.rule,
        source: alert.source,
        severity: alert.severity,
        title: alert.title,
        summary: alert.summary,
        impact: alert.impact,
        recommendation: alert.recommendation,
        evidence: alert.evidence,
        entity: alert.entity,
        account: alert.account,
        createdAt: alert.createdAt,
        finding: alert.finding,
        /* Only what was raised. Everything done since lives in the entry's own
           activity, which is appended when the alert is rebuilt - copying the
           merged timeline here printed every event twice. */
        activity: alert.activity.filter((item) => item.kind === 'created'),
      };
    }

    entry.activity = log;
    store[alert.id] = entry;
    changed.push(alert.id);
  }

  if (changed.length > 0) writeOverlay(OVERLAY_KEYS.alerts, store);
  return changed;
}
