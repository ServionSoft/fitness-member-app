import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';
import { fetchMemberWorkoutById, updateMemberWorkout } from '../api/workouts';
import { useQueryClient } from '@tanstack/react-query';
import { workoutKeys } from '../api/queryKeys';
import { getActivityThumbnailUrl } from '../utils/thumbnailUtils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Local defaults — remote /images/* URLs redirect to login and never render
const DEFAULT_WORKOUT_IMAGES = [
  require('../assets/images/workout-1.jpg'),
  require('../assets/images/workout-2.jpg'),
  require('../assets/images/workout_default/workout-3.jpg'),
];

// CRITICAL FIX: Module-level state storage to persist across component remounts
// This ensures state survives when React Navigation remounts the component
let persistentDayActivities = null;

const safeText = (v) => (v === null || v === undefined ? '' : String(v));

const normalizeSelectOptions = (options) => {
  return (options || [])
    .map((o) => {
      if (!o) return null;
      if (typeof o === 'string') return { label: o, value: o };
      if (typeof o === 'object') {
        const label = o.label ?? o.value;
        const value = o.value ?? o.label;
        if (label === undefined || value === undefined) return null;
        return { label: String(label), value };
      }
      return { label: String(o), value: String(o) };
    })
    .filter(Boolean);
};

