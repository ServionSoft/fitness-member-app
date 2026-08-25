import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

/**
 * ChatScreen Component
 * 
 * Fetches real chat messages from the API endpoint:
 * GET /api/mobile/communication/groups/{groupId}
 * 
 * Sends messages using the API endpoint:
 * POST /api/mobile/communication/groups/{groupId}/messages
 * 
 * This endpoint returns group details including messages for a specific group.
 * 
 * Features:
 * - Real-time message loading from API
 * - Real-time message sending to API
 * - Pull-to-refresh functionality
 * - Error handling with retry mechanism
 * - Empty state handling
 * - Message transformation for consistent UI
 * - Member avatar and name integration
 * - Message positioning based on sender_type:
 *   * Member messages: Right side (blue bubble)
 *   * Admin messages: Left side (white bubble with avatar)
 * - Visual sender type badges for Admin/Member identification
 * - WhatsApp-style message ordering: oldest messages at top, newest at bottom
 */
export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userData } = useAuth();
  const { group } = route.params;
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });
  const flatListRef = useRef(null);

  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = API_BASE_URL.replace('/api', ''); // For image URLs

  // Validate group parameter
  useEffect(() => {
    if (!group || !group.id) {
      setAlertConfig({
        title: 'Error',
        message: 'Invalid group information',
        type: 'error',
        buttons: [
          {
            text: 'Go Back',
            onPress: () => navigation.goBack(),
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
      return;
    }
    loadMessages();
  }, [group]);

  const loadMessages = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Get user token from AsyncStorage
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      // Fetch real messages from API
      const response = await fetch(`${API_BASE_URL}/mobile/communication/groups/${group.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
    
      
      // Extract messages from the nested structure: data.group.messages
      const realMessages = data.data?.messages || [];
      const groupMembers = data.data?.members || [];
      
      if (!Array.isArray(realMessages)) {
        setMessages([]);
        return;
      }
      
      const transformedMessages = realMessages.map(msg => {
        // Find the member who sent this message to get their avatar and name
        const member = groupMembers.find(m => m.id === msg.sender_id);
        
        return {
          id: msg.id,
          user_id: msg.sender_id,
          username: member?.name || msg.sender_type || 'User',
          message: msg.content,
          timestamp: msg.created_at,
          avatar: member?.avatar || null,
          sender_type: msg.sender_type || 'Member', // Add sender_type to track Member vs Admin
          isOwn: msg.sender_id === userData?.id,
        };
      });

      // Sort messages by timestamp to ensure chronological order (oldest first, newest last)
      const sortedMessages = transformedMessages.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      setMessages(sortedMessages);
      
      // Update group information if provided in the response
      if (data.data?.group) {
        const groupData = data.data.group;
        // Group info is available for potential future use
      }
      
      // Scroll to bottom after loading messages (only if not refreshing)
      if (!isRefresh) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }

    } catch (error) {
      // Show user-friendly error message
      let errorMessage = 'Failed to load messages';
      
      if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Please log in again to view messages';
      } else if (error.message.includes('403')) {
        errorMessage = 'You don\'t have permission to view this chat';
      } else if (error.message.includes('404')) {
        errorMessage = 'Chat not found';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later';
      } else if (error.message.includes('No authentication token found')) {
        errorMessage = 'Please log in to view messages';
      }
      
      if (!isRefresh) {
        setAlertConfig({
          title: 'Error',
          message: errorMessage,
          type: 'error',
          buttons: [
            {
              text: 'Cancel',
              onPress: () => {},
              style: 'secondary',
            },
            {
              text: 'Retry',
              onPress: () => loadMessages(),
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      }
      
      // Fallback to empty messages array
      setMessages([]);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const onRefresh = () => {
    loadMessages(true);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    // Validate message length
    if (newMessage.trim().length > 500) {
      setAlertConfig({
        title: 'Error',
        message: 'Message is too long. Please keep it under 500 characters.',
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
      return;
    }

    try {
      setSending(true);
      
      // Get user token from AsyncStorage
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      // Send message using real API
      const response = await fetch(`${API_BASE_URL}/mobile/communication/groups/${group.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ 
          message: newMessage.trim(),
          content: newMessage.trim() // Some APIs use 'content' instead of 'message'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

      console.log('Response data send:', responseData);
      
      // Handle different possible API response structures
      let messageId, createdAt;
      if (responseData.data?.id) {
        messageId = responseData.data.id;
        createdAt = responseData.data.created_at;
      } else if (responseData.id) {
        messageId = responseData.id;
        createdAt = responseData.created_at;
      } else {
        messageId = Date.now();
        createdAt = new Date().toISOString();
      }
      
      // Create new message object for local state
      const newMsg = {
        id: messageId,
        user_id: userData?.id || 1,
        username: userData?.firstname || userData?.name || 'You',
        message: newMessage.trim(),
        timestamp: createdAt,
        avatar: userData?.profile_image || userData?.avatar,
        sender_type: 'Member', // Assume current user is a member
        isOwn: true,
      };

      // Add message to local state (append to end for chronological order)
      setMessages(prev => [...prev, newMsg]);
      setNewMessage('');
      
      // Show brief success feedback
      setSending(true); // Keep button in "sending" state briefly for visual feedback
      setTimeout(() => {
        setSending(false);
      }, 500);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      let errorMessage = 'Failed to send message';
      
      if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Please log in again to send messages';
      } else if (error.message.includes('403')) {
        errorMessage = 'You don\'t have permission to send messages in this group';
      } else if (error.message.includes('No authentication token found')) {
        errorMessage = 'Please log in to send messages';
      }
      
      setAlertConfig({
        title: 'Error',
        message: errorMessage,
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
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderMessage = ({ item }) => {
    // Use sender_type to determine message positioning
    // Member messages show on right, Admin messages show on left
    const isMemberMessage = item.sender_type === 'Member';
    const isOwnMessage = item.user_id === userData?.id;
    
    return (
      <View style={[
        styles.messageContainer,
        isMemberMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        {!isMemberMessage && (
          <Image
            source={
              item.avatar 
                ? { uri: item.avatar.startsWith('http') ? item.avatar : `${BASE_URL}${item.avatar}` }
                : require('../assets/images/fitness-model.png')
            }
            style={styles.messageAvatar}
          />
        )}
        
        <View style={[
          styles.messageBubble,
          isMemberMessage ? styles.ownBubble : styles.otherBubble
        ]}>
          {!isMemberMessage && (
            <View style={styles.messageHeader}>
              <Text style={styles.messageUsername}>{item.username}</Text>
              <View style={[
                styles.senderTypeBadge,
                item.sender_type === 'Admin' ? styles.adminBadge : styles.memberBadge
              ]}>
                <Text style={styles.senderTypeText}>{item.sender_type}</Text>
              </View>
            </View>
          )}
          <Text style={[
            styles.messageText,
            isMemberMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {item.message}
          </Text>
          <Text style={[
            styles.messageTime,
            isMemberMessage ? styles.ownMessageTime : styles.otherMessageTime
          ]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.chatHeader}>
      <Image
        source={
          group.avatar 
            ? { uri: group.avatar.startsWith('http') ? group.avatar : `${BASE_URL}${group.avatar}` }
            : require('../assets/images/fitness-model.png')
        }
        style={styles.groupAvatar}
      />
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.groupStatus}>
          {group.status} • {group.member_count || 0} members • {group.message_count || 0} messages
        </Text>
        {group.description && (
          <Text style={styles.groupDescription} numberOfLines={2}>
            {group.description}
          </Text>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="chatbubble-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No messages yet</Text>
      <Text style={styles.emptyStateSubtitle}>Start the conversation by sending a message!</Text>
    </View>
  );

  const renderCustomHeader = () => (
    <SafeAreaView style={styles.customHeader}>
      <View style={styles.headerContent}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Image
            source={
              group.avatar 
                ? { uri: group.avatar.startsWith('http') ? group.avatar : `http://192.168.1.36:8000${group.avatar}` }
                : require('../assets/images/fitness-model.png')
            }
            style={styles.headerAvatar}
          />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{group.name}</Text>
            <Text style={styles.headerSubtitle}>
              {group.status} • {group.member_count || 0} members • {group.message_count || 0} messages
            </Text>
            {group.description && (
              <Text style={styles.headerDescription} numberOfLines={1}>
                {group.description}
              </Text>
            )}
          </View>
        </View>
        
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="#222" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={() => loadMessages(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#222" />
          ) : (
            <Ionicons name="refresh" size={24} color="#222" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderCustomHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#222" />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderCustomHeader()}
      
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          onRefresh={onRefresh}
          refreshing={refreshing}
          ListEmptyComponent={renderEmptyState}
        />
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  customHeader: {
    backgroundColor: '#f7f8f2',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
    marginLeft: 8,
  },
  refreshButton: {
    padding: 8,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingBottom: 20,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    elevation: 2,
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  groupStatus: {
    fontSize: 14,
    color: '#666',
  },
  groupDescription: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    lineHeight: 18,
  },
  messageContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 4,
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 4,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: '#222',
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
    elevation: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  messageUsername: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  senderTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  adminBadge: {
    backgroundColor: '#ff6b6b',
  },
  memberBadge: {
    backgroundColor: '#4ecdc4',
  },
  senderTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#222',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    maxHeight: 100,
    fontSize: 16,
    color: '#222',
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#222',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f7f8f2',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 15,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
});
