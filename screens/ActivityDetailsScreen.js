import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Video from 'react-native-video';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';
import {
  mergeActivityWithCatalogDetails,
  getDisplaySetRows,
  extractPlanPrescription,
} from '../utils/workoutPlanUtils';
import {
  consumeActivityDetailsHandoff,
  getActivityDetailsHandoffRows,
} from '../utils/activityDetailsHandoff';
import { onWorkoutPlanUpdated } from '../utils/workoutPlanEvents';

const { width: screenWidth } = Dimensions.get('screen');
const VIDEO_HEIGHT = Math.round(screenWidth * 0.56);

const ActivityDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {
    activity: routeActivity,
    activityId: paramActivityId,
    displaySetRows: routeDisplaySetRows,
    displaySetRowsJson: routeDisplaySetRowsJson,
    workoutId: routeWorkoutId,
  } = route.params || {};

  const resolveIncomingSetRows = (activityObj, rowsParam, rowsJson, { consume = false } = {}) => {
    const handoffRows = consume
      ? consumeActivityDetailsHandoff()?.displaySetRows
      : getActivityDetailsHandoffRows();
    if (Array.isArray(handoffRows) && handoffRows.length > 0) {
      return handoffRows;
    }
    if (Array.isArray(rowsParam) && rowsParam.length > 0) {
      return rowsParam;
    }
    if (typeof rowsJson === 'string' && rowsJson.length > 2) {
      try {
        const parsed = JSON.parse(rowsJson);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (_) {
        /* ignore */
      }
    }
    // Prefer activity.sets_configuration already prepared by Workout Details
    const fromActivity = getDisplaySetRows(activityObj);
    if (fromActivity.length > 0) return fromActivity;
    return [];
  };

  const [activity, setActivity] = useState(routeActivity || null);
  // Frozen coach/plan sets — same rows as Workout Details card
  const [setRows, setSetRows] = useState(() =>
    resolveIncomingSetRows(routeActivity, routeDisplaySetRows, routeDisplaySetRowsJson, {
      consume: false,
    })
  );

  const [currentVideo, setCurrentVideo] = useState(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });
  const activityRef = useRef(activity);
  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  const applyUpdatedActivity = useCallback((updated) => {
    if (!updated) return;
    const rows = Array.isArray(updated.sets_configuration)
      ? updated.sets_configuration.map((row, index) => ({
          key: `set-${index + 1}`,
          reps: row.reps,
          weight: row.weight ?? 0,
          rest: row.rest ?? row.rest_seconds ?? 30,
          ...(row.time != null ? { time: row.time } : {}),
        }))
      : getDisplaySetRows(updated);

    const next = processActivityData({
      ...(activityRef.current || routeActivity || {}),
      ...updated,
      sets: rows.length || updated.sets,
      sets_configuration: rows,
      plan_sets_configuration: rows,
      personal_note: updated.personal_note ?? updated.notes ?? null,
      notes: updated.personal_note ?? updated.notes ?? null,
    });
    setActivity(next);
    setSetRows(rows);
    setupVideoFromActivity(next);
  }, [routeActivity]);

  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = String(API_BASE_URL || '').replace(/\/api\/?$/, '');
  const PRODUCTION_VIDEO_BASE = 'https://phpstack-1542257-6177868.cloudwaysapps.com';

  const fetchActivityDetails = async (activityIdentifier) => {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) return null;
      const authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;

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

  const normalizeVideoUrl = (videoUrl) => {
    if (!videoUrl) return null;

    let url = String(videoUrl).trim();

    if (url.includes('APP_URL=')) {
      const parts = url.split('APP_URL=');
      url = parts[parts.length - 1];
    }

    url = url.replace(
      /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//,
      `${PRODUCTION_VIDEO_BASE}/`
    );

    if (!/^https?:\/\//i.test(url)) {
      if (url.startsWith('/')) {
        url = `${PRODUCTION_VIDEO_BASE}${url}`;
      } else {
        url = `${PRODUCTION_VIDEO_BASE}/${url}`;
      }
    }

    return url;
  };

  const processActivityData = (activityData) => {
    if (!activityData) return null;

    let thumbnailUrl = null;
    const thumbField = activityData.thumbnail_url || activityData.thumbnail;
    if (thumbField) {
      const match = String(thumbField).match(/thumbnails\/(.+)$/i);
      if (match) {
        thumbnailUrl = `${BASE_URL}/thumbnails/${encodeURIComponent(match[1].split('?')[0])}`;
      } else if (String(thumbField).startsWith('http') && !String(thumbField).includes('localhost/APP_URL')) {
        thumbnailUrl = thumbField;
      } else if (!String(thumbField).startsWith('http')) {
        thumbnailUrl = `${BASE_URL}/${String(thumbField).replace(/^\//, '')}`;
      }
    }

    let videoUrl = null;
    const directVideo = activityData.video_url || activityData.video_link;
    if (directVideo) {
      const normalizedUrl = normalizeVideoUrl(directVideo);
      const match = normalizedUrl?.match(/videos\/(.+)$/);
      if (match) {
        videoUrl = `${BASE_URL}/videos/${match[1]}`;
      } else if (normalizedUrl?.startsWith('http') && !normalizedUrl.includes('localhost/APP_URL')) {
        videoUrl = normalizedUrl;
      }
    }

    if (!videoUrl && activityData.exercise) {
      const exerciseVideoUrl = activityData.exercise.video_url || activityData.exercise.video_link;
      if (exerciseVideoUrl) {
        const normalizedUrl = normalizeVideoUrl(exerciseVideoUrl);
        const match = normalizedUrl?.match(/videos\/(.+)$/);
        if (match) {
          videoUrl = `${BASE_URL}/videos/${match[1]}`;
        } else if (normalizedUrl?.startsWith('http') && !normalizedUrl.includes('localhost/APP_URL')) {
          videoUrl = normalizedUrl;
        }
      }

      if (!videoUrl && activityData.exercise.video_relative_path) {
        const normalizedPath = activityData.exercise.video_relative_path.replace(/\\/g, '/');
        const encodedPath = normalizedPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
        videoUrl = `${PRODUCTION_VIDEO_BASE}/videos/${encodedPath}`;
      }
    }

    if (!videoUrl && activityData.video_relative_path) {
      const normalizedPath = activityData.video_relative_path.replace(/\\/g, '/');
      const encodedPath = normalizedPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
      videoUrl = `${PRODUCTION_VIDEO_BASE}/videos/${encodedPath}`;
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

    const candidates = [
      activityData.processedVideoUrl,
      activityData.exercise_details?.video_link,
      activityData.exercise?.video_link,
      activityData.exercise?.video_url,
    ].filter(Boolean);

    if (candidates.length > 0) {
      setCurrentVideo(buildVideoObject(candidates[0]));
      setShowVideoPlayer(true);
      setVideoLoading(true);
      setVideoReady(false);
      return;
    }

    if (activityData.video_relative_path || activityData.exercise?.video_relative_path) {
      const rel = activityData.video_relative_path || activityData.exercise.video_relative_path;
      const normalizedPath = String(rel).replace(/\\/g, '/');
      const encodedPath = normalizedPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
      setCurrentVideo(buildVideoObject(`${PRODUCTION_VIDEO_BASE}/videos/${encodedPath}`));
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

  useEffect(() => {
    if (!routeActivity) {
      setActivity(null);
      setSetRows([]);
      setupVideoFromActivity(null);
      return;
    }

    // Exact rows from Workout Details card (handoff / params) — never shrink via catalog
    const exactRows = resolveIncomingSetRows(
      routeActivity,
      routeDisplaySetRows,
      routeDisplaySetRowsJson,
      { consume: true }
    );
    const withPlan = {
      ...routeActivity,
      sets: exactRows.length || routeActivity?.sets,
      reps: exactRows[0]?.reps ?? routeActivity?.reps,
      rest_seconds: exactRows[0]?.rest ?? routeActivity?.rest_seconds,
      weight: exactRows[0]?.weight ?? routeActivity?.weight ?? 0,
      sets_configuration: exactRows,
      plan_sets_configuration: exactRows,
    };
    const initialProcessed = processActivityData(withPlan);
    setActivity(initialProcessed);
    setSetRows(exactRows);
    setupVideoFromActivity(initialProcessed);

    // Only fetch catalog by exercise_id for video/muscles — never by plan id
    const exerciseId = paramActivityId ?? routeActivity.exercise_id;
    if (!exerciseId) return;

    const frozenRows = exactRows;
    fetchActivityDetails(exerciseId)
      .then((fullDetails) => {
        if (!fullDetails) return;
        setActivity((prev) => {
          const planSource = {
            ...(prev || routeActivity),
            sets: frozenRows.length,
            sets_configuration: frozenRows,
            plan_sets_configuration: frozenRows,
          };
          const merged = mergeActivityWithCatalogDetails(planSource, fullDetails);
          // Force frozen rows again after merge
          const processedData = processActivityData({
            ...merged,
            sets: frozenRows.length,
            sets_configuration: frozenRows,
            plan_sets_configuration: frozenRows,
          });
          setupVideoFromActivity(processedData);
          return processedData;
        });
        // Never let catalog change visible set count
        setSetRows(frozenRows);
      })
      .catch(() => {
        // Keep initial plan data
      });
  }, [routeActivity, paramActivityId, routeDisplaySetRows, routeDisplaySetRowsJson]);

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

  const matchesCurrentPlan = useCallback((updated) => {
    if (!updated) return false;
    const currentIds = [
      activityRef.current?.workout_activity_plan_id,
      activityRef.current?.id,
      activityRef.current?.activity_plan_id,
      routeActivity?.workout_activity_plan_id,
      routeActivity?.id,
      routeActivity?.activity_plan_id,
    ]
      .filter(Boolean)
      .map(String);
    const updatedIds = [
      updated.workout_activity_plan_id,
      updated.id,
      updated.activity_id,
      updated.activity_plan_id,
      updated.plan_id,
    ]
      .filter(Boolean)
      .map(String);
    if (currentIds.length === 0) return true;
    return updatedIds.some((id) => currentIds.includes(id));
  }, [routeActivity]);

  // Sync when sets saved from editor — update UI immediately
  useEffect(() => {
    return onWorkoutPlanUpdated(({ activity: updated }) => {
      if (!matchesCurrentPlan(updated)) return;
      applyUpdatedActivity(updated);
    });
  }, [matchesCurrentPlan, applyUpdatedActivity]);

  const refreshFromServer = useCallback(async () => {
    const workoutId =
      routeWorkoutId ||
      activityRef.current?.workout_id ||
      routeActivity?.workout_id;
    const planId =
      activityRef.current?.workout_activity_plan_id ||
      activityRef.current?.id ||
      routeActivity?.workout_activity_plan_id ||
      routeActivity?.id;

    if (!workoutId) {
      // No workout id — refresh catalog media only
      const exerciseId =
        paramActivityId ||
        activityRef.current?.exercise_id ||
        routeActivity?.exercise_id;
      if (!exerciseId) return;
      const fullDetails = await fetchActivityDetails(exerciseId);
      if (!fullDetails) return;
      const current = activityRef.current || routeActivity;
      const rows = getDisplaySetRows(current);
      const merged = mergeActivityWithCatalogDetails(
        {
          ...current,
          sets_configuration: rows,
          plan_sets_configuration: rows,
        },
        fullDetails
      );
      applyUpdatedActivity({
        ...merged,
        sets_configuration: rows.length ? rows : getDisplaySetRows(merged),
      });
      return;
    }

    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) return;
      const authHeader = userToken.startsWith('Bearer ')
        ? userToken
        : `Bearer ${userToken}`;

      const response = await fetch(
        `${API_BASE_URL}/mobile/workout-activities/workout/${workoutId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: authHeader,
            'Cache-Control': 'no-cache',
          },
        }
      );

      if (!response.ok) return;
      const data = await response.json();
      const days = data?.data?.days || data?.days || [];

      let found = null;
      for (const day of days) {
        const plans = day.workout_activity_plans || day.activities || [];
        found = plans.find((p) => {
          const ids = [p.id, p.workout_activity_plan_id, p.plan_id]
            .filter(Boolean)
            .map(String);
          return planId && ids.includes(String(planId));
        });
        if (found) break;
      }

      if (found) {
        applyUpdatedActivity({
          ...(activityRef.current || routeActivity || {}),
          ...found,
          workout_id: found.workout_id || workoutId,
          workout_activity_plan_id: found.id || planId,
          id: found.id || planId,
        });
      }
    } catch (e) {
      console.log('[ActivityDetails] refreshFromServer error', e?.message || e);
    }
  }, [
    routeWorkoutId,
    routeActivity,
    paramActivityId,
    API_BASE_URL,
    applyUpdatedActivity,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFromServer();
    } finally {
      setRefreshing(false);
    }
  }, [refreshFromServer]);

  // When returning from editor (not first open), soft-refresh from server
  const isFirstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      refreshFromServer();
    }, [refreshFromServer])
  );

  const onVideoLoad = () => {
    setVideoReady(true);
    setVideoLoading(false);
  };

  const onVideoError = () => {
    setVideoLoading(false);
    setVideoReady(false);
  };

  const activityName = activity?.exercise_name || activity?.name || 'Exercise';
  const level =
    activity?.level ||
    activity?.difficulty ||
    activity?.exercise?.level ||
    activity?.exercise_details?.level ||
    null;

  const note =
    activity?.personal_note ||
    activity?.notes ||
    activity?.note ||
    null;

  const primaryMuscles =
    activity?.primary_muscle_groups ||
    activity?.muscles_targeted ||
    activity?.exercise?.primary_muscle_groups ||
    activity?.exercise?.muscles_targeted ||
    activity?.exercise_details?.muscles_targeted ||
    null;

  const equipment =
    activity?.equipment ||
    activity?.exercise?.equipment ||
    activity?.exercise_details?.equipment ||
    null;

  const formatWeight = (weight) => {
    const cleaned = String(weight ?? '').replace(/[^\d.-]/g, '');
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0) return '0 lbs';
    return `${n} lbs`;
  };

  const openSetEditor = () => {
    const editorActivity = {
      ...activity,
      ...extractPlanPrescription(activity),
      sets_configuration: setRows.map((row) => ({
        reps: row.reps,
        weight: row.weight ?? 0,
        rest: row.rest,
        ...(row.time != null ? { time: row.time } : {}),
      })),
    };
    navigation.navigate('ActivitySetEditor', {
      activity: {
        ...editorActivity,
        workout_id: editorActivity?.workout_id || routeWorkoutId || null,
        workout_activity_plan_id:
          editorActivity?.workout_activity_plan_id ||
          editorActivity?.id ||
          null,
      },
      workoutId: routeWorkoutId || editorActivity?.workout_id || null,
      onSave: (updatedActivity) => {
        // Immediate local update (don't wait for focus refresh)
        applyUpdatedActivity(updatedActivity);
      },
    });
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
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {activityName}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.infoButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => {
            setAlertConfig({
              title: activityName,
              message: activity?.description || activity?.exercise?.description || 'Activity details from your workout plan.',
              type: 'info',
              buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
            });
            setAlertVisible(true);
          }}
        >
          <Ionicons name="information-circle-outline" size={22} color="#222" />
        </TouchableOpacity>
      </View>

      {activity ? (
        <ScrollView
          style={styles.contentContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#222"
              colors={['#222']}
            />
          }
        >
          {/* Video */}
          <View style={styles.videoBox}>
            {showVideoPlayer && currentVideo ? (
              <Video
                source={{ uri: normalizeVideoUrl(currentVideo.video_link) }}
                style={[styles.videoPlayer, !videoReady && styles.videoHidden]}
                paused={!videoReady}
                repeat={true}
                resizeMode="contain"
                onLoad={onVideoLoad}
                onError={onVideoError}
              />
            ) : null}

            {showVideoPlayer && currentVideo && videoLoading && !videoReady ? (
              <View style={styles.videoPlaceholder}>
                {activity?.processedThumbnailUrl ? (
                  <Image
                    source={{ uri: activity.processedThumbnailUrl }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                ) : null}
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              </View>
            ) : null}

            {!showVideoPlayer ? (
              <View style={styles.videoPlaceholder}>
                {activity?.processedThumbnailUrl ? (
                  <Image
                    source={{ uri: activity.processedThumbnailUrl }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialCommunityIcons name="play-circle-outline" size={48} color="#bbb" />
                )}
              </View>
            ) : null}
          </View>

          {/* Level */}
          {level ? (
            <View style={styles.levelRow}>
              <MaterialCommunityIcons name="chart-bar" size={18} color="#E53935" />
              <Text style={styles.levelText}>{String(level)}</Text>
            </View>
          ) : null}

          {/* Sets: 3 per row, wrap vertically (no horizontal scroll) */}
          <View style={styles.setsSection}>
            {setRows.length > 0 ? (
              <View style={styles.setsGrid}>
                {setRows.map((set, setIndex) => (
                  <View key={set.key || `set-${setIndex}`} style={styles.setCell}>
                    <Text style={styles.setIndexLabel}>Set {setIndex + 1}</Text>
                    <View style={styles.setCard}>
                      <Text style={styles.setCardText} numberOfLines={1}>
                        {set.time != null && !(set.reps > 0)
                          ? `${set.time}s · ${formatWeight(set.weight)}`
                          : `${set.reps ?? 0}x · ${formatWeight(set.weight)}`}
                      </Text>
                    </View>
                    <View style={styles.restCard}>
                      <Ionicons name="time-outline" size={14} color="#666" />
                      <Text style={styles.restCardText}>{set.rest ?? 30}s</Text>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.setCell}
                  onPress={openSetEditor}
                  activeOpacity={0.8}
                >
                  <View style={styles.addSetCard}>
                    <Ionicons name="add" size={28} color="#888" />
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptySetsRow}>
                <View style={styles.emptySetsBox}>
                  <Text style={styles.emptySetsText}>No sets configured for this activity</Text>
                </View>
                <TouchableOpacity
                  style={styles.addSetCardStandalone}
                  onPress={openSetEditor}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={28} color="#888" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Note */}
          <TouchableOpacity style={styles.noteRow} onPress={openSetEditor} activeOpacity={0.7}>
            <Ionicons name="document-text-outline" size={18} color="#666" />
            <Text style={styles.noteText}>{note ? String(note) : 'Add note'}</Text>
          </TouchableOpacity>

          {/* Primary muscles */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Primary</Text>
            <Text style={styles.sectionValue}>
              {primaryMuscles
                ? Array.isArray(primaryMuscles)
                  ? primaryMuscles.join(', ')
                  : String(primaryMuscles)
                : 'Not specified'}
            </Text>
          </View>

          {/* Equipment */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Equipment</Text>
            <Text style={styles.sectionValue}>
              {equipment
                ? Array.isArray(equipment)
                  ? equipment.join(', ')
                  : String(equipment)
                : 'Not specified'}
            </Text>
          </View>
        </ScrollView>
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
    backgroundColor: '#f7f7f7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    minHeight: 56,
  },
  backButton: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  infoButton: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBox: {
    width: screenWidth,
    height: VIDEO_HEIGHT,
    backgroundColor: '#eaeaea',
    overflow: 'hidden',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  videoHidden: {
    opacity: 0,
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#eaeaea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  levelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  setsSection: {
    marginTop: 4,
  },
  setsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  // Exactly 3 columns
  setCell: {
    width: '33.333%',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  setIndexLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
    textAlign: 'center',
  },
  setCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  setCardText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  restCard: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 36,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  restCardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
  },
  addSetCard: {
    minHeight: 84,
    marginTop: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  emptySetsBox: {
    flex: 1,
    marginVertical: 8,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptySetsText: {
    color: '#888',
    fontSize: 14,
  },
  addSetCardStandalone: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noteText: {
    fontSize: 15,
    color: '#666',
  },
  sectionBlock: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#E53935',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#222',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ActivityDetailsScreen;
