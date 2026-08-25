import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

export default function MessageDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { recipientId, recipientType, recipientName, recipientAvatar } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recipient, setRecipient] = useState(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });
  const [keyboardHeightState, setKeyboardHeightState] = useState(0);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const keyboardShowListener = useRef(null);
  const keyboardHideListener = useRef(null);

  const API_BASE_URL = ENV_API_BASE_URL;

  // Validate route params
  useEffect(() => {
    if (!recipientId || !recipientType) {
      setAlertConfig({
        title: 'Error',
        message: 'Invalid conversation information',
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
  }, [recipientId, recipientType]);

  // Reload messages when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [recipientId, recipientType])
  );

  // Lift input above keyboard (iOS + Android)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    keyboardShowListener.current = Keyboard.addListener(showEvent, (e) => {
      const { height } = e.endCoordinates;
      // Keyboard frame already covers the home-indicator area; avoid double-padding
      const offset =
        Platform.OS === 'ios' ? Math.max(0, height - insets.bottom) : height;
      const duration =
        Platform.OS === 'ios' ? e.duration || 250 : 250;

      setKeyboardHeightState(offset);
      Animated.timing(keyboardHeight, {
        toValue: offset,
        duration,
        useNativeDriver: false,
      }).start();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, Platform.OS === 'ios' ? 50 : 300);
    });

    keyboardHideListener.current = Keyboard.addListener(hideEvent, (e) => {
      const duration =
        Platform.OS === 'ios' ? e?.duration || 250 : 250;
      setKeyboardHeightState(0);
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardShowListener.current?.remove();
      keyboardHideListener.current?.remove();
    };
  }, [insets.bottom, keyboardHeight]);

  const loadMessages = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/mobile/chat/messages/${recipientId}/${recipientType}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setMessages(data.data.messages || []);
        setRecipient(data.data.recipient || {
          id: recipientId,
          type: recipientType,
          name: recipientName,
          avatar: recipientAvatar,
        });

        // Scroll to bottom after loading
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      setAlertConfig({
        title: 'Error',
        message: err.message || 'Failed to load messages',
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
      setRefreshing(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    // Validate message length
    if (newMessage.trim().length > 1000) {
      setAlertConfig({
        title: 'Error',
        message: 'Message is too long. Please keep it under 1000 characters.',
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

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          recipient_id: recipientId,
          recipient_type: recipientType,
          message: newMessage.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('responseData', responseData);

      if (responseData.success && responseData.data) {
        // Add message to local state
        const newMsg = {
          ...responseData.data,
          is_own: true,
        };
        setMessages(prev => [...prev, newMsg]);
        setNewMessage('');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setAlertConfig({
        title: 'Error',
        message: err.message || 'Failed to send message',
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

  const onRefresh = () => {
    loadMessages(true);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  };

  const renderMessage = ({ item }) => {
    const isOwn = item.is_own || false;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwn ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwn && (
          <View style={styles.messageAvatarPlaceholder}>
            <Text style={styles.messageAvatarIcon}>👤</Text>
          </View>
        )}

        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          {!isOwn && (
            <View style={styles.messageHeader}>
              <Text style={styles.messageUsername}>{item.sender_name || 'Unknown'}</Text>
              <View
                style={[
                  styles.senderTypeBadge,
                  item.sender_type === 'Admin' ? styles.adminBadge : styles.trainerBadge,
                ]}
              >
                <Text style={styles.senderTypeText}>{item.sender_type}</Text>
              </View>
            </View>
          )}
          <Text
            style={[
              styles.messageText,
              isOwn ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {item.message}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isOwn ? styles.ownMessageTime : styles.otherMessageTime,
            ]}
          >
            {formatTime(item.created_at)}
          </Text>
        </View>

        {isOwn && (
          <View style={styles.messageAvatarPlaceholder}>
            <Text style={styles.messageAvatarIcon}>👤</Text>
          </View>
        )}
      </View>
    );
  };

  const renderHeader = () => {
    const displayName = recipient?.name || recipientName || 'Unknown';

    return (
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatarPlaceholder}>
            <Text style={styles.headerAvatarIcon}>👤</Text>
          </View>
          <View style={styles.headerText}>
            <Text 
              style={styles.headerTitle} 
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayName}
            </Text>
            <Text 
              style={styles.headerSubtitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {recipientType}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
      <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={56} color="#ccc" />
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubtext}>
        Start the conversation by sending a message
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      <View style={styles.contentWrapper}>
        <Animated.View
          style={[
            styles.flatListWrapper,
          ]}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
            contentContainerStyle={[
              messages.length === 0 ? styles.emptyListContainer : styles.messagesContainer,
              {
                paddingBottom: 10 + keyboardHeightState,
              },
            ]}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#000"
              />
            }
            onContentSizeChange={() => {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }, 100);
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            style={styles.flatList}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.inputWrapper,
            {
              paddingBottom: keyboardHeightState > 0 ? 8 : Math.max(insets.bottom, 8),
              transform: [
                {
                  translateY: Animated.multiply(keyboardHeight, -1),
                },
              ],
            },
          ]}
        >
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={newMessage}
              onChangeText={(text) => {
                setNewMessage(text);
                // Scroll to bottom when typing
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
              maxLength={1000}
              editable={!sending}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
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
  contentWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  flatListWrapper: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  inputWrapper: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    paddingTop: 8,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
    minHeight: 56,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0, // Important for text truncation in flexbox
  },
  headerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    flexShrink: 0, // Prevent avatar from shrinking
  },
  headerAvatarIcon: {
    fontSize: 19,
    color: '#757575',
  },
  headerText: {
    flex: 1,
    minWidth: 0, // Critical for text truncation in flexbox
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
    letterSpacing: -0.2,
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  messagesContainer: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  emptyListContainer: {
    flex: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  messageAvatarIcon: {
    fontSize: 14,
    color: '#757575',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ownBubble: {
    backgroundColor: '#222',
    borderBottomRightRadius: 3,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  otherBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 3,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    borderWidth: 0.5,
    borderColor: '#e8e8e8',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageUsername: {
    fontSize: 11,
    fontWeight: '600',
    color: '#222',
    marginRight: 5,
  },
  senderTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adminBadge: {
    backgroundColor: '#E3F2FD',
  },
  trainerBadge: {
    backgroundColor: '#F3E5F5',
  },
  senderTypeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  ownMessageText: {
    color: '#fff',
    fontWeight: '400',
  },
  otherMessageText: {
    color: '#222',
    fontWeight: '400',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#888',
    textAlign: 'left',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxHeight: 100,
    fontSize: 14,
    color: '#222',
    marginRight: 8,
    borderWidth: 0.5,
    borderColor: '#e8e8e8',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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

