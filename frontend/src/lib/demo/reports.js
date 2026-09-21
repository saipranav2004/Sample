import { OVERLAY_KEYS, demoRequest, hashSeed, intBetween, readOverlay, rng, writeOverlay } from './runtime';

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
    purpose: 'Posture, trend and the top risks, in one page.',
    cadenceHint: 'monthly',
    formats: ['pdf'],
    sections: [
      { key: 'posture', title: 'Posture score and trend' },
      { key: 'top-risks', title: 'Top five risks by blast radius' },
      { key: 'movement', title: 'What changed since the last report' },
      { key: 'asks', title: 'Decisions needed from leadership' },
    ],
  },
  {
    id: 'identity-inventory',
    name: 'Identity inventory',
    audience: 'Platform owners',
    purpose: 'Every non-human identity by category, account and owner.',
    cadenceHint: 'weekly',
    formats: ['csv', 'json', 'pdf'],
    sections: [
      { key: 'by-category', title: 'Identities by category' },
      { key: 'by-account', title: 'Identities by account' },
      { key: 'ownerless', title: 'Identities with no resolved owner' },
      { key: 'full', title: 'Full record listing' },
    ],
  },
  {
    id: 'credential-hygiene',
    name: 'Credential hygiene',
    audience: 'Security operations',
    purpose: 'Key age, rotation history, dormant and never-rotated credentials.',
    cadenceHint: 'weekly',
    formats: ['csv', 'pdf'],
    sections: [
      { key: 'age', title: 'Credential age distribution' },
      { key: 'never-rotated', title: 'Never rotated' },
      { key: 'dormant', title: 'Dormant beyond 90 days' },
      { key: 'plan', title: 'Suggested rotation order' },
    ],
  },
  {
    id: 'credential-exposure',
    name: 'Credential exposure',
    audience: 'Security operations',
    purpose: 'Committed credentials by source, validity and remediation state.',
    cadenceHint: 'daily',
    formats: ['csv', 'pdf', 'json'],
    sections: [
      { key: 'by-source', title: 'Exposure by source' },
      { key: 'validity', title: 'Still-valid versus revoked' },
      { key: 'sla', title: 'Remediation against SLA' },
      { key: 'detail', title: 'Credential-level detail' },
    ],
  },
  {
    id: 'behavioural-anomalies',
    name: 'Behavioural anomalies',
    audience: 'Detection engineering',
    purpose: 'Genome anomalies by type, confidence and disposition.',
    cadenceHint: 'weekly',
    formats: ['csv', 'json'],
    sections: [
      { key: 'by-type', title: 'Anomalies by type' },
      { key: 'disposition', title: 'How anomalies were dispositioned' },
      { key: 'baselines', title: 'Baseline coverage and drift' },
      { key: 'outliers', title: 'Peer-group outliers' },
    ],
  },
  {
    id: 'over-permissioned',
    name: 'Over-permissioned access',
    audience: 'Platform owners',
    purpose: 'Granted versus used, with least-privilege recommendations.',
    cadenceHint: 'monthly',
    formats: ['csv', 'pdf'],
    sections: [
      { key: 'gap', title: 'Granted-versus-used gap' },
      { key: 'admin', title: 'Administrator-equivalent identities' },
      { key: 'unused', title: 'Permissions never exercised' },
      { key: 'recommend', title: 'Recommended policy reductions' },
    ],
  },
  {
    id: 'compliance-audit',
    name: 'Compliance and audit',
    audience: 'Audit and GRC',
    purpose: 'Control-by-control mapping with evidence references.',
    cadenceHint: 'quarterly',
    formats: ['pdf'],
    sections: [
      { key: 'summary', title: 'Control summary by framework' },
      { key: 'failing', title: 'Failing controls with evidence' },
      { key: 'exceptions', title: 'Accepted exceptions' },
      { key: 'attestation', title: 'Attestation page' },
    ],
  },
];

export function templateById(id) {
  return REPORT_TEMPLATES.find((template) => template.id === id) ?? null;
}

/* ── Persisted state ──────────────────────────────────────────────────────── */

function readSchedules() {
  return readOverlay(OVERLAY_KEYS.schedules, null) ?? seedSchedules();
}

function readRuns() {
  return readOverlay(OVERLAY_KEYS.runs, null) ?? seedRuns();
}

/* Seeded once so the screens do not open empty on a first visit - an empty
   History teaches nothing about what a report looks like. Both seeds are
   written through the same overlay the user's own actions write to, so there is
   no second code path. */
