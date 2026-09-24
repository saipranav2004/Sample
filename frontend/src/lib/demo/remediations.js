/**
 * The Posture remediation store, shared by the scoring (`posture.js`) and the
 * effective estate (`effective.js`), so both read the same record.
 *
 *   { [identityId]: { [checkKey]: { cycles: [cycle] } } }
 *
 * A cycle is one application of a fix: when and by whom, what it did, the
 * owner it recorded if any, the alerts it resolved, and - once somebody rolls
 * it back - when and by whom that happened. Cycles are kept rather than
 * overwritten, so the history can show a fix, its rollback and a second fix
 * in the order they happened.
 */
import { OVERLAY_KEYS, readOverlay, writeOverlay } from './runtime';

/* The first version stored one flat entry per check; read it as one cycle. */
function normalise(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (Array.isArray(entry.cycles)) return { cycles: entry.cycles.filter((cycle) => cycle && cycle.at) };
  if (entry.at) return { cycles: [entry] };
  return null;
}

export function readRemediationStore() {
  const raw = readOverlay(OVERLAY_KEYS.posture, {});
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [identityId, checks] of Object.entries(raw)) {
    if (!checks || typeof checks !== 'object') continue;
    for (const [checkKey, entry] of Object.entries(checks)) {
      const clean = normalise(entry);
      if (!clean || clean.cycles.length === 0) continue;
      out[identityId] = { ...(out[identityId] ?? {}), [checkKey]: clean };
    }
  }
  return out;
}

export function writeRemediationStore(store) {
  writeOverlay(OVERLAY_KEYS.posture, store);
}

/** The cycle in force for one check, or null when it was never applied or was rolled back. */
export function activeCycle(entry) {
  const last = entry?.cycles?.[entry.cycles.length - 1];
  return last && !last.rolledBackAt ? last : null;
}

/** Every fix in force, as { [identityId]: { [checkKey]: cycle } }. */
export function activeRemediations(store = readRemediationStore()) {
  const out = {};
  for (const [identityId, checks] of Object.entries(store)) {
    for (const [checkKey, entry] of Object.entries(checks)) {
      const cycle = activeCycle(entry);
      if (cycle) out[identityId] = { ...(out[identityId] ?? {}), [checkKey]: cycle };
    }
  }
  return out;
}
