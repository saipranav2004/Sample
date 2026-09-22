import {
  OVERLAY_KEYS,
  demoRequest,
  hashSeed,
  intBetween,
  pick,
  readOverlay,
  rng,
  sample,
  writeOverlay,
} from './runtime';
import { estate as sharedEstate } from './estate';
import { formatDate } from '../format';

/**
 * NHI Genome demo dataset.
 *
 * The model: every non-human identity is watched for a learning period, after
 * which a behavioural baseline is "established" - the APIs it calls, the
 * resources it touches, when it runs, where from, and how much. An anomaly is a
 * measured departure from that baseline, always stated as baseline-versus-
 * observed so it can be judged rather than trusted.
 *
 * Every figure below is generated from a fixed seed, so the data is identical
 * on every reload and a row can be pointed at twice.
 */

export const ANOMALY_TYPES = {
  NEW_API: { label: 'New API', description: 'An API this identity has never called before' },
  NEW_RESOURCE: { label: 'New resource', description: 'A resource absent from the baseline' },
  NEW_REGION: { label: 'New region', description: 'Activity outside the baseline regions' },
  VOLUME_SPIKE: { label: 'Volume spike', description: 'Call volume above the baseline band' },
  OFF_HOURS: { label: 'Off-hours', description: 'Activity outside the baseline schedule' },
  NEW_IP: { label: 'New IP', description: 'A source address outside the baseline ranges' },
  PRIV_ESCALATION: { label: 'Privilege escalation', description: 'A call that can widen its own access' },
  DORMANT_WAKE: { label: 'Dormant wake', description: 'Activity from an identity that had gone quiet' },
};

export const ANOMALY_TYPE_ORDER = Object.keys(ANOMALY_TYPES);

/** Anomaly lifecycle. `open` is the only state that still needs a decision. */
export const ANOMALY_STATUSES = {
  open: { label: 'Open', tone: 'high' },
  acknowledged: { label: 'Acknowledged', tone: 'medium' },
  expected: { label: 'Expected', tone: 'neutral' },
  suppressed: { label: 'Suppressed', tone: 'neutral' },
  resolved: { label: 'Resolved', tone: 'low' },
};

export const BASELINE_STATES = {
  established: { label: 'Established', tone: 'low' },
  learning: { label: 'Learning', tone: 'medium' },
};

/** The six axes of the behavioural fingerprint, in a fixed order. */
export const FINGERPRINT_AXES = [
  { key: 'apiDiversity', label: 'API diversity' },
  { key: 'volume', label: 'Volume' },
  { key: 'timing', label: 'Timing' },
  { key: 'regionSpread', label: 'Region spread' },
  { key: 'resourceSpread', label: 'Resource spread' },
  { key: 'privilegeLevel', label: 'Privilege level' },
];

const REGIONS = ['us-east-1', 'us-east-2', 'eu-west-1', 'ap-south-1', 'eu-central-1'];
const APIS = [
  's3:GetObject', 's3:PutObject', 'dynamodb:Query', 'dynamodb:PutItem',
  'secretsmanager:GetSecretValue', 'sts:AssumeRole', 'cloudwatch:PutMetricData',
  'sqs:ReceiveMessage', 'kms:Decrypt', 'lambda:InvokeFunction', 'ecr:GetAuthorizationToken',
];

const SENSITIVE_APIS = [
  'iam:PassRole', 'iam:CreateAccessKey', 'iam:AttachRolePolicy', 'sts:AssumeRole',
  'kms:ScheduleKeyDeletion', 'organizations:InviteAccountToOrganization',
];

const RESOURCE_KINDS = ['S3 bucket', 'DynamoDB table', 'Secrets Manager', 'KMS key', 'SQS queue'];

/* ── Generation ───────────────────────────────────────────────────────────── */

let cache = null;

/**
 * What a principal is, from what the estate says it is.
 *
 * The genome screen talks about runtimes - a Lambda function, an EKS pod, a
 * CI/CD runner - because a baseline is a statement about how a *workload*
 * behaves. The estate classifies by purpose. The name carries the runtime for
 * the ephemeral and CI/CD ones, which is exactly where the distinction
 * matters, so it is read off the name rather than guessed.
 */
const RUNTIME_BY_PREFIX = {
  'eks-pod': { kind: 'EKS pod (IRSA)', category: 'Compute' },
  'lambda-exec': { kind: 'Lambda function', category: 'Serverless' },
  'batch-job': { kind: 'Batch job', category: 'Compute' },
  'fargate-task': { kind: 'ECS task role', category: 'Compute' },
  'glue-job': { kind: 'Glue job', category: 'Data' },
  'emr-step': { kind: 'EMR step', category: 'Data' },
  gha: { kind: 'GitHub Actions', category: 'CI/CD' },
  codebuild: { kind: 'CodeBuild project', category: 'CI/CD' },
  codepipeline: { kind: 'CodePipeline stage', category: 'CI/CD' },
  jenkins: { kind: 'Jenkins agent', category: 'CI/CD' },
  argocd: { kind: 'Argo CD', category: 'CI/CD' },
  terraform: { kind: 'Terraform runner', category: 'CI/CD' },
};

