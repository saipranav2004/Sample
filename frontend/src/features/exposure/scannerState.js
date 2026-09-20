/**
 * The Secret Scanner sits behind a proxy that must attach `X-Dashboard-Key`.
 * A 401 therefore almost always means the deployment is not configured rather
 * than that the operator lacks access - say so instead of showing a bare
 * "unauthorized".
 */
export function describeScannerError(error) {
  if (error?.status === 401) {
    return {
      title: 'Code exposure service is not configured',
      message:
        'The scanner rejected the request as unauthorized. The dashboard key is attached by the server-side proxy, not the browser - set SCANNER_DASHBOARD_KEY for the proxy and reload.',
      configuration: true,
    };
  }
  if (error?.code === 'NETWORK') {
    return {
      title: 'Cannot reach the code exposure service',
      message:
        'No response from the scanner proxy. Confirm the proxy path is served and that the upstream scanner is reachable.',
      configuration: true,
    };
  }
  return {
    title: 'Code exposure data failed to load',
    message: error?.message || 'The scanner returned an unexpected error.',
    configuration: false,
  };
}

/** Counts by risk tier, platform and repository - the guide's own recipe. */
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
