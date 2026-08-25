import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  Platform,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfileImageSource, ProfileImage } from '../utils/imageUtils';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

/** Keep community uploads small — full HEIC/12MP photos freeze real devices */
const COMMUNITY_IMAGE_OPTIONS = {
  mediaType: 'photo',
  quality: 0.55,
  maxWidth: 1280,
  maxHeight: 1280,
  includeBase64: false,
  includeExtra: false,
  selectionLimit: 1,
  presentationStyle: 'fullScreen',
  ...(Platform.OS === 'ios'
    ? { assetRepresentationMode: 'compatible' } // force JPEG-compatible file on iOS
    : {}),
};

const normalizePickedImage = (asset) => {
  if (!asset?.uri) {
    return null;
  }

  let uri = asset.uri;
  // iOS FormData needs a file:// URI (picker usually returns one after resize)
  if (Platform.OS === 'ios' && uri.startsWith('/') && !uri.startsWith('file://')) {
    uri = `file://${uri}`;
  }

  if (uri.startsWith('ph://') || uri.startsWith('assets-library://')) {
    return null;
  }

  let type = asset.type || 'image/jpeg';
  if (type === 'image/heic' || type === 'image/heif' || type === 'public.heic') {
    type = 'image/jpeg';
  }

  let fileName = asset.fileName || `post_${Date.now()}.jpg`;
  fileName = fileName.split('?')[0];
  if (/\.(heic|heif)$/i.test(fileName)) {
    fileName = fileName.replace(/\.(heic|heif)$/i, '.jpg');
  } else if (!/\.(jpe?g|png|gif|webp)$/i.test(fileName)) {
    fileName = `${fileName.replace(/\.[^.]+$/, '') || 'post'}.jpg`;
  }

  return {
    uri,
    type,
    fileName,
    width: asset.width,
    height: asset.height,
  };
};

