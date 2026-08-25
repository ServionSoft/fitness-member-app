import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getProfileImageSource, ProfileImage } from '../utils/imageUtils';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { useNotificationContext } from '../contexts/NotificationContext';
import { API_BASE_URL } from '@env';

const HeaderBar = ({ onMenuPress, title, onBackPress, showBack = false, onNotificationPress, notificationCount: propNotificationCount, showNotification = true }) => {
  const { userData } = useAuth();
  const navigation = useNavigation();
  const hookData = useUnreadNotifications();
  const insets = useSafeAreaInsets();
  
  // Try to use context if available (shared state across all screens)
  let contextData = null;
  try {
    contextData = useNotificationContext();
  } catch (e) {
    // Context not available, will use hook
  }
  
  // Use context's unreadCount (shared across all screens) if available, 
  // otherwise fall back to hook
  const unreadCount = contextData?.unreadCount ?? hookData?.unreadCount ?? 0;
  const refreshUnreadCount = contextData?.refresh ?? hookData?.refresh;
  
  // Use prop notificationCount if provided, otherwise use the shared unreadCount
  const notificationCount = propNotificationCount !== undefined ? propNotificationCount : unreadCount;
  
  // Refresh unread count when screen comes into focus
  // This ensures badge updates when navigating back from NotificationScreen
  useFocusEffect(
    React.useCallback(() => {
      if (propNotificationCount === undefined) {
        // Add a small delay to ensure server has processed the update
        const timer = setTimeout(() => {
          refreshUnreadCount();
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [refreshUnreadCount, propNotificationCount])
  );
  
  // Default notification handler if not provided
  const handleNotificationPress = onNotificationPress || (() => {
    navigation.navigate('NotificationScreen');
  });

  // Get user's full name by merging firstname and lastname
  const fullName = useMemo(() => {
    if (userData) {
      const firstName = userData.firstname || '';
      const lastName = userData.lastname || '';
      return `${firstName} ${lastName}`.trim();
    }
    return 'User';
  }, [userData?.firstname, userData?.lastname]);

  // Memoize profile image source to prevent unnecessary re-renders
  // Only recalculate if userData or profile_image/avatar actually changes
  const profileImageSource = useMemo(() => {
    const baseUrl = API_BASE_URL ? API_BASE_URL.replace('/api', '') : '';
    return getProfileImageSource(userData, baseUrl);
  }, [userData?.profile_image, userData?.avatar]);

  return (
    <View style={[styles.headerFixed, { paddingTop: insets.top + 10 }]}>
      {showBack ? (
        <>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackPress}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            activeOpacity={0.6}
          >
            <Ionicons name="arrow-back" size={22} color="#6b6b6b" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          {showNotification ? (
            <TouchableOpacity 
              style={styles.notificationButtonBack} 
              onPress={handleNotificationPress}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="bell-outline" size={20} color="#6b6b6b" />
              {notificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </>
      ) : (
        <>
          <ProfileImage source={profileImageSource} style={styles.avatar} />
          <Text style={styles.greeting}>Hello, {fullName}</Text>
          <View style={styles.rightButtons}>
            {showNotification && (
              <TouchableOpacity 
                style={styles.notificationButton} 
                onPress={handleNotificationPress}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="bell-outline" size={20} color="#6b6b6b" />
                {notificationCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.barcodeButton} 
              onPress={() => navigation.navigate('BarcodeScanner')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="barcode-scan" size={20} color="#6b6b6b" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
              <Ionicons name="menu" size={24} color="#6b6b6b" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8f2',
    paddingHorizontal: 20,
    paddingTop: '5%',
    paddingBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: '#000',
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    position: 'relative',
    marginRight: 4,
  },
  barcodeButton: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    marginRight: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#f7f8f2',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  menuButton: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#eceee7',
  },
  backButton: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  notificationButtonBack: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Memoize HeaderBar to prevent unnecessary re-renders
export default React.memo(HeaderBar, (prevProps, nextProps) => {
  // Only re-render if props actually changed
  if (prevProps.showBack !== nextProps.showBack) return false;
  if (prevProps.title !== nextProps.title) return false;
  if (prevProps.onMenuPress !== nextProps.onMenuPress) return false;
  if (prevProps.onBackPress !== nextProps.onBackPress) return false;
  if (prevProps.onNotificationPress !== nextProps.onNotificationPress) return false;
  if (prevProps.notificationCount !== nextProps.notificationCount) return false;
  if (prevProps.showNotification !== nextProps.showNotification) return false;
  
  // Props are equal, skip re-render
  return true;
}); 