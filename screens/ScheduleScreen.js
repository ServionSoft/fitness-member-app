import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Dimensions, ImageBackground, ActivityIndicator, Modal, TouchableWithoutFeedback, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import { addDays, startOfWeek, format, isSameDay, startOfMonth, endOfMonth, endOfWeek, addMonths, isSameMonth, parseISO } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { useAuth } from '../contexts/AuthContext';
import ModernAlert from '../components/ModernAlert';


const { width: screenWidth } = Dimensions.get('window');

const getCurrentWeek = () => {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      label: format(date, 'EE').slice(0, 2),
      dateNum: format(date, 'd'),
      dateObj: date,
    };
  });
};

// Fallback data if API returns nothing
const fallbackSchedules = [
  {
    id: 'f1',
    image: require('../assets/images/schedule-1.jpg'),
    title: 'Open Gym',
    time: '',
    duration: '95 min',
    active: true,
  },
  {
    id: 'f2',
    image: require('../assets/images/schedule-2.jpg'),
    title: 'Lower Hypertrophy',
    time: '',
    duration: '60 min',
    active: false,
  },
];

const ScheduleScreen = () => {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [allSchedules, setAllSchedules] = useState([]); // Store all schedules
  const [filteredSchedules, setFilteredSchedules] = useState([]); // Filtered by selected date
  const [mySchedules, setMySchedules] = useState([]); // My booked schedules
  const [loading, setLoading] = useState(false);
  const [loadingMySchedules, setLoadingMySchedules] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const navigation = useNavigation();

  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = API_BASE_URL.replace('/api', ''); // For image URLs

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

  const weekDays = getCurrentWeek();

  // Filter schedules by selected date
  const filterSchedulesByDate = useCallback((schedules, date) => {
    if (!schedules || schedules.length === 0) {
      setFilteredSchedules([]);
      return;
    }

    const selectedDateStr = format(date, 'yyyy-MM-dd');
    const filtered = schedules.filter(schedule => {
      if (!schedule.date) return false;
      // Handle both date formats: "2025-12-09" or Date objects
      const scheduleDateStr = typeof schedule.date === 'string' 
        ? schedule.date.split('T')[0] // Remove time if present
        : format(new Date(schedule.date), 'yyyy-MM-dd');
      return scheduleDateStr === selectedDateStr;
    });
    
    console.log('Filtered schedules for', selectedDateStr, ':', filtered.length);
    setFilteredSchedules(filtered);
  }, []);

  // Update filtered schedules when selectedDate or allSchedules changes
  useEffect(() => {
    if (allSchedules.length > 0) {
      filterSchedulesByDate(allSchedules, selectedDate);
    } else {
      setFilteredSchedules([]);
    }
  }, [selectedDate, allSchedules, filterSchedulesByDate]);

  // Fetch user's workouts similar to ActivityCalendar
  const fetchMyWorkouts = async () => {
    try {
      setLoading(true);
      setError(null);

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        console.error('No token found');
        setError('Authentication required');
        setLoading(false);
        return null;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/schedule/events`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('API Response:', JSON.stringify(result, null, 2));
        const schedulesArray = result.data || [];
        console.log('Schedules Array:', JSON.stringify(schedulesArray, null, 2));
        console.log('Schedules Length:', schedulesArray.length);
        setAllSchedules(schedulesArray);
        // Filtering will happen automatically via useEffect when allSchedules updates
        return result;
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        console.error('Failed to fetch my workouts:', response.status);
        setError('Failed to fetch my workouts');
        return null;
      }
    } catch (err) {
      console.error('Error fetching my workouts:', err);
      setError('Network error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Fetch my schedules (booked events)
  const fetchMySchedules = async () => {
    try {
      setLoadingMySchedules(true);

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        console.error('No token found');
        setLoadingMySchedules(false);
        return null;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/schedule/my-bookings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('My Schedules Response:', JSON.stringify(result, null, 2));
        const mySchedulesArray = result.data || result.schedules || [];
        console.log('My Schedules Array:', JSON.stringify(mySchedulesArray, null, 2));
        setMySchedules(mySchedulesArray);
        return result;
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch my schedules' }));
        console.error('Failed to fetch my schedules:', response.status, errorData);
        setMySchedules([]);
        return null;
      }
    } catch (err) {
      console.error('Error fetching my schedules:', err);
      setMySchedules([]);
      return null;
    } finally {
      setLoadingMySchedules(false);
    }
  };

  useEffect(() => {
    fetchMyWorkouts();
    fetchMySchedules();
  }, []);

  // Refresh data when screen comes into focus (e.g., after booking/canceling from ScheduleDetailScreen)
  useFocusEffect(
    React.useCallback(() => {
      // Refresh both calendar schedules and my bookings when returning to this screen
      fetchMyWorkouts();
      fetchMySchedules();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMyWorkouts(), fetchMySchedules()]);
    setRefreshing(false);
  };

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
        onMenuPress={() => setMenuVisible(true)}
      />
      <ScrollView 
        contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: 120, alignItems: 'center', flexGrow: 1 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
      
        {/* Calendar Strip */}
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeaderRow}>
            <Text style={styles.calendarLabel}>Calendar</Text>
            <TouchableOpacity onPress={() => setCalendarVisible(true)} activeOpacity={0.7}>
              <MaterialCommunityIcons name="calendar-month-outline" size={22} color="#888" />
            </TouchableOpacity>
          </View>
          <View style={styles.calendarStrip}>
            {weekDays.map((d, idx) => {
              const isActive = isSameDay(d.dateObj, selectedDate);
              return (
                <TouchableOpacity
                  key={d.label + d.dateNum}
                  style={[styles.calendarDay, isActive && styles.calendarDayActive]}
                    onPress={() => {
                    setSelectedDate(d.dateObj);
                    // Filter schedules for the selected date
                    if (allSchedules.length > 0) {
                      filterSchedulesByDate(allSchedules, d.dateObj);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.calendarDayLabel, isActive && styles.calendarDayLabelActive]}>{d.label}</Text>
                  <Text style={[styles.calendarDayDate, isActive && styles.calendarDayLabelActive]}>{d.dateNum}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {/* No Schedules Message */}
        {!loading && (!filteredSchedules || filteredSchedules.length === 0) && (!mySchedules || mySchedules.length === 0) && (
          <Text style={styles.noWorkoutsText}>
            {isSameDay(selectedDate, new Date()) 
              ? 'No schedules for today' 
              : `No schedules for ${format(selectedDate, 'MMMM d, yyyy')}`}
          </Text>
        )}
        {/* Date Label */}
        {filteredSchedules && filteredSchedules.length > 0 && (
          <Text style={styles.todayLabel}>
            {isSameDay(selectedDate, new Date()) 
              ? 'Today' 
              : format(selectedDate, 'MMMM d, yyyy')}
          </Text>
        )}
        {/* My Schedules Section */}
        {mySchedules && mySchedules.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>My Schedules</Text>
            {loadingMySchedules ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color="#222" />
              </View>
            ) : (
              mySchedules.map((item, idx) => {
                const title = item.activity_name || item.title || 'Scheduled Activity';
                const startTime = item.start_time || '';
                const endTime = item.end_time || '';
                const timeText = startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || '';
                
                // Calculate duration from start_time and end_time
                let durationText = '';
                if (startTime && endTime) {
                  try {
                    const [startHour, startMin] = startTime.split(':').map(Number);
                    const [endHour, endMin] = endTime.split(':').map(Number);
                    const startMinutes = startHour * 60 + startMin;
                    const endMinutes = endHour * 60 + endMin;
                    const durationMinutes = endMinutes - startMinutes;
                    if (durationMinutes > 0) {
                      durationText = `${durationMinutes} min`;
                    }
                  } catch (e) {
                    console.error('Error calculating duration:', e);
                  }
                }
                
                const location = item.location || '';
                const capacity = item.capacity || '';
                let date = '';
                if (item.date) {
                  try {
                    const dateObj = typeof item.date === 'string' ? parseISO(item.date) : new Date(item.date);
                    date = format(dateObj, 'MMM d');
                  } catch (e) {
                    date = item.date;
                  }
                }
                
                // Get the correct event ID - check multiple possible field names
                // Note: For "My Schedules", the ID might be a booking ID, not the schedule event ID
                // So we'll use the event data directly and let ScheduleDetailScreen handle it
                const eventId = item.id || item.event_id || item.schedule_event_id;
                
                return (
                  <TouchableOpacity
                    key={`my-schedule-${eventId || `idx-${idx}`}`}
                    style={[styles.scheduleCardBanner, styles.myScheduleCard]}
                    onPress={() => {
                      // For "My Schedules", pass the event data directly
                      // The eventId might be a booking ID, not the schedule event ID
                      // ScheduleDetailScreen will use event data if API call fails
                      navigation.navigate('ScheduleDetail', { 
                        eventId: eventId, 
                        event: item,
                        fromMySchedules: true // Flag to indicate this is from My Schedules
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    {item.thumbnail ? (
                      <Image source={{ uri: `${BASE_URL}/${item.thumbnail}` }} style={styles.scheduleCardImage} />
                    ) : (
                      <View style={styles.scheduleCardPlaceholder}>
                        <MaterialCommunityIcons name="calendar-check" size={64} color="#4CAF50" />
                      </View>
                    )}
                    <View style={styles.scheduleCardOverlay} />
                    <View style={styles.scheduleTextBox}>
                      <View style={styles.myScheduleHeader}>
                        <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                        <Text style={styles.myScheduleBadge}>Booked</Text>
                      </View>
                      <Text style={styles.scheduleCardTitle}>{title}</Text>
                      <Text style={styles.scheduleCardTime}>
                        {[date, timeText, durationText, location, capacity].filter(Boolean).join(' | ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* Schedule Cards (fetched) */}
        {loading ? (
          <View style={{ paddingVertical: 24 }}>
            <ActivityIndicator size="large" color="#222" />
          </View>
        ) : (
          filteredSchedules && filteredSchedules.length > 0 ? (
            <>
              {mySchedules && mySchedules.length > 0 ? (
                <Text style={styles.sectionTitle}>
                  {isSameDay(selectedDate, new Date()) 
                    ? 'Today\'s Schedule' 
                    : format(selectedDate, 'MMMM d, yyyy')}
                </Text>
              ) : null}
              {filteredSchedules.map((item, idx) => {
                const title = item.activity_name || item.title || 'Scheduled Activity';
                const startTime = item.start_time || '';
                const endTime = item.end_time || '';
                const timeText = startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || '';
                
                // Calculate duration from start_time and end_time
                let durationText = '';
                if (startTime && endTime) {
                  try {
                    const [startHour, startMin] = startTime.split(':').map(Number);
                    const [endHour, endMin] = endTime.split(':').map(Number);
                    const startMinutes = startHour * 60 + startMin;
                    const endMinutes = endHour * 60 + endMin;
                    const durationMinutes = endMinutes - startMinutes;
                    if (durationMinutes > 0) {
                      durationText = `${durationMinutes} min`;
                    }
                  } catch (e) {
                    console.error('Error calculating duration:', e);
                  }
                }
                
                const location = item.location || '';
                const capacity = item.capacity || '';
                const active = idx === 0; // simple highlight for first item
                
                return (
                  <TouchableOpacity
                    key={`schedule-${item.id || `idx-${idx}`}`}
                    style={[styles.scheduleCardBanner, !active && styles.scheduleCardInactive]}
                    onPress={() => navigation.navigate('ScheduleDetail', { eventId: item.id, event: item })}
                    activeOpacity={0.8}
                  >
                    {item.thumbnail ? (
                      <Image source={{ uri: `${BASE_URL}/${item.thumbnail}` }} style={styles.scheduleCardImage} />
                    ) : (
                      <View style={styles.scheduleCardPlaceholder}>
                        <MaterialCommunityIcons name="calendar-clock" size={64} color="#ccc" />
                      </View>
                    )}
                    <View style={styles.scheduleCardOverlay} />
                    <View style={styles.scheduleTextBox}>
                      <Text style={styles.scheduleCardTitle}>{title}</Text>
                      <Text style={styles.scheduleCardTime}>
                        {[timeText, durationText, location, capacity].filter(Boolean).join(' | ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : null
        )}
        {/* Back Button */}
        
      </ScrollView>
      {/* Calendar Modal */}
      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCalendarVisible(false)}>
          <TouchableWithoutFeedback>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCalendarMonth(addMonths(calendarMonth, -1))} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={22} color="#222" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{format(calendarMonth, 'MMMM yyyy')}</Text>
              <TouchableOpacity onPress={() => setCalendarMonth(addMonths(calendarMonth, 1))} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={22} color="#222" />
              </TouchableOpacity>
            </View>
            <View style={styles.weekHeaderRow}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <Text key={d} style={styles.weekHeaderText}>{d}</Text>
              ))}
            </View>
            <View style={styles.daysGrid}>
              {(() => {
                const monthStart = startOfMonth(calendarMonth);
                const monthEnd = endOfMonth(calendarMonth);
                const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
                const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
                const days = [];
                for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
                  const d = new Date(day);
                  const inMonth = isSameMonth(d, calendarMonth);
                  const active = isSameDay(d, selectedDate);
                  days.push(
                    <TouchableOpacity
                      key={d.toISOString()}
                      style={[styles.dayCell, active && styles.dayCellActive]}
                      onPress={() => { 
                        setSelectedDate(d); 
                        setCalendarVisible(false);
                        // Filter schedules for the selected date
                        if (allSchedules.length > 0) {
                          filterSchedulesByDate(allSchedules, d);
                        }
                      }}
                      disabled={!inMonth}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dayCellText, !inMonth && styles.dayCellFaded, active && styles.dayCellTextActive]}>
                        {format(d, 'd')}
                      </Text>
                    </TouchableOpacity>
                  );
                }
                return days;
              })()}
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCalendarVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

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
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  title: { fontSize: 24, fontWeight: 'bold', marginTop: 10, alignSelf: 'flex-start', marginLeft: '8%' },
  calendarContainer: { backgroundColor: '#fff', borderRadius: 16, marginTop: 1, width: '90%', paddingVertical: 12, paddingHorizontal: 16, elevation: 2 },
  calendarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  calendarLabel: { fontWeight: '600', fontSize: 15, color: '#222' },
  calendarStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  calendarDay: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, minWidth: 38 },
  calendarDayActive: { backgroundColor: '#222' },
  calendarDayLabel: { color: '#888', fontWeight: '600', fontSize: 13 },
  calendarDayLabelActive: { color: '#fff' },
  calendarDayDate: { color: '#888', fontWeight: 'bold', fontSize: 15 },
  noWorkoutsText: { fontWeight: '600', fontSize: 16, alignSelf: 'flex-start', marginLeft: '8%', marginTop: 18, marginBottom: 10, color: '#888' },
  todayLabel: { fontWeight: '600', fontSize: 16, alignSelf: 'flex-start', marginLeft: '8%', marginTop: 24, marginBottom: 10 },
  sectionTitle: { fontWeight: '700', fontSize: 18, alignSelf: 'flex-start', marginLeft: '8%', marginTop: 24, marginBottom: 12, color: '#222' },
  myScheduleCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  myScheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  myScheduleBadge: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#4CAF50',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scheduleCardBanner: {
    position: 'relative',
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',

    marginBottom: 18,
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#fff',
  },
  scheduleCardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  scheduleCardPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scheduleTextBox: { padding: 16, position: 'absolute', left: 0, bottom: 0 },
  scheduleCardTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
  scheduleCardTime: { color: '#fff', fontSize: 14, fontWeight: '500' },
  backButton: { flexDirection: 'row',bottom:'5%', alignItems: 'center', backgroundColor: '#222', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginTop: 10, alignSelf: 'center' },
  backText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
  scheduleCardInactive: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', width: '90%', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontWeight: '700', fontSize: 16, color: '#222' },
  navBtn: { padding: 6, borderRadius: 10, backgroundColor: '#f0f0f0' },
  weekHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 4 },
  weekHeaderText: { width: `${100/7}%`, textAlign: 'center', color: '#888', fontWeight: '600' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  dayCell: { width: `${100/7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  dayCellActive: { backgroundColor: '#222' },
  dayCellText: { color: '#222', fontWeight: '700' },
  dayCellTextActive: { color: '#fff' },
  dayCellFaded: { color: '#bbb' },
  modalCloseBtn: { marginTop: 12, alignSelf: 'center', backgroundColor: '#222', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  modalCloseText: { color: '#fff', fontWeight: '600' },
});

export default ScheduleScreen; 