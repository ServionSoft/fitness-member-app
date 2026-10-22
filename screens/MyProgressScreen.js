import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { useAuth } from '../contexts/AuthContext';
import { getMemberId, getMemberIdOrFallback } from '../utils/memberId';

const API_BASE_URL = ENV_API_BASE_URL;
const MEDIA_BASE_URL = String(API_BASE_URL || '').replace(/\/api\/?$/, '');
const photoListStorageKey = (memberId) => `progressPhotos.list.${memberId}`;

async function getAuthHeader() {
  const userToken = await AsyncStorage.getItem('userToken');
  if (!userToken) return null;
  return userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return String(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Same envelope handling as ProgressPhotosScreen */
function extractPhotoList(result) {
  if (!result) return [];
  const candidates = [
    result.data,
    result.photos,
    result.items,
    result.results,
    result.data?.photos,
    result.data?.items,
    result.data?.results,
    result.data?.data,
    result.data?.comparison_photos,
    result.comparison_photos,
    result,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function resolvePhotoUri(photo) {
  if (!photo || typeof photo !== 'object') return null;
  // Already-normalized cache entries use `photo`
  if (typeof photo.photo === 'string' && photo.photo.trim()) {
    return photo.photo.trim();
  }
  const raw = [
    photo.image_url,
    photo.full_url,
    photo.original_url,
    photo.url,
    photo.photo_url,
    photo.image,
    photo.path,
    photo.image_path,
    photo.image_name,
  ].find((v) => typeof v === 'string' && v.trim());
  if (!raw) return null;
  const url = raw.trim().replace(/\\/g, '/');
  if (/^(https?:|file:|content:|data:)/i.test(url)) return url;
  if (url.startsWith('/')) return `${MEDIA_BASE_URL}${url}`;
  if (url.includes('/')) return `${MEDIA_BASE_URL}/${url.replace(/^\//, '')}`;
  return `${MEDIA_BASE_URL}/storage/${url}`;
}

async function loadCachedThumbs(userData) {
  const ids = new Set();
  const fromAuth = getMemberId(userData);
  const fallback = getMemberIdOrFallback(userData);
  if (fromAuth) ids.add(String(fromAuth));
  if (fallback) ids.add(String(fallback));
  try {
    const stored = await AsyncStorage.getItem('memberId');
    if (stored) ids.add(String(stored));
  } catch (_) {}

  const thumbs = [];
  const seen = new Set();
  for (const id of ids) {
    try {
      const raw = await AsyncStorage.getItem(photoListStorageKey(id));
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const p of parsed) {
        const uri = resolvePhotoUri(p);
        if (!uri || seen.has(String(p.id ?? uri))) continue;
        seen.add(String(p.id ?? uri));
        thumbs.push({
          id: p.id ?? uri,
          uri,
          date: p.date || p.photo_date || p.created_at,
        });
      }
    } catch (_) {}
  }
  return thumbs;
}

const MyProgressScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userData } = useAuth();
  const memberId = getMemberIdOrFallback(userData);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkIns, setCheckIns] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [mealPlan, setMealPlan] = useState(null);

  const loadProgress = useCallback(async () => {
    // Show device cache immediately (same source Progress Photos gallery uses)
    const cachedThumbs = await loadCachedThumbs(userData);
    if (cachedThumbs.length > 0) {
      setPhotos(cachedThumbs.slice(0, 8));
    }

    const authHeader = await getAuthHeader();
    if (!authHeader) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [progressRes, photosRes, currentRes, assignedRes] = await Promise.all([
        fetch(`${API_BASE_URL}/mobile/weekly-progress`, {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        }),
        fetch(`${API_BASE_URL}/mobile/comparison-photos/all`, {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        }),
        fetch(`${API_BASE_URL}/mobile/nutrition/current`, {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        }),
        fetch(`${API_BASE_URL}/mobile/nutrition/assigned-meals`, {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        }),
      ]);

      if (progressRes.ok) {
        const json = await progressRes.json();
        const list = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.data?.data)
            ? json.data.data
            : [];
        const sorted = [...list].sort((a, b) =>
          String(b.date || '').localeCompare(String(a.date || ''))
        );
        setCheckIns(sorted);
      }

      let serverThumbs = [];
      if (photosRes.ok) {
        const json = await photosRes.json();
        if (json?.success !== false) {
          const list = extractPhotoList(json);
          serverThumbs = list
            .map((p) => ({
              id: p.id,
              uri: resolvePhotoUri(p),
              date: p.photo_date || p.date || p.created_at,
            }))
            .filter((p) => p.uri);
        }
      }

      // Prefer server; keep cache if API empty (same behavior as ProgressPhotosScreen)
      const merged = serverThumbs.length > 0 ? serverThumbs : cachedThumbs;
      setPhotos(merged.slice(0, 8));

      let plan = null;
      if (currentRes.ok) {
        const json = await currentRes.json();
        if (json?.success !== false) {
          plan = json?.data || json;
        }
      }
      if (!plan && assignedRes.ok) {
        const json = await assignedRes.json();
        const list = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
            ? json
            : [];
        plan = list[0] || null;
      }
      setMealPlan(plan && typeof plan === 'object' ? plan : null);
    } catch (err) {
      console.error('MyProgress load failed:', err);
      if (cachedThumbs.length > 0) {
        setPhotos(cachedThumbs.slice(0, 8));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userData]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadProgress();
    }, [loadProgress])
  );

  const recentCheckIns = checkIns.slice(0, 5);
  const weightLogs = checkIns
    .filter((r) => r.weight != null && r.weight !== '')
    .slice(0, 8);
  const macroLogs = checkIns
    .filter(
      (r) =>
        r.calories != null ||
        r.protein != null ||
        r.carbs != null ||
        r.carb != null ||
        r.fat != null
    )
    .slice(0, 5);

  const planName =
    mealPlan?.name ||
    mealPlan?.plan_name ||
    mealPlan?.title ||
    mealPlan?.meal_plan_name ||
    null;
  const planDates =
    mealPlan?.start_date || mealPlan?.end_date
      ? `${formatDate(mealPlan.start_date)} – ${formatDate(mealPlan.end_date)}`
      : mealPlan?.date
        ? formatDate(mealPlan.date)
        : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Progress</Text>
          <Text style={styles.headerSubtitle}>Check-ins, photos & nutrition</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#222" />
          <Text style={styles.loadingText}>Loading progress…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadProgress();
              }}
              tintColor="#222"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Check-in */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Check-in / Self-assessment</Text>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => navigation.navigate('WeeklyProgress')}
              >
                <Text style={styles.ctaButtonText}>Log check-in</Text>
              </TouchableOpacity>
            </View>
            {recentCheckIns.length === 0 ? (
              <Text style={styles.emptyText}>
                No check-ins yet. Log weight, macros and how you feel.
              </Text>
            ) : (
              recentCheckIns.map((item) => (
                <View key={String(item.id || item.date)} style={styles.stackCard}>
                  <Text style={styles.rowTitle}>{formatDate(item.date)}</Text>
                  <Text style={styles.rowMeta}>
                    {[
                      item.weight != null ? `${item.weight} lbs` : null,
                      item.bodyFat != null ? `${item.bodyFat}% BF` : null,
                      item.waterIntake != null ? `${item.waterIntake} L` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Logged'}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Weight trend */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weight trend</Text>
            {weightLogs.length === 0 ? (
              <Text style={styles.emptyText}>No weight entries yet.</Text>
            ) : (
              weightLogs.map((item) => (
                <View key={`w-${item.id || item.date}`} style={styles.metricRow}>
                  <Text style={styles.metricDate}>{formatDate(item.date)}</Text>
                  <Text style={styles.metricValue}>{item.weight} lbs</Text>
                </View>
              ))
            )}
          </View>

          {/* Macros */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition / macros</Text>
            {macroLogs.length === 0 ? (
              <Text style={styles.emptyText}>No macro logs yet.</Text>
            ) : (
              macroLogs.map((item) => {
                const carbs = item.carbs ?? item.carb;
                return (
                  <View key={`m-${item.id || item.date}`} style={styles.stackCard}>
                    <Text style={styles.rowTitle}>{formatDate(item.date)}</Text>
                    <Text style={styles.rowMeta}>
                      {[
                        item.calories != null ? `${item.calories} kcal` : null,
                        item.protein != null ? `P ${item.protein}g` : null,
                        carbs != null ? `C ${carbs}g` : null,
                        item.fat != null ? `F ${item.fat}g` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Progress photos */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Progress photos</Text>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => navigation.navigate('ProgressPhotos')}
              >
                <Text style={styles.ctaButtonText}>Open gallery</Text>
              </TouchableOpacity>
            </View>
            {photos.length === 0 ? (
              <Text style={styles.emptyText}>No progress photos yet.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {photos.map((p) => (
                  <TouchableOpacity
                    key={String(p.id)}
                    onPress={() => navigation.navigate('ProgressPhotos')}
                    style={styles.thumbWrap}
                  >
                    <Image source={{ uri: p.uri }} style={styles.thumb} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Assigned meal plan */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Assigned meal plan</Text>
              <TouchableOpacity
                style={styles.ctaButtonSecondary}
                onPress={() => navigation.navigate('NutritionScreen')}
              >
                <Text style={styles.ctaButtonSecondaryText}>Nutrition</Text>
              </TouchableOpacity>
            </View>
            {!planName ? (
              <Text style={styles.emptyText}>No assigned meal plan found.</Text>
            ) : (
              <View style={styles.rowCard}>
                <MaterialCommunityIcons name="food-apple-outline" size={22} color="#222" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.rowTitle}>{planName}</Text>
                  {planDates ? (
                    <Text style={styles.rowMeta}>{planDates}</Text>
                  ) : null}
                  {memberId ? (
                    <Text style={styles.rowHint}>Member #{memberId}</Text>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fafaf8',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  headerSpacer: {
    width: 36,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  ctaButton: {
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  ctaButtonSecondary: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  ctaButtonSecondaryText: {
    color: '#222',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: '#999',
    fontSize: 13,
    lineHeight: 18,
  },
  stackCard: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  rowMeta: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  rowHint: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 2,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  metricDate: {
    fontSize: 13,
    color: '#666',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
  },
  thumbWrap: {
    marginRight: 10,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
});

export default MyProgressScreen;