const RUNTIME_BY_CLASSIFICATION = {
  NHI_SERVICE: { kind: 'IAM role', category: 'Compute' },
  NHI_AGENT: { kind: 'Bedrock agent', category: 'AI agent' },
  NHI_SAAS: { kind: 'External integration', category: 'Third party' },
  NHI_CICD: { kind: 'GitHub Actions', category: 'CI/CD' },
  NHI_EPHEMERAL: { kind: 'Step Functions', category: 'Serverless' },
  DUAL_IDENTITY: { kind: 'IAM access key', category: 'Static credential' },
  UNCLASSIFIED: { kind: 'IAM role', category: 'Compute' },
};

function runtimeFor(row) {
  for (const [prefix, runtime] of Object.entries(RUNTIME_BY_PREFIX)) {
    if (row.name.startsWith(`${prefix}-`)) return runtime;
  }
  return RUNTIME_BY_CLASSIFICATION[row.classification] ?? RUNTIME_BY_CLASSIFICATION.UNCLASSIFIED;
}

const PEER_GROUP_BY_CATEGORY = {
  Compute: 'Compute workload roles',
  Serverless: 'Serverless execution roles',
  'CI/CD': 'CI/CD deploy identities',
  Data: 'Data pipeline jobs',
  'AI agent': 'Agent identities',
  'Third party': 'Third-party integrations',
  'Static credential': 'Key-holding identities',
};

function buildFleet() {
  if (cache) return cache;

  /* The fleet is the estate's non-human identities, not a fleet of its own.
     This screen used to generate 148 principals with their own names and
     accounts, so an anomaly named a workload that existed nowhere else in the
     product. Baselines are about machine behaviour, so humans are out - which
     is a statement about the screen rather than a shortcut. */
  const fleet = sharedEstate().identities.filter((row) => row.classification !== 'HUMAN');

  const identities = [];
  for (const row of fleet) {
    const name = row.name;
    const next = rng(hashSeed(`genome:${row.arn}`));
    const kindEntry = runtimeFor(row);
    /* Roughly an eighth are still learning: a fleet where everything is
       baselined hides the state an operator most needs to understand.
       An identity the estate says is young cannot have a settled baseline, so
       that is decided by its age rather than by a coin toss. */
    const learningDays = pick(next, [14, 30, 45]);
    const ageDays = Math.max(0, Math.round((Date.now() - Date.parse(row.created_at)) / 86_400_000));
    const learning = ageDays < learningDays || next() < 0.06;

    const identity = {
      /* The estate's id, so a row here and a node in the access graph and a
         row in the identity explorer are the same principal. */
      id: row.id,
      arn: row.arn,
      name,
      classification: row.classification,
      kind: kindEntry.kind,
      category: kindEntry.category,
      account: row.account_name,
      region: row.region,
      owner: row.owner_name,
      isAdmin: row.is_admin,
      peerGroup: PEER_GROUP_BY_CATEGORY[kindEntry.category] ?? 'Other identities',
      baselineState: learning ? 'learning' : 'established',
      learningDays,
      learningProgress: learning ? intBetween(next, 20, 90) : 100,
      baselineEstablished: learning ? null : daysAgoIso(intBetween(next, 3, 120)),
      dataPoints: intBetween(next, 12, 96) * 900,
      modelConfidence: intBetween(next, 88, 99),
      lastModelUpdate: hoursAgoIso(intBetween(next, 1, 30)),
      drift: Number((next() * 0.42).toFixed(2)),
      /* The estate's own last-active, so the genome and the explorer do not
         disagree about when a principal last did anything. */
      lastSeen: row.last_active,
      riskScore: intBetween(next, 8, 94),
      vpc: `vpc-0${Math.floor(next() * 1e7).toString(16).padStart(7, '0')}`,
      asn: 'AS16509 - Amazon AWS',
      fingerprint: buildFingerprint(next),
      typicalActions: buildActions(next),
      typicalResources: buildResources(next, name),
      totalEvents: row.total_events,
      schedule: buildSchedule(next),
      volumeBaseline: buildVolume(next),
      callsPerDay: buildCallsPerDay(next),
    };

    identity.anomalies = learning ? [] : buildAnomalies(next, identity);
    identities.push(identity);
  }

  cache = { identities, generatedAt: new Date().toISOString() };
  return cache;
}

