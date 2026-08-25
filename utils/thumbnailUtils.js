import { API_BASE_URL } from './apiConfig';

// Same host resolution used by WorkoutDetails / Discover / AllActivities
const BASE_URL = String(API_BASE_URL || '').replace('/api', '');

function pickThumbnailField(item) {
  if (!item || typeof item !== 'object') return null;

  const candidates = [
    item.thumbnail_url,
    item.thumbnail,
    item.image_url,
    item.image,
    item.photo,
    item.cover_image,
    item.exercise?.thumbnail_url,
    item.exercise?.thumbnail,
    item.exercise_details?.thumbnail_url,
    item.exercise_details?.thumbnail,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
    if (typeof candidate === 'object') {
      const nested =
        candidate.url ||
        candidate.uri ||
        candidate.path ||
        candidate.src ||
        candidate.thumbnail_url ||
        candidate.thumbnail;
      if (typeof nested === 'string' && nested.trim()) {
        return nested.trim();
      }
    }
  }

  return null;
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodeThumbnailFilename(filename) {
  const clean = String(filename || '')
    .split('?')[0]
    .split('#')[0]
    .trim();
  if (!clean) return '';
  const decoded = decodeURIComponentSafe(clean);
  // Avoid double-encoding already-escaped names
  if (/%[0-9A-Fa-f]{2}/.test(clean) && !clean.includes(' ')) {
    return clean.replace(/ /g, '%20');
  }
  return encodeURIComponent(decoded);
}

function encodePath(path) {
  return String(path || '')
    .replace(/^\//, '')
    .split('/')
    .map((segment) => encodeThumbnailFilename(segment) || segment)
    .filter(Boolean)
    .join('/');
}

/**
 * Build media thumbnail URI for activities / workouts.
 * Always rebuilds /thumbnails/... and broken localhost APP_URL values.
 */
export function getActivityThumbnailUrl(item) {
  const thumbnailField = pickThumbnailField(item);
  if (!thumbnailField) return null;

  const isMalformedLocal =
    thumbnailField.includes('localhost/APP_URL') ||
    thumbnailField.includes('APP_URL=') ||
    /https?:\/\/localhost\b/i.test(thumbnailField);

  const thumbnailsMatch = thumbnailField.match(/thumbnails\/(.+)$/i);
  if (thumbnailsMatch) {
    const filename = encodeThumbnailFilename(thumbnailsMatch[1]);
    if (!filename) return null;
    return `${BASE_URL}/thumbnails/${filename}`;
  }

  const imagesMatch = thumbnailField.match(/images\/(.+)$/i);
  if (imagesMatch && (isMalformedLocal || !/^https?:\/\//i.test(thumbnailField))) {
    const filename = encodeThumbnailFilename(imagesMatch[1]);
    if (!filename) return null;
    return `${BASE_URL}/images/${filename}`;
  }

  if (/^https?:\/\//i.test(thumbnailField) && !isMalformedLocal) {
    try {
      return encodeURI(thumbnailField);
    } catch {
      return thumbnailField;
    }
  }

  // Bare filename
  if (!thumbnailField.includes('/') && !thumbnailField.includes('\\')) {
    const filename = encodeThumbnailFilename(thumbnailField);
    if (!filename) return null;
    return `${BASE_URL}/thumbnails/${filename}`;
  }

  // Absolute or relative site path
  if (thumbnailField.startsWith('/')) {
    return `${BASE_URL}/${encodePath(thumbnailField)}`;
  }

  return `${BASE_URL}/${encodePath(thumbnailField)}`;
}

/** Same resolver for workout cards (My / Assigned / All). */
export function getWorkoutThumbnailUrl(workout) {
  return getActivityThumbnailUrl(workout);
}