function seedSchedules() {
  const next = rng(hashSeed('schedules'));
  const seeded = [
    {
      id: 'sch-seed-1',
      templateId: 'credential-exposure',
      cadence: 'daily',
      hour: 7,
      format: 'pdf',
      recipients: ['secops@example.com'],
      enabled: true,
      createdAt: daysAgoIso(intBetween(next, 20, 60)),
      lastRunAt: hoursAgoIso(intBetween(next, 2, 20)),
    },
    {
      id: 'sch-seed-2',
      templateId: 'executive-summary',
      cadence: 'monthly',
      hour: 9,
      format: 'pdf',
      recipients: ['ciso@example.com', 'platform-leads@example.com'],
      enabled: true,
      createdAt: daysAgoIso(intBetween(next, 60, 140)),
      lastRunAt: daysAgoIso(intBetween(next, 4, 25)),
    },
    {
      id: 'sch-seed-3',
      templateId: 'credential-hygiene',
      cadence: 'weekly',
      hour: 6,
      format: 'csv',
      recipients: ['secops@example.com'],
      enabled: false,
      createdAt: daysAgoIso(intBetween(next, 30, 90)),
      lastRunAt: daysAgoIso(intBetween(next, 10, 40)),
    },
  ];
  writeOverlay(OVERLAY_KEYS.schedules, seeded);
  return seeded;
}

function seedRuns() {
  const next = rng(hashSeed('runs'));
  const picks = ['credential-exposure', 'executive-summary', 'identity-inventory', 'credential-hygiene', 'compliance-audit', 'over-permissioned', 'credential-exposure', 'behavioural-anomalies'];
  const seeded = picks.map((templateId, index) => {
    const template = templateById(templateId);
    const failed = index === 5;
    const rowCount = intBetween(next, 60, 1400);
    return {
      id: `run-seed-${index + 1}`,
      templateId,
      templateName: template.name,
      format: template.formats[0],
      status: failed ? 'failed' : 'ready',
      trigger: index % 3 === 0 ? 'schedule' : 'manual',
      requestedBy: index % 3 === 0 ? 'Scheduled' : 'das_admin',
      startedAt: hoursAgoIso(index * intBetween(next, 5, 30) + 3),
      durationMs: intBetween(next, 1400, 9200),
      rows: rowCount,
      sizeKb: fileSize(rowCount, template.formats[0]),
      error: failed ? 'The compliance mapping service did not respond in time.' : null,
    };
  });
  writeOverlay(OVERLAY_KEYS.runs, seeded);
  return seeded;
}

/* ── Selectors ────────────────────────────────────────────────────────────── */