function buildFingerprint(next) {
  const baseline = {};
  const observed = {};
  for (const axis of FINGERPRINT_AXES) {
    const base = intBetween(next, 28, 78);
    baseline[axis.key] = base;
    /* Observed tracks baseline closely; the departure is what an anomaly is. */
    observed[axis.key] = clamp(base + intBetween(next, -9, 26), 4, 100);
  }
  return { baseline, observed };
}

function buildActions(next) {
  const chosen = sample(next, APIS, intBetween(next, 5, 7));
  const weights = chosen.map(() => next());
  const total = weights.reduce((sum, value) => sum + value, 0);
  return chosen
    .map((api, index) => ({
      api,
      share: Math.max(1, Math.round((weights[index] / total) * 100)),
      calls: intBetween(next, 120, 24000),
    }))
    .sort((a, b) => b.share - a.share);
}

function buildResources(next, name) {
  const count = intBetween(next, 3, 5);
  const out = [];
  for (let index = 0; index < count; index += 1) {
    out.push({
      resource: `${pick(next, ['s3://', 'dynamodb/', 'secret/', 'kms/', 'sqs/'])}${name}-${pick(next, ['prod', 'audit', 'events', 'store', 'cache'])}`,
      kind: pick(next, RESOURCE_KINDS),
      accesses: intBetween(next, 180, 19000),
      isNew: false,
    });
  }
  return out.sort((a, b) => b.accesses - a.accesses);
}

/** 7 days x 24 hours of relative activity, 0-3. Weekday daytime is the norm. */
function buildSchedule(next) {
  const weeks = [];
  for (let day = 0; day < 7; day += 1) {
    const hours = [];
    const weekend = day >= 5;
    for (let hour = 0; hour < 24; hour += 1) {
      const working = hour >= 8 && hour <= 19;
      let level = 0;
      if (!weekend && working) level = intBetween(next, 2, 3);
      else if (!weekend) level = intBetween(next, 0, 1);
      else level = next() < 0.75 ? 0 : 1;
      hours.push(level);
    }
    weeks.push(hours);
  }
  return weeks;
}

/** 24 hourly points with the baseline band the value is judged against. */
function buildVolume(next) {
  const floor = intBetween(next, 240, 620);
  const ceiling = floor + intBetween(next, 260, 520);
  return Array.from({ length: 24 }, (_, hour) => {
    const working = hour >= 8 && hour <= 19;
    const mid = working ? (floor + ceiling) / 2 : floor * 0.35;
    return {
      hour: `${String(hour).padStart(2, '0')}:00`,
      value: Math.round(clamp(mid + intBetween(next, -90, 120), 0, ceiling * 1.4)),
      min: working ? floor : Math.round(floor * 0.2),
      max: working ? ceiling : Math.round(floor * 0.5),
    };
  });
}

function buildCallsPerDay(next) {
  const base = intBetween(next, 320, 1400);
  return Array.from({ length: 14 }, (_, index) => ({
    /* `label` and `subtitle`, not a key of our own choosing: `TrendChart` reads
       `label` for the x axis and `subtitle` for the tooltip, so a generator that
       invents its own key renders an axis of blanks and no path at all. */
    ...dayPoint(13 - index),
    calls: Math.round(clamp(base + intBetween(next, -160, 260), 40, base * 2.4)),
  }));
}

/**
 * One point on a daily x axis, in the shape `TrendChart` expects.
 *
 * `label` stays short enough to sit under a 104px chart without colliding;
 * `subtitle` carries the date in full, which is what somebody who has bothered
 * to hover is actually asking for.
 */
function dayPoint(daysAgo) {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return {
    label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    subtitle: daysAgo === 0 ? 'Today so far' : formatDate(date),
  };
}

/**
 * A region that is not the one given.
 *
 * Picking from the whole list and hoping it differs produces an anomaly whose
 * two sides are identical roughly one time in five.
 */
function otherRegion(next, baseline) {
  const options = REGIONS.filter((entry) => entry !== baseline);
  return pick(next, options.length > 0 ? options : REGIONS);
}

