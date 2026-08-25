import React, { useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ImageBackground,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';



const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];



const safeText = (v) => (v === null || v === undefined ? '' : String(v));

const toPublicAssetUrl = (rawPath) => {
  const p = safeText(rawPath).trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const baseUrl = safeText(API_CONFIG?.BASE_URL).replace(/\/api\/?$/i, '');
  if (!baseUrl) return null;
  if (p.startsWith('/')) return `${baseUrl}${p}`;
  return `${baseUrl}/${p}`;
};

const parseNumberOrEmpty = (v) => {
  const t = safeText(v).trim();
  if (!t) return '';
  const n = Number(t);
  return Number.isFinite(n) ? n : '';
};

const parseJsonArrayOrCommaList = (raw) => {
  const t = safeText(raw).trim();
  if (!t) return undefined;
  if (t.startsWith('[')) {
    try {
      const parsed = JSON.parse(t);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const nums = parts.map((p) => Number(p));
  const allNums = nums.every((n) => Number.isFinite(n));
  return allNums ? nums : parts;
};

const normalizeSelectOptions = (options) => {
  return (options || [])
    .map((o) => {
      if (!o) return null;
      if (typeof o === 'string') return { label: o, value: o };
      if (typeof o === 'object') {
        const label = o.label ?? o.value;
        const value = o.value ?? o.label;
        if (label === undefined || value === undefined) return null;
        return { label: String(label), value };
      }
      return { label: String(o), value: String(o) };
    })
    .filter(Boolean);
};

const DropdownSelect = React.memo(({ label, value, onChange, options, placeholder, disabled = false, allowCustom = true }) => {
  const [open, setOpen] = useState(false);

  const normalized = React.useMemo(() => normalizeSelectOptions(options), [options]);

  const close = () => {
    setOpen(false);
  };

  return (
    <View style={{ marginBottom: 16, zIndex: open ? 1000 : 1 }}>
      <TouchableOpacity
        style={styles.selectInput}
        onPress={() => {
          if (disabled) return;
          setOpen((p) => !p);
        }}
        activeOpacity={0.85}
      >
        <Text style={[styles.selectText, !value && styles.selectTextPlaceholder]} numberOfLines={1}>
          {safeText(value) || placeholder}
        </Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={baseColors.textSecondary} />
      </TouchableOpacity>

      {open && (
        <>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={close}
          />
          <View style={styles.dropdownBox}>
            <ScrollView 
              style={styles.dropdownList} 
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              bounces={false}
            >
              {normalized.map((opt, idx) => {
                const active = safeText(value) === safeText(opt.value);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                    onPress={() => {
                      onChange(opt.value);
                      close();
                    }}
                  >
                    <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
});

const CreateWorkoutPlanScreen = ({ navigation, route }) => {
  const { backgroundColor, backgroundImage } = useContext(ThemeContext);
  const memberId = route?.params?.memberId || null;
  const memberName = route?.params?.memberName || null;
  const returnToActivityLibrary = route?.params?.returnToActivityLibrary;
  const pendingActivity = route?.params?.pendingActivity;

  // Memoize options arrays to prevent recreation on every render
  const categoryOptions = useMemo(() => route?.params?.categoryOptions || [], [route?.params?.categoryOptions]);
  const levelOptions = useMemo(() => route?.params?.levelOptions || [], [route?.params?.levelOptions]);
  const equipmentOptions = useMemo(() => route?.params?.equipmentOptions || [], [route?.params?.equipmentOptions]);
  const musclesOptions = useMemo(() => route?.params?.musclesOptions || [], [route?.params?.musclesOptions]);
  const tagOptions = useMemo(() => route?.params?.tagOptions || [], [route?.params?.tagOptions]);
  const typeOptions = useMemo(() => route?.params?.typeOptions || [], [route?.params?.typeOptions]);
  const repeatOptions = useMemo(() => route?.params?.repeatOptions || [], [route?.params?.repeatOptions]);

  // Memoize default values to prevent recalculation on every render
  const defaultValues = useMemo(() => ({
    category: categoryOptions.length > 0 ? categoryOptions[0] : 'General',
    level: levelOptions.length > 0 ? levelOptions[0] : 'Novice',
    equipment: equipmentOptions.length > 0 ? equipmentOptions[0] : '',
    muscles: musclesOptions.length > 0 ? musclesOptions[0] : '',
    tags: tagOptions.length > 0 ? tagOptions[0] : '',
    type: typeOptions.length > 0 ? typeOptions[0] : '',
    repeat: repeatOptions.length > 0 ? repeatOptions[0] : '',
  }), [categoryOptions, levelOptions, equipmentOptions, musclesOptions, tagOptions, typeOptions, repeatOptions]);

  const [name, setName] = useState('New workout');
  const [desc, setDesc] = useState('');
  const [calories, setCalories] = useState('');
  const [category, setCategory] = useState('General');
  const [duration, setDuration] = useState('');
  const [level, setLevel] = useState('Novice');
  const [goal, setGoal] = useState('Lose Weight');
  const [privacy, setPrivacy] = useState('Myself');
  const [enablePresetWeights, setEnablePresetWeights] = useState(false);
  const [proOnly, setProOnly] = useState(false);
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [selectedThumbnail, setSelectedThumbnail] = useState(DEFAULT_WORKOUT_IMAGES[0]);
  const [creating, setCreating] = useState(false);
  
  // Store activities per day: { 'Monday': [activity1, activity2], ... }
  const [dayActivities, setDayActivities] = useState(() => {
    const initial = {};
    DAYS.forEach(day => {
      initial[day] = [];
    });
    return initial;
  });

  // Advanced (optional)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [thumbnailText, setThumbnailText] = useState('');
  const [thumbnailAsset, setThumbnailAsset] = useState(null);
  const [instructions, setInstructions] = useState('');
  const [equipment, setEquipment] = useState(defaultValues.equipment);
  const [musclesTargeted, setMusclesTargeted] = useState(defaultValues.muscles);
  const [difficulty, setDifficulty] = useState('1');
  const [restPeriod, setRestPeriod] = useState('30');
  const [tags, setTags] = useState(defaultValues.tags);
  const [type, setType] = useState(defaultValues.type);
  const [sets, setSets] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('1 day per week');
  const [repeat, setRepeat] = useState(defaultValues.repeat);
  const [restSeconds, setRestSeconds] = useState('30');
  const [defaultReps, setDefaultReps] = useState('');

  // Track if component has mounted to prevent resetting on every render
  const hasMountedRef = useRef(false);
  
  // Refs to maintain TextInput focus
  const nameInputRef = useRef(null);
  const descInputRef = useRef(null);
  const durationInputRef = useRef(null);
  const caloriesInputRef = useRef(null);
  const thumbnailTextInputRef = useRef(null);
  const instructionsInputRef = useRef(null);
  
  // Track focus state to prevent keyboard from closing
  const nameFocusedRef = useRef(false);
  const descFocusedRef = useRef(false);
  const nameTextRef = useRef('New workout');
  const descTextRef = useRef('');
  
  const handleNameChange = useCallback((text) => {
    // Simple state update - no focus manipulation to avoid interfering with other fields
    setName(text);
  }, []);

  const handleDescChange = useCallback((text) => {
    // Simple state update - no focus manipulation to avoid interfering with typing
    setDesc(text);
  }, []);
  
  // Removed useEffect for name - it was stealing focus from description field
  
  // Removed useEffect for desc - it was interfering with typing
  // Focus restoration is now handled in handleDescChange only
  
  useEffect(() => {
    // Only reset form on initial mount, not on every options change
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      // Initial values are already set in useState, no need to reset
    }
  }, []);

  // Handle edit mode - pre-fill form with existing workout data
  useEffect(() => {
    const editMode = route?.params?.editMode;
    const editWorkoutId = route?.params?.workoutId;
    
    if (editMode && editWorkoutId) {
      // Pre-fill form with workout data from route params
      if (route?.params?.workoutName) setName(route.params.workoutName);
      if (route?.params?.workoutDescription) setDesc(route.params.workoutDescription);
      if (route?.params?.workoutCategory) setCategory(route.params.workoutCategory);
      if (route?.params?.workoutDuration) setDuration(route.params.workoutDuration);
      if (route?.params?.workoutLevel) setLevel(route.params.workoutLevel);
      if (route?.params?.workoutGoal) setGoal(route.params.workoutGoal);
      if (route?.params?.enablePresetWeights !== undefined) setEnablePresetWeights(route.params.enablePresetWeights);
      if (route?.params?.workoutThumbnail) {
        // Check if it's a local asset or URL
        const thumb = route.params.workoutThumbnail;
        if (typeof thumb === 'number' || (thumb && typeof thumb === 'object' && thumb.uri === undefined)) {
          // Local asset
          setSelectedThumbnail(thumb);
        } else if (typeof thumb === 'string') {
          // URL or path
          setThumbnailText(thumb);
        }
      }
      
      // Pre-fill day activities if provided
      if (route?.params?.dayActivities) {
        setDayActivities(route.params.dayActivities);
      }
    }
  }, [route?.params?.editMode, route?.params?.workoutId]);

  // Handle selected activities from ActivityLibraryScreen
  useEffect(() => {
    const selectedActivities = route?.params?.selectedActivities;
    const activityDay = route?.params?.activityDay;
    
    if (selectedActivities && Array.isArray(selectedActivities) && selectedActivities.length > 0 && activityDay) {
      // Add selected activities to the specified day
      setDayActivities(prev => ({
        ...prev,
        [activityDay]: [...(prev[activityDay] || []), ...selectedActivities]
      }));
      
      // Clear the params to avoid re-adding on subsequent focuses
      navigation.setParams({ selectedActivities: undefined, activityDay: undefined });
    }
  }, [route?.params?.selectedActivities, route?.params?.activityDay, navigation]);

  const pickThumbnailFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permission is required to select an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setThumbnailAsset(result.assets[0]);
        setThumbnailText('');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to pick image.');
    }
  };

  const clearThumbnail = () => {
    setThumbnailAsset(null);
    setThumbnailText('');
  };

  const handleCreate = async () => {
    // Only validate visible required fields - Name is the only required visible field
    const workoutName = safeText(name).trim();
    if (!workoutName) {
      Alert.alert('Missing Name', 'Please enter a workout name.');
      return;
    }

    try {
      setCreating(true);
      const editMode = route?.params?.editMode;
      const editWorkoutId = route?.params?.workoutId;
      
      // Ensure required fields have default values
      const safeCategory = safeText(category).trim() || 'General';
      const safeDuration = safeText(duration).trim() || '30';
      const safeLevel = safeText(level).trim() || 'Beginner';
      
      let workoutId;
      
      if (editMode && editWorkoutId) {
        // Update existing workout
        const updatePayload = {
          exercise_name: workoutName,
          description: safeText(desc).trim() || undefined,
          category: safeCategory,
          duration: safeDuration,
          level: safeLevel,
          goal: safeText(goal).trim() || undefined,
          enable_preset_weights: enablePresetWeights,
          thumbnail: thumbnailAsset || safeText(thumbnailText).trim() || selectedThumbnail || undefined,
        };
        
        await workoutsService.updateWorkoutTemplate(editWorkoutId, updatePayload);
        workoutId = editWorkoutId;
      } else {
        // Create new workout
        const payload = {
          exercise_name: workoutName,
          description: safeText(desc).trim() || undefined,
          category: safeCategory,
          duration: safeDuration,
          level: safeLevel,
          goal: safeText(goal).trim() || undefined,
          privacy: safeText(privacy).trim() || undefined,
          calories_burned: calories,
          enable_preset_weights: enablePresetWeights,
          pro_only: proOnly,
          thumbnail: thumbnailAsset || safeText(thumbnailText).trim() || selectedThumbnail || undefined,
          instructions: safeText(instructions).trim() || undefined,
          equipment: safeText(equipment).trim() || undefined,
          muscles_targeted: safeText(musclesTargeted).trim() || undefined,
          difficulty: parseNumberOrEmpty(difficulty),
          rest_period: parseNumberOrEmpty(restPeriod),
          tags: safeText(tags).trim() || undefined,
          type: safeText(type).trim() || undefined,
          sets: parseJsonArrayOrCommaList(sets),
          days_per_week: daysPerWeek ? daysPerWeek.replace(/ day(s)? per week/i, '').trim() || undefined : undefined,
          repeat: safeText(repeat).trim() || undefined,
          rest_seconds: parseNumberOrEmpty(restSeconds),
          default_reps: parseJsonArrayOrCommaList(defaultReps),
        };

        const resp = await workoutsService.createWorkoutTemplate(payload);
        workoutId = resp.id || resp.data?.id || resp.exercise?.id;
        if (!workoutId) {
          throw new Error('Workout created but no ID returned from server.');
        }
      }

      // Add/update activities to the workout plan for each day
      try {
        for (const day of DAYS) {
          const activities = dayActivities[day] || [];
          if (activities.length > 0) {
            // Format activities for the API
            const exercises = activities.map(activity => ({
              exercise_id: activity.exercise_id || null,
              exercise_name: activity.exercise_name || activity.name || 'Activity',
              thumbnail_url: activity.thumbnail_url || null,
              thumbnail_filename: activity.thumbnail_filename || null,
              sets: activity.sets || 3,
              reps: activity.reps || 10,
              rest_period: activity.rest_period || activity.rest_seconds || 30,
              sets_configuration: activity.sets_configuration || [],
              plan_id: activity.plan_id || activity.id || null, // Include plan_id for updates
            }));
            
            // Save workout activity plan for this day
            await workoutsService.saveWorkoutActivityPlan({
              workout_id: workoutId,
              day: day,
              workout_name: workoutName,
              description: safeText(desc).trim() || '',
              exercises: exercises,
            });
          }
        }
      } catch (activityError) {
        // Log error but don't fail the entire creation/update
        if (__DEV__) {
          console.warn('[CreateWorkoutPlanScreen] Error adding/updating activities:', activityError);
        }
      }

      // Get the thumbnail that was used
      const finalThumbnail = thumbnailAsset || safeText(thumbnailText).trim() || selectedThumbnail || undefined;
      
      // Get the goal value - ensure it's a string and not empty
      let goalValue = null;
      if (goal) {
        const goalStr = String(goal).trim();
        if (goalStr && goalStr !== '') {
          goalValue = goalStr;
        }
      }
      
      if (__DEV__) {
        console.log('[CreateWorkoutPlanScreen] Goal state:', goal, 'Type:', typeof goal, 'goalValue:', goalValue);
      }
      
      // Navigate to WorkoutPlanScreen to show the created workout
      navigation.replace('WorkoutPlan', {
        workoutId,
        workoutName: workoutName,
        workoutDescription: safeText(desc).trim() || '',
        enablePresetWeights: enablePresetWeights,
        workoutThumbnail: finalThumbnail, // Pass thumbnail from creation
        workoutDuration: duration || '30',
        workoutLevel: level || 'Beginner',
        workoutCategory: category || 'General',
        workoutGoal: goalValue, // Pass goal directly - will be null if empty
        memberId,
        memberName,
        showAddToToday: !!memberId, // Show "Add to today" button if member is selected
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create workout plan');
    } finally {
      setCreating(false);
    }
  };

  const getContainerStyle = () => {
    const baseStyle = [styles.container];
    if (backgroundColor) baseStyle.push({ backgroundColor });
    else if (backgroundImage) baseStyle.push({ backgroundColor: 'transparent' });
    return baseStyle;
  };

  // Memoize ContainerWrapper to prevent recreation on every render
  const ContainerWrapper = useMemo(() => {
    return ({ children }) => {
      if (backgroundImage) {
        return (
          <ImageBackground source={{ uri: backgroundImage }} style={getContainerStyle()} imageStyle={{ resizeMode: 'cover' }}>
            {children}
          </ImageBackground>
        );
      }
      return <View style={getContainerStyle()}>{children}</View>;
    };
  }, [backgroundImage, backgroundColor]);

  return (
    <ContainerWrapper>
      <View style={styles.keyboardView}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          bounces={false}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          removeClippedSubviews={false}
        >
          {/* Custom Header */}
          <View style={styles.customHeader}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={styles.closeButton}
            >
              <MaterialCommunityIcons name="close" size={24} color={baseColors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{route?.params?.editMode ? 'Edit Workout' : 'Create Workout'}</Text>
            <TouchableOpacity 
              onPress={handleCreate} 
              style={[styles.saveButton, creating && styles.saveButtonDisabled]}
              disabled={creating}
            >
              <Text style={styles.saveButtonText}>{creating ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          {/* Image Selection Section */}
          <View style={styles.imageSectionContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.defaultImagesContainer}
              contentContainerStyle={styles.defaultImagesContent}
            >
            {DEFAULT_WORKOUT_IMAGES.map((imageSource, index) => {
              // Check if it's a local require() asset (has a number property) or a URL string
              const isLocalAsset = typeof imageSource === 'number' || (imageSource && typeof imageSource === 'object' && imageSource.uri === undefined);
              const isSelected = selectedThumbnail === imageSource;

              return (
                <TouchableOpacity
                  key={`workout-image-${index}`}
                  style={[styles.defaultImageCard, isSelected && styles.defaultImageCardSelected]}
                  onPress={() => {
                    setSelectedThumbnail(imageSource);
                    setThumbnailAsset(null);
                    setThumbnailText('');
                  }}
                  disabled={creating}
                  activeOpacity={0.7}
                >
                  {isLocalAsset ? (
                    <Image 
                      source={imageSource}
                      style={styles.defaultImage} 
                      resizeMode="cover"
                    />
                  ) : (
                    <Image 
                      source={{ 
                        uri: imageSource,
                        cache: 'force-cache',
                        headers: {
                          'Accept': 'image/*',
                        },
                      }} 
                      style={styles.defaultImage} 
                      resizeMode="cover"
                      onError={(error) => {
                        if (__DEV__) {
                          console.log(`Failed to load image: ${imageSource}`, {
                            error: error?.nativeEvent?.error || 'Unknown error',
                          });
                        }
                      }}
                    />
                  )}
                  {isSelected && (
                    <View style={styles.selectedImageOverlay}>
                      <MaterialCommunityIcons name="check-circle" size={24} color={baseColors.white} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            </ScrollView>
          </View>

          {/* Gallery Image Option */}
          {/* <TouchableOpacity style={styles.galleryButton} onPress={pickThumbnailFromGallery} disabled={creating}>
            <MaterialCommunityIcons name="image-plus" size={18} color={baseColors.accentPrimary} />
            <Text style={styles.galleryButtonText}>Choose from gallery</Text>
          </TouchableOpacity>
          {thumbnailAsset?.uri && (
            <View style={styles.selectedGalleryImage}>
              <Image source={{ uri: thumbnailAsset.uri }} style={styles.galleryImagePreview} />
              <TouchableOpacity style={styles.removeGalleryImage} onPress={clearThumbnail} disabled={creating}>
                <MaterialCommunityIcons name="close-circle" size={20} color={baseColors.textError} />
              </TouchableOpacity>
            </View>
          )} */}

          <TextInput
            ref={nameInputRef}
            style={styles.modalInput}
            placeholder="Name (e.g. Strength A)"
            placeholderTextColor={baseColors.textPlaceholder}
            value={name}
            onChangeText={handleNameChange}
            editable={!creating}
            returnKeyType="next"
            blurOnSubmit={false}
            keyboardType="default"
            autoCorrect={false}
            autoCapitalize="words"
            importantForAutofill="no"
            selectTextOnFocus={false}
            clearButtonMode="never"
            onFocus={() => {
              nameFocusedRef.current = true;
            }}
            onBlur={() => {
              // Simply set focus to false - don't restore focus as it steals from other fields
              nameFocusedRef.current = false;
            }}
          />

          <View style={styles.descriptionContainer}>
            <TextInput
              ref={descInputRef}
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="Description (optional) - Short notes for this plan..."
              placeholderTextColor={baseColors.textPlaceholder}
              value={desc}
              onChangeText={handleDescChange}
              editable={!creating}
              multiline
              maxLength={500}
              blurOnSubmit={false}
              keyboardType="default"
              autoCorrect={true}
              autoCapitalize="sentences"
              textContentType="none"
              importantForAutofill="no"
              selectTextOnFocus={false}
              clearButtonMode="never"
            />
            <Text style={styles.characterCount}>
              {desc.length}/500
            </Text>
          </View>

          <DropdownSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={[...new Set(['General', 'Strength', 'Cardio', 'HIIT', 'Mobility', ...categoryOptions])]}
            placeholder="Category"
            disabled={creating}
            allowCustom
          />

          {/* <TextInput
            style={styles.modalInput}
            placeholder="Duration (minutes)"
            placeholderTextColor={baseColors.textPlaceholder}
            value={duration}
            onChangeText={setDuration}
            editable={!creating}
            keyboardType="number-pad"
          /> */}

          <DropdownSelect
            label="Level"
            value={level}
            onChange={setLevel}
            options={[...new Set(['Novice', 'Beginner', 'Intermediate', 'Advanced', 'Expert', ...levelOptions])]}
            placeholder="Level"
            disabled={creating}
            allowCustom
          />

          <DropdownSelect
            label="Goal"
            value={goal}
            onChange={setGoal}
            options={['Lose Weight', 'Build Muscle', 'Get Fit', 'Improve Performance', 'Shape and Tone', 'Increase Flexibility', 'Rehabilitation', 'General Fitness']}
            placeholder="Goal"
            disabled={creating}
            allowCustom
          />

          <DropdownSelect
            label="Days per week"
            value={daysPerWeek}
            onChange={(v) => setDaysPerWeek(String(v))}
            options={['1 day per week', '2 days per week', '3 days per week', '4 days per week', '5 days per week', '6 days per week', '7 days per week']}
            placeholder="Days per week"
            disabled={creating}
            allowCustom={false}
          />

          <DropdownSelect
            label="Privacy"
            value={privacy}
            onChange={setPrivacy}
            options={['Myself', 'Coach members', 'Everyone in my club']}
            placeholder="Privacy"
            disabled={creating}
            allowCustom={false}
          />

          {/* <TextInput
            ref={caloriesInputRef}
            style={styles.modalInput}
            placeholder="Calories Burned (optional)"
            placeholderTextColor={baseColors.textPlaceholder}
            value={calories}
            onChangeText={setCalories}
            editable={!creating}
            keyboardType="number-pad"
            blurOnSubmit={false}
          /> */}

          {/* <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Enable preset weights</Text>
            <Switch value={enablePresetWeights} onValueChange={setEnablePresetWeights} disabled={creating} />
          </View> */}

          <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced((p) => !p)} disabled={creating}>
            <Text style={styles.advancedToggleText}>{showAdvanced ? 'Hide advanced options' : 'Show advanced options'}</Text>
            <MaterialCommunityIcons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={20} color={baseColors.textSecondary} />
          </TouchableOpacity>

          {showAdvanced && (
            <View style={{ marginTop: 4 }}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable starting weights</Text>
                <Switch value={enablePresetWeights} onValueChange={setEnablePresetWeights} disabled={creating} />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Pro only</Text>
                <Switch value={proOnly} onValueChange={setProOnly} disabled={creating} />
              </View>

              {/* <View style={styles.thumbRow}>
                <TouchableOpacity style={styles.thumbPickBtn} onPress={pickThumbnailFromGallery} disabled={creating}>
                  <MaterialCommunityIcons name="image-plus" size={18} color={baseColors.white} />
                  <Text style={styles.thumbPickBtnText}>Choose from gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.thumbClearBtn} onPress={clearThumbnail} disabled={creating}>
                  <MaterialCommunityIcons name="close" size={18} color={baseColors.textSecondary} />
                </TouchableOpacity>
              </View>
              {thumbnailAsset?.uri ? (
                <Image source={{ uri: thumbnailAsset.uri }} style={styles.thumbPreview} />
              ) : (
                <>
                  <Text style={styles.modalHelperText}>Or paste a URL/path (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="/images/closeup.webp"
                    placeholderTextColor={baseColors.textPlaceholder}
                    value={thumbnailText}
                    onChangeText={setThumbnailText}
                    editable={!creating}
                    blurOnSubmit={false}
                  />
                </>
              )}

              <TextInput
                ref={instructionsInputRef}
                style={[styles.modalInput, styles.modalTextarea]}
                placeholder="Instructions - How to perform this workout..."
                placeholderTextColor={baseColors.textPlaceholder}
                value={instructions}
                onChangeText={setInstructions}
                editable={!creating}
                multiline
                blurOnSubmit={false}
              />

              <DropdownSelect
                label="Equipment"
                value={equipment}
                onChange={setEquipment}
                options={equipmentOptions}
                placeholder="Equipment"
                disabled={creating}
                allowCustom
              />

              <DropdownSelect
                label="Muscles Targeted"
                value={musclesTargeted}
                onChange={setMusclesTargeted}
                options={musclesOptions}
                placeholder="Muscles Targeted"
                disabled={creating}
                allowCustom
              />

              <DropdownSelect
                label="Difficulty"
                value={difficulty}
                onChange={(v) => setDifficulty(String(v))}
                options={Array.from({ length: 10 }).map((_, i) => ({ label: String(i + 1), value: String(i + 1) }))}
                placeholder="Difficulty"
                disabled={creating}
                allowCustom={false}
              />

              <DropdownSelect
                label="Rest Period (seconds)"
                value={restPeriod}
                onChange={(v) => setRestPeriod(String(v))}
                options={['15', '20', '30', '45', '60', '90', '120'].map((v) => ({ label: v, value: v }))}
                placeholder="Rest Period (seconds)"
                disabled={creating}
                allowCustom
              />

              <DropdownSelect
                label="Tags"
                value={tags}
                onChange={setTags}
                options={tagOptions}
                placeholder="Tags"
                disabled={creating}
                allowCustom
              />

              <DropdownSelect
                label="Type"
                value={type}
                onChange={setType}
                options={typeOptions}
                placeholder="Type"
                disabled={creating}
                allowCustom
              />

              <DropdownSelect
                label="Sets"
                value={sets}
                onChange={setSets}
                options={[
                  { label: '3 sets (10,10,10)', value: '10,10,10' },
                  { label: '4 sets (12,12,10,10)', value: '12,12,10,10' },
                  { label: '5 sets (5,5,5,5,5)', value: '5,5,5,5,5' },
                ]}
                placeholder="Sets"
                disabled={creating}
                allowCustom
              />

              <DropdownSelect
                label="Days per week"
                value={daysPerWeek}
                onChange={(v) => setDaysPerWeek(String(v))}
                options={['1', '2', '3', '4', '5', '6', '7'].map((v) => ({ label: v, value: v }))}
                placeholder="Days per week"
                disabled={creating}
                allowCustom={false}
              />

              <DropdownSelect
                label="Repeat"
                value={repeat}
                onChange={setRepeat}
                options={[...new Set(['weekly', 'biweekly', 'monthly', ...repeatOptions])]}
                placeholder="Repeat"
                disabled={creating}
                allowCustom
              />

              <DropdownSelect
                label="Rest Seconds"
                value={restSeconds}
                onChange={(v) => setRestSeconds(String(v))}
                options={['15', '20', '30', '45', '60', '90', '120'].map((v) => ({ label: v, value: v }))}
                placeholder="Rest Seconds"
                disabled={creating}
                allowCustom
              />

              <DropdownSelect
                label="Default Reps"
                value={defaultReps}
                onChange={setDefaultReps}
                options={[
                  { label: '10 reps (10,10,10)', value: '10,10,10' },
                  { label: '12 reps (12,12,12)', value: '12,12,12' },
                  { label: '8 reps (8,8,8,8)', value: '8,8,8,8' },
                ]}
                placeholder="Default Reps"
                disabled={creating}
                allowCustom
              /> */}
            </View>
          )}

          {/* Day Selection */}
          <View style={{ marginTop: 16 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.daysContainer}
              contentContainerStyle={styles.daysContent}
            >
              {DAYS.map((day) => {
                const isSelected = selectedDay === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                    onPress={() => setSelectedDay(day)}
                    disabled={creating}
                  >
                    <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                      {day.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Add Activity Button */}
          <TouchableOpacity
            style={styles.addActivityButton}
            onPress={() => {
              navigation.navigate('ActivityLibrary', {
                workoutId: null, // Will be created when saved
                day: selectedDay,
                workoutName: safeText(name).trim() || 'New workout',
                workoutDescription: safeText(desc).trim(),
                enablePresetWeights: !!enablePresetWeights,
                memberId,
                memberName,
                returnToCreate: true, // Flag to return to this screen
                multiSelect: true, // Enable multi-select mode
              });
            }}
            disabled={creating}
          >
            <MaterialCommunityIcons name="plus-circle" size={20} color={baseColors.white} />
            <Text style={styles.addActivityButtonText}>Add activity</Text>
          </TouchableOpacity>

          {/* Display Selected Activities for Each Day */}
          {DAYS.map((day) => {
            const activities = dayActivities[day] || [];
            if (activities.length === 0) return null;
            
            return (
              <View key={day} style={styles.dayActivitiesContainer}>
                <Text style={styles.dayActivitiesTitle}>{day}</Text>
                {activities.map((activity, index) => (
                  <View key={index} style={styles.activityItem}>
                    <View style={styles.activityItemContent}>
                      {activity.thumbnail_url ? (
                        <Image 
                          source={{ uri: toPublicAssetUrl(activity.thumbnail_url) || activity.thumbnail_url }} 
                          style={styles.activityThumbnail}
                        />
                      ) : (
                        <View style={[styles.activityThumbnail, styles.activityThumbnailPlaceholder]}>
                          <MaterialCommunityIcons name="dumbbell" size={20} color={baseColors.textTertiary} />
                        </View>
                      )}
                      <View style={styles.activityItemInfo}>
                        <Text style={styles.activityItemName} numberOfLines={1}>
                          {activity.exercise_name || activity.name || 'Activity'}
                        </Text>
                        <Text style={styles.activityItemDetails}>
                          {activity.sets || 3} sets × {activity.reps || 10} reps
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setDayActivities(prev => ({
                          ...prev,
                          [day]: prev[day].filter((_, i) => i !== index)
                        }));
                      }}
                      style={styles.removeActivityButton}
                    >
                      <MaterialCommunityIcons name="close-circle" size={20} color={baseColors.textError} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </ContainerWrapper>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: baseColors.backgroundDefault },
  safeArea: {
    backgroundColor: baseColors.white,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 50,
    paddingBottom: 70,
    paddingHorizontal: spacing.horizontal,
    flexGrow: 1,
  },
  modalLabel: {
    fontSize: typography.bodyRegular,
    fontWeight: typography.semiBold,
    color: baseColors.textPrimary,
    marginBottom: 4,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: baseColors.inputBg,
    borderRadius: borderRadius.medium,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.bodyRegular,
    color: baseColors.textPrimary,
    borderWidth: 1,
    borderColor: baseColors.cardBorder,
    marginBottom: 16,
  },
  modalTextarea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingRight: 60, // Add padding to prevent text from overlapping with character count
  },
  descriptionContainer: {
    position: 'relative',
  },
  characterCount: {
    position: 'absolute',
    top: 8,
    right: 12,
    fontSize: typography.small,
    color: baseColors.textTertiary,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  modalHelperText: {
    fontSize: typography.small,
    color: baseColors.textTertiary,
    marginBottom: 8,
    marginTop: 4,
  },
  selectInput: {
    backgroundColor: baseColors.inputBg,
    borderRadius: borderRadius.medium,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: baseColors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectText: {
    flex: 1,
    color: baseColors.textPrimary,
    fontSize: typography.body,
  },
  selectTextPlaceholder: {
    color: baseColors.textPlaceholder,
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 998,
  },
  dropdownBox: {
    marginTop: 8,
    backgroundColor: baseColors.white,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: baseColors.cardBorder,
    zIndex: 999,
    ...shadows.card,
  },
  dropdownSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: baseColors.cardBorder,
  },
  dropdownSearchInput: {
    flex: 1,
    color: baseColors.textPrimary,
    fontSize: typography.bodyRegular,
  },
  dropdownList: {
    maxHeight: 180,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownItemActive: {
    backgroundColor: baseColors.accentPrimary + '15',
  },
  dropdownItemText: {
    color: baseColors.textPrimary,
    fontSize: typography.bodyRegular,
    fontWeight: typography.semiBold,
  },
  dropdownItemTextActive: {
    color: baseColors.accentPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    marginBottom: 8,
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: typography.bodyRegular,
    fontWeight: typography.semiBold,
    color: baseColors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 0,
    backgroundColor: baseColors.inputBg,
    borderRadius: borderRadius.medium,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: baseColors.cardBorder,
  },
  advancedToggleText: {
    flex: 1,
    fontSize: typography.bodyRegular,
    fontWeight: typography.semiBold,
    color: baseColors.textPrimary,
  },
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  thumbPickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: baseColors.accentPrimary,
    borderRadius: borderRadius.medium,
    paddingVertical: 12,
    ...shadows.button,
  },
  thumbPickBtnText: {
    color: baseColors.white,
    fontSize: typography.bodyRegular,
    fontWeight: typography.semiBold,
  },
  thumbClearBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: baseColors.inputBg,
    borderWidth: 1,
    borderColor: baseColors.cardBorder,
  },
  thumbPreview: {
    width: '100%',
    height: 160,
    borderRadius: borderRadius.medium,
    marginBottom: 16,
    backgroundColor: baseColors.inputBg,
  },
  modalSecondary: {
    flex: 1,
    borderRadius: borderRadius.large,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: baseColors.inputBg,
    borderWidth: 1,
    borderColor: baseColors.cardBorder,
  },
  modalSecondaryText: {
    color: baseColors.textPrimary,
    fontSize: typography.bodyRegular,
    fontWeight: typography.semiBold,
  },
  modalPrimary: {
    flex: 1,
    borderRadius: borderRadius.large,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
  },
  modalPrimaryText: {
    color: baseColors.white,
    fontSize: typography.bodyRegular,
    fontWeight: typography.semiBold,
  },
  imageSectionContainer: {
    marginBottom: 24,
    marginTop: 0,
    paddingTop: 0,
  },
  imageSectionLabel: {
    marginTop: 0,
    marginBottom: 12,
  },
  defaultImagesContainer: {
    marginTop: 8,
    minHeight: 150,
  },
  defaultImagesContent: {
    paddingRight: spacing.horizontal,
    gap: 12,
    paddingVertical: 4,
    paddingLeft: 0,
  },
  defaultImageCard: {
    width: 150,
    height: 150,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: baseColors.cardBorder,
    marginRight: 12,
  },
  defaultImageCardSelected: {
    borderColor: baseColors.accentPrimary,
    borderWidth: 3,
  },
  defaultImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: baseColors.inputBg,
  },
  defaultImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: baseColors.inputBg,
  },
  selectedImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: baseColors.accentPrimary,
    backgroundColor: baseColors.white,
    marginBottom: 12,
  },
  galleryButtonText: {
    color: baseColors.accentPrimary,
    fontSize: typography.bodyRegular,
    fontWeight: typography.semiBold,
  },
  selectedGalleryImage: {
    position: 'relative',
    marginBottom: 12,
  },
  galleryImagePreview: {
    width: '100%',
    height: 160,
    borderRadius: borderRadius.medium,
    backgroundColor: baseColors.inputBg,
  },
  removeGalleryImage: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: baseColors.white,
    borderRadius: borderRadius.extraLarge,
    padding: 4,
  },
  daysContainer: {
    marginBottom: 16,
    maxHeight: 50,
  },
  daysContent: {
    paddingRight: spacing.horizontal,
    gap: 2,
    paddingVertical: 4,
  },
  dayChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: borderRadius.extraLarge,
    backgroundColor: baseColors.inputBg,
    borderWidth: 1,
    borderColor: baseColors.cardBorder,
    marginRight: 8,
  },
  dayChipSelected: {
    backgroundColor: baseColors.accentPrimary + '15',
    borderColor: baseColors.accentPrimary,
    borderWidth: 2,
  },
  dayChipText: {
    fontSize: typography.small,
    fontWeight: typography.semiBold,
    color: baseColors.textSecondary,
    lineHeight: typography.small * 1.2,
  },
  dayChipTextSelected: {
    color: baseColors.accentPrimary,
    fontWeight: typography.bold,
  },
  addActivitiesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: baseColors.inputBg,
    borderRadius: borderRadius.medium,
    marginBottom: 8,
  },
  addActivitiesInfoText: {
    flex: 1,
    fontSize: typography.small,
    color: baseColors.textSecondary,
    fontWeight: typography.semiBold,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginBottom: 8,
  },
  closeButton: {
    padding: 6,
    borderRadius: borderRadius.medium,
    backgroundColor: baseColors.iconBgCircle || baseColors.inputBg,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.sectionTitle,
    fontWeight: typography.bold,
    color: baseColors.textPrimary,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.medium,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: baseColors.black,
    fontSize: typography.body,
    fontWeight: typography.semiBold,
  },
  addActivityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: baseColors.accentPrimary,
    borderRadius: borderRadius.medium,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    ...shadows.button,
  },
  addActivityButtonText: {
    color: baseColors.white,
    fontSize: typography.bodyRegular,
    fontWeight: typography.semiBold,
  },
  dayActivitiesContainer: {
    marginTop: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: baseColors.white,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: baseColors.cardBorder,
  },
  dayActivitiesTitle: {
    fontSize: typography.bodyRegular,
    fontWeight: typography.bold,
    color: baseColors.textPrimary,
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 8,
    backgroundColor: baseColors.inputBg,
    borderRadius: borderRadius.medium,
  },
  activityItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  activityThumbnail: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.small,
    marginRight: 12,
    backgroundColor: baseColors.inputBg,
  },
  activityThumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: baseColors.iconBgCircle,
  },
  activityItemInfo: {
    flex: 1,
  },
  activityItemName: {
    fontSize: typography.bodyRegular,
    fontWeight: typography.semiBold,
    color: baseColors.textPrimary,
    marginBottom: 4,
  },
  activityItemDetails: {
    fontSize: typography.small,
    color: baseColors.textSecondary,
  },
  removeActivityButton: {
    padding: 4,
  },
});

export default CreateWorkoutPlanScreen;