export function fetchReportLibrary(signal) {
  return demoRequest(() => {
    const runs = readRuns();
    const schedules = readSchedules();
    return {
      templates: REPORT_TEMPLATES.map((template) => {
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
        templates: REPORT_TEMPLATES.length,
        generated30d: runs.filter((run) => withinDays(run.startedAt, 30)).length,
        schedules: schedules.filter((schedule) => schedule.enabled).length,
        failed30d: runs.filter((run) => run.status === 'failed' && withinDays(run.startedAt, 30)).length,
      },
    };
  }, { signal });
}

export function fetchSchedules(signal) {
  return demoRequest(() => {
    const rows = readSchedules()
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
    const rows = readRuns()
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
export function generateReport({ templateId, format, trigger = 'manual', requestedBy = 'das_admin' }) {
  const template = templateById(templateId);
  if (!template) throw new Error(`Unknown report template: ${templateId}`);

  const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const next = rng(hashSeed(id));
  const readyRows = intBetween(next, 60, 1400);
  const run = {
    id,
    templateId,
    templateName: template.name,
    format: format ?? template.formats[0],
    status: 'queued',
    trigger,
    requestedBy,
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
    { ...schedule, id, enabled: true, createdAt: new Date().toISOString(), lastRunAt: null },
    ...schedules,
  ]);
  return id;
}

export function setScheduleEnabled(id, enabled) {
  writeOverlay(
    OVERLAY_KEYS.schedules,
    readSchedules().map((entry) => (entry.id === id ? { ...entry, enabled } : entry)),
  );
}

export function deleteSchedule(id) {
  writeOverlay(OVERLAY_KEYS.schedules, readSchedules().filter((entry) => entry.id !== id));
}

export function deleteRun(id) {
  writeOverlay(OVERLAY_KEYS.runs, readRuns().filter((entry) => entry.id !== id));
}

export function resetReportState() {
  writeOverlay(OVERLAY_KEYS.schedules, seedSchedules());
  writeOverlay(OVERLAY_KEYS.runs, seedRuns());
}

/* ── Preview ──────────────────────────────────────────────────────────────── */

/**
 * A report preview built from the template's own declared sections, so adding a
 * section to the catalogue adds it to the preview. Figures are seeded from the
 * run id: the same run always previews identically.
 */
function buildPreview(run, template) {
  const next = rng(hashSeed(run.id));
  return {
    title: template.name,
    audience: template.audience,
    generatedAt: run.startedAt,
    /* Kept in the same order of magnitude as the per-account and per-category
       measures below, so a reader adding up the sections does not land a
       thousand identities away from the coverage line. */
    coverage: { accounts: intBetween(next, 2, 4), identities: intBetween(next, 980, 1520), window: '30 days' },
    sections: template.sections.map((section) => ({
      ...section,
      metrics: sectionMeasures(section.key).map(([label, min, max], index) => {
        const value = intBetween(next, min, max);
        /* The change is a share of the measure, not a fixed span: +34 against a
           posture score of 62 would be a different report. */
        const swing = Math.max(1, Math.round(value * 0.12));
        return {
          key: `${section.key}-m${index}`,
          label,
          value,
          delta: intBetween(next, -swing, swing),
        };
      }),
      note: sectionNote(section.key),
    })),
  };
}

/**
 * Every measure a section reports, with the range its value is drawn from.
 *
 * The range is declared per measure rather than shared, because a median in
 * days and a count of repositories are not the same kind of number: one generic
 * `intBetween` produced reports claiming a median remediation time of 1,647
 * days, which is the fastest way to teach a reader that the figures are
 * decoration. A section emits exactly the measures listed here - there is no
 * fallback label, so a report can never show "Measure 4".
 */
const SECTION_MEASURES = {
  posture: [['Posture score', 58, 82], ['Controls passing', 96, 128], ['Controls failing', 6, 28], ['Accounts assessed', 2, 4]],
  'top-risks': [['Critical risks', 2, 9], ['High risks', 8, 24], ['Identities affected', 14, 90], ['Accounts affected', 1, 4]],
  movement: [['New identities', 12, 74], ['Retired identities', 4, 38], ['New exposures', 3, 22], ['Exposures closed', 2, 19]],
  asks: [['Decisions open', 2, 7], ['Overdue decisions', 0, 3], ['Owners to notify', 3, 14]],
  'by-category': [['Compute', 180, 460], ['Serverless', 120, 380], ['CI/CD', 40, 130], ['AI agents', 6, 34]],
  'by-account': [['prod-main', 320, 620], ['prod-eu', 140, 300], ['staging', 90, 240], ['data-platform', 60, 190]],
  ownerless: [['No owner', 18, 120], ['No team tag', 30, 180], ['Creator unresolved', 8, 60]],
  full: [['Records', 900, 3200], ['Columns', 14, 26], ['Accounts', 2, 4]],
  age: [['Under 30 days', 120, 420], ['30 to 90 days', 80, 260], ['Over 90 days', 40, 190], ['Over 365 days', 6, 70]],
  'never-rotated': [['Never rotated', 24, 140], ['Still valid', 18, 120], ['Admin-equivalent', 1, 12]],
  dormant: [['Dormant 90 days', 30, 160], ['Dormant 180 days', 12, 90], ['Dormant with admin', 0, 9]],
  plan: [['Rotate first', 3, 18], ['Rotate this week', 8, 40], ['Needs owner', 4, 26]],
  'by-source': [['Repository', 14, 68], ['Build logs', 4, 26], ['Object storage', 1, 12], ['Container images', 2, 18]],
  validity: [['Still valid', 12, 58], ['Revoked', 8, 44], ['Unverifiable', 1, 11]],
  sla: [['Within SLA', 14, 62], ['Breached', 2, 17], ['Median days', 2, 21]],
  detail: [['Exposed credentials', 18, 96], ['Repositories', 6, 34], ['Identities', 9, 52]],
  'by-type': [['New API', 2, 14], ['New resource', 2, 12], ['Volume spike', 0, 8], ['Off-hours', 1, 11]],
  disposition: [['Acknowledged', 4, 26], ['Expected', 6, 38], ['Suppressed', 1, 14], ['Resolved', 8, 44]],
  baselines: [['Established', 96, 148], ['Learning', 8, 40], ['Drifting', 12, 60]],
  outliers: [['Peer groups', 9, 22], ['Outliers', 3, 15], ['Single-member groups', 1, 7]],
  gap: [['Granted actions', 420, 1900], ['Used actions', 90, 460], ['Unused actions', 280, 1500]],
  admin: [['Admin-equivalent', 2, 16], ['With static keys', 1, 11], ['Without MFA', 0, 8]],
  unused: [['Never used', 40, 260], ['Unused 90 days', 20, 140], ['Services untouched', 5, 28]],
  recommend: [['Policies to reduce', 6, 34], ['Actions to remove', 60, 420], ['Identities affected', 12, 78]],
  summary: [['Controls passing', 96, 128], ['Controls failing', 6, 28], ['Not applicable', 2, 14]],
  failing: [['Failing controls', 6, 28], ['With evidence', 3, 20], ['Awaiting evidence', 1, 12]],
  exceptions: [['Accepted', 4, 24], ['Expiring 30 days', 0, 6], ['Expired', 0, 4]],
  attestation: [['Signatories', 2, 6], ['Frameworks', 2, 5]],
};

function sectionMeasures(sectionKey) {
  return SECTION_MEASURES[sectionKey] ?? [['Records', 90, 1200]];
}

function sectionNote(key) {
  switch (key) {
    case 'sla': return 'Measured from first detection to a recorded remediation, not to acknowledgement.';
    case 'validity': return 'Validity is established by the scanner, so a revoked credential is still listed with its original detection date.';
    case 'gap': return 'Granted-versus-used compares policy to observed calls over the window, so an action used once still counts as used.';
    case 'baselines': return 'A drifting baseline is not an anomaly; it is a signal that the model needs retraining.';
    default: return null;
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
function daysAgoIso(days) {
  return minutesAgoIso(days * 1440);
}
