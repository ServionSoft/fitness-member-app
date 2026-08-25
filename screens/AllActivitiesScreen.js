import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Dimensions, Image, ActivityIndicator, FlatList } from 'react-native';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataCache } from '../utils/dataCache';
import { API_BASE_URL, BASE_URL } from '../utils/apiConfig';
import ModernAlert from '../components/ModernAlert';

const { width: screenWidth } = Dimensions.get('window');

const AllActivitiesScreen = () => {
  const { userData, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const navigation = useNavigation();

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

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const cacheKey = 'all_activities_full';
      const cachedData = await DataCache.get(cacheKey);
      if (cachedData && cachedData.length > 0) {
        setActivities(cachedData);
        setLoading(false);
      }

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      let authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
      
      // Fetch all activities with pagination
      let allActivities = [];
      let currentPage = 1;
      let hasMorePages = true;
      const perPage = 250; // Request all items in one go, or large number
      
      while (hasMorePages) {
        const response = await fetch(`${API_BASE_URL}/mobile/workout-activities?page=${currentPage}&per_page=${perPage}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`Activities API Response (Page ${currentPage}):`, JSON.stringify(result, null, 2));
          console.log(`Response structure check:`, {
            hasData: !!result.data,
            isDataArray: Array.isArray(result.data),
            hasDataData: !!(result.data && result.data.data),
            isDataDataArray: !!(result.data && Array.isArray(result.data.data)),
            lastPage: result.last_page || result.data?.last_page,
            currentPage: result.current_page || result.data?.current_page,
            total: result.total || result.data?.total,
          });
          
          let pageData = [];
          let paginationInfo = null;
          
          // Check if response is paginated (Laravel style)
          if (result.data && Array.isArray(result.data.data)) {
            // Nested paginated response (Laravel pagination)
            pageData = result.data.data;
            paginationInfo = result.data;
            console.log(`Found nested pagination:`, {
              currentPage: paginationInfo.current_page,
              lastPage: paginationInfo.last_page,
              total: paginationInfo.total,
              perPage: paginationInfo.per_page,
              pageDataLength: pageData.length,
            });
          } else if (result.data && Array.isArray(result.data)) {
            // Direct array pagination
            pageData = result.data;
            paginationInfo = result;
            console.log(`Found direct pagination:`, {
              currentPage: paginationInfo.current_page,
              lastPage: paginationInfo.last_page,
              total: paginationInfo.total,
              pageDataLength: pageData.length,
            });
          } else if (Array.isArray(result.data)) {
            // Simple array response
            pageData = result.data;
            console.log(`Found simple array, length:`, pageData.length);
          } else {
            // Non-paginated response - single array
            pageData = result.data || [];
            console.log(`Non-paginated response, length:`, pageData.length);
          }
          
          allActivities = [...allActivities, ...pageData];
          console.log(`Total activities so far: ${allActivities.length}`);
          
          // Determine if there are more pages
          if (paginationInfo) {
            if (paginationInfo.last_page && currentPage < paginationInfo.last_page) {
              currentPage++;
              console.log(`More pages available. Moving to page ${currentPage}`);
            } else if (paginationInfo.total && allActivities.length < paginationInfo.total) {
              currentPage++;
              console.log(`More items available. Moving to page ${currentPage}`);
            } else {
              hasMorePages = false;
              console.log(`No more pages. Total fetched: ${allActivities.length}`);
            }
          } else {
            // No pagination info - check if we got fewer items than requested
            if (pageData.length < perPage) {
              hasMorePages = false;
              console.log(`Received fewer items than requested. Stopping.`);
            } else {
              // Try next page to see if there's more
              currentPage++;
              console.log(`No pagination info. Trying page ${currentPage} to check for more data.`);
            }
          }
          
          // Safety limit - don't fetch more than 10 pages
          if (currentPage > 10) {
            hasMorePages = false;
            console.log(`Reached safety limit of 10 pages. Stopping.`);
          }
        } else {
          // If first page fails, show error
          if (currentPage === 1) {
            const errorData = await response.json();
            console.error('Activities API Error Response:', errorData);
            setError('Failed to fetch activities');
            hasMorePages = false;
          } else {
            // If later page fails, just stop fetching more
            hasMorePages = false;
            console.log(`Page ${currentPage} failed. Stopping pagination.`);
          }
        }
      }
      
      console.log(`Total activities fetched: ${allActivities.length}`);
      setActivities(allActivities);
      if (allActivities.length > 0) await DataCache.set(cacheKey, allActivities);
      
    } catch (error) {
      console.error('Error fetching activities:', error);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // Use memoized filtered activities directly - no need for separate state

  // Memoize thumbnail URL processing - pre-process all URLs once
  const processedActivities = useMemo(() => {
    return activities.map(item => {
      let thumbnailUrl = null;
      if (item.thumbnail_url) {
        const match = item.thumbnail_url.match(/thumbnails\/(.+)$/);
        if (match) {
          const filename = encodeURIComponent(match[1]);
          thumbnailUrl = `${BASE_URL}/thumbnails/${filename}`;
        } else if (item.thumbnail_url.startsWith('http') && !item.thumbnail_url.includes('localhost/APP_URL')) {
          thumbnailUrl = item.thumbnail_url;
        }
      } else if (item.thumbnail) {
        const match = item.thumbnail.match(/thumbnails\/(.+)$/);
        if (match) {
          const filename = encodeURIComponent(match[1]);
          thumbnailUrl = `${BASE_URL}/thumbnails/${filename}`;
        } else if (item.thumbnail.startsWith('http') && !item.thumbnail.includes('localhost/APP_URL')) {
          thumbnailUrl = item.thumbnail;
        }
      }
      return {
        ...item,
        processedThumbnailUrl: thumbnailUrl,
        activityId: item.id || item.activity_id || item.exercise_id,
      };
    });
  }, [activities]);

  // Memoize filtered activities
  const filteredActivitiesMemo = useMemo(() => {
    if (!search.trim()) {
      return processedActivities;
    }
    const searchLower = search.toLowerCase();
    return processedActivities.filter(activity => {
      const name = (activity.exercise_name || activity.name || '').toLowerCase();
      const category = (activity.category || '').toLowerCase();
      return name.includes(searchLower) || category.includes(searchLower);
    });
  }, [search, processedActivities]);


  // Memoized card component for better performance
  const ActivityCard = React.memo(({ item, index, onPress }) => {
    const category = item.category || 'General';
    const thumbnailUrl = item.processedThumbnailUrl;
    const cardWidth = (screenWidth - 60) / 2;
    
    return (
      <TouchableOpacity
        style={[
          styles.activityCard,
          { width: cardWidth, marginRight: index % 2 === 0 ? 12 : 0 }
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {thumbnailUrl ? (
          <Image 
            source={{ uri: thumbnailUrl }} 
            style={styles.activityCardImage}
            resizeMode="cover"
            defaultSource={require('../assets/images/fitness-model.png')}
          />
        ) : (
          <View style={styles.activityCardPlaceholder}>
            <MaterialCommunityIcons name="dumbbell" size={48} color="#ccc" />
          </View>
        )}
        <View style={styles.activityCardOverlay} />
        <View style={styles.activityCardTextBox}>
          <Text style={styles.activityCardTitle} numberOfLines={2}>
            {item.exercise_name || item.name}
          </Text>
          <Text style={styles.activityCardSubtitle}>{category}</Text>
        </View>
      </TouchableOpacity>
    );
  });

  // Memoized render function
  const renderActivityCard = useCallback(({ item, index }) => {
    const activityId = item.activityId;
    
    return (
      <ActivityCard
        item={item}
        index={index}
        onPress={() => {
          if (activityId || item) {
            navigation.navigate('ActivityDetails', { 
              activity: item, 
              activityId: activityId 
            });
          }
        }}
      />
    );
  }, [navigation]);

  // Memoized key extractor
  const keyExtractor = useCallback((item, index) => {
    return (item.activityId || index).toString();
  }, []);

  // Calculate item layout for better performance
  const getItemLayout = useCallback((data, index) => {
    const cardWidth = (screenWidth - 60) / 2;
    const cardHeight = 160;
    const row = Math.floor(index / 2);
    const isEven = index % 2 === 0;
    const marginRight = isEven ? 12 : 0;
    
    return {
      length: cardHeight + 12, // height + marginBottom
      offset: row * (cardHeight + 12),
      index,
    };
  }, []);

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
        title="All Activities"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <View style={{ paddingTop: 80, flex: 1 }}>
        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={20} color="#888" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search activities..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#bbb"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#222" />
            <Text style={styles.loadingText}>Loading activities...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchActivities}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredActivitiesMemo.length > 0 ? (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsText}>
                {filteredActivitiesMemo.length} {filteredActivitiesMemo.length === 1 ? 'activity' : 'activities'} found
              </Text>
            </View>
            <FlatList
              data={filteredActivitiesMemo}
              renderItem={renderActivityCard}
              keyExtractor={keyExtractor}
              numColumns={2}
              contentContainerStyle={styles.activitiesList}
              showsVerticalScrollIndicator={false}
              columnWrapperStyle={styles.row}
              getItemLayout={getItemLayout}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={10}
              windowSize={10}
              legacyImplementation={false}
            />
          </>
        ) : (
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
      </View>

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
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  errorText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3,
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
  activitiesList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activityCard: {
    position: 'relative',
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  activityCardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  activityCardPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  activityCardTextBox: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    padding: 12,
    right: 0,
  },
  activityCardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    lineHeight: 18,
  },
  activityCardSubtitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
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
});

export default AllActivitiesScreen;

