import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import BottomNavBar from '../components/BottomNavBar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { getProfileImageSource, ProfileImage } from '../utils/imageUtils';
import ModernAlert from '../components/ModernAlert';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { getAuthToken } from '../utils/tokenUtils';

const API_BASE_URL = ENV_API_BASE_URL;

const { width: screenWidth } = Dimensions.get('window');

const featureCards = [
  { icon: 'users', label: 'Contact Us', lib: 'Feather', color: '#222', bg: '#fff' },
  { icon: 'calendar', label: 'Schedule', lib: 'Feather', color: '#222', bg: '#fff' },
  { icon: 'award', label: 'Membership', lib: 'Feather', color: '#222', bg: '#fff' },
  { icon: 'file-text', label: 'Invoices', lib: 'Feather', color: '#222', bg: '#fff' },
  { icon: 'trending-up', label: 'Weekly Progress', lib: 'Feather', color: '#222', bg: '#fff' },
  { icon: 'note-text-outline', label: 'Notes', lib: 'MaterialCommunityIcons', color: '#222', bg: '#fff' },
];

export default function ProfileScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState('Profile');
  const navigation = useNavigation();
  const { userData, logout, refreshMemberDetails } = useAuth();
  const insets = useSafeAreaInsets();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const [credits, setCredits] = useState(null);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Get user's full name by merging firstname and lastname
  const getFullName = () => {
    if (userData) {
      const firstName = userData.firstname || '';
      const lastName = userData.lastname || '';
      return `${firstName} ${lastName}`.trim();
    }
    return 'User';
  };

  // Get user's profile image using utility function
  // This will use profile_image from userData which is updated by refreshMemberDetails
  const getProfileImage = () => {
    const baseUrl = API_BASE_URL.replace('/api', '');
    return getProfileImageSource(userData, baseUrl);
  };

  // Get user's email
  const getUserEmail = () => {
    return userData?.email || 'user@example.com';
  };

  // Refresh member details when screen is focused to get latest profile_image
  useFocusEffect(
    React.useCallback(() => {
      if (refreshMemberDetails) {
        refreshMemberDetails();
      }
    }, [refreshMemberDetails])
  );

  // Fetch credits from API
  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    try {
      setLoadingCredits(true);
      const authHeader = await getAuthToken();
      
      if (!authHeader) {
        console.warn('No auth token available for credits fetch');
        setLoadingCredits(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/subscription-plans/credits`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCredits(data.credits || null);
      } else {
        const errorText = await response.text().catch(() => '');
        let creditsErrorParsed = null;
        try {
          creditsErrorParsed = errorText ? JSON.parse(errorText) : null;
        } catch (_) {
          creditsErrorParsed = null;
        }
        console.error('[ProfileScreen] Credits request failed', {
          url: `${API_BASE_URL}/mobile/subscription-plans/credits`,
          status: response.status,
          statusText: response.statusText,
          bodyRaw: errorText,
          bodyJson: creditsErrorParsed,
          message: creditsErrorParsed?.message,
          error: creditsErrorParsed?.error,
          errors: creditsErrorParsed?.errors,
        });

        // Fallback endpoint: /mobile/credits
        const fallbackResponse = await fetch(`${API_BASE_URL}/mobile/credits`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const creditRows = fallbackData?.data?.credits || [];
          const services = creditRows.map((item, index) => ({
            id: item.service_id ?? index + 1,
            name: item.service_name || 'Service',
            amount: item.remaining_credits ?? 0,
            total_credits: item.total_credits ?? 0,
            used_credits: item.used_credits ?? 0,
            remaining_credits: item.remaining_credits ?? 0,
            valid_from: item.valid_from ?? null,
            valid_until: item.valid_until ?? null,
            is_valid: item.is_valid ?? false,
          }));

          setCredits({
            has_credits: services.some((s) => Number(s.remaining_credits || s.amount || 0) > 0),
            credit_distribution: null,
            services,
          });
        } else {
          const fallbackErrorText = await fallbackResponse.text().catch(() => '');
          let fallbackParsed = null;
          try {
            fallbackParsed = fallbackErrorText ? JSON.parse(fallbackErrorText) : null;
          } catch (_) {
            fallbackParsed = null;
          }
          console.error('[ProfileScreen] Fallback credits request failed', {
            url: `${API_BASE_URL}/mobile/credits`,
            status: fallbackResponse.status,
            statusText: fallbackResponse.statusText,
            bodyRaw: fallbackErrorText,
            bodyJson: fallbackParsed,
            message: fallbackParsed?.message,
            error: fallbackParsed?.error,
          });
          setCredits(null);
        }
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
      setCredits(null);
    } finally {
      setLoadingCredits(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      // Refresh member details to get latest profile_image
      if (refreshMemberDetails) {
        await refreshMemberDetails();
      }
      await fetchCredits();
    } finally {
      setRefreshing(false);
    }
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {/* Profile Card with Curved Background */}
        <View style={styles.profileCardWrapper}>
          <View style={{ width: '100%', height: 110, position: 'relative', marginBottom: 10 }}>
            <Svg
              width={screenWidth}
              height={110}
              viewBox={`0 0 ${screenWidth} 110`}
              style={{ position: 'absolute', top: 30, left: 0 }}
            >
              <Path
                d={`M0,60 Q${screenWidth / 2},-20 ${screenWidth},60 L${screenWidth},110 L0,110 Z`}
                fill="#fff"
              />
            </Svg>
            <View
              style={[
                styles.profileAvatarCurve,
                {
                  position: 'absolute',
                  left: (screenWidth - 90) / 2,
                  top: 15,
                  marginTop: 0,
                },
              ]}
            >
              <ProfileImage
                source={getProfileImage()}
                style={styles.profileAvatarImage}
              />
            </View>
          </View>
          </View>
          <View style={styles.profileCardWrapper1}>
          <Text style={styles.profileName}>{getFullName()}</Text>
          <View style={styles.profileBtnRow}>
            <TouchableOpacity 
              style={styles.profileBtn}
              onPress={() => navigation.navigate('AccountScreen')}
            >
              <Text style={styles.profileBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
          {/* <Text style={styles.profileBio}>{getUserEmail()}</Text> */}

        {/* Feature Cards Grid */}
        <View style={styles.featureGrid}>
          {featureCards.map((item, idx) => {
            // Determine which icon component to use based on lib property
            let IconComponent = Feather;
            if (item.lib === 'MaterialCommunityIcons') {
              IconComponent = MaterialCommunityIcons;
            } else if (item.lib === 'Ionicons') {
              IconComponent = Ionicons;
            }
            
            // Handle navigation based on item label
            const handleCardPress = () => {
              if (item.label === 'Contact Us') {
                navigation.navigate('ContactsScreen');
              } else if (item.label === 'Schedule') {
                navigation.navigate('ScheduleScreen');
              } else if (item.label === 'Membership') {
                navigation.navigate('MembershipScreen');
              } else if (item.label === 'Invoices') {
                navigation.navigate('PaymentScreen');
              } else if (item.label === 'Weekly Progress') {
                navigation.navigate('WeeklyProgress');
              } else if (item.label === 'Notes') {
                navigation.navigate('NotesScreen');
              }
            };
            
            return (
              <TouchableOpacity 
                key={item.label} 
                style={[styles.featureCard, { backgroundColor: item.bg }]}
                onPress={handleCardPress}
              > 
                <IconComponent name={item.icon} size={24} color={item.color} />
                <Text style={[styles.featureCardLabel, { color: item.color }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Products Section */}
        <View style={styles.productsSection}>
          <Text style={styles.productsTitle}>Products</Text>
          {loadingCredits ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#000" />
            </View>
          ) : credits?.services && credits.services.length > 0 ? (
            <View style={styles.productsList}>
              {credits.services.map((service) => (
                <TouchableOpacity 
                  key={service.id} 
                  style={styles.productItem}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('ProductHistoryScreen', { service })}
                >
                  <View style={styles.productLeft}>
                    <View style={styles.productTag}>
                      <MaterialCommunityIcons name="tag" size={16} color="#FF6B6B" />
                      <Text style={styles.productQuantity}>{service.amount}x</Text>
                    </View>
                    <Text style={styles.productName}>{service.name}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#888" />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No products available</Text>
            </View>
          )}
        </View>
        </View>
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
    paddingTop: '5%',
    paddingHorizontal: 0,
  },
  profileCardWrapper: {
   
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    position: 'relative',
  },
  profileCardWrapper1: {
   
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  profileAvatarCurve: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: '#fff',
    marginTop: 40,
    zIndex: 2,
    backgroundColor: '#eee',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  profileName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 5,
  },
  profileLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  profileBtnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    marginTop: 8,
  },
  profileBtn: {
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 24,
    elevation: 2,
  },
  profileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  profileBio: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7ead7',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 18,
    elevation: 2,
  },
  proIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  proTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  proDesc: {
    fontSize: 12,
    color: '#222',
    marginTop: 2,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 10,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 2,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  featureCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
  productsSection: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    width: '90%',
  },
  productsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  productsList: {
    gap: 12,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  productLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  productQuantity: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B6B',
    marginLeft: 4,
  },
  productName: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
  },
}); 