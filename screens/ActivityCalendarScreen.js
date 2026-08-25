import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Dimensions, ActivityIndicator, Modal, TouchableWithoutFeedback, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import BottomNavBar from '../components/BottomNavBar';
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
import { fetchAssignedWorkoutDetails } from '../api/workouts';

const { width: screenWidth } = Dimensions.get('window');

const getWeekDates = (date = new Date()) => {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 }); // Sunday
  const dates = [];
  
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    dates.push({
      label: format(day, 'EE').slice(0, 2),
      dateNum: format(day, 'd'),
      dateObj: day,
    });
  }
  
  return dates;
};

const ActivityCalendarScreen = () => {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [assignedWorkouts, setAssignedWorkouts] = useState([]); // Assigned workouts
  const [filteredWorkouts, setFilteredWorkouts] = useState([]); // Workouts filtered by selected date
  const [dayActivityPlan, setDayActivityPlan] = useState(null); // Day activity plan for selected day
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const [loadingDayActivities, setLoadingDayActivities] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const [fabModalVisible, setFabModalVisible] = useState(false);
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

  const [weekDates, setWeekDates] = useState(() => getWeekDates());

  // Filter workouts by selected date (based on start_date from assignment)
  const filterWorkoutsByDate = useCallback((workouts, date) => {
    if (!workouts || workouts.length === 0) {
      setFilteredWorkouts([]);
      return;
    }

    const selectedDateStr = format(date, 'yyyy-MM-dd');
    
    const filtered = workouts.filter(workout => {
      // Check if workout has assignment data with start_date
      const startDate = workout.start_date || workout.assignment?.start_date;
      
      if (!startDate) {
        return false;
      }
      
      // Handle both date formats: "2025-12-09" or Date objects
      const workoutDateStr = typeof startDate === 'string' 
        ? startDate.split('T')[0] // Remove time if present
        : format(new Date(startDate), 'yyyy-MM-dd');
      
      // Check if selected date is within the assignment date range
      const endDate = workout.end_date || workout.assignment?.end_date;
      if (endDate) {
        const endDateStr = typeof endDate === 'string' 
          ? endDate.split('T')[0]
          : format(new Date(endDate), 'yyyy-MM-dd');
        const isInRange = selectedDateStr >= workoutDateStr && selectedDateStr <= endDateStr;
        return isInRange;
      }
      
      const isMatch = workoutDateStr === selectedDateStr;
      return isMatch;
    });
    
    setFilteredWorkouts(filtered);
  }, []);

  // Update filtered workouts when selectedDate or assignedWorkouts changes
  useEffect(() => {
    if (assignedWorkouts.length > 0) {
      filterWorkoutsByDate(assignedWorkouts, selectedDate);
    } else {
      setFilteredWorkouts([]);
    }
  }, [selectedDate, assignedWorkouts, filterWorkoutsByDate]);

  // Update week dates when selected date changes (to show the week containing selected date)
  useEffect(() => {
    setWeekDates(getWeekDates(selectedDate));
  }, [selectedDate]);

  // Fetch assigned workouts
  const fetchAssignedWorkouts = async () => {
    try {
      setLoadingWorkouts(true);

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setLoadingWorkouts(false);
        return null;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/member-workouts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const workoutsArray = result.workouts || result.data || [];
        setAssignedWorkouts(workoutsArray);
        return result;
      } else {
        setAssignedWorkouts([]);
        return null;
      }
    } catch (err) {
      setAssignedWorkouts([]);
      return null;
    } finally {
      setLoadingWorkouts(false);
    }
  };

  // Fetch day activities for a specific date
  const fetchDayActivities = async (date) => {
    try {
      setLoadingDayActivities(true);
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setLoadingDayActivities(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Format date as YYYY-MM-DD and get day name
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayName = getDayNameFromDate(date);

      // Build query parameters - include both day name and date
      const params = new URLSearchParams();
      params.append('day', dayName);
      params.append('date', dateStr);

      const response = await fetch(`${API_BASE_URL}/mobile/day-activities?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Store the full day activity plan data
          setDayActivityPlan(result.data);
        } else {
          setDayActivityPlan(null);
        }
      } else {
        setDayActivityPlan(null);
      }
    } catch (err) {
      setDayActivityPlan(null);
    } finally {
      setLoadingDayActivities(false);
    }
  };

  // Get day name from date
  const getDayNameFromDate = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  // Fetch day activities when selected date changes
  useEffect(() => {
    fetchDayActivities(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    fetchAssignedWorkouts();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchAssignedWorkouts();
      fetchDayActivities(selectedDate);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAssignedWorkouts();
    await fetchDayActivities(selectedDate);
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
            {weekDates && weekDates.length > 0 ? weekDates.map((d, idx) => {
              const isActive = isSameDay(d.dateObj, selectedDate);
              return (
                <TouchableOpacity
                  key={d.label + d.dateNum + idx}
                  style={[styles.calendarDay, isActive && styles.calendarDayActive]}
                  onPress={() => {
                    setSelectedDate(d.dateObj);
                    // Filter workouts for the selected date
                    if (assignedWorkouts.length > 0) {
                      filterWorkoutsByDate(assignedWorkouts, d.dateObj);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.calendarDayLabel, isActive && styles.calendarDayLabelActive]}>{d.label}</Text>
                  <Text style={[styles.calendarDayDate, isActive && styles.calendarDayLabelActive]}>{d.dateNum}</Text>
                </TouchableOpacity>
              );
            }) : null}
          </View>
        </View>
        {/* No Workouts or Activities Message */}
        {!loadingWorkouts && !loadingDayActivities && (!filteredWorkouts || filteredWorkouts.length === 0) && !dayActivityPlan && (
          <Text style={styles.noWorkoutsText}>
            {isSameDay(selectedDate, new Date()) 
              ? 'No workouts or activities scheduled for today' 
              : `No workouts or activities scheduled for ${format(selectedDate, 'MMMM d, yyyy')}`}
          </Text>
        )}
        {/* Date Label */}
        {(filteredWorkouts && filteredWorkouts.length > 0) || dayActivityPlan ? (
          <Text style={styles.todayLabel}>
            {isSameDay(selectedDate, new Date()) 
              ? 'Today' 
              : format(selectedDate, 'MMMM d, yyyy')}
          </Text>
        ) : null}

        {/* Assigned Workouts Section */}
        {filteredWorkouts && filteredWorkouts.length > 0 && (
          <>
           
            {loadingWorkouts ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color="#222" />
              </View>
            ) : (
              filteredWorkouts.map((workout, idx) => {
                const title = workout.exercise_name || workout.name || workout.workout_name || 'Workout';
                const level = workout.level || 'Intermediate';
                const duration = workout.duration || '30 min';
                const startDate = workout.start_date || workout.assignment?.start_date;
                const endDate = workout.end_date || workout.assignment?.end_date;
                
                let dateRange = '';
                if (startDate) {
                  try {
                    const startDateObj = typeof startDate === 'string' ? parseISO(startDate) : new Date(startDate);
                    const endDateObj = endDate ? (typeof endDate === 'string' ? parseISO(endDate) : new Date(endDate)) : null;
                    if (endDateObj && !isSameDay(startDateObj, endDateObj)) {
                      dateRange = `${format(startDateObj, 'MMM d')} - ${format(endDateObj, 'MMM d')}`;
                    } else {
                      dateRange = format(startDateObj, 'MMM d, yyyy');
                    }
                  } catch (e) {
                    dateRange = startDate;
                  }
                }
                
                return (
                  <TouchableOpacity
                    key={`workout-${workout.id || workout.workout_id || `idx-${idx}`}`}
                    style={styles.workoutCard}
                    onPress={async () => {
                      const workoutId = workout.id || workout.workout_id;
                      if (!workoutId) {
                        return;
                      }

                      const workoutTitle = workout.exercise_name || workout.name || workout.workout_name || 'Workout';
                      
                      // Fetch detailed workout data before navigating (same as WorkoutScreen)
                      try {
                        const workoutDetails = await fetchAssignedWorkoutDetails(workoutId);
                        if (workoutDetails) {
                          // Extract the workout data from the API response
                          const detailedWorkout = workoutDetails.workout || workoutDetails.data || workoutDetails;
                          
                          // Merge original workout data with detailed workout to preserve title from card
                          const mergedWorkout = {
                            ...detailedWorkout,
                            // Preserve title properties from original workout card
                            exercise_name: workout.exercise_name || detailedWorkout.exercise_name || workoutTitle,
                            name: workout.name || detailedWorkout.name || workoutTitle,
                            workout_name: workout.workout_name || detailedWorkout.workout_name || workoutTitle,
                            // Preserve assignment dates
                            start_date: workout.start_date || detailedWorkout.start_date,
                            end_date: workout.end_date || detailedWorkout.end_date,
                            assignment: workout.assignment || detailedWorkout.assignment,
                            // Preserve thumbnail from original workout card (it's working on ActivityCalendarScreen)
                            thumbnail: workout.thumbnail || detailedWorkout.thumbnail,
                          };
                          
                          navigation.navigate('WorkoutDetails', { 
                            workout: mergedWorkout,
                            isAssignedWorkout: true,
                            canStartWorkout: true, // Assigned workouts can start workout session
                          });
                        } else {
                          // Fallback to basic workout data if details fetch fails
                          navigation.navigate('WorkoutDetails', { 
                            workout: workout,
                            canStartWorkout: true,
                          });
                        }
                      } catch (error) {
                        // Fallback to basic workout data if fetch fails
                        navigation.navigate('WorkoutDetails', { 
                          workout: workout,
                          canStartWorkout: true,
                        });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    {workout.thumbnail ? (
                      <Image 
                        source={{ 
                          uri: workout.thumbnail.startsWith('http') 
                            ? workout.thumbnail 
                            : `${BASE_URL}/${workout.thumbnail}` 
                        }} 
                        style={styles.workoutCardImage} 
                      />
                    ) : (
                      <View style={styles.workoutCardPlaceholder}>
                        <MaterialCommunityIcons name="dumbbell" size={64} color="#ccc" />
                      </View>
                    )}
                    <View style={styles.workoutCardOverlay} />
                    <View style={styles.workoutCardContent}>
                      <View style={styles.workoutCardHeader}>
                        <MaterialCommunityIcons name="calendar-check" size={18} color="#4CAF50" />
                        <Text style={styles.workoutBadge}>Assigned</Text>
                      </View>
                      <Text style={styles.workoutCardTitle}>{title}</Text>
                      <Text style={styles.workoutCardInfo}>
                        {[level, duration, dateRange].filter(Boolean).join(' | ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* Day Activities Section - Show as single card like workouts */}
        {dayActivityPlan && dayActivityPlan.activities && dayActivityPlan.activities.length > 0 && (
          <>
            {loadingDayActivities ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color="#222" />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.workoutCard}
                onPress={() => {
                  // Navigate to DayActivitiesScreen to view/edit activities for this day
                  const dayName = getDayNameFromDate(selectedDate);
                  navigation.navigate('DayActivitiesScreen', {
                    dayName: dayName,
                    selectedDate: selectedDate, // Pass the selected date
                  });
                }}
                activeOpacity={0.8}
              >
                {/* Use first activity's thumbnail if available */}
                {(() => {
                  const firstActivity = dayActivityPlan.activities && dayActivityPlan.activities.length > 0 
                    ? dayActivityPlan.activities[0] 
                    : null;
                  
                  const getThumbnailUrl = (activity) => {
                    if (!activity) return null;
                    
                    const thumbnailField = activity.thumbnail_url || activity.thumbnail;
                    if (!thumbnailField) return null;
                    
                    // Extract filename from thumbnail URL
                    const match = thumbnailField.match(/thumbnails\/(.+)$/);
                    if (match) {
                      const filename = encodeURIComponent(match[1].split('?')[0].split('#')[0].trim());
                      return `${BASE_URL}/thumbnails/${filename}`;
                    } else if (thumbnailField.startsWith('http') && !thumbnailField.includes('localhost/APP_URL')) {
                      return thumbnailField;
                    }
                    return null;
                  };
                  
                  const thumbnailUrl = getThumbnailUrl(firstActivity);
                  
                  return thumbnailUrl ? (
                    <Image 
                      source={{ uri: thumbnailUrl }} 
                      style={styles.workoutCardImage} 
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.workoutCardPlaceholder}>
                      <MaterialCommunityIcons name="run" size={64} color="#FF6B6B" />
                    </View>
                  );
                })()}
                <View style={styles.workoutCardOverlay} />
                <View style={styles.workoutCardContent}>
                  <Text style={styles.workoutCardTitle}>
                    {getDayNameFromDate(selectedDate)} Activities
                  </Text>
                  <Text style={styles.workoutCardInfo}>
                    {dayActivityPlan.activities.length} {dayActivityPlan.activities.length === 1 ? 'activity' : 'activities'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
      {/* Calendar Modal */}
      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCalendarVisible(false)}>
          <TouchableWithoutFeedback>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => {
                  const newMonth = addMonths(calendarMonth, -1);
                  setCalendarMonth(newMonth);
                  setWeekDates(getWeekDates(newMonth));
                }} 
                style={styles.navBtn}
              >
                <Ionicons name="chevron-back" size={22} color="#222" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{format(calendarMonth, 'MMMM yyyy')}</Text>
              <TouchableOpacity 
                onPress={() => {
                  const newMonth = addMonths(calendarMonth, 1);
                  setCalendarMonth(newMonth);
                  setWeekDates(getWeekDates(newMonth));
                }} 
                style={styles.navBtn}
              >
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
                        // Update week dates to show the week containing the selected date
                        setWeekDates(getWeekDates(d));
                        // Filter workouts for the selected date
                        if (assignedWorkouts.length > 0) {
                          filterWorkoutsByDate(assignedWorkouts, d);
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

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setFabModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* FAB Modal */}
      <Modal 
        visible={fabModalVisible} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setFabModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.fabModalOverlay} 
          activeOpacity={1} 
          onPress={() => setFabModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.fabModalCard}>
              <TouchableOpacity
                style={styles.fabModalOption}
                onPress={() => {
                  setFabModalVisible(false);
                  navigation.navigate('ScheduleScreen');
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="calendar-check" size={24} color="#222" />
                <Text style={styles.fabModalOptionText}>Join Class</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.fabModalOption}
                onPress={() => {
                  setFabModalVisible(false);
                  navigation.navigate('WorkoutScreen');
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="dumbbell" size={24} color="#222" />
                <Text style={styles.fabModalOptionText}>Workout</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.fabModalOption}
                onPress={() => {
                  setFabModalVisible(false);
                  navigation.navigate('SelectActivities', {
                    source: 'activityCalendar', // Indicate this is from activity calendar
                    selectedDate: selectedDate, // Pass the selected date from calendar
                  });
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="run" size={24} color="#222" />
                <Text style={styles.fabModalOptionText}>Activity</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
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
        
        {/* Bottom Navigation Bar */}
        <BottomNavBar
          selectedTab="Calendar"
          navigation={navigation}
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
  calendarStrip: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  calendarDay: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 10, flex: 1, minWidth: 0 },
  calendarDayActive: { backgroundColor: '#222' },
  calendarDayLabel: { color: '#888', fontWeight: '600', fontSize: 13 },
  calendarDayLabelActive: { color: '#fff' },
  calendarDayDate: { color: '#888', fontWeight: 'bold', fontSize: 15 },
  noWorkoutsText: { fontWeight: '600', fontSize: 16, alignSelf: 'flex-start', marginLeft: '8%', marginTop: 18, marginBottom: 10, color: '#888' },
  todayLabel: { fontWeight: '600', fontSize: 16, alignSelf: 'flex-start', marginLeft: '8%', marginTop: 24, marginBottom: 10 },
  sectionTitle: { fontWeight: '700', fontSize: 18, alignSelf: 'flex-start', marginLeft: '8%', marginTop: 24, marginBottom: 12, color: '#222' },
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
  workoutCard: {
    position: 'relative',
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 18,
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderLeftWidth: 2,
    borderLeftColor: '#000',
  },
  workoutCardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  workoutCardPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  workoutCardContent: {
    padding: 16,
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  workoutBadge: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  workoutCardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  workoutCardInfo: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  fabModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  fabModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  fabModalOptionText: {
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
});

export default ActivityCalendarScreen;