function buildAnomalies(next, identity) {
  /* Most identities behave. A fleet where everything is anomalous teaches an
     operator to ignore the screen. */
  const roll = next();
  const count = roll < 0.66 ? 0 : roll < 0.9 ? 1 : intBetween(next, 2, 3);
  const out = [];

  for (let index = 0; index < count; index += 1) {
    const type = pick(next, ANOMALY_TYPE_ORDER);
    const confidence = intBetween(next, 71, 99);
    /* Uppercase to match `SEVERITIES` in `lib/domain`, so `severityMeta` and
       any future real endpoint speak the same vocabulary as this generator. */
    const severity =
      confidence >= 95 ? 'CRITICAL' : confidence >= 88 ? 'HIGH' : confidence >= 79 ? 'MEDIUM' : 'LOW';
    const api = type === 'PRIV_ESCALATION' || type === 'NEW_API' ? pick(next, SENSITIVE_APIS) : pick(next, APIS);
    const minutesAgo = intBetween(next, 4, 2600);
    /* Drawn once, and never the identity's own region: a new-region anomaly
       reading `us-east-1 -> us-east-1` says the detector cannot tell the two
       sides apart, which is the one thing this screen exists to do. The same
       value feeds the observed statement and the Region field, so the summary
       and the detail cannot disagree either. */
    const region = type === 'NEW_REGION' ? otherRegion(next, identity.region) : identity.region;

    out.push({
      id: `${identity.id}-an-${index + 1}`,
      identityId: identity.id,
      identityName: identity.name,
      identityKind: identity.kind,
      account: identity.account,
      type,
      severity,
      confidence,
      detectedAt: minutesAgoIso(minutesAgo),
      minutesAgo,
      api,
      resource: identity.typicalResources[0]?.resource ?? 's3://unknown',
      region,
      sourceIp: type === 'NEW_IP' ? `203.0.113.${intBetween(next, 2, 250)}` : null,
      /* Every anomaly states both sides. A number with no baseline beside it
         is an assertion, not evidence. */
      baseline: baselineStatement(type, identity),
      observed: observedStatement(next, type, identity, api, region),
      status: 'open',
      title: anomalyTitle(type, api, identity),
      rationale: anomalyRationale(type, api, identity),
    });
  }

  return out.sort((a, b) => a.minutesAgo - b.minutesAgo);
}

function baselineStatement(type, identity) {
  const points = `${identity.learningDays}d - ${identity.dataPoints.toLocaleString('en-US')} events`;
  switch (type) {
    case 'NEW_API':
    case 'NEW_RESOURCE':
      return { headline: 'Never seen', detail: `0 occurrences in ${points}` };
    case 'NEW_REGION':
      return { headline: identity.region, detail: `Only region in ${points}` };
    case 'VOLUME_SPIKE':
      return { headline: `${identity.volumeBaseline[12].max}/hr peak`, detail: `Baseline band over ${points}` };
    case 'OFF_HOURS':
      return { headline: 'Mon-Fri 08-19 UTC', detail: `Baseline schedule over ${points}` };
    case 'NEW_IP':
      return { headline: '10.0.0.0/8', detail: `Only source range in ${points}` };
    case 'PRIV_ESCALATION':
      return { headline: 'No privilege calls', detail: `0 occurrences in ${points}` };
    default:
      return { headline: 'Continuous activity', detail: `Daily calls across ${points}` };
  }
}

function observedStatement(next, type, identity, api, region) {
  switch (type) {
    case 'NEW_API':
      return { headline: 'First occurrence', detail: `${intBetween(next, 1, 6)} calls to ${api}` };
    case 'NEW_RESOURCE':
      return { headline: 'First access', detail: `1 access to ${identity.typicalResources[0]?.resource}` };
    case 'NEW_REGION':
      return { headline: region, detail: `${intBetween(next, 2, 40)} calls outside the baseline region` };
    case 'VOLUME_SPIKE': {
      const peak = identity.volumeBaseline[12].max;
      const observed = Math.round(peak * (2 + next() * 2));
      return { headline: `${observed}/hr`, detail: `${(observed / peak).toFixed(1)}x the baseline peak` };
    }
    case 'OFF_HOURS':
      return { headline: `Sat 0${intBetween(next, 1, 5)}:${intBetween(next, 10, 59)} UTC`, detail: `${intBetween(next, 3, 30)} calls outside the schedule` };
    case 'NEW_IP':
      return { headline: `203.0.113.${intBetween(next, 2, 250)}`, detail: 'Outside every baseline range' };
    case 'PRIV_ESCALATION':
      return { headline: api, detail: `${intBetween(next, 1, 4)} calls that can widen access` };
    default:
      return { headline: 'Activity resumed', detail: `After ${intBetween(next, 45, 210)} quiet days` };
  }
}

function anomalyTitle(type, api, identity) {
  switch (type) {
    case 'NEW_API': return `${api} called for the first time`;
    case 'NEW_RESOURCE': return `${identity.typicalResources[0]?.resource ?? 'A resource'} accessed for the first time`;
    case 'NEW_REGION': return 'Activity outside the baseline region';
    case 'VOLUME_SPIKE': return 'Call volume above the baseline band';
    case 'OFF_HOURS': return 'Activity outside the baseline schedule';
    case 'NEW_IP': return 'Source address outside the baseline ranges';
    case 'PRIV_ESCALATION': return `${api} can widen this identity's own access`;
    default: return 'A dormant identity became active';
  }
}