export default function PostsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userData, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newPostText, setNewPostText] = useState('');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [inlineComments, setInlineComments] = useState({}); // Track inline comment text per post
  const [creatingPost, setCreatingPost] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [expandedComments, setExpandedComments] = useState(new Set()); // Track which posts have comments expanded
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const [refreshing, setRefreshing] = useState(false);

  const { group } = route.params;
  const API_BASE_URL = ENV_API_BASE_URL;
  
  const fetchPosts = async (groupId, isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
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
  
      const response = await fetch(`${API_BASE_URL}/mobile/communication/posts?group_id=${groupId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Process the API response
        if (data.success && data.data && data.data.data) {
          const processedPosts = data.data.data.map(post => {
            let postImage = null;
            
            if (post.image_url) {
              // Clean up the URL by removing /storage, /uploads/posts and fixing double slashes
              let cleanUrl = post.image_url.replace('/storage', '').replace('/uploads/posts', '').replace(/\/\//g, '/');
              // Fix the protocol if it got broken
              cleanUrl = cleanUrl.replace('http:/', 'http://');
              postImage = { uri: cleanUrl };
            }
            
            return {
              ...post,
              author: post.user?.name || 'Unknown User',
              authorAvatar: post.user?.avatar ? { uri: post.user.avatar } : require('../assets/images/fitness-model.png'),
              image: postImage,
              likes: post.likes_count || 0,
              comments_count: post.comments_count || 0,
              timeAgo: post.time_ago || 'Unknown',
              isAdmin: post.is_admin || false,
              isLiked: post.is_liked || false,
              isPinned: post.is_pinned || false,
              comments: post.comments || []
            };
          });
          
          setPosts(processedPosts);
        } else {
          setPosts([]);
        }
        return data;
      } else {
        // Get the error response body
        const errorData = await response.json();
        console.error('Error response:', errorData);
        console.error('Failed to fetch posts:', response.status);
        setError('Failed to fetch posts');
        return null;
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError('Network error occurred');
      return null;
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  };

  const onRefresh = async () => {
    if (group?.id) {
      setRefreshing(true);
      await fetchPosts(group.id, true);
    }
  };

  useEffect(() => {
    if (group?.id) {
      fetchPosts(group.id);
    }
  }, [group]);

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

  const handleCreatePost = async () => {
    if (!newPostText.trim() && !selectedImage) {
      return;
    }

    try {
      setCreatingPost(true);

      // Get the stored token
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        setAlertConfig({
          title: 'Error',
          message: 'Authentication required',
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
        setCreatingPost(false);
        return;
      }

      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Create FormData for multipart/form-data
      const formData = new FormData();
      formData.append('content', newPostText.trim());

      // Add image if selected (already compressed + JPEG-normalized for device uploads)
      if (selectedImage?.uri) {
        formData.append('image', {
          uri: selectedImage.uri,
          type: selectedImage.type || 'image/jpeg',
          name: selectedImage.fileName || 'image.jpg',
        });
      }

      const response = await fetch(`${API_BASE_URL}/mobile/communication/posts`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        console.log(data,'data');
        if (data.success) {
          console.log('success', data.data);
          // Refresh posts after successful creation
          await fetchPosts(group.id);
          
          // Reset form
          setNewPostText('');
          setSelectedImage(null);
          setShowCreatePost(false);
          
          setAlertConfig({
            title: 'Success',
            message: 'Post created successfully!',
            type: 'success',
            buttons: [
              {
                text: 'OK',
                onPress: () => {},
                style: 'primary',
              },
            ],
          });
          setAlertVisible(true);
        } else {
          setAlertConfig({
            title: 'Error',
            message: data.message || 'Failed to create post',
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
      } else {
        const errorData = await response.json();
        setAlertConfig({
          title: 'Error',
          message: errorData.message || 'Failed to create post',
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
    } catch (error) {
      console.error('Error creating post:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Network error occurred',
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
      setCreatingPost(false);
    }
  };

  const handleLikePost = async (postId) => {
    try {
      // Optimistically update UI
      const updatedPosts = posts.map(post => 
        post.id === postId ? { 
          ...post, 
          likes_count: post.isLiked ? (post.likes_count || 0) - 1 : (post.likes_count || 0) + 1,
          isLiked: !post.isLiked 
        } : post
      );
      setPosts(updatedPosts);

      // Get the stored token
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        setAlertConfig({
          title: 'Error',
          message: 'Authentication required',
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
        // Revert optimistic update
        setPosts(posts);
        return;
      }

      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/communication/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update with server response
          const finalPosts = posts.map(post => 
            post.id === postId ? { 
              ...post, 
              likes_count: data.data.likes_count,
              isLiked: data.data.is_liked
            } : post
          );
          setPosts(finalPosts);
        }
      } else {
        // Revert optimistic update on error
        setPosts(posts);
        const errorData = await response.json();
        setAlertConfig({
          title: 'Error',
          message: errorData.message || 'Failed to like post',
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
    } catch (error) {
      console.error('Error liking post:', error);
      // Revert optimistic update on error
      setPosts(posts);
      setAlertConfig({
        title: 'Error',
        message: 'Network error occurred',
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
  };

  const handleCommentPost = (post) => {
    // Toggle comments visibility for this post
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(post.id)) {
        newSet.delete(post.id);
      } else {
        newSet.add(post.id);
      }
      return newSet;
    });
  };

  const handleViewAllComments = (post) => {
    // Open modal to view all comments
    setSelectedPost(post);
    setShowCommentsModal(true);
  };

  const handleAddComment = async (postId = null, commentTextOverride = null) => {
    const targetPostId = postId || selectedPost?.id;
    // Use override text if provided (for inline comments), otherwise use newComment state
    const commentText = commentTextOverride?.trim() || (postId ? inlineComments[postId]?.trim() : newComment.trim());

    if (!commentText || !targetPostId) {
      return;
    }

    try {
      // Get the stored token
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        setAlertConfig({
          title: 'Error',
          message: 'Authentication required',
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

      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/communication/posts/${targetPostId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          content: commentText
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update the post with the new comment from server
          const updatedPosts = posts.map(post => 
            post.id === targetPostId 
              ? { 
                  ...post, 
                  comments: [...(post.comments || []), data.data.comment],
                  comments_count: data.data.comments_count
                }
              : post
          );
          
          setPosts(updatedPosts);
          
          // Clear the appropriate comment input
          if (postId) {
            // Inline comment - clear inline comment for this post
            setInlineComments(prev => ({ ...prev, [postId]: '' }));
          } else {
            // Modal comment - clear modal comment
            setNewComment('');
          }
          
          // Update selectedPost if it's the same post
          if (selectedPost && selectedPost.id === targetPostId) {
            setSelectedPost({
              ...selectedPost,
              comments: [...(selectedPost.comments || []), data.data.comment],
              comments_count: data.data.comments_count
            });
          }
          
          // Ensure comments stay expanded for this post
          setExpandedComments(prev => {
            const newSet = new Set(prev);
            newSet.add(targetPostId);
            return newSet;
          });
        }
      } else {
        const errorData = await response.json();
        setAlertConfig({
          title: 'Error',
          message: errorData.message || 'Failed to add comment',
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
    } catch (error) {
      console.error('Error adding comment:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Network error occurred',
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
  };

  const closeCommentsModal = () => {
    setShowCommentsModal(false);
    setSelectedPost(null);
    setNewComment('');
  };

  const handleImagePicker = () => {
    if (pickingImage || creatingPost) {
      return;
    }
    openImageLibrary();
  };

  const applyPickedAsset = (asset) => {
    // Defer state update — picker resize callback can jank the JS thread on device
    InteractionManager.runAfterInteractions(() => {
      const normalized = normalizePickedImage(asset);
      setPickingImage(false);
      if (!normalized) {
        setAlertConfig({
          title: 'Error',
          message: 'Could not use that photo. Please try another image.',
          type: 'error',
          buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
        });
        setAlertVisible(true);
        return;
      }
      setSelectedImage(normalized);
    });
  };

  const openCamera = () => {
    if (pickingImage) {
      return;
    }
    setPickingImage(true);
    launchCamera(COMMUNITY_IMAGE_OPTIONS, (response) => {
      if (response.didCancel || response.errorCode) {
        setPickingImage(false);
        if (response.errorMessage) {
          setAlertConfig({
            title: 'Error',
            message: response.errorMessage,
            type: 'error',
            buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
          });
          setAlertVisible(true);
        }
        return;
      }
      if (response.assets?.[0]) {
        applyPickedAsset(response.assets[0]);
      } else {
        setPickingImage(false);
      }
    });
  };

  const openImageLibrary = () => {
    if (pickingImage) {
      return;
    }
    setPickingImage(true);
    launchImageLibrary(COMMUNITY_IMAGE_OPTIONS, (response) => {
      if (response.didCancel || response.errorCode) {
        setPickingImage(false);
        if (response.errorMessage) {
          setAlertConfig({
            title: 'Error',
            message: response.errorMessage,
            type: 'error',
            buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
          });
          setAlertVisible(true);
        }
        return;
      }
      if (response.assets?.[0]) {
        applyPickedAsset(response.assets[0]);
      } else {
        setPickingImage(false);
      }
    });
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
  };

  const renderPost = ({ item: post }) => (
    <View style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.authorAvatarContainer}>
          {post.user?.avatar ? (
            <Image 
              source={{
                uri: post.user.avatar.startsWith('http')
                  ? post.user.avatar
                  : `${API_BASE_URL.replace('/api', '')}${post.user.avatar}`
              }} 
              style={styles.authorAvatar} 
            />
          ) : (
            <View style={styles.authorAvatarPlaceholder}>
              <Text style={styles.authorAvatarIcon}>👤</Text>
            </View>
          )}
        </View>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{String(post.author || 'Unknown User')}</Text>
          <Text style={styles.postTime}>{String(post.timeAgo || 'Unknown')}</Text>
        </View>
        {post.isAdmin && (
          <View style={styles.adminActions}>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="create" size={14} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="trash" size={14} color="#666" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Post Content */}
      <Text style={styles.postContent}>{String(post.content || post.body || 'No content')}</Text>

      {/* Post Image */}
      {post.image && (
        <Image 
          source={typeof post.image === 'string' ? { uri: post.image } : post.image} 
          style={styles.postImage} 
        />
      )}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLikePost(post.id)}
        >
          <Ionicons 
            name={post.isLiked ? "heart" : "heart-outline"} 
            size={16} 
            color={post.isLiked ? "#e74c3c" : "#666"} 
          />
          <Text style={styles.actionText}>{String(post.likes_count || 0)}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleCommentPost(post)}
        >
          <Ionicons name="chatbubble-outline" size={16} color="#666" />
          <Text style={styles.actionText}>{String(post.comments_count || 0)}</Text>
        </TouchableOpacity>
      </View>

      {/* Comments Display - Only show when expanded */}
      {expandedComments.has(post.id) && post.comments && post.comments.length > 0 && (
        <View style={styles.commentsContainer}>
          {post.comments.slice(0, 2).map((comment, index) => (
            <View key={comment.id || index} style={styles.commentItem}>
              <View style={styles.commentItemAvatarContainer}>
                {comment.user?.avatar ? (
                  <Image 
                    source={{
                      uri: comment.user.avatar.startsWith('http')
                        ? comment.user.avatar
                        : `${API_BASE_URL.replace('/api', '')}${comment.user.avatar}`
                    }} 
                    style={styles.commentItemAvatar} 
                  />
                ) : (
                  <View style={styles.commentItemAvatarPlaceholder}>
                    <Text style={styles.commentItemAvatarIcon}>👤</Text>
                  </View>
                )}
              </View>
              <View style={styles.commentItemContent}>
                <Text style={styles.commentAuthor}>{String(comment.user?.name || 'Unknown User')}</Text>
                <Text style={styles.commentContent}>{String(comment.content || 'No content')}</Text>
                <Text style={styles.commentTime}>{String(comment.time_ago || 'Unknown time')}</Text>
              </View>
            </View>
          ))}
          {post.comments.length > 2 && (
            <TouchableOpacity onPress={() => handleViewAllComments(post)}>
              <Text style={styles.viewAllComments}>
                View all {post.comments.length} comments
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Comment Input - Only show when comments are expanded */}
      {expandedComments.has(post.id) && (
        <View style={styles.commentInput}>
          <Image source={getProfileImageSource(userData)} style={styles.commentAvatar} />
          <TextInput
            style={styles.commentTextInput}
            placeholder="Write a comment..."
            placeholderTextColor="#999"
            value={inlineComments[post.id] || ''}
            onChangeText={(text) => setInlineComments(prev => ({ ...prev, [post.id]: text }))}
            onSubmitEditing={() => {
              if (inlineComments[post.id]?.trim()) {
                handleAddComment(post.id);
                setInlineComments(prev => ({ ...prev, [post.id]: '' }));
              }
            }}
          />
          <TouchableOpacity
            onPress={() => {
              if (inlineComments[post.id]?.trim()) {
                handleAddComment(post.id);
                setInlineComments(prev => ({ ...prev, [post.id]: '' }));
              }
            }}
            disabled={!inlineComments[post.id]?.trim()}
            style={styles.commentSendBtn}
          >
            <Ionicons 
              name="send" 
              size={16} 
              color={inlineComments[post.id]?.trim() ? "#007bff" : "#ccc"} 
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
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
        title={group?.name || 'Posts'}
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <View style={{ paddingTop: insets.top + 70, flex: 1 }}>
        {/* Create Post Button */}
        <TouchableOpacity 
          style={styles.createPostBtn}
          onPress={() => setShowCreatePost(true)}
        >
          <Image source={getProfileImageSource(userData)} style={styles.createPostAvatar} />
          <Text style={styles.createPostText}>What's on your mind?</Text>
        </TouchableOpacity>

        {/* Create Post Modal */}
        {showCreatePost && (
          <View style={styles.createPostModal}>
            <View style={styles.createPostHeader}>
              <Text style={styles.createPostTitle}>Create Post</Text>
              <TouchableOpacity onPress={() => {
                setShowCreatePost(false);
                setSelectedImage(null);
              }}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.createPostInput}
              placeholder="What's on your mind?"
              value={newPostText}
              onChangeText={setNewPostText}
              multiline
              placeholderTextColor="#999"
            />
            
            {/* Image Preview */}
            {pickingImage && (
              <View style={styles.imagePickingRow}>
                <ActivityIndicator size="small" color="#222" />
                <Text style={styles.imagePickingText}>Preparing photo…</Text>
              </View>
            )}
            {selectedImage && (
              <View style={styles.imagePreviewContainer}>
                <Image 
                  source={{ uri: selectedImage.uri }} 
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <TouchableOpacity 
                  style={styles.removeImageBtn}
                  onPress={removeSelectedImage}
                >
                  <Ionicons name="close-circle" size={20} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            )}

            {/* Image Upload Options */}
            <View style={styles.imageUploadOptions}>
              <TouchableOpacity 
                style={[styles.imageUploadBtn, pickingImage && styles.imageUploadBtnDisabled]}
                onPress={handleImagePicker}
                disabled={pickingImage || creatingPost}
              >
                <Ionicons name="image-outline" size={16} color="#007bff" />
                <Text style={styles.imageUploadText}>Add Photo</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.createPostActions}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => {
                  setShowCreatePost(false);
                  setSelectedImage(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.postBtn, (!newPostText.trim() && !selectedImage) && styles.postBtnDisabled]}
                onPress={handleCreatePost}
                disabled={(!newPostText.trim() && !selectedImage) || creatingPost}
              >
                {creatingPost ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.postBtnText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Posts List */}
        {loading ? (
          <View style={styles.postsLoadingContainer}>
            <ActivityIndicator size="large" color="#222" />
            <Text style={styles.postsLoadingText}>Loading posts...</Text>
          </View>
        ) : error ? (
          <View style={styles.postsErrorContainer}>
            <Text style={styles.postsErrorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPosts(group.id)}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : posts.length > 0 ? (
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#007bff']}
                tintColor="#007bff"
              />
            }
          />
        ) : (
          <View style={styles.noPostsContainer}>
            <Text style={styles.noPostsText}>No posts yet</Text>
            <Text style={styles.noPostsSubtext}>Be the first to share something!</Text>
          </View>
        )}

        {/* Comments Modal */}
        <Modal
          visible={showCommentsModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeCommentsModal}
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={closeCommentsModal}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Comments List */}
            <FlatList
              data={selectedPost?.comments || []}
              renderItem={({ item: comment }) => (
                <View style={styles.modalCommentItem}>
                  <View style={styles.modalCommentAvatarContainer}>
                    {comment.user?.avatar ? (
                      <Image 
                        source={{
                          uri: comment.user.avatar.startsWith('http')
                            ? comment.user.avatar
                            : `${API_BASE_URL.replace('/api', '')}${comment.user.avatar}`
                        }} 
                        style={styles.modalCommentAvatar} 
                      />
                    ) : (
                      <View style={styles.modalCommentAvatarPlaceholder}>
                        <Text style={styles.modalCommentAvatarIcon}>👤</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.modalCommentContent}>
                    <Text style={styles.modalCommentAuthor}>{String(comment.user?.name || 'Unknown User')}</Text>
                    <Text style={styles.modalCommentText}>{String(comment.content || 'No content')}</Text>
                    <Text style={styles.modalCommentTime}>{String(comment.time_ago || 'Unknown time')}</Text>
                  </View>
                </View>
              )}
              keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
              style={styles.modalCommentsList}
              showsVerticalScrollIndicator={false}
            />

            {/* Comment Input */}
            <View style={styles.modalCommentInput}>
              <Image source={getProfileImageSource(userData)} style={styles.modalInputAvatar} />
              <TextInput
                style={styles.modalInputField}
                placeholder="Write a comment..."
                value={newComment}
                onChangeText={setNewComment}
                placeholderTextColor="#999"
                multiline
              />
              <TouchableOpacity 
                style={[styles.modalSendBtn, !newComment.trim() && styles.modalSendBtnDisabled]}
                onPress={handleAddComment}
                disabled={!newComment.trim()}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  // Post Styles
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 10,
  },
  authorAvatarContainer: {
    marginRight: 12,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  authorAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  authorAvatarIcon: {
    fontSize: 20,
    color: '#757575',
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  postTime: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    fontWeight: '600',
  },
  adminActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 6,
    marginLeft: 4,
  },
  postContent: {
    fontSize: 13,
    color: '#1a1a1a',
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingBottom: 10,
    fontWeight: '500',
  },
  postImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 6,
    fontWeight: '600',
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  commentTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#1a1a1a',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  commentSendBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Comments Display Styles
  commentsContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  commentItemAvatarContainer: {
    marginRight: 10,
  },
  commentItemAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentItemAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  commentItemAvatarIcon: {
    fontSize: 16,
    color: '#757575',
  },
  commentItemContent: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  commentContent: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 4,
    fontWeight: '500',
  },
  commentTime: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  viewAllComments: {
    fontSize: 13,
    color: '#007bff',
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  // Create Post Styles
  createPostBtn: {
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
  createPostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  createPostText: {
    fontSize: 13,
    color: '#888',
    flex: 1,
    fontWeight: '500',
  },
  createPostModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  createPostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  createPostTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  createPostInput: {
    fontSize: 13,
    color: '#1a1a1a',
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 18,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginHorizontal: 14,
    marginBottom: 14,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  imagePickingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  imagePickingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  imageUploadOptions: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  imageUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  imageUploadBtnDisabled: {
    opacity: 0.5,
  },
  imageUploadText: {
    fontSize: 13,
    color: '#007bff',
    marginLeft: 8,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  createPostActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  postBtn: {
    backgroundColor: '#007bff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  postBtnDisabled: {
    backgroundColor: '#ccc',
  },
  postBtnText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // Loading and Error States
  postsLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: 20,
  },
  postsLoadingText: {
    fontSize: 13,
    color: '#888',
    marginTop: 12,
    fontWeight: '500',
  },
  postsErrorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: 20,
  },
  postsErrorText: {
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
  noPostsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: 20,
  },
  noPostsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  noPostsSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 6,
  },
  // Comments Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingTop: 50, // Account for status bar
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalCommentsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalCommentItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalCommentAvatarContainer: {
    marginRight: 10,
  },
  modalCommentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  modalCommentAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  modalCommentAvatarIcon: {
    fontSize: 16,
    color: '#757575',
  },
  modalCommentContent: {
    flex: 1,
  },
  modalCommentAuthor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  modalCommentText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 4,
    fontWeight: '500',
  },
  modalCommentTime: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  modalCommentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalInputAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  modalInputField: {
    flex: 1,
    fontSize: 13,
    color: '#1a1a1a',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 12,
    lineHeight: 18,
  },
  modalSendBtn: {
    backgroundColor: '#007bff',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSendBtnDisabled: {
    backgroundColor: '#ccc',
  },
});
