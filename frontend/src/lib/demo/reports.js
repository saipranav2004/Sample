import { OVERLAY_KEYS, demoRequest, hashSeed, intBetween, pick, readOverlay, rng, writeOverlay } from './runtime';
import { ACTOR_CATEGORIES, ACTOR_CATEGORY_ORDER, credentialKindMeta } from '../domain';
import { isOpen, responseState } from '../alerts';
import { OPERATOR } from './estate';
import { effectiveEstate } from './effective';
import { assertCan, currentUserRow } from './users';
import { forbidden, roleCan } from '../roles';
import { estateAlerts } from './alerts';
import { ANOMALY_TYPES, genomeAnomalies, genomeFleet } from './genome';

/**
 * Reports demo dataset.
 *
 * The model has three parts, and they are separate on purpose:
 *
 *   Library    the report types this product can produce. Fixed catalogue.
 *   Scheduled  standing instructions to produce one on a cadence.
 *   History    runs that have actually happened, each with an outcome.
 *
 * Generating and scheduling write to localStorage, so a report generated here
 * is still in History after a reload, and a schedule still shows its next run.
 * Without that persistence every button on the screen would be theatre.
 *
 * A generated run moves through `queued` then `running` then `ready`, on real
 * timers, because the interesting states of a reporting screen are the ones
 * that are not "done".
 */

export const REPORT_FORMATS = {
  pdf: { label: 'PDF', hint: 'Paginated, for distribution' },
  csv: { label: 'CSV', hint: 'One row per record, for analysis' },
  json: { label: 'JSON', hint: 'Full fidelity, for pipelines' },
};

export const CADENCES = {
  daily: { label: 'Daily', hint: 'Every morning at the chosen hour' },
  weekly: { label: 'Weekly', hint: 'Every Monday' },
  monthly: { label: 'Monthly', hint: 'First of the month' },
  quarterly: { label: 'Quarterly', hint: 'First of the quarter' },
};

export const RUN_STATUSES = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'medium' },
  ready: { label: 'Ready', tone: 'low' },
  failed: { label: 'Failed', tone: 'critical' },
};

/**
 * The catalogue. Each entry declares what it covers and which sections it
 * produces, so the preview is generated from the definition rather than being
 * a separate fiction to keep in sync.
 */
