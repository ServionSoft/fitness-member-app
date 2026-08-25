import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import BottomNavBar from '../components/BottomNavBar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getProfileImageSource, ProfileImage } from '../utils/imageUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataCache } from '../utils/dataCache';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

const MembershipScreen = () => {
  const { userData, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState('Profile');
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const navigation = useNavigation();

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

  // Get user's full name
  const getFullName = () => {
    if (userData) {
      const firstName = userData.firstname || '';
      const lastName = userData.lastname || '';
      return `${firstName} ${lastName}`.trim();
    }
    return 'User';
  };

  // Get user's profile image
  const getProfileImage = () => {
    return getProfileImageSource(userData);
  };

  // Fetch subscription plan with caching
  const fetchSubscriptionPlan = async () => {
    try {
      const cacheKey = 'subscription_plan';
      
      // Try to load from cache first
      const cachedData = await DataCache.get(cacheKey);
      if (cachedData) {
        console.log('📚 Loading subscription plan from cache');
        setSubscriptionData(cachedData);
        setFeatures(cachedData.features || []);
        setLoading(false);
        // Fetch fresh data in background
        console.log('🔄 Fetching fresh subscription data in background...');
        fetchFreshData(cacheKey);
        return;
      }
      
      // No cache, fetch from API
      console.log('📡 No cache found, fetching subscription plan from API...');
      await fetchFreshData(cacheKey);
    } catch (error) {
      console.error('❌ Error in fetchSubscriptionPlan:', error);
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

      const endpoint = `${API_BASE_URL}/mobile/subscription-plans/my-plan`;
      console.log('🔵 Fetching subscription plan from:', endpoint);
      
      const response = await fetch(endpoint, {
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
        console.log('✅ Subscription Plan API Response:', JSON.stringify(result, null, 2));
        
        // Handle different response structures
        const planData = result.data || result.plan || result || {};
        console.log('📦 Subscription plan data:', planData);
        
        setSubscriptionData(planData);
        setFeatures(planData.features || []);
        
        // Cache the data
        await DataCache.set(cacheKey, planData);
        console.log('💾 Cached subscription plan data');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to fetch subscription plan. Status:', response.status);
        console.error('❌ Error response:', errorData);
        setError('Failed to fetch subscription plan');
        setSubscriptionData(null);
      }
    } catch (error) {
      console.error('❌ Error fetching subscription plan:', error);
      setError('Network error occurred');
      setSubscriptionData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionPlan();
  }, []);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Calculate days remaining
  const getDaysRemaining = () => {
    if (!subscriptionData?.expiry_date && !subscriptionData?.expiryDate) return null;
    const expiryDate = new Date(subscriptionData.expiry_date || subscriptionData.expiryDate);
    const today = new Date();
    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Use API data or fallback to defaults
  const membershipData = subscriptionData ? {
    status: subscriptionData.status || subscriptionData.subscription_status || 'Active',
    planType: subscriptionData.plan_type || subscriptionData.plan_name || subscriptionData.name || 'Premium',
    startDate: formatDate(subscriptionData.start_date || subscriptionData.created_at),
    expiryDate: formatDate(subscriptionData.expiry_date || subscriptionData.expires_at),
    daysRemaining: getDaysRemaining(),
    autoRenew: subscriptionData.auto_renew || subscriptionData.auto_renewal || false,
  } : {
    status: 'Active',
    planType: 'Premium',
    startDate: '',
    expiryDate: '',
    daysRemaining: null,
    autoRenew: false,
  };

  const membershipFeatures = features.length > 0 ? features.map(f => ({
    icon: f.icon || 'checkmark-circle',
    label: f.name || f.label || f.title || 'Feature',
    lib: 'Ionicons',
  })) : [
    { icon: 'fitness', label: 'Unlimited Workouts', lib: 'Ionicons' },
    { icon: 'nutrition', label: 'Custom Meal Plans', lib: 'MaterialCommunityIcons' },
    { icon: 'people', label: 'Expert Trainers', lib: 'Ionicons' },
    { icon: 'stats-chart', label: 'Progress Tracking', lib: 'Ionicons' },
    { icon: 'lock-open', label: 'Premium Content', lib: 'Ionicons' },
    { icon: 'document-text', label: 'Monthly Reports', lib: 'Ionicons' },
  ];

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return '#4CAF50';
      case 'expired':
        return '#F44336';
      case 'suspended':
        return '#FF9800';
      default:
        return '#666';
    }
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
      />
      
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 140, paddingTop: insets.top + 60 }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Membership</Text>
          <Text style={styles.headerSubtitle}>Your active subscription details</Text>
        </View>

        {/* Loading State */}
        {loading && !subscriptionData && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#222" />
            <Text style={styles.loadingText}>Loading membership details...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && !subscriptionData && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#999" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchSubscriptionPlan}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Membership Content - Only show if data exists or is loaded */}
        {subscriptionData && (
          <>
            {/* Membership Status Card */}
            <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.statusLabel}>Current Status</Text>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(membershipData.status) }]} />
                <Text style={[styles.statusText, { color: getStatusColor(membershipData.status) }]}>
                  {membershipData.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.planTypeBadge}>
              <Ionicons name="diamond" size={20} color="#f7b801" />
              <Text style={styles.planTypeText}>{membershipData.planType}</Text>
            </View>
          </View>
        </View>

        {/* Membership Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Membership Details</Text>
          
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="calendar-outline" size={20} color="#666" />
                <Text style={styles.detailLabel}>Start Date</Text>
              </View>
              <Text style={styles.detailValue}>{membershipData.startDate}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="calendar" size={20} color="#666" />
                <Text style={styles.detailLabel}>Expiry Date</Text>
              </View>
              <Text style={styles.detailValue}>{membershipData.expiryDate}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.detailLabel}>Days Remaining</Text>
              </View>
              <Text style={styles.detailValueBold}>{membershipData.daysRemaining} days</Text>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="sync-outline" size={20} color="#666" />
                <Text style={styles.detailLabel}>Auto Renewal</Text>
              </View>
              <View style={styles.autoRenewBadge}>
                <Ionicons 
                  name={membershipData.autoRenew ? "checkmark-circle" : "close-circle"} 
                  size={18} 
                  color={membershipData.autoRenew ? "#4CAF50" : "#999"} 
                />
                <Text style={[styles.detailValue, { marginLeft: 4, color: membershipData.autoRenew ? "#4CAF50" : "#999" }]}>
                  {membershipData.autoRenew ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </View>
          </View>
        </View>


        {/* Membership Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color="#222" />
            <Text style={styles.infoTitle}>Membership Information</Text>
          </View>
          <Text style={styles.infoText}>
            Your Premium membership gives you access to unlimited workouts, personalized meal plans, 
            expert trainer support, and exclusive premium content. Your subscription will automatically 
            renew unless you cancel before the expiry date.
          </Text>
        </View>
        </>
        )}
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
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  headerSection: {
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  planTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7d9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  planTypeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f7b801',
    marginLeft: 6,
  },
  detailsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  detailValue: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  },
  detailValueBold: {
    fontSize: 14,
    color: '#222',
    fontWeight: 'bold',
  },
  autoRenewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureItem: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
  },
  actionSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginLeft: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
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
    fontWeight: '600',
  },
});

export default MembershipScreen;

