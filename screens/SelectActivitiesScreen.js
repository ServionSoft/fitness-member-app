import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { API_BASE_URL as CONFIG_API_BASE_URL } from '../utils/apiConfig';
import { format } from 'date-fns';
import { getActivityThumbnailUrl } from '../utils/thumbnailUtils';

const ActivityThumbnail = ({ uri }) => {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={styles.thumbnailPlaceholder}>
        <MaterialCommunityIcons name="dumbbell" size={24} color="#ccc" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.thumbnail}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
};

const SelectActivitiesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { selectedActivities, formData, selectedDays, source, existingActivities, dayName, selectedDate } = route.params || {};
  
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState('');
  const [existingDayActivities, setExistingDayActivities] = useState([]); // Store existing activities for the date
  // For addToDayActivity: pre-select existing activities to show what's already added
  // For activityCalendar: also pre-select existing activities
  const [selectedActivitiesList, setSelectedActivitiesList] = useState(() => {
    if (source === 'addToDayActivity' && existingActivities && existingActivities.length > 0) {
      // Pre-select existing activities
      return existingActivities.map(activity => ({
        ...activity,
        exercise_id: activity.exercise_id || activity.id || activity.activity_id,
      }));
    }
    return selectedActivities || [];
  });
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilterType, setActiveFilterType] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({
    categories: [],
    muscles: [],
    equipment: [],
    levels: [],
  });
  const [paginationState, setPaginationState] = useState(null); // { currentPage, lastPage, total }
  const [loadingMore, setLoadingMore] = useState(false);
  // Saved muscle options so the muscle filter modal always shows all options (even when API returns only one muscle group)
  const [savedMuscleOptions, setSavedMuscleOptions] = useState([]);

  const API_BASE_URL = CONFIG_API_BASE_URL || ENV_API_BASE_URL;

  const normalizeActivityItem = (activity) => {
    if (!activity || typeof activity !== 'object') return activity;
    const nestedThumb =
      activity.thumbnail_url ||
      activity.thumbnail ||
      activity.exercise?.thumbnail_url ||
      activity.exercise?.thumbnail ||
      activity.exercise_details?.thumbnail_url ||
      activity.exercise_details?.thumbnail ||
      null;
    return {
      ...activity,
      thumbnail_url: activity.thumbnail_url || nestedThumb,
      thumbnail: activity.thumbnail || nestedThumb,
    };
  };

  // Static level options so the level filter modal always shows all options (even when API returns only one level)
  const LEVEL_FILTER_OPTIONS = ['Beginner', 'Intermediate'];

  // Same category options as CreateWorkoutScreen category field
  const CATEGORY_FILTER_OPTIONS = [
    'General', 'Strength', 'Cardio', 'Flexibility', 'Balance', 'Endurance',
    'Core', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Chest',
  ];

  const FILTER_CHIPS = ['All Category', 'All Muscles', 'All Equipment', 'All Level'];

  // Helper function to convert text to Title Case (Pascal Case)
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

  const getActivityCategoryValues = (activity) => {
    const category = activity.category;
    if (!category) return [];

    if (Array.isArray(category)) {
      return category
        .map(cat => (typeof cat === 'string' ? cat.trim() : String(cat).trim()))
        .filter(Boolean);
    }

    if (typeof category === 'string') {
      return category.split(',').map(cat => cat.trim()).filter(Boolean);
    }

    if (category && typeof category === 'object') {
      const categoryName = category.name || category.category || String(category);
      return categoryName ? [String(categoryName).trim()] : [];
    }

    return [];
  };

  // Helper — same behavior as WorkoutDetailsScreen
  const getThumbnailUrl = (activity) => getActivityThumbnailUrl(activity);

  // Fetch existing day activities when source is activityCalendar
  const fetchExistingDayActivities = async () => {
    if (source !== 'activityCalendar' || !selectedDate) {
      return;
    }

    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Get day name from selected date
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      let targetDate = selectedDate;
      if (typeof targetDate === 'string') {
        targetDate = new Date(targetDate);
      }
      const dayName = days[targetDate.getDay()];
      const dateStr = format(targetDate, 'yyyy-MM-dd');

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
        if (result.success && result.data && result.data.activities) {
          const existing = result.data.activities || [];
          setExistingDayActivities(existing);
          
          // Pre-select existing activities in selectedActivitiesList
          const existingIds = new Set(existing.map(a => a.exercise_id || a.id));
          const currentSelectedIds = new Set(selectedActivitiesList.map(a => a.exercise_id || a.id));
          
          // Merge existing activities with currently selected (avoid duplicates)
          const merged = [...selectedActivitiesList];
          existing.forEach(activity => {
            const id = activity.exercise_id || activity.id;
            if (id && !currentSelectedIds.has(id)) {
              merged.push({
                ...activity,
                exercise_id: activity.exercise_id || activity.id,
              });
            }
          });
          
          setSelectedActivitiesList(merged);
        }
      }
    } catch (error) {
      // Error fetching existing day activities
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        setError('Authentication required');
        setLoading(false);
        return;
      }
  
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Build query parameters for filters
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('per_page', '250');
      
      // Add category filter
      if (selectedOptions.categories && selectedOptions.categories.length > 0) {
        selectedOptions.categories.forEach(cat => {
          params.append('category[]', cat);
        });
      }

      // Add muscle group filter to API call
      if (selectedOptions.muscles && selectedOptions.muscles.length > 0) {
        selectedOptions.muscles.forEach(muscle => {
          params.append('muscle_group[]', muscle);
        });
      }
      
      // Add equipment filter if needed in future
      // if (selectedOptions.equipment && selectedOptions.equipment.length > 0) {
      //   selectedOptions.equipment.forEach(eq => {
      //     params.append('equipment[]', eq);
      //   });
      // }
      
      // Add search filter
      if (search.trim()) {
        params.append('search', search.trim());
      }

      // Add level filter (handled by backend)
      if (selectedOptions.levels && selectedOptions.levels.length > 0) {
        selectedOptions.levels.forEach(level => {
          params.append('level', level);
        });
      }

      // Fetch first page only (250 per page); "Show more" loads next pages
      params.set('page', '1');

      const response = await fetch(`${API_BASE_URL}/mobile/workout-activities?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();

        let pageData = [];
        let paginationInfo = null;

        if (result.data && Array.isArray(result.data.data)) {
          pageData = result.data.data;
          paginationInfo = result.data;
        } else if (result.data && Array.isArray(result.data)) {
          pageData = result.data;
          if (result.pagination) {
            paginationInfo = result.pagination;
          } else if (result.current_page || result.last_page || result.total) {
            paginationInfo = result;
          }
        } else {
          pageData = result.data || [];
        }

        setActivities(pageData.map(normalizeActivityItem));

        if (paginationInfo) {
          const currentPage = paginationInfo.current_page ?? 1;
          const lastPage = paginationInfo.last_page ?? 1;
          const total = paginationInfo.total ?? pageData.length;
          setPaginationState({ currentPage, lastPage, total });
        } else {
          setPaginationState({ currentPage: 1, lastPage: 1, total: pageData.length });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError('Failed to fetch activities');
        setPaginationState(null);
      }
    } catch (error) {
      setError('Network error occurred');
      setPaginationState(null);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreActivities = async () => {
    if (!paginationState || paginationState.currentPage >= paginationState.lastPage || loadingMore) {
      return;
    }
    const nextPage = paginationState.currentPage + 1;
    try {
      setLoadingMore(true);
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) return;
      let authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;

      const params = new URLSearchParams();
      params.append('page', String(nextPage));
      params.append('per_page', '250');
      if (selectedOptions.categories?.length > 0) {
        selectedOptions.categories.forEach(cat => params.append('category[]', cat));
      }
      if (selectedOptions.muscles?.length > 0) {
        selectedOptions.muscles.forEach(muscle => params.append('muscle_group[]', muscle));
      }
      if (search.trim()) params.append('search', search.trim());
      if (selectedOptions.levels?.length > 0) {
        selectedOptions.levels.forEach(level => params.append('level', level));
      }

      const response = await fetch(`${API_BASE_URL}/mobile/workout-activities?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        let pageData = [];
        let paginationInfo = null;

        if (result.data && Array.isArray(result.data.data)) {
          pageData = result.data.data;
          paginationInfo = result.data;
        } else if (result.data && Array.isArray(result.data)) {
          pageData = result.data;
          if (result.pagination) paginationInfo = result.pagination;
          else if (result.current_page || result.last_page || result.total) paginationInfo = result;
        } else {
          pageData = result.data || [];
        }

        setActivities(prev => [...prev, ...pageData.map(normalizeActivityItem)]);

        if (paginationInfo) {
          setPaginationState({
            currentPage: paginationInfo.current_page ?? nextPage,
            lastPage: paginationInfo.last_page ?? paginationState.lastPage,
            total: paginationInfo.total ?? paginationState.total,
          });
        } else {
          setPaginationState(prev => prev ? { ...prev, currentPage: nextPage } : null);
        }
      }
    } catch (err) {
      // Silent fail or optional toast
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMorePages = paginationState != null && paginationState.currentPage < paginationState.lastPage;

  useEffect(() => {
    fetchActivities();
  }, [selectedOptions.categories, selectedOptions.muscles, selectedOptions.equipment, selectedOptions.levels, search]);

  // Fetch existing day activities when component mounts (for activityCalendar source)
  useEffect(() => {
    if (source === 'activityCalendar' && selectedDate) {
      fetchExistingDayActivities();
    }
  }, [source, selectedDate]);

  // Extract unique filter options from activities
  // For muscles, use category field (biceps, chest, etc.)
  const filterOptions = useMemo(() => {
    const musclesSet = new Set();
    const equipmentSet = new Set();
    const levelsSet = new Set();

    activities.forEach((activity, index) => {
      // Extract muscles from category field (categories are muscle groups like biceps, chest, etc.)
      const category = activity.category;
      
      if (category) {
        if (Array.isArray(category)) {
          category.forEach(cat => {
            if (cat) {
              const value = typeof cat === 'string' ? cat.trim() : String(cat).trim();
              if (value) musclesSet.add(value);
            }
          });
        } else if (typeof category === 'string') {
          // Handle comma-separated values
          category.split(',').forEach(cat => {
            const trimmed = cat.trim();
            if (trimmed) musclesSet.add(trimmed);
          });
        } else if (category && typeof category === 'object') {
          // Handle object with name property
          const categoryName = category.name || category.category || String(category);
          if (categoryName) musclesSet.add(String(categoryName).trim());
        }
      }
      
      // Also check for legacy muscle fields as fallback
      const muscle = activity.muscle 
        || activity.muscle_group 
        || activity.muscles 
        || activity.target_muscle
        || activity.muscle_name
        || activity.primary_muscle
        || activity.secondary_muscle
        || activity.exercise?.muscle
        || activity.exercise?.muscle_group
        || activity.exercise?.target_muscle
        || activity.exercise_details?.muscle
        || activity.exercise_details?.muscle_group
        || activity.exercise_details?.target_muscle;
      
      if (muscle) {
        if (Array.isArray(muscle)) {
          muscle.forEach(m => {
            if (m) {
              const value = typeof m === 'string' ? m.trim() : (m.name || m.muscle_name || String(m));
              if (value) musclesSet.add(value);
            }
          });
        } else if (typeof muscle === 'string') {
          // Handle comma-separated values
          muscle.split(',').forEach(m => {
            const trimmed = m.trim();
            if (trimmed) musclesSet.add(trimmed);
          });
        } else if (muscle && typeof muscle === 'object') {
          // Handle object with name property
          const muscleName = muscle.name || muscle.muscle_name || muscle.muscle;
          if (muscleName) musclesSet.add(String(muscleName).trim());
        }
      }

      // Extract equipment - check multiple possible field names and nested structures
      const equipment = activity.equipment 
        || activity.equipment_type 
        || activity.equipment_needed
        || activity.equipment_name
        || activity.exercise?.equipment
        || activity.exercise?.equipment_type
        || activity.exercise_details?.equipment
        || activity.exercise_details?.equipment_type;
      
      if (equipment) {
        if (Array.isArray(equipment)) {
          equipment.forEach(e => {
            if (e) {
              const value = typeof e === 'string' ? e.trim() : (e.name || e.equipment_name || String(e));
              if (value) equipmentSet.add(value);
            }
          });
        } else if (typeof equipment === 'string') {
          equipment.split(',').forEach(e => {
            const trimmed = e.trim();
            if (trimmed) equipmentSet.add(trimmed);
          });
        } else if (equipment && typeof equipment === 'object') {
          // Handle object with name property
          const equipmentName = equipment.name || equipment.equipment_name || equipment.equipment;
          if (equipmentName) equipmentSet.add(String(equipmentName).trim());
        }
      }

      // Extract level - check multiple possible field names and nested structures
      const level = activity.level 
        || activity.difficulty 
        || activity.difficulty_level
        || activity.exercise?.level
        || activity.exercise?.difficulty
        || activity.exercise_details?.level
        || activity.exercise_details?.difficulty;
      
      if (level) {
        if (typeof level === 'string') {
          levelsSet.add(level.trim());
        } else if (level && typeof level === 'object') {
          // Handle object with name property
          const levelName = level.name || level.level_name || level.level;
          if (levelName) levelsSet.add(String(levelName).trim());
        }
      }
    });

    const result = {
      categories: Array.from(
        new Set(
          activities.flatMap(activity => getActivityCategoryValues(activity))
        )
      ).sort(),
      muscles: Array.from(musclesSet).sort(),
      equipment: Array.from(equipmentSet).sort(),
      levels: Array.from(levelsSet).sort(),
    };
    
    
    
    return result;
  }, [activities]);

  // Keep full muscle list so modal always shows all options when user has applied a muscle filter.
  // Only update when the new list is at least as long as the current saved list, so we never
  // overwrite the full list with the reduced list (e.g. when user clears and refetch hasn't completed).
  useEffect(() => {
    const newList = filterOptions.muscles || [];
    if (newList.length === 0) return;
    setSavedMuscleOptions(prev => {
      const prevLen = prev?.length ?? 0;
      if (newList.length >= prevLen) return newList;
      return prev;
    });
  }, [filterOptions.muscles]);

  const filterKeys = {
    'All Category': 'categories',
    'All Muscles': 'muscles',
    'All Equipment': 'equipment',
    'All Level': 'levels',
  };

  const getFilterModalOptions = (filterType) => {
    const key = filterKeys[filterType];
    if (filterType === 'All Category') {
      return [...new Set([...CATEGORY_FILTER_OPTIONS, ...(filterOptions.categories || [])])].sort();
    }
    if (filterType === 'All Level') {
      return [...new Set([...LEVEL_FILTER_OPTIONS, ...(filterOptions.levels || [])])].sort();
    }
    if (filterType === 'All Muscles') {
      return savedMuscleOptions.length > 0
        ? [...new Set([...savedMuscleOptions, ...(filterOptions.muscles || [])])].sort()
        : (filterOptions[key] || []);
    }
    return filterOptions[key] || [];
  };

  const getFilterModalTitle = (filterType) => {
    if (filterType === 'All Category') return 'Filter category';
    if (filterType === 'All Muscles') return 'Filter muscle';
    if (filterType === 'All Equipment') return 'Filter equipment';
    if (filterType === 'All Level') return 'Filter level';
    return 'Filter';
  };

  const getFilterModalEmptyLabel = (filterType) => {
    if (filterType === 'All Category') return 'categories';
    if (filterType === 'All Muscles') return 'muscles';
    if (filterType === 'All Equipment') return 'equipment';
    return 'levels';
  };

  const handleFilterPress = (filter) => {
    setActiveFilterType(filter);
    setFilterModalVisible(true);
  };

  const handleOptionToggle = (option) => {
    const key = filterKeys[activeFilterType];
    setSelectedOptions(prev => {
      const currentOptions = prev[key] || [];
      if (currentOptions.includes(option)) {
        return {
          ...prev,
          [key]: currentOptions.filter(item => item !== option)
        };
      } else {
        return {
          ...prev,
          [key]: [...currentOptions, option]
        };
      }
    });
  };

  const handleClearFilter = () => {
    const key = filterKeys[activeFilterType];
    setSelectedOptions(prev => ({
      ...prev,
      [key]: []
    }));
  };

  const handleShowResults = () => {
    setFilterModalVisible(false);
    // Update selected filter display based on selected options
    const key = filterKeys[activeFilterType];
    const selected = selectedOptions[key] || [];
    if (selected.length > 0) {
      setSelectedFilter(activeFilterType);
    } else {
      // If no options selected, check if any other filter is active
      const hasAnyFilter = Object.values(selectedOptions).some(arr => arr.length > 0);
      if (!hasAnyFilter) {
        setSelectedFilter(null);
      }
    }
  };

  const handleActivityToggle = (activity) => {
    // Use exercise_id if available, otherwise use exercise_name as fallback
    const activityKey = activity.exercise_id || activity.id || activity.exercise_name;
    const isSelected = selectedActivitiesList.some(item => {
      const itemKey = item.exercise_id || item.id || item.exercise_name;
      return itemKey === activityKey || itemKey?.toString() === activityKey?.toString();
    });
    
      if (isSelected) {
      // Remove activity (but don't remove if it's an existing activity and we're adding to day)
      if (source === 'addToDayActivity' || source === 'activityCalendar') {
        // Check if this is an existing activity (from existingActivities or existingDayActivities)
        const isExisting = existingActivities?.some(item => {
          const itemKey = item.exercise_id || item.id || item.activity_id;
          return itemKey === activityKey || itemKey?.toString() === activityKey?.toString();
        }) || existingDayActivities.some(item => {
          const itemKey = item.exercise_id || item.id;
          return itemKey === activityKey || itemKey?.toString() === activityKey?.toString();
        });
        if (isExisting) {
          // Don't allow removing existing activities when adding more
          Alert.alert('Info', 'Cannot remove existing activities. They are already part of your day plan.');
          return;
        }
      }
      // Remove activity
      const newList = selectedActivitiesList.filter(item => {
        const itemKey = item.exercise_id || item.id || item.exercise_name;
        return itemKey !== activityKey && itemKey?.toString() !== activityKey?.toString();
      });
      setSelectedActivitiesList(newList);
    } else {
      // Add activity
      const newList = [...selectedActivitiesList, activity];
      setSelectedActivitiesList(newList);
    }
  };

  const handleActivityPress = (activity) => {
    // Navigate to activity detail page
    navigation.navigate('ActivityDetails', {
      activity: activity,
      activityId: activity.exercise_id || activity.id
    });
  };

  const handleDone = async () => {
    // Check if this is from Activity Calendar (for day activities) or Create Workout flow
    if (source === 'activityCalendar') {
      // Navigate to DayActivitiesScreen with selected activities
      // First, check if activities already exist for this date and merge them
      try {
        const userToken = await AsyncStorage.getItem('userToken');
        if (!userToken) {
          Alert.alert('Error', 'Authentication required');
          return;
        }

        // Get day name from selected date (if provided) or use today's date
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let targetDate = selectedDate || new Date();
        // If selectedDate is a string, parse it
        if (typeof targetDate === 'string') {
          targetDate = new Date(targetDate);
        }
        const dayName = days[targetDate.getDay()];
        const dateStr = format(targetDate, 'yyyy-MM-dd');

        // Check if activities already exist for this date
        let authHeader = userToken;
        if (!userToken.startsWith('Bearer ')) {
          authHeader = `Bearer ${userToken}`;
        }

        const params = new URLSearchParams();
        params.append('day', dayName);
        params.append('date', dateStr);

        const checkResponse = await fetch(`${API_BASE_URL}/mobile/day-activities?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
        });

        let existingActivities = [];
        if (checkResponse.ok) {
          const checkResult = await checkResponse.json();
          if (checkResult.success && checkResult.data && checkResult.data.activities) {
            existingActivities = checkResult.data.activities || [];
          }
        }

        // Merge existing activities with new ones (avoid duplicates)
        const existingIds = new Set(existingActivities.map(a => a.exercise_id || a.id));
        const newUniqueActivities = selectedActivitiesList.filter(activity => {
          const id = activity.exercise_id || activity.id;
          return id && !existingIds.has(id);
        });

        const mergedActivities = [...existingActivities, ...newUniqueActivities];

        // Navigate to DayActivitiesScreen with merged activities and date
        // Use replace instead of navigate so that going back goes to ActivityCalendarScreen, not SelectActivitiesScreen
        navigation.replace('DayActivitiesScreen', {
          activities: mergedActivities,
          dayName: dayName,
          selectedDate: targetDate, // Pass the selected date from calendar
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to navigate. Please try again.');
      }
    } else if (source === 'addToDayActivity') {
      // Adding activities to existing day activity plan
      try {
        if (selectedActivitiesList.length === 0) {
          Alert.alert('Info', 'Please select at least one activity to add.');
          return;
        }

        // Get day name from selected date (if provided) or use the dayName from params
        let targetDate = selectedDate;
        let targetDayName = dayName;
        
        if (targetDate) {
          // If selectedDate is a string, parse it
          if (typeof targetDate === 'string') {
            targetDate = new Date(targetDate);
          }
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          targetDayName = days[targetDate.getDay()];
        }

        // Navigate back to DayActivitiesScreen with all selected activities (existing + new)
        // The backend will replace all activities with this complete list
        navigation.navigate('DayActivitiesScreen', {
          newActivities: selectedActivitiesList, // Send all selected (existing + new)
          isAddingActivities: true,
          dayName: targetDayName,
          selectedDate: targetDate, // Pass the selected date
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to add activities. Please try again.');
      }
    } else {
      // Original flow: Navigate to CreateWorkout
      // Pass selected activities, activity day, and form data back through navigation params
      // Following the pattern from sampleCreateWorkoutScreen.js - use activityDay (singular) instead of selectedDays
      const activityDay = selectedDays && Array.isArray(selectedDays) && selectedDays.length > 0 
        ? selectedDays[0] 
        : null;
      
      navigation.navigate({
        name: 'CreateWorkout',
        params: { 
          selectedActivities: selectedActivitiesList,
          activityDay: activityDay, // Pass single day (like sampleCreateWorkoutScreen.js)
          selectedDays: selectedDays, // Keep for backward compatibility
          formData: formData // Pass back the form data
        },
        merge: true,
      });
    }
  };

  // Memoize filtered activities
  // Muscle, search, and level filtering are done by backend via API call
  // Frontend filtering kept only for equipment (not supported by backend yet)
  const filteredActivities = useMemo(() => {
    let filtered = activities;

    // Category filtering (frontend fallback alongside API category[] param)
    if (selectedOptions.categories.length > 0) {
      filtered = filtered.filter(activity => {
        const activityCategories = getActivityCategoryValues(activity);
        return activityCategories.some(cat =>
          selectedOptions.categories.some(selected =>
            cat.toLowerCase() === selected.toLowerCase()
          )
        );
      });
    }

    // Equipment filtering (not yet supported by backend, so done on frontend)
    if (selectedOptions.equipment.length > 0) {
      filtered = filtered.filter(activity => {
        const equipment = activity.equipment 
          || activity.equipment_type 
          || activity.equipment_needed
          || activity.equipment_name
          || activity.exercise?.equipment
          || activity.exercise?.equipment_type
          || activity.exercise_details?.equipment
          || activity.exercise_details?.equipment_type;
        
        if (!equipment) return false;
        
        // Extract equipment values into an array
        let equipmentArray = [];
        if (Array.isArray(equipment)) {
          equipmentArray = equipment.map(e => {
            if (typeof e === 'string') return e.trim();
            if (e && typeof e === 'object') return (e.name || e.equipment_name || e.equipment || String(e)).trim();
            return String(e).trim();
          });
        } else if (typeof equipment === 'string') {
          equipmentArray = equipment.split(',').map(e => e.trim());
        } else if (equipment && typeof equipment === 'object') {
          const equipmentName = equipment.name || equipment.equipment_name || equipment.equipment;
          if (equipmentName) equipmentArray = [String(equipmentName).trim()];
        }
        
        return equipmentArray.some(e => selectedOptions.equipment.includes(e));
      });
    }

    return filtered.map((activity) => ({
      ...activity,
      processedThumbnailUrl: getActivityThumbnailUrl(activity),
    }));
  }, [activities, selectedOptions.categories, selectedOptions.equipment]);

  const isActivitySelected = (activity) => {
    const activityKey = activity.exercise_id || activity.id || activity.exercise_name;
    const selected = selectedActivitiesList.some(item => {
      const itemKey = item.exercise_id || item.id || item.exercise_name;
      return itemKey === activityKey || itemKey?.toString() === activityKey?.toString();
    });
    return selected;
  };

  if (loading && !filterModalVisible) {
    return (
      <View style={styles.container}>
        {/* Custom Header with Search */}
        <View style={[styles.customHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#6b6b6b" />
          </TouchableOpacity>
          <View style={styles.headerSearchContainer}>
            <Feather name="search" size={18} color="#888" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.headerSearchInput}
              placeholder="Search activities..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#bbb"
              autoFocus={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.headerClearButton}>
                <Ionicons name="close-circle" size={18} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Chips */}
        <View style={[styles.filterContainer, { paddingTop: insets.top + 60 }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.filterContentContainer}
          >
            {FILTER_CHIPS.map((filter) => {
              const key = filterKeys[filter];
              const hasActiveFilter = selectedOptions[key]?.length > 0;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterChip,
                    (selectedFilter === filter || hasActiveFilter) && styles.filterChipActive
                  ]}
                  onPress={() => handleFilterPress(filter)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.filterChipText,
                    (selectedFilter === filter || hasActiveFilter) && styles.filterChipTextActive
                  ]}>
                    {filter} {hasActiveFilter && `(${selectedOptions[key].length})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={[styles.loadingContainer, { paddingTop: insets.top + 120 }]}>
          <ActivityIndicator size="large" color="#222" />
          <Text style={styles.loadingText}>Loading activities...</Text>
        </View>
      </View>
    );
  }

  if (error && !filterModalVisible) {
    return (
      <View style={styles.container}>
        {/* Custom Header with Search */}
        <View style={[styles.customHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#6b6b6b" />
          </TouchableOpacity>
          <View style={styles.headerSearchContainer}>
            <Feather name="search" size={18} color="#888" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.headerSearchInput}
              placeholder="Search activities..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#bbb"
              autoFocus={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.headerClearButton}>
                <Ionicons name="close-circle" size={18} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Chips */}
        <View style={[styles.filterContainer, { paddingTop: insets.top + 60 }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.filterContentContainer}
          >
            {FILTER_CHIPS.map((filter) => {
              const key = filterKeys[filter];
              const hasActiveFilter = selectedOptions[key]?.length > 0;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterChip,
                    (selectedFilter === filter || hasActiveFilter) && styles.filterChipActive
                  ]}
                  onPress={() => handleFilterPress(filter)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.filterChipText,
                    (selectedFilter === filter || hasActiveFilter) && styles.filterChipTextActive
                  ]}>
                    {filter} {hasActiveFilter && `(${selectedOptions[key].length})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={[styles.errorContainer, { paddingTop: insets.top + 120 }]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchActivities}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header with Search */}
      <View style={[styles.customHeader, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#6b6b6b" />
        </TouchableOpacity>
        <View style={styles.headerSearchContainer}>
          <Feather name="search" size={18} color="#888" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.headerSearchInput}
            placeholder="Search activities..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#bbb"
            autoFocus={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.headerClearButton}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={[styles.filterContainer, { paddingTop: insets.top + 60 }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterContentContainer}
        >
          {FILTER_CHIPS.map((filter) => {
            const key = filterKeys[filter];
            const hasActiveFilter = selectedOptions[key]?.length > 0;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  (selectedFilter === filter || hasActiveFilter) && styles.filterChipActive
                ]}
                onPress={() => handleFilterPress(filter)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterChipText,
                  (selectedFilter === filter || hasActiveFilter) && styles.filterChipTextActive
                ]}>
                  {filter} {hasActiveFilter && `(${selectedOptions[key].length})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      
      <View style={{ paddingTop: insets.top + 110, flex: 1 }}>
        <FlatList
          data={filteredActivities}
          keyExtractor={(item, index) => `${(item.exercise_id ?? item.id) ?? 'activity'}-${index}`}
          renderItem={({ item: activity }) => {
            const thumbnailUrl = activity.processedThumbnailUrl || getThumbnailUrl(activity);
            const category = activity.category || '';
            const difficulty = activity.level || activity.difficulty || activity.difficulty_level || '';
            const bodyPart = activity.body_part || activity.muscle || activity.muscle_group || activity.muscles || activity.muscle_name || '';
            return (
              <View style={styles.activityCard}>
                <TouchableOpacity
                  style={styles.activityCardContent}
                  onPress={() => handleActivityPress(activity)}
                  activeOpacity={0.8}
                >
                  {/* Thumbnail on the left */}
                  <View style={styles.thumbnailContainer}>
                    {thumbnailUrl ? (
                      <ActivityThumbnail uri={thumbnailUrl} />
                    ) : (
                      <View style={styles.thumbnailPlaceholder}>
                        <MaterialCommunityIcons name="dumbbell" size={24} color="#ccc" />
                      </View>
                    )}
                  </View>
                  
                  {/* Activity info: name + category line + difficulty & body part line */}
                  <View style={styles.activityInfo}>
                    <Text 
                      style={styles.activityName}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {toTitleCase(activity.exercise_name || activity.name || 'Unnamed Activity')}
                    </Text>
                    {category ? (
                      <View style={styles.activityTagRow}>
                        <MaterialCommunityIcons name="bookmark-outline" size={14} color="#4CAF50" style={styles.tagIcon} />
                        <Text style={styles.activityCategoryText} numberOfLines={1} ellipsizeMode="tail">
                          {category}
                        </Text>
                      </View>
                    ) : null}
                    {(difficulty || bodyPart) ? (
                      <View style={styles.activityTagRow}>
                        {difficulty ? (
                          <View style={styles.activityTagItem}>
                            <MaterialCommunityIcons name="chart-line" size={14} color="#03A9F4" style={styles.tagIcon} />
                            <Text style={styles.activityDifficultyText}>{difficulty}</Text>
                          </View>
                        ) : null}
                        {difficulty && bodyPart ? <View style={styles.activityTagSpacer} /> : null}
                        {bodyPart ? (
                          <View style={styles.activityTagItem}>
                            <MaterialCommunityIcons name="arm-flex-outline" size={14} color="#FF9800" style={styles.tagIcon} />
                            <Text style={styles.activityBodyPartText} numberOfLines={1} ellipsizeMode="tail">
                              {bodyPart}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
                
                {/* Selection checkbox - Separate TouchableOpacity outside the card press area */}
                <TouchableOpacity
                  style={styles.selectionIndicator}
                  onPress={() => handleActivityToggle(activity)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {isActivitySelected(activity) ? (
                    <MaterialCommunityIcons name="checkbox-marked" size={24} color="#4CAF50" />
                  ) : (
                    <MaterialCommunityIcons name="checkbox-blank-outline" size={24} color="#ccc" />
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="dumbbell-off" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                {search ? 'No activities found matching your search' : 'No activities available'}
              </Text>
              {search && (
                <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchButton}>
                  <Text style={styles.clearSearchText}>Clear search</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListFooterComponent={
            hasMorePages && filteredActivities.length > 0 ? (
              <View style={styles.showMoreFooter}>
                <TouchableOpacity
                  style={[styles.showMoreButton, loadingMore && styles.showMoreButtonDisabled]}
                  onPress={loadMoreActivities}
                  disabled={loadingMore}
                  activeOpacity={0.8}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color="#fff" style={styles.showMoreSpinner} />
                  ) : null}
                  <Text style={styles.showMoreButtonText}>
                    {loadingMore ? 'Loading...' : 'Show more'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          contentContainerStyle={[
            styles.scrollContent,
            { 
              // Only add extra padding if bottom container is visible (activities selected)
              paddingBottom: selectedActivitiesList.length > 0 
                ? Math.max(insets.bottom, 16) + 80 
                : Math.max(insets.bottom, 16) + 20
            }
          ]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          updateCellsBatchingPeriod={50}
          style={styles.scrollView}
        />
      </View>

      {/* Done Button - Only visible when activities are selected */}
      {selectedActivitiesList.length > 0 && (
        <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 16), bottom: '5%' }]}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
          >
            <Text style={styles.doneButtonText}>Selected Activities ({selectedActivitiesList.length})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={[
          styles.modalOverlay,
          activeFilterType === 'All Category' && styles.modalOverlayCategory,
        ]}>
          <TouchableOpacity 
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setFilterModalVisible(false)}
          />
          <View style={[
            styles.modalContent,
            activeFilterType === 'All Category' && styles.modalContentCategory,
          ]}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setFilterModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {getFilterModalTitle(activeFilterType)}
              </Text>
              <TouchableOpacity onPress={handleClearFilter}>
                <Text style={styles.modalClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalOptionsList}>
              {activeFilterType && getFilterModalOptions(activeFilterType).length > 0 ? (
                getFilterModalOptions(activeFilterType).map((option, optionIndex) => {
                  const key = filterKeys[activeFilterType];
                  const isSelected = selectedOptions[key]?.includes(option);

                  return (
                    <TouchableOpacity
                      key={`${option}-${optionIndex}`}
                      style={styles.modalOptionItem}
                      onPress={() => handleOptionToggle(option)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.modalOptionText}>{option}</Text>
                      <View style={[
                        styles.modalCheckbox,
                        isSelected && styles.modalCheckboxSelected
                      ]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.modalEmptyContainer}>
                  <Text style={styles.modalEmptyText}>
                    No {getFilterModalEmptyLabel(activeFilterType)} found in activities
                  </Text>
                  <Text style={styles.modalEmptySubtext}>
                    Activities may not have {getFilterModalEmptyLabel(activeFilterType)} information
                  </Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalShowResultsButton}
              onPress={handleShowResults}
              activeOpacity={0.8}
            >
              <Text style={styles.modalShowResultsText}>Show results</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf8',
  },
  customHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8f2',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    marginRight: 12,
  },
  headerSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 40,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    color: '#1a1a1a',
    paddingVertical: 0,
  },
  headerClearButton: {
    padding: 6,
    marginRight: 8,
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  loadingText: { 
    marginTop: 16, 
    fontSize: 16, 
    color: '#666',
    fontWeight: '500'
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 20
  },
  errorText: { 
    fontSize: 16, 
    color: '#666',
    textAlign: 'center',
    marginBottom: 20
  },
  retryButton: {
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  showMoreFooter: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  showMoreButton: {
    backgroundColor: '#222',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
  },
  showMoreButtonDisabled: {
    opacity: 0.7,
  },
  showMoreSpinner: {
    marginRight: 8,
  },
  showMoreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 12,
    height: 44,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 10,
    color: '#1a1a1a',
    paddingVertical: 0,

  },
  clearButton: {
    padding: 8,
    marginRight: 8,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  selectedCountContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  selectedCountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activitiesContainer: {
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
  clearSearchButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#222',
    borderRadius: 20,
  },
  clearSearchText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  activityCard: {
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  activityCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 0,
    flex: 1,
  },
  thumbnailContainer: {
    marginRight: 12,
    width: 48,
    height: 68,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  thumbnail: {
    width: 48,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  thumbnailPlaceholder: {
    width: 48,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flexShrink: 1,
    marginBottom: 4,
  },
  activityTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  activityTagItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagIcon: {
    marginRight: 4,
  },
  activityTagSpacer: {
    width: 8,
  },
  activityCategoryText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '400',
    flex: 1,
    flexShrink: 1,
  },
  activityDifficultyText: {
    fontSize: 12,
    color: '#03A9F4',
    fontWeight: '400',
  },
  activityBodyPartText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '400',
    flexShrink: 1,
  },
  selectionIndicator: {
    marginLeft: 12,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  doneButton: {
    backgroundColor: '#222',
    bottom: '5%',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  filterContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fafaf8',
    paddingBottom: 8,
  },
  filterContentContainer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: '#ddd',
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayCategory: {
    paddingBottom: '8%',
  },
  modalOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '70%',
    minHeight: '50%',
  },
  modalContentCategory: {
    maxHeight: '88%',
    minHeight: '72%',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 1,
    padding: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 60,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalClearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalOptionsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#1a1a1a',
    flex: 1,
  },
  modalCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modalCheckboxSelected: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  modalShowResultsButton: {
    backgroundColor: '#222',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalShowResultsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalEmptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalEmptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default SelectActivitiesScreen;