export const REPORT_TEMPLATES = [
  {
    id: 'executive-summary',
    name: 'Executive summary',
    audience: 'Leadership',
    purpose: 'The risk signals, the alerts that matter most, and what needs a decision.',
    cadenceHint: 'monthly',
    formats: ['pdf'],
    sections: [
      { key: 'posture', title: 'Risk signals' },
      { key: 'top-risks', title: 'Top risks in the alert queue' },
      { key: 'movement', title: 'What changed this week' },
      { key: 'asks', title: 'Decisions waiting on leadership' },
    ],
  },
  {
    id: 'identity-inventory',
    name: 'Identity inventory',
    audience: 'Platform owners',
    purpose: 'Every identity by what it is, which account it lives in, and who owns it.',
    cadenceHint: 'weekly',
    formats: ['csv', 'json', 'pdf'],
    sections: [
      { key: 'by-category', title: 'Identities by actor category' },
      { key: 'by-account', title: 'Identities by account' },
      { key: 'ownerless', title: 'Identities with no resolved owner' },
      { key: 'full', title: 'Full record listing' },
    ],
  },
  {
    id: 'credential-hygiene',
    name: 'Credential hygiene',
    audience: 'Security operations',
    purpose: 'Credential age, long-lived credentials, dormant ones, and the order to rotate them in.',
    cadenceHint: 'weekly',
    formats: ['csv', 'pdf'],
    sections: [
      { key: 'age', title: 'Credential age distribution' },
      { key: 'long-lived', title: 'Long-lived credentials' },
      { key: 'dormant', title: 'Dormant beyond 90 days' },
      { key: 'plan', title: 'Suggested rotation order' },
    ],
  },
  {
    id: 'credential-exposure',
    name: 'Credential exposure',
    audience: 'Security operations',
    purpose: 'Secrets committed to repositories, by platform, risk tier and review state.',
    cadenceHint: 'daily',
    formats: ['csv', 'pdf', 'json'],
    /* Every section here is read from the Secret Scanner when the report is
       opened, because the scanner is the only place these figures exist. */
    sections: [
      { key: 'by-platform', title: 'Exposure by platform', live: 'exposure' },
      { key: 'by-tier', title: 'Exposure by risk tier', live: 'exposure' },
      { key: 'review', title: 'Reviewed and accepted', live: 'exposure' },
      { key: 'detail', title: 'Finding-level detail', live: 'exposure' },
    ],
  },
  {
    id: 'behavioural-anomalies',
    name: 'Behavioural anomalies',
    audience: 'Detection engineering',
    purpose: 'Genome anomalies by type and disposition, and how much of the fleet has a baseline.',
    cadenceHint: 'weekly',
    formats: ['csv', 'json'],
    sections: [
      { key: 'by-type', title: 'Anomalies by type' },
      { key: 'disposition', title: 'How anomalies were dispositioned' },
      { key: 'baselines', title: 'Baseline coverage' },
      { key: 'outliers', title: 'Identities with open anomalies' },
    ],
  },
  {
    id: 'over-permissioned',
    name: 'Over-permissioned access',
    audience: 'Platform owners',
    purpose: 'Administrator-equivalent access, and where it is standing but unused.',
    cadenceHint: 'monthly',
    formats: ['csv', 'pdf'],
    sections: [
      { key: 'admin', title: 'Administrator-equivalent identities' },
      { key: 'standing', title: 'Standing access nobody is using' },
      { key: 'admin-keys', title: 'Administrator access through long-lived keys' },
      { key: 'recommend', title: 'Where to reduce first' },
    ],
  },
  {
    id: 'audit-evidence',
    name: 'Audit evidence',
    audience: 'Audit and GRC',
    purpose: 'How alerts were handled against their response targets, and every risk accepted with its reason.',
    cadenceHint: 'quarterly',
    formats: ['pdf'],
    sections: [
      { key: 'response', title: 'Alerts against response targets' },
      { key: 'accepted', title: 'Accepted risks' },
      { key: 'ownership', title: 'Ownership coverage' },
      { key: 'attestation', title: 'Scope of this attestation' },
    ],
  },
];

export function templateById(id) {
  return REPORT_TEMPLATES.find((template) => template.id === id) ?? null;
}

/* A report built from the Secret Scanner shows exposed credentials, so it is
   offered only to roles that may open them - the same line the navigation
   draws. Filtered here, where the API would filter it, rather than hidden in
   the page after the fact. */
const exposureOnly = (template) => Boolean(template?.sections.some((section) => section.live === 'exposure'));

function mayRead(templateId) {
  const template = templateById(templateId);
  if (!exposureOnly(template)) return true;
  const me = currentUserRow();
  return Boolean(me) && roleCan(me.role, 'exposure.view');
}

const visibleRuns = () => readRuns().filter((run) => mayRead(run.templateId));
const visibleSchedules = () => readSchedules().filter((schedule) => mayRead(schedule.templateId));

/* ── Persisted state ──────────────────────────────────────────────────────── */

/**
 * Schedules are the user's, from the first one they create.
 *
 * Unlike History, an empty Scheduled tab is not a dead end - it is the
 * accurate answer to "what is being produced without anyone asking", and the
 * tab's empty state points straight at the control that fills it. Seeding it
 * would also claim someone had configured recipients who never agreed to
 * receive anything.
 */
function readSchedules() {
  return readOverlay(OVERLAY_KEYS.schedules, null) ?? [];
}

function readRuns() {
  return readOverlay(OVERLAY_KEYS.runs, null) ?? seedRuns();
}

/* History is seeded so the screen can show what a produced report looks like,
   including one failure - an empty History teaches nothing. Schedules are not
   seeded (see `readSchedules`). The seed is written through the same overlay
   the user's own actions write to, so there is no second code path. */
