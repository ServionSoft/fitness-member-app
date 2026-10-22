import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import DatePicker from 'react-native-date-picker';
import { format } from 'date-fns';
import ModernAlert from '../components/ModernAlert';
import { getMemberId } from '../utils/memberId';

const { width: screenWidth } = Dimensions.get('window');

const API_BASE_URL = ENV_API_BASE_URL;
const MEDIA_BASE_URL = String(API_BASE_URL || '').replace(/\/api\/?$/, '');

const comparisonStorageKey = (memberId) => `progressPhotos.compare.${memberId}`;
const photoListStorageKey = (memberId) => `progressPhotos.list.${memberId}`;

/** Pull a photo array out of common API envelope shapes. */
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
  // Single photo object under data
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    if (result.data.id != null || result.data.image_url || result.data.image_name) {
      return [result.data];
    }
  }
  return [];
}

/** Resolve absolute image URI from varying API field names / relative paths. */
function resolvePhotoUrl(photo, localFallbackUri = null) {
  if (!photo || typeof photo !== 'object') {
    return typeof localFallbackUri === 'string' && localFallbackUri.trim()
      ? localFallbackUri.trim()
      : null;
  }
  const raw = [
    photo.image_url,
    photo.full_url,
    photo.original_url,
    photo.url,
    photo.photo_url,
    photo.photo,
    photo.image,
    photo.path,
    photo.image_path,
    photo.file_path,
    photo.storage_path,
    photo.image_name,
  ].find((v) => typeof v === 'string' && v.trim());

  if (!raw) {
    return typeof localFallbackUri === 'string' && localFallbackUri.trim()
      ? localFallbackUri.trim()
      : null;
  }
  const url = raw.trim().replace(/\\/g, '/');
  if (/^(https?:|file:|content:|data:)/i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${MEDIA_BASE_URL}${url}`;
  // Bare storage filename / relative path — try common public dirs
  if (url.includes('/')) return `${MEDIA_BASE_URL}/${url.replace(/^\//, '')}`;
  const bare = [
    `${MEDIA_BASE_URL}/storage/${url}`,
    `${MEDIA_BASE_URL}/storage/comparison_photos/${url}`,
    `${MEDIA_BASE_URL}/uploads/comparison_photos/${url}`,
  ];
  return bare[0];
}

function normalizePhoto(photo, localFallbackUri = null) {
  if (!photo || typeof photo !== 'object') return null;
  const created = photo.created_at || photo.createdAt || '';
  const dateFromCreated =
    typeof created === 'string' && created.includes(' ')
      ? created.split(' ')[0]
      : typeof created === 'string' && created.length >= 10
        ? created.slice(0, 10)
        : '';
  const date =
    photo.photo_date ||
    photo.photoDate ||
    photo.date ||
    dateFromCreated ||
    '';
  const uri = resolvePhotoUrl(photo, localFallbackUri);
  if (!uri && photo.id == null) return null;
  return {
    id: photo.id ?? `local-${Date.now()}`,
    date,
    photo: uri,
    notes: photo.notes || '',
    image_name: photo.image_name || photo.imageName || null,
    created_at: created || null,
    is_before: photo.is_before ?? photo.isBefore ?? false,
    is_after: photo.is_after ?? photo.isAfter ?? false,
  };
}

async function loadCachedPhotoList(memberId) {
  if (!memberId) return [];
  try {
    const raw = await AsyncStorage.getItem(photoListStorageKey(memberId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => normalizePhoto(p) || (p?.photo ? p : null))
      .filter((p) => p && p.photo);
  } catch (err) {
    console.warn('Failed to load cached progress photos', err);
    return [];
  }
}

async function saveCachedPhotoList(memberId, photos) {
  if (!memberId || !Array.isArray(photos)) return;
  try {
    const slim = photos
      .filter((p) => p && p.photo)
      .map((p) => ({
        id: p.id,
        date: p.date,
        photo: p.photo,
        notes: p.notes || '',
        image_name: p.image_name || null,
        created_at: p.created_at || null,
        is_before: !!p.is_before,
        is_after: !!p.is_after,
      }));
    await AsyncStorage.setItem(photoListStorageKey(memberId), JSON.stringify(slim));
  } catch (err) {
    console.warn('Failed to cache progress photos', err);
  }
}

function mergePhotoLists(primary, secondary) {
  const map = new Map();
  for (const p of [...(primary || []), ...(secondary || [])]) {
    if (!p?.photo) continue;
    const key = p.id != null ? `id:${p.id}` : `uri:${p.photo}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, p);
      continue;
    }
    const existingRemote = /^https?:/i.test(existing.photo);
    const nextRemote = /^https?:/i.test(p.photo);
    if (!existingRemote && nextRemote) map.set(key, p);
  }
  return Array.from(map.values()).sort((a, b) => {
    const da = String(a.date || a.created_at || '');
    const db = String(b.date || b.created_at || '');
    return db.localeCompare(da);
  });
}

const ProgressPhotosScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userData, refreshMemberDetails } = useAuth();
  // Prefer real members.id — never use GET /comparison-photos/{users.id} (unauthorized)
  const [memberId, setMemberId] = useState(() => getMemberId(userData));
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null); // 'before' or 'after'
  const [beforePhoto, setBeforePhoto] = useState(null);
  const [afterPhoto, setAfterPhoto] = useState(null);
  const [progressPhotos, setProgressPhotos] = useState([]);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pendingImageUri, setPendingImageUri] = useState(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });

  // Helper function to show modern alert
  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  const getAuthHeader = async () => {
    const userToken = await AsyncStorage.getItem('userToken');
    if (!userToken) return null;
    return userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
  };

  // Resolve members.id from auth / AsyncStorage / member details (not users.id)
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const fromAuth = getMemberId(userData);
      if (fromAuth) {
        if (!cancelled) setMemberId(fromAuth);
        return;
      }
      try {
        const stored = await AsyncStorage.getItem('memberId');
        if (stored && Number(stored) > 0) {
          if (!cancelled) setMemberId(Number(stored));
          return;
        }
      } catch (_) {}
      try {
        await refreshMemberDetails?.();
      } catch (_) {}
      // Prefer CRM members.id only — do not fall back to users.id for photo APIs
      const again = getMemberId(userData);
      if (!cancelled && again) setMemberId(again);
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [userData, refreshMemberDetails]);

  const selectImage = () => {
    // Directly open gallery
    openImageLibrary();
  };

  const persistComparisonSelection = useCallback(async (before, after) => {
    if (!memberId) return;
    try {
      await AsyncStorage.setItem(
        comparisonStorageKey(memberId),
        JSON.stringify({
          beforeId: before?.id ?? null,
          afterId: after?.id ?? null,
        })
      );
    } catch (err) {
      console.warn('Failed to persist comparison selection', err);
    }
  }, [memberId]);

  /** Persist before/after on server so CRM/Coach see the same flags */
  const setComparisonFlagOnServer = async (photoId, section) => {
    if (!photoId || !/^\d+$/.test(String(photoId))) return false;
    const authHeader = await getAuthHeader();
    if (!authHeader) return false;
    const path =
      section === 'before'
        ? `${API_BASE_URL}/mobile/comparison-photos/${photoId}/set-before`
        : `${API_BASE_URL}/mobile/comparison-photos/${photoId}/set-after`;
    const response = await fetch(path, {
      method: 'PUT',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const raw = await response.text();
    let result = null;
    try {
      result = raw ? JSON.parse(raw) : null;
    } catch (_) {
      result = null;
    }
    if (!response.ok || result?.success === false) {
      throw new Error(result?.message || `Failed to set ${section} photo`);
    }
    return true;
  };

  const loadServerComparison = useCallback(async (photosList) => {
    // Only call with confirmed members.id (from member_id field), not users.id fallback
    const crmMemberId = getMemberId(userData) || memberId;
    if (!crmMemberId) return;
    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) return;
      const response = await fetch(
        `${API_BASE_URL}/mobile/comparison-photos/${crmMemberId}/comparison`,
        {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
          },
        }
      );
      if (!response.ok) return;
      const result = await response.json();
      if (result?.success === false) return;

      const data = result?.data || result;
      const beforeRaw =
        data?.before || data?.before_photo || data?.beforePhoto || null;
      const afterRaw =
        data?.after || data?.after_photo || data?.afterPhoto || null;

      const beforeNorm = beforeRaw
        ? normalizePhoto(beforeRaw)
        : photosList?.find((p) => p.is_before) || null;
      const afterNorm = afterRaw
        ? normalizePhoto(afterRaw)
        : photosList?.find((p) => p.is_after) || null;

      if (beforeNorm?.photo) setBeforePhoto(beforeNorm);
      if (afterNorm?.photo) setAfterPhoto(afterNorm);
      if (beforeNorm || afterNorm) {
        await persistComparisonSelection(beforeNorm, afterNorm);
      }
    } catch (err) {
      console.warn('Failed to load server comparison', err);
    }
  }, [memberId, userData, persistComparisonSelection]);

  const selectPhotoFromModal = async (photo) => {
    const section = selectedSection;
    let nextBefore = beforePhoto;
    let nextAfter = afterPhoto;
    if (section === 'before') {
      nextBefore = photo;
      setBeforePhoto(photo);
    } else if (section === 'after') {
      nextAfter = photo;
      setAfterPhoto(photo);
    }

    setModalVisible(false);
    setSelectedSection(null);
    await persistComparisonSelection(nextBefore, nextAfter);

    // Sync to CRM when photo exists on server for this member.
    // Cache-only / wrong-member uploads return "Photo not found" — keep local selection, no alert spam.
    try {
      if (
        (section === 'before' || section === 'after') &&
        /^\d+$/.test(String(photo.id))
      ) {
        await setComparisonFlagOnServer(photo.id, section);
      }
    } catch (err) {
      console.warn('set-before/after skipped (local selection kept):', err?.message || err);
    }
  };

  const removePhotoLocally = async (photoId) => {
    const next = progressPhotos.filter((p) => String(p.id) !== String(photoId));
    setProgressPhotos(next);
    await saveCachedPhotoList(memberId, next);

    let nextBefore = beforePhoto;
    let nextAfter = afterPhoto;
    if (beforePhoto && String(beforePhoto.id) === String(photoId)) {
      nextBefore = null;
      setBeforePhoto(null);
    }
    if (afterPhoto && String(afterPhoto.id) === String(photoId)) {
      nextAfter = null;
      setAfterPhoto(null);
    }
    await persistComparisonSelection(nextBefore, nextAfter);
  };

  const deleteProgressPhoto = async (photo) => {
    if (!photo?.id || !memberId) {
      showAlert('Error', 'Unable to delete this photo', 'error');
      return;
    }

    const hasServerId = /^\d+$/.test(String(photo.id));

    setDeletingId(photo.id);
    try {
      if (hasServerId) {
        const userToken = await AsyncStorage.getItem('userToken');
        if (!userToken) {
          showAlert('Error', 'Authentication token not found', 'error');
          return;
        }
        let authHeader = userToken;
        if (!userToken.startsWith('Bearer ')) {
          authHeader = `Bearer ${userToken}`;
        }

        const response = await fetch(
          `${API_BASE_URL}/mobile/comparison-photos/${photo.id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: authHeader,
              Accept: 'application/json',
            },
          }
        );

        const rawText = await response.text();
        let result = null;
        try {
          result = rawText ? JSON.parse(rawText) : null;
        } catch (_) {
          result = null;
        }

        if (!response.ok || result?.success === false) {
          // Already gone on server — still clear local cache
          if (response.status !== 404) {
            throw new Error(result?.message || `Delete failed (${response.status})`);
          }
        }
      }

      await removePhotoLocally(photo.id);
      showAlert('Deleted', 'Progress photo removed', 'success');
    } catch (error) {
      console.error('Error deleting photo:', error);
      showAlert('Error', error.message || 'Failed to delete photo', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDeletePhoto = (photo) => {
    showAlert(
      'Delete photo',
      'Are you sure you want to delete this progress photo? This cannot be undone.',
      'warning',
      [
        { text: 'Cancel', onPress: () => {}, style: 'secondary' },
        {
          text: 'Delete',
          style: 'danger',
          onPress: () => deleteProgressPhoto(photo),
        },
      ]
    );
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedSection(null);
  };

  const openCamera = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      includeBase64: false,
      saveToPhotos: false,
    };

    launchCamera(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled camera');
      } else if (response.error) {
        console.error('Camera error:', response.error);
        showAlert('Error', 'Camera error: ' + response.error, 'error');
      } else if (response.assets && response.assets[0]) {
        // Store image URI and show date picker
        setPendingImageUri(response.assets[0].uri);
        setSelectedDate(new Date());
        setDatePickerVisible(true);
      }
    });
  };

  const openImageLibrary = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      includeBase64: false,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled photo library');
      } else if (response.error) {
        console.error('Photo library error:', response.error);
        showAlert('Error', 'Photo library error: ' + response.error, 'error');
      } else if (response.assets && response.assets[0]) {
        // Store image URI and show date picker
        setPendingImageUri(response.assets[0].uri);
        setSelectedDate(new Date());
        setDatePickerVisible(true);
      }
    });
  };

  const handleDateCancel = () => {
    setDatePickerVisible(false);
    setPendingImageUri(null);
  };

  const restoreComparisonSelection = useCallback(async (photos) => {
    if (!memberId || !Array.isArray(photos) || photos.length === 0) return;
    try {
      const raw = await AsyncStorage.getItem(comparisonStorageKey(memberId));
      if (!raw) return;
      const { beforeId, afterId } = JSON.parse(raw) || {};
      if (beforeId != null) {
        const match = photos.find((p) => String(p.id) === String(beforeId));
        if (match) setBeforePhoto(match);
      }
      if (afterId != null) {
        const match = photos.find((p) => String(p.id) === String(afterId));
        if (match) setAfterPhoto(match);
      }
    } catch (err) {
      console.warn('Failed to restore comparison selection', err);
    }
  }, [memberId]);

  const fetchPhotos = useCallback(async ({ silent = false } = {}) => {
    if (!memberId) {
      console.log('No member ID available for progress photos');
      return;
    }

    if (!silent) setFetching(true);

    // Always hydrate from device cache first so reopen shows prior uploads
    const cached = await loadCachedPhotoList(memberId);
    if (cached.length > 0) {
      setProgressPhotos((prev) => mergePhotoLists(cached, prev));
      await restoreComparisonSelection(cached);
    }

    try {
      const authHeader = await getAuthHeader();

      if (!authHeader) {
        console.error('No token found');
        return;
      }

      // ONLY /all — GET /comparison-photos/{id} is single-photo and returns
      // "Unauthorized access to photos" when called with users.id / wrong id.
      const url = `${API_BASE_URL}/mobile/comparison-photos/all`;
      let photos = [];

      console.log('Fetching photos:', url, 'memberId=', memberId);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const rawText = await response.text();
      let result = null;
      try {
        result = rawText ? JSON.parse(rawText) : null;
      } catch (parseErr) {
        console.warn('Non-JSON photos response:', rawText?.slice?.(0, 200));
        result = null;
      }

      console.log('Photos response status/url:', response.status, url, result);

      if (response.ok && result && result.success !== false) {
        const list = extractPhotoList(result);
        photos = list.map((p) => normalizePhoto(p)).filter((p) => p && p.photo);
        console.log('Normalized photos:', photos.length, photos[0]);
      } else {
        console.warn(
          'Photos /all sync skipped:',
          result?.message || `status ${response.status}`
        );
      }

      const merged = mergePhotoLists(photos, cached);
      setProgressPhotos((prev) => {
        const next = mergePhotoLists(merged, prev);
        saveCachedPhotoList(memberId, next);
        return next;
      });

      if (merged.length > 0) {
        await restoreComparisonSelection(merged);
      }
      // Server before/after flags (CRM source of truth)
      await loadServerComparison(merged);

      console.log('Photos ready:', merged.length, '(server:', photos.length, 'cached:', cached.length, ')');
    } catch (error) {
      // Keep cache; never block screen open with a fetch error popup
      console.error('Error fetching photos:', error);
    } finally {
      if (!silent) setFetching(false);
    }
  }, [memberId, restoreComparisonSelection, loadServerComparison]);

  const addProgressPhoto = async (imageUri, photoDate = new Date()) => {
    if (!memberId) {
      showAlert(
        'Error',
        'Member profile not loaded yet. Please reopen the app and try again.',
        'error'
      );
      return;
    }

    setLoading(true);
    
    try {
      // Get the stored token with the correct key (userToken, not token)
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        console.error('No token found');
        showAlert('Error', 'Authentication token not found', 'error');
        return;
      }

      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Create FormData for multipart/form-data
      const formData = new FormData();
      
      // Add the image file
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `progress_photo_${Date.now()}.jpg`,
      });

      // CRM members.id (not users.id)
      formData.append('member_id', String(memberId));

      // Add photo date (format: YYYY-MM-DD)
      const dateString = format(photoDate, 'yyyy-MM-dd');
      formData.append('photo_date', dateString);

      console.log('Uploading photo to:', `${API_BASE_URL}/mobile/comparison-photos/upload`);
      console.log('Photo date:', dateString);
      console.log('FormData:', formData);
      console.log('Auth header:', authHeader);

      const response = await fetch(`${API_BASE_URL}/mobile/comparison-photos/upload`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
        },
        body: formData,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Upload response:', result);

      if (result.success === false) {
        throw new Error(result.message || 'Upload failed');
      }

      // Prefer server URL; local URI is only a temporary preview fallback
      const payload =
        result.data?.comparison_photo ||
        result.data?.photo ||
        result.data ||
        result.photo ||
        result;

      let uploaded = normalizePhoto(payload, null);
      const serverUri = uploaded?.photo;
      const isDurable =
        typeof serverUri === 'string' && /^https?:\/\//i.test(serverUri.trim());

      if (!isDurable) {
        // Preview with local URI for this session only — do not treat as durable cache
        uploaded = normalizePhoto(payload, imageUri);
        console.warn('Upload succeeded but no durable server URL; local preview only', result);
      }

      if (uploaded?.photo) {
        const cached = await loadCachedPhotoList(memberId);
        let next = mergePhotoLists([uploaded], cached);
        // Prefer durable HTTP URLs in cache; drop ephemeral file/content URIs when we have better
        if (isDurable) {
          next = next.map((p) =>
            String(p.id) === String(uploaded.id) ? uploaded : p
          );
          await saveCachedPhotoList(memberId, next);
        }
        setProgressPhotos(next);
        console.log('Cached upload for reopen:', uploaded.id, uploaded.photo, 'memberId=', memberId);
      } else {
        console.warn('Upload succeeded but photo URI could not be resolved', result);
      }

      // Best-effort sync with server so reopen uses durable URLs
      await fetchPhotos({ silent: true });

      const durabilityNote = isDurable
        ? 'Progress photo uploaded successfully!'
        : 'Photo uploaded, but the server did not return a lasting URL. It may not reopen after you leave this screen.';

      showAlert('Success', durabilityNote, isDurable ? 'success' : 'warning', [
        {
          text: 'Log weight',
          style: 'primary',
          onPress: () => navigation.navigate('WeeklyProgress', { openForm: true }),
        },
        { text: 'Done', style: 'secondary', onPress: () => {} },
      ]);
    } catch (error) {
      console.error('Error uploading photo:', error);
      showAlert('Error', `Failed to upload photo: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDateConfirm = () => {
    setDatePickerVisible(false);
    if (pendingImageUri) {
      addProgressPhoto(pendingImageUri, selectedDate);
      setPendingImageUri(null);
    }
  };

  const openPhotoSelectionModal = (section) => {
    setSelectedSection(section);
    setModalVisible(true);
    // Refresh list when opening Before/After picker (won't wipe local uploads if GET is empty)
    if (memberId) {
      fetchPhotos({ silent: true });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Reload whenever the screen is focused so uploads persist across reopen
  useFocusEffect(
    useCallback(() => {
      fetchPhotos();
    }, [fetchPhotos])
  );

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text 
            style={styles.headerTitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Progress Photos
          </Text>
          <Text 
            style={styles.headerSubtitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Track your transformation
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.headerAddButton}
          onPress={selectImage}
          disabled={loading || fetching}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {loading || fetching ? (
            <ActivityIndicator size="small" color="#222" />
          ) : (
            <Ionicons name="add" size={20} color="#222" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 140, paddingTop: 10 }} showsVerticalScrollIndicator={false}>
        
        {/* Before Photos Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="camera-outline" size={18} color="#222" />
            <Text style={styles.sectionTitle}>Before Photos</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.selectPhotoButton}
            onPress={() => openPhotoSelectionModal('before')}
          >
            <View style={styles.selectPhotoContent}>
              {beforePhoto ? (
                <View style={styles.selectedPhotoContainer}>
                  <Image source={{ uri: beforePhoto.photo }} style={styles.selectedPhoto} />
                  <View style={styles.selectedPhotoOverlay}>
                    <Text style={styles.selectedPhotoDate}>{formatDate(beforePhoto.date)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.selectPhotoPlaceholder}>
                  <MaterialCommunityIcons name="camera-plus" size={28} color="#666" />
                  <Text style={styles.selectPhotoText}>Select Before Photo</Text>
                  <Text style={styles.selectPhotoSubtext}>Choose from your uploaded photos</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* After Photos Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="camera-outline" size={18} color="#222" />
            <Text style={styles.sectionTitle}>After Photos</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.selectPhotoButton}
            onPress={() => openPhotoSelectionModal('after')}
          >
            <View style={styles.selectPhotoContent}>
              {afterPhoto ? (
                <View style={styles.selectedPhotoContainer}>
                  <Image source={{ uri: afterPhoto.photo }} style={styles.selectedPhoto} />
                  <View style={styles.selectedPhotoOverlay}>
                    <Text style={styles.selectedPhotoDate}>{formatDate(afterPhoto.date)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.selectPhotoPlaceholder}>
                  <MaterialCommunityIcons name="camera-plus" size={28} color="#666" />
                  <Text style={styles.selectPhotoText}>Select After Photo</Text>
                  <Text style={styles.selectPhotoSubtext}>Choose from your uploaded photos</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Uploaded gallery — always visible so photos remain findable after upload */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="image-multiple-outline" size={18} color="#222" />
            <Text style={styles.sectionTitle}>
              Your photos ({progressPhotos.filter((p) => p.photo).length})
            </Text>
          </View>
          {progressPhotos.filter((photo) => photo.photo).length === 0 ? (
            <View style={styles.galleryEmpty}>
              <Text style={styles.galleryEmptyText}>
                No photos yet. Tap + to upload, then pick Before / After above.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryList}
            >
              {progressPhotos
                .filter((photo) => photo.photo)
                .map((item, index) => (
                  <TouchableOpacity
                    key={String(item.id ?? index)}
                    style={styles.galleryItem}
                    activeOpacity={0.85}
                    onPress={() => openPhotoSelectionModal('before')}
                    onLongPress={() => confirmDeletePhoto(item)}
                  >
                    <Image source={{ uri: item.photo }} style={styles.galleryThumb} />
                    <Text style={styles.galleryDate} numberOfLines={1}>
                      {formatDate(item.date)}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )}
          <TouchableOpacity
            style={styles.weightCta}
            onPress={() => navigation.navigate('WeeklyProgress', { openForm: true })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="scale-bathroom" size={18} color="#fff" />
            <Text style={styles.weightCtaText}>Log weight / check-in</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Photo Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeModal} />
          <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {selectedSection === 'before' ? 'Before' : 'After'} Photo
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {progressPhotos.filter(photo => photo.photo).length === 0 ? (
              <View style={styles.modalEmptyState}>
                <MaterialCommunityIcons name="image-off-outline" size={48} color="#999" />
                <Text style={styles.modalEmptyTitle}>No images yet</Text>
                <Text style={styles.modalEmptyText}>
                  Upload images first using the + button, then select them here for Before / After comparison.
                </Text>
                <TouchableOpacity
                  style={styles.modalUploadButton}
                  onPress={() => {
                    closeModal();
                    selectImage();
                  }}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.modalUploadButtonText}>Upload Images First</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={progressPhotos.filter(photo => photo.photo)}
                renderItem={({ item }) => (
                  <View style={styles.modalPhotoItem}>
                    <TouchableOpacity
                      style={styles.modalPhotoSelect}
                      onPress={() => selectPhotoFromModal(item)}
                      disabled={deletingId != null}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: item.photo }} style={styles.modalPhoto} />
                      <View style={styles.modalPhotoInfo}>
                        <Text style={styles.modalPhotoDate}>{formatDate(item.date)}</Text>
                        {item.notes ? (
                          <Text style={styles.modalPhotoNotes} numberOfLines={2}>{item.notes}</Text>
                        ) : (
                          <Text style={styles.modalPhotoNotes}>Tap to select</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalDeleteButton}
                      onPress={() => confirmDeletePhoto(item)}
                      disabled={deletingId != null}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {deletingId != null && String(deletingId) === String(item.id) ? (
                        <ActivityIndicator size="small" color="#FF3B30" />
                      ) : (
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={datePickerVisible}
        onRequestClose={handleDateCancel}
      >
        <View style={styles.datePickerOverlay}>
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Select Photo Date</Text>
              <TouchableOpacity onPress={handleDateCancel} style={styles.datePickerCloseButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.datePickerWrapper}>
              <DatePicker
                date={selectedDate}
                onDateChange={setSelectedDate}
                mode="date"
                maximumDate={new Date()}
                style={styles.datePicker}
                theme={Platform.OS === 'ios' ? 'light' : 'light'}
                textColor="#222"
                fadeToColor="none"
              />
            </View>
            
            <View style={styles.datePickerButtons}>
              <TouchableOpacity 
                style={styles.datePickerCancelButton}
                onPress={handleDateCancel}
              >
                <Text style={styles.datePickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.datePickerConfirmButton}
                onPress={handleDateConfirm}
              >
                <Text style={styles.datePickerConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#f7f8f2',
    minHeight: 56,
  },
  backButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
    minWidth: 0, // Important for text truncation in flexbox
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    letterSpacing: 0.3,
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    flexShrink: 0, // Prevent from shrinking
  },
  headerAddButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#e7ead7',
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginLeft: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#eceee7',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  selectPhotoButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eceee7',
    overflow: 'hidden',
  },
  selectPhotoContent: {
    minHeight: 120,
  },
  selectedPhotoContainer: {
    position: 'relative',
  },
  selectedPhoto: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  selectedPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  selectedPhotoDate: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  selectPhotoPlaceholder: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectPhotoText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
    color: '#1a1a1a',
    letterSpacing: 0.3,
  },
  selectPhotoSubtext: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
  galleryEmpty: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eceee7',
  },
  galleryEmptyText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  galleryList: {
    paddingVertical: 4,
  },
  galleryItem: {
    width: 96,
    marginRight: 10,
  },
  galleryThumb: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#ddd',
  },
  galleryDate: {
    marginTop: 6,
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  weightCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 8,
  },
  weightCtaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '55%',
    maxHeight: '80%',
    paddingTop: 8,
    marginBottom: 0,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eceee7',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  modalEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  modalUploadButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalPhotoItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalPhotoSelect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalPhoto: {
    width: 50,
    height: 50,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  modalPhotoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  modalDeleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  modalPhotoDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  modalPhotoNotes: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    lineHeight: 18,
  },
  // Date Picker Styles
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    width: '100%',
    alignItems: 'center',
    minHeight: Platform.OS === 'ios' ? 320 : 280,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eceee7',
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  datePickerCloseButton: {
    padding: 4,
  },
  datePickerWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: Platform.OS === 'ios' ? 200 : 180,
  },
  datePicker: {
    width: screenWidth,
    height: Platform.OS === 'ios' ? 200 : 180,
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 12,
  },
  datePickerCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  datePickerCancelText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  datePickerConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
  },
  datePickerConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ProgressPhotosScreen;