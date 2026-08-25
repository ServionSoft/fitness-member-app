import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { getAuthToken, isTokenExpired } from '../utils/tokenUtils';

class ActivityLogService {
  constructor() {
    this.API_BASE_URL = ENV_API_BASE_URL;
  }
  
  // Generate a unique session ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get device information
  async getDeviceInfo() {
    try {
      const deviceId = await DeviceInfo.getUniqueId();
      const brand = DeviceInfo.getBrand();
      const model = DeviceInfo.getModel();
      const systemVersion = DeviceInfo.getSystemVersion();
      const appVersion = await DeviceInfo.getVersion();
      
      return JSON.stringify({
        device_id: deviceId,
        brand,
        model,
        platform: Platform.OS,
        system_version: systemVersion,
        app_version: appVersion,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting device info:', error);
      return JSON.stringify({
        platform: Platform.OS,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Log app launch activity
  async logAppLaunch(memberId, gymId) {
    // Handle gymId parameter - can be number, null, or undefined
    const finalGymId = gymId === undefined || gymId === null ? null : gymId;
    let sessionId;
    let deviceInfo;
    
    try {
      sessionId = this.generateSessionId();
      deviceInfo = await this.getDeviceInfo();
      
      // Check if token is expired first
      const expired = await isTokenExpired();
      if (expired) {
        console.warn('Token expired, skipping app launch logging');
        // Clear expired token
        await AsyncStorage.multiRemove(['userToken', 'userData', 'tokenExpiry']);
        return { success: false, message: 'Token expired, will retry after login' };
      }
      
      // Get formatted token for Authorization header
      const authHeader = await getAuthToken();
      
      // Check if token exists - if not, skip the request
      if (!authHeader) {
        console.warn('No user token found, skipping app launch logging');
        // Store locally for retry later when token is available
        await this.storeForRetry(memberId, gymId, sessionId, deviceInfo);
        return { success: false, message: 'No token available, will retry later' };
      }
      
      const logData = {
        member_id: memberId,
        gym_id: finalGymId,
        login_time: new Date().toISOString(),
        device_info: deviceInfo,
        login_status: 'success',
        session_id: sessionId,
      };

      // Store session ID for future reference
      await AsyncStorage.setItem('currentSessionId', sessionId);
      
      // Debug: Log request details (without exposing full token)
      console.log('=== App Launch API Request Debug ===');
      console.log('URL:', `${this.API_BASE_URL}/mobile/auth/app-launch`);
      console.log('Auth Header (first 30 chars):', authHeader ? authHeader.substring(0, 30) + '...' : 'null');
      console.log('Auth Header length:', authHeader ? authHeader.length : 0);
      console.log('Has Bearer prefix:', authHeader ? authHeader.startsWith('Bearer ') : false);
      console.log('===================================');
      
      // Send to backend API using app-launch endpoint
      const response = await fetch(`${this.API_BASE_URL}/mobile/auth/app-launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(logData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('App launch activity logged successfully:', result);
        return result;
      } else {
        // Handle 401 errors first - don't log them as errors
        if (response.status === 401) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { message: errorText };
          }
          
          // Debug: Log detailed 401 error information
          console.warn('=== 401 Unauthorized - Backend Response ===');
          console.warn('Response Status:', response.status);
          console.warn('Response Headers:', JSON.stringify([...response.headers.entries()], null, 2));
          console.warn('Error Data:', JSON.stringify(errorData, null, 2));
          console.warn('Auth Header sent (first 30 chars):', authHeader ? authHeader.substring(0, 30) + '...' : 'null');
          console.warn('Token length:', authHeader ? authHeader.length : 0);
          console.warn('==========================================');
          
          // Don't clear token immediately on 401 - might be a backend issue
          // Only clear if it's explicitly an expired token
          if (errorData.message && errorData.message.toLowerCase().includes('expired')) {
            console.warn('Token expired, clearing authentication data');
            await AsyncStorage.multiRemove(['userToken', 'userData', 'tokenExpiry']);
          }
          
          // Return without throwing - this is expected behavior for expired tokens
          return { success: false, message: 'Token invalid or expired', errorData };
        }
        
        // For other errors, log and throw
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        console.error('Failed to log app launch activity:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      // Don't log network/parsing errors if they're related to token issues
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('Token invalid or expired')) {
        console.error('Error logging app launch activity:', error);
      }
      // Store locally for retry later if needed (but not for 401/token errors)
      if (sessionId && deviceInfo && !errorMessage.includes('Token invalid or expired')) {
        await this.storeForRetry(memberId, gymId, sessionId, deviceInfo);
      }
      throw error;
    }
  }

  // Store failed logs for retry
  async storeForRetry(memberId, gymId, sessionId, deviceInfo) {
    try {
      const failedLogs = await AsyncStorage.getItem('failedActivityLogs') || '[]';
      const logs = JSON.parse(failedLogs);
      logs.push({ 
        member_id: memberId,
        gym_id: gymId,
        session_id: sessionId,
        device_info: deviceInfo,
        timestamp: new Date().toISOString(),
        retryCount: 0 
      });
      await AsyncStorage.setItem('failedActivityLogs', JSON.stringify(logs));
    } catch (error) {
      console.error('Error storing failed log for retry:', error);
    }
  }

  // Retry failed logs
  async retryFailedLogs() {
    try {
      const failedLogs = await AsyncStorage.getItem('failedActivityLogs');
      if (!failedLogs) return;

      const logs = JSON.parse(failedLogs);
      const successfulLogs = [];
      
      // Check if token is expired first
      const expired = await isTokenExpired();
      if (expired) {
        console.warn('Token expired, cannot retry failed logs');
        await AsyncStorage.multiRemove(['userToken', 'userData', 'tokenExpiry']);
        return;
      }
      
      // Get formatted token for Authorization header
      const authHeader = await getAuthToken();
      
      // Check if token exists and is valid
      if (!authHeader) {
        console.warn('No token available for retrying failed logs');
        return;
      }

      for (const log of logs) {
        try {
          const response = await fetch(`${this.API_BASE_URL}/mobile/auth/app-launch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
            body: JSON.stringify({
              member_id: log.member_id,
              gym_id: log.gym_id,
              login_time: log.timestamp,
              device_info: log.device_info,
              login_status: 'success',
              session_id: log.session_id,
            }),
          });

          if (response.ok) {
            successfulLogs.push(log);
          } else {
            // If 401, token is invalid - clear it and stop retrying
            if (response.status === 401) {
              console.warn('Token invalid during retry, clearing authentication data');
              await AsyncStorage.multiRemove(['userToken', 'userData', 'tokenExpiry']);
              break; // Stop retrying if token is invalid
            }
            log.retryCount = (log.retryCount || 0) + 1;
            if (log.retryCount >= 3) {
              console.log('Log failed after 3 retries, removing:', log);
            }
          }
        } catch (error) {
          log.retryCount = (log.retryCount || 0) + 1;
          if (log.retryCount >= 3) {
            console.log('Log failed after 3 retries, removing:', log);
          }
        }
      }

      // Remove successful logs and logs that failed too many times
      const remainingLogs = logs.filter(log => 
        !successfulLogs.includes(log) && (log.retryCount || 0) < 3
      );

      await AsyncStorage.setItem('failedActivityLogs', JSON.stringify(remainingLogs));
    } catch (error) {
      console.error('Error retrying failed logs:', error);
    }
  }
}

export default new ActivityLogService();