function seedRuns() {
  const next = rng(hashSeed('runs'));

  /* A month of history rather than a handful of runs.
     Eight runs across seven report types is not what a month looks like in a
     product anybody is using, and it left the History tab with nothing to
     page through. This is six weeks of manual runs at a realistic rate, with
     the failures spread through it rather than parked at one index - a single
     failure at a fixed position reads as a placeholder. */
  const ROTATION = [
    'credential-exposure',
    'executive-summary',
    'identity-inventory',
    'credential-hygiene',
    'audit-evidence',
    'over-permissioned',
    'behavioural-anomalies',
  ];
  const picks = Array.from({ length: 46 }, (_, index) => ROTATION[index % ROTATION.length]);

  /* Inside the discovery window. Discovery has run daily for fourteen days,
     so a report from six weeks ago - which the previous seed produced - would
     be a report about data that did not exist yet. Forty-six runs over
     thirteen days is three or four a day, which is what a team using this
     looks like. */
  let hoursBack = 2;
  const seeded = picks.map((templateId, index) => {
    const template = templateById(templateId);
    /* Roughly one run in nine fails, decided by the seed rather than by
       position, so the outcome column varies down the list. */
    const failed = next() < 0.11;
    const rowCount = rowsFor(templateId, next);
    const startedAt = hoursAgoIso(hoursBack);
    hoursBack += intBetween(next, 4, 9);
    return {
      id: `run-seed-${index + 1}`,
      templateId,
      templateName: template.name,
      format: template.formats[0],
      status: failed ? 'failed' : 'ready',
      /* All manual: the Scheduled tab starts empty, so a seeded run claiming a
         schedule produced it would contradict the screen next to it. */
      trigger: 'manual',
      requestedBy: OPERATOR.name,
      startedAt,
      durationMs: intBetween(next, 1400, 9200),
      rows: failed ? null : rowCount,
      sizeKb: failed ? null : fileSize(rowCount, template.formats[0]),
      error: failed
        ? pick(next, [
            'The Secret Scanner did not respond in time, so the exposure sections could not be filled.',
            'The identity inventory query exceeded the read timeout.',
            'Rendering failed: a section returned no rows and the template requires one.',
            'The delivery target rejected the attachment as too large.',
          ])
        : null,
    };
  });
  writeOverlay(OVERLAY_KEYS.runs, seeded);
  return seeded;
}

/**
 * How many records a report of this kind contains - the count of what it
 * covers, so an identity inventory has as many rows as there are identities.
 * An exposure report counts scanner findings, which only the scanner knows at
 * the time it ran; those carry a plausible historical figure.
 */
function rowsFor(templateId, next) {
  const { identities, credentials } = effectiveEstate();
  switch (templateId) {
    case 'identity-inventory':
      return identities.length;
    case 'credential-hygiene':
      return credentials.length;
    case 'behavioural-anomalies':
      return genomeAnomalies().length;
    case 'over-permissioned':
      return identities.filter((row) => row.is_admin).length;
    case 'executive-summary':
    case 'audit-evidence':
      return estateAlerts().length;
    default:
      return intBetween(next, 2, 40);
  }
}

/* ── Selectors ────────────────────────────────────────────────────────────── */

export function fetchReportLibrary(signal) {
  return demoRequest(() => {
    const runs = visibleRuns();
    const schedules = visibleSchedules();
    const templates = REPORT_TEMPLATES.filter((template) => mayRead(template.id));
    return {
      templates: templates.map((template) => {
        const forTemplate = runs
          .filter((run) => run.templateId === template.id && run.status === 'ready')
          .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
        return {
          ...template,
          lastGeneratedAt: forTemplate[0]?.startedAt ?? null,
          generatedCount: forTemplate.length,
          scheduled: schedules.some((schedule) => schedule.templateId === template.id && schedule.enabled),
        };
      }),
      totals: {
        templates: templates.length,
        generated30d: runs.filter((run) => withinDays(run.startedAt, 30)).length,
        ready30d: runs.filter((run) => run.status === 'ready' && withinDays(run.startedAt, 30)).length,
        schedules: schedules.filter((schedule) => schedule.enabled).length,
        failed30d: runs.filter((run) => run.status === 'failed' && withinDays(run.startedAt, 30)).length,
      },
    };
  }, { signal });
}