function anomalyRationale(type, api, identity) {
  switch (type) {
    case 'NEW_API':
      return `${api} does not appear anywhere in ${identity.learningDays} days of baseline history. Judge it against what this identity is for, not against the fleet.`;
    case 'PRIV_ESCALATION':
      return `${api} lets an identity grant itself or another principal more access than it was provisioned with, which is why it is graded separately from ordinary new APIs.`;
    case 'VOLUME_SPIKE':
      return 'Volume alone is rarely an incident. It matters here because the baseline band was built from this identity\'s own history, not a fleet average.';
    case 'OFF_HOURS':
      return 'A schedule departure is weak evidence by itself and strong evidence next to another anomaly on the same identity.';
    case 'NEW_REGION':
      return 'A new region means either a legitimate deployment change or use of a credential from somewhere it was never meant to run.';
    case 'NEW_IP':
      return 'The source address falls outside every range this identity has ever called from, including its VPC CIDR.';
    case 'NEW_RESOURCE':
      return 'The baseline covers only the resources this identity has touched before, so a new one is a change in blast radius.';
    default:
      return 'An identity that had gone quiet became active again, which can indicate a forgotten credential being reused.';
  }
}

/* ── Overlay: decisions an operator makes ─────────────────────────────────── */

function anomalyOverlay() {
  return readOverlay(OVERLAY_KEYS.anomalies, {});
}

function policyOverlay() {
  return readOverlay(OVERLAY_KEYS.policies, {});
}

function withOverlay(anomaly, overlay) {
  const entry = overlay[anomaly.id];
  if (!entry) return anomaly;
  return { ...anomaly, status: entry.status, decidedAt: entry.decidedAt, note: entry.note };
}

/** Records a decision on an anomaly. Survives a reload. */
export function setAnomalyStatus(anomalyId, status, note) {
  const overlay = anomalyOverlay();
  /* Reopening removes the decision instead of recording "open" as one: the
     anomaly returns to exactly the state the detector left it in, with no
     `decidedAt` implying somebody decided it was open. */
  if (status === 'open') {
    const { [anomalyId]: _removed, ...rest } = overlay;
    writeOverlay(OVERLAY_KEYS.anomalies, rest);
    return;
  }
  writeOverlay(OVERLAY_KEYS.anomalies, {
    ...overlay,
    [anomalyId]: { status, note: note ?? null, decidedAt: new Date().toISOString() },
  });
}

export function setPolicyApplied(policyId, applied) {
  const overlay = policyOverlay();
  writeOverlay(OVERLAY_KEYS.policies, {
    ...overlay,
    [policyId]: { applied, at: new Date().toISOString() },
  });
}

/* ── Selectors ────────────────────────────────────────────────────────────── */

const WINDOW_HOURS = { '24h': 24, '7d': 168, '30d': 720 };

function allAnomalies() {
  const overlay = anomalyOverlay();
  return buildFleet()
    .identities.flatMap((identity) => identity.anomalies)
    .map((anomaly) => withOverlay(anomaly, overlay));
}

export function fetchGenomeOverview({ window = '24h' } = {}, signal) {
  return demoRequest(() => {
    const { identities } = buildFleet();
    const hours = WINDOW_HOURS[window] ?? 24;
    const inWindow = allAnomalies().filter((anomaly) => anomaly.minutesAgo <= hours * 60);
    const open = inWindow.filter((anomaly) => anomaly.status === 'open');

    const established = identities.filter((identity) => identity.baselineState === 'established');
    const learning = identities.filter((identity) => identity.baselineState === 'learning');

    const byType = ANOMALY_TYPE_ORDER.map((type) => ({
      key: type,
      label: ANOMALY_TYPES[type].label,
      count: inWindow.filter((anomaly) => anomaly.type === type).length,
    })).sort((a, b) => b.count - a.count);

    const anomalousIds = new Set(inWindow.map((anomaly) => anomaly.identityId));

    return {
      window,
      totals: {
        fleet: identities.length,
        established: established.length,
        learning: learning.length,
        anomalies: inWindow.length,
        openAnomalies: open.length,
        critical: inWindow.filter((anomaly) => anomaly.severity === 'CRITICAL').length,
        anomalousIdentities: anomalousIds.size,
        meanConfidence: inWindow.length
          ? Math.round(inWindow.reduce((sum, a) => sum + a.confidence, 0) / inWindow.length)
          : null,
        drifting: established.filter((identity) => identity.drift > 0.25).length,
      },
      byType,
      trend: buildFleetTrend(inWindow.length),
      /* A fleet score is the mean of the identities it is made of, so the
         number can always be taken apart. */
      fleetRisk: Math.round(
        identities.reduce((sum, identity) => sum + identity.riskScore, 0) / identities.length,
      ),
      topAnomalous: identities
        .filter((identity) => anomalousIds.has(identity.id))
        .map((identity) => ({
          ...summarise(identity),
          anomalyCount: inWindow.filter((anomaly) => anomaly.identityId === identity.id).length,
          worstSeverity: worstOf(inWindow.filter((anomaly) => anomaly.identityId === identity.id)),
        }))
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 8),
      peerOutliers: buildPeerOutliers(identities, inWindow),
      recentlyBaselined: established
        .filter((identity) => identity.baselineEstablished)
        .sort((a, b) => new Date(b.baselineEstablished) - new Date(a.baselineEstablished))
        .slice(0, 5)
        .map(summarise),
    };
  }, { signal });
}

