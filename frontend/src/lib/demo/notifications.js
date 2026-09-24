/**
 * In-app notifications: alerts somebody else assigned or escalated to you.
 *
 * Derived, not stored. Every assignment and escalation already writes an
 * activity entry naming its `target`, so the bell reads those - there is no
 * second copy of the event to fall out of step with the alert it came from.
 * All that is stored is how far each user has read.
 *
 * Only actions by a person count. Your own actions are not news to you, and
 * seeded history is not something that happened while you were away.
 */
import { OVERLAY_KEYS, readOverlay, writeOverlay } from './runtime';

const LIMIT = 30;

export function notificationsFor(user) {
  if (!user) return [];
  const store = readOverlay(OVERLAY_KEYS.alerts, {});
  const out = [];
  for (const [alertId, entry] of Object.entries(store ?? {})) {
    for (const item of entry?.activity ?? []) {
      if (item.target !== user || item.actorUser === user) continue;
      if (item.kind !== 'assigned' && item.kind !== 'escalated') continue;
      out.push({
        id: `${alertId}|${item.at}|${item.kind}`,
        alertId,
        at: item.at,
        kind: item.kind,
        actor: item.actor,
        title: item.alertTitle ?? 'An alert',
        severity: item.severity ?? null,
      });
    }
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, LIMIT);
}

export function lastSeenBy(user) {
  const marks = readOverlay(OVERLAY_KEYS.notifications, {});
  return marks?.[user] ?? null;
}

export function markAllSeen(user) {
  if (!user) return;
  const marks = readOverlay(OVERLAY_KEYS.notifications, {});
  writeOverlay(OVERLAY_KEYS.notifications, { ...(marks ?? {}), [user]: new Date().toISOString() });
}