const DropdownSelect = React.memo(({ label, value, onChange, options, placeholder, disabled = false, allowCustom = true }) => {
  const [open, setOpen] = useState(false);

  const normalized = React.useMemo(() => normalizeSelectOptions(options), [options]);

  const close = () => {
    setOpen(false);
  };

  return (
    <View style={{ marginBottom: 16, zIndex: open ? 1000 : 1 }}>
      {label && (
        <Text style={styles.modalLabel}>{label}</Text>
      )}
      <TouchableOpacity
        style={styles.selectInput}
        onPress={() => {
          if (disabled) return;
          setOpen((p) => !p);
        }}
        activeOpacity={0.85}
      >
        <Text style={[styles.selectText, !value && styles.selectTextPlaceholder]} numberOfLines={1}>
          {safeText(value) || placeholder}
        </Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
      </TouchableOpacity>

      {open && (
        <>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={close}
          />
          <View style={styles.dropdownBox}>
            <ScrollView 
              style={styles.dropdownList} 
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              bounces={false}
            >
              {normalized.map((opt, idx) => {
                const active = safeText(value) === safeText(opt.value);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                    onPress={() => {
                      onChange(opt.value);
                      close();
                    }}
                  >
                    <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
});

const CreateWorkoutScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const editWorkoutId = route.params?.editWorkoutId || null;
  const [loading, setLoading] = useState(false);
  const [loadEditWorkout, setLoadEditWorkout] = useState(!!route.params?.editWorkoutId);
  const [name, setName] = useState('New workout');
  const [desc, setDesc] = useState('Effective workout to help you reach your fitness goals.');
  const [duration, setDuration] = useState('30');
  
  // Track if user has manually edited description and duration
  const [descManuallyEdited, setDescManuallyEdited] = useState(false);
  const [durationManuallyEdited, setDurationManuallyEdited] = useState(false);

  // Helper function to auto-fill description and duration based on workout title
  const autoFillFromTitle = useCallback((title) => {
    if (!title || title.trim() === '' || title === 'New workout') {
      return { description: '', duration: '' };
    }

    const titleLower = title.toLowerCase();
    let suggestedDesc = '';
    let suggestedDuration = '30'; // Default duration

    // Detect workout type from title keywords
    if (titleLower.includes('hiit') || titleLower.includes('high intensity')) {
      suggestedDesc = 'High-intensity interval training workout designed to maximize calorie burn and improve cardiovascular fitness.';
      suggestedDuration = '20';
    } else if (titleLower.includes('cardio') || titleLower.includes('aerobic')) {
      suggestedDesc = 'Cardiovascular workout to improve heart health and endurance.';
      suggestedDuration = '30';
    } else if (titleLower.includes('strength') || titleLower.includes('weight') || titleLower.includes('lifting')) {
      suggestedDesc = 'Strength training workout to build muscle and increase power.';
      suggestedDuration = '45';
    } else if (titleLower.includes('yoga') || titleLower.includes('stretch') || titleLower.includes('flexibility')) {
      suggestedDesc = 'Flexibility and mobility workout to improve range of motion and reduce muscle tension.';
      suggestedDuration = '30';
    } else if (titleLower.includes('pilates') || titleLower.includes('core')) {
      suggestedDesc = 'Core-focused workout to strengthen your midsection and improve stability.';
      suggestedDuration = '30';
    } else if (titleLower.includes('full body') || titleLower.includes('total body')) {
      suggestedDesc = 'Complete full-body workout targeting all major muscle groups.';
      suggestedDuration = '45';
    } else if (titleLower.includes('upper') || titleLower.includes('chest') || titleLower.includes('back') || titleLower.includes('shoulder') || titleLower.includes('arm')) {
      suggestedDesc = 'Upper body workout focusing on chest, back, shoulders, and arms.';
      suggestedDuration = '40';
    } else if (titleLower.includes('lower') || titleLower.includes('leg') || titleLower.includes('glute')) {
      suggestedDesc = 'Lower body workout targeting legs, glutes, and core.';
      suggestedDuration = '40';
    } else if (titleLower.includes('abs') || titleLower.includes('abdominal')) {
      suggestedDesc = 'Core and abdominal workout to strengthen your midsection.';
      suggestedDuration = '20';
    } else if (titleLower.includes('beginner') || titleLower.includes('starter')) {
      suggestedDesc = 'Beginner-friendly workout perfect for those just starting their fitness journey.';
      suggestedDuration = '25';
    } else if (titleLower.includes('advanced') || titleLower.includes('expert')) {
      suggestedDesc = 'Advanced workout designed for experienced fitness enthusiasts.';
      suggestedDuration = '50';
    } else {
      // Generic description based on category
      suggestedDesc = `Effective ${title} workout to help you reach your fitness goals.`;
      suggestedDuration = '30';
    }

    return { description: suggestedDesc, duration: suggestedDuration };
  }, []);

  // Auto-fill description and duration when title changes (only if fields are empty or not manually edited)
  useEffect(() => {
    if (name && name.trim() !== '' && name !== 'New workout') {
      const autoFill = autoFillFromTitle(name);
      
      // Only auto-fill description if it's empty or hasn't been manually edited
      if (!descManuallyEdited && (!desc || desc.trim() === '')) {
        setDesc(autoFill.description);
      }
      
      // Only auto-fill duration if it's empty or hasn't been manually edited
      if (!durationManuallyEdited && (!duration || duration.trim() === '')) {
        setDuration(autoFill.duration);
      }
    }
  }, [name, autoFillFromTitle, descManuallyEdited, durationManuallyEdited, desc, duration]);
  
  const [level, setLevel] = useState('Beginner');
  const [category, setCategory] = useState('Strength');
  const [goal, setGoal] = useState('Lose Weight');
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [selectedThumbnail, setSelectedThumbnail] = useState(DEFAULT_WORKOUT_IMAGES[0]);
  const [thumbnailAsset, setThumbnailAsset] = useState(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });

  // Store activities per day: { 'Monday': [activity1, activity2], ... }
  // CRITICAL: Initialize from persistent storage if available, otherwise use empty state
  const [dayActivities, setDayActivities] = useState(() => {
    // If we have persistent state, use it (survives remounts)
    if (persistentDayActivities) {
      return persistentDayActivities;
    }
    
    // Otherwise, initialize empty
    const initial = {};
    DAYS.forEach(day => {
      initial[day] = [];
    });
    return initial;
  });

  // Ref to track last processed to prevent duplicate processing
  const lastProcessedRef = useRef({ activities: null, day: null });
  
  // CRITICAL FIX: Use ref to store actual state to avoid stale closures
  // This ref will always have the latest committed state
  const dayActivitiesStateRef = useRef(dayActivities);
  
  // Keep ref AND persistent storage synchronized with state - this runs AFTER state updates commit
  useEffect(() => {
    dayActivitiesStateRef.current = dayActivities;
    // CRITICAL: Also update persistent storage to survive remounts
    persistentDayActivities = dayActivities;
  }, [dayActivities]);

  // Restore form data from route params if available
  useEffect(() => {
    if (route.params?.formData) {
      const formData = route.params.formData;
      if (formData.exercise_name) setName(formData.exercise_name);
      if (formData.description) setDesc(formData.description);
      // Keep default description if no description provided
      if (formData.duration) setDuration(formData.duration);
      if (formData.level) setLevel(formData.level);
      if (formData.category) setCategory(formData.category);
      if (formData.thumbnail) {
        if (typeof formData.thumbnail === 'number' || (formData.thumbnail && typeof formData.thumbnail === 'object' && formData.thumbnail.uri === undefined)) {
          setSelectedThumbnail(formData.thumbnail);
        } else if (typeof formData.thumbnail === 'string') {
          setThumbnailAsset({ uri: formData.thumbnail });
        }
      }
    }
  }, [route.params?.formData]);

  // Handle selected activities from SelectActivitiesScreen
  // BEST APPROACH: Use functional update to always get the latest state
  useEffect(() => {
    const selectedActivities = route.params?.selectedActivities;
    const activityDay = route.params?.activityDay;
    
    // Allow empty arrays to clear activities for a day
    if (selectedActivities !== undefined && Array.isArray(selectedActivities) && activityDay) {
      // Create a signature to check if we've already processed this exact update
      const activitiesSignature = JSON.stringify(selectedActivities.map(a => a.exercise_id || a.id).sort());
      
      // Skip if we've already processed this exact combination
      if (
        lastProcessedRef.current.day === activityDay &&
        lastProcessedRef.current.activities === activitiesSignature
      ) {
        return;
      }
      
      // CRITICAL FIX: Read from persistent storage which survives remounts
      // Priority: persistent storage > ref > React state
      const sourceState = persistentDayActivities || dayActivitiesStateRef.current || dayActivities;
      
      // Create a deep copy to avoid reference issues
      const currentState = {};
      DAYS.forEach(day => {
        const dayActivities = sourceState[day];
        if (dayActivities && Array.isArray(dayActivities) && dayActivities.length > 0) {
          currentState[day] = dayActivities.map(activity => ({ ...activity }));
        } else {
          currentState[day] = [];
        }
      });
      
      // Create a completely new object - CRITICAL for React to detect the change
      const newDayActivities = {};
      
      // STEP 1: Copy ALL existing activities for ALL days EXCEPT the one being updated
      // Use the ref state which is guaranteed to be the latest COMMITTED state
      DAYS.forEach(day => {
        if (day !== activityDay) {
          // Get existing activities from ref (latest committed state)
          const existingActivities = currentState[day];
          
          // Deep copy the array to avoid reference issues
          if (existingActivities && Array.isArray(existingActivities) && existingActivities.length > 0) {
            // Make a deep copy of each activity
            newDayActivities[day] = existingActivities.map(activity => ({
              ...activity,
              exercise_id: activity.exercise_id || activity.id,
              id: activity.id || activity.exercise_id,
            }));
          } else {
            // Initialize empty array for days with no activities
            newDayActivities[day] = [];
          }
        }
      });
      
      // STEP 2: Set new activities for the selected day
      newDayActivities[activityDay] = selectedActivities.map(activity => ({
        ...activity,
        exercise_id: activity.exercise_id || activity.id,
        id: activity.id || activity.exercise_id,
      }));
      
      // Update React state - the ref will be updated by the useEffect after this commits
      setDayActivities(newDayActivities);
      
      // Restore the selectedDay AFTER state update completes
      if (DAYS.includes(activityDay)) {
        setSelectedDay(activityDay);
      }
      
      // Mark as processed
      lastProcessedRef.current = {
        day: activityDay,
        activities: activitiesSignature,
      };
      
      // Clear the params to prevent re-processing
      navigation.setParams({ selectedActivities: undefined, activityDay: undefined });
      
      // Reset the ref after a delay so new selections can be processed
      setTimeout(() => {
        lastProcessedRef.current = { activities: null, day: null };
      }, 1000);
    } else {
      // Reset ref when params are undefined
      lastProcessedRef.current = { activities: null, day: null };
    }
  }, [route.params?.selectedActivities, route.params?.activityDay, navigation]);

  // Load workout for edit mode
  useEffect(() => {
    if (!editWorkoutId || !loadEditWorkout) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchMemberWorkoutById(editWorkoutId);
        if (cancelled) return;
        const w = data.workout || data;
        setName(w.exercise_name || w.name || 'New workout');
        setDesc(w.description || '');
        setDuration(String(w.duration || '30').replace(/\s*min.*$/i, '').trim() || '30');
        setLevel(w.level || 'Beginner');
        setCategory(w.category || 'Strength');
        if (w.thumbnail) {
          const url = w.thumbnail.startsWith('http') ? w.thumbnail : (ENV_API_BASE_URL || '').replace(/\/api\/?$/, '') + (w.thumbnail.startsWith('/') ? '' : '/') + w.thumbnail;
          setSelectedThumbnail(url);
          setThumbnailAsset(null);
        }
        const days = w.workout_days || w.days || [];
        const nextDayActivities = {};
        DAYS.forEach(d => { nextDayActivities[d] = []; });
        days.forEach(dayObj => {
          const dayName = dayObj.day || dayObj.day_name;
          if (!dayName || !DAYS.includes(dayName)) return;
          const plans = dayObj.workout_activity_plans || dayObj.activities || [];
          nextDayActivities[dayName] = plans.map(a => ({
            exercise_id: a.exercise_id || a.exercise?.id,
            id: a.exercise_id || a.exercise?.id,
            sets: a.sets ?? 3,
            reps: a.reps ?? 12,
            rest_seconds: a.rest_seconds ?? a.rest_period ?? 60,
            rest_period: a.rest_seconds ?? a.rest_period ?? 60,
            name: a.exercise_name || a.exercise?.name,
            thumbnail: a.thumbnail || a.exercise?.thumbnail_url || a.thumbnail_url,
          })).filter(a => a.exercise_id);
        });
        setDayActivities(nextDayActivities);
        persistentDayActivities = nextDayActivities;
        dayActivitiesStateRef.current = nextDayActivities;
      } catch (err) {
        if (!cancelled) {
          setAlertConfig({
            title: 'Error',
            message: err.message || 'Failed to load workout',
            type: 'error',
            buttons: [{ text: 'OK', onPress: () => setAlertVisible(false) }],
          });
          setAlertVisible(true);
        }
      } finally {
        if (!cancelled) setLoadEditWorkout(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [editWorkoutId, loadEditWorkout]);

  // Helper function to reset form and clear persistent state
  const resetForm = () => {
    // Clear persistent state
    persistentDayActivities = null;
    
    // Reset form fields
    setName('New workout');
    setDesc('');
    setDuration('');
    setLevel('Beginner');
    setCategory('Strength');
    setGoal('Lose Weight');
    setSelectedDay(DAYS[0]);
    setSelectedThumbnail(DEFAULT_WORKOUT_IMAGES[0]);
    setThumbnailAsset(null);
    
    // Reset day activities
    const emptyActivities = {};
    DAYS.forEach(day => {
      emptyActivities[day] = [];
    });
    setDayActivities(emptyActivities);
  };

  // Helper function to show modern alert
  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  const pickThumbnailFromGallery = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1000,
      maxHeight: 1000,
    };

    launchImageLibrary(options, (response) => {
      if (response.assets && response.assets[0]) {
        setThumbnailAsset({ uri: response.assets[0].uri });
        setSelectedThumbnail(null);
      }
    });
  };

  const clearThumbnail = () => {
    setThumbnailAsset(null);
    setSelectedThumbnail(DEFAULT_WORKOUT_IMAGES[0]);
  };

  const getImageInfo = (uri) => {
    if (!uri) return null;
    
    try {
      // Handle local asset URIs (may contain file:// or be a path)
      let fileName = 'workout_thumbnail.jpg';
      if (uri.includes('/')) {
        fileName = uri.split('/').pop() || 'workout_thumbnail.jpg';
      }
      
      // Remove query parameters if any
      fileName = fileName.split('?')[0];
      
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      
      return {
        fileName: fileName || 'workout_thumbnail.jpg',
        fileExtension,
        mimeType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
      };
    } catch (error) {
      return {
        fileName: 'workout_thumbnail.jpg',
        fileExtension: 'jpg',
        mimeType: 'image/jpeg',
      };
    }
  };

  const toPublicAssetUrl = (rawPath) => {
    const p = safeText(rawPath).trim();
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    const baseUrl = safeText(ENV_API_BASE_URL).replace(/\/api\/?$/i, '');
    if (!baseUrl) return null;
    if (p.startsWith('/')) return `${baseUrl}${p}`;
    return `${baseUrl}/${p}`;
  };

  // Helper function to extract thumbnail filename and construct proper URL
  const getThumbnailUrl = (activity) => getActivityThumbnailUrl(activity);

  const validateForm = () => {
    const workoutName = safeText(name).trim();
    if (!workoutName) {
      showAlert('Error', 'Please enter a workout name', 'error', [
        { text: 'OK', onPress: () => {}, style: 'primary' }
      ]);
      return false;
    }
    
    const safeDuration = safeText(duration).trim() || '30';
    if (!safeDuration || parseInt(safeDuration) <= 0) {
      showAlert('Error', 'Please enter a valid duration', 'error', [
        { text: 'OK', onPress: () => {}, style: 'primary' }
      ]);
      return false;
    }

    // Check if at least one day has activities
    const hasActivities = DAYS.some(day => (dayActivities[day] || []).length > 0);
    if (!hasActivities) {
      showAlert('Error', 'Please add at least one activity', 'error', [
        { text: 'OK', onPress: () => {}, style: 'primary' }
      ]);
      return false;
    }

    return true;
  };

  const handleCreateWorkout = async () => {
    if (!validateForm()) return;
  
    setLoading(true);
  
    try {
      // ========================
      // AUTH
      // ========================
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        showAlert('Error', 'Authentication required', 'error', [{ text: 'OK' }]);
        return;
      }
  
      const authHeader = token.startsWith('Bearer ')
        ? token
        : `Bearer ${token}`;
  
      const API_BASE_URL = 'https://phpstack-1542257-6177868.cloudwaysapps.com/api';
  
      // ========================
      // BASE DATA
      // ========================
      const workoutName = safeText(name).trim();
      const workoutDesc = safeText(desc).trim();
      const safeDuration = safeText(duration).trim() || '30';
      const safeCategory = safeText(category).trim() || 'Strength';
      const safeLevel = safeText(level).trim() || 'Beginner';
  
      // ========================
      // BUILD DAYS
      // ========================
      const workoutDays = [];
  
      DAYS.forEach(day => {
        const activities = dayActivities[day] || [];
        if (!activities.length) return;
  
        const valid = activities
          .map(a => ({
            exercise_id: a.exercise_id || a.id,
            sets: a.sets || 3,
            reps: a.reps || 12,
            rest_seconds: a.rest_seconds || a.rest_period || 60,
          }))
          .filter(a => a.exercise_id);
  
        if (valid.length) {
          workoutDays.push({ day, activities: valid });
        }
      });
  
      // ========================
      // THUMBNAIL HANDLING ⭐
      // ========================
      let uploadImageUri = null;
      let thumbnailUrl = '';

      // Priority 1: User uploaded image from gallery (always use FormData)
      if (thumbnailAsset?.uri) {
        const uri = thumbnailAsset.uri;
        
        // If it's NOT an HTTP/HTTPS URL, it's a local file - use FormData
        if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
          uploadImageUri = uri;
        } else {
          // It's a URL, pass as thumbnail_url
          thumbnailUrl = uri;
        }
      }

      // Priority 2: Default thumbnail selected (URL string or local require asset)
      if (!uploadImageUri && !thumbnailUrl && selectedThumbnail != null) {
        if (typeof selectedThumbnail === 'string') {
          thumbnailUrl = selectedThumbnail;
        } else if (typeof selectedThumbnail === 'number') {
          const resolved = Image.resolveAssetSource(selectedThumbnail);
          if (resolved?.uri) {
            uploadImageUri = resolved.uri;
          }
        }
      }
  
      // ========================
      // REQUEST
      // ========================
      let body;
      let headers = {
        Authorization: authHeader,
        Accept: 'application/json',
      };
  
      if (uploadImageUri) {
        // -------- FormData --------
        const formData = new FormData();
  
        formData.append('exercise_name', workoutName);
        formData.append('description', workoutDesc);
        formData.append('duration', safeDuration);
        formData.append('level', safeLevel);
        formData.append('category', safeCategory);
  
        workoutDays.forEach((d, di) => {
          formData.append(`workout_days[${di}][day]`, d.day);
          d.activities.forEach((a, ai) => {
            formData.append(`workout_days[${di}][activities][${ai}][exercise_id]`, a.exercise_id);
            formData.append(`workout_days[${di}][activities][${ai}][sets]`, a.sets);
            formData.append(`workout_days[${di}][activities][${ai}][reps]`, a.reps);
            formData.append(`workout_days[${di}][activities][${ai}][rest_seconds]`, a.rest_seconds);
          });
        });
  
        const img = getImageInfo(uploadImageUri);
        formData.append('thumbnail', {
          uri: uploadImageUri,
          type: img?.mimeType || 'image/jpeg',
          name: img?.fileName || 'thumbnail.jpg',
        });
  
        body = formData;
      } else {
        // -------- JSON (thumbnail) ⭐
        body = JSON.stringify({
          exercise_name: workoutName,
          description: workoutDesc,
          duration: safeDuration,
          level: safeLevel,
          category: safeCategory,
          workout_days: workoutDays,
          thumbnail: thumbnailUrl || '', // ⭐ Changed to match backend expectation
        });
  
        headers['Content-Type'] = 'application/json';
      }
  
      const isEdit = !!editWorkoutId;
      if (isEdit) {
        const payload = {
          exercise_name: workoutName,
          description: workoutDesc,
          duration: safeDuration,
          level: safeLevel,
          category: safeCategory,
          workout_days: workoutDays,
          thumbnail: thumbnailUrl || '',
        };
        const data = await updateMemberWorkout(editWorkoutId, payload);
        if (!data.success) throw new Error(data.message || 'Failed to update workout');
        queryClient.invalidateQueries({ queryKey: workoutKeys.myWorkouts() });
        resetForm();
        showAlert('Success', 'Workout updated successfully!', 'success', [
          { text: 'OK', onPress: () => navigation.replace('WorkoutScreen') }
        ]);
      } else {
        const response = await fetch(`${API_BASE_URL}/mobile/workouts`, {
          method: 'POST',
          headers,
          body,
        });
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to create workout');
        }
        resetForm();
        showAlert('Success', 'Workout created successfully!', 'success', [
          { text: 'OK', onPress: () => navigation.replace('WorkoutScreen') }
        ]);
      }
  
    } catch (err) {
      showAlert('Error', err.message || 'Network error', 'error', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };
  
  

  const handleCreateWorkout2 = async () => {
    if (!validateForm()) return;
  
    setLoading(true);
  
    try {
      // ========================
      // AUTH
      // ========================
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        showAlert('Error', 'Authentication required', 'error', [
          { text: 'OK', style: 'primary' }
        ]);
        return;
      }
  
      const authHeader = userToken.startsWith('Bearer ')
        ? userToken
        : `Bearer ${userToken}`;
  
      // ========================
      // BASE DATA
      // ========================
      const API_BASE_URL = 'https://phpstack-1542257-6177868.cloudwaysapps.com/api';
  
      const workoutName = safeText(name).trim();
      const workoutDesc = safeText(desc).trim();
      const safeDuration = safeText(duration).trim() || '30';
      const safeCategory = safeText(category).trim() || 'Strength';
      const safeLevel = safeText(level).trim() || 'Beginner';
  
      // ========================
      // BUILD WORKOUT DAYS (SAFE)
      // ========================
      const workoutDays = [];
  
      DAYS.forEach(day => {
        const activities = dayActivities[day] || [];
        if (!activities.length) return;
  
        const validActivities = activities
          .map(a => ({
            exercise_id: a.exercise_id || a.id,
            sets: a.sets || 3,
            reps: a.reps || 12,
            rest_seconds: a.rest_seconds || a.rest_period || 60,
          }))
          .filter(a => a.exercise_id);
  
        if (validActivities.length) {
          workoutDays.push({ day, activities: validActivities });
        }
      });
  
      if (!workoutDays.length) {
        showAlert('Error', 'Please add at least one workout day.', 'error', [
          { text: 'OK', style: 'primary' }
        ]);
        return;
      }
  
      // ========================
      // THUMBNAIL (PRODUCTION SAFE)
      // ========================
      let finalThumbnail = thumbnailAsset?.uri || null;
      if (!finalThumbnail && typeof selectedThumbnail === 'number') {
        finalThumbnail = Image.resolveAssetSource(selectedThumbnail)?.uri || null;
      } else if (!finalThumbnail && typeof selectedThumbnail === 'string') {
        finalThumbnail = selectedThumbnail;
      }

      const canUploadImage =
        typeof finalThumbnail === 'string' &&
        (finalThumbnail.startsWith('file://') ||
          finalThumbnail.startsWith('content://') ||
          finalThumbnail.startsWith('http://localhost') ||
          finalThumbnail.startsWith('http://127.0.0.1') ||
          finalThumbnail.includes('/assets/'));

      if (!canUploadImage) {
        finalThumbnail = null; // force JSON request
      }
  
      // ========================
      // REQUEST BUILD
      // ========================
      let body;
      let headers = {
        Authorization: authHeader,
        Accept: 'application/json',
      };
  
      if (finalThumbnail) {
        // ---------- FORMDATA ----------
        const formData = new FormData();
  
        formData.append('exercise_name', workoutName);
        formData.append('description', workoutDesc);
        formData.append('duration', safeDuration);
        formData.append('level', safeLevel);
        formData.append('category', safeCategory);
  
        workoutDays.forEach((dayData, di) => {
          formData.append(`workout_days[${di}][day]`, dayData.day);
          dayData.activities.forEach((act, ai) => {
            formData.append(`workout_days[${di}][activities][${ai}][exercise_id]`, act.exercise_id);
            formData.append(`workout_days[${di}][activities][${ai}][sets]`, act.sets);
            formData.append(`workout_days[${di}][activities][${ai}][reps]`, act.reps);
            formData.append(`workout_days[${di}][activities][${ai}][rest_seconds]`, act.rest_seconds);
          });
        });
  
        const imageInfo = getImageInfo(finalThumbnail);
  
        formData.append('thumbnail', {
          uri: finalThumbnail,
          type: imageInfo?.mimeType || 'image/jpeg',
          name: imageInfo?.fileName || 'thumbnail.jpg',
        });
  
        body = formData;
      } else {
        // ---------- JSON ----------
        body = JSON.stringify({
          exercise_name: workoutName,
          description: workoutDesc,
          duration: safeDuration,
          level: safeLevel,
          category: safeCategory,
          workout_days: workoutDays,
        });
  
        headers['Content-Type'] = 'application/json';
      }
  
      // ========================
      // REQUEST
      // ========================
      const response = await fetch(`${API_BASE_URL}/mobile/workouts`, {
        method: 'POST',
        headers,
        body,
      });
  
      const responseText = await response.text();
      let data;
  
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error('Invalid JSON response from server');
      }
  
      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message || `Server error (${response.status})`
        );
      }
  
      // ========================
      // SUCCESS
      // ========================
      resetForm();
  
      showAlert('Success', 'Workout created successfully!', 'success', [
        {
          text: 'OK',
          style: 'primary',
          onPress: () => navigation.replace('WorkoutScreen'),
        }
      ]);
  
    } catch (error) {
      showAlert(
        'Error',
        error.message || 'Network error occurred',
        'error',
        [{ text: 'OK', style: 'primary' }]
      );
    } finally {
      setLoading(false);
    }
  };
  

  const handleCreateWorkout1 = async () => {
    if (!validateForm()) return;
  
    try {
      setLoading(true);
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        showAlert('Error', 'Authentication required', 'error', [
          { text: 'OK', onPress: () => {}, style: 'primary' }
        ]);
        setLoading(false);
        return;
      }
  
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }
  
      const API_BASE_URL = 'https://phpstack-1542257-6177868.cloudwaysapps.com/api'; //ENV_API_BASE_URL;
      const workoutName = safeText(name).trim();
      const workoutDesc = safeText(desc).trim();
      const safeDuration = safeText(duration).trim() || '30';
      const safeCategory = safeText(category).trim() || 'Strength';
      const safeLevel = safeText(level).trim() || 'Beginner';

      // Build workout_days array from dayActivities
      // CRITICAL: Ensure each day has its own separate activities array
      const workoutDays = [];
      const processedDays = new Set(); // Track processed days to prevent duplicates
      
      DAYS.forEach(day => {
        // Skip if day already processed (safety check)
        if (processedDays.has(day)) {
          return;
        }
        
        const activities = dayActivities[day] || [];
        if (activities.length > 0) {
          // CRITICAL: Create a new array for this day's activities to prevent reference issues
          const dayActivitiesArray = activities.map(activity => ({
            exercise_id: activity.exercise_id || activity.id,
            sets: activity.sets || 3,
            reps: activity.reps || 12,
            rest_seconds: activity.rest_seconds || activity.rest_period || 60,
          }));
          
          // Validate that we have valid activities
          const validActivities = dayActivitiesArray.filter(a => a.exercise_id);
          if (validActivities.length === 0) {
            return;
          }
          
          workoutDays.push({
            day: day, // Explicitly set day name
            activities: validActivities, // Use only valid activities
          });
          
          processedDays.add(day); // Mark as processed
        }
      });
      
      // Final validation: Ensure no duplicate days
      const dayNames = workoutDays.map(wd => wd.day);
      const uniqueDays = new Set(dayNames);
      if (dayNames.length !== uniqueDays.size) {
        showAlert('Error', 'Duplicate days detected. Please check your workout configuration.', 'error', [
          { text: 'OK', onPress: () => {}, style: 'primary' }
        ]);
        setLoading(false);
        return;
      }

      // Use JSON for all requests (no thumbnail image)
      const workoutData = {
        exercise_name: workoutName,
        description: workoutDesc,
        duration: safeDuration,
        level: safeLevel,
        category: safeCategory,
        thumbnail: '', // Blank thumbnail variable
        workout_days: workoutDays,
      };

      const requestBody = JSON.stringify(workoutData);
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader,
      };

      const response = await fetch(`${API_BASE_URL}/mobile/workouts`, {
        method: 'POST',
        headers: headers,
        body: requestBody,
      });
  
      // Check response status first before parsing JSON
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to create workout';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || 
                        (errorData.errors ? Object.entries(errorData.errors)
                          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
                          .join('\n') : null) ||
                        errorData.detail ||
                        `Server error: ${response.status}`;
        } catch (parseError) {
          // If response is not JSON, use status text
          errorMessage = `Server error: ${response.status} ${response.statusText || 'Unknown error'}`;
        }
        
        showAlert('Error', errorMessage, 'error', [
          { text: 'OK', onPress: () => {}, style: 'primary' }
        ]);
        return;
      }

      // Parse response JSON only if response is ok
      const data = await response.json();

      if (data.success) {
        // Reset form and clear persistent state after successful creation
        resetForm();
        
        showAlert('Success', 'Workout created successfully!', 'success', [
          {
            text: 'OK',
            onPress: () => {
              // Replace current screen with WorkoutScreen to prevent back navigation to filled form
              // This removes CreateWorkoutScreen from the stack, so back button goes to previous screen
              navigation.replace('WorkoutScreen');
            },
            style: 'primary'
          }
        ]);
      } else {
        // Handle case where response is ok but success is false
        const errorMessage = data.message || 
                            (data.errors ? Object.entries(data.errors)
                              .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
                              .join('\n') : null) ||
                            data.detail ||
                            'Failed to create workout';
        
        showAlert('Error', errorMessage, 'error', [
          { text: 'OK', onPress: () => {}, style: 'primary' }
        ]);
      }
    } catch (error) {
      // More descriptive error message
      let errorMessage = 'Network error occurred. Please check your internet connection and try again.';
      
      if (error.message) {
        if (error.message.includes('Network request failed') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Unable to connect to server. Please check your internet connection and try again.';
        } else if (error.message.includes('JSON')) {
          errorMessage = 'Invalid response from server. Please try again.';
        } else {
          errorMessage = `Network error: ${error.message}`;
        }
      }
      
      showAlert('Error', errorMessage, 'error', [
        { text: 'OK', onPress: () => {}, style: 'primary' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Custom Header matching HeaderBar style */}
      <View style={[styles.headerFixed, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            // Reset form when going back to prevent filled form on return
            resetForm();
            
            // Check navigation state to determine where to navigate
            const state = navigation.getState();
            const currentRouteIndex = state.index;
            
            // Check if previous route in history is SelectActivitiesScreen
            // If so, navigate to WorkoutScreen instead to skip SelectActivitiesScreen
            if (currentRouteIndex > 0) {
              const previousRoute = state.routes[currentRouteIndex - 1];
              if (previousRoute?.name === 'SelectActivities') {
                // Navigate directly to WorkoutScreen instead of going back to SelectActivitiesScreen
                navigation.navigate('WorkoutScreen');
                return;
              }
            }
            
            // Check if we can go back and if the route before that is WorkoutScreen
            // This handles the case where SelectActivitiesScreen used merge: true
            if (currentRouteIndex > 1) {
              const routeBeforePrevious = state.routes[currentRouteIndex - 2];
              if (routeBeforePrevious?.name === 'WorkoutScreen') {
                // Navigate directly to WorkoutScreen, skipping SelectActivitiesScreen
                navigation.navigate('WorkoutScreen');
                return;
              }
            }
            
            // Otherwise, go back normally
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              // Fallback: navigate to WorkoutScreen if we can't go back
              navigation.navigate('WorkoutScreen');
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#6b6b6b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editWorkoutId ? 'Edit Workout' : 'Create Workout'}</Text>
        <TouchableOpacity 
          onPress={handleCreateWorkout} 
          style={[styles.saveButtonHeader, loading && styles.saveButtonDisabled]}
          disabled={loading}
        >
          <Text style={styles.saveButtonHeaderText}>{loading ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >

          {/* Image Selection Section */}
          <View style={styles.imageSectionContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.defaultImagesContainer}
              contentContainerStyle={styles.defaultImagesContent}
            >
              {DEFAULT_WORKOUT_IMAGES.map((imageSource, index) => {
                const isLocalAsset = typeof imageSource === 'number' || (imageSource && typeof imageSource === 'object' && imageSource.uri === undefined);
                const isSelected = selectedThumbnail === imageSource && !thumbnailAsset;

                return (
                  <TouchableOpacity
                    key={`workout-image-${index}`}
                    style={[styles.defaultImageCard, isSelected && styles.defaultImageCardSelected]}
                    onPress={() => {
                      setSelectedThumbnail(imageSource);
                      setThumbnailAsset(null);
                    }}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    {isLocalAsset ? (
                      <Image 
                        source={imageSource}
                        style={styles.defaultImage} 
                        resizeMode="cover"
                      />
                    ) : (
                      <Image 
                        source={{ uri: imageSource }}
                        style={styles.defaultImage} 
                        resizeMode="cover"
                      />
                    )}
                    {isSelected && (
                      <View style={styles.selectedImageOverlay}>
                        <MaterialCommunityIcons name="check-circle" size={24} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Gallery Image Option */}
          <TouchableOpacity style={styles.galleryButton} onPress={pickThumbnailFromGallery} disabled={loading}>
            <MaterialCommunityIcons name="image-plus" size={18} color="#222" />
            <Text style={styles.galleryButtonText}>Choose from gallery</Text>
          </TouchableOpacity>
          {thumbnailAsset?.uri && (
            <View style={styles.selectedGalleryImage}>
              <Image source={{ uri: thumbnailAsset.uri }} style={styles.galleryImagePreview} />
              <TouchableOpacity style={styles.removeGalleryImage} onPress={clearThumbnail} disabled={loading}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#F44336" />
              </TouchableOpacity>
            </View>
          )}

          <TextInput
            style={styles.modalInput}
            placeholder="Name (e.g. Strength A)"
            placeholderTextColor="#bbb"
            value={name}
            onChangeText={(text) => {
              setName(text);
              // Reset manual edit flags when title changes significantly
              if (!text || text.trim() === '' || text === 'New workout') {
                setDescManuallyEdited(false);
                setDurationManuallyEdited(false);
              }
            }}
            editable={!loading}
            returnKeyType="next"
            blurOnSubmit={false}
            onBlur={() => Keyboard.dismiss()}
          />

          <View style={styles.descriptionContainer}>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="Description (optional) - Short notes for this plan..."
              placeholderTextColor="#bbb"
              value={desc}
              onChangeText={(text) => {
                setDesc(text);
                setDescManuallyEdited(true); // Mark as manually edited
              }}
              editable={!loading}
              multiline
              maxLength={500}
              blurOnSubmit={false}
              onBlur={() => Keyboard.dismiss()}
            />
            <Text style={styles.characterCount}>
              {desc.length}/500
            </Text>
          </View>

          <DropdownSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={['General', 'Strength', 'Cardio', 'Flexibility', 'Balance', 'Endurance', 'Core', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Chest']}
            placeholder="Category"
            disabled={loading}
            allowCustom
          />

          <TextInput
            style={styles.modalInput}
            placeholder="Duration (minutes)"
            placeholderTextColor="#bbb"
            value={duration}
            onChangeText={(text) => {
              setDuration(text);
              setDurationManuallyEdited(true); // Mark as manually edited
            }}
            editable={!loading}
            keyboardType="number-pad"
            onBlur={() => Keyboard.dismiss()}
          />

          <DropdownSelect
            label="Level"
            value={level}
            onChange={setLevel}
            options={['Novice', 'Beginner', 'Intermediate', 'Advanced', 'Expert']}
            placeholder="Level"
            disabled={loading}
            allowCustom
          />

          <DropdownSelect
            label="Goal"
            value={goal}
            onChange={setGoal}
            options={['Lose Weight', 'Build Muscle', 'Get Fit', 'Improve Performance', 'Shape and Tone', 'Increase Flexibility', 'Rehabilitation', 'General Fitness']}
            placeholder="Goal"
            disabled={loading}
            allowCustom
          />

          {/* Day Selection */}
          <View style={{ marginTop: 16 }}>
            <Text style={styles.modalLabel}>Select Day</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.daysContainer}
              contentContainerStyle={styles.daysContent}
            >
              {DAYS.map((day) => {
                const isSelected = selectedDay === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                    onPress={() => setSelectedDay(day)}
                    disabled={loading}
                  >
                    <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                      {day.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Add Activity Button */}
          <TouchableOpacity
            style={styles.addActivityButton}
            onPress={() => {
              // Create a copy of activities for the selected day to avoid reference issues
              const currentDayActivities = dayActivities[selectedDay] || [];
              const activitiesCopy = currentDayActivities.map(activity => ({ ...activity }));
              
              navigation.navigate('SelectActivities', { 
                selectedActivities: activitiesCopy,
                selectedDays: [selectedDay], // Keep for SelectActivitiesScreen compatibility
                activityDay: selectedDay, // Pass single day for CreateWorkoutScreen
                formData: {
                  exercise_name: name,
                  description: desc,
                  duration: duration,
                  level: level,
                  category: category,
                  thumbnail: thumbnailAsset?.uri || selectedThumbnail,
                },
                // Removed onReturn callback - not serializable and not needed
                // Activities are handled via route params in useEffect
              });
            }}
            disabled={loading}
          >
            <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" />
            <Text style={styles.addActivityButtonText}>Add activity</Text>
          </TouchableOpacity>

          {/* Display Selected Activities for Currently Selected Day Only */}
          {(() => {
            const activities = dayActivities[selectedDay] || [];
            if (activities.length === 0) return null;
            
            return (
              <View key={selectedDay} style={styles.dayActivitiesContainer}>
                <Text style={styles.dayActivitiesTitle}>{selectedDay}</Text>
                {activities.map((activity, index) => (
                  <View key={index} style={styles.activityItem}>
                    <View style={styles.activityItemContent}>
                      {(() => {
                        const thumbnailUrl = getThumbnailUrl(activity);
                        return thumbnailUrl ? (
                          <Image 
                            source={{ uri: thumbnailUrl }} 
                            style={styles.activityThumbnail}
                          />
                        ) : (
                          <View style={[styles.activityThumbnail, styles.activityThumbnailPlaceholder]}>
                            <MaterialCommunityIcons name="dumbbell" size={20} color="#888" />
                          </View>
                        );
                      })()}
                      <View style={styles.activityItemInfo}>
                        <Text style={styles.activityItemName} numberOfLines={1}>
                          {activity.exercise_name || activity.name || 'Activity'}
                        </Text>
                        <Text style={styles.activityItemDetails}>
                          {activity.sets || 3} sets × {activity.reps || 10} reps
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        // Use functional update to ensure we have latest state
                        setDayActivities(prev => {
                          const currentDayActivities = prev[selectedDay] || [];
                          return {
                            ...prev,
                            [selectedDay]: currentDayActivities.filter((_, i) => i !== index)
                          };
                        });
                      }}
                      style={styles.removeActivityButton}
                    >
                      <MaterialCommunityIcons name="close-circle" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })()}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      
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
    backgroundColor: '#fafaf8',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 70,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
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
  backButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#eceee7',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
    textAlign: 'center',
  },
  saveButtonHeader: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonHeaderText: {
    color: '#222',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  imageSectionContainer: {
    marginBottom: 16,
    marginTop: 0,
    paddingTop: 0,
  },
  defaultImagesContainer: {
    marginTop: 8,
    minHeight: 150,
  },
  defaultImagesContent: {
    paddingRight: 16,
    gap: 12,
    paddingVertical: 4,
    paddingLeft: 0,
  },
  defaultImageCard: {
    width: 150,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginRight: 12,
  },
  defaultImageCardSelected: {
    borderColor: '#222',
    borderWidth: 3,
  },
  defaultImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: '#f0f0f0',
  },
  selectedImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  galleryButtonText: {
    color: '#222',
    fontSize: 15,
    fontWeight: '600',
  },
  selectedGalleryImage: {
    position: 'relative',
    marginBottom: 12,
  },
  galleryImagePreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  removeGalleryImage: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    fontWeight: '500',
  },
  modalTextarea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingRight: 60,
  },
  descriptionContainer: {
    position: 'relative',
  },
  characterCount: {
    position: 'absolute',
    top: 8,
    right: 12,
    fontSize: 12,
    color: '#888',
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  selectInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectText: {
    flex: 1,
    color: '#222',
    fontSize: 15,
    fontWeight: '500',
  },
  selectTextPlaceholder: {
    color: '#bbb',
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 998,
  },
  dropdownBox: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    zIndex: 999,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownList: {
    maxHeight: 180,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemActive: {
    backgroundColor: '#22215',
  },
  dropdownItemText: {
    color: '#222',
    fontSize: 15,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#222',
    fontWeight: '700',
  },
  daysContainer: {
    marginBottom: 16,
    maxHeight: 50,
  },
  daysContent: {
    paddingRight: 16,
    gap: 2,
    paddingVertical: 4,
  },
  dayChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  dayChipSelected: {
    backgroundColor: '#22215',
    borderColor: '#222',
    borderWidth: 2,
  },
  dayChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  dayChipTextSelected: {
    color: '#222',
    fontWeight: '700',
  },
  addActivityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#222',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addActivityButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  dayActivitiesContainer: {
    marginTop: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dayActivitiesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 8,
    backgroundColor: '#fafaf8',
    borderRadius: 12,
  },
  activityItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  activityThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  activityThumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0e0e0',
  },
  activityItemInfo: {
    flex: 1,
  },
  activityItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  activityItemDetails: {
    fontSize: 14,
    color: '#888',
  },
  removeActivityButton: {
    padding: 4,
  },
});

export default CreateWorkoutScreen;
