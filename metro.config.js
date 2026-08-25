const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    assetExts: [
      // Image formats
      'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico',
      // Audio formats
      'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma',
      // Video formats
      'mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v',
    ],
    blacklistRE: exclusionList([
      // Prevent Metro from watching deep CMake folders (VISION CAMERA FIX)
      /react-native-vision-camera\/android\/\.cxx\/.*/,
      // Exclude Android build directories that may not exist or are transient
      /react-native-vision-camera\/android\/build\/.*/,
      /react-native-gesture-handler\/android\/build\/.*/,
    ]),
  },
  watcher: {
    // Additional watcher configuration for Windows
    healthCheck: {
      enabled: true,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