export function fetchAnomalyFeed({ window = '24h', severity = '', type = '', status = '' } = {}, signal) {
  return demoRequest(() => {
    const hours = WINDOW_HOURS[window] ?? 24;
    const rows = allAnomalies()
      .filter((anomaly) => anomaly.minutesAgo <= hours * 60)
      .filter((anomaly) => (severity ? anomaly.severity === severity : true))
      .filter((anomaly) => (type ? anomaly.type === type : true))
      .filter((anomaly) => (status ? anomaly.status === status : true))
      .sort((a, b) => a.minutesAgo - b.minutesAgo);
    return { rows, total: rows.length };
  }, { signal });
}

export function fetchGenomeIdentities({ search = '', state = '', page = 1, pageSize = 25 } = {}, signal) {
  return demoRequest(() => {
    const needle = search.trim().toLowerCase();
    const overlay = anomalyOverlay();
    const filtered = buildFleet()
      .identities.filter((identity) =>
        needle
          ? identity.name.toLowerCase().includes(needle) || identity.kind.toLowerCase().includes(needle)
          : true,
      )
      .filter((identity) => (state ? identity.baselineState === state : true))
      .map((identity) => ({
        ...summarise(identity),
        anomalyCount: identity.anomalies.filter(
          (anomaly) => withOverlay(anomaly, overlay).status === 'open',
        ).length,
      }))
      .sort((a, b) => b.riskScore - a.riskScore);

    const start = (page - 1) * pageSize;
    return { rows: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize };
  }, { signal });
}

export function fetchGenomeIdentity(id, signal) {
  return demoRequest(() => {
    const identity = buildFleet().identities.find((entry) => entry.id === id);
    if (!identity) {
      const error = new Error('That identity is not in this demo fleet.');
      error.status = 404;
      throw error;
    }
    const overlay = anomalyOverlay();
    const applied = policyOverlay();
    const anomalies = identity.anomalies.map((anomaly) => withOverlay(anomaly, overlay));

    return {
      ...identity,
      anomalies,
      history: buildHistory(identity),
      events: buildEvents(identity, anomalies),
      timeline: buildTimeline(identity, anomalies),
      peers: buildPeers(identity),
      policies: buildPolicies(identity, anomalies).map((policy) => ({
        ...policy,
        applied: Boolean(applied[policy.id]?.applied),
        appliedAt: applied[policy.id]?.at ?? null,
      })),
    };
  }, { signal });
}

function summarise(identity) {
  return {
    id: identity.id,
    name: identity.name,
    kind: identity.kind,
    category: identity.category,
    account: identity.account,
    region: identity.region,
    peerGroup: identity.peerGroup,
    baselineState: identity.baselineState,
    learningProgress: identity.learningProgress,
    learningDays: identity.learningDays,
    baselineEstablished: identity.baselineEstablished,
    riskScore: identity.riskScore,
    drift: identity.drift,
    lastSeen: identity.lastSeen,
    modelConfidence: identity.modelConfidence,
  };
}

function worstOf(anomalies) {
  const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  for (const severity of order) {
    if (anomalies.some((anomaly) => anomaly.severity === severity)) return severity;
  }
  return null;
}

function buildFleetTrend(currentCount) {
  const next = rng(4242);
  return Array.from({ length: 14 }, (_, index) => ({
    ...dayPoint(13 - index),
    anomalies: index === 13 ? currentCount : intBetween(next, 4, 38),
  }));
}

