/**
 * The estate as it stands after the fixes applied on Posture.
 *
 * `estate()` is what discovery found. A remediation changes the account -
 * a policy detached, a key rotated, an owner tagged - so every screen that
 * describes the account as it is now (Identities, Credentials, the Dashboard,
 * Reports, the access graph and genome detail) reads this instead, and a fix
 * made on Posture shows everywhere at once.
 *
 * Two things deliberately keep reading the discovered estate:
 *  - Alerts. An alert records a condition that was found; fixing it resolves
 *    the alert rather than making it vanish, so the record and its timeline
 *    survive.
 *  - The Posture scoring itself, which needs the failure as found to show
 *    what a fix earned and to draw the history.
 *
 * MFA is the one fix that does not change a fact about the identity: the
 * enforcement policy blocks console sign-in until a device is enrolled, but
 * none is until someone does it. The identity says "MFA enforced" and still
 * counts as signing in without MFA, because that is still true.
 */
import { BROAD_POLICIES } from '../posture';
import { classificationEvidence, estate, ESTATE_META } from './estate';
import { activeRemediations } from './remediations';
import { hashSeed, rng } from './runtime';

const { NOW, DAY } = ESTATE_META;
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/* The id of the key a rotation issued: a real key's shape, derived from the
   key it replaced so it is the same on every read. */
function rotatedKeyId(oldId) {
  const own = rng(hashSeed(`rotated:${oldId}`));
  let body = '';
  for (let i = 0; i < 16; i += 1) body += KEY_ALPHABET[Math.floor(own() * KEY_ALPHABET.length)];
  return `AKIA${body}`;
}

const principalName = (row) => row.arn.split('/').pop();
const ageFrom = (iso) => Math.max(0, Math.floor((Math.max(NOW, Date.now()) - Date.parse(iso)) / DAY));

let cached = null;

export function effectiveEstate() {
  const base = estate();
  const active = activeRemediations();
  const signature = JSON.stringify(active);
  if (cached && cached.signature === signature) return cached.value;
  if (Object.keys(active).length === 0) {
    cached = { signature, value: base };
    return base;
  }

  const byArnFixes = new Map();
  for (const row of base.identities) {
    if (active[row.id]) byArnFixes.set(row.arn, active[row.id]);
  }

  /* Credentials first: what the identity holds decides its key counts. */
  const credentials = [];
  for (const credential of base.credentials) {
    const fixes = byArnFixes.get(credential.identity_arn);
    if (!fixes) {
      credentials.push(credential);
      continue;
    }
    const holder = base.byArn.get(credential.identity_arn);
    const expired = credential.status === 'EXPIRED' && credential.expires_at;
    const isKey = credential.type === 'ACCESS_KEY';
    if (expired && fixes['expired-credential']) continue;
    /* Deactivated: moved to a role, split from a person, or disabled as unused. */
    if (
      isKey &&
      !expired &&
      (fixes['workload-key'] || fixes['dual-identity'] || (fixes['unused-access'] && holder?.principal_type === 'IAM_USER'))
    ) {
      continue;
    }
    if (isKey && !expired && credential.age_days > 90 && fixes['key-rotation']) {
      const at = fixes['key-rotation'].at;
      const newId = rotatedKeyId(credential.cred_id);
      credentials.push({
        ...credential,
        id: `${credential.id}-rotated`,
        cred_id: newId,
        severity: 'LOW',
        status: 'ACTIVE',
        created_at: at,
        age_days: ageFrom(at),
        last_used_date: at,
        last_used_days: ageFrom(at),
        rotated_from: credential.cred_id,
        description: `Long-lived access key of IAM user ${credential.iam_user}, issued by rotation to replace ${credential.cred_id}.`,
      });
      continue;
    }
    credentials.push(credential);
  }

  const credentialsOf = new Map();
  for (const credential of credentials) {
    if (!credentialsOf.has(credential.identity_arn)) credentialsOf.set(credential.identity_arn, []);
    credentialsOf.get(credential.identity_arn).push(credential);
  }

  const identities = base.identities.map((row) => {
    const fixes = active[row.id];
    if (!fixes) return row;
    const name = principalName(row);
    const next = { ...row };
    let policies = [...(row.attached_policies ?? [])];
    if (fixes['admin-access']) {
      next.is_admin = false;
      policies = policies.map((policy) => (policy === 'AdministratorAccess' ? `${name}-least-privilege` : policy));
    }
    if (fixes['broad-policy'] && policies.some((policy) => BROAD_POLICIES.includes(policy))) {
      policies = [...policies.filter((policy) => !BROAD_POLICIES.includes(policy)), `${name}-scoped-data`];
    }
    if (fixes['unused-access'] && row.principal_type !== 'IAM_USER') {
      policies = [...policies, 'AWSDenyAll'];
      next.quarantined = true;
    }
    if (fixes['user-direct-policy']) {
      /* The same policies, now granted through the group. */
      next.groups = [...(row.groups ?? []), `${name}-access`];
      next.group_policies = policies;
      policies = [];
    }
    next.attached_policies = policies;
    if (fixes['unused-access'] && row.principal_type === 'IAM_USER') next.console_access = false;
    if (fixes['mfa-console']) next.mfa_enforced = true;
    if (fixes['external-trust']) next.external_id_required = true;
    if (fixes['escalation-path']) next.permissions_boundary = `${name}-escalation-boundary`;
    if (fixes['dual-identity']) next.workload_role = `${name}-workload`;
    if (fixes['no-owner'] && fixes['no-owner'].owner) {
      next.owner_type = 'TAG_OWNER';
      next.owner_name = fixes['no-owner'].owner;
      next.primary_owner = fixes['no-owner'].owner;
    }
    const own = credentialsOf.get(row.arn) ?? [];
    next.owned_credentials = own;
    next.credential_count = own.length;
    next.access_key_count = own.filter((credential) => credential.type === 'ACCESS_KEY').length;
    next.access_key_age_days = own
      .filter((credential) => credential.type === 'ACCESS_KEY')
      .reduce((max, credential) => Math.max(max, credential.age_days), 0);
    Object.assign(next, classificationEvidence(next));
    next.posture_fixes = Object.entries(fixes).map(([checkKey, cycle]) => ({
      checkKey,
      action: cycle.action,
      at: cycle.at,
      by: cycle.by,
    }));
    return next;
  });

  const value = {
    ...base,
    identities,
    credentials,
    credentialsOf,
    byArn: new Map(identities.map((row) => [row.arn, row])),
  };
  cached = { signature, value };
  return value;
}
