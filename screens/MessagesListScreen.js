import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

/**
 * MessagesListScreen Component
 * 
 * Shows list of conversations with admins and coaches
 * 
 * API Endpoints:
 * - GET /api/mobile/chat/conversations - Get all conversations
 * - GET /api/mobile/chat/unread-count - Get unread message count
 * 
 * Features:
 * - List of conversations with admins/coaches
 * - Unread message badges
 * - Last message preview
 * - Pull-to-refresh
 * - Navigation to message detail screen
 */
export default function MessagesListScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = API_BASE_URL.replace('/api', '');

  // Load conversations when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadConversations();
      loadUnreadCount();
    }, [])
  );

  const loadConversations = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/chat/conversations`, {
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
      console.log(data,'data');

      if (data.success && data.data) {
        setConversations(data.data);
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError(err.message || 'Failed to load conversations');
      if (!isRefresh) {
        setAlertConfig({
          title: 'Error',
          message: err.message || 'Failed to load conversations',
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
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) return;

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/chat/unread-count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setUnreadCount(data.data.unread_count || 0);
        }
      }
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  };

  const onRefresh = () => {
    loadConversations(true);
    loadUnreadCount();
  };

  const handleConversationPress = (conversation) => {
    navigation.navigate('MessageDetailScreen', {
      recipientId: conversation.recipient_id,
      recipientType: conversation.recipient_type,
      recipientName: conversation.name,
      recipientAvatar: conversation.avatar,
    });
  };

  const handleNewMessage = () => {
    navigation.navigate('NewMessageScreen');
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      // Today - show time
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const renderConversationItem = ({ item }) => {
    const hasUnread = item.unread_count > 0;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
       
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarIcon}>👤</Text>
            </View>
          
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unread_count > 9 ? '9+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.last_message_time && (
              <Text style={styles.conversationTime}>
                {formatTime(item.last_message_time)}
              </Text>
            )}
          </View>

          <View style={styles.conversationFooter}>
            <Text
              style={[
                styles.lastMessage,
                hasUnread && styles.lastMessageUnread
              ]}
              numberOfLines={1}
            >
              {item.last_message || 'No messages yet'}
            </Text>
            <View style={styles.recipientTypeBadge}>
              <Text style={styles.recipientTypeText}>
                {item.recipient_type}
              </Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>No conversations yet</Text>
      <Text style={styles.emptySubtext}>
        Start a conversation with an admin or coach
      </Text>
      <TouchableOpacity
        style={styles.newMessageButton}
        onPress={handleNewMessage}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.newMessageButtonText}>New Message</Text>
      </TouchableOpacity>
    </View>
  );

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
        <View style={styles.headerTitleContainer}>
          <Text 
            style={styles.headerTitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Messages
          </Text>
          {unreadCount > 0 && (
            <View style={styles.headerUnreadBadge}>
              <Text style={styles.headerUnreadText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.newMessageHeaderButton}
          onPress={handleNewMessage}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="create-outline" size={24} color="#222" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {error && !loading ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadConversations()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={
            conversations.length === 0 ? styles.emptyListContainer : styles.listContainer
          }
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#000"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0, // Important for text truncation in flexbox
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    letterSpacing: -0.2,
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
  },
  headerUnreadBadge: {
    backgroundColor: '#ff4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0, // Prevent badge from shrinking
  },
  headerUnreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
  },
  newMessageHeaderButton: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 80,
  },
  errorText: {
    fontSize: 15,
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#222',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  listContainer: {
    paddingVertical: 6,
  },
  emptyListContainer: {
    flex: 1,
  },
  conversationItem: {
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
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  unreadBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#ff4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  conversationContent: {
    flex: 1,
    marginRight: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  conversationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    flex: 1,
    letterSpacing: 0.1,
  },
  conversationTime: {
    fontSize: 11,
    color: '#999',
    marginLeft: 8,
    fontWeight: '500',
  },
  conversationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 13,
    color: '#666',
    flex: 1,
    lineHeight: 18,
    letterSpacing: 0.05,
  },
  lastMessageUnread: {
    fontWeight: '600',
    color: '#222',
  },
  recipientTypeBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  recipientTypeText: {
    fontSize: 9,
    color: '#666',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    marginBottom: 24,
    lineHeight: 20,
  },
  newMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  newMessageButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
});

