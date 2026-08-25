import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

/**
 * NewMessageScreen Component
 * 
 * Shows list of available admins and coaches to start a conversation with
 * 
 * API Endpoints:
 * - GET /api/mobile/chat/contacts - Get available contacts
 * 
 * Features:
 * - List of admins and coaches
 * - Search functionality
 * - Navigation to message detail screen
 */
export default function NewMessageScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = API_BASE_URL.replace('/api', '');

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    // Filter contacts based on search query
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const filtered = contacts.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredContacts(filtered);
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      setLoading(true);

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/chat/contacts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setContacts(data.data);
        setFilteredContacts(data.data);
      } else {
        setContacts([]);
        setFilteredContacts([]);
      }
    } catch (err) {
      console.error('Error loading contacts:', err);
      setAlertConfig({
        title: 'Error',
        message: err.message || 'Failed to load contacts',
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleContactPress = (contact) => {
    navigation.navigate('MessageDetailScreen', {
      recipientId: contact.id,
      recipientType: contact.type,
      recipientName: contact.name,
      recipientAvatar: contact.avatar,
    });
  };

  const renderContactItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => handleContactPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {item.avatar ? (
            <Image
              source={{
                uri: item.avatar.startsWith('http')
                  ? item.avatar
                  : `${BASE_URL}${item.avatar}`,
              }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarIcon}>👤</Text>
            </View>
          )}
        </View>

        <View style={styles.contactContent}>
          <View style={styles.contactHeader}>
            <Text style={styles.contactName} numberOfLines={1}>
              {item.name}
            </Text>
            <View
              style={[
                styles.typeBadge,
                item.type === 'Admin' ? styles.adminBadge : styles.trainerBadge,
              ]}
            >
              <Text style={styles.typeText}>{item.type}</Text>
            </View>
          </View>
          {item.email && (
            <Text style={styles.contactEmail} numberOfLines={1}>
              {item.email}
            </Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text 
          style={styles.headerTitle}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          New Message
        </Text>
        <View style={styles.headerSpacer} />
      </View>

 
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={56} color="#ccc" />
      <Text style={styles.emptyText}>
        {searchQuery ? 'No contacts found' : 'No contacts available'}
      </Text>
      <Text style={styles.emptySubtext}>
        {searchQuery
          ? 'Try a different search term'
          : 'There are no admins or coaches available to message'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={filteredContacts}
        renderItem={renderContactItem}
        keyExtractor={(item) => `${item.id}_${item.type}`}
        contentContainerStyle={
          filteredContacts.length === 0 ? styles.emptyListContainer : styles.listContainer
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
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
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    paddingBottom: 10,
    minHeight: 56,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    letterSpacing: -0.2,
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
    minWidth: 0, // Important for text truncation in flexbox
  },
  headerSpacer: {
    width: 40,
    flexShrink: 0, // Prevent spacer from shrinking
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: '#e8e8e8',
    minHeight: 40,
  },
  searchIcon: {
    marginRight: 8,
    flexShrink: 0, // Prevent icon from shrinking
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#222',
    paddingVertical: 9,
    includeFontPadding: false, // Remove extra padding on Android
    minWidth: 0, // Important for text truncation in flexbox
  },
  clearButton: {
    padding: 4,
    minWidth: 28,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0, // Prevent button from shrinking
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  listContainer: {
    paddingVertical: 6,
  },
  emptyListContainer: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginVertical: 3,
    borderRadius: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    borderWidth: 0.5,
    borderColor: '#e8e8e8',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  avatarIcon: {
    fontSize: 22,
    color: '#757575',
  },
  contactContent: {
    flex: 1,
    marginRight: 8,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    flex: 1,
    marginRight: 6,
    letterSpacing: 0.1,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  adminBadge: {
    backgroundColor: '#E3F2FD',
  },
  trainerBadge: {
    backgroundColor: '#F3E5F5',
  },
  typeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactEmail: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    letterSpacing: 0.05,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});

