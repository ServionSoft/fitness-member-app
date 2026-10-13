/**
 * Broadcast when a member saves sets on a workout activity plan
 * so Workout Details / Activity Details / Workout Start stay in sync.
 */
const listeners = new Set();

export function emitWorkoutPlanUpdated(payload) {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (e) {
      // ignore listener errors
    }
  });
}

export function onWorkoutPlanUpdated(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
