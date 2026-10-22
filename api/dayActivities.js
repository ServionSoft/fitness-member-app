import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';

const API_BASE_URL = ENV_API_BASE_URL;

const getAuthHeader = async () => {
  const userToken = await AsyncStorage.getItem('userToken');
  if (!userToken) {
    throw new Error('No token found');
  }
  return userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
};

/**
 * Fetch a member's custom day-activity plan for a calendar date.
 * GET /mobile/day-activities?day={dayName}&date={yyyy-MM-dd}
 *
 * @returns {object|null} result.data ({ id, activities, session_status, ... }) or null
 */
export const fetchDayActivityPlan = async ({ day, date }) => {
  const authHeader = await getAuthHeader();
  const params = new URLSearchParams();
  params.append('day', day);
  params.append('date', date);

  const response = await fetch(
    `${API_BASE_URL}/mobile/day-activities?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = new Error(errorData.message || 'Failed to fetch day activities');
    err.status = response.status;
    throw err;
  }

  const result = await response.json();
  if (result.success && result.data) {
    return result.data;
  }
  return null;
};
