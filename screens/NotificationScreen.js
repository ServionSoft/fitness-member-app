import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { formatDistanceToNow, parseISO, format, isToday, isYesterday } from 'date-fns';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { useNotificationContext } from '../contexts/NotificationContext';
import ModernAlert from '../components/ModernAlert';

const DEFAULT_NOTIFICATION_ICON = { lib: 'MaterialCommunityIcons', name: 'bell-outline' };

const NOTIFICATION_TYPE_ICONS = {
  workout: { lib: 'MaterialCommunityIcons', name: 'dumbbell' },
  workouts: { lib: 'MaterialCommunityIcons', name: 'dumbbell' },
  exercise: { lib: 'MaterialCommunityIcons', name: 'dumbbell' },
  training: { lib: 'MaterialCommunityIcons', name: 'dumbbell' },
  nutrition: { lib: 'MaterialCommunityIcons', name: 'food-apple-outline' },
  meal: { lib: 'MaterialCommunityIcons', name: 'food-apple-outline' },
  meals: { lib: 'MaterialCommunityIcons', name: 'food-apple-outline' },
  diet: { lib: 'MaterialCommunityIcons', name: 'food-apple-outline' },
  schedule: { lib: 'MaterialCommunityIcons', name: 'calendar-clock' },
  booking: { lib: 'MaterialCommunityIcons', name: 'calendar-check' },
  bookings: { lib: 'MaterialCommunityIcons', name: 'calendar-check' },
  appointment: { lib: 'MaterialCommunityIcons', name: 'calendar-check' },
  challenge: { lib: 'MaterialCommunityIcons', name: 'trophy-outline' },
  challenges: { lib: 'MaterialCommunityIcons', name: 'trophy-outline' },
  payment: { lib: 'MaterialCommunityIcons', name: 'credit-card-outline' },
  billing: { lib: 'MaterialCommunityIcons', name: 'credit-card-outline' },
  invoice: { lib: 'MaterialCommunityIcons', name: 'receipt' },
  message: { lib: 'MaterialCommunityIcons', name: 'message-text-outline' },
  chat: { lib: 'MaterialCommunityIcons', name: 'message-text-outline' },
  comment: { lib: 'MaterialCommunityIcons', name: 'comment-outline' },
  user: { lib: 'MaterialCommunityIcons', name: 'account-outline' },
  member: { lib: 'MaterialCommunityIcons', name: 'account-outline' },
  account: { lib: 'MaterialCommunityIcons', name: 'account-outline' },
  reminder: { lib: 'MaterialCommunityIcons', name: 'bell-ring-outline' },
  activity: { lib: 'MaterialCommunityIcons', name: 'run' },
  progress: { lib: 'MaterialCommunityIcons', name: 'chart-line' },
  note: { lib: 'MaterialCommunityIcons', name: 'note-text-outline' },
  notes: { lib: 'MaterialCommunityIcons', name: 'note-text-outline' },
  system: { lib: 'MaterialCommunityIcons', name: 'cog-outline' },
  success: { lib: 'MaterialCommunityIcons', name: 'check-circle-outline' },
  info: { lib: 'MaterialCommunityIcons', name: 'information-outline' },
  warning: { lib: 'MaterialCommunityIcons', name: 'alert-outline' },
  error: { lib: 'MaterialCommunityIcons', name: 'alert-circle-outline' },
  danger: { lib: 'MaterialCommunityIcons', name: 'alert-circle-outline' },
};

