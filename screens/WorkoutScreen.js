import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Dimensions, Image, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyWorkouts, fetchAssignedWorkouts, fetchAllWorkouts, fetchAssignedWorkoutDetails, deleteMemberWorkout } from '../api/workouts';
import { workoutKeys } from '../api/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import ModernAlert from '../components/ModernAlert';
import { getWorkoutThumbnailUrl } from '../utils/thumbnailUtils';

const { width: screenWidth } = Dimensions.get('window');

const WorkoutCardImage = ({ workout }) => {
  const [failed, setFailed] = useState(false);
  const uri = getWorkoutThumbnailUrl(workout);

  if (!uri || failed) {
    return (
      <View style={styles.workoutCardPlaceholder}>
        <MaterialCommunityIcons name="dumbbell" size={48} color="#ccc" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.workoutCardImage}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
};

const WorkoutScreen = () => {
  const { userData, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [menuVisible, setMenuVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const [selectedFilter, setSelectedFilter] = useState('All workouts');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilterType, setActiveFilterType] = useState(null);
  const [workoutOptionsModalVisible, setWorkoutOptionsModalVisible] = useState(false);
  const [workoutOptionsWorkout, setWorkoutOptionsWorkout] = useState(null);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({
    goals: [],
    duration: null, // Single value for radio button (null, 'Any duration', '< 20 minutes', etc.)
    equipment: [],
    levels: [],
    workouts: [],
    creator: null // Single value for radio button (null, 'All', or 'Created by me')
  });
  const navigation = useNavigation();

  // Helper function to handle back navigation - navigate to Dashboard if CreateWorkoutScreen is in stack
  const handleBackNavigation = () => {
    const state = navigation.getState();
    const routes = state.routes;
    
    // Check if CreateWorkoutScreen is anywhere in the navigation stack
    const hasCreateWorkoutScreen = routes.some(route => route.name === 'CreateWorkout');
    
    if (hasCreateWorkoutScreen) {
      // Navigate directly to Dashboard, skipping CreateWorkoutScreen
      navigation.navigate('Dashboard');
    } else {
      // Otherwise, go back normally
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // Fallback: navigate to Dashboard if we can't go back
        navigation.navigate('Dashboard');
      }
    }
  };

  const API_BASE_URL = ENV_API_BASE_URL;

  const formatDisplayName = (value) => {
    if (!value) return '';
    return String(value)
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/(^|\s|-)(\w)/g, (match, p1, p2) => p1 + p2.toUpperCase());
  };

  // Filter options data
  const filterOptions = {
    'All Goals': ['Lose Weight', 'Build Muscle', 'Improve well-being', 'Improve Performance', 'Get Fit', 'Shape and Tone'],
    'Any Duration': ['Any duration', '< 20 minutes', '20 - 40 minutes', '> 40 minutes', 'Multi-day workout plan'],
    'All equipment': ['No Equipment', 'Dumbbells', 'Barbell', 'Resistance Bands', 'Kettlebell', 'Machine', 'Bodyweight'],
    'All levels': ['Beginner', 'Intermediate', 'Advanced'],
    'All workouts': ['Strength', 'Cardio', 'HIIT', 'Yoga', 'Pilates', 'Stretching'],
    'Creator': ['All', 'Created by me']
  };

  const filterKeys = {
    'All Goals': 'goals',
    'Any Duration': 'duration',
    'All equipment': 'equipment',
    'All levels': 'levels',
    'All workouts': 'workouts',
    'Creator': 'creator'
  };

  const handleFilterPress = (filter) => {
    setActiveFilterType(filter);
    setFilterModalVisible(true);
  };

  const handleOptionToggle = (option) => {
    const key = filterKeys[activeFilterType];
    
    // Creator and Any Duration use radio button (single selection)
    if (activeFilterType === 'Creator' || activeFilterType === 'Any Duration') {
      setSelectedOptions(prev => ({
        ...prev,
        [key]: prev[key] === option ? null : option // Toggle: if same option, deselect; otherwise select
      }));
    } else {
      // Other filters use checkboxes (multiple selection)
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
    }
  };

  const handleClearFilter = () => {
    const key = filterKeys[activeFilterType];
    setSelectedOptions(prev => ({
      ...prev,
      [key]: (activeFilterType === 'Creator' || activeFilterType === 'Any Duration') ? null : [] // Creator and Duration use null, others use empty array
    }));
  };

  const handleShowResults = () => {
    setFilterModalVisible(false);
    // Update selected filter display based on selected options
    const key = filterKeys[activeFilterType];
    if (activeFilterType === 'Creator' || activeFilterType === 'Any Duration') {
      const selected = selectedOptions[key];
      if (selected) {
        setSelectedFilter(activeFilterType);
      }
    } else {
      const selected = selectedOptions[key] || [];
      if (selected.length > 0) {
        setSelectedFilter(activeFilterType);
      }
    }
  };

  // React Query hooks for all three data sources
  // Each query is independent and shares cache across screens using the same queryKey
  
  // Query for my workouts (workouts created by the member)
  // Include selectedOptions in query key so it refetches when filters change
  const {
    data: myWorkouts = [],
    isLoading: isLoadingMyWorkouts,
    isFetching: isFetchingMyWorkouts,
    error: myWorkoutsError,
    refetch: refetchMyWorkouts,
  } = useQuery({
    queryKey: [...workoutKeys.myWorkouts(), selectedOptions],
    queryFn: () => fetchMyWorkouts({
      goals: selectedOptions.goals,
      durations: selectedOptions.duration ? [selectedOptions.duration] : [],
      equipments: selectedOptions.equipment,
      levels: selectedOptions.levels,
      workoutTypes: selectedOptions.workouts,
      search: search.trim(),
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Query for assigned workouts (workouts assigned from CRM)
  // Include selectedOptions in query key so it refetches when filters change
  const {
    data: assignedWorkouts = [],
    isLoading: isLoadingAssignedWorkouts,
    isFetching: isFetchingAssignedWorkouts,
    error: assignedWorkoutsError,
    refetch: refetchAssignedWorkouts,
  } = useQuery({
    queryKey: [...workoutKeys.assignedWorkouts(), selectedOptions, search],
    queryFn: () => fetchAssignedWorkouts({
      goals: selectedOptions.goals,
      durations: selectedOptions.duration ? [selectedOptions.duration] : [],
      equipments: selectedOptions.equipment,
      levels: selectedOptions.levels,
      workoutTypes: selectedOptions.workouts,
      search: search.trim(),
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Query for all workouts (discover page - shared with DiscoverScreen via queryKey)
  // Include selectedOptions in query key so it refetches when filters change
  const {
    data: allWorkouts = [],
    isLoading: isLoadingAllWorkouts,
    isFetching: isFetchingAllWorkouts,
    error: allWorkoutsError,
    refetch: refetchAllWorkouts,
  } = useQuery({
    queryKey: [...workoutKeys.allWorkouts(), selectedOptions],
    queryFn: () => fetchAllWorkouts({
      goals: selectedOptions.goals,
      durations: selectedOptions.duration ? [selectedOptions.duration] : [],
      equipments: selectedOptions.equipment,
      levels: selectedOptions.levels,
      workoutTypes: selectedOptions.workouts,
      creators: selectedOptions.creator === 'Created by me' ? ['My Workouts'] : selectedOptions.creator === 'All' ? ['All Workouts'] : [],
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Combined loading state - only true on first load when no cache exists
  const isLoading = isLoadingMyWorkouts || isLoadingAssignedWorkouts || isLoadingAllWorkouts;
  
  // Background fetching state - true when data is being refreshed in background
  const isBackgroundFetching = (isFetchingMyWorkouts && !isLoadingMyWorkouts) ||
                               (isFetchingAssignedWorkouts && !isLoadingAssignedWorkouts) ||
                               (isFetchingAllWorkouts && !isLoadingAllWorkouts);

  // Combined error state
  const error = myWorkoutsError || assignedWorkoutsError || allWorkoutsError;

  // Refetch all queries when screen comes into focus (only if stale)
  // React Query handles this automatically with refetchOnMount, but we can also trigger manually
  useFocusEffect(
    React.useCallback(() => {
      // React Query will automatically refetch if data is stale
      // This is handled by refetchOnMount: true in QueryClient defaults
      // No manual polling needed - React Query handles background refetching
      // Data will be refetched in background if stale (older than 5 minutes)
    }, [])
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

  const openWorkoutOptions = (w, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setWorkoutOptionsWorkout(w);
    setWorkoutOptionsModalVisible(true);
  };

  const closeWorkoutOptions = () => {
    setWorkoutOptionsModalVisible(false);
    setWorkoutOptionsWorkout(null);
  };

  const handleEditMyWorkout = () => {
    const w = workoutOptionsWorkout;
    closeWorkoutOptions();
    if (!w || !w.id) return;
    navigation.navigate('CreateWorkout', { editWorkoutId: w.id, workout: w });
  };

  const handleDeleteMyWorkout = () => {
    const w = workoutOptionsWorkout;
    if (!w || !w.id) {
      closeWorkoutOptions();
      return;
    }
    setAlertConfig({
      title: 'Delete workout',
      message: `Are you sure you want to delete "${formatDisplayName(w.exercise_name || w.name || 'this workout')}"?`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', onPress: () => setAlertVisible(false), style: 'secondary' },
        {
          text: 'Delete',
          onPress: async () => {
            setAlertVisible(false);
            setDeletingWorkoutId(w.id);
            try {
              await deleteMemberWorkout(w.id);
              queryClient.invalidateQueries({ queryKey: workoutKeys.myWorkouts() });
              closeWorkoutOptions();
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

  // Filter workouts based on search term
  const filterWorkout = (workout, searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
      return true;
    }
    
    const term = searchTerm.toLowerCase().trim();
    const exerciseName = (workout.exercise_name || '').toLowerCase();
    const name = (workout.name || '').toLowerCase();
    const workoutName = (workout.workout_name || '').toLowerCase();
    const category = (workout.category || '').toLowerCase();
    const level = (workout.level || '').toLowerCase();
    
    return exerciseName.includes(term) ||
           name.includes(term) ||
           workoutName.includes(term) ||
           category.includes(term) ||
           level.includes(term);
  };

  // Filtered workouts using useMemo for performance
  const filteredMyWorkouts = useMemo(() => {
    if (!search || search.trim() === '') {
      return myWorkouts;
    }
    return myWorkouts.filter(workout => filterWorkout(workout, search));
  }, [myWorkouts, search]);

  const filteredAssignedWorkouts = useMemo(() => {
    if (!search || search.trim() === '') {
      return assignedWorkouts;
    }
    return assignedWorkouts.filter(workout => filterWorkout(workout, search));
  }, [assignedWorkouts, search]);

  const filteredAllWorkouts = useMemo(() => {
    if (!search || search.trim() === '') {
      return allWorkouts;
    }
    return allWorkouts.filter(workout => filterWorkout(workout, search));
  }, [allWorkouts, search]);

  // Group filtered workouts by category using useMemo for performance
  const groupedWorkouts = useMemo(() => {
    const grouped = {};
    filteredAllWorkouts.forEach(workout => {
      const category = workout.category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(workout);
    });
    return grouped;
  }, [filteredAllWorkouts]);

  // Group all workouts (unfiltered) by category - used when search returns no results
  const groupedAllWorkouts = useMemo(() => {
    const grouped = {};
    allWorkouts.forEach(workout => {
      const category = workout.category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(workout);
    });
    return grouped;
  }, [allWorkouts]);

  const categories = useMemo(() => {
    return Object.keys(groupedWorkouts).sort();
  }, [groupedWorkouts]);

  const allCategories = useMemo(() => {
    return Object.keys(groupedAllWorkouts).sort();
  }, [groupedAllWorkouts]);

  // Manual refetch function for retry/refresh buttons
  const handleRefresh = async () => {
    await Promise.all([
      refetchMyWorkouts(),
      refetchAssignedWorkouts(),
      refetchAllWorkouts(),
    ]);
  };

  // Show full loading screen only on very first load when we have no data at all
  // If we have cached data, show the normal layout with loading indicators in sections
  const hasAnyData = (myWorkouts && myWorkouts.length > 0) || 
                     (assignedWorkouts && assignedWorkouts.length > 0) || 
                     (allWorkouts && allWorkouts.length > 0);
  
  const showFullLoading = isLoading && !hasAnyData;

  // Show error state
  if (error) {
    return (
      <View style={styles.container}>
        {/* Search Header */}
        <View style={[styles.searchHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={handleBackNavigation}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={styles.searchBarContainer}>
            <Feather name="search" size={16} color="#888" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search workouts"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#bbb"
            />
          </View>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
          >
            <Feather name="menu" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
        {/* Filter Slider */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContentContainer}
        >
          {['All Goals', 'Any Duration', 'All equipment', 'All levels', 'All workouts', 'Creator'].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                selectedFilter === filter && styles.filterChipActive
              ]}
              onPress={() => handleFilterPress(filter)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterChipText,
                selectedFilter === filter && styles.filterChipTextActive
              ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error?.message || 'Failed to load workouts'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
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
      {/* Search Header */}
      <View style={[styles.searchHeader, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackNavigation}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={16} color="#888" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search workouts"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#bbb"
          />
        </View>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setMenuVisible(true)}
        >
          <Feather name="menu" size={24} color="#1a1a1a" />
        </TouchableOpacity>
      </View>
      
      {/* Filter Slider */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContentContainer}
      >
        {['All Goals', 'Any Duration', 'All equipment', 'All levels', 'All workouts', 'Creator'].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              selectedFilter === filter && styles.filterChipActive
            ]}
            onPress={() => handleFilterPress(filter)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterChipText,
              selectedFilter === filter && styles.filterChipTextActive
            ]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* Optional: Small "Updating..." indicator when background fetch happens */}
      {isBackgroundFetching && (
        <View style={styles.backgroundUpdateIndicator}>
          <ActivityIndicator size="small" color="#222" />
          <Text style={styles.backgroundUpdateText}>Updating...</Text>
        </View>
      )}

      <ScrollView 
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 120, flexGrow: 1 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#222']}
            tintColor="#222"
          />
        }
      >
        {/* Create your own */}
        <Text style={styles.sectionLabel}>Created by me</Text>
        <TouchableOpacity 
          style={styles.createWorkoutBox}
          onPress={() => navigation.navigate('CreateWorkout')}
          activeOpacity={0.8}
        >
          <Feather name="plus-circle" size={18} color="#000" />
          <Text style={styles.createWorkoutText}>Create workout</Text>
        </TouchableOpacity>
        
        {/* My Workouts Section */}
        <View>
          <Text style={styles.sectionLabel}>My Workouts</Text>
          {isLoadingMyWorkouts ? (
            <View style={styles.sectionLoadingContainer}>
              <ActivityIndicator size="small" color="#222" />
              <Text style={styles.sectionLoadingText}>Loading...</Text>
            </View>
          ) : filteredMyWorkouts && filteredMyWorkouts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalCardsRow}>
              {filteredMyWorkouts.map((workout, idx) => (
                <TouchableOpacity
                  key={workout.id}
                  style={[styles.workoutCard, { width: screenWidth * 0.65, marginRight: idx === filteredMyWorkouts.length - 1 ? 0 : 16 }]}
                  onPress={() => navigation.navigate('WorkoutDetails', { 
                    workout: workout,
                    canStartWorkout: true,
                    isCreatedByMember: true,
                  })}
                  activeOpacity={0.8}
                >
                  <WorkoutCardImage workout={workout} />
                  <View style={styles.workoutCardOverlay} />
                  <TouchableOpacity
                    style={styles.workoutCardMenuButton}
                    onPress={(e) => openWorkoutOptions(workout)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.workoutCardTextBox}>
                    <Text style={styles.workoutCardTitle}>{formatDisplayName(workout.exercise_name || workout.name || workout.workout_name || 'Workout')}</Text>
                    <Text style={styles.workoutCardSubtitle}>{workout.duration} min · {workout.level} · {workout.category}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptySectionContainer}>
              <Text style={styles.emptySectionText}>No workouts found</Text>
            </View>
          )}
        </View>

        {/* Assigned Workouts Section */}
        <View>
          <Text style={styles.sectionLabel}>Assigned Workouts</Text>
          {isLoadingAssignedWorkouts ? (
            <View style={styles.sectionLoadingContainer}>
              <ActivityIndicator size="small" color="#222" />
              <Text style={styles.sectionLoadingText}>Loading...</Text>
            </View>
          ) : filteredAssignedWorkouts && filteredAssignedWorkouts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalCardsRow}>
              {filteredAssignedWorkouts.map((workout, idx) => (
                <TouchableOpacity
                  key={workout.id}
                  style={[styles.workoutCard, { width: screenWidth * 0.65, marginRight: idx === filteredAssignedWorkouts.length - 1 ? 0 : 16 }]}
                  onPress={async () => {
                    // Check if workout ID exists
                    if (!workout.id) {
                      console.error('No workout ID found for workout:', workout);
                      navigation.navigate('WorkoutDetails', { workout: workout });
                      return;
                    }
                    
                    // Preserve the title from the workout card (same logic as displayed on card)
                    const workoutTitle = workout.exercise_name || workout.name || workout.workout_name || 'Workout';
                    
                    // Fetch detailed workout data before navigating
                    try {
                      const workoutDetails = await fetchAssignedWorkoutDetails(workout.id);
                      if (workoutDetails) {
                        // Extract the workout data from the API response
                        const detailedWorkout = workoutDetails.workout || workoutDetails.data || workoutDetails;
                        
                        // Merge original workout data with detailed workout to preserve title from card
                        // This ensures the title shown in WorkoutDetailsScreen matches what's on the card
                        const mergedWorkout = {
                          ...detailedWorkout,
                          // Preserve title properties from original workout card
                          exercise_name: workout.exercise_name || detailedWorkout.exercise_name || workoutTitle,
                          name: workout.name || detailedWorkout.name || workoutTitle,
                          workout_name: workout.workout_name || detailedWorkout.workout_name || workoutTitle,
                          // Preserve thumbnail from original workout card (it's working on WorkoutScreen)
                          thumbnail: workout.thumbnail || detailedWorkout.thumbnail,
                        };
                        
                        navigation.navigate('WorkoutDetails', { 
                          workout: mergedWorkout,
                          isAssignedWorkout: true,
                          canStartWorkout: true // Assigned workouts can start workout session
                        });
                      } else {
                        // Fallback to basic workout data if details fetch fails
                        navigation.navigate('WorkoutDetails', { 
                          workout: workout,
                          canStartWorkout: true // Assigned workouts can start workout session
                        });
                      }
                    } catch (error) {
                      console.error('Error fetching workout details:', error);
                      // Fallback to basic workout data
                      navigation.navigate('WorkoutDetails', { 
                        workout: workout,
                        canStartWorkout: true
                      });
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <WorkoutCardImage workout={workout} />
                  <View style={styles.workoutCardOverlay} />
                  <View style={styles.workoutCardTextBox}>
                    <Text style={styles.workoutCardTitle}>{formatDisplayName(workout.exercise_name || workout.name || workout.workout_name || 'Workout')}</Text>
                    <Text style={styles.workoutCardSubtitle}>{workout.duration} min · {workout.level} · {workout.category}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptySectionContainer}>
              <Text style={styles.emptySectionText}>No workouts found</Text>
            </View>
          )}
        </View>

        {/* All Workouts Section - Grouped by Category */}
        <View>
          <Text style={styles.sectionLabel}>All Workouts</Text>
          {isLoadingAllWorkouts ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#222" />
            </View>
          ) : (search && search.trim() !== '' && filteredAllWorkouts.length > 0) ? (
            // When searching and results found, show filtered workouts in a single section
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalCardsRow}>
              {filteredAllWorkouts.map((workout, idx) => (
                  <TouchableOpacity
                    key={workout.id || idx}
                    style={[
                      styles.workoutCard, 
                      { 
                        width: screenWidth * 0.65, 
                        marginRight: idx === filteredAllWorkouts.length - 1 ? 0 : 16 
                      }
                    ]}
                    onPress={() => navigation.navigate('WorkoutDetails', { 
                      workout: workout,
                      isFromAllWorkouts: true,
                      canStartWorkout: false 
                    })}
                    activeOpacity={0.8}
                  >
                    <WorkoutCardImage workout={workout} />
                    <View style={styles.workoutCardOverlay} />
                    <View style={styles.workoutCardTextBox}>
                      <Text style={styles.workoutCardTitle}>
                        {formatDisplayName(workout.exercise_name || workout.name || workout.workout_name || 'Workout')}
                      </Text>
                      <Text style={styles.workoutCardSubtitle}>
                        {workout.duration ? `${workout.duration} min` : ''} 
                        {workout.level ? ` · ${workout.level}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          ) : allCategories.length > 0 ? (
            // When not searching OR when search returns no results, show all workouts grouped by category
            allCategories.map((category) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryHeader}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.horizontalCardsRow}
                >
                  {groupedAllWorkouts[category].map((workout, idx) => (
                    <TouchableOpacity
                      key={workout.id || idx}
                      style={[
                        styles.workoutCard, 
                        { 
                          width: screenWidth * 0.65, 
                          marginRight: idx === groupedAllWorkouts[category].length - 1 ? 0 : 16 
                        }
                      ]}
                      onPress={() => navigation.navigate('WorkoutDetails', { 
                        workout: workout,
                        isFromAllWorkouts: true, // From all workouts - no start workout session
                        canStartWorkout: false 
                      })}
                      activeOpacity={0.8}
                    >
                      <WorkoutCardImage workout={workout} />
                      <View style={styles.workoutCardOverlay} />
                      <View style={styles.workoutCardTextBox}>
                        <Text style={styles.workoutCardTitle}>
                          {formatDisplayName(workout.exercise_name || workout.name || workout.workout_name || 'Workout')}
                        </Text>
                        <Text style={styles.workoutCardSubtitle}>
                          {workout.duration ? `${workout.duration} min` : ''} 
                          {workout.level ? ` · ${workout.level}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ))
          ) : (
            <View style={styles.emptySectionContainer}>
              <Text style={styles.emptySectionText}>
                {search && search.trim() !== '' ? 'No workouts found matching your search' : 'No workouts available'}
              </Text>
            </View>
          )}
        </View>
        
      </ScrollView>
      <TouchableOpacity style={styles.backButtonBottom} onPress={handleBackNavigation}>
        <Ionicons name="arrow-back" size={16} color="#fff" />
        <Text style={styles.backTextBottom}>Back</Text>
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setFilterModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setFilterModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeFilterType === 'All Goals' ? 'Filter goal' :
                 activeFilterType === 'Any Duration' ? 'Filter duration' :
                 activeFilterType === 'All equipment' ? 'Filter equipment' :
                 activeFilterType === 'All levels' ? 'Filter level' :
                 activeFilterType === 'All workouts' ? 'Filter workout' :
                 activeFilterType === 'Creator' ? 'Filter creator' : 'Filter'}
              </Text>
              <TouchableOpacity onPress={handleClearFilter}>
                <Text style={styles.modalClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalOptionsList}>
              {activeFilterType && filterOptions[activeFilterType]?.map((option) => {
                const key = filterKeys[activeFilterType];
                // Creator uses radio button (single selection), others use checkbox (multiple selection)
                const isSelected = activeFilterType === 'Creator' 
                  ? selectedOptions[key] === option
                  : selectedOptions[key]?.includes(option);
                const isRadioButton = activeFilterType === 'Creator';
                
                return (
                  <TouchableOpacity
                    key={option}
                    style={styles.modalOptionItem}
                    onPress={() => handleOptionToggle(option)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalOptionText}>{option}</Text>
                    <View style={[
                      isRadioButton ? styles.modalRadioButton : styles.modalCheckbox,
                      isSelected && (isRadioButton ? styles.modalRadioButtonSelected : styles.modalCheckboxSelected)
                    ]}>
                      {isSelected && (
                        isRadioButton ? (
                          <View style={styles.modalRadioButtonInner} />
                        ) : (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
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

      {/* Workout options bottom modal (Edit / Delete) for My Workouts */}
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
            style={[styles.workoutOptionsItem, styles.workoutOptionsItemDanger]}
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
  container: { flex: 1, backgroundColor: '#f7f8f2' },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingTop: 80 
  },
  loadingText: { 
    marginTop: 12, 
    fontSize: 13, 
    color: '#888',
    fontWeight: '500'
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 20
  },
  errorText: { 
    fontSize: 13, 
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500'
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
    fontSize: 13,
    letterSpacing: 0.3
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: '5%',
    paddingBottom: 12,
    backgroundColor: '#f7f8f2',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerBackButton: {
    marginRight: 12,
    padding: 8,
  },
  menuButton: {
    marginLeft: 12,
    padding: 8,
  },
  filterContainer: {
    backgroundColor: '#f7f8f2',
    paddingVertical: 10,
  },
  filterContentContainer: {
    paddingHorizontal: '5%',
    paddingVertical: 8,
    alignItems: 'center',
    paddingRight: '10%',
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
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
    fontSize: 12,
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
  modalRadioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modalRadioButtonSelected: {
    borderColor: '#222',
  },
  modalRadioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#222',
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
  backgroundUpdateIndicator: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 8,
    zIndex: 1000,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backgroundUpdateText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: '5%' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: '#1a1a1a', marginTop: 10, marginBottom: 4 },
  calendarBtn: { padding: 6, borderRadius: 16, backgroundColor: '#eceee7' },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, flex: 1, height: 40, elevation: 2 },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 10, color: '#1a1a1a', paddingVertical: 0 },
  sectionLabel: { fontWeight: 'bold', fontSize: 20, marginTop: 2, marginBottom: 10, marginLeft: '5%', color: '#1a1a1a' },
  categorySection: { marginBottom: 0 },
  categoryHeader: { 
    fontWeight: 'bold', 
    fontSize: 20, 
    marginTop: 0, 
    marginBottom: 4, 
    marginLeft: '5%', 
    color: '#1a1a1a',
    textTransform: 'capitalize'
  },
  createWorkoutBox: { width:'70%', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#bbb', borderRadius: 16, height: 160, justifyContent: 'center', alignItems: 'center', marginHorizontal: '5%', marginBottom: 12, backgroundColor: '#fff', padding: 14 },
  createWorkoutText: { color: '#1a1a1a', fontWeight: '600', fontSize: 13, marginTop: 6, letterSpacing: 0.3 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: '5%', marginTop: 18 },
  showAll: { color: '#888', fontWeight: '600', fontSize: 13, letterSpacing: 0.3 },
  horizontalCardsRow: { marginHorizontal: '5%', marginBottom: 10 },
  workoutCard: { position: 'relative', width: '48%', height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  workoutCardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  workoutCardPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  workoutCardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  workoutCardMenuButton: { position: 'absolute', top: 10, right: 10, padding: 6, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20 },
  workoutCardTextBox: { position: 'absolute', left: 0, bottom: 0, padding: 14 },
  workoutOptionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  workoutOptionsSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 34, paddingHorizontal: 20 },
  workoutOptionsHandle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  workoutOptionsItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4, gap: 12 },
  workoutOptionsItemDanger: {},
  workoutOptionsItemText: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  workoutOptionsItemTextDanger: { color: '#c62828' },
  workoutCardTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 4, lineHeight: 18 },
  workoutCardSubtitle: { color: '#fff', fontSize: 11, fontWeight: '600' },
  backButton: { flexDirection: 'row', bottom: '5%', alignItems: 'center',  paddingHorizontal: 5, paddingVertical: 10, marginTop: 10, alignSelf: 'center' },
  backText: { color: '#fff', marginLeft: 8, fontWeight: '600', fontSize: 13, letterSpacing: 0.3 },
  backButtonBottom: { flexDirection: 'row', backgroundColor: '#222', borderRadius: 20, bottom: '5%', alignItems: 'center',  paddingHorizontal: 25, paddingVertical: 15, marginTop: 10, alignSelf: 'center' },
  backTextBottom: { color: '#fff', marginLeft: 8, fontWeight: '600', fontSize: 13, letterSpacing: 0.3 },
  emptyText: { 
    color: '#888', 
    fontSize: 13, 
    fontStyle: 'italic',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  emptySectionContainer: {
    paddingVertical: 20,
    paddingHorizontal: '5%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  emptySectionText: {
    color: '#999',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  sectionLoadingContainer: {
    paddingVertical: 30,
    paddingHorizontal: '5%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  sectionLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  noWorkoutsContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 20
  },
  noWorkoutsIconContainer: {
    marginBottom: 24,
    opacity: 0.7
  },
  noWorkoutsTitle: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#666',
    marginBottom: 6,
    textAlign: 'center'
  },
  noWorkoutsSubtitle: { 
    fontSize: 12, 
    color: '#999',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 32,
    paddingHorizontal: 20
  },
  createWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 20,
    marginBottom: 16,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  createWorkoutButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.3
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8
  },
  refreshButtonText: {
    color: '#222',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3
  },
  refreshButtonTextSecondary: {
    color: '#222',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3
  },
});

export default WorkoutScreen;
