import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Dimensions, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataCache } from '../utils/dataCache';
import { API_BASE_URL, BASE_URL } from '../utils/apiConfig';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import ModernAlert from '../components/ModernAlert';


const { width: screenWidth } = Dimensions.get('window');

const DiscoverScreen = () => {
  const { userData, logout } = useAuth();
  const { unreadCount, refresh: refreshUnreadCount } = useUnreadNotifications();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState('Discover');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const navigation = useNavigation();
  
  // Data states
  const [scheduleData, setScheduleData] = useState([]);
  const [workoutData, setWorkoutData] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [loadingWorkout, setLoadingWorkout] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filtered data states for search
  const [filteredScheduleData, setFilteredScheduleData] = useState([]);
  const [filteredWorkoutData, setFilteredWorkoutData] = useState([]);
  const [filteredActivityData, setFilteredActivityData] = useState([]);

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

  // Fetch schedule data with caching
  const fetchScheduleData = async () => {
    try {
      const cacheKey = 'discover_schedule';
      const cachedData = await DataCache.get(cacheKey);
      if (cachedData && cachedData.length > 0) {
        setScheduleData(cachedData);
        setLoadingSchedule(false);
      }

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) return;

      let authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
      
      const response = await fetch(`${API_BASE_URL}/mobile/schedule/all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('=== SCHEDULE API RESPONSE (/mobile/schedule/all) ===');
        console.log('Full response:', JSON.stringify(result, null, 2));
        console.log('result.data:', result.data);
        const data = result.data || [];
        setScheduleData(data);
        if (data.length > 0) await DataCache.set(cacheKey, data);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Fetch workouts data with caching
  const fetchWorkoutData = async () => {
    try {
      const cacheKey = 'discover_workouts';
      const cachedData = await DataCache.get(cacheKey);
      if (cachedData && cachedData.length > 0) {
        setWorkoutData(cachedData);
        setLoadingWorkout(false);
      }

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) return;

      let authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
      
      const response = await fetch(`${API_BASE_URL}/mobile/workouts/all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const data = (result.data || []).slice(0, 5);
        setWorkoutData(data);
        if (data.length > 0) await DataCache.set(cacheKey, data);
      }
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoadingWorkout(false);
    }
  };

  // Fetch activities data with caching
  const fetchActivityData = async () => {
    try {
      const cacheKey = 'discover_activities';
      const cachedData = await DataCache.get(cacheKey);
      if (cachedData && cachedData.length > 0) {
        setActivityData(cachedData);
        setLoadingActivity(false);
      }

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) return;

      let authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
      
      const response = await fetch(`${API_BASE_URL}/mobile/workout-activities`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const data = (result.data || []).slice(0, 6);
        setActivityData(data);
        if (data.length > 0) await DataCache.set(cacheKey, data);
      } else {
        const errorData = await response.json();
        console.error('Activity API Error Response:', errorData);
        console.error('Activity API Error Status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoadingActivity(false);
    }
  };

  // Filter function for search
  const filterBySearch = (items, searchQuery, type) => {
    if (!searchQuery || searchQuery.trim() === '') {
      return items;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return items.filter(item => {
      if (type === 'schedule') {
        const scheduleTitle = (item.activity_name || item.title || '').toLowerCase();
        const scheduleLocation = (item.location || '').toLowerCase();
        const scheduleTime = ((item.start_time || '') + ' ' + (item.end_time || '')).toLowerCase();
        return scheduleTitle.includes(query) || 
               scheduleLocation.includes(query) || 
               scheduleTime.includes(query);
      } else if (type === 'workout') {
        const workoutName = (item.exercise_name || item.name || '').toLowerCase();
        const workoutLevel = (item.level || '').toLowerCase();
        const workoutDuration = (item.duration ? `${item.duration} min` : '').toLowerCase();
        return workoutName.includes(query) || 
               workoutLevel.includes(query) || 
               workoutDuration.includes(query);
      } else if (type === 'activity') {
        const activityName = (item.exercise_name || item.name || '').toLowerCase();
        const activityCategory = (item.category || '').toLowerCase();
        return activityName.includes(query) || 
               activityCategory.includes(query);
      }
      return true;
    });
  };

  // Apply search filter when search or data changes
  useEffect(() => {
    setFilteredScheduleData(filterBySearch(scheduleData, search, 'schedule'));
  }, [scheduleData, search]);

  useEffect(() => {
    setFilteredWorkoutData(filterBySearch(workoutData, search, 'workout'));
  }, [workoutData, search]);

  useEffect(() => {
    setFilteredActivityData(filterBySearch(activityData, search, 'activity'));
  }, [activityData, search]);

  useEffect(() => {
    fetchScheduleData();
    fetchWorkoutData();
    fetchActivityData();
  }, []);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear cache and refetch all data
      await Promise.all([
        DataCache.clear('discover_schedule'),
        DataCache.clear('discover_workouts'),
        DataCache.clear('discover_activities'),
      ]);
      
      // Refetch all data
      await Promise.all([
        fetchScheduleData(),
        fetchWorkoutData(),
        fetchActivityData(),
      ]);
      
      // Refresh unread count
      refreshUnreadCount();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Refresh unread count when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

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
        notificationCount={unreadCount}
      />
      <ScrollView 
        contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: 140, flexGrow: 1 }} 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#222"
            colors={['#222']}
          />
        }
      >
        {/* Title */}
        <Text style={styles.title}>Discover</Text>
        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={20} color="#888" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search classes and more"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#bbb"
          />
        </View>
        {/* Schedule Section */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Schedule</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ScheduleScreen')}>
            <Text style={styles.showAll}>Show all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalCardsRow}>
          {loadingSchedule ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#222" />
            </View>
          ) : filteredScheduleData.length > 0 ? (
            filteredScheduleData.slice(0, 3).map((item, idx) => {
              const title = item.activity_name || item.title || 'Scheduled Event';
              const startTime = item.start_time || '';
              const endTime = item.end_time || '';
              const timeText = startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || '';
              const location = item.location || '';
              
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
              
              const subtitle = [timeText, durationText, location].filter(Boolean).join(' · ') || '';
              
              return (
                <TouchableOpacity
                  key={item.id || idx}
                  style={[styles.discoverCard, { width: screenWidth * 0.58, marginRight: idx === filteredScheduleData.length - 1 ? 0 : 12 }]}
                  onPress={() => item.id && navigation.navigate('ScheduleDetail', { eventId: item.id, event: item })}
                >
                  {item.thumbnail ? (
                    <Image source={{ uri: `${BASE_URL}/${item.thumbnail}` }} style={styles.discoverCardImage} />
                  ) : (
                    <View style={styles.discoverCardPlaceholder}>
                      <MaterialCommunityIcons name="calendar-clock" size={48} color="#ccc" />
                    </View>
                  )}
                  <View style={styles.discoverCardOverlay} />
                  <View style={styles.discoverCardTextBox}>
                    <Text style={styles.discoverCardTitle}>{title}</Text>
                    {subtitle ? <Text style={styles.discoverCardSubtitle}>{subtitle}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No schedule available</Text>
          )}
        </ScrollView>
        {/* Workouts Section - Shows My Workouts */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>
            
            
            Workouts</Text>
          <TouchableOpacity onPress={() => navigation.navigate('WorkoutScreen')}>
            <Text style={styles.showAll}>Show all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalCardsRow}>
          {loadingWorkout ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#222" />
            </View>
          ) : filteredWorkoutData.length > 0 ? (
            filteredWorkoutData.map((item, idx) => {
              const duration = item.duration ? `${item.duration} min` : 'N/A';
              const level = item.level || 'Intermediate';
              return (
                <TouchableOpacity
                  key={item.id || idx}
                  style={[styles.discoverCard, { width: screenWidth * 0.58, marginRight: idx === filteredWorkoutData.length - 1 ? 0 : 12 }]}
                  onPress={() => item.id && navigation.navigate('WorkoutDetails', { 
                    workout: item,
                    isFromAllWorkouts: true, // From discover page - no start workout session
                    canStartWorkout: false 
                  })}
                >
                  {item.thumbnail ? (
                    <Image source={{ uri: `${BASE_URL}/${item.thumbnail}` }} style={styles.discoverCardImage} />
                  ) : (
                    <View style={styles.discoverCardPlaceholder}>
                      <MaterialCommunityIcons name="dumbbell" size={48} color="#ccc" />
                    </View>
                  )}
                  <View style={styles.discoverCardOverlay} />
                  <View style={styles.discoverCardTextBox}>
                    <Text style={styles.discoverCardTitle}>{item.exercise_name || item.name}</Text>
                    <Text style={styles.discoverCardSubtitle}>{duration} · {level}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No workouts assigned yet</Text>
          )}
        </ScrollView>
        {/* Activities Section */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Activities</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AllActivitiesScreen')}>
            <Text style={styles.showAll}>Show all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalCardsRow}>
          {loadingActivity ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#222" />
            </View>
          ) : filteredActivityData.length > 0 ? (
            filteredActivityData.slice(0, 4).map((item, idx) => {
              const category = item.category || 'General';
              const activityId = item.id || item.activity_id || item.exercise_id;
              
              // Handle thumbnail URL - extract path from malformed URL or use direct path
              let thumbnailUrl = null;
              if (item.thumbnail_url) {
                // Extract path from malformed URL like "http://localhost/APP_URL=http://localhost:8080/thumbnails/filename.jpg"
                const match = item.thumbnail_url.match(/thumbnails\/(.+)$/);
                if (match) {
                  // Encode the filename properly (spaces to %20)
                  const filename = encodeURIComponent(match[1]);
                  thumbnailUrl = `${BASE_URL}/thumbnails/${filename}`;
                } else if (item.thumbnail_url.startsWith('http') && !item.thumbnail_url.includes('localhost/APP_URL')) {
                  // Already a proper URL
                  thumbnailUrl = item.thumbnail_url;
                }
              } else if (item.thumbnail) {
                // Same handling for thumbnail field
                const match = item.thumbnail.match(/thumbnails\/(.+)$/);
                if (match) {
                  const filename = encodeURIComponent(match[1]);
                  thumbnailUrl = `${BASE_URL}/thumbnails/${filename}`;
                } else if (item.thumbnail.startsWith('http') && !item.thumbnail.includes('localhost/APP_URL')) {
                  thumbnailUrl = item.thumbnail;
                }
              }
              
              const imageSource = thumbnailUrl ? { uri: thumbnailUrl } : null;
              
              return (
                <TouchableOpacity
                  key={activityId || idx}
                  style={[styles.discoverCard, { width: screenWidth * 0.58, marginRight: idx === filteredActivityData.length - 1 ? 0 : 12 }]}
                  onPress={() => {
                    if (activityId || item) {
                      navigation.navigate('ActivityDetails', { 
                        activity: item, 
                        activityId: activityId 
                      });
                    }
                  }}
                >
                  {imageSource ? (
                    <Image 
                      source={imageSource} 
                      style={styles.discoverCardImageActivity} 
                      defaultSource={require('../assets/images/fitness-model.png')}
                    />
                  ) : (
                    <View style={styles.discoverCardPlaceholder}>
                      <MaterialCommunityIcons name="dumbbell" size={48} color="#ccc" />
                    </View>
                  )}
                  <View style={styles.discoverCardOverlay} />
                  <View style={styles.discoverCardTextBox}>
                    <Text style={styles.discoverCardTitle}>{item.exercise_name || item.name}</Text>
                    <Text style={styles.discoverCardSubtitle}>{category}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No activities available</Text>
          )}
        </ScrollView>
      </ScrollView>
      {/* Bottom Navigation */}
      <BottomNavBar
        selectedTab={selectedTab}
        navigation={navigation}
        onTabChange={setSelectedTab}
      />

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
  title: { fontSize: 24, fontWeight: 'bold', marginTop: 10, marginLeft: '5%' },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, marginTop: 18, width: '90%', height: 44, elevation: 2, alignSelf: 'center' },
  searchInput: { flex: 1, fontSize: 16, marginLeft: 10, color: '#222', paddingVertical: 0 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: '5%', marginTop: 18, marginBottom: 10 },
  sectionLabel: { fontWeight: '700', fontSize: 16, },
  showAll: { color: '#888', fontWeight: '600', fontSize: 14 },
  horizontalCardsRow: { marginHorizontal: '2%', marginBottom: 3 },
  discoverCard: { position: 'relative', height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 8 },
  discoverCardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  discoverCardImageActivity: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'contain', backgroundColor: '#f5f5f5' },
  discoverCardPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  discoverCardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  discoverCardTextBox: { position: 'absolute', left: 0, bottom: 0, padding: 12 },
  discoverCardTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  discoverCardSubtitle: { color: '#fff', fontSize: 12, fontWeight: '500' },
  loadingContainer: { 
    width: 100, 
    height: 120, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 16,
  },
  emptyText: { 
    color: '#888', 
    fontSize: 13, 
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
});

export default DiscoverScreen; 