const ICON_ALIAS_MAP = {
  bell: { lib: 'MaterialCommunityIcons', name: 'bell-outline' },
  'bell-o': { lib: 'MaterialCommunityIcons', name: 'bell-outline' },
  'user-plus': { lib: 'MaterialCommunityIcons', name: 'account-plus-outline' },
  user: { lib: 'MaterialCommunityIcons', name: 'account-outline' },
  calendar: { lib: 'MaterialCommunityIcons', name: 'calendar-outline' },
  'calendar-check': { lib: 'MaterialCommunityIcons', name: 'calendar-check' },
  'calendar-check-o': { lib: 'MaterialCommunityIcons', name: 'calendar-check' },
  'calendar-times-o': { lib: 'MaterialCommunityIcons', name: 'calendar-remove' },
  dumbbell: { lib: 'MaterialCommunityIcons', name: 'dumbbell' },
  trophy: { lib: 'MaterialCommunityIcons', name: 'trophy-outline' },
  apple: { lib: 'MaterialCommunityIcons', name: 'food-apple-outline' },
  'apple-alt': { lib: 'MaterialCommunityIcons', name: 'food-apple-outline' },
  utensils: { lib: 'MaterialCommunityIcons', name: 'silverware-fork-knife' },
  envelope: { lib: 'MaterialCommunityIcons', name: 'email-outline' },
  'envelope-o': { lib: 'MaterialCommunityIcons', name: 'email-outline' },
  comment: { lib: 'MaterialCommunityIcons', name: 'comment-outline' },
  comments: { lib: 'MaterialCommunityIcons', name: 'comment-multiple-outline' },
  'comment-o': { lib: 'MaterialCommunityIcons', name: 'comment-outline' },
  check: { lib: 'MaterialCommunityIcons', name: 'check' },
  'check-circle': { lib: 'MaterialCommunityIcons', name: 'check-circle-outline' },
  'check-circle-o': { lib: 'MaterialCommunityIcons', name: 'check-circle-outline' },
  'circle-check': { lib: 'MaterialCommunityIcons', name: 'check-circle-outline' },
  info: { lib: 'MaterialCommunityIcons', name: 'information-outline' },
  'info-circle': { lib: 'MaterialCommunityIcons', name: 'information-outline' },
  exclamation: { lib: 'MaterialCommunityIcons', name: 'alert-outline' },
  'exclamation-triangle': { lib: 'MaterialCommunityIcons', name: 'alert-outline' },
  'exclamation-circle': { lib: 'MaterialCommunityIcons', name: 'alert-circle-outline' },
  warning: { lib: 'MaterialCommunityIcons', name: 'alert-outline' },
  times: { lib: 'MaterialCommunityIcons', name: 'close-circle-outline' },
  'times-circle': { lib: 'MaterialCommunityIcons', name: 'close-circle-outline' },
  'credit-card': { lib: 'MaterialCommunityIcons', name: 'credit-card-outline' },
  'credit-card-alt': { lib: 'MaterialCommunityIcons', name: 'credit-card-outline' },
  money: { lib: 'MaterialCommunityIcons', name: 'cash' },
  heartbeat: { lib: 'MaterialCommunityIcons', name: 'heart-pulse' },
  heart: { lib: 'MaterialCommunityIcons', name: 'heart-outline' },
  star: { lib: 'MaterialCommunityIcons', name: 'star-outline' },
  clock: { lib: 'MaterialCommunityIcons', name: 'clock-outline' },
  'clock-o': { lib: 'MaterialCommunityIcons', name: 'clock-outline' },
  cog: { lib: 'MaterialCommunityIcons', name: 'cog-outline' },
  gear: { lib: 'MaterialCommunityIcons', name: 'cog-outline' },
  running: { lib: 'MaterialCommunityIcons', name: 'run' },
  run: { lib: 'MaterialCommunityIcons', name: 'run' },
  person: { lib: 'MaterialCommunityIcons', name: 'account-outline' },
  'person-running': { lib: 'MaterialCommunityIcons', name: 'run' },
  fire: { lib: 'MaterialCommunityIcons', name: 'fire' },
  bolt: { lib: 'MaterialCommunityIcons', name: 'lightning-bolt' },
  bullhorn: { lib: 'MaterialCommunityIcons', name: 'bullhorn-outline' },
  megaphone: { lib: 'MaterialCommunityIcons', name: 'bullhorn-outline' },
  certificate: { lib: 'MaterialCommunityIcons', name: 'certificate-outline' },
  gift: { lib: 'MaterialCommunityIcons', name: 'gift-outline' },
  'thumbs-up': { lib: 'MaterialCommunityIcons', name: 'thumb-up-outline' },
};

const normalizeIconKey = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .trim()
    .replace(/^(fa[srb]?|fas|far|fab|fi)\s+/g, '')
    .replace(/^fa-/g, '')
    .replace(/\s+/g, '-')
    .replace(/_/g, '-');
};

const inferIconFromText = (title = '', message = '') => {
  const text = `${title} ${message}`.toLowerCase();
  if (/workout|exercise|training|gym/.test(text)) return NOTIFICATION_TYPE_ICONS.workout;
  if (/nutrition|meal|diet|calorie|food/.test(text)) return NOTIFICATION_TYPE_ICONS.nutrition;
  if (/schedule|booking|appointment|class/.test(text)) return NOTIFICATION_TYPE_ICONS.schedule;
  if (/challenge|competition/.test(text)) return NOTIFICATION_TYPE_ICONS.challenge;
  if (/payment|billing|invoice|subscription/.test(text)) return NOTIFICATION_TYPE_ICONS.payment;
  if (/message|chat|comment/.test(text)) return NOTIFICATION_TYPE_ICONS.message;
  if (/reminder/.test(text)) return NOTIFICATION_TYPE_ICONS.reminder;
  if (/note/.test(text)) return NOTIFICATION_TYPE_ICONS.note;
  return null;
};

