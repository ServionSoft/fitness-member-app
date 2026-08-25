import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { useAuth } from '../contexts/AuthContext';
import ModernAlert from '../components/ModernAlert';

const groupLogo = require('../assets/images/fitness-model.png'); // Placeholder logo

export default function CommunityScreen() {
  const { logout } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });

  const API_BASE_URL = ENV_API_BASE_URL;

  const fetchCommunityGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the stored token
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        console.error('No token found');
        setError('Authentication required');
        setLoading(false);
        return null;
      }
  
      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }
  
      const response = await fetch(`${API_BASE_URL}/mobile/communication/community-groups`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });
  
      if (response.ok) {
        const data = await response.json();
        
        // Process the API response and add mock posts for now
        if (data.success && data.groups) {
          const processedGroups = data.groups.map(group => {
            let imageUri = require('../assets/images/fitness-model.png');
            
            if (group.image_url) {
              // Clean up the URL by removing /storage and fixing double slashes
              let cleanUrl = group.image_url.replace('/storage', '').replace(/\/\//g, '/');
              // Fix the protocol if it got broken
              cleanUrl = cleanUrl.replace('http:/', 'http://');
              imageUri = { uri: cleanUrl };
            }
            
            return {
              ...group,
              avatar: imageUri,
              posts: [
                // Add some mock posts for demonstration
                {
                  id: Date.now() + Math.random(),
                  author: 'Admin',
                  authorAvatar: require('../assets/images/fitness-model.png'),
                  content: `Welcome to ${group.name}! Share your fitness journey with the community.`,
                  image: null,
                  likes: 0,
                  comments: 0,
                  timeAgo: '1 day ago',
                  isAdmin: true
                }
              ]
            };
          });
          setGroups(processedGroups);
        } else {
          setGroups([]);
        }
        return data;
      } else {
        // Get the error response body
        const errorData = await response.json();
        console.error('Error response:', errorData);
        console.error('Failed to fetch community groups:', response.status);
        setError('Failed to fetch community groups');
        return null;
      }
    } catch (error) {
      console.error('Error fetching community groups:', error);
      setError('Network error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchCommunityGroups();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCommunityGroups();
    setRefreshing(false);
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

  const handleGroupSelect = (group) => {
    navigation.navigate('PostsScreen', { group });
  };


  const renderGroupCard = (group) => (
    <TouchableOpacity 
      key={group.id} 
      style={styles.groupCard}
      onPress={() => handleGroupSelect(group)}
      activeOpacity={0.6}
    >
      <Image source={group.avatar} style={styles.groupLogo} />
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{group.name || 'Unnamed Group'}</Text>
        <Text style={styles.groupDescription}>{group.description || 'No description available'}</Text>
    
      </View>
      <View style={styles.groupArrow}>
        <Ionicons name="chevron-forward" size={16} color="#ccc" />
      </View>
    </TouchableOpacity>
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
      
      {/* Header */}
      <HeaderBar
        onMenuPress={() => setMenuVisible(true)}
        title="Community Groups"
      />

      <ScrollView 
        style={{ paddingTop: insets.top + 70, flex: 1 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Community Groups</Text>
        
        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#222" />
            <Text style={styles.loadingText}>Loading groups...</Text>
          </View>
        ) : error ? (
          // Error State
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchCommunityGroups}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : groups.length > 0 ? (
          // Groups List
          groups.map(renderGroupCard)
        ) : (
          // No Groups State
          <View style={styles.noGroupsContainer}>
            <Text style={styles.noGroupsText}>No groups found</Text>
            <Text style={styles.noGroupsSubtext}>Join some groups to get started!</Text>
          </View>
        )}
        
        {/* Back Button */}
        <View style={{ justifyContent: 'center', alignItems: 'center', marginBottom: 30, marginTop: 20 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={16} color="#fff" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#1a1a1a',
    marginLeft: 20,
    marginBottom: 18,
  },
  // Group Card Styles
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  groupLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 6,
    lineHeight: 18,
  },
  groupDescription: {
    fontSize: 13,
    color: '#888',
    marginBottom: 6,
    lineHeight: 18,
    fontWeight: '500',
  },
  memberCount: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  messageCount: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 2,
  },
  groupStatus: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  memberBadge: {
    fontSize: 9,
    color: '#007bff',
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  groupArrow: {
    marginLeft: 4,
  },
  // Back Button
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  // Loading and Error States
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: 20,
  },
  loadingText: {
    fontSize: 13,
    color: '#888',
    marginTop: 12,
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: 20,
  },
  errorText: {
    fontSize: 13,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: '#222',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  noGroupsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: 20,
  },
  noGroupsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  noGroupsSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 6,
  },
}); 