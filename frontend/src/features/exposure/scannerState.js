/**
 * The Secret Scanner sits behind a proxy that must attach `X-Dashboard-Key`.
 * A 401 therefore almost always means the deployment is not configured rather
 * than that the operator lacks access - say so instead of showing a bare
 * "unauthorized".
 */
/**
 * A finding's identity.
 *
 * `finding_id` is the service's own unique id and the guide names it as the
 * React list key, so it is used first. The four-field composite behind it is
 * the fallback, and it is not arbitrary: those are exactly the four fields the
 * allowlist endpoints require to identify a finding, which is the service
 * telling us what a finding's identity is. It covers a row recorded before
 * `finding_id` existed - without it those rows all key on `undefined`, React
 * sees one duplicated key for the whole list, reconciliation falls back to
 * index order, and selecting a row after a dismiss opens its neighbour.
 *
 * Allowlist writes still send the four fields (see `toAllowlistPayload`);
 * `finding_id` is a read-side key, not an accepted request parameter.
 */
export function findingKey(finding) {
  if (finding?.finding_id !== undefined && finding?.finding_id !== null) {
    return `id:${finding.finding_id}`;
  }
  return [finding?.client_id, finding?.file_path, finding?.detector, finding?.redacted].join('|');
}

/**
 * What went wrong reaching the scanner, in terms of what to do about it.
 *
 * Every case here used to collapse into "not configured", including the one
 * where a key WAS configured and the scanner rejected it - so an operator who
 * had set the key correctly was told to set it. The proxy now reports whether
 * it attached a key (`X-Scanner-Key-Attached`, yes or no, never the value),
 * which separates the cases that need different fixes:
 *
 *   no key attached        the server has no SCANNER_DASHBOARD_KEY
 *   key attached, 401      the value is wrong, expired, or has stray spaces
 *   5xx / no response      the proxy is up and the scanner host is not
 *   HTML instead of JSON   nothing is proxying the path at all
 */
export function describeScannerError(error) {
  if (error?.status === 401) {
    if (error?.keyAttached === 'yes') {
      return {
        title: 'The scanner rejected the dashboard key',
        message:
          'A key was attached server-side and the Secret Scanner answered 401. The value of SCANNER_DASHBOARD_KEY is wrong or has been revoked - check it against the key the scanner issued, then restart the dev server or the container.',
        configuration: true,
      };
    }
    return {
      title: 'Credential exposure service is not configured',
      message:
        error?.keyAttached === 'no'
          ? 'The proxy has no SCANNER_DASHBOARD_KEY. Set it in frontend/.env (without a VITE_ prefix) for local development, or pass it to the container at run time, then restart.'
          : 'The scanner rejected the request as unauthorized. The dashboard key is attached by the server-side proxy, not the browser - set SCANNER_DASHBOARD_KEY for the proxy and restart.',
      configuration: true,
    };
  }
  if (error?.code === 'NOT_PROXIED') {
    return {
      title: 'Nothing is proxying the scanner',
      message:
        'The /secret-scanner path returned the app itself rather than the scanner. Run the app with `npm run dev` (which proxies it) or behind the provided nginx configuration - a plain static file server cannot attach the key.',
      configuration: true,
    };
  }
  /* No answer at all: the proxy gave up waiting (504, or the scanner's own
     SCANNER_UNREACHABLE from the dev proxy), or the browser's own 20-second
     timeout fired first. A wrong key never looks like this - the scanner
     rejects one with a 401 straight away - so the message says so. */
  if (
    error?.status === 504 ||
    error?.code === 'SCANNER_UNREACHABLE' ||
    error?.code === 'ECONNABORTED' ||
    error?.code === 'ETIMEDOUT'
  ) {
    return {
      title: 'The Secret Scanner is not responding',
      message:
        'The request reached the proxy, but the scanner service behind it never answered, so the proxy gave up. This is not the dashboard key - a wrong key is rejected at once with a 401. The scanner is down, or the machine running the proxy cannot reach SCANNER_UPSTREAM (a firewall, security group or VPN). Check the scanner service, then try again.',
      configuration: true,
    };
  }
  if (error?.code === 'NETWORK' || [500, 502, 503].includes(error?.status)) {
    return {
      title: 'Cannot reach the credential exposure service',
      message:
        'The proxy is running but the Secret Scanner did not answer. Check that SCANNER_UPSTREAM is reachable from the machine running the proxy - a corporate proxy or VPN is the usual cause - and try again.',
      configuration: true,
    };
  }
  return {
    title: 'Credential exposure data failed to load',
    message: error?.message || 'The scanner returned an unexpected error.',
    configuration: false,
  };
}

/**
 * Counts by risk tier, platform and repository - the guide's own recipe.
 *
 * `CRITICAL` is counted but the screens do not give it a tile of its own: the
 * service cannot currently emit it, so a tile for it would be a permanent
 * zero. Counted anyway, because the day it starts emitting one the number has
 * to appear somewhere rather than be silently dropped.
 */
