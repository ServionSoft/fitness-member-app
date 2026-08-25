/**
 * Centralized query keys for React Query
 * Ensures consistent query keys across the app for cache sharing
 */

export const workoutKeys = {
  all: ['workouts'],
  myWorkouts: () => [...workoutKeys.all, 'my'],
  assignedWorkouts: () => [...workoutKeys.all, 'assigned'],
  allWorkouts: () => [...workoutKeys.all, 'all'],
  assignedWorkoutDetails: (workoutId) => [...workoutKeys.all, 'assigned', workoutId],
};

