/**
 * In-memory handoff so Activity Details always gets the exact set rows
 * shown on Workout Details (React Navigation params can drop / stale).
 */
let pendingHandoff = null;

export function setActivityDetailsHandoff({ activity, displaySetRows } = {}) {
  pendingHandoff = {
    activity: activity || null,
    displaySetRows: Array.isArray(displaySetRows) ? displaySetRows : [],
    ts: Date.now(),
  };
}

export function consumeActivityDetailsHandoff() {
  const next = pendingHandoff;
  pendingHandoff = null;
  if (!next) return null;
  // Ignore stale handoffs older than 60s
  if (Date.now() - (next.ts || 0) > 60000) return null;
  return next;
}

export function peekActivityDetailsHandoff() {
  return pendingHandoff;
}

/** Read without clearing — use for initial state; consume in useEffect. */
export function getActivityDetailsHandoffRows() {
  const rows = pendingHandoff?.displaySetRows;
  return Array.isArray(rows) && rows.length > 0 ? rows : null;
}