export function fetchSchedules(signal) {
  return demoRequest(() => {
    const rows = visibleSchedules()
      .map((schedule) => ({
        ...schedule,
        templateName: templateById(schedule.templateId)?.name ?? schedule.templateId,
        nextRunAt: schedule.enabled ? nextRun(schedule) : null,
      }))
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.templateName.localeCompare(b.templateName));
    return { rows, total: rows.length };
  }, { signal });
}

export function fetchRuns({ templateId = '', status = '' } = {}, signal) {
  return demoRequest(() => {
    const rows = visibleRuns()
      .filter((run) => (templateId ? run.templateId === templateId : true))
      .filter((run) => (status ? run.status === status : true))
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    return { rows, total: rows.length };
  }, { signal });
}

export function fetchRun(id, signal) {
  return demoRequest(() => {
    const run = readRuns().find((entry) => entry.id === id);
    if (!run) {
      const error = new Error('That report run is no longer available.');
      error.status = 404;
      throw error;
    }
    if (!mayRead(run.templateId)) throw forbidden('exposure.view');
    const template = templateById(run.templateId);
    return { ...run, template, preview: buildPreview(run, template) };
  }, { signal });
}

/* ── Mutations ────────────────────────────────────────────────────────────── */

/**
 * Starts a run and returns immediately with it `queued`. The status advances on
 * timers so the screen shows queued, running and ready in turn - the states a
 * reporting screen actually has to render.
 */
export function generateReport({ templateId, format, trigger = 'manual', requestedBy }) {
  const me = assertCan('reports.generate');
  const template = templateById(templateId);
  if (!template) throw new Error(`Unknown report template: ${templateId}`);
  if (!mayRead(templateId)) throw forbidden('exposure.view');

  const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const next = rng(hashSeed(id));
  const readyRows = rowsFor(templateId, next);
  const run = {
    id,
    templateId,
    templateName: template.name,
    format: format ?? template.formats[0],
    status: 'queued',
    trigger,
    requestedBy: requestedBy ?? me.name,
    startedAt: new Date().toISOString(),
    durationMs: null,
    rows: null,
    sizeKb: null,
    error: null,
  };

  writeOverlay(OVERLAY_KEYS.runs, [run, ...readRuns()]);

  const advance = (status, extra) => {
    const runs = readRuns().map((entry) => (entry.id === id ? { ...entry, status, ...extra } : entry));
    writeOverlay(OVERLAY_KEYS.runs, runs);
  };

  setTimeout(() => advance('running', {}), 900);
  setTimeout(
    () =>
      advance('ready', {
        durationMs: intBetween(next, 1600, 6400),
        rows: readyRows,
        sizeKb: fileSize(readyRows, format ?? template.formats[0]),
      }),
    3200,
  );

  return run;
}

