import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Animated, Dimensions, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import BottomNavBar from '../components/BottomNavBar';
import { useNavigation } from '@react-navigation/native';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataCache } from '../utils/dataCache';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { useFocusEffect } from '@react-navigation/native';
import { fetchAssignedWorkoutDetails } from '../api/workouts';


// Dashboard filters based on actual app sections
const dashboardSections = [
  {
    label: 'WORKOUTS',
    icon: 'dumbbell',
    value: 'workouts',
  },
  {
    label: 'NUTRITION',
    icon: 'food-apple-outline',
    value: 'nutrition',
  },
  {
    label: 'SCHEDULE',
    icon: 'calendar-outline',
    value: 'schedule',
  },
  {
    label: 'CHALLENGES',
    icon: 'trophy',
    value: 'challenges',
  },
];

const weeklyChallengeImage = require('../assets/images/weeklychallenge.png');
const fitnessIcon = require('../assets/images/activity.png');
const nutritionIcon = require('../assets/images/calories.png');
const scheduleIcon = require('../assets/images/activity.png'); // Using activity icon as fallback

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Dashboard() {
  const navigation = useNavigation();
  const { logout } = useAuth();
  const { unreadCount, refresh: refreshUnreadCount } = useUnreadNotifications();
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState('Home');
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('workouts');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const cardAnims = useRef([...Array(6)].map(() => ({
    scale: new Animated.Value(0.97),
    opacity: new Animated.Value(0),
  }))).current;
  const animatedCardCountRef = useRef(0);
  const lastAnimatedFilterRef = useRef(selectedFilter);

  const ensureCardAnims = (count) => {
    while (cardAnims.length < count) {
      cardAnims.push({
        scale: new Animated.Value(0.97),
        opacity: new Animated.Value(0),
      });
    }
  };

  const animateCards = (fromIndex, toCount) => {
    ensureCardAnims(toCount);
    for (let index = fromIndex; index < toCount; index++) {
      const anim = cardAnims[index];
      anim.scale.setValue(0.97);
      anim.opacity.setValue(0);
      Animated.sequence([
        Animated.delay((index - fromIndex) * 50),
        Animated.parallel([
          Animated.spring(anim.scale, {
            toValue: 1,
            tension: 120,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  };
  
  const API_BASE_URL = ENV_API_BASE_URL;
  
  // Refresh unread count when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  // Animate on mount and when data changes
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  // Animate cards when data loads or when new items are added
  useEffect(() => {
    if (data.length === 0 || loading) {
      return;
    }

    const filterChanged = lastAnimatedFilterRef.current !== selectedFilter;
    if (filterChanged) {
      lastAnimatedFilterRef.current = selectedFilter;
      animatedCardCountRef.current = 0;
    }

    if (data.length < animatedCardCountRef.current) {
      animatedCardCountRef.current = data.length;
    }

    if (filterChanged || data.length > animatedCardCountRef.current) {
      const fromIndex = filterChanged ? 0 : animatedCardCountRef.current;
      animateCards(fromIndex, data.length);
      animatedCardCountRef.current = data.length;
    }
  }, [data, loading, selectedFilter]);


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

  // Fetch data based on selected filter with caching
  const fetchData = async (forceRefresh = false) => {
    try {
      const cacheKey = `dashboard_${selectedFilter}`;
      
      // Try to load from cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedData = await DataCache.get(cacheKey);
        if (cachedData && cachedData.length > 0) {
          setData(cachedData);
          setLoading(false);
          // Fetch fresh data in background without showing loading spinner
          fetchFreshData(cacheKey, false);
          return;
        } else {
          // No cache exists, show loading spinner
          setLoading(true);
        }
      } else {
        setLoading(true);
      }
      
      // No cache or forced refresh, fetch from API and show loading
      await fetchFreshData(cacheKey, true);
    } catch (error) {
      console.error('Error in fetchData:', error);
      setLoading(false);
    }
  };

  console.log('API_BASE_URL:', API_BASE_URL);

  const fetchFreshData = async (cacheKey, showLoadingSpinner = true) => {
    try {
      // Use token utility for consistent token handling
      const { getAuthToken } = require('../utils/tokenUtils');
      const authHeader = await getAuthToken();
      
      if (!authHeader) {
        console.warn('No auth token available for Dashboard fetch');
        setLoading(false);
        return;
      }

      let endpoint = '';
      switch (selectedFilter) {
        case 'workouts':
          endpoint = `${API_BASE_URL}/mobile/member-workouts`;
          break;
        case 'nutrition':
          endpoint = `${API_BASE_URL}/mobile/nutrition/assigned-meals`;
          break;
        case 'schedule':
          endpoint = `${API_BASE_URL}/mobile/schedule/my-bookings`;
          break;
        case 'challenges':
          endpoint = `${API_BASE_URL}/mobile/challenges/member`;
          break;
        default:
          endpoint = `${API_BASE_URL}/mobile/member-workouts`;
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        // Extract data from response - different endpoints have different structures
        let items = [];
        if (selectedFilter === 'schedule') {
          items = result.data || result.schedules || [];
        } else if (selectedFilter === 'workouts') {
          // Assigned workouts endpoint returns { workouts: [...] }
          items = result.workouts || result.data || [];
        } else if (selectedFilter === 'nutrition') {
          // Assigned meals endpoint returns { data: [...] } or direct array
          items = result.data || result || [];
        } else {
          items = result.data || [];
        }
        
        // Log the response structure for challenges to debug
        if (selectedFilter === 'challenges' && items.length > 0) {
          console.log('=== Challenges Response Debug ===');
          console.log('First item structure:', JSON.stringify(items[0], null, 2));
          console.log('================================');
        }
        
        const limitedItems = items.slice(0, 3);
        
        // Update state
        setData(limitedItems);
        
        // Cache the data
        await DataCache.set(cacheKey, limitedItems);
      } else {
        // Log detailed error information
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        
        console.error('=== Dashboard API Error ===');
        console.error('Status:', response.status);
        console.error('URL:', endpoint);
        console.error('Error:', JSON.stringify(errorData, null, 2));
        console.error('==========================');
        
        // If 401, token might be invalid
        if (response.status === 401) {
          console.warn('401 Unauthorized - Token might be invalid or expired');
        }
        
        setData([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setData([]);
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    animatedCardCountRef.current = 0;
    lastAnimatedFilterRef.current = selectedFilter;
    fetchData(false); // Don't force refresh on mount
  }, [selectedFilter]);

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    animatedCardCountRef.current = 0;
    // Force refresh data
    await fetchData(true);
    // Also refresh unread notifications count
    refreshUnreadCount();
    setRefreshing(false);
  };

  const renderMenuItem = (item) => {
    let IconComponent = MaterialCommunityIcons;
    const isSelected = selectedFilter === item.value;
    
    return (
      <TouchableOpacity
        style={[
          styles.filterChip,
          isSelected ? styles.filterChipSelected : styles.filterChipUnselected,
        ]}
        onPress={() => setSelectedFilter(item.value)}
        activeOpacity={0.8}
      >
        <View style={styles.filterIconCircle}>
          <IconComponent name={item.icon} size={20} color={isSelected ? '#fff' : '#222'} />
        </View>
        <Text style={[styles.filterText, isSelected ? styles.filterTextSelected : styles.filterTextUnselected]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const getIconForFilter = () => {
    switch (selectedFilter) {
      case 'workouts':
        return fitnessIcon;
      case 'nutrition':
        return nutritionIcon;
      case 'schedule':
        return scheduleIcon;
      default:
        return fitnessIcon;
    }
  };

  const renderDataCard = (item, index) => {
    const iconSource = getIconForFilter();
    
    // Handle different data structures based on filter type
    let title = 'Item';
    if (selectedFilter === 'challenges') {
      // Challenges have nested structure: item.challenge.name
      const challenge = item.challenge || {};
      title = challenge.name || item.name || 'Challenge';
    } else if (selectedFilter === 'workouts') {
      // Assigned workouts can have different field names
      title = item.exercise_name || item.workout_name || item.name || item.title || 'Workout';
    } else if (selectedFilter === 'nutrition') {
      // Nutrition items have template.name, name, or meal_name
      title = item.template?.name || item.name || item.meal_name || 'Nutrition Plan';
    } else {
      // For schedule
      title = item.activity_name || item.title || item.name || 'Schedule';
    }
    
    // Calculate duration based on filter type
    let duration = '30 min';
    if (selectedFilter === 'schedule') {
      // Calculate duration from start_time and end_time for schedules
      const startTime = item.start_time || '';
      const endTime = item.end_time || '';
      if (startTime && endTime) {
        try {
          const [startHour, startMin] = startTime.split(':').map(Number);
          const [endHour, endMin] = endTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          const durationMinutes = endMinutes - startMinutes;
          if (durationMinutes > 0) {
            duration = `${durationMinutes} min`;
          }
        } catch (e) {
          console.error('Error calculating duration:', e);
          duration = item.duration ? `${item.duration} min` : '30 min';
        }
      } else {
        duration = item.duration ? `${item.duration} min` : '30 min';
      }
    } else {
      // For workouts and other filters, use item.duration
      duration = item.duration ? `${item.duration} min` : '30 min';
    }
    const sets = item.sets || item.total_sets || 'N/A';
    const reps = item.reps || item.total_reps || 'N/A';
    
    // Handle level/difficulty for different filter types
    let level = 'Intermediate';
    if (selectedFilter === 'challenges') {
      const challenge = item.challenge || {};
      level = challenge.difficulty || challenge.level || challenge.status || 'Active';
    } else {
      level = item.level || item.difficulty || 'Intermediate';
    }
    const cardAnim = cardAnims[index] || { scale: new Animated.Value(1), opacity: new Animated.Value(1) };
    const uniqueKey = item.id || `card-${index}-${selectedFilter}`;
    
    return (
      <Animated.View
        key={uniqueKey}
        style={{
          transform: [{ scale: cardAnim.scale }],
          opacity: cardAnim.opacity,
        }}
      >
        <TouchableOpacity 
          style={styles.card}
          activeOpacity={0.85}
          onPress={async () => {
            if (selectedFilter === 'workouts' && item.id) {
              // Fetch detailed workout data before navigating (similar to WorkoutScreen)
              // This ensures activities are available in WorkoutDetailsScreen
              try {
                const workoutDetails = await fetchAssignedWorkoutDetails(item.id);
                if (workoutDetails) {
                  // Extract the workout data from the API response
                  const detailedWorkout = workoutDetails.workout || workoutDetails.data || workoutDetails;
                  
                  // Merge original workout data with detailed workout to preserve title from card
                  const mergedWorkout = {
                    ...detailedWorkout,
                    // Preserve title properties from original workout card
                    exercise_name: item.exercise_name || detailedWorkout.exercise_name || item.name || item.workout_name || 'Workout',
                    name: item.name || detailedWorkout.name || item.exercise_name || item.workout_name || 'Workout',
                    workout_name: item.workout_name || detailedWorkout.workout_name || item.exercise_name || item.name || 'Workout',
                  };
                  
                  navigation.navigate('WorkoutDetails', { 
                    workout: mergedWorkout,
                    isFromAllWorkouts: true, // From dashboard - no start workout session
                    canStartWorkout: false 
                  });
                } else {
                  // Fallback to basic workout data if details fetch fails
                  navigation.navigate('WorkoutDetails', { 
                    workout: item,
                    isFromAllWorkouts: true,
                    canStartWorkout: false 
                  });
                }
              } catch (error) {
                console.error('Error fetching workout details:', error);
                // Fallback to basic workout data
                navigation.navigate('WorkoutDetails', { 
                  workout: item,
                  isFromAllWorkouts: true,
                  canStartWorkout: false
                });
              }
            } else if (selectedFilter === 'nutrition' && item.id) {
              navigation.navigate('NutritionDetails', { nutrition: item });
            } else if (selectedFilter === 'schedule' && item.id) {
              navigation.navigate('ScheduleDetail', { eventId: item.id, event: item });
            } else if (selectedFilter === 'challenges' && item.id) {
              navigation.navigate('ChallengesScreen');
            }
          }}
        >
          <LinearGradient
            colors={['#fff', '#fafafa']}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconCircle, styles.cardIconCircleAnimated]}>
                <Image source={iconSource} style={styles.cardIconImg} resizeMode="contain" />
              </View>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{level}</Text>
              </View>
            </View>
            
            <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
            
            {selectedFilter !== 'nutrition' && selectedFilter !== 'challenges' && (
              <View style={styles.cardStatsRow}>
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="timer-outline" size={14} color="#666" />
                  <Text style={styles.statText}>{duration}</Text>
                </View>
              </View>
            )}
            
            <View style={styles.cardFooter}>
              <View style={styles.cardFooterIcon}>
                <MaterialCommunityIcons name="chevron-right" size={16} color="#000" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
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
        onNotificationPress={() => navigation.navigate('NotificationScreen')}
        notificationCount={unreadCount}
      />
      <ScrollView 
        contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: 140 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000"
            colors={['#000']}
          />
        }
      >
        {/* My Progress */}
        <Animated.View 
          style={[
            styles.titleContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <Text style={styles.title}>My Progress</Text>
          <Text style={styles.subtitle}>Track your fitness journey</Text>
        </Animated.View>
        
        {/* Filter Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {dashboardSections.map((item) => {
            let IconComponent = MaterialCommunityIcons;
            const isSelected = selectedFilter === item.value;
            
            return (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.filterChip,
                  isSelected ? styles.filterChipSelected : styles.filterChipUnselected,
                ]}
                onPress={() => setSelectedFilter(item.value)}
                activeOpacity={0.8}
              >
                <View style={styles.filterIconCircle}>
                  <IconComponent name={item.icon} size={20} color={isSelected ? '#fff' : '#222'} />
                </View>
                <Text style={[styles.filterText, isSelected ? styles.filterTextSelected : styles.filterTextUnselected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Data Cards */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.loadingText}>Loading your data...</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.cardsRow}
            contentContainerStyle={styles.cardsRowContent}
          >
            {data.length > 0 ? (
              data.map((item, idx) => renderDataCard(item, idx))
            ) : (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="information-outline" size={48} color="#ccc" />
                <Text style={styles.emptyTitle}>No {selectedFilter} found</Text>
                <Text style={styles.emptySubtitle}>Check back later for new content</Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Weekly Challenges Banner */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <TouchableOpacity 
            style={styles.challengeBanner}
            onPress={() => navigation.navigate('ChallengesScreen')}
            activeOpacity={0.9}
          >
            <Image source={weeklyChallengeImage} style={styles.challengeImage} />
            <LinearGradient
              colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.3)']}
              style={styles.challengeOverlay}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={styles.challengeContent}>
              <View style={styles.challengeBadge}>
                <MaterialCommunityIcons name="trophy" size={16} color="#FFD700" />
                <Text style={styles.challengeBadgeText}>WEEKLY</Text>
              </View>
              <Text style={styles.challengeText}>CHALLENGES</Text>
              <Text style={styles.challengeSubtext}>Join the competition</Text>
            </View>
            <TouchableOpacity 
              style={styles.challengeArrow}
              onPress={() => navigation.navigate('ChallengesScreen')}
            >
              <View style={styles.challengeArrowCircle}>
                <Ionicons name="arrow-forward" size={20} color="#000" />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavBar
        selectedTab={selectedTab}
        navigation={navigation}
        onTabChange={setSelectedTab}
      />
      
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
    paddingHorizontal: 20,
  },
  titleContainer: {
    marginBottom: 22,
    marginTop: 10,
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
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 18,
    maxHeight: 40,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 10,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  filterChipSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  filterChipUnselected: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
  },
  filterIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filterText: {
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  filterTextSelected: {
    color: '#fff',
  },
  filterTextUnselected: {
    color: '#333',
  },
  cardsRow: {
    flexGrow: 0,
    marginBottom: 18,
    marginHorizontal: -20,
  },
  cardsRowContent: {
    paddingHorizontal: 20,
    paddingRight: 32,
  },
  card: {
    borderRadius: 16,
    marginRight: 12,
    marginBottom: 12,
    width: 160,
    height: 170,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    height: '100%',
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  cardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f7f8f2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8e9e4',
  },
  cardIconCircleAnimated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIconImg: {
    width: 20,
    height: 20,
  },
  badgeContainer: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8,
    color: '#1a1a1a',
    lineHeight: 18,
    height: 36,
  },
  cardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  cardFooter: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  cardFooterIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  emptyCard: {
    width: 160,
    height: 180,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    textAlign: 'center',
  },
  challengeBanner: {
    position: 'relative',
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  challengeImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  challengeOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  challengeContent: {
    position: 'absolute',
    left: 20,
    top: 30,
    zIndex: 2,
  },
  challengeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  challengeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  challengeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  challengeSubtext: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 4,
  },
  challengeArrow: {
    position: 'absolute',
    right: 20,
    top: 20,
    zIndex: 2,
  },
  challengeArrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});    