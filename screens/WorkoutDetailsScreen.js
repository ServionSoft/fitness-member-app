import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Dimensions, ActivityIndicator, Alert, RefreshControl, InteractionManager, Modal } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { useAuth } from '../contexts/AuthContext';
import ModernAlert from '../components/ModernAlert';
import { deleteMemberWorkout } from '../api/workouts';
import { useQueryClient } from '@tanstack/react-query';
import { workoutKeys } from '../api/queryKeys';

const { width: screenWidth } = Dimensions.get('window');

// Workout activities will be fetched from API

const WorkoutDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { workout, canStartWorkout = true, isFromAllWorkouts = false, isCreatedByMember = false } = route.params || {};
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [menuVisible, setMenuVisible] = useState(false);
  const [workoutActivities, setWorkoutActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [availableDays, setAvailableDays] = useState([]);
  const [dayStatusMap, setDayStatusMap] = useState({}); // Track status per day: { Monday: 'completed', Tuesday: 'pending', ... }
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const [activeTab, setActiveTab] = useState('Activities'); // 'Activities' or 'Info'
  const [workoutOptionsModalVisible, setWorkoutOptionsModalVisible] = useState(false);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState(null);

  const insets = useSafeAreaInsets();
  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = API_BASE_URL.replace('/api', ''); // For image URLs

  const fixedHeaderTop = insets.top + 10;

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
      const fullUrl = `${BASE_URL}/thumbnails/${filename}`;
      return fullUrl;
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
          activityData = result.data[0]; // Get first activity from array
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
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  };

  // Helper function to get workout ID (handles both 'id' and 'workout_id')
  const getWorkoutId = (workoutData) => {
    if (!workoutData) return null;
    return workoutData.id || workoutData.workout_id || null;
  };

  // Helper function to check if activity has a video
  const hasVideo = (activityData) => {
    if (!activityData) return false;
    
    // Check various video fields
    if (activityData.video_url || activityData.video_link) return true;
    if (activityData.exercise?.video_url || activityData.exercise?.video_link) return true;
    if (activityData.exercise_details?.video_link) return true;
    if (activityData.video_relative_path || activityData.exercise?.video_relative_path) return true;
    
    return false;
  };

  // Helper function to convert day name to day number
  const getDayNumber = (dayName) => {
    const dayMap = {
      'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
      'Friday': 5, 'Saturday': 6, 'Sunday': 7
    };
    return dayMap[dayName] || 1;
  };

  // Helper function to extract activities for a specific day from workout object
  const getActivitiesForDay = (dayName, workoutData) => {
    if (!workoutData) return [];
    
    // Handle both 'days' and 'workout_days' structures
    let workoutDays = null;
    if (workoutData.days && Array.isArray(workoutData.days) && workoutData.days.length > 0) {
      workoutDays = workoutData.days;
    } else if (workoutData.workout_days && Array.isArray(workoutData.workout_days) && workoutData.workout_days.length > 0) {
      workoutDays = workoutData.workout_days;
    }

    if (workoutDays) {
      const dayData = workoutDays.find(day => day.day === dayName);
      if (dayData) {
        // Handle both 'activities' and 'workout_activity_plans' structures
        return dayData.activities || dayData.workout_activity_plans || [];
      }
    }
    
    return [];
  };

  // Fetch day-specific status to determine completion state
  const fetchWorkoutStatus = async (day = null) => {
    try {
      const workoutId = getWorkoutId(workout);
      if (!workoutId) {
        return;
      }

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Use the selected day or the provided day
      const dayToCheck = day || selectedDay;
      const dayNumber = getDayNumber(dayToCheck);

      // Use day-specific endpoint
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
        
        // Extract day_status from response (backend provides this directly)
        let status = 'pending';
        if (data.day_status) {
          const apiStatus = data.day_status.toLowerCase();
          if (apiStatus === 'completed' || apiStatus === 'done' || apiStatus === 'finished') {
            status = 'completed';
          } else if (apiStatus === 'not_started' || apiStatus === 'pending' || apiStatus === 'in_progress') {
            status = 'pending';
          }
        }

        // Update day-specific status map
        setDayStatusMap(prev => ({
          ...prev,
          [dayToCheck]: status
        }));
      }
    } catch (error) {
      // Error fetching workout status
    }
  };

  const fetchWorkoutActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if we have a workout ID (handles both 'id' and 'workout_id')
      const workoutId = getWorkoutId(workout);
      if (!workoutId) {
        setError('Workout ID is required');
        setLoading(false);
        return null;
      }

      // Check if workout object already contains activities data
      // If data comes from workout screen, use it and skip API call entirely
      // Handle both 'days' and 'workout_days' structures
      let workoutDays = null;
      if (workout.days && Array.isArray(workout.days) && workout.days.length > 0) {
        workoutDays = workout.days;
      } else if (workout.workout_days && Array.isArray(workout.workout_days) && workout.workout_days.length > 0) {
        workoutDays = workout.workout_days;
      }

      if (workoutDays) {
        const days = workoutDays.map(day => day.day);
        
        // Find activities for the selected day using helper function
        let activities = [];
        if (!days.includes(selectedDay)) {
          const firstAvailableDay = days[0];
          setSelectedDay(firstAvailableDay);
          activities = getActivitiesForDay(firstAvailableDay, workout);
        } else {
          activities = getActivitiesForDay(selectedDay, workout);
        }
        
        // Enrich activities with full details (including thumbnails)
        if (activities && activities.length > 0) {
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
        } else {
          setWorkoutActivities(activities || []);
        }
        
        setAvailableDays(days.length > 0 ? days : ['Monday']);
        setLoading(false);
        return workout;
      } else {
        // No workout days found in workout object
        setWorkoutActivities([]);
        setAvailableDays(['Monday']);
        setLoading(false);
        return null;
      }
    } catch (error) {
      setError('Network error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkoutActivities();
  }, []);

  // Fetch status for all available days when they're loaded (to show completion in day buttons)
  useEffect(() => {
    if (availableDays.length > 0) {
      // Fetch status for all available days to show completion indicators
      const uniqueDays = [...new Set(availableDays)];
      uniqueDays.forEach(day => {
        fetchWorkoutStatus(day);
      });
    }
  }, [availableDays.length > 0 ? availableDays.join(',') : '']);

  // Refresh workout status when screen comes into focus (e.g., returning from WorkoutSession)
  useFocusEffect(
    React.useCallback(() => {
      // Fetch status for all available days to update completion indicators
      if (availableDays.length > 0) {
        const uniqueDays = [...new Set(availableDays)];
        uniqueDays.forEach(day => {
          fetchWorkoutStatus(day);
        });
      }
    }, [workout?.id || workout?.workout_id, availableDays.length > 0 ? availableDays.join(',') : ''])
  );

  // Update activities when selected day changes (use data from workout object)
  useEffect(() => {
    if (availableDays.length > 0 && availableDays.includes(selectedDay)) {
      // Data comes from workout screen, use it directly
      const activitiesFromWorkout = getActivitiesForDay(selectedDay, workout);
      setWorkoutActivities(activitiesFromWorkout || []);
      
      // Always fetch status for the selected day
      fetchWorkoutStatus(selectedDay);
    }
  }, [selectedDay]);

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

  const openWorkoutOptions = () => setWorkoutOptionsModalVisible(true);
  const closeWorkoutOptions = () => setWorkoutOptionsModalVisible(false);

  const handleEditMyWorkout = () => {
    closeWorkoutOptions();
    const workoutId = workout?.id || workout?.workout_id;
    if (!workoutId) return;
    navigation.navigate('CreateWorkout', { editWorkoutId: workoutId, workout });
  };

  const handleDeleteMyWorkout = () => {
    const workoutId = workout?.id || workout?.workout_id;
    if (!workoutId) {
      closeWorkoutOptions();
      return;
    }
    setAlertConfig({
      title: 'Delete workout',
      message: `Are you sure you want to delete "${capitalizeWords(workout?.exercise_name || workout?.name || 'this workout')}"?`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', onPress: () => setAlertVisible(false), style: 'secondary' },
        {
          text: 'Delete',
          onPress: async () => {
            setAlertVisible(false);
            setDeletingWorkoutId(workoutId);
            try {
              await deleteMemberWorkout(workoutId);
              queryClient.invalidateQueries({ queryKey: workoutKeys.myWorkouts() });
              closeWorkoutOptions();
              navigation.goBack();
            } catch (err) {
              setAlertConfig({
                title: 'Error',
                message: err.message || 'Failed to delete workout',
                type: 'error',
                buttons: [{ text: 'OK', onPress: () => setAlertVisible(false) }],
              });
              setAlertVisible(true);
            } finally {
              setDeletingWorkoutId(null);
            }
          },
          style: 'danger',
        },
      ],
    });
    setAlertVisible(true);
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
        return <MaterialCommunityIcons name="stretch" size={20} color="#666" />;
      case 'arm-flex':
        return <MaterialCommunityIcons name="arm-flex" size={20} color="#666" />;
      case 'human-male':
        return <MaterialCommunityIcons name="human-male" size={20} color="#666" />;
      default:
        return <MaterialCommunityIcons name="dumbbell" size={20} color="#666" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Warm-up':
        return '#4CAF50';
      case 'Strength':
        return '#2196F3';
      case 'Cardio':
        return '#FF9800';
      case 'Core':
        return '#9C27B0';
      case 'Cool-down':
        return '#4CAF50';
      default:
        return '#666';
    }
  };

  // Helper function to check if workout has equipment
  const hasEquipment = (workoutData) => {
    if (!workoutData) return false;
    
    const equipment = workoutData.equipment 
      || workoutData.equipment_type 
      || workoutData.equipment_needed
      || workoutData.equipment_name;
    
    if (!equipment) return false;
    
    // Check if it's an array with items
    if (Array.isArray(equipment)) {
      return equipment.length > 0 && equipment.some(eq => {
        if (typeof eq === 'string') return eq.trim() !== '';
        if (typeof eq === 'object') return (eq.name || eq.equipment_name || eq.equipment);
        return false;
      });
    }
    
    // Check if it's a non-empty string
    if (typeof equipment === 'string') {
      return equipment.trim() !== '' && equipment.trim().toLowerCase() !== 'none' && equipment.trim().toLowerCase() !== 'no equipment';
    }
    
    // Check if it's an object with a name
    if (typeof equipment === 'object') {
      return !!(equipment.name || equipment.equipment_name || equipment.equipment);
    }
    
    return false;
  };

  // Helper function to get equipment count
  const getEquipmentCount = (workoutData) => {
    if (!workoutData) return 0;
    
    const equipment = workoutData.equipment 
      || workoutData.equipment_type 
      || workoutData.equipment_needed
      || workoutData.equipment_name;
    
    if (!equipment) return 0;
    
    if (Array.isArray(equipment)) {
      return equipment.filter(eq => {
        if (typeof eq === 'string') return eq.trim() !== '';
        if (typeof eq === 'object') return !!(eq.name || eq.equipment_name || eq.equipment);
        return false;
      }).length;
    }
    
    if (typeof equipment === 'string') {
      const trimmed = equipment.trim();
      if (trimmed === '' || trimmed.toLowerCase() === 'none' || trimmed.toLowerCase() === 'no equipment') {
        return 0;
      }
      // Count comma-separated equipment
      return trimmed.split(',').filter(eq => eq.trim() !== '').length;
    }
    
    if (typeof equipment === 'object') {
      return (equipment.name || equipment.equipment_name || equipment.equipment) ? 1 : 0;
    }
    
    return 0;
  };

  // Helper function to clean equipment name (remove brackets, quotes, etc.)
  const cleanEquipmentName = (name) => {
    if (!name) return '';
    let cleaned = String(name).trim();
    // Remove JSON array brackets and quotes
    cleaned = cleaned.replace(/^\[|\]$/g, ''); // Remove [ and ]
    cleaned = cleaned.replace(/^"|"$/g, ''); // Remove leading/trailing quotes
    cleaned = cleaned.replace(/^'|'$/g, ''); // Remove leading/trailing single quotes
    cleaned = cleaned.trim();
    return cleaned;
  };

  // Helper function to get equipment names as an array
  const getEquipmentNames = (workoutData) => {
    if (!workoutData) return [];
    
    const equipment = workoutData.equipment 
      || workoutData.equipment_type 
      || workoutData.equipment_needed
      || workoutData.equipment_name;
    
    if (!equipment) return [];
    
    const equipmentNames = [];
    
    // Try to parse as JSON first if it's a string that looks like JSON
    let parsedEquipment = equipment;
    if (typeof equipment === 'string') {
      const trimmed = equipment.trim();
      // Check if it looks like a JSON array or object
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
          (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          parsedEquipment = JSON.parse(trimmed);
        } catch (e) {
          // If parsing fails, use the original string
          parsedEquipment = equipment;
        }
      } else {
        parsedEquipment = equipment;
      }
    }
    
    if (Array.isArray(parsedEquipment)) {
      parsedEquipment.forEach(eq => {
        if (typeof eq === 'string') {
          const cleaned = cleanEquipmentName(eq);
          if (cleaned) equipmentNames.push(cleaned);
        } else if (typeof eq === 'object' && eq) {
          const name = eq.name || eq.equipment_name || eq.equipment;
          if (name) {
            const cleaned = cleanEquipmentName(name);
            if (cleaned) equipmentNames.push(cleaned);
          }
        }
      });
    } else if (typeof parsedEquipment === 'string') {
      const trimmed = parsedEquipment.trim();
      if (trimmed !== '' && trimmed.toLowerCase() !== 'none' && trimmed.toLowerCase() !== 'no equipment') {
        // Split by comma and filter out empty strings
        trimmed.split(',').forEach(eq => {
          const cleaned = cleanEquipmentName(eq);
          if (cleaned) equipmentNames.push(cleaned);
        });
      }
    } else if (typeof parsedEquipment === 'object' && parsedEquipment) {
      const name = parsedEquipment.name || parsedEquipment.equipment_name || parsedEquipment.equipment;
      if (name) {
        const cleaned = cleanEquipmentName(name);
        if (cleaned) equipmentNames.push(cleaned);
      }
    }
    
    // Remove duplicates and filter out empty values
    return [...new Set(equipmentNames)].filter(name => name !== '' && name !== '[]' && name !== '[""]');
  };

  // Helper function to check if workout has target muscles
  const hasTargetMuscles = (workoutData) => {
    if (!workoutData) return false;
    
    const muscles = workoutData.muscles_targeted // Primary field from workouts table
      || workoutData.muscles 
      || workoutData.muscle_groups
      || workoutData.target_muscles
      || workoutData.muscle_group
      || workoutData.target_muscle
      || workoutData.muscle
      || workoutData.category; // category can be muscle group
    
    if (!muscles) return false;
    
    // Check if it's an array with items
    if (Array.isArray(muscles)) {
      return muscles.length > 0 && muscles.some(muscle => {
        if (typeof muscle === 'string') return muscle.trim() !== '';
        if (typeof muscle === 'object') return (muscle.name || muscle.muscle_name || muscle.muscle);
        return false;
      });
    }
    
    // Check if it's a non-empty string
    if (typeof muscles === 'string') {
      return muscles.trim() !== '' && muscles.trim().toLowerCase() !== 'none';
    }
    
    // Check if it's an object with a name
    if (typeof muscles === 'object') {
      return !!(muscles.name || muscles.muscle_name || muscles.muscle);
    }
    
    return false;
  };

  // Helper function to clean muscle name (remove brackets, quotes, etc.)
  const cleanMuscleName = (name) => {
    if (!name) return '';
    let cleaned = String(name).trim();
    // Remove JSON array brackets and quotes
    cleaned = cleaned.replace(/^\[|\]$/g, ''); // Remove [ and ]
    cleaned = cleaned.replace(/^"|"$/g, ''); // Remove leading/trailing quotes
    cleaned = cleaned.replace(/^'|'$/g, ''); // Remove leading/trailing single quotes
    cleaned = cleaned.trim();
    return cleaned;
  };

  // Helper function to get target muscle names as an array
  const getTargetMuscleNames = (workoutData) => {
    if (!workoutData) return [];
    
    const muscles = workoutData.muscles_targeted // Primary field from workouts table
      || workoutData.muscles 
      || workoutData.muscle_groups
      || workoutData.target_muscles
      || workoutData.muscle_group
      || workoutData.target_muscle
      || workoutData.muscle
      || workoutData.category; // category can be muscle group
    
    if (!muscles) return [];
    
    const muscleNames = [];
    
    // Try to parse as JSON first if it's a string that looks like JSON
    let parsedMuscles = muscles;
    if (typeof muscles === 'string') {
      const trimmed = muscles.trim();
      // Check if it looks like a JSON array or object
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
          (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          parsedMuscles = JSON.parse(trimmed);
        } catch (e) {
          // If parsing fails, use the original string
          parsedMuscles = muscles;
        }
      } else {
        parsedMuscles = muscles;
      }
    }
    
    if (Array.isArray(parsedMuscles)) {
      parsedMuscles.forEach(muscle => {
        if (typeof muscle === 'string') {
          const cleaned = cleanMuscleName(muscle);
          if (cleaned) muscleNames.push(cleaned);
        } else if (typeof muscle === 'object' && muscle) {
          const name = muscle.name || muscle.muscle_name || muscle.muscle;
          if (name) {
            const cleaned = cleanMuscleName(name);
            if (cleaned) muscleNames.push(cleaned);
          }
        }
      });
    } else if (typeof parsedMuscles === 'string') {
      const trimmed = parsedMuscles.trim();
      if (trimmed !== '' && trimmed.toLowerCase() !== 'none') {
        // Split by comma and filter out empty strings
        trimmed.split(',').forEach(muscle => {
          const cleaned = cleanMuscleName(muscle);
          if (cleaned) muscleNames.push(cleaned);
        });
      }
    } else if (typeof parsedMuscles === 'object' && parsedMuscles) {
      const name = parsedMuscles.name || parsedMuscles.muscle_name || parsedMuscles.muscle;
      if (name) {
        const cleaned = cleanMuscleName(name);
        if (cleaned) muscleNames.push(cleaned);
      }
    }
    
    // Remove duplicates and filter out empty values
    return [...new Set(muscleNames)].filter(name => name !== '' && name !== '[]' && name !== '[""]');
  };

  // Helper function to capitalize first letter of every word
  const capitalizeWords = (str) => {
    if (!str) return '';
    const text = String(str)
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Capitalize first letter of the string and letters after spaces or hyphens
    return text
      .toLowerCase()
      .replace(/(^|\s|-)(\w)/g, (match, p1, p2) => p1 + p2.toUpperCase());
  };

  // Helper function to calculate total number of activities across all days
  const getTotalActivitiesCount = () => {
    if (!workout) return 0;
    
    let totalCount = 0;
    
    // Handle both 'days' and 'workout_days' structures
    let workoutDays = null;
    if (workout.days && Array.isArray(workout.days) && workout.days.length > 0) {
      workoutDays = workout.days;
    } else if (workout.workout_days && Array.isArray(workout.workout_days) && workout.workout_days.length > 0) {
      workoutDays = workout.workout_days;
    }
    
    if (workoutDays) {
      workoutDays.forEach(day => {
        const activities = day.activities || day.workout_activity_plans || [];
        totalCount += activities.length;
      });
    }
    
    return totalCount;
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
      

      {/* Back Button - fixed at top */}
      <TouchableOpacity 
        style={[styles.backButton, { top: fixedHeaderTop }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
      </TouchableOpacity>

      {/* 3-dot menu for member-created workouts - fixed at top */}
      {isCreatedByMember && (
        <TouchableOpacity
          style={[styles.headerMenuButton, { top: fixedHeaderTop }]}
          onPress={openWorkoutOptions}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      <ScrollView 
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 120, flexGrow: 1 }} 
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
             colors={['transparent', 'rgba(0,0,0,0.7)']}
             style={styles.gradientOverlay}
           />
           <View style={styles.imageOverlay}>
             <Text style={styles.workoutTitle}>{capitalizeWords(workout?.exercise_name || workout?.name || workout?.workout_name || 'Workout')}</Text>
           </View>
           {/* Workout Header - Positioned to overlap image */}
           <View style={styles.workoutHeader}>
          <View style={styles.workoutInfoVertical}>
          <MaterialCommunityIcons name="clock-outline" size={16} color="#FF6B6B" />
          <Text style={styles.workoutValueText}>
               {workout?.duration || '30'} min 
             </Text>
             <Text style={styles.workoutLabelText}>Duration</Text>
 
          </View>
          <View style={styles.workoutInfoVertical}>
          <MaterialCommunityIcons name="trending-up" size={16} color="#FF6B6B" />
          <Text style={styles.workoutValueText}>
          {workout?.level || 'Intermediate'}
             </Text>
             <Text style={styles.workoutLabelText}>Level</Text>
 
          </View>
          <View style={styles.workoutInfoVertical}>
          <MaterialCommunityIcons name="fire" size={16} color="#FF6B6B" />
          <Text style={styles.workoutValueText}>
          {Math.round((workout?.duration || 30) * 8)} cal
             </Text>
             <Text style={styles.workoutLabelText}>kcal</Text>
 
          </View>
        </View>
         </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Activities' && styles.tabActive]}
            onPress={() => setActiveTab('Activities')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'Activities' && styles.tabTextActive]}>
              Activities
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Info' && styles.tabActive]}
            onPress={() => setActiveTab('Info')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'Info' && styles.tabTextActive]}>
              Info
            </Text>
          </TouchableOpacity>
        </View>

        {/* Activities Tab Content */}
        {activeTab === 'Activities' && (
          <>
            {/* Day Selection */}
            {availableDays.length > 1 && (
          <View style={styles.daySelectionContainer}>
            <Text style={styles.daySelectionTitle}>Select Day</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.dayButtonsScrollView}
              contentContainerStyle={styles.dayButtonsContainer}
            >
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
                      <MaterialCommunityIcons name="check-circle" size={14} color={selectedDay === day ? "#fff" : "#4CAF50"} style={{ marginLeft: 4 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Activities Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Workout Activities</Text>
            <TouchableOpacity onPress={fetchWorkoutActivities} style={styles.refreshIcon}>
              <MaterialCommunityIcons name="refresh" size={16} color="#666" />
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSubtitle}>
            {loading ? 'Loading...' : `${workoutActivities.length} exercises for ${selectedDay}`}
          </Text>
        </View>

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
            <MaterialCommunityIcons name="dumbbell-off" size={48} color="#ccc" />
            <Text style={styles.noActivitiesTitle}>No Activities Available</Text>
            <Text style={styles.noActivitiesSubtitle}>
              This workout might not have activities assigned yet, or there might be a data issue.
            </Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={() => fetchWorkoutActivities()}
            >
              <MaterialCommunityIcons name="refresh" size={14} color="#fff" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
                     workoutActivities.map((activity, index) => {
               // Handle both activity structures (from API and from workout object)
               const activityId = activity.activity_id || activity.id || index;
               const exerciseName = activity.exercise_name || activity.name || activity.activity_name || 'Activity';
               const description = activity.exercise_details?.description || activity.exercise?.description || activity.description || activity.activity_description || 'No description available';
               const sets = activity.sets || 'N/A';
               const reps = activity.reps || 'N/A';
               const restSeconds = activity.rest_seconds || activity.rest || 'N/A';
               
               // Check if current day is completed (day-specific check)
               const isCurrentDayCompleted = dayStatusMap[selectedDay] === 'completed';
               
               const activityHasVideo = hasVideo(activity);
               
               return (
                 <TouchableOpacity 
                   key={activityId} 
                   style={[
                     styles.activityCard,
                     isCurrentDayCompleted && styles.activityCardCompleted
                   ]}
                   onPress={() => navigation.navigate('ActivityDetails', { 
                     activity, 
                     workoutId: getWorkoutId(workout), 
                     selectedDay,
                   })}
                   activeOpacity={0.7}
                 >
                   {/* Video Icon Button - Top Right */}
                   {activityHasVideo && (
                     <TouchableOpacity
                       style={styles.videoIconButton}
                       onPress={(e) => {
                         e.stopPropagation();
                         navigation.navigate('ActivityDetails', { 
                           activity, 
                           workoutId: getWorkoutId(workout), 
                           selectedDay,
                         });
                       }}
                       activeOpacity={0.7}
                     >
                       <Ionicons name="play-circle" size={24} color="#121212" />
                     </TouchableOpacity>
                   )}
                   
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
                        <Text style={styles.activityName} numberOfLines={2}>
                          {capitalizeWords(exerciseName)}
                        </Text>
                         {isCurrentDayCompleted && (
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
          </>
        )}

        {/* Info Tab Content */}
        {activeTab === 'Info' && (
          <>
            {/* Workout Details Section */}
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Workout Details</Text>
              <View style={styles.infoDetailRow}>
                <Text style={styles.infoDetailLabel}>Name:</Text>
                <Text style={styles.infoDetailValue}>
                  {capitalizeWords(workout?.exercise_name || workout?.name || workout?.workout_name || 'N/A')}
                </Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoDetailRow}>
                <Text style={styles.infoDetailLabel}>Duration:</Text>
                <Text style={styles.infoDetailValue}>
                  {workout?.duration || '30'} minutes
                </Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoDetailRow}>
                <Text style={styles.infoDetailLabel}>Level:</Text>
                <Text style={styles.infoDetailValue}>
                  {capitalizeWords(workout?.level || 'Intermediate')}
                </Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoDetailRow}>
                <Text style={styles.infoDetailLabel}>Category:</Text>
                <Text style={styles.infoDetailValue}>
                  {capitalizeWords(workout?.category || workout?.category_name || 'upper-body')}
                </Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoDetailRow}>
                <Text style={styles.infoDetailLabel}>Goal:</Text>
                <Text style={styles.infoDetailValue}>
                  {capitalizeWords(workout?.goal || workout?.goal_name || 'Build Muscle')}
                </Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoDetailRow}>
                <Text style={styles.infoDetailLabel}>Preset Weights:</Text>
                <Text style={styles.infoDetailValue}>
                  {capitalizeWords(workout?.preset_weights ? 'Enabled' : 'Disabled')}
                </Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoDetailRow}>
                <Text style={styles.infoDetailLabel}>Number of Activities:</Text>
                <Text style={styles.infoDetailValue}>
                  {getTotalActivitiesCount()}
                </Text>
              </View>
            </View>

            {/* Equipment Section - Only show if equipment exists */}
            {hasEquipment(workout) && (() => {
              const equipmentNames = getEquipmentNames(workout);
              return (
                <View style={styles.infoCard}>
                  <Text style={styles.infoCardTitle}>Equipment</Text>
                  <View style={styles.equipmentListContainer}>
                    {equipmentNames.map((equipmentName, index) => (
                      <View key={index} style={styles.equipmentItem}>
                        <MaterialCommunityIcons name="dumbbell" size={20} color="#1a1a1a" />
                        <Text style={styles.equipmentName}>{equipmentName}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}

            {/* Targeted Muscle Group Section - Only show if muscles exist */}
            {hasTargetMuscles(workout) && (() => {
              const muscleNames = getTargetMuscleNames(workout);
              return (
                <View style={styles.infoCard}>
                  <Text style={styles.infoCardTitle}>Targeted Muscle Group</Text>
                  <View style={styles.muscleListContainer}>
                    {muscleNames.map((muscleName, index) => (
                      <View key={index} style={styles.muscleItem}>
                        <MaterialCommunityIcons name="arm-flex" size={20} color="#1a1a1a" />
                        <Text style={styles.muscleName}>{muscleName}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}
          </>
        )}

 
      </ScrollView>

      {/* Workout Session Button or Completion Status - Only show if canStartWorkout is true */}
      {canStartWorkout && workoutActivities.length > 0 && (() => {
        // Check if current day is completed (day-specific check)
        const isCurrentDayCompleted = dayStatusMap[selectedDay] === 'completed';
        
        return (
          <>
            {isCurrentDayCompleted ? (
              <TouchableOpacity 
                style={styles.completedWorkoutContainer}
                onPress={() => {
                  InteractionManager.runAfterInteractions(() => {
                    navigation.navigate('WorkoutStart', { 
                      workout, 
                      activities: workoutActivities, 
                      selectedDay, 
                      workoutId: getWorkoutId(workout) 
                    });
                  });
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="check-decagram" size={20} color="#fff" />
                <Text style={styles.completedWorkoutText}>Activity Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.startSessionButton} 
                activeOpacity={0.8}
                onPress={() => {
                  // Use InteractionManager for smooth navigation
                  InteractionManager.runAfterInteractions(() => {
                    navigation.navigate('WorkoutStart', { 
                      workout, 
                      activities: workoutActivities, 
                      selectedDay, 
                      workoutId: getWorkoutId(workout) 
                    });
                  });
                }}
              >
                <MaterialCommunityIcons name="play-circle" size={18} color="#fff" />
                <Text style={styles.startSessionButtonText}>Start Workout Session</Text>
              </TouchableOpacity>
            )}
          </>
        );
      })()}

      {/* Plan Workout Button - Same position as Start Workout Session */}
      {(!canStartWorkout || workoutActivities.length === 0) && (
        <TouchableOpacity 
          style={styles.planWorkoutButton} 
          activeOpacity={0.8}
          onPress={() => {
            navigation.navigate('PlanWorkout', { workout });
          }}
        >
          <MaterialCommunityIcons name="calendar-plus" size={18} color="#fff" />
          <Text style={styles.planWorkoutButtonText}>Plan Workout</Text>
        </TouchableOpacity>
      )}
      
      {/* Workout options bottom modal (Edit / Delete) when isCreatedByMember */}
      <Modal
        visible={workoutOptionsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeWorkoutOptions}
      >
        <TouchableOpacity
          style={styles.workoutOptionsOverlay}
          activeOpacity={1}
          onPress={closeWorkoutOptions}
        />
        <View style={styles.workoutOptionsSheet}>
          <View style={styles.workoutOptionsHandle} />
          <TouchableOpacity
            style={styles.workoutOptionsItem}
            onPress={handleEditMyWorkout}
          >
            <Ionicons name="pencil" size={22} color="#1a1a1a" />
            <Text style={styles.workoutOptionsItemText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.workoutOptionsItem}
            onPress={handleDeleteMyWorkout}
            disabled={deletingWorkoutId !== null}
          >
            {deletingWorkoutId ? (
              <ActivityIndicator size="small" color="#c62828" />
            ) : (
              <Ionicons name="trash-outline" size={22} color="#c62828" />
            )}
            <Text style={[styles.workoutOptionsItemText, styles.workoutOptionsItemTextDanger]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Modal>

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
    backgroundColor: '#f7f8f2'
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
    marginBottom: 50, // Space for the overlapping header
  },
  workoutImageFull: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  workoutImagePlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%', // Increased to cover more area for better text readability
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 60, // Position above the overlapping header
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
  },
  workoutHeader: {
    position: 'absolute',
    bottom: -50, // Half of the header height (100px) to overlap image
    left: '5%',
    right: '5%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 10,
  },
  workoutImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  workoutInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  workoutInfoVertical: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#fff',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  workoutSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
    fontWeight: '500',
  },
  workoutStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  
  sectionHeader: {
    marginHorizontal: '5%',
    marginBottom: 10,
    marginTop: 18,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  refreshIcon: {
    padding: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  activityCard: {
    backgroundColor: '#fff',
    marginHorizontal: '5%',
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // Add subtle border to indicate it's clickable
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  activityCardCompleted: {
    backgroundColor: '#f8fff8',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  videoIconButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
  activityDescription: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
    lineHeight: 18,
    fontWeight: '500',
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  durationText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  setsRepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop:5,
  },
  setsRepsItem: {
    flex: 1,
    alignItems: 'center',
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
  tipsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: '5%',
    marginBottom: 18,
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  tipsText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    fontWeight: '500',
  },
  backButton: {
    position: 'absolute',
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
  headerMenuButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },
  workoutOptionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  workoutOptionsSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 34, paddingHorizontal: 20 },
  workoutOptionsHandle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  workoutOptionsItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4, gap: 12 },
  workoutOptionsItemText: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  workoutOptionsItemTextDanger: { color: '#c62828' },
  planWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 50,
    gap: 8,
    position: 'absolute',
    bottom: '5%',
    alignSelf: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  planWorkoutButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  backText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
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
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  noActivitiesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: '5%',
  },
  noActivitiesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  noActivitiesSubtitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 6,
  },
  workoutDetailsContainer: {
    backgroundColor: '#fff',
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  workoutDetailsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
    textAlign: 'center',
  },
  workoutDetailsText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  exerciseDetailsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  exerciseDetailsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  exerciseDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  exerciseDetailItem: {
    flex: 1,
    minWidth: '45%',
  },
  exerciseDetailLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  exerciseDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  editWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  editWorkoutButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  workoutValueText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 4,
  },
  workoutLabelText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    fontWeight: '600',
  },
  daySelectionContainer: {
    marginHorizontal: '5%',
    marginBottom: 10,
    marginTop: 18,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  daySelectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
    textAlign: 'center',
  },
  dayButtonsScrollView: {
    marginTop: 8,
  },
  dayButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    gap: 8,
  },
  dayButton: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonActive: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  dayButtonCompleted: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.3,
  },
  dayButtonTextActive: {
    color: '#fff',
  },
  dayButtonTextCompleted: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  startSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 50,
    gap: 8,
    position: 'absolute',
    bottom: '5%',
    alignSelf: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  startSessionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  completedWorkoutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 50,
    gap: 12,
    position: 'absolute',
    bottom: '5%',
    alignSelf: 'center',

    borderWidth: 2,
    borderColor: '#fff',
  },
  completedWorkoutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  completedWorkoutSubtext: {
    color: '#4CAF50',
    fontSize: 11,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: '5%',
    marginTop: 18,
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#1a1a1a',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: '5%',
    marginBottom: 18,
    borderRadius: 16,
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  infoDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoDetailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoDetailValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  equipmentListContainer: {
    marginTop: 8,
    gap: 10,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    gap: 10,
  },
  equipmentName: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
    flex: 1,
  },
  muscleListContainer: {
    marginTop: 8,
    gap: 10,
  },
  muscleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    gap: 10,
  },
  muscleName: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
    flex: 1,
  },
});

export default WorkoutDetailsScreen;
