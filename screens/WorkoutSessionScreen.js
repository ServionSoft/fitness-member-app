import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image, ActivityIndicator, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import Video from 'react-native-video';
import Sound from 'react-native-sound';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useAuth } from '../contexts/AuthContext';
import ModernAlert from '../components/ModernAlert';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const WorkoutSessionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { workout, activities, selectedDay, workoutId, dayActivityPlanId, isDayActivity } = route.params || {};
  const { logout } = useAuth();
  
  // Menu state
  const [menuVisible, setMenuVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  
  // Session state
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [currentRep, setCurrentRep] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [repTimer, setRepTimer] = useState(0);
  const [completedActivities, setCompletedActivities] = useState([]);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  
  // Timer states
  const [countdownTimer, setCountdownTimer] = useState(0);
  const [setTimer, setSetTimer] = useState(0);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [isSetTimerActive, setIsSetTimerActive] = useState(false);
  const [workoutPhase, setWorkoutPhase] = useState('ready'); // 'ready', 'work', 'completed'
  // Pre-countdown (3,2,1, GO) before actual set timer
  const [isPreCountdownActive, setIsPreCountdownActive] = useState(false);
  const [preCountdownIndex, setPreCountdownIndex] = useState(0); // 0..3 => ['3','2','1','GO']
  // Rest period between sets
  const [restTimer, setRestTimer] = useState(0);
  const [isRestPeriod, setIsRestPeriod] = useState(false);
  const SET_DURATION_SECONDS = 30;
  const REST_DURATION_SECONDS = 10;
  
  // Refs for timers
  const sessionIntervalRef = useRef(null);
  const repIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const setTimerIntervalRef = useRef(null);
  const preCountdownIntervalRef = useRef(null);
  const restTimerIntervalRef = useRef(null);
  const workoutStartAttemptedRef = useRef(false);
  const bufferingTimeoutRef = useRef({});
  const countdownSoundRef = useRef(null);
  const tenSecondsLeftSoundRef = useRef(null);
  const threeSecondsLeftSoundRef = useRef(null);
  const tenSecondsPlayedRef = useRef(false); // Track if 10 seconds audio already played for current set
  const threeSecondsPlayedRef = useRef(false); // Track if 3 seconds audio already played for current set
  
  const API_BASE_URL = ENV_API_BASE_URL;
  const PRODUCTION_VIDEO_BASE = 'https://phpstack-1542257-6177868.cloudwaysapps.com';
  
  // Initialize countdown audio
  useEffect(() => {
    let sound = null;
    
    try {
      // Enable playback in silence mode (iOS)
      Sound.setCategory('Playback', true); // true = mixWithOthers
      
      // Platform-specific audio loading
      if (Platform.OS === 'android') {
        // Android: Use filename string from res/raw folder
        // File should be in android/app/src/main/res/raw/countdown_321go.mp3
        // Note: Resource names must start with a letter
        console.log('Loading audio for Android from res/raw...');
        sound = new Sound('countdown_321go.mp3', Sound.MAIN_BUNDLE, (error) => {
          if (error) {
            console.log('Failed to load countdown audio on Android:', error);
            countdownSoundRef.current = null;
            return;
          }
          console.log('Countdown audio loaded successfully on Android');
          console.log('Sound duration:', sound.getDuration());
          countdownSoundRef.current = sound;
        });
      } else {
        // iOS: Use require() which returns a number
        try {
          const audioAsset = require('../assets/audio/321Go.mp3');
          console.log('Loading audio for iOS, asset type:', typeof audioAsset);
          
          sound = new Sound(audioAsset, Sound.MAIN_BUNDLE, (error) => {
            if (error) {
              console.log('Failed to load countdown audio on iOS:', error);
              countdownSoundRef.current = null;
              return;
            }
            console.log('Countdown audio loaded successfully on iOS');
            console.log('Sound duration:', sound.getDuration());
            countdownSoundRef.current = sound;
          });
        } catch (requireError) {
          console.log('Failed to require audio file on iOS:', requireError);
          countdownSoundRef.current = null;
        }
      }
      
    } catch (error) {
      console.log('Error initializing countdown audio:', error);
      console.log('Error stack:', error.stack);
      countdownSoundRef.current = null;
    }

    // Cleanup on unmount
    return () => {
      if (sound && countdownSoundRef.current) {
        try {
          sound.stop(() => {
            sound.release();
          });
        } catch (error) {
          console.log('Error releasing audio:', error);
        }
      }
    };
  }, []);

  // Initialize 10 seconds left audio
  useEffect(() => {
    let sound = null;
    
    try {
      // Platform-specific audio loading
      if (Platform.OS === 'android') {
        // Android: Use filename string from res/raw folder
        console.log('Loading 10 seconds left audio for Android from res/raw...');
        sound = new Sound('countdown_10secondsleft.mp3', Sound.MAIN_BUNDLE, (error) => {
          if (error) {
            console.log('Failed to load 10 seconds left audio on Android:', error);
            tenSecondsLeftSoundRef.current = null;
            return;
          }
          console.log('10 seconds left audio loaded successfully on Android');
          tenSecondsLeftSoundRef.current = sound;
        });
      } else {
        // iOS: Use require() which returns a number
        try {
          const audioAsset = require('../assets/audio/10secondsleft.mp3');
          console.log('Loading 10 seconds left audio for iOS, asset type:', typeof audioAsset);
          
          sound = new Sound(audioAsset, Sound.MAIN_BUNDLE, (error) => {
            if (error) {
              console.log('Failed to load 10 seconds left audio on iOS:', error);
              tenSecondsLeftSoundRef.current = null;
              return;
            }
            console.log('10 seconds left audio loaded successfully on iOS');
            tenSecondsLeftSoundRef.current = sound;
          });
        } catch (requireError) {
          console.log('Failed to require 10 seconds left audio file on iOS:', requireError);
          tenSecondsLeftSoundRef.current = null;
        }
      }
      
    } catch (error) {
      console.log('Error initializing 10 seconds left audio:', error);
      tenSecondsLeftSoundRef.current = null;
    }

    // Cleanup on unmount
    return () => {
      if (sound && tenSecondsLeftSoundRef.current) {
        try {
          sound.stop(() => {
            sound.release();
          });
        } catch (error) {
          console.log('Error releasing 10 seconds left audio:', error);
        }
      }
    };
  }, []);

  // Initialize 3 seconds left audio
  useEffect(() => {
    let sound = null;
    
    try {
      // Platform-specific audio loading
      if (Platform.OS === 'android') {
        // Android: Use filename string from res/raw folder
        console.log('Loading 3 seconds left audio for Android from res/raw...');
        sound = new Sound('countdown_321.mp3', Sound.MAIN_BUNDLE, (error) => {
          if (error) {
            console.log('Failed to load 3 seconds left audio on Android:', error);
            threeSecondsLeftSoundRef.current = null;
            return;
          }
          console.log('3 seconds left audio loaded successfully on Android');
          threeSecondsLeftSoundRef.current = sound;
        });
      } else {
        // iOS: Use require() which returns a number
        try {
          const audioAsset = require('../assets/audio/321.mp3');
          console.log('Loading 3 seconds left audio for iOS, asset type:', typeof audioAsset);
          
          sound = new Sound(audioAsset, Sound.MAIN_BUNDLE, (error) => {
            if (error) {
              console.log('Failed to load 3 seconds left audio on iOS:', error);
              threeSecondsLeftSoundRef.current = null;
              return;
            }
            console.log('3 seconds left audio loaded successfully on iOS');
            threeSecondsLeftSoundRef.current = sound;
          });
        } catch (requireError) {
          console.log('Failed to require 3 seconds left audio file on iOS:', requireError);
          threeSecondsLeftSoundRef.current = null;
        }
      }
      
    } catch (error) {
      console.log('Error initializing 3 seconds left audio:', error);
      threeSecondsLeftSoundRef.current = null;
    }

    // Cleanup on unmount
    return () => {
      if (sound && threeSecondsLeftSoundRef.current) {
        try {
          sound.stop(() => {
            sound.release();
          });
        } catch (error) {
          console.log('Error releasing 3 seconds left audio:', error);
        }
      }
    };
  }, []);

  // Video states - per activity
  const [videoStates, setVideoStates] = useState({}); // { activityIndex: { loading, ready, error, buffering, url } }
  const videoRefs = useRef({}); // Store video refs for each activity
  const [enrichedActivities, setEnrichedActivities] = useState(activities || []); // Store activities with full details
  
  const currentActivity = enrichedActivities?.[currentActivityIndex];
  const totalActivities = enrichedActivities?.length || 0;
  const totalSets = currentActivity ? (currentActivity.sets || 1) : 0;
  const repsPerSet = currentActivity ? (currentActivity.reps || 10) : 0;
  const progress = totalActivities > 0 ? ((currentActivityIndex + ((currentSet - 1 + (currentRep / repsPerSet)) / totalSets)) / totalActivities) * 100 : 0;

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

  // Get video URL from activity
  const getVideoUrl = (activity) => {
    if (!activity) return null;
    
    // Check multiple video field variations
    if (activity.video_link) {
      return normalizeVideoUrl(activity.video_link);
    }
    
    if (activity.video_url) {
      return normalizeVideoUrl(activity.video_url);
    }
    
    if (activity.exercise?.video_link) {
      return normalizeVideoUrl(activity.exercise.video_link);
    }
    
    if (activity.exercise?.video_url) {
      return normalizeVideoUrl(activity.exercise.video_url);
    }
    
    if (activity.exercise_details?.video_link) {
      return normalizeVideoUrl(activity.exercise_details.video_link);
    }
    
    if (activity.video_relative_path) {
      const normalizedPath = activity.video_relative_path.replace(/\\/g, '/');
      const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
      return `${PRODUCTION_VIDEO_BASE}/videos/${encodedPath}`;
    }
    
    if (activity.exercise?.video_relative_path) {
      const normalizedPath = activity.exercise.video_relative_path.replace(/\\/g, '/');
      const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
      return `${PRODUCTION_VIDEO_BASE}/videos/${encodedPath}`;
    }
    
    return null;
  };

  // Fetch full activity details for day activities
  const fetchActivityDetails = async (exerciseId) => {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        console.log('No user token for fetching activity details');
        return null;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      console.log('Fetching activity details for exercise_id:', exerciseId);
      const response = await fetch(`${API_BASE_URL}/mobile/workout-activities?exercise_id=${exerciseId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Activity details response:', JSON.stringify(result, null, 2));
        
        // Handle different response structures
        let activityData = null;
        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          activityData = result.data[0]; // Get first activity from array
        } else if (result.data && !Array.isArray(result.data)) {
          activityData = result.data;
        } else if (result.activity) {
          activityData = result.activity;
        } else if (result.exercise) {
          activityData = result;
        } else if (Array.isArray(result) && result.length > 0) {
          activityData = result[0];
        }
        
        console.log('Extracted activity data:', activityData ? 'Found' : 'Not found');
        return activityData;
      } else {
        console.error('Failed to fetch activity details:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error data:', errorData);
      }
      return null;
    } catch (error) {
      console.error('Error fetching activity details:', error);
      console.error('Error stack:', error.stack);
      return null;
    }
  };

  // Enrich day activities with full details (including videos)
  useEffect(() => {
    if (!isDayActivity || !activities || activities.length === 0) {
      setEnrichedActivities(activities || []);
      return;
    }

    console.log('Enriching day activities, count:', activities.length);
    console.log('First activity sample:', JSON.stringify(activities[0], null, 2));

    const enrichActivities = async () => {
      const enriched = await Promise.all(
        (activities || []).map(async (activity, index) => {
          console.log(`Processing activity ${index + 1}:`, {
            exercise_id: activity.exercise_id || activity.id,
            exercise_name: activity.exercise_name || activity.name,
            hasVideo: !!getVideoUrl(activity),
          });

          // If activity already has video info, use it
          if (getVideoUrl(activity)) {
            console.log(`Activity ${index + 1} already has video, skipping fetch`);
            return activity;
          }

          // Otherwise, fetch full details using exercise_id
          const exerciseId = activity.exercise_id || activity.id;
          if (exerciseId) {
            console.log(`Fetching full details for activity ${index + 1} with exercise_id:`, exerciseId);
            const fullDetails = await fetchActivityDetails(exerciseId);
            if (fullDetails) {
              console.log(`Successfully fetched details for activity ${index + 1}`);
              console.log('Full details video fields:', {
                video_link: fullDetails.video_link,
                video_url: fullDetails.video_url,
                'exercise.video_link': fullDetails.exercise?.video_link,
                'exercise.video_url': fullDetails.exercise?.video_url,
              });
              
              // Merge full details with existing activity data
              const merged = {
                ...fullDetails,
                ...activity, // Activity data overrides to preserve sets/reps from day plan
                exercise: fullDetails.exercise || activity.exercise,
                exercise_details: fullDetails.exercise_details || activity.exercise_details,
                // Preserve day activity specific fields (these come from the day plan)
                sets: activity.sets || fullDetails.sets,
                reps: activity.reps || fullDetails.reps,
                rest_seconds: activity.rest_seconds || fullDetails.rest_seconds,
                // Preserve exercise_id and exercise_name from day activity
                exercise_id: activity.exercise_id || fullDetails.exercise_id || fullDetails.id,
                exercise_name: activity.exercise_name || fullDetails.exercise_name || fullDetails.name,
              };
              
              console.log(`Merged activity ${index + 1} has video:`, !!getVideoUrl(merged));
              return merged;
            } else {
              console.log(`Failed to fetch details for activity ${index + 1}`);
            }
          } else {
            console.log(`Activity ${index + 1} has no exercise_id, cannot fetch details`);
          }
          return activity;
        })
      );

      console.log('Enrichment complete. Enriched activities count:', enriched.length);
      setEnrichedActivities(enriched);
    };

    enrichActivities();
  }, [isDayActivity, activities]);

  // Get video URL for current activity
  const getCurrentVideoUrl = () => {
    return getVideoUrl(currentActivity);
  };

  // Format time helper
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get exercise icon based on exercise name
  const getExerciseIcon = (exerciseName) => {
    const name = exerciseName?.toLowerCase() || '';
    if (name.includes('jump')) return 'human-handsdown';
    if (name.includes('squat')) return 'human-handsdown';
    if (name.includes('push')) return 'human-handsdown';
    if (name.includes('pull')) return 'human-handsdown';
    if (name.includes('plank')) return 'human-handsdown';
    if (name.includes('burpee')) return 'human-handsdown';
    if (name.includes('lunge')) return 'human-handsdown';
    if (name.includes('crunch')) return 'human-handsdown';
    return 'human-handsdown'; // Default exercise icon
  };

  // Start workout session with countdown
  const startWorkout = async () => {
    try {
      // For day activities, check dayActivityPlanId instead of workoutId
      if (isDayActivity) {
        if (!dayActivityPlanId || !selectedDay) {
          setAlertConfig({
            title: 'Error',
            message: 'Day activity information missing',
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
      } else {
        if (!workoutId || !selectedDay) {
          setAlertConfig({
            title: 'Error',
            message: 'Workout information missing',
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
      }

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

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      let endpoint;
      if (isDayActivity) {
        // Use day activities endpoint
        endpoint = `${API_BASE_URL}/mobile/day-activities/start`;
      } else {
        // Use workout endpoint
        const dayNumber = getDayNumber(selectedDay);
        endpoint = `${API_BASE_URL}/mobile/member-workouts/${workoutId}/day/${dayNumber}/start`;
      }
      
      const requestBody = isDayActivity 
        ? { day_activity_plan_id: dayActivityPlanId }
        : undefined;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        ...(requestBody && { body: JSON.stringify(requestBody) }),
      });

      if (response.ok) {
        setWorkoutStarted(true);
        // Start pre-countdown 3,2,1,GO then begin set timer
        startPreCountdown();
      } else {
        const errorData = await response.json();
        setAlertConfig({
          title: 'Error',
          message: errorData.message || 'Failed to start workout',
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

  // Pre-countdown: show 3, 2, 1, GO
  const startPreCountdown = () => {
    setWorkoutPhase('ready');
    setIsPreCountdownActive(true);
    setPreCountdownIndex(0);

    // Play countdown audio
    if (countdownSoundRef.current) {
      try {
        console.log('Attempting to play countdown audio...');
        const sound = countdownSoundRef.current;
        
        // Set volume to maximum
        sound.setVolume(1.0);
        
        sound.stop(() => {
          try {
            sound.setCurrentTime(0);
            console.log('Playing sound from beginning...');
            sound.play((success) => {
              if (success) {
                console.log('Countdown audio played successfully');
              } else {
                console.log('Countdown audio playback failed - success is false');
              }
            });
          } catch (playError) {
            console.log('Error playing countdown audio:', playError);
          }
        });
      } catch (stopError) {
        console.log('Error stopping countdown audio:', stopError);
        // Try to play anyway
        try {
          const sound = countdownSoundRef.current;
          sound.setVolume(1.0);
          sound.setCurrentTime(0);
          sound.play((success) => {
            console.log('Direct play attempt, success:', success);
          });
        } catch (directPlayError) {
          console.log('Direct play also failed:', directPlayError);
        }
      }
    } else {
      console.log('Countdown sound ref is null - audio not available');
    }

    preCountdownIntervalRef.current = setInterval(() => {
      setPreCountdownIndex(prev => {
        if (prev >= 3) {
          clearInterval(preCountdownIntervalRef.current);
          setIsPreCountdownActive(false);
          // Immediately start the actual set countdown
          startActualWorkout();
          return 3;
        }
        return prev + 1;
      });
    }, 1000);
  };

  // Start actual workout after countdown
  const startActualWorkout = () => {
    setWorkoutPhase('work');
    setIsActive(true);
    startTimers();
    startSetTimer(); // Start 30-second timer for first set
    // Video will start playing when set timer starts (handled in Video component paused prop)
  };

  // Start 30-second timer for current set
  const startSetTimer = () => {
    setSetTimer(SET_DURATION_SECONDS);
    setIsSetTimerActive(true);
    tenSecondsPlayedRef.current = false; // Reset flag for new set
    threeSecondsPlayedRef.current = false; // Reset flag for new set
    
    setTimerIntervalRef.current = setInterval(() => {
      setSetTimer(prev => {
        // Play 10 seconds left audio when timer reaches 10
        if (prev === 10 && !tenSecondsPlayedRef.current) {
          tenSecondsPlayedRef.current = true;
          // Play 10 seconds left audio
          if (tenSecondsLeftSoundRef.current) {
            try {
              console.log('Playing 10 seconds left audio...');
              const sound = tenSecondsLeftSoundRef.current;
              sound.setVolume(1.0);
              sound.stop(() => {
                try {
                  sound.setCurrentTime(0);
                  sound.play((success) => {
                    if (success) {
                      console.log('10 seconds left audio played successfully');
                    } else {
                      console.log('10 seconds left audio playback failed');
                    }
                  });
                } catch (playError) {
                  console.log('Error playing 10 seconds left audio:', playError);
                }
              });
            } catch (stopError) {
              console.log('Error stopping 10 seconds left audio:', stopError);
              // Try to play anyway
              try {
                const sound = tenSecondsLeftSoundRef.current;
                sound.setVolume(1.0);
                sound.setCurrentTime(0);
                sound.play((success) => {
                  console.log('Direct play attempt for 10 seconds, success:', success);
                });
              } catch (directPlayError) {
                console.log('Direct play also failed for 10 seconds:', directPlayError);
              }
            }
          } else {
            console.log('10 seconds left sound ref is null - audio not available');
          }
        }
        
        // Play 3 seconds left audio when timer reaches 3
        // Check at 4 so audio plays when timer shows 3
        if (prev === 4 && !threeSecondsPlayedRef.current) {
          threeSecondsPlayedRef.current = true;
          // Play 3 seconds left audio
          if (threeSecondsLeftSoundRef.current) {
            try {
              console.log('Playing 3 seconds left audio...');
              const sound = threeSecondsLeftSoundRef.current;
              sound.setVolume(1.0);
              sound.stop(() => {
                try {
                  sound.setCurrentTime(0);
                  sound.play((success) => {
                    if (success) {
                      console.log('3 seconds left audio played successfully');
                    } else {
                      console.log('3 seconds left audio playback failed');
                    }
                  });
                } catch (playError) {
                  console.log('Error playing 3 seconds left audio:', playError);
                }
              });
            } catch (stopError) {
              console.log('Error stopping 3 seconds left audio:', stopError);
              // Try to play anyway
              try {
                const sound = threeSecondsLeftSoundRef.current;
                sound.setVolume(1.0);
                sound.setCurrentTime(0);
                sound.play((success) => {
                  console.log('Direct play attempt for 3 seconds, success:', success);
                });
              } catch (directPlayError) {
                console.log('Direct play also failed for 3 seconds:', directPlayError);
              }
            }
          } else {
            console.log('3 seconds left sound ref is null - audio not available');
          }
        }
        
        if (prev <= 1) {
          // Time's up - start rest period before moving to next set
          setIsSetTimerActive(false);
          clearInterval(setTimerIntervalRef.current);
          startRestPeriod();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Start 10-second rest period
  const startRestPeriod = () => {
    setRestTimer(REST_DURATION_SECONDS);
    setIsRestPeriod(true);
    // Video will be paused during rest (handled in Video component paused prop)
    
    restTimerIntervalRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (prev <= 1) {
          // Rest period over - move to next set
          setIsRestPeriod(false);
          clearInterval(restTimerIntervalRef.current);
          moveToNextSet();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Skip rest period and move to next set
  const skipRest = () => {
    setIsRestPeriod(false);
    if (restTimerIntervalRef.current) {
      clearInterval(restTimerIntervalRef.current);
      restTimerIntervalRef.current = null;
    }
    // Immediately move to next set
    moveToNextSet();
  };

  // Move to next set (called after rest period completes)
  const moveToNextSet = () => {
    // Stop rest timer if still active
    setIsRestPeriod(false);
    if (restTimerIntervalRef.current) {
      clearInterval(restTimerIntervalRef.current);
    }
    
    // Use functional update to get the latest currentSet value
    setCurrentSet(prevSet => {
      if (prevSet < totalSets) {
        // More sets remaining - move to next set
        setCurrentRep(1);
        // Video continues playing - no restart between sets for smooth playback
        // Start timer for next set after state update
        setTimeout(() => {
          startSetTimer();
        }, 0);
        return prevSet + 1;
      } else {
        // All sets completed, move to next activity
        completeActivity();
        return prevSet;
      }
    });
  };

  // Complete workout session
  const completeWorkout = async () => {
    try {
      // For day activities, check dayActivityPlanId instead of workoutId
      if (isDayActivity) {
        if (!dayActivityPlanId || !selectedDay) {
          setAlertConfig({
            title: 'Error',
            message: 'Day activity information missing',
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
      } else {
        if (!workoutId || !selectedDay) {
          setAlertConfig({
            title: 'Error',
            message: 'Workout information missing',
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
      }

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

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      let endpoint;
      if (isDayActivity) {
        // Use day activities complete endpoint
        endpoint = `${API_BASE_URL}/mobile/day-activities/complete`;
      } else {
        // Use workout complete endpoint
        const dayNumber = getDayNumber(selectedDay);
        endpoint = `${API_BASE_URL}/mobile/member-workouts/${workoutId}/day/${dayNumber}/complete`;
      }
      
      const requestBody = isDayActivity 
        ? { day_activity_plan_id: dayActivityPlanId }
        : undefined;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        ...(requestBody && { body: JSON.stringify(requestBody) }),
      });

      if (response.ok) {
        // Update challenge progress (non-blocking)
        try {
          const ChallengeProgressService = require('../services/ChallengeProgressService').default;
          ChallengeProgressService.updateProgressAfterWorkout({
            calories: 0, // Will be calculated by backend if available
            duration: Math.floor(sessionTimer / 60), // Convert seconds to minutes
            activity_count: completedActivities.length || 1,
          }).catch(() => {});
        } catch (err) {
          // Challenge progress service not available
        }

        const successMessage = isDayActivity 
          ? `You've completed your ${selectedDay} activities!`
          : `You've completed your ${selectedDay} workout!`;
        
        setAlertConfig({
          title: 'Congratulations!',
          message: successMessage,
          type: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      } else {
        const errorData = await response.json();
        setAlertConfig({
          title: 'Error',
          message: errorData.message || 'Failed to complete workout',
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

  // Get day number helper
  const getDayNumber = (dayName) => {
    const dayMap = {
      'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
      'Friday': 5, 'Saturday': 6, 'Sunday': 7
    };
    return dayMap[dayName] || 1;
  };

  // Start timers
  const startTimers = () => {
    // Session timer - only start if not already running
    if (!sessionIntervalRef.current) {
      sessionIntervalRef.current = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
    }

    // Rep timer (for rest periods) - only start if not already running
    if (!repIntervalRef.current) {
      repIntervalRef.current = setInterval(() => {
        setRepTimer(prev => prev + 1);
      }, 1000);
    }
  };

  // Stop timers
  const stopTimers = () => {
    setIsActive(false);
    setIsPaused(false);
    setIsCountdownActive(false);
    setIsSetTimerActive(false);
    setIsPreCountdownActive(false);
    setIsRestPeriod(false);
    
    if (sessionIntervalRef.current) {
      clearInterval(sessionIntervalRef.current);
      sessionIntervalRef.current = null;
    }
    if (repIntervalRef.current) {
      clearInterval(repIntervalRef.current);
      repIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (setTimerIntervalRef.current) {
      clearInterval(setTimerIntervalRef.current);
      setTimerIntervalRef.current = null;
    }
    if (preCountdownIntervalRef.current) {
      clearInterval(preCountdownIntervalRef.current);
      preCountdownIntervalRef.current = null;
    }
    if (restTimerIntervalRef.current) {
      clearInterval(restTimerIntervalRef.current);
      restTimerIntervalRef.current = null;
    }
    
    // Stop countdown audio
    if (countdownSoundRef.current) {
      countdownSoundRef.current.stop();
    }
    
    // Stop 10 seconds left audio
    if (tenSecondsLeftSoundRef.current) {
      tenSecondsLeftSoundRef.current.stop();
    }
    
    // Stop 3 seconds left audio
    if (threeSecondsLeftSoundRef.current) {
      threeSecondsLeftSoundRef.current.stop();
    }
    
    // Reset flags
    tenSecondsPlayedRef.current = false;
    threeSecondsPlayedRef.current = false;
  };

  // Pause/Resume workout
  const togglePause = () => {
    if (isPaused) {
      // Resume
      setIsPaused(false);
      startTimers();
      
      // Resume set timer if it was active
      if (isSetTimerActive && setTimer > 0) {
        setTimerIntervalRef.current = setInterval(() => {
          setSetTimer(prev => {
            if (prev <= 1) {
              setIsSetTimerActive(false);
              clearInterval(setTimerIntervalRef.current);
              startRestPeriod();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      
      // Resume rest timer if it was active
      if (isRestPeriod && restTimer > 0) {
        restTimerIntervalRef.current = setInterval(() => {
          setRestTimer(prev => {
            if (prev <= 1) {
              setIsRestPeriod(false);
              clearInterval(restTimerIntervalRef.current);
              moveToNextSet();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } else {
      // Pause
      setIsPaused(true);
      stopTimers();
    }
  };

  // Stop workout and go back
  const stopWorkout = () => {
    setAlertConfig({
      title: 'Stop Workout',
      message: 'Are you sure you want to stop this workout? Your progress will not be saved.',
      type: 'warning',
      buttons: [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'secondary',
        },
        {
          text: 'Stop',
          onPress: () => {
            stopTimers();
            navigation.goBack();
          },
          style: 'primary',
        },
      ],
    });
    setAlertVisible(true);
  };

  // Complete current rep
  const completeRep = () => {
    if (currentRep < repsPerSet) {
      // More reps in current set - just move to next rep
      setCurrentRep(prev => prev + 1);
    } else {
      // Current set completed - move to next set
      setIsSetTimerActive(false);
      clearInterval(setTimerIntervalRef.current);
      moveToNextSet();
    }
  };

  // Complete set early (user presses Done)
  const completeSetEarly = () => {
    setIsSetTimerActive(false);
    if (setTimerIntervalRef.current) {
      clearInterval(setTimerIntervalRef.current);
    }
    // Start rest period before moving to next set
    startRestPeriod();
  };


  // Complete current activity
  const completeActivity = () => {
    // Stop all timers first to prevent continuation
    setIsSetTimerActive(false);
    if (setTimerIntervalRef.current) {
      clearInterval(setTimerIntervalRef.current);
    }
    
    setCompletedActivities(prev => [...prev, currentActivityIndex]);
    
    if (currentActivityIndex < totalActivities - 1) {
      // Move to next activity
      setCurrentActivityIndex(prev => prev + 1);
      setCurrentSet(1);
      setCurrentRep(1);
      setRepTimer(0);
      
      // Start pre-countdown for next activity (3, 2, 1, GO)
      startPreCountdown();
    } else {
      // All activities completed
      setIsActive(false);
      stopTimers();
      completeWorkout();
    }
  };

  // Skip current activity
  const skipActivity = () => {
    setAlertConfig({
      title: 'Skip Activity',
      message: 'Are you sure you want to skip this activity?',
      type: 'warning',
      buttons: [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'secondary',
        },
        {
          text: 'Skip',
          onPress: completeActivity,
          style: 'primary',
        },
      ],
    });
    setAlertVisible(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimers();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (setTimerIntervalRef.current) {
        clearInterval(setTimerIntervalRef.current);
      }
      if (preCountdownIntervalRef.current) {
        clearInterval(preCountdownIntervalRef.current);
      }
      if (restTimerIntervalRef.current) {
        clearInterval(restTimerIntervalRef.current);
      }
      // Clear all buffering timeouts
      Object.values(bufferingTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      bufferingTimeoutRef.current = {};
      // Release countdown audio
      if (countdownSoundRef.current) {
        countdownSoundRef.current.stop(() => {
          countdownSoundRef.current.release();
        });
      }
      // Release 10 seconds left audio
      if (tenSecondsLeftSoundRef.current) {
        tenSecondsLeftSoundRef.current.stop(() => {
          tenSecondsLeftSoundRef.current.release();
        });
      }
      // Release 3 seconds left audio
      if (threeSecondsLeftSoundRef.current) {
        threeSecondsLeftSoundRef.current.stop(() => {
          threeSecondsLeftSoundRef.current.release();
        });
      }
    };
  }, []);

  // Calculate progress percentage for circular timer
  const getProgressPercentage = () => {
    if (!isSetTimerActive) return 0;
    return ((SET_DURATION_SECONDS - setTimer) / SET_DURATION_SECONDS) * 100;
  };

  // Calculate progress percentage for rest timer
  const getRestProgressPercentage = () => {
    if (!isRestPeriod) return 0;
    return ((REST_DURATION_SECONDS - restTimer) / REST_DURATION_SECONDS) * 100;
  };

  // Calculate stroke dash offset for circular progress
  const getStrokeDashOffset = () => {
    const radius = 90; // Circle radius
    const circumference = 2 * Math.PI * radius;
    const progress = getProgressPercentage() / 100;
    return circumference - (progress * circumference);
  };

  // Calculate stroke dash offset for rest timer circular progress
  const getRestStrokeDashOffset = () => {
    const radius = 90; // Circle radius
    const circumference = 2 * Math.PI * radius;
    const progress = getRestProgressPercentage() / 100;
    return circumference - (progress * circumference);
  };

  // Preload all videos when component mounts - initialize states
  useEffect(() => {
    if (!enrichedActivities || enrichedActivities.length === 0) return;

    // Initialize video state only for first activity (current)
    // Next video will be initialized when we move to it
    const firstActivity = enrichedActivities[0];
    const firstVideoUrl = getVideoUrl(firstActivity);
    if (firstVideoUrl) {
      setVideoStates({
        0: { loading: true, ready: false, error: false, buffering: false, url: firstVideoUrl }
      });
    } else {
      setVideoStates({
        0: { loading: false, ready: false, error: false, buffering: false, url: null }
      });
    }
  }, [activities?.length]); // Only run when activities count changes

  // Video player handlers - per activity
  const onVideoLoad = (activityIndex) => {
    setVideoStates(prev => {
      const newState = {
        ...prev,
        [activityIndex]: { ...prev[activityIndex], loading: false, ready: true, error: false, buffering: false }
      };
      
      // If this is the first activity's video (index 0) and workout hasn't started, start it
      if (activityIndex === 0 && !workoutStarted && !workoutStartAttemptedRef.current && !isActive && !isPreCountdownActive) {
        workoutStartAttemptedRef.current = true;
        // Small delay to ensure state is updated
        setTimeout(() => {
          if (!workoutStarted) {
            startWorkout();
          }
        }, 100);
      }
      
      // Preload next video when current video is ready
      if (activityIndex === currentActivityIndex && activityIndex + 1 < enrichedActivities.length) {
        const nextActivity = enrichedActivities[activityIndex + 1];
        const nextVideoUrl = getVideoUrl(nextActivity);
        if (nextVideoUrl && !newState[activityIndex + 1]) {
          // Initialize next video state
          setTimeout(() => {
            setVideoStates(prevState => ({
              ...prevState,
              [activityIndex + 1]: { loading: true, ready: false, error: false, buffering: false, url: nextVideoUrl }
            }));
          }, 100);
        }
      }
      
      return newState;
    });
  };

  const onVideoError = (activityIndex, error) => {
    console.error(`Video error for activity ${activityIndex}:`, error);
    setVideoStates(prev => {
      const newState = {
        ...prev,
        [activityIndex]: { ...prev[activityIndex], loading: false, ready: false, error: true, buffering: false }
      };
      
      // If this is the first activity's video and it has an error, start workout anyway (fallback to icon)
      if (activityIndex === 0 && !workoutStarted && !workoutStartAttemptedRef.current && !isActive && !isPreCountdownActive) {
        workoutStartAttemptedRef.current = true;
        // Wait a bit to see if video retries, then start workout
        setTimeout(() => {
          if (!workoutStarted) {
            startWorkout();
          }
        }, 2000); // Wait 2 seconds in case video retries
      }
      
      return newState;
    });
  };

  // Handle video buffering state with debounce to prevent flickering
  const onVideoBuffer = (activityIndex, { isBuffering }) => {
    // Clear existing timeout for this video
    if (bufferingTimeoutRef.current[activityIndex]) {
      clearTimeout(bufferingTimeoutRef.current[activityIndex]);
      delete bufferingTimeoutRef.current[activityIndex];
    }
    
    if (isBuffering) {
      // Only show buffering indicator after 1 second of buffering (prevents flickering)
      bufferingTimeoutRef.current[activityIndex] = setTimeout(() => {
        setVideoStates(prev => ({
          ...prev,
          [activityIndex]: { ...prev[activityIndex], buffering: true }
        }));
      }, 1000);
    } else {
      // Hide buffering immediately when buffering stops
      setVideoStates(prev => ({
        ...prev,
        [activityIndex]: { ...prev[activityIndex], buffering: false }
      }));
    }
  };

  // Handle video load start
  const onVideoLoadStart = (activityIndex) => {
    setVideoStates(prev => ({
      ...prev,
      [activityIndex]: { ...prev[activityIndex], loading: true, buffering: true }
    }));
  };

  // Preload next activity's video when current activity changes
  useEffect(() => {
    if (currentActivityIndex + 1 < enrichedActivities.length) {
      const nextActivity = enrichedActivities[currentActivityIndex + 1];
      const nextVideoUrl = getVideoUrl(nextActivity);
      if (nextVideoUrl && !videoStates[currentActivityIndex + 1]) {
        // Initialize next video state for preloading
        setVideoStates(prev => ({
          ...prev,
          [currentActivityIndex + 1]: { loading: true, ready: false, error: false, buffering: false, url: nextVideoUrl }
        }));
      }
    }
  }, [currentActivityIndex]);

  // Wait for video to load before starting workout - only run once on mount
  useEffect(() => {
    if (!enrichedActivities || enrichedActivities.length === 0 || workoutStarted || workoutStartAttemptedRef.current) return;
    
    const currentVideoUrl = getCurrentVideoUrl();
    const currentVideoState = videoStates[0]; // Only check first activity on mount
    
    // If no video for this activity, start workout immediately
    if (!currentVideoUrl) {
      console.log('No video for activity, starting workout immediately');
      workoutStartAttemptedRef.current = true;
      startWorkout();
      return;
    }
    
    // If video is ready, start workout
    if (currentVideoState?.ready) {
      console.log('Video is ready, starting workout');
      workoutStartAttemptedRef.current = true;
      startWorkout();
      return;
    }
    
    // If video has error, wait a bit then start workout anyway (fallback to icon)
    if (currentVideoState?.error) {
      console.log('Video has error, starting workout after delay');
      workoutStartAttemptedRef.current = true;
      const timeoutId = setTimeout(() => {
        if (!workoutStarted) {
          startWorkout();
        }
      }, 2000); // Wait 2 seconds in case video retries
      return () => clearTimeout(timeoutId);
    }
    
    // Video is still loading - wait for onVideoLoad to trigger startWorkout
    console.log('Waiting for video to load...');
  }, [activities?.length]); // Only depend on activities length, not the full object

  // Logout handler
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
    if (item.lib === 'Feather') IconComponent = require('react-native-vector-icons/Feather').default;
    if (item.lib === 'Ionicons') IconComponent = Ionicons;
    return <IconComponent name={item.icon} size={24} color="#222" />;
  };

  if (!currentActivity) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={60} color="#FF6B6B" />
          <Text style={styles.errorText}>No activities available</Text>
          <TouchableOpacity style={styles.errorBackButton} onPress={() => navigation.goBack()}>
            <Text style={styles.errorBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Player or Exercise Icon */}
      <View style={styles.characterWrapper}>
        {/* Progressive loading: Only render current video + next video */}
        {enrichedActivities && (() => {
          const videosToRender = [];
          
          // Always render current video
          if (currentActivityIndex < enrichedActivities.length) {
            videosToRender.push({ index: currentActivityIndex, priority: 'current' });
          }
          
          // Preload next video (if exists)
          if (currentActivityIndex + 1 < enrichedActivities.length) {
            videosToRender.push({ index: currentActivityIndex + 1, priority: 'next' });
          }
          
          return videosToRender.map(({ index, priority }) => {
            const activity = enrichedActivities[index];
            const videoUrl = getVideoUrl(activity);
            if (!videoUrl) return null; // Skip if no video
            
            const videoState = videoStates[index] || { loading: false, ready: false, error: false, buffering: false, url: null };
            const isCurrentActivity = index === currentActivityIndex;
            
            // Video playback logic:
            // - Pause if not current activity
            // - Pause during pre-countdown (3,2,1)
            // - Play during set timer (isSetTimerActive)
            // - Pause during rest period (isRestPeriod)
            // - Pause if user manually paused
            const shouldPause = !isCurrentActivity || 
                                !videoState.ready || 
                                isPreCountdownActive || 
                                isRestPeriod || 
                                isPaused || 
                                !isSetTimerActive;
            
            return (
              <Video
                key={`video-${index}`}
                ref={(ref) => {
                  if (ref) {
                    videoRefs.current[index] = ref;
                  }
                }}
                source={{ uri: videoUrl }}
                style={[
                  styles.videoPlayer,
                  (!isCurrentActivity || !videoState.ready) && styles.videoHidden
                ]}
                paused={shouldPause}
                repeat={true}
                resizeMode="cover"
                onLoad={() => onVideoLoad(index)}
                onLoadStart={() => onVideoLoadStart(index)}
                onBuffer={(data) => onVideoBuffer(index, data)}
                onError={(error) => onVideoError(index, error)}
                poster={null}
                ignoreSilentSwitch="ignore"
                playInBackground={false}
                playWhenInactive={false}
                progressUpdateInterval={250}
                reportBandwidth={true}
                maxBitRate={5000000}
                bufferConfig={{
                  minBufferMs: 5000,        // Increased - more buffer before starting
                  maxBufferMs: 30000,       // Increased significantly - more buffer for smooth playback
                  bufferForPlaybackMs: 3000, // Increased - ensure enough buffer before playing
                  bufferForPlaybackAfterRebufferMs: 5000, // Increased - more buffer after rebuffer
                }}
                onProgress={(data) => {
                  // Track progress to help with buffering management
                  // This helps the video player maintain better buffer state
                }}
                onSeek={(data) => {
                  // Handle seek events smoothly
                }}
              />
            );
          });
        })()}
        
        {/* Loading overlay for current activity - only show during initial load, not buffering */}
        {videoStates[currentActivityIndex]?.loading && !videoStates[currentActivityIndex]?.ready && (
          <View style={styles.videoLoadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
        
        {/* Subtle buffering indicator - only show if buffering for extended period */}
        {videoStates[currentActivityIndex]?.buffering && videoStates[currentActivityIndex]?.ready && (
          <View style={styles.videoBufferingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
        
        {/* Error overlay for current activity */}
        {videoStates[currentActivityIndex]?.error && (
          <View style={styles.videoErrorOverlay}>
            <MaterialCommunityIcons 
              name={getExerciseIcon(currentActivity.exercise_name || currentActivity.name)} 
              size={120} 
              color="#333" 
            />
          </View>
        )}
        
        {/* Fallback icon if no video for current activity */}
        {!getCurrentVideoUrl() && (
          <MaterialCommunityIcons 
            name={getExerciseIcon(currentActivity.exercise_name || currentActivity.name)} 
            size={120} 
            color="#333" 
          />
        )}
      </View>

      {/* Sets and Timer Section */}
      <View style={styles.setsTimerSection}>
        <View style={styles.setsTimerContainer}>
          <View style={styles.setsInfo}>
            <Text style={styles.setsNumber}>{currentSet}/{totalSets}</Text>
            <Text style={styles.setsLabel}>Sets</Text>
          </View>
          <View style={styles.timerInfo}>
            <Text style={styles.timerNumber}>
              {isPreCountdownActive 
                ? ['3','2','1','GO'][preCountdownIndex] 
                : isRestPeriod 
                  ? restTimer 
                  : setTimer}
            </Text>
            <Text style={styles.timerLabel}>
              {isRestPeriod ? 'Rest' : 'Sec'}
            </Text>
          </View>
        </View>
      </View>

      {/* Circular Timer */}
      <View style={styles.timerWrapper}>
        {isPreCountdownActive && (
          <View style={[styles.circularTimer, { borderColor: '#FF3B30' }]}>
            <View style={styles.timerCircle}>
              <Text style={styles.timerText}>{['3','2','1','GO'][preCountdownIndex]}</Text>
            </View>
          </View>
        )}
        
        {isCountdownActive && (
          <View style={styles.circularTimer}>
            <View style={styles.timerCircle}>
              <Text style={styles.timerText}>{String(countdownTimer).padStart(2, '0')}</Text>
            </View>
          </View>
        )}

        {isSetTimerActive && !isPaused && (
          <View style={styles.circularTimerContainer}>
            <Svg width={200} height={200} style={styles.circularTimerSvg}>
              {/* Background circle */}
              <Circle
                cx="100"
                cy="100"
                r="90"
                stroke="#e0e0e0"
                strokeWidth="8"
                fill="none"
              />
              {/* Progress circle */}
              <Circle
                cx="100"
                cy="100"
                r="90"
                stroke="#FF3B30"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 90}`}
                strokeDashoffset={getStrokeDashOffset()}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
              />
            </Svg>
            <View style={styles.timerCircle}>
              <Text style={styles.timerText}>:{setTimer}</Text>
            </View>
          </View>
        )}

        {isSetTimerActive && isPaused && (
          <View style={styles.circularTimer}>
            <View style={styles.timerCircle}>
              <Text style={styles.timerText}>:{setTimer}</Text>
              <Text style={styles.pausedText}>Paused</Text>
            </View>
          </View>
        )}

        {isRestPeriod && !isPaused && (
          <View style={styles.circularTimerContainer}>
            <Svg width={200} height={200} style={styles.circularTimerSvg}>
              {/* Background circle */}
              <Circle
                cx="100"
                cy="100"
                r="90"
                stroke="#e0e0e0"
                strokeWidth="8"
                fill="none"
              />
              {/* Rest progress circle - different color (blue) */}
              <Circle
                cx="100"
                cy="100"
                r="90"
                stroke="#007AFF"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 90}`}
                strokeDashoffset={getRestStrokeDashOffset()}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
              />
            </Svg>
            <View style={styles.timerCircle}>
              <Text style={[styles.timerText, { color: '#007AFF' }]}>{restTimer}</Text>
            </View>
          </View>
        )}

        {isRestPeriod && isPaused && (
          <View style={styles.circularTimer}>
            <View style={styles.timerCircle}>
              <Text style={[styles.timerText, { color: '#007AFF' }]}>{restTimer}</Text>
              <Text style={styles.pausedText}>Paused</Text>
            </View>
          </View>
        )}
        
        {!isPreCountdownActive && !isCountdownActive && !isSetTimerActive && !isRestPeriod && (
          <View style={styles.circularTimer}>
            <View style={styles.timerCircle}>
              <Text style={styles.timerText}>{formatTime(sessionTimer)}</Text>
              {isPaused && <Text style={styles.pausedText}>Paused</Text>}
            </View>
          </View>
        )}
      </View>

      {/* Stop Button - Left side */}
      {isActive && (
        <TouchableOpacity 
          style={styles.stopButton} 
          onPress={stopWorkout}
        >
          <MaterialCommunityIcons name="stop" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Pause/Resume Button - Left side, below stop */}
      {isActive && (
        <TouchableOpacity 
          style={styles.pauseButton} 
          onPress={togglePause}
        >
          <MaterialCommunityIcons 
            name={isPaused ? "play" : "pause"} 
            size={20} 
            color="#fff" 
          />
        </TouchableOpacity>
      )}

      {/* Skip Rest Button - Only visible during rest period */}
      {isRestPeriod && (
        <TouchableOpacity 
          style={styles.skipRestButton} 
          onPress={skipRest}
        >
          <MaterialCommunityIcons name="skip-forward" size={20} color="#fff" />
          <Text style={styles.skipRestButtonText}>Skip Rest</Text>
        </TouchableOpacity>
      )}

      {/* Done Button - Hide during rest period and when paused */}
      {(isSetTimerActive || (isActive && !isPaused)) && !isRestPeriod && (
        <TouchableOpacity 
          style={styles.doneButton} 
          onPress={isSetTimerActive ? completeSetEarly : completeRep}
        >
          <MaterialCommunityIcons name="check" size={24} color="#333" />
        </TouchableOpacity>
      )}

      {/* Menu Modal */}
      <MenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        menuItems={menuItems}
        renderMenuIcon={renderMenuIcon}
        onMenuItemPress={handleMenuItemPress}
      />

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
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
  },
  menuButton: {
    padding: 8,
    marginLeft: 12,
  },
  characterWrapper: {
    width: screenWidth,
    height: 420,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#000',
    position: 'relative',
  },
  videoPlayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  videoHidden: {
    opacity: 0,
    width: 0,
    height: 0,
    position: 'absolute',
  },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBufferingOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoErrorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fafaf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerWrapper: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  circularTimer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 8,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  circularTimerContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  circularTimerSvg: {
    position: 'absolute',
  },
  timerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
  },
  pausedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stopButton: {
    position: 'absolute',
    bottom: 200,
    left: 30,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  pauseButton: {
    position: 'absolute',
    bottom: 140,
    left: 30,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  skipRestButton: {
    position: 'absolute',
    bottom: 120,
    right: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  skipRestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  doneButton: {
    position: 'absolute',
    bottom: 120,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  navButton: {
    padding: 10,
  },
  progressInfo: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  activityProgress: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#FF6B6B',
    textAlign: 'center',
    marginVertical: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  errorBackButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    marginTop: 10,
  },
  errorBackButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  setsTimerSection: {
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: '#ffffff',
  },
  setsTimerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: screenWidth - 80,
    paddingHorizontal: 30,
  },
  setsInfo: {
    alignItems: 'center',
    flex: 1,
  },
  timerInfo: {
    alignItems: 'center',
    flex: 1,
  },
  setsNumber: {
    fontSize: 32,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  timerNumber: {
    fontSize: 32,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  setsLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  timerLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
});

export default WorkoutSessionScreen;
