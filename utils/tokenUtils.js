import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Token utility functions for consistent token handling across the app
 */

/**
 * Clean token - removes "Bearer " prefix if present
 * Tokens should be stored without the "Bearer " prefix
 * @param {string} token - The token to clean
 * @returns {string} - Cleaned token without "Bearer " prefix
 */
export const cleanToken = (token) => {
  if (!token) return null;
  // Remove "Bearer " prefix if present
  return token.replace(/^Bearer\s+/i, '').trim();
};

/**
 * Format token for Authorization header
 * Adds "Bearer " prefix if not present
 * @param {string} token - The token to format
 * @returns {string} - Token formatted for Authorization header
 */
export const formatTokenForHeader = (token) => {
  if (!token) return null;
  const cleaned = cleanToken(token);
  return cleaned ? `Bearer ${cleaned}` : null;
};

/**
 * Get token from AsyncStorage and format for API calls
 * @returns {Promise<string|null>} - Formatted token or null
 */
export const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) return null;
    return formatTokenForHeader(token);
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

/**
 * Store token in AsyncStorage (cleaned, without Bearer prefix)
 * @param {string} token - The token to store
 * @returns {Promise<void>}
 */
export const storeToken = async (token) => {
  try {
    const cleanedToken = cleanToken(token);
    if (!cleanedToken) {
      throw new Error('Invalid token: token is empty after cleaning');
    }
    await AsyncStorage.setItem('userToken', cleanedToken);
    console.log('Token stored successfully (length:', cleanedToken.length, ')');
  } catch (error) {
    console.error('Error storing token:', error);
    throw error;
  }
};

/**
 * Validate token format
 * @param {string} token - The token to validate
 * @returns {boolean} - True if token appears valid
 */
export const isValidTokenFormat = (token) => {
  if (!token || typeof token !== 'string') return false;
  const cleaned = cleanToken(token);
  // Basic validation - token should be non-empty after cleaning
  return cleaned && cleaned.length > 10; // Adjust minimum length as needed
};

/**
 * Get token expiry from AsyncStorage
 * @returns {Promise<Date|null>} - Expiry date or null
 */
export const getTokenExpiry = async () => {
  try {
    const expiry = await AsyncStorage.getItem('tokenExpiry');
    if (!expiry) return null;
    return new Date(expiry);
  } catch (error) {
    console.error('Error getting token expiry:', error);
    return null;
  }
};

/**
 * Check if token is expired
 * @returns {Promise<boolean>} - True if token is expired or missing
 */
export const isTokenExpired = async () => {
  try {
    const expiry = await getTokenExpiry();
    if (!expiry) return true;
    return expiry <= new Date();
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return true;
  }
};