export function summariseFindings(findings = []) {
  const byTier = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byPlatform = { github: 0, codecommit: 0 };
  const repositories = new Set();
  const detectors = new Map();

  for (const finding of findings) {
    const tier = String(finding.risk_tier || '').toUpperCase();
    if (tier in byTier) byTier[tier] += 1;

    // A finding recorded before platform tracking existed reports null and is
    // always CodeCommit, so anything that is not explicitly GitHub counts there.
    if (String(finding.platform || '').toLowerCase() === 'github') byPlatform.github += 1;
    else byPlatform.codecommit += 1;

    if (finding.repository) repositories.add(finding.repository);
    if (finding.detector) detectors.set(finding.detector, (detectors.get(finding.detector) || 0) + 1);
  }

  return {
    total: findings.length,
    byTier,
    byPlatform,
    repositoryCount: repositories.size,
    detectors: [...detectors.entries()]
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value),
  };
}

/** Groups findings by (repository, commit_id) so one push reads as one push. */
export function groupByPush(findings = []) {
  const groups = new Map();
  for (const finding of findings) {
    const key = `${finding.repository || '?'}@${finding.commit_id || '?'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        repository: finding.repository,
        commitId: finding.commit_id,
        branch: finding.branch,
        author: finding.author,
        createdAt: finding.created_at,
        platform: finding.platform,
        findings: [],
      });
    }
    groups.get(key).findings.push(finding);
  }
  return [...groups.values()];
}

/* ── Deep scan (endpoints 5 and 6) ────────────────────────────────────────── */

/**
 * How often to poll `GET /api/deep-scan-status`.
 *
 * Five seconds, which is the interval the integration guide states the
 * service's own dashboard uses. There is no push notification for a deep
 * scan, so polling is the only mechanism available.
 */
export const DEEP_SCAN_POLL_MS = 5000;

export const DEEP_SCAN_STATES = {
  not_started: {
    label: 'Not started',
    tone: 'neutral',
    description: 'No deep scan has ever been requested for this repository.',
  },
  running: {
    label: 'Running',
    tone: 'info',
    description: 'Walking every commit from the first one to HEAD.',
  },
  complete: {
    label: 'Complete',
    tone: 'low',
    description: 'The whole history has been read. Any secret it found is in the live set.',
  },
  failed: {
    label: 'Failed',
    tone: 'critical',
    description: 'The walk itself raised. Requesting it again starts a fresh attempt.',
  },
};

export function deepScanStateMeta(value) {
  const key = String(value || 'not_started').toLowerCase();
  return (
    DEEP_SCAN_STATES[key] ?? {
      label: value ? String(value) : 'Unknown',
      tone: 'neutral',
      description: 'The service reported a state this dashboard does not recognise.',
    }
  );
}

/**
 * What went wrong with a deep scan, in words an operator can act on.
 *
 * `error` from the service is the raw exception message. The guide is explicit
 * that it is fine for an operator and not something to put in front of an end
 * user as-is, so it is shown under a heading that says what it is rather than
 * as the page's own error text - and the two commonest causes are named,
 * because the raw string does not say what to do about either.
 */
export function describeDeepScanFailure(status) {
  const raw = String(status?.error || '');
  if (/AccessDenied|UnauthorizedOperation|not authorized/i.test(raw)) {
    return {
      cause: 'The scanner is missing an IAM permission on this repository.',
      fix: 'Re-check the read permissions granted to the scanner role, then request the scan again.',
      raw,
    };
  }
  if (/installation|revoked|404|Not Found|credentials/i.test(raw)) {
    return {
      cause: 'The GitHub installation for this client looks revoked or removed.',
      fix: 'Re-install the app for this organisation, then request the scan again.',
      raw,
    };
  }
  return {
    cause: 'The history walk raised before it finished.',
    fix: 'Requesting it again starts a fresh attempt and clears this error.',
    raw,
  };
}

/**
 * What a request to start a deep scan failed on.
 *
 * Every status the guide documents means something different to the person
 * looking at the screen, and one of them is safe to simply retry.
 */
export function describeDeepScanRequestError(error) {
  const status = error?.status;
  const message = error?.response?.data?.error || error?.message || '';
  if (status === 404) {
    return { title: 'Unknown client', message: `The scanner has no record of this client id. ${message}`.trim(), retryable: false };
  }
  if (status === 400) {
    return {
      title: 'The service refused the request',
      message:
        message ||
        'Either the repository is not one this client has onboarded, or it was given in the wrong shape - a bare name for CodeCommit, owner/repo for GitHub.',
      retryable: false,
    };
  }
  if (status === 502) {
    return {
      title: 'The backend for this client was unreachable',
      message: 'CodeCommit and GitHub are separate services behind the scanner, and the one owning this client did not answer. This is safe to retry.',
      retryable: true,
    };
  }
  return { title: 'Could not start the deep scan', message: message || 'The scanner returned an unexpected error.', retryable: true };
}