export function saveSchedule(schedule) {
  const me = assertCan('reports.schedule');
  const schedules = readSchedules();
  if (schedule.id) {
    writeOverlay(
      OVERLAY_KEYS.schedules,
      schedules.map((entry) => (entry.id === schedule.id ? { ...entry, ...schedule } : entry)),
    );
    return schedule.id;
  }
  const id = `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  writeOverlay(OVERLAY_KEYS.schedules, [
    { ...schedule, id, enabled: true, createdAt: new Date().toISOString(), createdBy: me.name, lastRunAt: null },
    ...schedules,
  ]);
  return id;
}

export function setScheduleEnabled(id, enabled) {
  assertCan('reports.schedule');
  writeOverlay(
    OVERLAY_KEYS.schedules,
    readSchedules().map((entry) => (entry.id === id ? { ...entry, enabled } : entry)),
  );
}

export function deleteSchedule(id) {
  assertCan('reports.schedule');
  writeOverlay(OVERLAY_KEYS.schedules, readSchedules().filter((entry) => entry.id !== id));
}

export function deleteRun(id) {
  assertCan('reports.schedule');
  writeOverlay(OVERLAY_KEYS.runs, readRuns().filter((entry) => entry.id !== id));
}

/* ── Preview ──────────────────────────────────────────────────────────────── */

/**
 * A report preview built from the template's declared sections, with every
 * figure read from the same estate, alert queue and genome the other screens
 * show.
 *
 * They used to be drawn from ranges - a coverage line of 980 to 1,520
 * identities across two to four accounts, accounts called prod-main and
 * prod-eu, credentials "still valid" or "revoked" - none of which matched the
 * console around them: the estate has 228 identities in six named accounts,
 * and the scanner cannot verify a secret at all. A report is read next to the
 * screens it summarises, so it has to agree with them.
 *
 * Sections marked `live` are read from the Secret Scanner when the report is
 * opened, because the scanner is the only place those figures exist.
 */
function buildPreview(run, template) {
  const { identities, accounts } = effectiveEstate();
  return {
    title: template.name,
    audience: template.audience,
    generatedAt: run.startedAt,
    coverage: { accounts: accounts.length, identities: identities.length, window: '14 daily discovery runs' },
    sections: template.sections.map((section) => ({
      ...section,
      metrics: section.live
        ? []
        : measuresFor(section.key).map(([label, value], index) => ({
            key: `${section.key}-m${index}`,
            label,
            value,
          })),
      note: sectionNote(section.key),
    })),
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function measuresFor(key) {
  const { identities, credentials, accounts } = effectiveEstate();
  const nhis = identities;
  const alerts = estateAlerts();
  const open = alerts.filter(isOpen);
  const anomalies = genomeAnomalies();
  const fleet = genomeFleet();
  const longLived = credentials.filter((row) => credentialKindMeta(row.type).longLived);
  const count = (list, test) => list.filter(test).length;

  switch (key) {
    case 'posture':
      return [
        ['Admin-level access', count(identities, (row) => row.is_admin)],
        ['Orphaned identities', count(identities, (row) => row.owner_type === 'ORPHANED')],
        ['Stale for 90+ days', count(identities, (row) => row.last_active_days > 90)],
      ];
    case 'top-risks': {
      const serious = open.filter((alert) => alert.severity === 'CRITICAL' || alert.severity === 'HIGH');
      return [
        ['Critical alerts open', count(open, (alert) => alert.severity === 'CRITICAL')],
        ['High alerts open', count(open, (alert) => alert.severity === 'HIGH')],
        ['Identities affected', new Set(serious.map((alert) => alert.identityId).filter(Boolean)).size],
        ['Accounts affected', new Set(serious.map((alert) => alert.account).filter(Boolean)).size],
      ];
    }
    case 'movement': {
      const week = Date.now() - 7 * DAY;
      return [
        ['Identities discovered', count(identities, (row) => Date.parse(row.discovered_at) >= week)],
        ['Credentials created', count(credentials, (row) => Date.parse(row.created_at) >= week)],
        ['Alerts raised', count(alerts, (alert) => Date.parse(alert.createdAt) >= week)],
        ['Alerts closed', count(alerts, (alert) => !isOpen(alert) && Date.parse(alert.closedAt ?? 0) >= week)],
      ];
    }
    case 'asks':
      return [
        ['Escalated to the administrator', count(open, (alert) => (alert.escalationLevel ?? 1) >= 3)],
        ['Escalated to the lead', count(open, (alert) => (alert.escalationLevel ?? 1) === 2)],
        ['Risks accepted', count(alerts, (alert) => alert.status === 'dismissed' && alert.dismissReason === 'accepted_risk')],
      ];
    case 'by-category': {
      const tally = new Map();
      for (const row of identities) tally.set(row.actor_category, (tally.get(row.actor_category) ?? 0) + 1);
      return ACTOR_CATEGORY_ORDER.filter((category) => tally.has(category))
        .map((category) => [ACTOR_CATEGORIES[category], tally.get(category)])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    }
    case 'by-account':
      return accounts.map((account) => [account.name, count(identities, (row) => row.account_id === account.id)]);
    case 'ownerless':
      return [
        ['No owner resolved', count(identities, (row) => row.owner_type === 'ORPHANED')],
        ['No team recorded', count(nhis, (row) => !row.team)],
        ['Machine identities in total', nhis.length],
      ];
    case 'full':
      return [
        ['Records', identities.length],
        ['Accounts', accounts.length],
      ];
    case 'age':
      return [
        ['Under 30 days', count(credentials, (row) => row.age_days < 30)],
        ['30 to 90 days', count(credentials, (row) => row.age_days >= 30 && row.age_days < 90)],
        ['90 to 365 days', count(credentials, (row) => row.age_days >= 90 && row.age_days <= 365)],
        ['Over 365 days', count(credentials, (row) => row.age_days > 365)],
      ];
    case 'long-lived':
      return [
        ['Long-lived credentials', longLived.length],
        ['Access keys', count(credentials, (row) => row.type === 'ACCESS_KEY')],
        ['Store entries with no rotation', count(credentials, (row) => row.store && !row.rotation_enabled)],
        ['Keys over a year old', count(credentials, (row) => row.type === 'ACCESS_KEY' && row.age_days > 365)],
      ];
    case 'dormant':
      return [
        ['Unused 90+ days', count(credentials, (row) => row.last_used_days > 90)],
        ['Unused 180+ days', count(credentials, (row) => row.last_used_days > 180)],
        ['Of those, on an administrator', count(credentials, (row) => row.last_used_days > 90 && identities.find((identity) => identity.arn === row.identity_arn)?.is_admin)],
      ];
    case 'plan':
      return [
        ['Act on first (critical)', count(credentials, (row) => row.severity === 'CRITICAL')],
        ['This week (high)', count(credentials, (row) => row.severity === 'HIGH')],
        ['Held by an orphaned identity', count(credentials, (row) => identities.find((identity) => identity.arn === row.identity_arn)?.owner_type === 'ORPHANED')],
      ];
    case 'by-type': {
      const tally = new Map();
      for (const anomaly of anomalies) tally.set(anomaly.type, (tally.get(anomaly.type) ?? 0) + 1);
      return [...tally.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([type, value]) => [ANOMALY_TYPES[type]?.label ?? type, value]);
    }
    case 'disposition':
      return [
        ['Open', count(anomalies, (anomaly) => anomaly.status === 'open')],
        ['Acknowledged', count(anomalies, (anomaly) => anomaly.status === 'acknowledged')],
        ['Expected or suppressed', count(anomalies, (anomaly) => anomaly.status === 'expected' || anomaly.status === 'suppressed')],
        ['Resolved', count(anomalies, (anomaly) => anomaly.status === 'resolved')],
      ];
    case 'baselines':
      return [
        ['Established', count(fleet, (row) => row.baselineState === 'established')],
        ['Learning', count(fleet, (row) => row.baselineState === 'learning')],
        ['Machine identities', fleet.length],
      ];
    case 'outliers': {
      const withOpen = new Set(anomalies.filter((anomaly) => anomaly.status === 'open').map((anomaly) => anomaly.identityId));
      return [
        ['Identities with open anomalies', withOpen.size],
        ['Peer groups', new Set(fleet.map((row) => row.peerGroup)).size],
        ['Anomalies in total', anomalies.length],
      ];
    }
    case 'admin':
      return [
        ['Administrator-equivalent', count(identities, (row) => row.is_admin)],
        ['Of those, signing in without MFA', count(identities, (row) => row.is_admin && row.console_access && !row.mfa_enabled)],
      ];
    case 'standing':
      return [
        ['Administrators unused 90+ days', count(identities, (row) => row.is_admin && row.last_active_days > 90)],
        ['Administrator roles unused 90+ days', count(credentials, (row) => row.type === 'ASSUMED_ROLE' && row.severity === 'CRITICAL')],
        ['Administrators with no owner', count(identities, (row) => row.is_admin && row.owner_type === 'ORPHANED')],
      ];
    case 'admin-keys':
      return [
        ['Administrators holding access keys', count(identities, (row) => row.is_admin && row.access_key_count > 0)],
        ['Of those, a key over a year old', count(identities, (row) => row.is_admin && row.access_key_age_days > 365)],
      ];
    case 'recommend':
      return [
        ['AdministratorAccess attached', count(identities, (row) => (row.attached_policies ?? []).includes('AdministratorAccess'))],
        ['Could move to a role (dual identities)', count(identities, (row) => row.classification === 'DUAL_IDENTITY')],
        ['Critical credentials', count(credentials, (row) => row.severity === 'CRITICAL')],
      ];
    case 'response':
      return [
        ['Open alerts', open.length],
        ['Within response targets', count(open, (alert) => ['on_track', 'due_soon'].includes(responseState(alert).state))],
        ['Past a response target', count(open, (alert) => ['overdue', 'ack_overdue'].includes(responseState(alert).state))],
        ['Closed', count(alerts, (alert) => !isOpen(alert))],
      ];
    case 'accepted':
      return [
        ['Risks accepted', count(alerts, (alert) => alert.status === 'dismissed' && alert.dismissReason === 'accepted_risk')],
        ['Dismissed as false positive', count(alerts, (alert) => alert.status === 'dismissed' && alert.dismissReason === 'false_positive')],
        ['Dismissed as expected', count(alerts, (alert) => alert.status === 'dismissed' && alert.dismissReason === 'expected')],
      ];
    case 'ownership':
      return [
        ['Identities with an owner', count(identities, (row) => row.owner_type !== 'ORPHANED')],
        ['Without one', count(identities, (row) => row.owner_type === 'ORPHANED')],
        ['Open alerts with an assignee', count(open, (alert) => alert.assignee)],
      ];
    case 'attestation':
      return [
        ['Accounts in scope', accounts.length],
        ['Identities in scope', identities.length],
      ];
    default:
      return [];
  }
}

function sectionNote(key) {
  switch (key) {
    case 'posture':
      return 'The same signals, with the same counts, as the Dashboard.';
    case 'top-risks':
      return 'Read from the alert queue: open Critical and High alerts, and the identities and accounts they name.';
    case 'by-tier':
      return 'The scanner cannot check whether a secret still works - verification is unsupported on this deployment - so exposure is reported by risk tier, not by validity.';
    case 'review':
      return 'Accepted findings are the scanner allowlist: reviewed, marked safe, and removed from the live set.';
    case 'response':
      return "Measured against this console's default response targets, which the Alerts screen lists.";
    case 'baselines':
      return 'A baseline is learned per machine identity.';
    case 'accepted':
      return 'Every dismissal records a reason. These are the counts by reason, from the alert queue.';
    default:
      return null;
  }
}

/* File size follows from the row count rather than being rolled separately, so
   a 60-row report cannot come out larger than a 1,400-row one. */
function fileSize(rows, format) {
  const perRow = format === 'pdf' ? 1.1 : format === 'json' ? 0.9 : 0.42;
  return Math.max(12, Math.round(rows * perRow + (format === 'pdf' ? 180 : 8)));
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function nextRun(schedule) {
  const date = new Date();
  date.setUTCHours(schedule.hour ?? 7, 0, 0, 0);
  if (date.getTime() <= Date.now()) date.setUTCDate(date.getUTCDate() + 1);
  if (schedule.cadence === 'weekly') {
    while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
  }
  if (schedule.cadence === 'monthly') {
    date.setUTCMonth(date.getUTCMonth() + (date.getUTCDate() === 1 ? 0 : 1), 1);
  }
  if (schedule.cadence === 'quarterly') {
    const quarterStart = Math.floor(date.getUTCMonth() / 3) * 3 + 3;
    date.setUTCMonth(quarterStart, 1);
  }
  return date.toISOString();
}

function withinDays(iso, days) {
  return Date.now() - new Date(iso).getTime() <= days * 86_400_000;
}
function minutesAgoIso(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
function hoursAgoIso(hours) {
  return minutesAgoIso(hours * 60);
}
