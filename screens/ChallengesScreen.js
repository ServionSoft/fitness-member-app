import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import BottomNavBar from '../components/BottomNavBar';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataCache } from '../utils/dataCache';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { useAuth } from '../contexts/AuthContext';
import ModernAlert from '../components/ModernAlert';


const { width: screenWidth } = Dimensions.get('window');

export default function ChallengesScreen() {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState('Discover');
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const navigation = useNavigation();
  
  // Calculate header height: safe area top + 10 (padding) + ~60 (content) + 10 (padding bottom)
  const headerHeight = insets.top + 80;

  const API_BASE_URL = ENV_API_BASE_URL;

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

  // Fetch challenges with caching
  const fetchChallenges = async () => {
    try {
      const cacheKey = 'challenges';
      
      // Try to load from cache first
      const cachedData = await DataCache.get(cacheKey);
      if (cachedData && cachedData.length > 0) {
        console.log('📚 Loading from cache. Challenges:', cachedData.length);
        setChallenges(cachedData);
        setLoading(false);
        // Fetch fresh data in background
        console.log('🔄 Fetching fresh data in background...');
        fetchFreshData(cacheKey);
        return;
      }
      
      // No cache, fetch from API
      console.log('📡 No cache found, fetching from API...');
      await fetchFreshData(cacheKey);
    } catch (error) {
      console.error('❌ Error in fetchChallenges:', error);
      setLoading(false);
    }
  };

  const fetchFreshData = async (cacheKey) => {
    try {
      setLoading(true);
      setError(null);
      
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setLoading(false);
        setError('Authentication required');
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      console.log('🔵 Fetching challenges from:', `${API_BASE_URL}/mobile/challenges/member`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/challenges/member`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Challenges API Response:', JSON.stringify(result, null, 2));
        
        const challengesData = result.data || [];
        console.log('📦 Challenges data array:', challengesData);
        console.log('📊 Number of challenges:', challengesData.length);
        
        setChallenges(challengesData);
        
        // Cache the data
        if (challengesData.length > 0) {
          await DataCache.set(cacheKey, challengesData);
          console.log('💾 Cached challenges data');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to fetch challenges. Status:', response.status);
        console.error('❌ Error response:', errorData);
        setError('Failed to fetch challenges');
        setChallenges([]);
      }
    } catch (error) {
      console.error('❌ Error fetching challenges:', error);
      setError('Network error occurred');
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchChallenges();
    setRefreshing(false);
  };

  // Filter challenges based on search
  const filteredChallenges = challenges.filter(participation => {
    const challenge = participation.challenge || {};
    return (
      challenge.name?.toLowerCase().includes(search.toLowerCase()) ||
      challenge.description?.toLowerCase().includes(search.toLowerCase()) ||
      challenge.goal?.toLowerCase().includes(search.toLowerCase())
    );
  });

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
      {/* Header */}
      <HeaderBar
        onMenuPress={() => setMenuVisible(true)}
      />
      <ScrollView 
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: 140, flexGrow: 1 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Title */}
        <Text style={styles.title}>Challenges</Text>
        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={16} color="#888" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search challenge"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#bbb"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 8 }}>
              <Ionicons name="close-circle" size={16} color="#888" />
            </TouchableOpacity>
          )}
        </View>

        {/* Loading State */}
        {loading && challenges.length === 0 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#222" />
            <Text style={styles.loadingText}>Loading challenges...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={40} color="#999" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchChallenges}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && filteredChallenges.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={40} color="#999" />
            <Text style={styles.emptyText}>No challenges found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search or check back later</Text>
          </View>
        )}

        {/* Challenges List */}
        {!loading && !error && filteredChallenges.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>
              {search ? `Results (${filteredChallenges.length})` : 'Active Challenges'}
            </Text>
            {filteredChallenges.map((participation) => {
              // Extract challenge data from nested structure
              const challenge = participation.challenge || {};
              const imageUri = challenge.image || challenge.image_url || null;
              const challengeTitle = challenge.name || 'Challenge';
              const challengeDesc = challenge.description || challenge.goal || '';
              const challengeDuration = challenge.duration || null;
              const challengeStatus = challenge.status || participation.status || 'Unknown';
              const progress = participation.progress || 0;
              const reward = challenge.reward || null;

              return (
                <TouchableOpacity 
                  key={participation.id || challenge.id} 
                  style={styles.challengeCardRow}
                  onPress={() => navigation.navigate('ChallengeDetails', { participation, challenge })}
                  activeOpacity={0.7}
                >
                  <View style={styles.challengeCardImageBox}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.challengeCardImageLeft} />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons name="trophy" size={28} color="#ccc" />
                      </View>
                    )}
                  </View>
                  <View style={styles.challengeCardTextCol}>
                    <Text style={styles.challengeCardTitle}>{challengeTitle}</Text>
                    <Text style={styles.challengeCardDesc}>{challengeDesc}</Text>
                    {challengeDuration && (
                      <Text style={styles.challengeDuration}>
                        <Ionicons name="time-outline" size={12} color="#666" />
                        {' '}{challengeDuration} days
                      </Text>
                    )}
                    {reward && (
                      <Text style={styles.challengeReward}>
                        <Ionicons name="gift-outline" size={12} color="#666" />
                        {' '}{reward.name} ({reward.points} pts)
                      </Text>
                    )}
                    <View style={styles.progressContainer}>
                      <Text style={styles.progressText}>
                        {challenge.challenge_type === 'workout_based' && challenge.required_workouts && participation.completed_workouts !== null && participation.completed_workouts !== undefined
                          ? `Progress: ${participation.completed_workouts || 0}/${challenge.required_workouts} workouts completed (${Math.round(progress)}%)`
                          : `Progress: ${progress}%`}
                      </Text>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={16} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

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
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8f2' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: '#1a1a1a', marginTop: 10, marginBottom: 4, marginLeft: '5%' },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, marginTop: 18, width: '90%', height: 40, elevation: 2, alignSelf: 'center' },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 10, color: '#1a1a1a', paddingVertical: 0 },
  createChallengeBox: { width:'60%', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#bbb', borderRadius: 14, height: 90, justifyContent: 'center', alignItems: 'center', marginHorizontal: '5%', marginTop: 18, marginBottom: 18, backgroundColor: '#fff' },
  createChallengeText: { color: '#222', fontWeight: '600', fontSize: 15, marginTop: 6 },
  sectionLabel: { fontWeight: 'bold', fontSize: 14, color: '#1a1a1a', marginTop: 18, marginBottom: 10, marginLeft: '5%' },
  challengeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: '5%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    height: 150,
    overflow: 'hidden',
    padding: 14,
  },
  challengeCardImageBox: {
    width: 100,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#f7f8f2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e9e4',
  },
  challengeCardImageLeft: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  challengeCardTextCol: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingRight: 10,
  },
  challengeCardTitle: { color: '#1a1a1a', fontSize: 14, fontWeight: 'bold', marginBottom: 6, lineHeight: 18 },
  challengeCardDesc: { color: '#888', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  backButton: { flexDirection: 'row', bottom: '5%', alignItems: 'center', backgroundColor: '#222', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, position: 'absolute', alignSelf: 'center' },
  backText: { color: '#fff', marginLeft: 8, fontWeight: '600', fontSize: 13, letterSpacing: 0.3 },
  challengeCardFaded: { opacity: 0.5 },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 13,
    color: '#888',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    textAlign: 'center',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeDuration: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    fontWeight: '600',
  },
  challengeReward: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 8,
    width: '100%',
  },
  progressText: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
    fontWeight: '500',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e8e9e4',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#222',
    borderRadius: 3,
  },
}); 