const getNotificationIconConfig = (notification) => {
  const iconKey = normalizeIconKey(notification?.icon);
  if (iconKey && ICON_ALIAS_MAP[iconKey]) return ICON_ALIAS_MAP[iconKey];

  const typeKey = normalizeIconKey(
    notification?.type || notification?.notification_type || notification?.category
  );
  if (typeKey && NOTIFICATION_TYPE_ICONS[typeKey]) return NOTIFICATION_TYPE_ICONS[typeKey];
  if (typeKey && ICON_ALIAS_MAP[typeKey]) return ICON_ALIAS_MAP[typeKey];

  const colorKey = normalizeIconKey(notification?.color);
  if (colorKey && NOTIFICATION_TYPE_ICONS[colorKey]) return NOTIFICATION_TYPE_ICONS[colorKey];

  const textIcon = inferIconFromText(notification?.title, notification?.message);
  if (textIcon) return textIcon;

  if (iconKey) {
    if (iconKey.includes('workout') || iconKey.includes('dumbbell')) return NOTIFICATION_TYPE_ICONS.workout;
    if (iconKey.includes('calendar') || iconKey.includes('schedule')) return NOTIFICATION_TYPE_ICONS.schedule;
    if (iconKey.includes('food') || iconKey.includes('meal') || iconKey.includes('nutrition')) {
      return NOTIFICATION_TYPE_ICONS.nutrition;
    }
    if (iconKey.includes('trophy') || iconKey.includes('challenge')) return NOTIFICATION_TYPE_ICONS.challenge;
    if (iconKey.includes('user') || iconKey.includes('account') || iconKey.includes('member')) {
      return NOTIFICATION_TYPE_ICONS.user;
    }
    if (iconKey.includes('bell')) return DEFAULT_NOTIFICATION_ICON;
    if (iconKey.includes('message') || iconKey.includes('envelope') || iconKey.includes('comment')) {
      return NOTIFICATION_TYPE_ICONS.message;
    }
    if (iconKey.includes('card') || iconKey.includes('payment') || iconKey.includes('billing')) {
      return NOTIFICATION_TYPE_ICONS.payment;
    }
  }

  if (typeKey) {
    if (typeKey.includes('workout')) return NOTIFICATION_TYPE_ICONS.workout;
    if (typeKey.includes('nutrition') || typeKey.includes('meal')) return NOTIFICATION_TYPE_ICONS.nutrition;
    if (typeKey.includes('schedule') || typeKey.includes('booking')) return NOTIFICATION_TYPE_ICONS.schedule;
    if (typeKey.includes('challenge')) return NOTIFICATION_TYPE_ICONS.challenge;
  }

  return DEFAULT_NOTIFICATION_ICON;
};

const NotificationIcon = ({ notification, size, color }) => {
  const config = getNotificationIconConfig(notification);
  if (config.lib === 'Ionicons') {
    return <Ionicons name={config.name} size={size} color={color} />;
  }
  if (config.lib === 'Feather') {
    return <Feather name={config.name} size={size} color={color} />;
  }
  return <MaterialCommunityIcons name={config.name} size={size} color={color} />;
};




