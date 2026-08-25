import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useAuth } from '../contexts/AuthContext';
import { getAuthToken } from '../utils/tokenUtils';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

export default function CheckInCheckOutScreen({ navigation }) {
  const { userData, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkInHistory, setCheckInHistory] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null); // { checkedIn: boolean, checkInTime: string, checkOutTime: string }
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });

  const API_BASE_URL = ENV_API_BASE_URL;

  const handleMenuItemPress = (item) => {
    setMenuVisible(false);
    handleMenuItemAction(item, navigation, logout, handleLogoutRequest);
  };

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

  const renderMenuIcon = (item, idx) => {
    let IconComponent = MaterialCommunityIcons;
    if (item.lib === 'Feather') IconComponent = require('react-native-vector-icons/Feather').default;
    if (item.lib === 'Ionicons') IconComponent = Ionicons;
    return (
      <View key={item.label} style={{ alignItems: 'center' }}>
        <IconComponent name={item.icon} size={32} color="#222" />
        <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 5, color: '#000' }}>{item.label}</Text>
      </View>
    );
  };

  // Fetch current check-in status
  const fetchCurrentStatus = async () => {
    try {
      const authHeader = await getAuthToken();
      if (!authHeader) {
        console.warn('No auth token available');
        return;
      }

      console.log('🔵 [Check-In Status] Fetching status from:', `${API_BASE_URL}/mobile/check-in/status`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/check-in/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      console.log('📡 [Check-In Status] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [Check-In Status] Success Response:', JSON.stringify(data, null, 2));
        setCurrentStatus(data.data || null);
      } else if (response.status === 404) {
        // No active check-in found
        const errorData = await response.json().catch(() => ({}));
        console.log('ℹ️ [Check-In Status] No active check-in found:', JSON.stringify(errorData, null, 2));
        setCurrentStatus(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [Check-In Status] Error Response:', response.status, JSON.stringify(errorData, null, 2));
      }
    } catch (error) {
      console.error('❌ [Check-In Status] Exception:', error);
    }
  };

  // Fetch check-in history
  const fetchCheckInHistory = async () => {
    try {
      setLoading(true);
      const authHeader = await getAuthToken();
      if (!authHeader) {
        console.warn('No auth token available');
        setLoading(false);
        return;
      }

      console.log('🔵 [Check-In History] Fetching history from:', `${API_BASE_URL}/mobile/check-in/history`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/check-in/history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      console.log('📡 [Check-In History] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [Check-In History] Success Response:', JSON.stringify(data, null, 2));
        console.log('📊 [Check-In History] Number of records:', data.data?.length || 0);
        setCheckInHistory(data.data || []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [Check-In History] Error Response:', response.status, JSON.stringify(errorData, null, 2));
        setCheckInHistory([]);
      }
    } catch (error) {
      console.error('❌ [Check-In History] Exception:', error);
      setCheckInHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle check-in
  const handleCheckIn = async () => {
    try {
      setLoading(true);
      const authHeader = await getAuthToken();
      if (!authHeader) {
        setAlertConfig({
          title: 'Error',
          message: 'Authentication required. Please login again.',
          type: 'error',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        setAlertVisible(true);
        setLoading(false);
        return;
      }

      console.log('🔵 [Check-In] Sending check-in request to:', `${API_BASE_URL}/mobile/check-in`);
      console.log('📤 [Check-In] Request body:', JSON.stringify({}, null, 2));
      
      const response = await fetch(`${API_BASE_URL}/mobile/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({}),
      });

      console.log('📡 [Check-In] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [Check-In] Success Response:', JSON.stringify(data, null, 2));
        setAlertConfig({
          title: 'Success',
          message: 'You have successfully checked in!',
          type: 'success',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        setAlertVisible(true);
        // Refresh status and history
        await fetchCurrentStatus();
        await fetchCheckInHistory();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [Check-In] Error Response:', response.status, JSON.stringify(errorData, null, 2));
        setAlertConfig({
          title: 'Error',
          message: errorData.message || 'Failed to check in. Please try again.',
          type: 'error',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        setAlertVisible(true);
      }
    } catch (error) {
      console.error('Error checking in:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Network error occurred. Please check your connection and try again.',
        type: 'error',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    try {
      setLoading(true);
      const authHeader = await getAuthToken();
      if (!authHeader) {
        setAlertConfig({
          title: 'Error',
          message: 'Authentication required. Please login again.',
          type: 'error',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        setAlertVisible(true);
        setLoading(false);
        return;
      }

      console.log('🔵 [Check-Out] Sending check-out request to:', `${API_BASE_URL}/mobile/check-out`);
      console.log('📤 [Check-Out] Request body:', JSON.stringify({}, null, 2));
      
      const response = await fetch(`${API_BASE_URL}/mobile/check-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({}),
      });

      console.log('📡 [Check-Out] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [Check-Out] Success Response:', JSON.stringify(data, null, 2));
        setAlertConfig({
          title: 'Success',
          message: 'You have successfully checked out!',
          type: 'success',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        setAlertVisible(true);
        // Refresh status and history
        await fetchCurrentStatus();
        await fetchCheckInHistory();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [Check-Out] Error Response:', response.status, JSON.stringify(errorData, null, 2));
        setAlertConfig({
          title: 'Error',
          message: errorData.message || 'Failed to check out. Please try again.',
          type: 'error',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        setAlertVisible(true);
      }
    } catch (error) {
      console.error('Error checking out:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Network error occurred. Please check your connection and try again.',
        type: 'error',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentStatus();
    fetchCheckInHistory();
  }, []);

  // Format date and time
  const formatDateTime = (dateString, timeString, datetimeString) => {
    // Prefer datetime string if available
    if (datetimeString) {
      const date = new Date(datetimeString);
      if (!isNaN(date.getTime())) {
        const options = { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: '2-digit', 
          minute: '2-digit' 
        };
        return date.toLocaleDateString('en-US', options);
      }
    }
    
    // Try to combine date and time
    if (dateString && timeString) {
      const combined = `${dateString} ${timeString}`;
      const date = new Date(combined);
      if (!isNaN(date.getTime())) {
        const options = { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: '2-digit', 
          minute: '2-digit' 
        };
        return date.toLocaleDateString('en-US', options);
      }
    }
    
    // Fallback to just dateString
    if (dateString) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      }
    }
    
    return 'N/A';
  };

  // Format time only
  const formatTime = (timeString, dateString, datetimeString) => {
    // Prefer datetime string if available
    if (datetimeString) {
      const date = new Date(datetimeString);
      if (!isNaN(date.getTime())) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      }
    }
    
    // Try to combine date and time
    if (dateString && timeString) {
      const combined = `${dateString} ${timeString}`;
      const date = new Date(combined);
      if (!isNaN(date.getTime())) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      }
    }
    
    // If only time string is provided, try to parse it directly
    if (timeString && timeString.includes(':')) {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const min = parseInt(minutes, 10);
      if (!isNaN(hour) && !isNaN(min)) {
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHours = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHours}:${min.toString().padStart(2, '0')} ${ampm}`;
      }
    }
    
    return 'N/A';
  };

  // Calculate duration
  const calculateDuration = (checkInTime, checkOutTime, checkInDate, checkOutDate, checkInDatetime, checkOutDatetime) => {
    if (!checkInTime || !checkOutTime) return 'N/A';
    
    // Try to use datetime strings first
    let start, end;
    
    if (checkInDatetime) {
      start = new Date(checkInDatetime);
    } else if (checkInDate && checkInTime) {
      start = new Date(`${checkInDate} ${checkInTime}`);
    } else {
      start = new Date(checkInTime);
    }
    
    if (checkOutDatetime) {
      end = new Date(checkOutDatetime);
    } else if (checkOutDate && checkOutTime) {
      end = new Date(`${checkOutDate} ${checkOutTime}`);
    } else {
      end = new Date(checkOutTime);
    }
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'N/A';
    }
    
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const isCheckedIn = currentStatus?.checked_in === true || currentStatus?.checkedIn === true;

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

      {/* HeaderBar */}
      <HeaderBar
        onMenuPress={() => setMenuVisible(true)}
        onNotificationPress={() => navigation.navigate('NotificationScreen')}
      />

      {/* Content */}
      <ScrollView 
        style={[styles.content, { paddingTop: insets.top + 80 }]} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Check In / Check Out</Text>
        <Text style={styles.subtitle}>Manage your gym attendance</Text>

        {/* Current Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIndicator, isCheckedIn ? styles.statusIndicatorActive : styles.statusIndicatorInactive]}>
              <MaterialCommunityIcons 
                name={isCheckedIn ? 'check-circle' : 'circle-outline'} 
                size={24} 
                color={isCheckedIn ? '#4CAF50' : '#999'} 
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Current Status</Text>
              <Text style={[styles.statusText, isCheckedIn && styles.statusTextActive]}>
                {isCheckedIn ? 'Checked In' : 'Not Checked In'}
              </Text>
            </View>
          </View>

          {isCheckedIn && (currentStatus?.check_in_time || currentStatus?.check_in_datetime) && (
            <View style={styles.statusDetails}>
              <View style={styles.statusDetailItem}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
                <Text style={styles.statusDetailText}>
                  Checked in at {formatTime(
                    currentStatus.check_in_time, 
                    currentStatus.check_in_date, 
                    currentStatus.check_in_datetime
                  )}
                </Text>
              </View>
              {currentStatus.check_in_date && (
                <View style={styles.statusDetailItem}>
                  <MaterialCommunityIcons name="calendar" size={16} color="#666" />
                  <Text style={styles.statusDetailText}>
                    {(() => {
                      const date = new Date(currentStatus.check_in_datetime || currentStatus.check_in_date);
                      if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'long', 
                          day: 'numeric' 
                        });
                      }
                      return currentStatus.check_in_date;
                    })()}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              isCheckedIn ? styles.checkOutButton : styles.checkInButton,
              loading && styles.actionButtonDisabled
            ]}
            onPress={isCheckedIn ? handleCheckOut : handleCheckIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons 
                  name={isCheckedIn ? 'logout' : 'login'} 
                  size={20} 
                  color="#fff" 
                />
                <Text style={styles.actionButtonText}>
                  {isCheckedIn ? 'Check Out' : 'Check In'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* History Section */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent History</Text>
            <TouchableOpacity onPress={fetchCheckInHistory}>
              <MaterialCommunityIcons name="refresh" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {loading && checkInHistory.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#222" />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : checkInHistory.length > 0 ? (
            <View style={styles.historyList}>
              {checkInHistory.map((record, index) => (
                <View key={record.id || index} style={styles.historyCard}>
                  <View style={styles.historyCardHeader}>
                    <View style={styles.historyDateContainer}>
                      <MaterialCommunityIcons name="calendar-clock" size={18} color="#222" />
                      <Text style={styles.historyDate}>
                        {formatDateTime(
                          record.check_in_date, 
                          record.check_in_time, 
                          record.check_in_datetime
                        )}
                      </Text>
                    </View>
                    {record.check_out_time && (
                      <View style={styles.historyDuration}>
                        <MaterialCommunityIcons name="timer-outline" size={14} color="#666" />
                        <Text style={styles.historyDurationText}>
                          {calculateDuration(
                            record.check_in_time, 
                            record.check_out_time,
                            record.check_in_date,
                            null,
                            record.check_in_datetime,
                            record.check_out_datetime
                          )}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.historyDetails}>
                    <View style={styles.historyDetailRow}>
                      <MaterialCommunityIcons name="login" size={14} color="#4CAF50" />
                      <Text style={styles.historyDetailText}>
                        In: {formatTime(
                          record.check_in_time, 
                          record.check_in_date, 
                          record.check_in_datetime
                        )}
                      </Text>
                    </View>
                    {record.check_out_time ? (
                      <View style={styles.historyDetailRow}>
                        <MaterialCommunityIcons name="logout" size={14} color="#F44336" />
                        <Text style={styles.historyDetailText}>
                          Out: {formatTime(
                            record.check_out_time, 
                            record.check_in_date, 
                            record.check_out_datetime
                          )}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.historyDetailRow}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color="#FF9800" />
                        <Text style={[styles.historyDetailText, styles.historyDetailTextActive]}>
                          Still checked in
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="history" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No Check-In History</Text>
              <Text style={styles.emptySubtitle}>Your check-in history will appear here</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modern Alert */}
      <ModernAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 24,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f7f8f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
  },
  statusIndicatorActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  statusIndicatorInactive: {
    borderColor: '#e0e0e0',
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  statusTextActive: {
    color: '#4CAF50',
  },
  statusDetails: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statusDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDetailText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  checkInButton: {
    backgroundColor: '#000',
  },
  checkOutButton: {
    backgroundColor: '#F44336',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  historySection: {
    marginTop: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  historyList: {
    gap: 12,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  historyDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f7f8f2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyDurationText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  historyDetails: {
    gap: 8,
  },
  historyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyDetailText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  historyDetailTextActive: {
    color: '#FF9800',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
});

