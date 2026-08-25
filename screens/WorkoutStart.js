import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, RefreshControl, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { useAuth } from '../contexts/AuthContext';
import ModernAlert from '../components/ModernAlert';

const WorkoutStart = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { workout, workoutId: routeWorkoutId, selectedDay: routeSelectedDay, activities: routeActivities } = route.params || {};
  const { logout } = useAuth();
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [workoutActivities, setWorkoutActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(routeSelectedDay || 'Monday');
  const [availableDays, setAvailableDays] = useState([]);
  const [dayStatusMap, setDayStatusMap] = useState({}); // Track completion status per day
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  
  // Micro-interaction: Scale animation for finish button
  const finishButtonScale = useRef(new Animated.Value(1)).current;

  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = API_BASE_URL.replace('/api', '');
  
  // Brand color - use consistently throughout
  const BRAND_COLOR = '#007AFF'; // iOS blue - professional and vibrant

  // Helper function to get thumbnail URL for activities
  const getThumbnailUrl = (activity) => {
    if (!activity) return null;
    
    // Check multiple possible thumbnail fields
    const thumbnailField = activity.thumbnail_url || 
                          activity.thumbnail || 
                          activity.exercise?.thumbnail_url || 
                          activity.exercise?.thumbnail ||
                          activity.exercise_details?.thumbnail_url ||
                          activity.exercise_details?.thumbnail;
    
    if (!thumbnailField) {
      return null;
    }
    
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

  // Fetch full activity details including thumbnails
  const fetchActivityDetails = async (exerciseId) => {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        return null;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/workout-activities?exercise_id=${exerciseId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        
        // Handle different response structures
        let activityData = null;
        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          activityData = result.data[0];
        } else if (result.data && !Array.isArray(result.data)) {
          activityData = result.data;
        } else if (result.activity) {
          activityData = result.activity;
        } else if (result.exercise) {
          activityData = result;
        } else if (Array.isArray(result) && result.length > 0) {
          activityData = result[0];
        }
        
        return activityData;
      }
      return null;
    } catch (error) {
      return null;
    }
  };
  
  // Helper function to convert text to Title Case
  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper function to get workout ID (handles both 'id' and 'workout_id', and route params)
  const getWorkoutId = (workoutData) => {
    // First check route params
    if (routeWorkoutId) return routeWorkoutId;
    // Then check workout object
    if (workoutData) {
      return workoutData.id || workoutData.workout_id || null;
    }
    return null;
  };

  // Helper Functions
  const getDayNumber = (dayName) => {
    const dayMap = {
      'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
      'Friday': 5, 'Saturday': 6, 'Sunday': 7
    };
    return dayMap[dayName] || 1;
  };

  const getAuthHeader = async () => {
    const userToken = await AsyncStorage.getItem('userToken');
    if (!userToken) return null;
    return userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
  };

  const parseActivitiesFromResponse = (data) => {
    if (data.data?.days && Array.isArray(data.data.days) && data.data.days.length > 0) {
      return { days: data.data.days.map(day => day.day), daysData: data.data.days };
    }
    if (data.data && Array.isArray(data.data)) return { days: [], activities: data.data };
    if (data.data?.workout_activities) return { days: [], activities: data.data.workout_activities };
    if (data.data?.activities) return { days: [], activities: data.data.activities };
    if (data.workout_activities) return { days: [], activities: data.workout_activities };
    if (data.activities) return { days: [], activities: data.activities };
    return { days: [], activities: [] };
  };

  // Fetch workout activities for the selected day
  const fetchWorkoutActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const workoutId = getWorkoutId(workout);
      if (!workoutId) {
        setError('Workout ID is required');
        setLoading(false);
        return;
      }

      // Check if workout object already contains activities data
      const workoutDays = workout.days || workout.workout_days;
      if (workoutDays && Array.isArray(workoutDays) && workoutDays.length > 0) {
        const days = workoutDays.map(day => day.day);
        const dayData = workoutDays.find(day => day.day === selectedDay) || workoutDays[0];
        const activities = dayData?.activities || dayData?.workout_activity_plans || [];
        
        if (activities.length > 0) {
          const finalDays = days.length > 0 ? days : ['Monday'];
          if (!days.includes(selectedDay)) setSelectedDay(finalDays[0]);
          
          // Enrich activities with full details (including thumbnails)
          const enrichedActivities = await Promise.all(
            activities.map(async (activity) => {
              // If activity already has thumbnail, use it
              if (activity.thumbnail_url || activity.thumbnail || 
                  activity.exercise?.thumbnail_url || activity.exercise?.thumbnail ||
                  activity.exercise_details?.thumbnail_url || activity.exercise_details?.thumbnail) {
                return activity;
              }

              // Otherwise, fetch full details using exercise_id
              const exerciseId = activity.exercise_id || activity.id;
              if (exerciseId) {
                const fullDetails = await fetchActivityDetails(exerciseId);
                if (fullDetails) {
                  // Merge full details with existing activity data
                  return {
                    ...activity,
                    ...fullDetails,
                    // Preserve original fields
                    exercise_id: activity.exercise_id || fullDetails.exercise_id || fullDetails.id,
                    exercise_name: activity.exercise_name || fullDetails.exercise_name || fullDetails.name,
                    sets: activity.sets || fullDetails.sets,
                    reps: activity.reps || fullDetails.reps,
                    rest_seconds: activity.rest_seconds || fullDetails.rest_seconds,
                    // Include thumbnail from full details
                    thumbnail_url: fullDetails.thumbnail_url || fullDetails.thumbnail || activity.thumbnail_url || activity.thumbnail,
                    thumbnail: fullDetails.thumbnail || fullDetails.thumbnail_url || activity.thumbnail || activity.thumbnail_url,
                    exercise: fullDetails.exercise || activity.exercise,
                    exercise_details: fullDetails.exercise_details || activity.exercise_details,
                  };
                }
              }
              return activity;
            })
          );
          
          setWorkoutActivities(enrichedActivities);
          setAvailableDays(finalDays);
          fetchDayStatus(finalDays);
          setLoading(false);
          return;
        }
      }
      
      // Fetch from API
      const authHeader = await getAuthHeader();
      if (!authHeader) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const endpoint = `${API_BASE_URL}/mobile/workout-activities/workout/${workoutId}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        cache: 'no-store',
      });
  
      if (response.ok) {
        const data = await response.json();
        const { days, daysData, activities } = parseActivitiesFromResponse(data);
        
        if (daysData && daysData.length > 0) {
          const finalDays = days.length > 0 ? days : ['Monday'];
          if (!days.includes(selectedDay)) setSelectedDay(finalDays[0]);
          
          const dayData = daysData.find(day => day.day === selectedDay) || daysData[0];
          const dayActivities = dayData?.activities || [];
          
          // Enrich activities with full details (including thumbnails)
          const enrichedActivities = await Promise.all(
            dayActivities.map(async (activity) => {
              // If activity already has thumbnail, use it
              if (activity.thumbnail_url || activity.thumbnail || 
                  activity.exercise?.thumbnail_url || activity.exercise?.thumbnail ||
                  activity.exercise_details?.thumbnail_url || activity.exercise_details?.thumbnail) {
                return activity;
              }

              // Otherwise, fetch full details using exercise_id
              const exerciseId = activity.exercise_id || activity.id;
              if (exerciseId) {
                const fullDetails = await fetchActivityDetails(exerciseId);
                if (fullDetails) {
                  // Merge full details with existing activity data
                  return {
                    ...activity,
                    ...fullDetails,
                    // Preserve original fields
                    exercise_id: activity.exercise_id || fullDetails.exercise_id || fullDetails.id,
                    exercise_name: activity.exercise_name || fullDetails.exercise_name || fullDetails.name,
                    sets: activity.sets || fullDetails.sets,
                    reps: activity.reps || fullDetails.reps,
                    rest_seconds: activity.rest_seconds || fullDetails.rest_seconds,
                    // Include thumbnail from full details
                    thumbnail_url: fullDetails.thumbnail_url || fullDetails.thumbnail || activity.thumbnail_url || activity.thumbnail,
                    thumbnail: fullDetails.thumbnail || fullDetails.thumbnail_url || activity.thumbnail || activity.thumbnail_url,
                    exercise: fullDetails.exercise || activity.exercise,
                    exercise_details: fullDetails.exercise_details || activity.exercise_details,
                  };
                }
              }
              return activity;
            })
          );
          
          setWorkoutActivities(enrichedActivities);
          setAvailableDays(finalDays);
          fetchDayStatus(finalDays);
        } else {
          const finalDays = days.length > 0 ? days : ['Monday'];
          
          // Enrich activities with full details (including thumbnails)
          const enrichedActivities = await Promise.all(
            (activities || []).map(async (activity) => {
              // If activity already has thumbnail, use it
              if (activity.thumbnail_url || activity.thumbnail || 
                  activity.exercise?.thumbnail_url || activity.exercise?.thumbnail ||
                  activity.exercise_details?.thumbnail_url || activity.exercise_details?.thumbnail) {
                return activity;
              }

              // Otherwise, fetch full details using exercise_id
              const exerciseId = activity.exercise_id || activity.id;
              if (exerciseId) {
                const fullDetails = await fetchActivityDetails(exerciseId);
                if (fullDetails) {
                  // Merge full details with existing activity data
                  return {
                    ...activity,
                    ...fullDetails,
                    // Preserve original fields
                    exercise_id: activity.exercise_id || fullDetails.exercise_id || fullDetails.id,
                    exercise_name: activity.exercise_name || fullDetails.exercise_name || fullDetails.name,
                    sets: activity.sets || fullDetails.sets,
                    reps: activity.reps || fullDetails.reps,
                    rest_seconds: activity.rest_seconds || fullDetails.rest_seconds,
                    // Include thumbnail from full details
                    thumbnail_url: fullDetails.thumbnail_url || fullDetails.thumbnail || activity.thumbnail_url || activity.thumbnail,
                    thumbnail: fullDetails.thumbnail || fullDetails.thumbnail_url || activity.thumbnail || activity.thumbnail_url,
                    exercise: fullDetails.exercise || activity.exercise,
                    exercise_details: fullDetails.exercise_details || activity.exercise_details,
                  };
                }
              }
              return activity;
            })
          );
          
          setWorkoutActivities(enrichedActivities);
          setAvailableDays(finalDays);
          fetchDayStatus(finalDays);
        }
      } else {
        if (response.status === 404) {
          setWorkoutActivities([]);
          setError(null);
        } else {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData?.message || 'Failed to fetch workout activities');
        }
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch completion status for a day
  const fetchDayStatus = async (days) => {
    const workoutId = getWorkoutId(workout);
    if (!workoutId || !days || days.length === 0) return;

    const authHeader = await getAuthHeader();
    if (!authHeader) return;

    const fetchStatusForDay = async (day) => {
      try {
        const dayNumber = getDayNumber(day);
        const statusUrl = `${API_BASE_URL}/mobile/member-workouts/${workoutId}/day/${dayNumber}/activities`;
        
        const response = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const status = data.day_status?.toLowerCase() || 'pending';
          const isCompleted = status === 'completed' || status === 'done' || status === 'finished';
          
          setDayStatusMap(prev => ({
            ...prev,
            [day]: isCompleted ? 'completed' : 'pending'
          }));
        }
      } catch (error) {
        // Silently handle errors
      }
    };

    // Fetch status for all days
    days.forEach(day => fetchStatusForDay(day));
  };

  // Mark day as completed
  const completeWorkoutDay = async () => {
    try {
      const workoutId = getWorkoutId(workout);
      if (!workoutId || !selectedDay) return false;
      const authHeader = await getAuthHeader();
      if (!authHeader) return false;
      
      const dayNumber = getDayNumber(selectedDay);
      const endpoint = `${API_BASE_URL}/mobile/member-workouts/${workoutId}/day/${dayNumber}/complete`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });
      
      if (response.ok) {
        // Update local state
        setDayStatusMap(prev => ({
          ...prev,
          [selectedDay]: 'completed'
        }));
        // Mark all activities as completed
        setWorkoutActivities(prev => prev.map(activity => ({
          ...activity,
          completed: true,
          is_completed: true
        })));
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  // Initial load
  useEffect(() => {
    // If activities and selectedDay are passed from route params, use them directly
    if (routeActivities && Array.isArray(routeActivities) && routeActivities.length > 0 && routeSelectedDay) {
      // Enrich activities with thumbnails if needed
      const enrichRouteActivities = async () => {
        const enrichedActivities = await Promise.all(
          routeActivities.map(async (activity) => {
            // If activity already has thumbnail, use it
            if (activity.thumbnail_url || activity.thumbnail || 
                activity.exercise?.thumbnail_url || activity.exercise?.thumbnail ||
                activity.exercise_details?.thumbnail_url || activity.exercise_details?.thumbnail) {
              return activity;
            }

            // Otherwise, fetch full details using exercise_id
            const exerciseId = activity.exercise_id || activity.id;
            if (exerciseId) {
              const fullDetails = await fetchActivityDetails(exerciseId);
              if (fullDetails) {
                // Merge full details with existing activity data
                return {
                  ...activity,
                  ...fullDetails,
                  // Preserve original fields
                  exercise_id: activity.exercise_id || fullDetails.exercise_id || fullDetails.id,
                  exercise_name: activity.exercise_name || fullDetails.exercise_name || fullDetails.name,
                  sets: activity.sets || fullDetails.sets,
                  reps: activity.reps || fullDetails.reps,
                  rest_seconds: activity.rest_seconds || fullDetails.rest_seconds,
                  // Include thumbnail from full details
                  thumbnail_url: fullDetails.thumbnail_url || fullDetails.thumbnail || activity.thumbnail_url || activity.thumbnail,
                  thumbnail: fullDetails.thumbnail || fullDetails.thumbnail_url || activity.thumbnail || activity.thumbnail_url,
                  exercise: fullDetails.exercise || activity.exercise,
                  exercise_details: fullDetails.exercise_details || activity.exercise_details,
                };
              }
            }
            return activity;
          })
        );
        
        setWorkoutActivities(enrichedActivities);
        if (routeSelectedDay) {
          setSelectedDay(routeSelectedDay);
        }
        setLoading(false);
        
        // Extract available days from workout object if available
        const workoutDays = workout?.days || workout?.workout_days;
        if (workoutDays && Array.isArray(workoutDays) && workoutDays.length > 0) {
          const days = workoutDays.map(day => day.day);
          setAvailableDays(days);
          fetchDayStatus(days);
        } else {
          // If we can't get days from workout, at least set the selected day
          if (routeSelectedDay) {
            setAvailableDays([routeSelectedDay]);
            fetchDayStatus([routeSelectedDay]);
          }
        }
      };
      
      enrichRouteActivities();
    } else {
      // Otherwise, fetch from API
      fetchWorkoutActivities();
    }
  }, []);

  // Refresh when day changes
  useEffect(() => {
    if (availableDays.length > 0 && availableDays.includes(selectedDay)) {
      fetchWorkoutActivities();
    }
  }, [selectedDay]);

  // Refresh when screen comes into focus (e.g., returning from WorkoutSession)
  useFocusEffect(
    useCallback(() => {
      if (availableDays.length > 0) {
        fetchDayStatus(availableDays);
        fetchWorkoutActivities();
      }
    }, [availableDays.length])
  );

  // Event Handlers
  const handleDayChange = (day) => {
    setSelectedDay(day);
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

  const getActivityIcon = (iconName) => {
    switch (iconName) {
      case 'stretch':
        return <MaterialCommunityIcons name="stretch" size={24} color="#666" />;
      case 'arm-flex':
        return <MaterialCommunityIcons name="arm-flex" size={24} color="#666" />;
      case 'human-male':
        return <MaterialCommunityIcons name="human-male" size={24} color="#666" />;
      default:
        return <MaterialCommunityIcons name="dumbbell" size={24} color="#666" />;
    }
  };

  const isCurrentDayCompleted = dayStatusMap[selectedDay] === 'completed';

  return (
    <View style={styles.container}>
      <MenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        menuItems={menuItems}
        renderMenuIcon={renderMenuIcon}
        onMenuItemPress={handleMenuItemPress}
      />
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
      </TouchableOpacity>

      <ScrollView 
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 100, flexGrow: 1 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchWorkoutActivities}
            colors={['#222']}
            tintColor="#222"
          />
        }
      >
        <View style={styles.imageContainer}>
          {workout?.thumbnail ? (
            <Image 
              source={{ 
                uri: workout.thumbnail.startsWith('http') 
                  ? workout.thumbnail 
                  : `${BASE_URL}/${workout.thumbnail}` 
              }}
              style={styles.workoutImageFull}
            />
          ) : (
            <View style={styles.workoutImagePlaceholder}>
              <MaterialCommunityIcons name="dumbbell" size={64} color="#ccc" />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.gradientOverlay}
          />
          <View style={styles.imageOverlay}>
            <Text style={styles.workoutTitle}>{toTitleCase(workout?.exercise_name || workout?.name || workout?.workout_name || 'Workout')}</Text>
            <View style={styles.headerStatsRow}>
              <View style={styles.headerStatItem}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#fff" />
                <Text style={styles.headerStatText}>{workout?.duration || 15} min</Text>
              </View>
              <View style={styles.headerStatDivider} />
              <View style={styles.headerStatItem}>
                <MaterialCommunityIcons name="fire" size={16} color="#fff" />
                <Text style={styles.headerStatText}>{Math.round((workout?.duration || 30) * 8)} kcal</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={2}>
              {workout?.description || 'Workout you can do at home to improve your wellbeing'}
            </Text>

            {!isCurrentDayCompleted && (
              <TouchableOpacity
                style={styles.floatingPlay}
                activeOpacity={0.8}
                onPress={() => {
                  navigation.navigate('WorkoutSession', { 
                    workout, 
                    activities: workoutActivities, 
                    selectedDay, 
                    workoutId: getWorkoutId(workout) 
                  });
                }}
              >
                <MaterialCommunityIcons name="play" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Day Selection */}
        {availableDays.length > 1 && (
          <View style={styles.daySelectionContainer}>
            <Text style={styles.daySelectionTitle}>Select Day</Text>
            <View style={styles.dayButtonsContainer}>
              {availableDays.map((day) => {
                const isDayCompleted = dayStatusMap[day] === 'completed';
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      selectedDay === day && styles.dayButtonActive,
                      isDayCompleted && !(selectedDay === day) && styles.dayButtonCompleted
                    ]}
                    onPress={() => handleDayChange(day)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      selectedDay === day && styles.dayButtonTextActive,
                      isDayCompleted && !(selectedDay === day) && styles.dayButtonTextCompleted
                    ]}>
                      {day.substring(0, 3)}
                    </Text>
                    {isDayCompleted && (
                      <MaterialCommunityIcons 
                        name="check-circle" 
                        size={14} 
                        color={selectedDay === day ? "#fff" : "#4CAF50"} 
                        style={{ marginLeft: 4 }} 
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Activities List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#222" />
            <Text style={styles.loadingText}>Loading workout activities...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchWorkoutActivities}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : workoutActivities.length === 0 ? (
          <View style={styles.noActivitiesContainer}>
            <MaterialCommunityIcons name="dumbbell-off" size={60} color="#ccc" />
            <Text style={styles.noActivitiesTitle}>No Activities Available</Text>
            <Text style={styles.noActivitiesSubtitle}>
              This workout might not have activities assigned yet.
            </Text>
          </View>
        ) : (
          workoutActivities.map((activity, index) => {
            const activityId = activity.activity_id || activity.id || index;
            const rawExerciseName = activity.exercise_name || activity.name || activity.activity_name || 'Activity';
            const exerciseName = toTitleCase(rawExerciseName); // Convert to Title Case
            const description = activity.exercise_details?.description || activity.exercise?.description || activity.description || activity.activity_description || 'No description available';
            const sets = activity.sets || 'N/A';
            const reps = activity.reps || 'N/A';
            const restSeconds = activity.rest_seconds || activity.rest || 'N/A';
            const isCompleted = activity.completed || activity.is_completed || isCurrentDayCompleted;
            
            return (
              <TouchableOpacity 
                key={activityId} 
                style={[
                  styles.activityCard,
                  isCompleted && styles.activityCardCompleted
                ]}
                onPress={() => {
                  navigation.navigate('ActivityDetails', { 
                    activity, 
                    workoutId: getWorkoutId(workout), 
                    selectedDay,
                  });
                }}
                activeOpacity={0.7}
              >
             
                <View style={styles.activityContent}>
                  {/* Activity Thumbnail */}
                  {getThumbnailUrl(activity) ? (
                    <Image
                      source={{ uri: getThumbnailUrl(activity) }}
                      style={styles.activityImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.activityImagePlaceholder}>
                      <MaterialCommunityIcons name="dumbbell" size={32} color="#ccc" />
                    </View>
                  )}
                  
                  <View style={styles.activityMainContent}>
                    <View style={styles.activityHeaderRow}>
                      <Text style={styles.activityName} numberOfLines={2}>{exerciseName}</Text>
                      {isCompleted && (
                        <View style={styles.completionBadge}>
                          <MaterialCommunityIcons name="check" size={16} color="#fff" />
                        </View>
                      )}
                    </View>
                    
                    {/* Sets and Reps - Compact inline design */}
                    {(activity.sets || activity.reps) && (
                      <View style={styles.setsRepsContainer}>
                        <View style={styles.setsRepsItem}>
                          <Text style={styles.setsRepsValue}>{sets !== 'N/A' ? sets : 'N/A'}</Text>
                          <Text style={styles.setsRepsLabel}>Sets</Text>
                        </View>
                        <View style={styles.setsRepsDivider} />
                        <View style={styles.setsRepsItem}>
                          <Text style={styles.setsRepsValue}>{reps !== 'N/A' ? reps : 'N/A'}</Text>
                          <Text style={styles.setsRepsLabel}>Reps</Text>
                        </View>
                        <View style={styles.setsRepsDivider} />
                        <View style={styles.setsRepsItem}>
                          <Text style={styles.setsRepsValue}>{restSeconds !== 'N/A' ? `${restSeconds}s` : 'N/A'}</Text>
                          <Text style={styles.setsRepsLabel}>Rest</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Finish Training Button */}
      {workoutActivities.length > 0 && (() => {
        const completedCount = workoutActivities.filter(a => a.completed || a.is_completed || isCurrentDayCompleted).length;
        const totalCount = workoutActivities.length;
        const allCompleted = completedCount === totalCount;
        const hasStarted = completedCount > 0;
        
        let buttonText = 'Start Training';
        let buttonStyle = styles.finishPill;
        let titleStyle = styles.finishPillTitle;
        
        if (allCompleted || isCurrentDayCompleted) {
          buttonText = 'Workout Completed ✓';
          buttonStyle = [styles.finishPill, styles.finishPillCompleted];
          titleStyle = styles.finishPillTitleCompleted;
        } else if (hasStarted) {
          buttonText = 'Finish Training';
          buttonStyle = [styles.finishPill, styles.finishPillActive];
          titleStyle = styles.finishPillTitleActive;
        }
        
        const handleButtonPress = async () => {
          // Micro-interaction: Scale animation
          Animated.sequence([
            Animated.timing(finishButtonScale, {
              toValue: 0.95,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(finishButtonScale, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
          ]).start();

          // Calculate summary values
          const duration = Number(workout?.duration) || 15;
          const calories = Math.round(duration * 6.7) || 0;
          const activitiesCount = workoutActivities.length;
          const totalSets = workoutActivities.reduce((sum, activity) => {
            return sum + (Number(activity.sets) || 0);
          }, 0);

          if (isCurrentDayCompleted) {
            // Already completed - navigate to summary
            navigation.navigate('WorkoutFinished', { 
              duration,
              calories,
              activities: activitiesCount,
              sets: totalSets
            });
          } else {
            // Mark as completed
            const success = await completeWorkoutDay();
            if (success) {
              navigation.navigate('WorkoutFinished', { 
                duration,
                calories,
                activities: activitiesCount,
                sets: totalSets
              });
            }
          }
        };
        
        return (
          <Animated.View style={{ transform: [{ scale: finishButtonScale }] }}>
            {/* <TouchableOpacity
              style={buttonStyle}
              activeOpacity={0.8}
              onPress={handleButtonPress}
            >
            <Text style={titleStyle}>
              {buttonText}
            </Text>
            <Text style={[
              styles.finishPillSubtitle,
              (allCompleted || isCurrentDayCompleted || hasStarted) && styles.finishPillSubtitleActive
            ]}>
              {completedCount}/{totalCount} activities done
            </Text>
          </TouchableOpacity> */}
          </Animated.View>
        );
      })()}
      
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
    backgroundColor: '#f8f9fa'
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 220,
  },
  workoutImageFull: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
  },
  workoutImagePlaceholder: {
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
  headerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  headerStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerStatDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 12,
  },
  headerStatText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 13,
    fontWeight: '700',
    opacity: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    color: '#fff',
    marginTop: 6,
    fontSize: 13,
    opacity: 0.95,
    lineHeight: 18,
    fontWeight: '500',
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
  workoutTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'left',
    letterSpacing: -0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#222',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noActivitiesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: '5%',
  },
  noActivitiesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noActivitiesSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  daySelectionContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  daySelectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f7fa',
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonActive: {
    backgroundColor: '#1a1a1a',
  },
  dayButtonCompleted: {
    backgroundColor: '#ecfdf5',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  dayButtonTextActive: {
    color: '#fff',
  },
  dayButtonTextCompleted: {
    color: '#10b981',
    fontWeight: '700',
  },
  activityCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  activityCardCompleted: {
    backgroundColor: '#f8f9fa',
    opacity: 0.9,
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  activityContent: {
    flexDirection: 'row',
  },
  activityImage: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  activityImagePlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityMainContent: {
    flex: 1,
    padding: 4,
    paddingLeft: 0,
    paddingRight: 18,
    justifyContent: 'center',
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    lineHeight: 20,
    paddingRight: 8,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  tileBox: {
    flex: 1,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileAdd: {
    flexBasis: 70,
    width: 70,
  },
  tileText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
  },
  setsRepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  setsRepsItem: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  setsRepsLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  setsRepsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  setsRepsDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  tilesMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  metaText: {
    color: '#666',
    fontWeight: '700',
  },
  finishPill: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    alignItems: 'center',
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  finishPillActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  finishPillCompleted: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  finishPillTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.2,
  },
  finishPillTitleActive: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  finishPillTitleCompleted: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  finishPillSubtitle: {
    marginTop: 4,
    color: '#6b7280',
    fontWeight: '500',
    fontSize: 11,
  },
  finishPillSubtitleActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  completionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default WorkoutStart;
