import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

const { width: screenWidth } = Dimensions.get('window');

const ActivityDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { activity: routeActivity, activityId: paramActivityId } = route.params || {};
  
  const [activity, setActivity] = useState(routeActivity || null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Video states
  const [currentVideo, setCurrentVideo] = useState(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = API_BASE_URL.replace('/api', ''); // For video/image URLs
  const PRODUCTION_VIDEO_BASE = 'https://phpstack-1542257-6177868.cloudwaysapps.com';

  // Fetch full activity details by exercise id/activity id from details endpoint only.
  // Avoid list endpoint fallback because it can return a generic collection.
  const fetchActivityDetails = async (activityIdentifier) => {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) return null;
      const authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;

      // Primary: dedicated details endpoint (returns one activity)
      const detailsResponse = await fetch(`${API_BASE_URL}/mobile/workout-activities/${activityIdentifier}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (detailsResponse.ok) {
        const detailsResult = await detailsResponse.json();
        if (detailsResult?.data && !Array.isArray(detailsResult.data)) return detailsResult.data;
        if (detailsResult?.activity) return detailsResult.activity;
        if (detailsResult?.exercise) return detailsResult;
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  // Helper function to normalize video URLs - replace localhost with production URL
  const normalizeVideoUrl = (videoUrl) => {
    if (!videoUrl) return null;

    let url = String(videoUrl).trim();

    // Fix malformed URLs like:
    // "http://localhost/APP_URL=http://localhost:8080/videos/..."
    if (url.includes('APP_URL=')) {
      const parts = url.split('APP_URL=');
      url = parts[parts.length - 1]; // take the actual URL part after APP_URL=
    }

    // Replace any localhost/127.x address (any port) with production base
    url = url.replace(
      /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//,
      `${PRODUCTION_VIDEO_BASE}/`
    );

    // If it's still not an absolute URL, prefix with production base
    if (!/^https?:\/\//i.test(url)) {
      if (url.startsWith('/')) {
        url = `${PRODUCTION_VIDEO_BASE}${url}`;
      } else {
        url = `${PRODUCTION_VIDEO_BASE}/${url}`;
      }
    }

    return url;
  };


  // Process activity data - extract and fix URLs
  const processActivityData = (activityData) => {
    if (!activityData) return null;

    // Process thumbnail URL
    let thumbnailUrl = null;
    if (activityData.thumbnail_url) {
      const match = activityData.thumbnail_url.match(/thumbnails\/(.+)$/);
      if (match) {
        const filename = encodeURIComponent(match[1]);
        thumbnailUrl = `${BASE_URL}/thumbnails/${filename}`;
      } else if (activityData.thumbnail_url.startsWith('http') && !activityData.thumbnail_url.includes('localhost/APP_URL')) {
        thumbnailUrl = activityData.thumbnail_url;
      }
    } else if (activityData.thumbnail) {
      const match = activityData.thumbnail.match(/thumbnails\/(.+)$/);
      if (match) {
        const filename = encodeURIComponent(match[1]);
        thumbnailUrl = `${BASE_URL}/thumbnails/${filename}`;
      } else if (activityData.thumbnail.startsWith('http') && !activityData.thumbnail.includes('localhost/APP_URL')) {
        thumbnailUrl = activityData.thumbnail;
      }
    }

    // Process video URL
    let videoUrl = null;
    
    // PRIORITY 1: Check direct video fields (CRM workouts)
    if (activityData.video_url) {
      // Normalize URL first
      let normalizedUrl = normalizeVideoUrl(activityData.video_url);
      const match = normalizedUrl.match(/videos\/(.+)$/);
      if (match) {
        const videoPath = match[1];
        videoUrl = `${BASE_URL}/videos/${videoPath}`;
      } else if (normalizedUrl.startsWith('http') && !normalizedUrl.includes('localhost/APP_URL')) {
        videoUrl = normalizedUrl;
      }
    } else if (activityData.video_link) {
      // Normalize URL first
      let normalizedUrl = normalizeVideoUrl(activityData.video_link);
      const match = normalizedUrl.match(/videos\/(.+)$/);
      if (match) {
        const videoPath = match[1];
        videoUrl = `${BASE_URL}/videos/${videoPath}`;
      } else if (normalizedUrl.startsWith('http') && !normalizedUrl.includes('localhost/APP_URL')) {
        videoUrl = normalizedUrl;
      }
    }
    
    // PRIORITY 2: Check nested exercise object (for app-created workouts)
    if (!videoUrl && activityData.exercise) {
      const exerciseVideoUrl = activityData.exercise.video_url || activityData.exercise.video_link;
      if (exerciseVideoUrl) {
        // Normalize the URL first (replace localhost with production URL)
        let normalizedUrl = normalizeVideoUrl(exerciseVideoUrl);
        
        // Then process the path
        const match = normalizedUrl.match(/videos\/(.+)$/);
        if (match) {
          const videoPath = match[1];
          videoUrl = `${BASE_URL}/videos/${videoPath}`;
        } else if (normalizedUrl.startsWith('http') && !normalizedUrl.includes('localhost/APP_URL')) {
          videoUrl = normalizedUrl;
        }
      }
      
      // Also check video_relative_path in exercise object
      if (!videoUrl && activityData.exercise.video_relative_path) {
        const normalizedPath = activityData.exercise.video_relative_path.replace(/\\/g, '/');
        const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
        videoUrl = `${PRODUCTION_VIDEO_BASE}/videos/${encodedPath}`;
      }
    }

    return {
      ...activityData,
      processedThumbnailUrl: thumbnailUrl,
      processedVideoUrl: videoUrl,
    };
  };

  const setupVideoFromActivity = (activityData) => {
    if (!activityData) {
      setCurrentVideo(null);
      setShowVideoPlayer(false);
      setVideoLoading(false);
      setVideoReady(false);
      return;
    }

    const buildVideoObject = (videoLink, nameFallback) => ({
      video_link: normalizeVideoUrl(videoLink),
      isDirectLink: true,
      name: activityData.exercise_name || activityData.name || nameFallback || 'Exercise Video',
    });

    if (activityData.processedVideoUrl) {
      setCurrentVideo(buildVideoObject(activityData.processedVideoUrl));
      setShowVideoPlayer(true);
      setVideoLoading(true);
      setVideoReady(false);
      return;
    }

    if (activityData.exercise_details?.video_link) {
      setCurrentVideo(buildVideoObject(activityData.exercise_details.video_link));
      setShowVideoPlayer(true);
      setVideoLoading(true);
      setVideoReady(false);
      return;
    }

    if (activityData.exercise?.video_link || activityData.exercise?.video_url) {
      const videoLink = activityData.exercise.video_link || activityData.exercise.video_url;
      setCurrentVideo(buildVideoObject(videoLink, activityData.exercise?.name));
      setShowVideoPlayer(true);
      setVideoLoading(true);
      setVideoReady(false);
      return;
    }

    if (activityData.video_relative_path) {
      const normalizedPath = activityData.video_relative_path.replace(/\\/g, '/');
      const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
      const videoUrl = `${PRODUCTION_VIDEO_BASE}/videos/${encodedPath}`;
      setCurrentVideo(buildVideoObject(videoUrl));
      setShowVideoPlayer(true);
      setVideoLoading(true);
      setVideoReady(false);
      return;
    }

    if (activityData.exercise?.video_relative_path) {
      const normalizedPath = activityData.exercise.video_relative_path.replace(/\\/g, '/');
      const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
      const videoUrl = `${PRODUCTION_VIDEO_BASE}/videos/${encodedPath}`;
      setCurrentVideo(buildVideoObject(videoUrl, activityData.exercise?.name));
      setShowVideoPlayer(true);
      setVideoLoading(true);
      setVideoReady(false);
      return;
    }

    setCurrentVideo(null);
    setShowVideoPlayer(false);
    setVideoLoading(false);
    setVideoReady(false);
  };

  // Process and set activity data when component mounts; refetch by ID to get complete video URL
  useEffect(() => {
    if (!routeActivity) {
      setActivity(null);
      setupVideoFromActivity(null);
      return;
    }

    const activityIdentifier =
      paramActivityId ??
      routeActivity.exercise_id ??
      routeActivity.activity_id ??
      routeActivity.id;

    if (activityIdentifier) {
      setDetailsLoading(true);
      fetchActivityDetails(activityIdentifier)
        .then((fullDetails) => {
          const merged = fullDetails
            ? {
                ...routeActivity,
                ...fullDetails,
                exercise_id: routeActivity.exercise_id ?? fullDetails.exercise_id ?? fullDetails.id,
                exercise_name: routeActivity.exercise_name ?? fullDetails.exercise_name ?? fullDetails.name,
                // Keep per-activity media from navigation payload when present.
                exercise: routeActivity.exercise ?? fullDetails.exercise,
                exercise_details: routeActivity.exercise_details ?? fullDetails.exercise_details,
                video_url: routeActivity.video_url ?? fullDetails.video_url,
                video_link: routeActivity.video_link ?? fullDetails.video_link,
                video_relative_path: routeActivity.video_relative_path ?? fullDetails.video_relative_path,
              }
            : routeActivity;
          const processedData = processActivityData(merged);
          setActivity(processedData);
          setupVideoFromActivity(processedData);
        })
        .catch(() => {
          const processedData = processActivityData(routeActivity);
          setActivity(processedData);
          setupVideoFromActivity(processedData);
        })
        .finally(() => setDetailsLoading(false));
    } else {
      const processedData = processActivityData(routeActivity);
      setActivity(processedData);
      setupVideoFromActivity(processedData);
    }
  }, [routeActivity, paramActivityId]);

  // Handle case when no activity data is available
  useEffect(() => {
    if (!activity && !routeActivity) {
      setAlertConfig({
        title: 'No Activity Data',
        message: 'No activity information was provided. Please go back and select an activity.',
        type: 'warning',
        buttons: [
          {
            text: 'Go Back',
            onPress: () => navigation.goBack(),
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
    }
  }, [activity, routeActivity, navigation]);
 


  // Video player handlers
  const onVideoLoad = (data) => {
    setVideoReady(true);
    setVideoLoading(false);
  };

  const onVideoError = () => {
    setVideoLoading(false);
    setVideoReady(false);
  };

  const onVideoEnd = () => {
    // Video will auto-repeat due to repeat={true}
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
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
            {activity?.exercise_name || 'Exercise Name'}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {detailsLoading ? (
        <View style={[styles.contentContainer, styles.centered]}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : activity ? (
        <View style={styles.contentContainer}>
          {/* Video - always render when available so it can load in background */}
          {showVideoPlayer && currentVideo ? (
            <Video
              source={{ 
                uri: normalizeVideoUrl(currentVideo.video_link)
              }}
              style={[
                styles.videoPlayerPlain,
                !videoReady && styles.videoHidden
              ]}
              paused={!videoReady}
              repeat={true}
              resizeMode="contain"
              onLoad={onVideoLoad}
              onError={onVideoError}
              onEnd={onVideoEnd}
            />
          ) : null}
          
          {/* Thumbnail overlay - shown while video is loading */}
          {showVideoPlayer && currentVideo && videoLoading && !videoReady && activity?.processedThumbnailUrl ? (
            <View style={styles.thumbnailOverlay}>
              <Image 
                source={{ uri: activity.processedThumbnailUrl }} 
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            </View>
          ) : null}
          
          {/* Show thumbnail if no video available */}
          {!showVideoPlayer && activity?.processedThumbnailUrl ? (
            <View style={styles.thumbnailContainer}>
              <Image 
                source={{ uri: activity.processedThumbnailUrl }} 
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
            </View>
          ) : null}
          
          {/* Show loading if no thumbnail and video is loading */}
          {showVideoPlayer && currentVideo && videoLoading && !videoReady && !activity?.processedThumbnailUrl ? (
            <View style={styles.videoLoadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No activity data was provided.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: 56,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0, // Important for text truncation in flexbox
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as back button to center the title
    flexShrink: 0, // Prevent spacer from shrinking
  },
  contentContainer: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 400,
  },
  errorText: {
    fontSize: 18,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  videoPlayerPlain: {
    width: screenWidth,
    height: '100%',
    alignSelf: 'center',
  },
  videoHidden: {
    opacity: 0,
  },
  thumbnailContainer: {
    width: screenWidth,
    height: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  thumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: screenWidth,
    height: '100%',
    backgroundColor: '#000',
    zIndex: 1,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: screenWidth,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});

export default ActivityDetailsScreen;
