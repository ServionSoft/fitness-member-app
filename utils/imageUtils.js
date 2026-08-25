import React, { useMemo, useRef } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { API_BASE_URL } from '@env';

// Global cache to store source objects by URI to maintain stable references
const sourceCache = new Map();

/**
 * Utility function to get user's profile image with proper fallback handling
 * Uses a cache to maintain stable object references
 * @param {Object} userData - User data object containing profile_image and avatar
 * @param {string} apiBaseUrl - Base URL for the API (default: from .env file)
 * @returns {Object} Image source object for React Native Image component
 */
export const getProfileImageSource = (userData, apiBaseUrl = API_BASE_URL ? API_BASE_URL.replace('/api', '') : 'http://192.168.1.36:8000') => {
  let uri = null;
  let isLocalAsset = false;
  
  if (userData) {
    if (userData.profile_image) {
      // If profile_image is a full URL, use it directly
      if (userData.profile_image.startsWith('http')) {
        uri = userData.profile_image;
      } else {
        // If it's a relative path, check if it needs the images/avatar/ prefix
        let imagePath = userData.profile_image;
        // If the path doesn't start with 'images/', assume it's an old format and prepend 'images/avatar/'
        if (!imagePath.startsWith('images/')) {
          imagePath = `images/avatar/${imagePath}`;
        }
        // Construct the full URL
        uri = `${apiBaseUrl}/${imagePath}`;
      }
    } else if (userData.avatar) {
      // If avatar is a full URL, use it directly
      if (userData.avatar.startsWith('http')) {
        uri = userData.avatar;
      } else {
        // If it's a relative path, check if it needs the images/avatar/ prefix
        let imagePath = userData.avatar;
        // If the path doesn't start with 'images/', assume it's an old format and prepend 'images/avatar/'
        if (!imagePath.startsWith('images/')) {
          imagePath = `images/avatar/${imagePath}`;
        }
        // Construct the full URL
        uri = `${apiBaseUrl}/${imagePath}`;
      }
    }
  }
  
  // If we have a URI, use cached source object
  if (uri) {
    if (!sourceCache.has(uri)) {
      sourceCache.set(uri, { uri });
    }
    return sourceCache.get(uri);
  }
  
  // Return a default avatar image (local asset)
  const defaultAsset = require('../assets/images/fitness-model.png');
  const cacheKey = 'local-default-asset';
  if (!sourceCache.has(cacheKey)) {
    sourceCache.set(cacheKey, defaultAsset);
  }
  return sourceCache.get(cacheKey);
};

/**
 * Component that handles image loading with error fallback and caching
 * @param {Object} props - Component props
 * @param {Object} props.source - Image source
 * @param {Object} props.style - Image styles
 * @param {Function} props.onError - Error callback
 * @param {Object} props.fallbackSource - Fallback image source
 * @returns {JSX.Element} Image component with error handling
 */
const ProfileImageComponent = ({ 
  source, 
  style, 
  onError, 
  fallbackSource = require('../assets/images/fitness-model.png'),
  ...props 
}) => {
  const [imageError, setImageError] = React.useState(false);
  const lastSourceRef = useRef(null);
  const lastUriRef = useRef(null);
  
  // Extract URI from source
  const sourceUri = useMemo(() => {
    if (!source) return null;
    if (source.uri) return source.uri;
    if (typeof source === 'number') return 'local-asset';
    return null;
  }, [source]);

  // Check if source is a local asset (no loading needed)
  const isLocalAsset = useMemo(() => {
    return typeof source === 'number' || !source?.uri;
  }, [source]);

  // Initialize loaded state - local assets are immediately loaded
  const [imageLoaded, setImageLoaded] = React.useState(isLocalAsset);

  // Only update if source URI actually changed (not just object reference)
  const currentSource = useMemo(() => {
    // If URI hasn't changed, keep using the last source (prevents unnecessary updates)
    if (sourceUri === lastUriRef.current && lastSourceRef.current) {
      if (imageError) {
        return fallbackSource;
      }
      // Return the cached source object to maintain stability
      return lastSourceRef.current;
    }
    
    // URI changed, update refs
    lastSourceRef.current = source;
    lastUriRef.current = sourceUri;
    
    if (imageError) {
      return fallbackSource;
    }
    return source;
  }, [sourceUri, imageError, fallbackSource, source]);

  // Reset loaded state when source URI changes
  React.useEffect(() => {
    if (sourceUri !== lastUriRef.current) {
      // Update the ref
      lastUriRef.current = sourceUri;
      // Reset loaded state (local assets are immediately loaded)
      setImageLoaded(isLocalAsset);
      // Reset error state
      if (sourceUri) {
        setImageError(false);
      }
    }
  }, [sourceUri, isLocalAsset]);

  const handleError = React.useCallback(() => {
    if (!imageError) {
      setImageError(true);
      setImageLoaded(true); // Show fallback immediately
      if (onError) {
        onError();
      }
    }
  }, [imageError, onError]);

  const handleLoad = React.useCallback(() => {
    setImageLoaded(true);
  }, []);

  // Reset error state and loaded state when source URI changes
  React.useEffect(() => {
    if (sourceUri && sourceUri !== lastUriRef.current) {
      setImageError(false);
      setImageLoaded(isLocalAsset); // Local assets are immediately "loaded"
    }
  }, [sourceUri, isLocalAsset]);

  return (
    <View style={[{ position: 'relative' }, style]}>
      {/* Placeholder/fallback - always visible until image loads */}
      {(!imageLoaded || imageError) && (
        <Image
          source={fallbackSource}
          style={[StyleSheet.absoluteFillObject, style]}
          resizeMode="cover"
        />
      )}
      {/* Actual image - fades in when loaded */}
      {!imageError && (
        <Image
          source={currentSource}
          style={[
            StyleSheet.absoluteFillObject,
            style,
            { opacity: imageLoaded ? 1 : 0 }
          ]}
          onError={handleError}
          onLoad={handleLoad}
          {...props}
        />
      )}
    </View>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const ProfileImage = React.memo(ProfileImageComponent, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render), false if different (re-render)
  const prevUri = prevProps.source?.uri || (typeof prevProps.source === 'number' ? 'local' : null);
  const nextUri = nextProps.source?.uri || (typeof nextProps.source === 'number' ? 'local' : null);
  
  // Check if URI changed
  if (prevUri !== nextUri) return false;
  
  // Check if style changed (simple comparison)
  if (prevProps.style !== nextProps.style) {
    // Deep comparison for style objects
    try {
      if (JSON.stringify(prevProps.style) !== JSON.stringify(nextProps.style)) {
        return false;
      }
    } catch (e) {
      // If JSON.stringify fails, assume styles are different
      return false;
    }
  }
  
  // Check if onError callback changed
  if (prevProps.onError !== nextProps.onError) return false;
  
  // All props are equal, skip re-render
  return true;
});