export default function NotificationScreen() {
  const { userData, logout } = useAuth();
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
  
  // Use context's refresh and decrement functions for global updates
  const refreshUnreadCount = contextData?.refresh ?? hookData?.refresh;
  const decrementUnreadCount = contextData?.decrementCount;
  const setUnreadCount = contextData?.setCount;
  const unreadCount = contextData?.unreadCount ?? hookData?.unreadCount ?? 0;
  const [menuVisible, setMenuVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  
  // Calculate local unread count from notifications for immediate UI updates
  const localUnreadCount = notifications.filter(n => !n.is_read).length;
  
  // Use local count when we have notifications loaded (for instant updates),
  // otherwise use hook's unreadCount (for initial load or when notifications list is empty)
  const displayUnreadCount = notifications.length > 0 ? localUnreadCount : unreadCount;
  
  // Ensure notifications is always an array
  useEffect(() => {
    if (!Array.isArray(notifications)) {
      setNotifications([]);
    }
  }, [notifications]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);

  const API_BASE_URL = ENV_API_BASE_URL;

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      setMarkingAllAsRead(true);
      
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) return false;

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        // Update local state to mark all as read immediately
        setNotifications(prevNotifications => 
          prevNotifications.map(n => ({ ...n, is_read: true }))
        );
        
        // Reset unread count to 0 in shared context (instant UI update)
        if (setUnreadCount) {
          setUnreadCount(0);
        } else if (decrementUnreadCount && localUnreadCount > 0) {
          // Fallback: decrement multiple times for each unread notification
          const currentCount = contextData?.unreadCount || localUnreadCount;
          for (let i = 0; i < currentCount; i++) {
            decrementUnreadCount();
          }
        }
        
        // Also refresh from server to ensure accuracy
        if (refreshUnreadCount) {
          refreshUnreadCount();
        }
        
        // Show success message
        setAlertConfig({
          title: 'Success',
          message: 'All notifications have been marked as read',
          type: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
        
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark all notifications as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      setAlertConfig({
        title: 'Error',
        message: error.message || 'Failed to mark all notifications as read',
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
      return false;
    } finally {
      setMarkingAllAsRead(false);
    }
  };

  // Mark notification as read
  const markNotificationAsRead = async (notificationId) => {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) return false;

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/notifications/${notificationId}/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        // Update local state to mark as read immediately
        setNotifications(prevNotifications => 
          prevNotifications.map(n => 
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        
        // Immediately decrement count in shared context (instant UI update)
        if (decrementUnreadCount) {
          decrementUnreadCount();
        }
        
        // Also refresh from server to ensure accuracy
        if (refreshUnreadCount) {
          refreshUnreadCount();
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  };

  const fetchNotifications = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      // Get the stored token
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        console.error('No token found');
        setError('Authentication required');
        setLoading(false);
        setRefreshing(false);
        return null;
      }
  
      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }
  
      const response = await fetch(`${API_BASE_URL}/mobile/notifications`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });
  
      if (response.ok) {
        const data = await response.json();
        console.log(data);
        
        // Handle the nested response structure: data.data.data
        let notificationsData = [];
        if (data && data.data && data.data.data && Array.isArray(data.data.data)) {
          notificationsData = data.data.data;
        } else if (data && data.data && Array.isArray(data.data)) {
          notificationsData = data.data;
        } else if (data && Array.isArray(data)) {
          notificationsData = data;
        } else if (data && data.notifications && Array.isArray(data.notifications)) {
          notificationsData = data.notifications;
        }
        
        setNotifications(notificationsData);
        
        return data;
      } else {
        // Get the error response body
        const errorData = await response.json();
        console.log(errorData);
        setError('Failed to fetch notifications');
        return null;
      }
    } catch (error) {
      setError('Network error occurred');
      setNotifications([]); // Ensure notifications is always an array
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    await fetchNotifications(true);
    refreshUnreadCount();
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Refresh unread count when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refreshUnreadCount();
      
      // Return cleanup function to refresh when leaving screen
      // This ensures other screens' HeaderBar badges update
      return () => {
        // Small delay to ensure server has processed the update
        setTimeout(() => {
          refreshUnreadCount();
        }, 200);
      };
    }, [refreshUnreadCount])
  );

  const handleLogoutRequest = (logoutFunction) => {
    setAlertConfig({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      type: 'warning',
      buttons: [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'secondary',
        },
        {
          text: 'Logout',
          onPress: () => logoutFunction(),
          style: 'secondary',
        },
      ],
    });
    setAlertVisible(true);
  };

  const handleMenuItemPress = (item) => {
    setMenuVisible(false);
    handleMenuItemAction(item, navigation, logout, handleLogoutRequest);
  };

  const handleNotificationPress = async (notification) => {
    // Mark notification as read if it's unread
    if (!notification.is_read && notification.id) {
      await markNotificationAsRead(notification.id);
    }
    
    // Open the modal
    setSelectedNotification(notification);
    setNotificationModalVisible(true);
  };

  const closeNotificationModal = () => {
    setNotificationModalVisible(false);
    setSelectedNotification(null);
  };

  // Mark notification as read when modal opens
  useEffect(() => {
    if (notificationModalVisible && selectedNotification && !selectedNotification.is_read && selectedNotification.id) {
      markNotificationAsRead(selectedNotification.id).then(() => {
        // Update selectedNotification state to reflect read status
        setSelectedNotification(prev => prev ? { ...prev, is_read: true } : null);
      });
    }
  }, [notificationModalVisible, selectedNotification]);

  // Format time for display (relative or absolute)
  const formatNotificationTime = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = parseISO(dateString);
      const now = new Date();
      const diffInHours = (now - date) / (1000 * 60 * 60);
      
      if (diffInHours < 1) {
        return 'Just now';
      } else if (diffInHours < 24) {
        return formatDistanceToNow(date, { addSuffix: true });
      } else if (isToday(date)) {
        return `Today at ${format(date, 'h:mm a')}`;
      } else if (isYesterday(date)) {
        return `Yesterday at ${format(date, 'h:mm a')}`;
      } else {
        return format(date, 'MMM d, yyyy h:mm a');
      }
    } catch (e) {
      return 'Unknown';
    }
  };

  // Get color for notification based on color field
  const getNotificationColor = (color) => {
    switch (color) {
      case 'success':
        return '#4CAF50';
      case 'info':
        return '#2196F3';
      case 'warning':
        return '#FF9800';
      case 'error':
      case 'danger':
        return '#F44336';
      default:
        return '#4CAF50';
    }
  };

  // Get background color for icon based on notification color
  const getIconBackgroundColor = (color) => {
    switch (color) {
      case 'success':
        return '#E8F5E9';
      case 'info':
        return '#E3F2FD';
      case 'warning':
        return '#FFF3E0';
      case 'error':
      case 'danger':
        return '#FFEBEE';
      default:
        return '#E8F5E9';
    }
  };

  const renderMenuIcon = (item, idx) => {
    let IconComponent = MaterialCommunityIcons;
    if (item.lib === 'Feather') IconComponent = Feather;
    if (item.lib === 'Ionicons') IconComponent = Ionicons;
    return (
      <View key={item.label} style={{ alignItems: 'center' }}>
        <IconComponent name={item.icon} size={32} color="#222" />
        <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 5, color: '#000' }}>{item.label}</Text>
      </View>
    );
  };

  // Show loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderBar
          showBack
          title="Notifications"
          showNotification={false}
          onBackPress={() => navigation.goBack()}
        />
        <View style={[styles.loadingContainer, { paddingTop: insets.top + 70 }]}>
          <ActivityIndicator size="large" color="#222" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.container}>
        <HeaderBar
          showBack
          title="Notifications"
          showNotification={false}
          onBackPress={() => navigation.goBack()}
        />
        <View style={[styles.errorContainer, { paddingTop: insets.top + 70 }]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchNotifications}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Check if there are no notifications or if notifications is undefined
  if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
    return (
      <View style={styles.container}>
        {/* Menu Modal */}
        <MenuModal
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          menuItems={menuItems}
          renderMenuIcon={renderMenuIcon}
          onMenuItemPress={handleMenuItemPress}
        />
        {/* Fixed Header */}
        <HeaderBar
          showBack
          title="Notifications"
          showNotification={false}
          onBackPress={() => navigation.goBack()}
        />
        <View style={[styles.noNotificationsContainer, { paddingTop: insets.top + 70 }]}>
          <View style={styles.noNotificationsIconContainer}>
            <MaterialCommunityIcons name="bell-off-outline" size={80} color="#ccc" />
          </View>
          <Text style={styles.noNotificationsTitle}>No Notifications</Text>
          <Text style={styles.noNotificationsSubtitle}>
            You're all caught up! No new notifications at the moment.
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchNotifications}>
            <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Menu Modal */}
      <MenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        menuItems={menuItems}
        renderMenuIcon={renderMenuIcon}
        onMenuItemPress={handleMenuItemPress}
      />
      {/* Header */}
      <HeaderBar
        showBack
        title="Notifications"
        showNotification={false}
        onBackPress={() => navigation.goBack()}
      />
      <View style={{ paddingTop: insets.top + 70, flex: 1, paddingBottom: insets.bottom }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Notifications</Text>
          {localUnreadCount > 0 && (
            <TouchableOpacity
              style={[styles.markAllButton, markingAllAsRead && styles.markAllButtonDisabled]}
              onPress={markAllAsRead}
              disabled={markingAllAsRead}
            >
              {markingAllAsRead ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={16} color="#fff" />
                  <Text style={styles.markAllButtonText}>Mark All Read</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#222"
              colors={['#222']}
            />
          }
        >
          {Array.isArray(notifications) && notifications.map((n, idx) => {
            const isUnread = !n.is_read;
            const iconColor = getNotificationColor(n.color);
            const iconBgColor = getIconBackgroundColor(n.color);
            
            return (
              <TouchableOpacity 
                key={n.id || idx} 
                style={[
                  styles.card,
                  isUnread && styles.cardUnread
                ]} 
                onPress={() => handleNotificationPress(n)}
                activeOpacity={0.7}
              >
                {/* Icon */}
                <View style={[styles.iconBox, { backgroundColor: iconBgColor }]}>
                  <NotificationIcon notification={n} size={18} color={iconColor} />
                </View>
                
                {/* Content */}
                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]} numberOfLines={1}>
                      {n.title || 'Notification'}
                    </Text>
                    <Text style={styles.cardDate}>
                      {formatNotificationTime(n.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.cardMessage} numberOfLines={2}>
                    {n.message || 'No message'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        
        {/* Notification Detail Modal */}
        <Modal
          visible={notificationModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={closeNotificationModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Notification Details</Text>
                <TouchableOpacity onPress={closeNotificationModal} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              {selectedNotification && (
                <View style={styles.modalBody}>
                  <View style={[
                    styles.modalIconContainer,
                    { backgroundColor: getIconBackgroundColor(selectedNotification.color) }
                  ]}>
                    <NotificationIcon
                      notification={selectedNotification}
                      size={28}
                      color={getNotificationColor(selectedNotification.color)}
                    />
                  </View>
                  
                  <Text style={styles.modalNotificationTitle}>
                    {selectedNotification.title || 'Notification'}
                  </Text>
                  
                  <Text style={styles.modalMessage}>
                    {selectedNotification.message || 'No message'}
                  </Text>
                  
                  <View style={styles.modalDivider} />
                  
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Type:</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedNotification.type ? selectedNotification.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}
                    </Text>
                  </View>
                  
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Time:</Text>
                    <Text style={styles.modalInfoValue}>
                      {formatNotificationTime(selectedNotification.created_at)}
                    </Text>
                  </View>
                  
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Status:</Text>
                    <View style={styles.statusBadge}>
                      <View style={[
                        styles.statusDot,
                        { backgroundColor: selectedNotification.is_read ? '#000' : '#666' }
                      ]} />
                      <Text style={styles.modalInfoValue}>
                        {selectedNotification.is_read ? 'Read' : 'Unread'}
                      </Text>
                    </View>
                  </View>
                  
                  {selectedNotification.related_type && (
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoLabel}>Related:</Text>
                      <Text style={styles.modalInfoValue}>
                        {selectedNotification.related_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={closeNotificationModal}>
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modern Alert for Logout */}
        <ModernAlert
          visible={alertVisible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          buttons={alertConfig.buttons}
          onClose={() => setAlertVisible(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 20,
    marginRight: 20,
    marginBottom: 16,
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
    letterSpacing: -0.3,
    flex: 1,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  markAllButtonDisabled: {
    opacity: 0.6,
  },
  markAllButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    paddingLeft: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    borderWidth: 0.5,
    borderColor: '#e8e8e8',
  },
  cardUnread: {
    backgroundColor: '#FAFBFC',
    borderLeftColor: '#000',
    elevation: 2,
    shadowOpacity: 0.1,
    borderColor: '#e0e0e0',
  },
  unreadDot: {
    position: 'absolute',
    left: 4,
    top: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardContent: {
    flex: 1,
    paddingRight: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    flex: 1,
    marginRight: 8,
    letterSpacing: 0.1,
  },
  cardTitleUnread: {
    fontWeight: '700',
    color: '#000',
  },
  cardMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    letterSpacing: 0.05,
    marginTop: 2,
  },
  cardDate: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
    minWidth: 70,
    textAlign: 'right',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 9,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f8f2',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f8f2',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#222',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noNotificationsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f8f2',
    padding: 20,
  },
  noNotificationsIconContainer: {
    backgroundColor: '#e8e8e8',
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noNotificationsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  noNotificationsSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 22,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 22,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    letterSpacing: -0.2,
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    padding: 16,
  },
  modalIconContainer: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalNotificationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  modalMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
    letterSpacing: 0.05,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  modalInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.1,
  },
  modalInfoValue: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
    letterSpacing: 0.1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  modalFooter: {
    padding: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalCloseBtn: {
    backgroundColor: '#222',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 22,
    minWidth: 110,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  modalCloseBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 