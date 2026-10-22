import { fetchAssignedWorkoutDetails } from '../api/workouts';
import { getAuthToken } from './tokenUtils';
import { API_BASE_URL } from '@env';

/**
 * Navigate from an FCM / notification data payload.
 * Expects keys: related_type, related_id, workout_id, template_id, assignment_id, etc.
 */
export async function navigateFromNotificationData(navigation, data = {}) {
  if (!navigation || !data) {
    return;
  }

  const relatedType = String(data.related_type || data.type || '').toLowerCase();
  const relatedId = data.related_id ? String(data.related_id) : null;
  const workoutId = data.workout_id ? String(data.workout_id) : null;
  const templateId = data.template_id ? String(data.template_id) : null;
  const taskId = data.task_id ? String(data.task_id) : relatedId;
  const eventId = data.event_id || data.schedule_event_id || relatedId;
  const challengeId = data.challenge_id || relatedId;

  try {
    if (
      relatedType === 'workout_assignment' ||
      relatedType === 'workout_assigned' ||
      relatedType.includes('workout')
    ) {
      await openAssignedWorkout(navigation, workoutId || relatedId);
      return;
    }

    if (
      relatedType === 'nutrition_assignment' ||
      relatedType === 'nutrition_assigned' ||
      relatedType.includes('nutrition')
    ) {
      await openNutrition(navigation, templateId || relatedId);
      return;
    }

    if (relatedType === 'task' || relatedType.includes('task')) {
      if (taskId) {
        navigation.navigate('TaskDetailScreen', { taskId: Number(taskId) || taskId });
      } else {
        navigation.navigate('MemberTask');
      }
      return;
    }

    if (
      relatedType === 'schedule_event' ||
      relatedType === 'schedule' ||
      relatedType.includes('schedule') ||
      relatedType.includes('appointment')
    ) {
      if (relatedType.includes('appointment')) {
        navigation.navigate('AppointmentScreen');
        return;
      }
      if (eventId) {
        navigation.navigate('ScheduleDetail', {
          eventId: Number(eventId) || eventId,
        });
      } else {
        navigation.navigate('ScheduleScreen');
      }
      return;
    }

    if (relatedType === 'message' || relatedType.includes('message')) {
      navigation.navigate('MessagesListScreen');
      return;
    }

    if (relatedType === 'challenge' || relatedType.includes('challenge')) {
      if (challengeId) {
        navigation.navigate('ChallengesScreen');
      } else {
        navigation.navigate('ChallengesScreen');
      }
      return;
    }

    if (relatedType === 'note' || relatedType.includes('note')) {
      navigation.navigate('NotesScreen');
      return;
    }

    // Fallback: notifications inbox
    navigation.navigate('NotificationScreen');
  } catch (error) {
    if (__DEV__) {
      console.warn('[NotificationNav] failed:', error?.message || error);
    }
    try {
      navigation.navigate('NotificationScreen');
    } catch (_) {
      // ignore
    }
  }
}

async function openAssignedWorkout(navigation, workoutId) {
  if (!workoutId) {
    navigation.navigate('WorkoutScreen');
    return;
  }

  try {
    const workoutDetails = await fetchAssignedWorkoutDetails(workoutId);
    const detailedWorkout =
      workoutDetails?.workout || workoutDetails?.data || workoutDetails;

    if (detailedWorkout && (detailedWorkout.id || detailedWorkout.workout_id)) {
      navigation.navigate('WorkoutDetails', {
        workout: detailedWorkout,
        isAssignedWorkout: true,
        canStartWorkout: true,
      });
      return;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[NotificationNav] workout fetch failed:', error?.message);
    }
  }

  // Fallback: workouts list if details cannot be loaded
  navigation.navigate('WorkoutScreen');
}

async function openNutrition(navigation, nutritionId) {
  if (!nutritionId) {
    navigation.navigate('NutritionScreen');
    return;
  }

  try {
    const authHeader = await getAuthToken();
    if (!authHeader) {
      navigation.navigate('NutritionScreen');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/mobile/nutrition/${nutritionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader,
      },
    });

    if (response.ok) {
      const json = await response.json();
      const nutrition = json.data || json;
      if (nutrition) {
        navigation.navigate('NutritionDetails', { nutrition });
        return;
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[NotificationNav] nutrition fetch failed:', error?.message);
    }
  }

  navigation.navigate('NutritionScreen');
}
