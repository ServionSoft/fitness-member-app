import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';

const API_BASE_URL = ENV_API_BASE_URL;

/**
 * Get authentication token and format for API calls
 */
const getAuthHeader = async () => {
  try {
    const userToken = await AsyncStorage.getItem('userToken');
    if (!userToken) {
      throw new Error('No token found');
    }
    
    // Check if token has "Bearer " prefix already
    let authHeader = userToken;
    if (!userToken.startsWith('Bearer ')) {
      authHeader = `Bearer ${userToken}`;
    }
    
    return authHeader;
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw error;
  }
};

/**
 * Fetch my workouts (workouts created by the member)
 * GET /mobile/workouts/member
 * @param {Object} filters - Filter options object (same as fetchAllWorkouts)
 * @param {Array} filters.goals - Array of goal strings
 * @param {Array} filters.durations - Array of duration strings
 * @param {Array} filters.equipments - Array of equipment strings
 * @param {Array} filters.levels - Array of level strings
 * @param {Array} filters.workoutTypes - Array of workout type strings
 * @param {String} filters.creator - Creator filter: 'my_workouts' or null
 */
export const fetchMyWorkouts = async (filters = {}) => {
  const authHeader = await getAuthHeader();
  
  // Build query parameters
  const params = new URLSearchParams();
  
  if (filters.goals && filters.goals.length > 0) {
    filters.goals.forEach(goal => params.append('goals[]', goal));
  }
  if (filters.durations && filters.durations.length > 0) {
    filters.durations.forEach(duration => params.append('durations[]', duration));
  }
  if (filters.equipments && filters.equipments.length > 0) {
    filters.equipments.forEach(equipment => params.append('equipments[]', equipment));
  }
  if (filters.levels && filters.levels.length > 0) {
    filters.levels.forEach(level => params.append('levels[]', level));
  }
  if (filters.workoutTypes && filters.workoutTypes.length > 0) {
    filters.workoutTypes.forEach(type => params.append('workout_types[]', type));
  }
  if (filters.search) {
    params.append('search', filters.search);
  }
  // Note: creator filter is not needed for my workouts endpoint since it already filters by member_id
  
  const queryString = params.toString();
  const url = queryString 
    ? `${API_BASE_URL}/mobile/workouts/member?${queryString}`
    : `${API_BASE_URL}/mobile/workouts/member`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch my workouts');
  }

  const data = await response.json();
  
  // Convert object to array if needed
  let myWorkoutsArray = data.data;
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    myWorkoutsArray = Object.values(data.data);
  }
  
  return myWorkoutsArray || [];
};

/**
 * Fetch assigned workouts (workouts assigned to member from CRM)
 * GET /mobile/member-workouts
 * @param {Object} filters - Filter options object (same as fetchAllWorkouts)
 * @param {Array} filters.goals - Array of goal strings
 * @param {Array} filters.durations - Array of duration strings
 * @param {Array} filters.equipments - Array of equipment strings
 * @param {Array} filters.levels - Array of level strings
 * @param {Array} filters.workoutTypes - Array of workout type strings
 */
export const fetchAssignedWorkouts = async (filters = {}) => {
  const authHeader = await getAuthHeader();
  
  // Build query parameters
  const params = new URLSearchParams();
  
  if (filters.goals && filters.goals.length > 0) {
    filters.goals.forEach(goal => params.append('goals[]', goal));
  }
  if (filters.durations && filters.durations.length > 0) {
    filters.durations.forEach(duration => params.append('durations[]', duration));
  }
  if (filters.equipments && filters.equipments.length > 0) {
    filters.equipments.forEach(equipment => params.append('equipments[]', equipment));
  }
  if (filters.levels && filters.levels.length > 0) {
    filters.levels.forEach(level => params.append('levels[]', level));
  }
  if (filters.workoutTypes && filters.workoutTypes.length > 0) {
    filters.workoutTypes.forEach(type => params.append('workout_types[]', type));
  }
  if (filters.search) {
    params.append('search', filters.search);
  }
  
  const queryString = params.toString();
  const url = queryString 
    ? `${API_BASE_URL}/mobile/member-workouts?${queryString}`
    : `${API_BASE_URL}/mobile/member-workouts`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch assigned workouts');
  }

  const data = await response.json();
  return data.workouts || [];
};

/**
 * Fetch all workouts (discover page - same endpoint used in DiscoverScreen)
 * GET /mobile/workouts/all
 * @param {Object} filters - Filter options object
 * @param {Array} filters.goals - Array of goal strings (e.g., ['Lose Weight', 'Build Muscle'])
 * @param {Array} filters.durations - Array of duration strings (e.g., ['0-15 min', '15-30 min'])
 * @param {Array} filters.equipments - Array of equipment strings (e.g., ['No Equipment', 'Dumbbells'])
 * @param {Array} filters.levels - Array of level strings (e.g., ['Beginner', 'Intermediate'])
 * @param {Array} filters.workoutTypes - Array of workout type strings (e.g., ['Strength', 'Cardio'])
 * @param {Array} filters.creators - Array of creator strings (e.g., ['My Workouts', 'Assigned Workouts'])
 */
export const fetchAllWorkouts = async (filters = {}) => {
  const authHeader = await getAuthHeader();
  
  // Build query parameters
  const params = new URLSearchParams();
  
  if (filters.goals && filters.goals.length > 0) {
    filters.goals.forEach(goal => params.append('goals[]', goal));
  }
  if (filters.durations && filters.durations.length > 0) {
    filters.durations.forEach(duration => params.append('durations[]', duration));
  }
  if (filters.equipments && filters.equipments.length > 0) {
    filters.equipments.forEach(equipment => params.append('equipments[]', equipment));
  }
  if (filters.levels && filters.levels.length > 0) {
    filters.levels.forEach(level => params.append('levels[]', level));
  }
  if (filters.workoutTypes && filters.workoutTypes.length > 0) {
    filters.workoutTypes.forEach(type => params.append('workout_types[]', type));
  }
  if (filters.creators && filters.creators.length > 0) {
    filters.creators.forEach(creator => params.append('creators[]', creator));
  }
  
  const queryString = params.toString();
  const url = queryString 
    ? `${API_BASE_URL}/mobile/workouts/all?${queryString}`
    : `${API_BASE_URL}/mobile/workouts/all`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('All workouts API error:', response.status, errorText);
    throw new Error('Failed to fetch all workouts');
  }

  const result = await response.json();
  return result.data || [];
};

/**
 * Fetch assigned workout details
 * GET /mobile/member-workouts/{workoutId}
 */
export const fetchAssignedWorkoutDetails = async (workoutId) => {
  const authHeader = await getAuthHeader();
  
  const response = await fetch(`${API_BASE_URL}/mobile/member-workouts/${workoutId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch assigned workout details');
  }

  const data = await response.json();
  return data;
};

/**
 * Fetch a single member-created workout by id (for editing).
 * GET /mobile/workouts/{id}
 */
export const fetchMemberWorkoutById = async (workoutId) => {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/mobile/workouts/${workoutId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch workout');
  }

  const data = await response.json();
  return data.data || data;
};

/**
 * Update a member-created workout.
 * PUT /mobile/workouts/{id}
 */
export const updateMemberWorkout = async (workoutId, payload) => {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/mobile/workouts/${workoutId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to update workout');
  }

  return response.json();
};

/**
 * Delete a member-created workout.
 * DELETE /mobile/workouts/{id}
 */
export const deleteMemberWorkout = async (workoutId) => {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/mobile/workouts/${workoutId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to delete workout');
  }

  return response.json();
};

