import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import DeviceInfo from 'react-native-device-info';
import { API_BASE_URL } from '@env';
import { getAuthToken } from '../utils/tokenUtils';
import { navigateFromNotificationData } from '../utils/notificationNavigation';

let tokenRefreshSubscribed = false;
let openHandlersSubscribed = false;
/** Captured when app opens from quit via notification, before auth/nav ready */
let pendingOpenData = null;

// Capture cold-start tap as early as possible
try {
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage?.data) {
        pendingOpenData = remoteMessage.data;
      }
    })
    .catch(() => {});
} catch (_) {
  // native module may not be ready in some test envs
}

/**
 * Request notification permission (Android 13+ + FCM).
 */
export async function requestPushPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      return false;
    }
  }

  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  return enabled;
}

export async function getFcmToken() {
  const enabled = await requestPushPermission();
  if (!enabled) {
    return null;
  }

  if (Platform.OS === 'ios' && !messaging().isDeviceRegisteredForRemoteMessages) {
    await messaging().registerDeviceForRemoteMessages();
  }

  return messaging().getToken();
}

/**
 * POST /mobile/notifications/push-token
 */
export async function registerPushTokenWithBackend(fcmToken) {
  if (!fcmToken) {
    return { success: false, message: 'No FCM token' };
  }

  const authHeader = await getAuthToken();
  if (!authHeader) {
    return { success: false, message: 'Not authenticated' };
  }

  let deviceId = null;
  try {
    deviceId = await DeviceInfo.getUniqueId();
  } catch (_) {
    deviceId = null;
  }

  const response = await fetch(`${API_BASE_URL}/mobile/notifications/push-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      fcm_token: fcmToken,
      platform: Platform.OS,
      device_id: deviceId,
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      message: json.message || `HTTP ${response.status}`,
    };
  }

  return { success: true, data: json.data };
}

/**
 * DELETE /mobile/notifications/push-token
 */
export async function unregisterPushTokenFromBackend(fcmToken) {
  const authHeader = await getAuthToken();
  if (!authHeader) {
    return { success: false };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/mobile/notifications/push-token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        fcm_token: fcmToken || undefined,
      }),
    });
    return { success: response.ok };
  } catch (error) {
    return { success: false, message: error?.message };
  }
}

/**
 * After login: get FCM token and register with backend.
 */
export async function initFirebaseMessaging() {
  try {
    const token = await getFcmToken();
    if (!token) {
      if (__DEV__) {
        console.warn('[Firebase] No FCM token (permission denied?)');
      }
      return null;
    }

    if (__DEV__) {
      console.log('[Firebase] FCM token:', token);
    }

    const result = await registerPushTokenWithBackend(token);
    if (__DEV__) {
      console.log('[Firebase] register result:', result);
    }

    if (!tokenRefreshSubscribed) {
      tokenRefreshSubscribed = true;
      messaging().onTokenRefresh(async (newToken) => {
        try {
          await registerPushTokenWithBackend(newToken);
        } catch (e) {
          if (__DEV__) {
            console.warn('[Firebase] token refresh register failed:', e?.message);
          }
        }
      });
    }

    return token;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Firebase] init failed:', error?.message || error);
    }
    return null;
  }
}

/**
 * Call before clearing auth on logout.
 */
export async function cleanupFirebaseMessaging() {
  try {
    let token = null;
    try {
      token = await messaging().getToken();
    } catch (_) {
      token = null;
    }
    await unregisterPushTokenFromBackend(token);
  } catch (error) {
    if (__DEV__) {
      console.warn('[Firebase] cleanup failed:', error?.message || error);
    }
  }
}

function getNavigation(navigationRef) {
  return navigationRef?.current || navigationRef;
}

/**
 * When user taps a system push (background / quit), open the related screen.
 * Call once navigation is ready and user is authenticated.
 *
 * @returns {() => void} unsubscribe
 */
export function setupNotificationOpenHandlers(navigationRef) {
  const nav = getNavigation(navigationRef);

  const openWithData = (data) => {
    if (!data || !Object.keys(data).length) {
      return;
    }
    if (__DEV__) {
      console.log('[Firebase] notification opened:', data);
    }
    const currentNav = getNavigation(navigationRef);
    if (!currentNav) {
      pendingOpenData = data;
      return;
    }
    setTimeout(() => {
      navigateFromNotificationData(currentNav, data);
    }, 500);
  };

  // Process cold-start payload saved before auth
  if (pendingOpenData) {
    const data = pendingOpenData;
    pendingOpenData = null;
    openWithData(data);
  }

  if (openHandlersSubscribed) {
    return () => {};
  }
  openHandlersSubscribed = true;

  const unsubscribeOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
    openWithData(remoteMessage?.data || {});
  });

  return () => {
    openHandlersSubscribed = false;
    if (typeof unsubscribeOpened === 'function') {
      unsubscribeOpened();
    }
  };
}

export default {
  requestPushPermission,
  getFcmToken,
  registerPushTokenWithBackend,
  unregisterPushTokenFromBackend,
  initFirebaseMessaging,
  cleanupFirebaseMessaging,
  setupNotificationOpenHandlers,
};