function buildPeerOutliers(identities, inWindow) {
  const groups = new Map();
  for (const identity of identities) {
    if (!groups.has(identity.peerGroup)) groups.set(identity.peerGroup, []);
    groups.get(identity.peerGroup).push(identity);
  }
  return [...groups.entries()]
    .map(([group, members]) => {
      const outliers = members.filter((member) =>
        inWindow.some((anomaly) => anomaly.identityId === member.id),
      );
      if (outliers.length === 0) return null;
      const lead = outliers.sort((a, b) => b.riskScore - a.riskScore)[0];
      const anomaly = inWindow.find((entry) => entry.identityId === lead.id);
      return {
        group,
        size: members.length,
        outliers: outliers.length,
        leadId: lead.id,
        statement: `${lead.name} is the only member of this group with ${ANOMALY_TYPES[anomaly.type].label.toLowerCase()} in this window.`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.outliers - a.outliers)
    .slice(0, 4);
}

function buildHistory(identity) {
  const next = rng(hashSeed(`${identity.name}-history`));
  const statuses = ['expected', 'suppressed', 'resolved'];
  return Array.from({ length: intBetween(next, 2, 5) }, (_, index) => {
    const type = pick(next, ANOMALY_TYPE_ORDER);
    const api = pick(next, APIS);
    return {
      id: `${identity.id}-hist-${index}`,
      at: daysAgoIso(intBetween(next, 2, 40)),
      type,
      description: anomalyTitle(type, api, identity),
      deviation: `${baselineStatement(type, identity).headline} to ${observedStatement(next, type, identity, api).headline}`,
      confidence: intBetween(next, 74, 96),
      severity: pick(next, ['LOW', 'MEDIUM', 'HIGH']),
      status: pick(next, statuses),
    };
  }).sort((a, b) => new Date(b.at) - new Date(a.at));
}

function buildEvents(identity, anomalies) {
  const next = rng(hashSeed(`${identity.name}-events`));
  const rows = [];
  for (let index = 0; index < 40; index += 1) {
    const anomaly = index < anomalies.length ? anomalies[index] : null;
    rows.push({
      id: `${identity.id}-ev-${index}`,
      at: minutesAgoIso(index * intBetween(next, 2, 9) + 1),
      api: anomaly ? anomaly.api : pick(next, identity.typicalActions).api,
      resource: anomaly ? anomaly.resource : pick(next, identity.typicalResources).resource,
      region: identity.region,
      sourceIp: `10.0.${intBetween(next, 0, 250)}.${intBetween(next, 2, 250)}`,
      anomalyId: anomaly ? anomaly.id : null,
      anomalyType: anomaly ? anomaly.type : null,
    });
  }
  return rows;
}

function buildTimeline(identity, anomalies) {
  const entries = [];
  if (anomalies.length > 0) {
    entries.push({
      id: 'tl-active',
      kind: 'anomaly',
      at: anomalies[0].detectedAt,
      title: `${anomalies.length} active ${anomalies.length === 1 ? 'anomaly' : 'anomalies'}`,
      detail: anomalies.map((anomaly) => ANOMALY_TYPES[anomaly.type].label).join(', '),
    });
  }
  entries.push({
    id: 'tl-model',
    kind: 'model',
    at: identity.lastModelUpdate,
    title: 'Model retrained',
    detail: `Baseline updated, drift ${identity.drift.toFixed(2)}`,
  });
  if (identity.baselineEstablished) {
    entries.push({
      id: 'tl-baseline',
      kind: 'baseline',
      at: identity.baselineEstablished,
      title: 'Baseline established',
      detail: `${identity.learningDays}-day learning period complete, ${identity.dataPoints.toLocaleString('en-US')} events`,
    });
    entries.push({
      id: 'tl-learning',
      kind: 'learning',
      at: daysAgoIso(identity.learningDays + 4),
      title: 'Learning started',
      detail: 'Identity onboarded, behavioural monitoring began',
    });
  } else {
    entries.push({
      id: 'tl-learning',
      kind: 'learning',
      at: daysAgoIso(Math.round((identity.learningDays * identity.learningProgress) / 100)),
      title: 'Learning started',
      detail: `${identity.learningProgress}% of a ${identity.learningDays}-day period complete`,
    });
  }
  return entries.sort((a, b) => new Date(b.at) - new Date(a.at));
}

function buildPeers(identity) {
  const peers = buildFleet()
    .identities.filter((entry) => entry.peerGroup === identity.peerGroup)
    .slice(0, 8);
  const others = peers.filter((peer) => peer.id !== identity.id);
  const average = {};
  for (const axis of FINGERPRINT_AXES) {
    average[axis.key] = others.length
      ? Math.round(others.reduce((sum, peer) => sum + peer.fingerprint.baseline[axis.key], 0) / others.length)
      : identity.fingerprint.baseline[axis.key];
  }
  return {
    group: identity.peerGroup,
    size: peers.length,
    average,
    members: peers.map((peer) => ({
      id: peer.id,
      name: peer.name,
      isSelf: peer.id === identity.id,
      riskScore: peer.riskScore,
      anomalyCount: peer.anomalies.length,
      baselineState: peer.baselineState,
    })),
  };
}

function buildPolicies(identity, anomalies) {
  return anomalies.map((anomaly) => {
    const scoped = `arn:aws:iam::${intBetween(rng(hashSeed(anomaly.id)), 100000000000, 999999999999)}:role/${identity.name.split('-')[0]}-*`;
    return {
      id: `${anomaly.id}-policy`,
      anomalyId: anomaly.id,
      name: policyName(anomaly),
      kind: 'IAM deny',
      autoApplySafe: anomaly.severity !== 'CRITICAL',
      trigger: `${ANOMALY_TYPES[anomaly.type].label} - ${anomaly.title} (confidence ${anomaly.confidence}%)`,
      action: policyAction(anomaly),
      impact: policyImpact(anomaly),
      document: policyDocument(anomaly, scoped),
    };
  });
}

function policyName(anomaly) {
  switch (anomaly.type) {
    case 'NEW_API':
    case 'PRIV_ESCALATION':
      return `deny-${anomaly.api.split(':')[1].toLowerCase()}-unscoped`;
    case 'NEW_RESOURCE': return 'deny-resources-out-of-baseline';
    case 'NEW_REGION': return 'deny-regions-out-of-baseline';
    case 'NEW_IP': return 'deny-source-ip-out-of-baseline';
    case 'VOLUME_SPIKE': return 'throttle-above-baseline-band';
    case 'OFF_HOURS': return 'deny-outside-baseline-schedule';
    default: return 'require-review-on-dormant-wake';
  }
}

function policyAction(anomaly) {
  switch (anomaly.type) {
    case 'NEW_API':
    case 'PRIV_ESCALATION':
      return `Attach an inline deny for ${anomaly.api} unless the target is inside an explicit allowlist.`;
    case 'NEW_RESOURCE':
      return 'Attach an inline deny for resources absent from the established baseline.';
    case 'NEW_REGION':
      return 'Add a region condition limiting this identity to its baseline regions.';
    case 'NEW_IP':
      return 'Add a source-IP condition limiting this identity to its baseline ranges.';
    case 'VOLUME_SPIKE':
      return 'Apply a rate limit at the top of the observed baseline band.';
    case 'OFF_HOURS':
      return 'Add a time condition matching the baseline schedule.';
    default:
      return 'Require an approval step before this identity can authenticate again.';
  }
}

function policyImpact(anomaly) {
  switch (anomaly.type) {
    case 'PRIV_ESCALATION':
    case 'NEW_API':
      return `Blocks the escalation path without touching the ${anomaly.identityName} workload's normal calls, all of which are inside the baseline.`;
    case 'NEW_REGION':
      return 'A legitimate regional rollout would need the allowlist updated first, so treat this as a change-control gate rather than a silent block.';
    case 'VOLUME_SPIKE':
      return 'A genuine traffic increase would be throttled too. Raise the band before applying if the spike is expected.';
    default:
      return 'Scoped to what the baseline already covers, so normal operation is unaffected.';
  }
}

function policyDocument(anomaly, scoped) {
  if (anomaly.type === 'NEW_REGION') {
    return JSON.stringify(
      { Version: '2012-10-17', Statement: [{ Sid: 'DenyOutOfBaselineRegion', Effect: 'Deny', Action: '*', Resource: '*', Condition: { StringNotEquals: { 'aws:RequestedRegion': [anomaly.region] } } }] },
      null, 2,
    );
  }
  if (anomaly.type === 'NEW_IP') {
    return JSON.stringify(
      { Version: '2012-10-17', Statement: [{ Sid: 'DenyOutOfBaselineSourceIp', Effect: 'Deny', Action: '*', Resource: '*', Condition: { NotIpAddress: { 'aws:SourceIp': ['10.0.0.0/8'] } } }] },
      null, 2,
    );
  }
  return JSON.stringify(
    { Version: '2012-10-17', Statement: [{ Sid: 'DenyOutOfBaseline', Effect: 'Deny', Action: anomaly.api, Resource: '*', Condition: { ArnNotLike: { 'iam:PassedToService': [scoped] } } }] },
    null, 2,
  );
}

/* ── Time helpers ─────────────────────────────────────────────────────────── */

function minutesAgoIso(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
function hoursAgoIso(hours) {
  return minutesAgoIso(hours * 60);
}
function daysAgoIso(days) {
  return minutesAgoIso(days * 1440);
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * The fleet itself, for other modules.
 *
 * The access graph needs the behavioural baseline for a principal it is already
 * drawing, and recomputing one there would give the product two different
 * answers to "how does this identity normally behave". Exported read-only: the
 * caller reads the model, it does not build one.
 */
export function genomeFleet() {
  return buildFleet().identities;
}
