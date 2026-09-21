import { useEffect, useState } from 'react';
import { useQuery } from '../hooks';
import { subscribeOverlay } from './runtime';

/**
 * `useQuery` plus a subscription to demo mutations.
 *
 * A demo action writes to localStorage rather than to a server, so nothing
 * re-fetches on its own. Without this, acknowledging an anomaly would update
 * the row you clicked and leave the counter above it stale - which is exactly
 * the kind of half-wired demo the request was against.
 *
 * Every overlay write bumps a revision, which is a dependency of the query, so
 * one action refreshes every view built on the same data.
 */
export function useDemoQuery(fetcher, deps = [], options) {
  const [revision, setRevision] = useState(0);

  useEffect(() => subscribeOverlay(() => setRevision((value) => value + 1)), []);

  return useQuery(fetcher, [...deps, revision], options);
}
