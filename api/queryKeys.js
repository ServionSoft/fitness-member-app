/**
 * Centralized query keys for React Query
 * Ensures consistent query keys across the app for cache sharing
 */

/**
 * Default filter object for GET /mobile/workouts/all (matches WorkoutScreen initial selectedOptions).
 * DiscoverScreen and WorkoutScreen (unfiltered) must use this exact shape in the query key
 * so they share one React Query cache entry.
 */
export const defaultAllWorkoutsFilterOptions = {
  goals: [],
  duration: null,
  equipment: [],
  levels: [],
  workouts: [],
  creator: null,
};

/** API filter args corresponding to defaultAllWorkoutsFilterOptions (no query params). */
export const emptyAllWorkoutsApiFilters = {
  goals: [],
  durations: [],
  equipments: [],
  levels: [],
  workoutTypes: [],
  creators: [],
};

export const workoutKeys = {
  all: ['workouts'],
  myWorkouts: () => [...workoutKeys.all, 'my'],
  /**
   * GET /mobile/member-workouts — scoped by memberId so accounts on one device do not share lists.
   * Call sites: WorkoutScreen, ActivityCalendarScreen (must stay in sync).
   */
  assignedWorkouts: (memberId) => [
    ...workoutKeys.all,
    'assigned',
    memberId ?? 'anon',
  ],
  allWorkouts: () => [...workoutKeys.all, 'all'],
  assignedWorkoutDetails: (workoutId) => [...workoutKeys.all, 'assigned', workoutId],
  /**
   * GET /mobile/workout-activities/workout/{workoutId}
   * memberId scopes cache per logged-in user (token-scoped API).
   */
  activityPlans: (workoutId, memberId) => [
    ...workoutKeys.all,
    'activityPlans',
    memberId ?? 'anon',
    workoutId,
  ],
  /**
   * GET /mobile/member-workouts/{workoutId}/day/{dayNumber}/activities
   * Mutable day completion — keep short staleTime at the query call site.
   */
  dayStatus: (workoutId, dayNumber, memberId) => [
    ...workoutKeys.all,
    'dayStatus',
    memberId ?? 'anon',
    workoutId,
    dayNumber,
  ],
};

/**
 * Custom day-activity plans (calendar / DayActivitiesScreen).
 * NOT the same as workoutKeys.activityPlans or dayStatus —
 * those hit member-workout CRM plan/status endpoints.
 * GET /mobile/day-activities?day=&date=
 */
export const dayActivityKeys = {
  all: ['dayActivities'],
  byDate: (memberId, dateStr, dayName) => [
    ...dayActivityKeys.all,
    memberId ?? 'anon',
    dateStr,
    dayName,
  ],
};

