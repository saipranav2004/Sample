/**
 * Demo runtime for the two features that have no backend yet.
 *
 * ── Why this exists, and the rule it suspends ────────────────────────────────
 * Everywhere else in this product the rule is absolute: no invented endpoints,
 * no fabricated responses. NHI Genome and Reports were specified before any API
 * exists for them, and were explicitly requested as working screens with
 * demonstration data, so that rule is suspended for these two features only -
 * knowingly, and visibly.
 *
 * The suspension is contained rather than advertised. It was a deliberate
 * decision not to label these screens in the interface - the product does not
 * announce its own scaffolding to the people being shown it - so the boundary
 * is held in the code instead:
 *
 *  1. Everything demo lives under `lib/demo/` and is imported by exactly two
 *     feature folders. Nothing in the rest of the app reads from here, so
 *     there is no path by which a generated figure reaches a live screen.
 *  2. Every generator is deterministic and side-effect free, and every write
 *     goes to `localStorage` under a `dna.demo.*` key. Nothing here can touch
 *     a real endpoint, and nothing real can be overwritten from here.
 *  3. This module mimics the real transport rather than short-circuiting it:
 *     requests are asynchronous, cancellable, and take time. That means the
 *     skeletons, empty states, error states and disabled buttons on these
 *     screens are the real ones, exercised the same way the live screens
 *     exercise them - so when an API does arrive, only `endpoints` changes.
 *
 * Swapping in a real API: replace the `demoRequest` calls inside
 * `lib/demo/genome.js` and `lib/demo/reports.js` with `client.get(...)`, then
 * delete this folder. No component needs to change.
 */

/* ── Deterministic randomness ─────────────────────────────────────────────── */

/**
 * mulberry32. Seeded so every reload produces identical data - demonstration
 * figures that shuffle on refresh look broken, and nobody can point at a row
 * twice.
 */
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable integer hash of a string, for per-record seeds. */
export function hashSeed(value) {
  let h = 2166136261;
  for (let i = 0; i < String(value).length; i += 1) {
    h ^= String(value).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function intBetween(next, min, max) {
  return Math.floor(next() * (max - min + 1)) + min;
}

export function pick(next, list) {
  return list[Math.floor(next() * list.length)];
}

/** `count` distinct members of `list`, or the whole list when it is shorter. */
export function sample(next, list, count) {
  const pool = [...list];
  const out = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
  }
  return out;
}

/* ── Transport ────────────────────────────────────────────────────────────── */

const LATENCY_KEY = 'dna.demo.latency';
const FAIL_KEY = 'dna.demo.fail';

function readNumber(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const value = Number(raw);
    return raw !== null && Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Resolves `producer()` after a short delay, honouring an AbortSignal exactly
 * as the axios client does - so `useQuery` cancels superseded demo requests the
 * same way it cancels real ones.
 *
 * `dna.demo.latency` (ms) and `dna.demo.fail` ('1') in localStorage let the
 * loading and error states be demonstrated on purpose rather than only in a
 * throttled browser.
 */
export function demoRequest(producer, { signal, latency } = {}) {
  /* `latency` is a [min, max] range in milliseconds. It used to be handed to
     setTimeout as it was, which coerces an array to NaN and fires immediately -
     so every demo request resolved in under a millisecond and no loading state
     in the app was ever actually drawn. The localStorage override wins, so a
     slow network can still be simulated on purpose. */
  const override = readNumber(LATENCY_KEY, null);
  const delay =
    override ??
    (Array.isArray(latency)
      ? latency[0] + Math.random() * Math.max(0, latency[1] - latency[0])
      : Number.isFinite(latency)
        ? latency
        : 320);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(cancelled());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      let shouldFail = false;
      try {
        shouldFail = localStorage.getItem(FAIL_KEY) === '1';
      } catch {
        shouldFail = false;
      }
      if (shouldFail) {
        const error = new Error('The demo data source is unavailable.');
        error.code = 'DEMO_UNAVAILABLE';
        reject(error);
        return;
      }
      try {
        resolve(producer());
      } catch (error) {
        reject(error);
      }
    }, delay);

    function onAbort() {
      clearTimeout(timer);
      reject(cancelled());
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function cancelled() {
  /* `useQuery` drops errors with this code instead of showing an error state,
     which is how the real client signals an aborted request. */
  const error = new Error('Request cancelled');
  error.code = 'CANCELLED';
  return error;
}

/* ── Persisted mutations ──────────────────────────────────────────────────── */

/**
 * Demo mutations have to survive a reload, or every button on these screens
 * would be theatre: acknowledge an anomaly, reload, and it is back.
 *
 * Reads and writes are wrapped because localStorage throws in a private window
 * and returns null when site data is cleared. A lost overlay degrades to the
 * generated baseline rather than breaking the screen.
 */
export function readOverlay(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeOverlay(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Demo state only. Losing it costs a reset, not correctness. */
  }
  notifyOverlay(key);
}

/* A change in one component has to reach the others rendering the same data,
   so overlay writes publish an event that the demo hooks subscribe to. */
const listeners = new Set();

export function subscribeOverlay(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyOverlay(key) {
  for (const listener of listeners) listener(key);
}

/* Another tab's write arrives as a \`storage\` event (the browser never fires
   it in the tab that wrote). Relaying it keeps two open consoles in step: an
   alert escalated in one appears in the assignee's queue in the other. A
   \`null\` key means the other tab cleared storage, which touches every overlay. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key.startsWith('dna.demo.')) notifyOverlay(event.key);
  });
}

export const OVERLAY_KEYS = {
  alerts: 'dna.demo.alertState',
  anomalies: 'dna.demo.anomalyState',
  policies: 'dna.demo.policyState',
  schedules: 'dna.demo.reportSchedules',
  /* v2: the templates were rebuilt on real figures. Runs saved under the old
     catalogue name templates that no longer exist, so they start afresh. */
  runs: 'dna.demo.reportRuns.v2',
  /* Console users: invitations, role and status changes, sign-in times. */
  users: 'dna.demo.users',
  /* AWS accounts connected from the Integrations wizard. */
  awsAccounts: 'dna.demo.awsAccounts',
  /* AWS connector: template settings, check runs, discovery runs, history. */
  awsConnector: 'dna.demo.awsConnector',
  /* Other platforms connected from Integrations: settings and secret hints only. */
  platforms: 'dna.demo.platformConnections',
  /* Posture remediations: which check was fixed on which identity, by whom. */
  posture: 'dna.demo.posture',
};
