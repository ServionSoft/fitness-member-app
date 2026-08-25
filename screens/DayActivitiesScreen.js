import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, BASE_URL } from '../utils/apiConfig';
import { useAuth } from '../contexts/AuthContext';
import ModernAlert from '../components/ModernAlert';
import { format } from 'date-fns';

const DayActivitiesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { logout } = useAuth();
  const { activities: initialActivities, dayName, selectedDate } = route.params || {};

  const [dayActivities, setDayActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const [dayActivityPlanId, setDayActivityPlanId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('not_started'); // not_started, in_progress, completed

  const showAlert = (title, message, type = 'info', autoClose = false) => {
    setAlertConfig({
      title,
      message,
      type,
      buttons: [{ text: 'OK', onPress: () => {} }],
    });
    setAlertVisible(true);
    
    // Auto-close success alerts after 2 seconds
    if (autoClose && type === 'success') {
      setTimeout(() => {
        setAlertVisible(false);
      }, 2000);
    }
  };

  const fetchDayActivities = async () => {
    try {
      setLoading(true);
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        console.error('No user token found in fetchDayActivities');
        showAlert('Error', 'Authentication required', 'error');
        setLoading(false);
        return;
      }

      const authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
      
      // Get day name from selected date (if provided) or use dayName from params or today's date
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      let targetDate = selectedDate;
      if (!targetDate && dayName) {
        // If we have dayName but no date, use today (fallback)
        targetDate = new Date();
      } else if (!targetDate) {
        targetDate = new Date();
      }
      // If selectedDate is a string, parse it
      if (typeof targetDate === 'string') {
        targetDate = new Date(targetDate);
      }
      const currentDayName = dayName || days[targetDate.getDay()];

      // Format date as YYYY-MM-DD for query
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      
      // Build query parameters - include both day name and date
      const params = new URLSearchParams();
      params.append('day', currentDayName);
      params.append('date', dateStr);
      
      console.log('Fetching day activities for date:', dateStr, 'Day:', currentDayName);
      console.log('API URL:', `${API_BASE_URL}/mobile/day-activities?${params.toString()}`);

      // Fetch day activities from backend using both day and date
      const response = await fetch(`${API_BASE_URL}/mobile/day-activities?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      console.log('Fetch response status:', response.status);

      const result = await response.json();
      console.log('Fetch response data:', JSON.stringify(result, null, 2));

      if (response.ok) {
        if (result.success && result.data) {
          console.log('Successfully fetched day activities:', result.data);
          setDayActivities(result.data.activities || []);
          setDayActivityPlanId(result.data.id);
          setSessionStatus(result.data.session_status || 'not_started');
        } else {
          console.log('No data in response, using initial activities if available');
          if (initialActivities && initialActivities.length > 0) {
            setDayActivities(initialActivities);
          }
        }
      } else {
        console.error('Fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          data: result,
        });
        // If fetch fails but we have initial activities, use them
        if (initialActivities && initialActivities.length > 0) {
          console.log('Using initial activities as fallback');
          setDayActivities(initialActivities);
        }
      }
    } catch (error) {
      console.error('Exception fetching day activities:', error);
      console.error('Error stack:', error.stack);
      console.error('Error message:', error.message);
      // Fallback to initial activities if available
      if (initialActivities && initialActivities.length > 0) {
        console.log('Using initial activities as fallback after error');
        setDayActivities(initialActivities);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const saveDayActivities = async (activitiesToSaveOverride = null) => {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        console.error('No user token found');
        showAlert('Error', 'Authentication required', 'error');
        return;
      }

      const authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
      
      // Get day name from selected date (if provided) or use dayName from params or today's date
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      let targetDate = selectedDate;
      
      console.log('=== saveDayActivities - Date Handling ===');
      console.log('selectedDate from route params:', selectedDate);
      console.log('dayName from route params:', dayName);
      
      if (!targetDate && dayName) {
        // If we have dayName but no date, use today (fallback)
        console.log('No selectedDate, using today as fallback');
        targetDate = new Date();
      } else if (!targetDate) {
        console.log('No selectedDate or dayName, using today');
        targetDate = new Date();
      }
      // If selectedDate is a string, parse it
      if (typeof targetDate === 'string') {
        console.log('Parsing selectedDate string:', targetDate);
        targetDate = new Date(targetDate);
      }
      const currentDayName = dayName || days[targetDate.getDay()];
      
      console.log('Final targetDate:', targetDate);
      console.log('Final targetDate formatted:', format(targetDate, 'yyyy-MM-dd'));
      console.log('Final currentDayName:', currentDayName);
      console.log('Saving activities for date:', format(targetDate, 'yyyy-MM-dd'), 'Day:', currentDayName);

      // Use current state, not closure - get fresh state, or use override if provided
      const currentActivities = activitiesToSaveOverride || dayActivities;
      console.log('=== saveDayActivities called ===');
      console.log('Current dayActivities state:', currentActivities);
      console.log('dayActivities type:', typeof currentActivities);
      console.log('dayActivities is array:', Array.isArray(currentActivities));
      console.log('Raw dayActivities before mapping:', JSON.stringify(currentActivities, null, 2));
      console.log('dayActivities length:', currentActivities?.length);

      if (!currentActivities || !Array.isArray(currentActivities) || currentActivities.length === 0) {
        console.error('No activities to save! dayActivities is empty or undefined');
        console.error('currentActivities:', currentActivities);
        showAlert('Error', 'No activities to save. Please select activities first.', 'error');
        return;
      }

      const activitiesToSave = currentActivities.map((activity, index) => {
        const exerciseId = activity.id || activity.exercise_id || activity.activity_id;
        const exerciseName = activity.exercise_name || activity.name;
        
        console.log(`Activity ${index}:`, {
          raw: activity,
          exercise_id: exerciseId,
          exercise_name: exerciseName,
          sets: activity.sets || 3,
          reps: activity.reps || 12,
          rest_seconds: activity.rest_seconds || 60,
        });

        if (!exerciseId) {
          console.error(`Activity ${index} missing exercise_id:`, activity);
        }
        if (!exerciseName) {
          console.error(`Activity ${index} missing exercise_name:`, activity);
        }

        return {
          exercise_id: exerciseId,
          exercise_name: exerciseName,
          sets: activity.sets || 3,
          reps: activity.reps || 12,
          rest_seconds: activity.rest_seconds || 60,
        };
      }).filter(activity => {
        // Filter out activities without required fields
        const isValid = activity.exercise_id && activity.exercise_name;
        if (!isValid) {
          console.warn('Filtered out invalid activity:', activity);
        }
        return isValid;
      });

      console.log('Mapped activitiesToSave:', JSON.stringify(activitiesToSave, null, 2));
      console.log('Saving day activities:', {
        day: currentDayName,
        activitiesCount: activitiesToSave.length,
        activities: activitiesToSave,
      });

      if (activitiesToSave.length === 0) {
        console.error('No valid activities after mapping!');
        showAlert('Error', 'No valid activities to save. Please check activity data.', 'error');
        return;
      }

      // Format date as YYYY-MM-DD
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      
      const requestBody = {
        day: currentDayName,
        date: dateStr, // Add date to request body
        activities: activitiesToSave,
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      console.log('Saving activities for date:', dateStr, 'Day:', currentDayName);

      const response = await fetch(`${API_BASE_URL}/mobile/day-activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      const responseData = await response.json();
      console.log('Response data:', JSON.stringify(responseData, null, 2));

      if (response.ok) {
        if (responseData.success) {
          setDayActivityPlanId(responseData.data.id);
          console.log('Activities saved successfully, plan ID:', responseData.data.id);
          showAlert('Success', 'Activities saved successfully!', 'success', true); // Auto-close after 2 seconds
          
          // Refresh activities list after successful save
          setTimeout(() => {
            fetchDayActivities();
          }, 500); // Wait a bit for backend to process
        } else {
          console.error('Save failed - success is false:', responseData);
          showAlert('Error', responseData.message || 'Failed to save activities', 'error');
        }
      } else {
        console.error('HTTP Error Response:', {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
        });
        
        // Log validation errors if present
        if (responseData.errors) {
          console.error('Validation Errors:', JSON.stringify(responseData.errors, null, 2));
        }
        
        const errorMessage = responseData.message || 
                           (responseData.errors ? 'Validation failed. Check console for details.' : 'Failed to save activities') ||
                           `Server error: ${response.status} ${response.statusText}`;
        showAlert('Error', errorMessage, 'error');
      }
    } catch (error) {
      console.error('Exception saving day activities:', error);
      console.error('Error stack:', error.stack);
      console.error('Error message:', error.message);
      showAlert('Error', `Failed to save activities: ${error.message}`, 'error');
    }
  };

  useEffect(() => {
    console.log('DayActivitiesScreen mounted with initialActivities:', {
      hasInitialActivities: !!initialActivities,
      initialActivitiesLength: initialActivities?.length || 0,
      initialActivities: initialActivities,
      dayName: dayName,
    });

    if (initialActivities && initialActivities.length > 0) {
      console.log('Setting dayActivities from initialActivities');
      setDayActivities(initialActivities);
      setLoading(false);
    } else {
      console.log('No initial activities, fetching from backend');
      fetchDayActivities();
    }
  }, []);

  // Separate effect to save activities when dayActivities state is set from initialActivities
  const hasSavedRef = useRef(false);
  useEffect(() => {
    // Only save if we have initialActivities (coming from navigation) and dayActivities is now set
    // and we haven't saved yet
    if (initialActivities && initialActivities.length > 0 && dayActivities.length > 0 && !hasSavedRef.current) {
      console.log('dayActivities state updated, calling saveDayActivities');
      console.log('Current dayActivities state:', dayActivities);
      hasSavedRef.current = true;
      // Use a ref or check to prevent multiple saves
      saveDayActivities();
    }
  }, [dayActivities.length]); // Only trigger when activities count changes

  // Handle navigation params updates (for when coming back from SelectActivities with new activities)
  useFocusEffect(
    useCallback(() => {
      // Check for new activities from SelectActivities
      const route = navigation.getState()?.routes?.find(r => r.name === 'DayActivities');
      const params = route?.params;
      const newActivities = params?.newActivities;
      const isAddingActivities = params?.isAddingActivities;
      
      if (isAddingActivities && newActivities && Array.isArray(newActivities) && newActivities.length > 0) {
        console.log('Received new activities to add:', newActivities.length);
        // Replace all activities with the merged list (existing + new)
        setDayActivities(newActivities);
        console.log('Updated dayActivities count:', newActivities.length);
        
        // Save to backend
        setTimeout(() => {
          saveDayActivities(newActivities);
        }, 100);
        
        // Clear the navigation params to prevent re-triggering
        navigation.setParams({ newActivities: undefined, isAddingActivities: false });
      } else {
        // Always refresh when screen comes into focus to show latest activities
        // This ensures activities created for a date show up when viewing that date
        // Only refresh if we don't have initial activities (to avoid double loading)
        if (!initialActivities || initialActivities.length === 0) {
          fetchDayActivities();
        } else {
          // If we have initial activities, still refresh to get latest from backend
          // This ensures we see newly added activities
          fetchDayActivities();
        }
      }
    }, [navigation, selectedDate])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDayActivities();
  }, []);

  const handleStartSession = async () => {
    if (dayActivities.length === 0) {
      showAlert('Error', 'No activities available', 'error');
      return;
    }

    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        showAlert('Error', 'Authentication required', 'error');
        return;
      }

      const authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;

      // Start session on backend
      if (dayActivityPlanId) {
        const response = await fetch(`${API_BASE_URL}/mobile/day-activities/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            day_activity_plan_id: dayActivityPlanId,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setSessionStatus('in_progress');
          }
        }
      }

      // Navigate to WorkoutSessionScreen (reuse existing session screen)
      navigation.navigate('WorkoutSession', {
        activities: dayActivities,
        selectedDay: dayName || format(new Date(), 'EEEE'),
        dayActivityPlanId,
        isDayActivity: true,
      });
    } catch (error) {
      console.error('Error starting session:', error);
      // Still navigate even if backend call fails
      navigation.navigate('WorkoutSession', {
        activities: dayActivities,
        selectedDay: dayName || format(new Date(), 'EEEE'),
        dayActivityPlanId,
        isDayActivity: true,
      });
    }
  };

  const getThumbnailUrl = (activity) => {
    if (activity.thumbnail_url) {
      const match = activity.thumbnail_url.match(/thumbnails\/(.+)$/);
      if (match) {
        const filename = encodeURIComponent(match[1]);
        return `${BASE_URL}/thumbnails/${filename}`;
      } else if (activity.thumbnail_url.startsWith('http') && !activity.thumbnail_url.includes('localhost/APP_URL')) {
        return activity.thumbnail_url;
      }
    } else if (activity.thumbnail) {
      const match = activity.thumbnail.match(/thumbnails\/(.+)$/);
      if (match) {
        const filename = encodeURIComponent(match[1]);
        return `${BASE_URL}/thumbnails/${filename}`;
      } else if (activity.thumbnail.startsWith('http') && !activity.thumbnail.includes('localhost/APP_URL')) {
        return activity.thumbnail;
      }
    }
    return null;
  };

  // Get day name from selected date (if provided) or use dayName from params or today's date
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let targetDate = selectedDate;
  if (!targetDate && dayName) {
    // If we have dayName but no date, use today (fallback)
    targetDate = new Date();
  } else if (!targetDate) {
    targetDate = new Date();
  }
  // If selectedDate is a string, parse it
  if (typeof targetDate === 'string') {
    targetDate = new Date(targetDate);
  }
  const currentDayName = dayName || days[targetDate.getDay()];
  const isCompleted = sessionStatus === 'completed';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
    
        {/* Header Image */}
        <View style={styles.imageContainer}>
          {dayActivities.length > 0 && getThumbnailUrl(dayActivities[0]) ? (
            <Image
              source={{ uri: getThumbnailUrl(dayActivities[0]) }}
              style={styles.headerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.headerImagePlaceholder}>
              <MaterialCommunityIcons name="calendar-check" size={64} color="#ccc" />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.gradientOverlay}
          />
          <View style={styles.imageOverlay}>
            <Text style={styles.headerTitle}>{currentDayName} Activities</Text>
            <View style={styles.headerStatsRow}>
              <View style={styles.headerStatItem}>
                <MaterialCommunityIcons name="dumbbell" size={16} color="#fff" />
                <Text style={styles.headerStatText}>{dayActivities.length} Activities</Text>
              </View>
            </View>
            {!isCompleted && (
              <TouchableOpacity
                style={styles.floatingPlay}
                activeOpacity={0.8}
                onPress={handleStartSession}
              >
                <MaterialCommunityIcons name="play" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Add More Activities Button */}
        {!isCompleted && (
          <TouchableOpacity
            style={styles.addMoreButton}
            onPress={() => {
              navigation.navigate('SelectActivities', {
                source: 'addToDayActivity',
                existingActivities: dayActivities,
                dayName: currentDayName,
                selectedDate: selectedDate, // Pass the selected date
              });
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus-circle" size={20} color="#222" />
            <Text style={styles.addMoreButtonText}>Add More Activities</Text>
          </TouchableOpacity>
        )}

        {/* Activities List */}
        <View style={styles.activitiesContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#222" />
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : dayActivities.length > 0 ? (
            <>
              {isCompleted && (
                <View style={styles.completedBadge}>
                  <MaterialCommunityIcons name="check-decagram" size={20} color="#fff" />
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
              {dayActivities.map((activity, index) => (
                <View key={index} style={styles.activityCard}>
                  {getThumbnailUrl(activity) ? (
                    <Image
                      source={{ uri: getThumbnailUrl(activity) }}
                      style={styles.activityImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.activityImagePlaceholder}>
                      <MaterialCommunityIcons name="dumbbell" size={32} color="#ccc" />
                    </View>
                  )}
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>
                      {activity.exercise_name || activity.name}
                    </Text>
                    <View style={styles.activityDetails}>
                      <Text style={styles.activityDetailText}>
                        {activity.sets || 3} sets × {activity.reps || 12} reps
                      </Text>
                      {activity.rest_seconds && (
                        <Text style={styles.activityDetailText}>
                          Rest: {activity.rest_seconds}s
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="dumbbell-off" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No activities for today</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Start Session Button */}
      {!isCompleted && dayActivities.length > 0 && (
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartSession}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="play-circle" size={20} color="#fff" />
          <Text style={styles.startButtonText}>Start Activity Session</Text>
        </TouchableOpacity>
      )}

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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 220,
  },
  headerImage: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
  },
  headerImagePlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 20,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  headerStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerStatText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  floatingPlay: {
    position: 'absolute',
    right: 20,
    bottom: -24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  activitiesContainer: {
    padding: 20,
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
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  completedText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  activityImage: {
    width: 100,
    height: 100,
    resizeMode: 'cover',
  },
  activityImagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  activityName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 6,
  },
  activityDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityDetailText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  startButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#222',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 8,
  },
});

export default DayActivitiesScreen;

