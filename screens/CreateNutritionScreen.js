import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

const { width: screenWidth } = Dimensions.get('window');

// CRITICAL FIX: Module-level state storage to persist across component remounts
// This ensures state survives when React Navigation remounts the component
let persistentTableRows = null;
let persistentFormData = null;
let persistentSelectedPreset = null;
// CRITICAL: Store locked nutritionId in module-level storage to survive remounts
// This is separate from form data - it's the edit identity (navigation source)
let persistentNutritionId = null;
let persistentNutritionIdLocked = false;

const CreateNutritionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const isInitialMountRef = useRef(true);
  const scrollViewRef = useRef(null);
  const mealTypeGroupRefs = useRef({});
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  
  // Initialize formData from persistent storage if available
  const [formData, setFormData] = useState(() => {
    if (persistentFormData) {
      console.log('[CreateNutritionScreen] Restoring formData from persistent state');
      return persistentFormData;
    }
    return {
      name: '',
      description: '',
      instructions: '',
      calories: '',
      protein: '',
      carbs: '',
      fats: '',
      category: '',
      mealImage: null,
    };
  });
  const [foodItems, setFoodItems] = useState([]);
  const [foods, setFoods] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [searchingFoods, setSearchingFoods] = useState(false);
  const [selectedFoodModal, setSelectedFoodModal] = useState({ visible: false, rowIndex: null, type: 'nutrition_type' });
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  // Initialize from persistent storage if available (survives remounts)
  const [tableRows, setTableRows] = useState(() => {
    if (persistentTableRows) {
      console.log('[CreateNutritionScreen] Restoring from persistent state:', persistentTableRows.length, 'rows');
      return persistentTableRows;
    }
    return [];
  });
  
  // Ref to track the latest committed state (similar to CreateWorkoutScreen pattern)
  const tableRowsStateRef = useRef(tableRows);
  
  // Keep ref AND persistent storage synchronized with state - this runs AFTER state updates commit
  useEffect(() => {
    tableRowsStateRef.current = tableRows;
    // CRITICAL: Also update persistent storage to survive remounts
    persistentTableRows = tableRows;
    console.log('[CreateNutritionScreen] State ref and persistent storage updated:', tableRows.length, 'rows');
  }, [tableRows]);
  
  // Keep formData persistent storage synchronized with state
  useEffect(() => {
    persistentFormData = formData;
    console.log('[CreateNutritionScreen] FormData persistent storage updated');
  }, [formData]);
  
  const [alert, setAlert] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });
  
  // Initialize selectedPreset from persistent storage if available
  const [selectedPreset, setSelectedPreset] = useState(() => {
    if (persistentSelectedPreset !== null) {
      console.log('[CreateNutritionScreen] Restoring selectedPreset from persistent state:', persistentSelectedPreset);
      return persistentSelectedPreset;
    }
    return null;
  });
  
  // Keep selectedPreset persistent storage synchronized with state
  useEffect(() => {
    persistentSelectedPreset = selectedPreset;
    console.log('[CreateNutritionScreen] SelectedPreset persistent storage updated:', selectedPreset);
  }, [selectedPreset]);
  const lastProcessedRef = useRef({ nutritionType: null, foods: null }); // Track last processed params
  
  // CRITICAL FIX: nutritionId stored in LOCKED REF + MODULE-LEVEL STORAGE
  // This prevents ANY code from overwriting it AND survives component remounts
  const initialMealId = route.params?.assignedMealId;
  
  // Priority: Navigation params > Module-level storage > null
  // If navigation has ID, use it and lock it. Otherwise, restore from module storage if locked.
  const resolvedNutritionId = initialMealId || (persistentNutritionIdLocked ? persistentNutritionId : null);
  const shouldLock = !!initialMealId || persistentNutritionIdLocked;
  
  // Locked ref: single source of truth for nutritionId (immutable once set from navigation)
  const nutritionIdRef = useRef(resolvedNutritionId);
  const nutritionIdLockedRef = useRef(shouldLock); // Lock flag: true = immutable
  const nutritionIdInitializedRef = useRef(false); // Track if we've already initialized
  
  // Initialize nutritionId ONCE (only on first render or when navigation params change)
  // This prevents repeated initialization on every render
  if (!nutritionIdInitializedRef.current) {
    // Update module-level storage if we have a navigation ID (takes priority)
    if (initialMealId && (!persistentNutritionIdLocked || persistentNutritionId !== initialMealId)) {
      console.log('[CreateNutritionScreen] Setting persistent nutritionId from navigation:', initialMealId);
      persistentNutritionId = initialMealId;
      persistentNutritionIdLocked = true;
      nutritionIdRef.current = initialMealId;
      nutritionIdLockedRef.current = true;
    } else if (persistentNutritionIdLocked && persistentNutritionId) {
      console.log('[CreateNutritionScreen] Restoring locked nutritionId from module storage:', persistentNutritionId);
      nutritionIdRef.current = persistentNutritionId;
      nutritionIdLockedRef.current = true;
    }
    nutritionIdInitializedRef.current = true;
  }
  
  // State for rendering (synced from ref, but ref is source of truth)
  const [nutritionId, setNutritionId] = useState(() => {
    const id = nutritionIdRef.current;
    if (id) {
      console.log('[CreateNutritionScreen] Initializing nutritionId state:', id, 'locked:', nutritionIdLockedRef.current);
      return id;
    }
    return null;
  });
  
  // Derive edit mode from ID presence (always use ref - source of truth)
  const isEditMode = !!nutritionIdRef.current;
  
  // Double-submit protection
  const isSubmittingRef = useRef(false);
  
  // CRITICAL: Handle navigation params changes and sync state with ref
  // This ensures navigation params take priority and state stays in sync
  useEffect(() => {
    const currentMealId = route.params?.assignedMealId;
    const refId = nutritionIdRef.current;
    const isLocked = nutritionIdLockedRef.current;
    
    // If navigation has a new ID and it's different from current, update (navigation takes priority)
    if (currentMealId && currentMealId !== refId) {
      console.log('[CreateNutritionScreen] Navigation params changed, updating nutritionId:', currentMealId);
      nutritionIdRef.current = currentMealId;
      nutritionIdLockedRef.current = true;
      persistentNutritionId = currentMealId;
      persistentNutritionIdLocked = true;
      setNutritionId(currentMealId);
      return;
    }
    
    // Sync state with ref if out of sync
    if (refId !== nutritionId) {
      console.log('[CreateNutritionScreen] Syncing state with ref:', {
        ref: refId,
        state: nutritionId,
        locked: isLocked
      });
      setNutritionId(refId);
    }
    
    // Also ensure module storage is in sync if locked
    if (isLocked && refId && (persistentNutritionId !== refId || !persistentNutritionIdLocked)) {
      persistentNutritionId = refId;
      persistentNutritionIdLocked = true;
    }
  }, [route.params?.assignedMealId, nutritionId]); // Re-run if navigation params or state changes

  const API_BASE_URL = ENV_API_BASE_URL;

  // Quick preset macro configurations
  const macroPresets = {
    'weight_loss': {
      calories: '1800',
      protein: '150',
      carbs: '150',
      fats: '60',
    },
    'muscle_gain': {
      calories: '2800',
      protein: '200',
      carbs: '300',
      fats: '80',
    },
    'maintenance': {
      calories: '2200',
      protein: '160',
      carbs: '220',
      fats: '70',
    },
    'cutting': {
      calories: '1600',
      protein: '180',
      carbs: '100',
      fats: '55',
    },
  };

  const applyPreset = (presetKey) => {
    const preset = macroPresets[presetKey];
    if (preset) {
      setFormData(prev => ({
        ...prev,
        calories: preset.calories,
        protein: preset.protein,
        carbs: preset.carbs,
        fats: preset.fats,
      }));
      setSelectedPreset(presetKey);
    }
  };

  // Match current macros to a preset (for edit mode)
  const matchPresetFromMacros = (calories, protein, carbs, fats) => {
    if (!calories || !protein || !carbs || !fats) return null;
    
    // Convert to numbers for comparison
    const cal = parseFloat(calories) || 0;
    const prot = parseFloat(protein) || 0;
    const carb = parseFloat(carbs) || 0;
    const fat = parseFloat(fats) || 0;
    
    // Check each preset with tolerance (allow small differences)
    const tolerance = 50; // Allow 50 calories difference
    const macroTolerance = 10; // Allow 10g difference for macros
    
    for (const [presetKey, preset] of Object.entries(macroPresets)) {
      const presetCal = parseFloat(preset.calories) || 0;
      const presetProt = parseFloat(preset.protein) || 0;
      const presetCarb = parseFloat(preset.carbs) || 0;
      const presetFat = parseFloat(preset.fats) || 0;
      
      // Check if macros match within tolerance
      const caloriesMatch = Math.abs(cal - presetCal) <= tolerance;
      const proteinMatch = Math.abs(prot - presetProt) <= macroTolerance;
      const carbsMatch = Math.abs(carb - presetCarb) <= macroTolerance;
      const fatsMatch = Math.abs(fat - presetFat) <= macroTolerance;
      
      if (caloriesMatch && proteinMatch && carbsMatch && fatsMatch) {
        console.log('[CreateNutritionScreen] Matched preset:', presetKey, {
          current: { cal, prot, carb, fat },
          preset: { presetCal, presetProt, presetCarb, presetFat }
        });
        return presetKey;
      }
    }
    
    return null; // No match found
  };

  const navigateToFoodScreen = (nutritionType) => {
    // Only pass rows that have valid food_id and food_name for THIS specific meal type
    // This ensures we only show existing foods for the meal type being edited
    // Foods from other meal types are preserved in tableRows state
    const validExistingFoods = tableRows
      .filter(row => 
        row.nutrition_type === nutritionType && 
        row.food_id && 
        row.food_name
      )
      .map(row => ({
        food_id: row.food_id,
        id: row.food_id,
        name: row.food_name,
        food_name: row.food_name,
        ...(row.food_data || {}), // Include full food data if available
      }));
    
    // Navigate to FoodScreen with the meal type and existing foods for that meal type only
    // Other meal types' foods remain in tableRows state and won't be affected
    navigation.navigate('FoodScreen', {
      nutritionType: nutritionType,
      existingFoods: validExistingFoods,
    });
  };


  // Handle data coming back from FoodScreen
  // BEST APPROACH: Use functional update pattern from CreateWorkoutScreen
  useFocusEffect(
    useCallback(() => {
      const selectedFoods = route.params?.selectedFoods;
      const nutritionType = route.params?.nutritionType;
      
      // Allow empty arrays to clear foods for a meal type
      if (selectedFoods !== undefined && Array.isArray(selectedFoods) && nutritionType) {
        // Create a signature to check if we've already processed this exact update
        const foodsSignature = JSON.stringify(selectedFoods.map(f => f.id || f.food_id).sort());
        
        // Skip if we've already processed this exact combination
        if (
          lastProcessedRef.current.nutritionType === nutritionType &&
          lastProcessedRef.current.foods === foodsSignature
        ) {
          console.log('[CreateNutritionScreen] Skipping duplicate processing');
          return;
        }
        
        // CRITICAL FIX: Read from persistent storage which survives remounts
        // Priority: persistent storage > ref (never use React state directly to avoid stale closures)
        const sourceState = persistentTableRows || tableRowsStateRef.current || [];
        
        // Create a deep copy to avoid reference issues
        const currentRows = Array.isArray(sourceState) && sourceState.length > 0
          ? sourceState.map(row => ({ ...row, food_data: row.food_data ? { ...row.food_data } : null }))
          : [];
        
        console.log('[CreateNutritionScreen] ====== PROCESSING FOODS UPDATE ======');
        console.log('[CreateNutritionScreen] Nutrition Type:', nutritionType);
        console.log('[CreateNutritionScreen] Source: persistentTableRows =', !!persistentTableRows, 
          'ref =', !!tableRowsStateRef.current, 'state =', !!tableRows);
        console.log('[CreateNutritionScreen] Current rows count:', currentRows.length);
        
        // Create a completely new array - CRITICAL for React to detect the change
        const newTableRows = [];
        
        // STEP 1: Copy ALL existing rows EXCEPT the ones for the nutrition type being updated
        // Use the ref state which is guaranteed to be the latest COMMITTED state
        currentRows.forEach(row => {
          if (row.nutrition_type !== nutritionType || !row.food_id || !row.food_name) {
            // Preserve rows from other meal types or empty rows
            newTableRows.push({
              ...row,
              food_data: row.food_data ? { ...row.food_data } : null,
            });
            console.log(`[CreateNutritionScreen] ✓ Preserved food: ${row.food_name || 'empty'} for ${row.nutrition_type}`);
          }
        });
        
        // STEP 2: Add new rows for the selected nutrition type
        const newRows = selectedFoods.map((food, index) => {
          // Get default serving in grams (default to 100g if not specified)
          const defaultServing = food.serving_size_g || food.serving_grams || 
            (food.serving_size && typeof food.serving_size === 'number' ? food.serving_size : 100);
          
          // Store base nutritional values (per 100g or per base serving)
          const baseServing = defaultServing;
          const baseProtein = parseFloat(food.protein || food.protein_g || 0);
          const baseCarbs = parseFloat(food.carbs || food.carbohydrates || food.total_carb || 0);
          const baseFiber = parseFloat(food.fiber || food.fiber_g || 0);
          const baseFat = parseFloat(food.fats || food.fat || food.fat_g || 0);
          const baseSodium = parseFloat(food.sodium || food.sodium_mg || 0);
          const basePotassium = parseFloat(food.potassium || food.potassium_mg || 0);
          const baseKcal = parseFloat(food.calories || food.kcal || food.energy || 0);
          
          return {
            id: Date.now() + Math.random() + index,
            nutrition_type: nutritionType,
            food_id: food.id || food.food_id,
            food_name: food.name || food.food_name,
            serving_grams: String(defaultServing),
            // Store base values for proportional calculation
            base_serving_grams: baseServing,
            base_protein: baseProtein,
            base_carbs: baseCarbs,
            base_fiber: baseFiber,
            base_fat: baseFat,
            base_sodium: baseSodium,
            base_potassium: basePotassium,
            base_kcal: baseKcal,
            // Store full food data for nutritional info
            food_data: food ? { ...food } : null,
          };
        });
        
        newTableRows.push(...newRows);
        console.log(`[CreateNutritionScreen] ✓ Added ${newRows.length} foods for ${nutritionType}`);
        console.log('[CreateNutritionScreen] Final rows count:', newTableRows.length);
        console.log('[CreateNutritionScreen] ====== UPDATE COMPLETE ======');
        
        // Update React state - the ref will be updated by the useEffect after this commits
        setTableRows(newTableRows);
        
        // Mark as processed
        lastProcessedRef.current = {
          nutritionType: nutritionType,
          foods: foodsSignature,
        };
        
        // Clear the params to prevent re-processing
        navigation.setParams({ selectedFoods: undefined, nutritionType: undefined });
        
        // Reset the ref after a delay so new selections can be processed
        setTimeout(() => {
          lastProcessedRef.current = { nutritionType: null, foods: null };
        }, 1000);
      } else {
        // Reset ref when params are undefined
        lastProcessedRef.current = { nutritionType: null, foods: null };
      }
    }, [route.params?.selectedFoods, route.params?.nutritionType, navigation])
  );

  // Helper function to reset form and clear persistent state
  const resetForm = () => {
    // Clear persistent state (form data only, NOT edit identity)
    persistentTableRows = null;
    persistentFormData = null;
    persistentSelectedPreset = null;
    
    // Reset form fields
    setFormData({
      name: '',
      description: '',
      instructions: '',
      calories: '',
      protein: '',
      carbs: '',
      fats: '',
      category: '',
      mealImage: null,
    });
    
    // Reset table rows
    setTableRows([]);
    tableRowsStateRef.current = [];
    
    // Reset preset selection
    setSelectedPreset(null);
    
    // CRITICAL: Only reset nutritionId if it's NOT locked (not in edit mode)
    // If locked, preserve edit identity - user is editing, not creating
    if (!nutritionIdLockedRef.current) {
      console.log('[CreateNutritionScreen] Resetting nutritionId (not locked)');
      nutritionIdRef.current = null;
      persistentNutritionId = null;
      persistentNutritionIdLocked = false;
      setNutritionId(null);
    } else {
      console.log('[CreateNutritionScreen] Preserving locked nutritionId during reset:', nutritionIdRef.current);
      // Keep module-level storage intact for locked ID
    }
    
    // Reset processed ref
    lastProcessedRef.current = { nutritionType: null, foods: null };
    
    // Reset submit protection
    isSubmittingRef.current = false;
  };

  const removeFoodFromList = (rowId) => {
    setTableRows(prev => prev.filter(row => row.id !== rowId));
  };

  const handleServingInputFocus = (nutritionType) => {
    // Scroll to bring the meal type group into view when keyboard appears
    if (scrollViewRef.current) {
      // Use setTimeout to ensure keyboard has appeared and layout is updated
      setTimeout(() => {
        const groupRef = mealTypeGroupRefs.current[nutritionType];
        if (groupRef && scrollViewRef.current) {
          // Measure the group's position relative to the ScrollView content
          groupRef.measureLayout(
            scrollViewRef.current,
            (x, y, width, height) => {
              // Scroll to position with offset to ensure input is visible above keyboard
              scrollViewRef.current?.scrollTo({
                y: Math.max(0, y - 200), // Offset to show input above keyboard
                animated: true,
              });
            },
            () => {
              // Fallback: scroll to end if measure fails
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
          );
        } else {
          // Fallback: scroll to end if ref not found
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 300);
        }
      }, 300);
    }
  };

  const handleServingChange = (rowId, value) => {
    // Only allow numbers and decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    
    setTableRows(prev => prev.map(row => {
      if (row.id === rowId) {
        // Allow empty string for editing - don't force a default value
        // Only calculate if we have a valid number
        if (numericValue === '' || numericValue === '.') {
          // User is clearing/editing - store empty string, don't calculate yet
          return {
            ...row,
            serving_grams: numericValue,
            // Clear calculated values when input is empty
            calculated_protein: undefined,
            calculated_carbs: undefined,
            calculated_fiber: undefined,
            calculated_fat: undefined,
            calculated_sodium: undefined,
            calculated_potassium: undefined,
            calculated_kcal: undefined,
          };
        }
        
        // User has entered a valid number - calculate nutritional values
        const newServing = parseFloat(numericValue) || 0;
        const baseServing = row.base_serving_grams || 100;
        
        // Calculate ratio for proportional scaling
        const ratio = baseServing > 0 ? newServing / baseServing : 1;
        
        // Calculate new nutritional values based on ratio
        const newProtein = ((row.base_protein || 0) * ratio).toFixed(1);
        const newCarbs = ((row.base_carbs || 0) * ratio).toFixed(1);
        const newFiber = ((row.base_fiber || 0) * ratio).toFixed(1);
        const newFat = ((row.base_fat || 0) * ratio).toFixed(1);
        const newSodium = ((row.base_sodium || 0) * ratio).toFixed(1);
        const newPotassium = ((row.base_potassium || 0) * ratio).toFixed(1);
        const newKcal = ((row.base_kcal || 0) * ratio).toFixed(1);
        
        return {
          ...row,
          serving_grams: numericValue,
          // Store calculated values
          calculated_protein: newProtein,
          calculated_carbs: newCarbs,
          calculated_fiber: newFiber,
          calculated_fat: newFat,
          calculated_sodium: newSodium,
          calculated_potassium: newPotassium,
          calculated_kcal: newKcal,
        };
      }
      return row;
    }));
    // foodItems will be updated automatically via useEffect when tableRows changes
  };

  const getNutritionTypeLabel = (type) => {
    const labels = {
      breakfast: 'Breakfast',
      snack_morning: 'Snacks (Morning)',
      lunch: 'Lunch',
      snack_afternoon: 'Snacks (Afternoon)',
      dinner: 'Dinner',
      snack_evening: 'Snacks (Evening)',
    };
    return labels[type] || type;
  };

  // Group tableRows by nutrition type
  const groupedFoods = useMemo(() => {
    const grouped = {};
    tableRows.forEach(row => {
      if (row.food_id && row.food_name) {
        if (!grouped[row.nutrition_type]) {
          grouped[row.nutrition_type] = [];
        }
        grouped[row.nutrition_type].push(row);
      }
    });
    return grouped;
  }, [tableRows]);

  // Helper function to show modern alert
  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlert({
      visible: true,
      title,
      message,
      type,
      buttons: buttons.length > 0 ? buttons : [{ text: 'OK', onPress: () => {}, style: 'primary' }],
    });
  };

  const closeAlert = () => {
    setAlert(prev => ({ ...prev, visible: false }));
  };

  // Handle edit mode - load existing nutrition data
  // CRITICAL: nutritionId is LOCKED in ref once set from navigation
  // This effect only sets nutritionId ONCE from navigation, then preserves it
  useEffect(() => {
    const editModeParam = route.params?.editMode;
    const nutritionData = route.params?.nutritionData;
    const mealId = route.params?.assignedMealId;
    
    // ONLY set nutritionId from navigation params if:
    // 1. We have valid edit params AND
    // 2. nutritionId hasn't been locked yet (immutable once set)
    if (editModeParam && nutritionData && mealId) {
      // Check if nutritionId was already locked (immutable)
      if (!nutritionIdLockedRef.current) {
        console.log('[CreateNutritionScreen] Locking nutritionId from navigation params:', mealId);
        nutritionIdRef.current = mealId;
        nutritionIdLockedRef.current = true; // LOCK IT - never allow changes
        // Update module-level storage to survive remounts
        persistentNutritionId = mealId;
        persistentNutritionIdLocked = true;
        setNutritionId(mealId); // Sync state for rendering
      } else {
        console.log('[CreateNutritionScreen] nutritionId already locked, preserving:', nutritionIdRef.current);
        // Ensure module-level storage is in sync
        if (persistentNutritionId !== nutritionIdRef.current || !persistentNutritionIdLocked) {
          persistentNutritionId = nutritionIdRef.current;
          persistentNutritionIdLocked = true;
        }
      }
      
      // Load form data from nutrition data (this can be overwritten by persistent storage)
      // BUT nutritionId remains immutable in locked ref
      const template = nutritionData.template || nutritionData;
      const loadedCalories = template.calories || nutritionData.calories || '';
      const loadedProtein = template.protein || nutritionData.protein || '';
      const loadedCarbs = template.carbs || nutritionData.carbs || '';
      const loadedFats = template.fats || nutritionData.fats || '';
      
      setFormData({
        name: template.name || nutritionData.name || '',
        description: template.description || nutritionData.description || '',
        instructions: template.instructions || nutritionData.instructions || '',
        calories: loadedCalories,
        protein: loadedProtein,
        carbs: loadedCarbs,
        fats: loadedFats,
        category: template.category?.name || nutritionData.category?.name || '',
        mealImage: template.meal_image || nutritionData.meal_image || null,
      });
      
      // Match macros to preset and set selectedPreset
      const matchedPreset = matchPresetFromMacros(loadedCalories, loadedProtein, loadedCarbs, loadedFats);
      if (matchedPreset) {
        console.log('[CreateNutritionScreen] Setting preset from loaded macros:', matchedPreset);
        setSelectedPreset(matchedPreset);
      } else {
        console.log('[CreateNutritionScreen] No preset match found for loaded macros');
        setSelectedPreset(null);
      }
      
      // Load food items from template details
      const details = template.details || nutritionData.details || [];
      if (details.length > 0) {
        const rows = details.map((detail, index) => {
          const food = detail.food || {};
          const servingGrams = detail.serving_grams || 100;
          
          return {
            id: Date.now() + Math.random() + index,
            nutrition_type: detail.nutrition_type || 'breakfast',
            food_id: food.id || detail.food_id,
            food_name: food.name || detail.name || '',
            serving_grams: String(servingGrams),
            base_serving_grams: servingGrams,
            base_protein: parseFloat(detail.protein || food.protein || 0),
            base_carbs: parseFloat(detail.carbs || food.carbohydrate || 0),
            base_fiber: parseFloat(food.fiber || 0),
            base_fat: parseFloat(detail.fats || food.fat || 0),
            base_sodium: parseFloat(food.sodium || 0),
            base_potassium: parseFloat(food.potassium || 0),
            base_kcal: parseFloat(detail.calories || food.calories || 0),
            food_data: food,
          };
        });
        setTableRows(rows);
      }
    } else {
      // ONLY reset to create mode if we explicitly don't have edit params
      // AND nutritionId wasn't locked (preserve edit identity)
      if (!nutritionIdLockedRef.current) {
        const currentId = nutritionIdRef.current;
        if (currentId !== null) {
          console.log('[CreateNutritionScreen] No edit params and nutritionId not locked, resetting to create mode');
          nutritionIdRef.current = null;
          setNutritionId(null);
        }
      }
    }
    // NOTE: nutritionId is NOT in dependencies - we use locked ref as source of truth
    // This prevents infinite loops while preserving edit identity
  }, [route.params?.editMode, route.params?.nutritionData, route.params?.assignedMealId]);

  // Fetch foods from API
  useEffect(() => {
    fetchFoods();
  }, []);

  const fetchFoods = async () => {
    setLoadingFoods(true);
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setLoadingFoods(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/nutrition/foods/initial`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Handle different response structures
        const foodsData = data.data || data.foods || data || [];
        setFoods(foodsData);
      } else {
        console.error('Failed to fetch foods');
        showAlert('Error', 'Failed to load foods. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error fetching foods:', error);
      showAlert('Error', 'Failed to load foods. Please try again.', 'error');
    } finally {
      setLoadingFoods(false);
    }
  };

  const selectImage = () => {
    // Directly open image library
    openImageLibrary();
  };

  const openCamera = () => {
    setImageLoading(true);
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      includeBase64: false,
      saveToPhotos: false,
    };

    launchCamera(options, (response) => {
      setImageLoading(false);
      console.log('Camera response:', response);
      if (response.didCancel) {
        console.log('User cancelled camera');
      } else if (response.error) {
        console.error('Camera error:', response.error);
        showAlert('Error', 'Camera error: ' + response.error, 'error');
      } else if (response.assets && response.assets[0]) {
        const imageUri = response.assets[0].uri;
        console.log('Selected image URI:', imageUri);
        
        if (validateImage(imageUri)) {
          setFormData(prev => ({ ...prev, mealImage: imageUri }));
        } else {
          showAlert('Error', 'Invalid image selected. Please try again.', 'error');
        }
      } else {
        console.log('No image selected or invalid response');
      }
    });
  };

  const openImageLibrary = () => {
    setImageLoading(true);
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      includeBase64: false,
    };

    launchImageLibrary(options, (response) => {
      setImageLoading(false);
      console.log('Photo library response:', response);
      if (response.didCancel) {
        console.log('User cancelled photo library');
      } else if (response.error) {
        console.error('Photo library error:', response.error);
        showAlert('Error', 'Photo library error: ' + response.error, 'error');
      } else if (response.assets && response.assets[0]) {
        const imageUri = response.assets[0].uri;
        console.log('Selected image URI:', imageUri);
        
        if (validateImage(imageUri)) {
          setFormData(prev => ({ ...prev, mealImage: imageUri }));
        } else {
          showAlert('Error', 'Invalid image selected. Please try again.', 'error');
        }
      } else {
        console.log('No image selected or invalid response');
      }
    });
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, mealImage: null }));
  };

  const validateImage = (uri) => {
    // Basic validation for image URI
    if (!uri) return false;
    
    // Check if URI is valid
    if (!uri.startsWith('file://') && !uri.startsWith('content://') && !uri.startsWith('http://') && !uri.startsWith('https://')) {
      return false;
    }
    
    return true;
  };

  const getImageInfo = (uri) => {
    if (!uri) return null;
    
    try {
      const fileName = uri.split('/').pop() || 'meal_image.jpg';
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      
      return {
        fileName,
        fileExtension,
        mimeType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
      };
    } catch (error) {
      console.error('Error getting image info:', error);
      return null;
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTableRowChange = (rowId, field, value) => {
    setTableRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, [field]: value } : row
    ));
  };

  const addTableRow = () => {
    setTableRows(prev => [...prev, {
      id: Date.now(),
      nutrition_type: 'breakfast',
      food_id: '',
      food_name: '',
    }]);
  };

  const removeTableRow = (rowId) => {
    setTableRows(prev => prev.filter(row => row.id !== rowId));
  };

  const openSelectionModal = (rowIndex, type) => {
    setSelectedFoodModal({ visible: true, rowIndex, type });
  };

  const selectNutritionType = (rowIndex, nutritionType) => {
    handleTableRowChange(tableRows[rowIndex].id, 'nutrition_type', nutritionType);
    setSelectedFoodModal({ visible: false, rowIndex: null, type: 'nutrition_type' });
  };

  const selectFood = (rowIndex, food) => {
    const foodId = food.id || food.food_id || food;
    const foodName = food.name || food.food_name || '';
    handleTableRowChange(tableRows[rowIndex].id, 'food_id', foodId.toString());
    handleTableRowChange(tableRows[rowIndex].id, 'food_name', foodName);
    setSelectedFoodModal({ visible: false, rowIndex: null, type: 'nutrition_type' });
    setFoodSearchQuery(''); // Reset search when closing
    
    // Update foodItems for submission
    updateFoodItemsFromTable();
  };

  // Search foods using API endpoint
  const searchFoods = async (query) => {
    if (!query || !query.trim()) {
      setSearchResults([]);
      setSearchingFoods(false);
      return;
    }

    setSearchingFoods(true);
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setSearchingFoods(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const searchUrl = `${API_BASE_URL}/mobile/nutrition/foods/search?query=${encodeURIComponent(query.trim())}`;
      console.log('Searching foods with URL:', searchUrl);
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Search response:', data);
        // Handle response structure: { success: true, data: foods }
        const foodsData = data.data || data.foods || [];
        setSearchResults(foodsData);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Failed to search foods:', response.status, response.statusText, errorData);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching foods:', error);
      setSearchResults([]);
    } finally {
      setSearchingFoods(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    if (!foodSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchFoods(foodSearchQuery);
    }, 500); // 500ms debounce delay

    return () => clearTimeout(timeoutId);
  }, [foodSearchQuery]);

  // Memoized filtered foods - use search results if query exists, otherwise use initial foods
  const filteredFoods = useMemo(() => {
    if (!foodSearchQuery.trim()) {
      return foods;
    }
    return searchResults;
  }, [foods, foodSearchQuery, searchResults]);

  const updateFoodItemsFromTable = () => {
    const items = tableRows
      .filter(row => row.food_id && row.nutrition_type)
      .map(row => {
        // Use calculated values if available, otherwise use base values
        const protein = row.calculated_protein !== undefined 
          ? row.calculated_protein 
          : (row.base_protein || 0);
        const carbs = row.calculated_carbs !== undefined 
          ? row.calculated_carbs 
          : (row.base_carbs || 0);
        const fats = row.calculated_fat !== undefined 
          ? row.calculated_fat 
          : (row.base_fat || 0);
        const calories = row.calculated_kcal !== undefined 
          ? row.calculated_kcal 
          : (row.base_kcal || 0);
        const servingGrams = parseFloat(row.serving_grams) || 100;
        
        return {
          food_id: row.food_id,
          nutrition_type: row.nutrition_type,
          quantity: String(servingGrams / 100), // Convert grams to quantity (e.g., 150g = 1.5)
          calories: String(calories),
          protein: String(protein),
          carbs: String(carbs),
          fats: String(fats),
          serving_grams: String(servingGrams), // Save the serving size in grams
        };
      });
    setFoodItems(items);
  };

  // Update foodItems whenever tableRows change
  useEffect(() => {
    updateFoodItemsFromTable();
  }, [tableRows]);

  const handleSubmit = async () => {
    // Double-submit protection
    if (isSubmittingRef.current) {
      console.log('[CreateNutritionScreen] Submit already in progress, ignoring duplicate call');
      return;
    }

    if (!formData.name) {
      showAlert('Error', 'Please fill in the required fields (Name)', 'error');
      return;
    }

    if (foodItems.length === 0) {
      showAlert('Error', 'Please add at least one food item', 'error');
      return;
    }

    // Validate image if present
    if (formData.mealImage && !validateImage(formData.mealImage)) {
      showAlert('Error', 'Invalid image format. Please select a valid image.', 'error');
      return;
    }

    // Set submitting flag
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      // Get the stored token with the correct key (userToken, not token)
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        showAlert('Error', 'Authentication required. Please login again.', 'error');
        setLoading(false);
        return;
      }

      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Create FormData for multipart/form-data if image is present
      let requestBody;
      let headers;

      // Check if we have a new image to upload (local file, not URL)
      // New images from gallery/camera: file://, content://, ph:// (iOS Photos)
      // Existing images from server: http://, https://
      const imageUri = formData.mealImage;
      const isLocalFile = imageUri && (
        imageUri.startsWith('file://') || 
        imageUri.startsWith('content://') || 
        imageUri.startsWith('ph://') ||
        imageUri.startsWith('assets-library://')
      );
      const isServerUrl = imageUri && (
        imageUri.startsWith('http://') || 
        imageUri.startsWith('https://')
      );
      const hasNewImage = isLocalFile; // Only local files need to be uploaded
      
      console.log('[CreateNutritionScreen] Image detection:', {
        imageUri: imageUri ? imageUri.substring(0, 50) + '...' : null,
        isLocalFile,
        isServerUrl,
        hasNewImage
      });
      
      if (hasNewImage) {
        // Use FormData for image upload (new image file)
        const formDataToSend = new FormData();
        formDataToSend.append('name', formData.name.trim());
        formDataToSend.append('description', formData.description.trim() || '');
        formDataToSend.append('instructions', formData.instructions.trim() || '');
        formDataToSend.append('calories', formData.calories || '0');
        formDataToSend.append('protein', formData.protein || '0');
        formDataToSend.append('carbs', formData.carbs || '0');
        formDataToSend.append('fats', formData.fats || '0');
        
        // Add food items as individual array items
        foodItems.forEach((item, index) => {
          formDataToSend.append(`food_items[${index}][food_id]`, parseInt(item.food_id) || 1);
          formDataToSend.append(`food_items[${index}][nutrition_type]`, item.nutrition_type);
          formDataToSend.append(`food_items[${index}][quantity]`, parseFloat(item.quantity) || 1.0);
          formDataToSend.append(`food_items[${index}][calories]`, parseFloat(item.calories) || 0);
          formDataToSend.append(`food_items[${index}][protein]`, parseFloat(item.protein) || 0);
          formDataToSend.append(`food_items[${index}][carbs]`, parseFloat(item.carbs) || 0);
          formDataToSend.append(`food_items[${index}][fats]`, parseFloat(item.fats) || 0);
          if (item.serving_grams) {
            formDataToSend.append(`food_items[${index}][serving_grams]`, parseFloat(item.serving_grams) || 100);
          }
        });

        // Add new image file
        const imageInfo = getImageInfo(imageUri);
        if (imageInfo) {
          console.log('[CreateNutritionScreen] Adding image to FormData:', {
            uri: imageUri.substring(0, 50) + '...',
            type: imageInfo.mimeType,
            name: imageInfo.fileName
          });
          formDataToSend.append('meal_image', {
            uri: imageUri,
            type: imageInfo.mimeType,
            name: imageInfo.fileName,
          });
        } else {
          console.warn('[CreateNutritionScreen] Could not get image info for:', imageUri);
        }

        // Debug: Log FormData contents (React Native compatible)
        console.log('[CreateNutritionScreen] FormData created with new image:', {
          foodItemsCount: foodItems.length,
          imageUri: formData.mealImage ? formData.mealImage.substring(0, 50) + '...' : null,
          imageInfo: imageInfo
        });

        requestBody = formDataToSend;
        // CRITICAL: Don't set Content-Type for FormData - React Native will set it automatically with boundary
        // Setting it manually can break the multipart/form-data upload
        headers = {
          'Accept': 'application/json',
          'Authorization': authHeader,
          // Content-Type will be set automatically by React Native with boundary
        };
      } else {
        // Use JSON for requests without new image (existing image URL or no image)
        // CRITICAL: Always send all fields including food_items for updates
        requestBody = JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || '',
          instructions: formData.instructions.trim() || '',
          calories: formData.calories || '0',
          protein: formData.protein || '0',
          carbs: formData.carbs || '0',
          fats: formData.fats || '0',
          food_items: foodItems.map(item => ({
            food_id: parseInt(item.food_id) || 1,
            nutrition_type: item.nutrition_type,
            quantity: parseFloat(item.quantity) || 1.0,
            calories: parseFloat(item.calories) || 0,
            protein: parseFloat(item.protein) || 0,
            carbs: parseFloat(item.carbs) || 0,
            fats: parseFloat(item.fats) || 0,
            serving_grams: item.serving_grams ? parseFloat(item.serving_grams) : null,
          })),
        });
        headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        };
      }

      // Single source of truth: derive edit mode from LOCKED REF (not state)
      // If nutritionId exists → UPDATE, otherwise → CREATE
      // CRITICAL: Always read from ref (source of truth), not state
      const currentNutritionId = nutritionIdRef.current;
      const isEdit = !!currentNutritionId;
      const endpoint = isEdit 
        ? `${API_BASE_URL}/mobile/nutrition/assigned-meals/${currentNutritionId}`
        : `${API_BASE_URL}/mobile/nutrition`;
      const method = isEdit ? 'PUT' : 'POST';
      
      // Debug: Log request details
      console.log('[CreateNutritionScreen] Submit Request:', {
        mode: isEdit ? 'UPDATE' : 'CREATE',
        method: method,
        endpoint: endpoint,
        nutritionId: currentNutritionId,
        nutritionIdLocked: nutritionIdLockedRef.current,
        hasNewImage: hasNewImage,
        hasExistingImageUrl: imageUri && imageUri.startsWith('http'),
        foodItemsCount: foodItems.length,
        formData: {
          name: formData.name,
          description: formData.description?.substring(0, 50) + (formData.description?.length > 50 ? '...' : ''),
          calories: formData.calories,
          protein: formData.protein,
          carbs: formData.carbs,
          fats: formData.fats,
        }
      });
      
      if (hasNewImage) {
        console.log('[CreateNutritionScreen] Request body type: FormData with new image file');
      } else {
        console.log('[CreateNutritionScreen] Request body type: JSON (no new image)');
        if (!isEdit) {
          // Only log full body for CREATE to avoid cluttering logs
          console.log('[CreateNutritionScreen] Request body:', requestBody);
        }
      }
      
      // CRITICAL SAFETY CHECK: Prevent accidental CREATE if ID was locked
      if (nutritionIdLockedRef.current && !currentNutritionId) {
        console.error('[CreateNutritionScreen] ERROR: nutritionId was locked but ref is null!');
        throw new Error('Edit identity lost. Cannot proceed with update.');
      }
      
      // Additional safety: If locked but state doesn't match ref, sync it
      if (nutritionIdLockedRef.current && nutritionId !== currentNutritionId) {
        console.warn('[CreateNutritionScreen] State out of sync with ref, syncing...', {
          state: nutritionId,
          ref: currentNutritionId
        });
        setNutritionId(currentNutritionId);
      }
      
      const response = await fetch(endpoint, {
        method: method,
        headers,
        body: requestBody,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.message || errorData.detail || 'Failed to create nutrition plan');
      }

      const data = await response.json();
      console.log(isEdit ? 'Nutrition plan updated successfully:' : 'Nutrition plan created successfully:', data);
      
      // Clear form and persistent state after successful creation/update
      resetForm();
      
      showAlert('Success', isEdit ? 'Nutrition plan updated successfully!' : 'Nutrition plan created successfully!', 'success', [
        { text: 'OK', onPress: () => navigation.replace('NutritionScreen'), style: 'primary' }
      ]);
    } catch (error) {
      console.error('Error creating nutrition plan:', error);
      showAlert('Error', error.message || 'Failed to create nutrition plan. Please try again.', 'error');
    } finally {
      setLoading(false);
      // Reset submit protection flag
      isSubmittingRef.current = false;
    }
  };

  return (
    <View style={styles.container}>
      {/* Custom Header matching CreateWorkoutScreen style */}
      <View style={[styles.headerFixed, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            // Reset form when going back to prevent filled form on return
            resetForm();
            
            // Navigate to NutritionScreen
            navigation.replace('NutritionScreen');
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#6b6b6b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Meal Plan' : 'Create Meal Plan'}</Text>
        <TouchableOpacity 
          onPress={handleSubmit} 
          style={[styles.saveButtonHeader, loading && styles.saveButtonDisabled]}
          disabled={loading}
        >
          <Text style={styles.saveButtonHeaderText}>{loading ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            bounces={false}
          >
            {/* Quick Presets Section */}
            <View style={[styles.inputSection, { marginBottom: 20 }]}>
              <View style={styles.sectionLabelRow}>
                <MaterialCommunityIcons name="lightning-bolt" size={14} color="#222" />
                <Text style={styles.sectionLabel}>Quick Presets</Text>
              </View>
              <View style={styles.presetsContainer}>
                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    selectedPreset === 'weight_loss' && styles.presetButtonActive
                  ]}
                  onPress={() => applyPreset('weight_loss')}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text style={[
                    styles.presetButtonText,
                    selectedPreset === 'weight_loss' && styles.presetButtonTextActive
                  ]}>
                    Weight Loss
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    selectedPreset === 'muscle_gain' && styles.presetButtonActive
                  ]}
                  onPress={() => applyPreset('muscle_gain')}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text style={[
                    styles.presetButtonText,
                    selectedPreset === 'muscle_gain' && styles.presetButtonTextActive
                  ]}>
                    Muscle Gain
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    selectedPreset === 'maintenance' && styles.presetButtonActive
                  ]}
                  onPress={() => applyPreset('maintenance')}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text style={[
                    styles.presetButtonText,
                    selectedPreset === 'maintenance' && styles.presetButtonTextActive
                  ]}>
                    Maintenance
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.presetButton,
                    selectedPreset === 'cutting' && styles.presetButtonActive
                  ]}
                  onPress={() => applyPreset('cutting')}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text style={[
                    styles.presetButtonText,
                    selectedPreset === 'cutting' && styles.presetButtonTextActive
                  ]}>
                    Cutting
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Meal Plan Name */}
            <View style={styles.inputSection}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Meal Plan Name *</Text>
              </View>
              <View style={styles.inputWithIcon}>
                <MaterialCommunityIcons name="tag" size={16} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.modalInputModern}
                  value={formData.name}
                  onChangeText={(value) => handleInputChange('name', value)}
                  placeholder="e.g., High Protein Meal Plan"
                  placeholderTextColor="#bbb"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Description */}
            <View style={styles.inputSection}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Description (Optional)</Text>
              </View>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={[styles.modalInputModern, styles.modalTextAreaModern]}
                  value={formData.description}
                  onChangeText={(value) => handleInputChange('description', value)}
                  placeholder="Brief description of this meal plan..."
                  placeholderTextColor="#bbb"
                  multiline
                  numberOfLines={3}
                  editable={!loading}
                  maxLength={500}
                />
              </View>
              <Text style={styles.characterCount}>
                {formData.description.length}/500
              </Text>
            </View>

            {/* Instructions */}
            <View style={styles.inputSection}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Instructions (Optional)</Text>
              </View>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={[styles.modalInputModern, styles.modalTextAreaModern]}
                  value={formData.instructions}
                  onChangeText={(value) => handleInputChange('instructions', value)}
                  placeholder="Preparation or eating instructions for this meal plan..."
                  placeholderTextColor="#bbb"
                  multiline
                  numberOfLines={4}
                  editable={!loading}
                  maxLength={2000}
                />
              </View>
              <Text style={styles.characterCount}>
                {formData.instructions.length}/2000
              </Text>
            </View>

            {/* Meal Image Section */}
            <View style={styles.inputSection}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Meal Image</Text>
              </View>
              {formData.mealImage ? (
                <View style={styles.selectedGalleryImage}>
                  <Image source={{ uri: formData.mealImage }} style={styles.galleryImagePreview} />
                  <TouchableOpacity style={styles.removeGalleryImage} onPress={removeImage} disabled={loading}>
                    <MaterialCommunityIcons name="close-circle" size={20} color="#F44336" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.galleryButton} 
                  onPress={selectImage}
                  disabled={loading || imageLoading}
                >
                  {imageLoading ? (
                    <ActivityIndicator size="small" color="#222" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="image-plus" size={18} color="#222" />
                      <Text style={styles.galleryButtonText}>Choose meal image</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Target Macros */}
            <View style={styles.inputSection}>
              <View style={styles.sectionLabelRow}>
                <MaterialCommunityIcons name="chart-line" size={14} color="#222" />
                <Text style={styles.sectionLabel}>Target Macros</Text>
              </View>
              <View style={styles.macrosGrid}>
                <View style={styles.macroCard}>
                  <View style={styles.macroIconContainer}>
                    <MaterialCommunityIcons name="fire" size={16} color="#222" />
                  </View>
                  <Text style={styles.macroLabel}>Calories</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={formData.calories}
                    onChangeText={(value) => {
                      const numericValue = value.replace(/[^0-9]/g, '');
                      handleInputChange('calories', numericValue);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#bbb"
                    editable={!loading}
                  />
                </View>
                <View style={styles.macroCard}>
                  <View style={styles.macroIconContainer}>
                    <MaterialCommunityIcons name="egg" size={16} color="#222" />
                  </View>
                  <Text style={styles.macroLabel}>Protein (g)</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={formData.protein}
                    onChangeText={(value) => {
                      const numericValue = value.replace(/[^0-9]/g, '');
                      handleInputChange('protein', numericValue);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#bbb"
                    editable={!loading}
                  />
                </View>
                <View style={styles.macroCard}>
                  <View style={styles.macroIconContainer}>
                    <MaterialCommunityIcons name="grain" size={16} color="#222" />
                  </View>
                  <Text style={styles.macroLabel}>Carbs (g)</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={formData.carbs}
                    onChangeText={(value) => {
                      const numericValue = value.replace(/[^0-9]/g, '');
                      handleInputChange('carbs', numericValue);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#bbb"
                    editable={!loading}
                  />
                </View>
                <View style={styles.macroCard}>
                  <View style={styles.macroIconContainer}>
                    <MaterialCommunityIcons name="oil" size={16} color="#222" />
                  </View>
                  <Text style={styles.macroLabel}>Fats (g)</Text>
                  <TextInput
                    style={styles.macroInput}
                    value={formData.fats}
                    onChangeText={(value) => {
                      const numericValue = value.replace(/[^0-9]/g, '');
                      handleInputChange('fats', numericValue);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#bbb"
                    editable={!loading}
                  />
                </View>
              </View>
            </View>

            {/* Meal Type Selection Section */}
            <View style={styles.inputSection}>
              <View style={styles.sectionLabelRow}>
                <MaterialCommunityIcons name="calendar-clock" size={14} color="#222" />
                <Text style={styles.sectionLabel}>Select Meal Type</Text>
              </View>
              <View style={styles.mealTypesContainer}>
                <TouchableOpacity
                  style={styles.mealTypeButton}
                  onPress={() => navigateToFoodScreen('breakfast')}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <MaterialCommunityIcons name="weather-sunny" size={18} color="#222" style={{ marginRight: 8 }} />
                  <Text style={styles.mealTypeButtonText}>Breakfast</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mealTypeButton}
                  onPress={() => navigateToFoodScreen('snack_morning')}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <MaterialCommunityIcons name="coffee" size={18} color="#222" style={{ marginRight: 8 }} />
                  <Text style={styles.mealTypeButtonText}>Snacks (Morning)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mealTypeButton}
                  onPress={() => navigateToFoodScreen('lunch')}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <MaterialCommunityIcons name="weather-sunset" size={18} color="#222" style={{ marginRight: 8 }} />
                  <Text style={styles.mealTypeButtonText}>Lunch</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mealTypeButton}
                  onPress={() => navigateToFoodScreen('snack_afternoon')}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <MaterialCommunityIcons name="cookie" size={18} color="#222" style={{ marginRight: 8 }} />
                  <Text style={styles.mealTypeButtonText}>Snacks (Afternoon)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mealTypeButton}
                  onPress={() => navigateToFoodScreen('dinner')}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <MaterialCommunityIcons name="weather-night" size={18} color="#222" style={{ marginRight: 8 }} />
                  <Text style={styles.mealTypeButtonText}>Dinner</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.mealTypeButton}
                  onPress={() => navigateToFoodScreen('snack_evening')}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <MaterialCommunityIcons name="moon-waning-crescent" size={18} color="#222" style={{ marginRight: 8 }} />
                  <Text style={styles.mealTypeButtonText}>Snacks (Evening)</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Selected Foods Display Section */}
            {Object.keys(groupedFoods).length > 0 && (
              <View style={styles.inputSection}>
                <View style={styles.sectionLabelRow}>
                  <MaterialCommunityIcons name="food-fork-drink" size={14} color="#222" />
                  <Text style={styles.sectionLabel}>Selected Foods</Text>
                </View>
                
                {Object.entries(groupedFoods).map(([nutritionType, foods]) => (
                  <View 
                    key={nutritionType} 
                    ref={(ref) => {
                      if (ref) {
                        mealTypeGroupRefs.current[nutritionType] = ref;
                      }
                    }}
                    style={styles.mealTypeGroup}
                  >
                    <View style={styles.mealTypeHeader}>
                      <MaterialCommunityIcons 
                        name={
                          nutritionType === 'breakfast' ? 'weather-sunny' :
                          nutritionType === 'snack_morning' ? 'coffee' :
                          nutritionType === 'lunch' ? 'weather-sunset' :
                          nutritionType === 'snack_afternoon' ? 'cookie' :
                          nutritionType === 'dinner' ? 'weather-night' :
                          'moon-waning-crescent'
                        } 
                        size={16} 
                        color="#222" 
                      />
                      <Text style={styles.mealTypeGroupTitle}>{getNutritionTypeLabel(nutritionType)}</Text>
                    </View>
                    
                    {/* Scrollable Table Container */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                      <View>
                        {/* Table Header */}
                        <View style={styles.foodsTableHeader}>
                          <View style={styles.foodsTableHeaderCellFoodName}>
                            <Text style={styles.foodsTableHeaderText}>Food Name</Text>
                          </View>
                          <View style={styles.foodsTableHeaderCellLabel}>
                            <Text style={styles.foodsTableHeaderText}>Label Serving</Text>
                          </View>
                          <View style={styles.foodsTableHeaderCell}>
                            <Text style={styles.foodsTableHeaderText}>Protein</Text>
                          </View>
                          <View style={styles.foodsTableHeaderCell}>
                            <Text style={styles.foodsTableHeaderText}>Total Carb</Text>
                          </View>
                          <View style={styles.foodsTableHeaderCell}>
                            <Text style={styles.foodsTableHeaderText}>Net Carbs</Text>
                          </View>
                          <View style={styles.foodsTableHeaderCell}>
                            <Text style={styles.foodsTableHeaderText}>Fat</Text>
                          </View>
                          <View style={styles.foodsTableHeaderCell}>
                            <Text style={styles.foodsTableHeaderText}>Fiber</Text>
                          </View>
                          <View style={styles.foodsTableHeaderCell}>
                            <Text style={styles.foodsTableHeaderText}>Sod (mg)</Text>
                          </View>
                          <View style={styles.foodsTableHeaderCell}>
                            <Text style={styles.foodsTableHeaderText}>Potass (mg)</Text>
                          </View>
                          <View style={styles.foodsTableHeaderCell}>
                            <Text style={styles.foodsTableHeaderText}>Kcal</Text>
                          </View>
                          <View style={styles.foodsTableHeaderCell}>
                            <Text style={styles.foodsTableHeaderText}>Notes</Text>
                          </View>
                          <View style={styles.foodsTableHeaderCellAction}>
                            <Text style={styles.foodsTableHeaderText}>Actions</Text>
                          </View>
                        </View>

                        {/* Table Rows */}
                        {foods.map((row) => {
                      const foodData = row.food_data || {};
                      // Allow empty string for editing - only default to '100' if value is null/undefined
                      const servingGrams = row.serving_grams !== null && row.serving_grams !== undefined 
                        ? String(row.serving_grams) 
                        : '100';
                      
                      // Use calculated values if available (after serving change), otherwise use base values
                      const protein = row.calculated_protein !== undefined 
                        ? row.calculated_protein 
                        : (foodData.protein || foodData.protein_g || '0');
                      const totalCarb = row.calculated_carbs !== undefined 
                        ? row.calculated_carbs 
                        : (foodData.carbs || foodData.carbohydrates || foodData.total_carb || '0');
                      const fiber = row.calculated_fiber !== undefined 
                        ? row.calculated_fiber 
                        : (foodData.fiber || foodData.fiber_g || '0');
                      const netCarbs = (parseFloat(totalCarb) - parseFloat(fiber)).toFixed(1);
                      const fat = row.calculated_fat !== undefined 
                        ? row.calculated_fat 
                        : (foodData.fats || foodData.fat || foodData.fat_g || '0');
                      const sodium = row.calculated_sodium !== undefined 
                        ? row.calculated_sodium 
                        : (foodData.sodium || foodData.sodium_mg || '0');
                      const potassium = row.calculated_potassium !== undefined 
                        ? row.calculated_potassium 
                        : (foodData.potassium || foodData.potassium_mg || '0');
                      const kcal = row.calculated_kcal !== undefined 
                        ? row.calculated_kcal 
                        : (foodData.calories || foodData.kcal || foodData.energy || '0');
                      const notes = foodData.notes || foodData.description || '';

                      return (
                        <View key={row.id} style={styles.foodsTableRow}>
                          <View style={styles.foodsTableCellFoodName}>
                            <Text style={styles.foodsTableFoodNameText} numberOfLines={2}>
                              {row.food_name}
                            </Text>
                          </View>
                          <View style={styles.foodsTableCellLabel}>
                            <View style={styles.foodsTableServingContainer}>
                              <TextInput
                                style={styles.foodsTableServingInput}
                                value={servingGrams}
                                onChangeText={(value) => handleServingChange(row.id, value)}
                                onFocus={() => handleServingInputFocus(nutritionType)}
                                keyboardType="decimal-pad"
                                placeholder="100"
                                placeholderTextColor="#999"
                                editable={!loading}
                              />
                              <Text style={styles.foodsTableServingUnit}>g</Text>
                            </View>
                          </View>
                          <View style={styles.foodsTableCell}>
                            <Text style={styles.foodsTableText}>{protein}g</Text>
                          </View>
                          <View style={styles.foodsTableCell}>
                            <Text style={styles.foodsTableText}>{totalCarb}g</Text>
                          </View>
                          <View style={styles.foodsTableCell}>
                            <Text style={styles.foodsTableText}>{netCarbs}g</Text>
                          </View>
                          <View style={styles.foodsTableCell}>
                            <Text style={styles.foodsTableText}>{fat}g</Text>
                          </View>
                          <View style={styles.foodsTableCell}>
                            <Text style={styles.foodsTableText}>{fiber}g</Text>
                          </View>
                          <View style={styles.foodsTableCell}>
                            <Text style={styles.foodsTableText}>{sodium}mg</Text>
                          </View>
                          <View style={styles.foodsTableCell}>
                            <Text style={styles.foodsTableText}>{potassium}mg</Text>
                          </View>
                          <View style={styles.foodsTableCell}>
                            <Text style={styles.foodsTableText}>{kcal}</Text>
                          </View>
                          <View style={styles.foodsTableCell}>
                            <Text style={styles.foodsTableText} numberOfLines={2}>
                              {notes || '-'}
                            </Text>
                          </View>
                          <View style={styles.foodsTableCellAction}>
                            <TouchableOpacity
                              style={styles.removeFoodButton}
                              onPress={() => removeFoodFromList(row.id)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                      </View>
                    </ScrollView>
                  </View>
                ))}
              </View>
            )}

          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Modern Alert */}
      <ModernAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={closeAlert}
        buttons={alert.buttons}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  headerFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8f2',
    paddingHorizontal: 20,
    paddingTop: '5%',
    paddingBottom: 10,
  },
  backButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#eceee7',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
    textAlign: 'center',
  },
  saveButtonHeader: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonHeaderText: {
    color: '#222',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  scrollContent: {
    paddingBottom: 70,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  inputSection: {
    marginBottom: 20,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    minHeight: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  modalInputModern: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
    fontWeight: '500',
  },
  modalTextAreaModern: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
    paddingBottom: 12,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  macroCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  macroIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  macroInput: {
    width: '100%',
    backgroundColor: '#f7f8f2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#222',
    backgroundColor: '#fff',
    borderStyle: 'dashed',
  },
  galleryButtonText: {
    color: '#222',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedGalleryImage: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  galleryImagePreview: {
    width: '100%',
    height: 180,
    backgroundColor: '#f0f0f0',
  },
  removeGalleryImage: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  addFoodForm: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  foodInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  foodInputHalf: {
    width: '48%',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  addFoodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginTop: 16,
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addFoodButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addFoodButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  foodItemsList: {
    marginTop: 20,
  },
  foodItemCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  foodItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  foodItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    flex: 1,
  },
  foodItemServing: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  foodItemNutrition: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodItemCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  foodItemMacros: {
    fontSize: 12,
    color: '#888',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#888',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f7f8f2',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tableHeaderCellNutrition: {
    width: 130,
    paddingHorizontal: 8,
  },
  tableHeaderCellFood: {
    flex: 1,
    paddingHorizontal: 8,
  },
  tableHeaderCellAction: {
    width: 50,
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 56,
  },
  tableCellNutrition: {
    width: 130,
    paddingHorizontal: 6,
  },
  tableCellFood: {
    flex: 1,
    paddingHorizontal: 6,
  },
  tableCellAction: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tablePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  tablePickerText: {
    fontSize: 14,
    color: '#222',
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  placeholderText: {
    color: '#999',
    fontWeight: '400',
  },
  removeRowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  addRowButtonText: {
    color: '#222',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxHeight: '85%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  modalBody: {
    maxHeight: 500,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#fff',
    fontWeight: '500',
  },
  modalOption: {
    padding: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    minHeight: 56,
    justifyContent: 'center',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
    lineHeight: 20,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noFoodsText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  presetButton: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  presetButtonActive: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  presetButtonTextActive: {
    color: '#fff',
  },
  mealTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  mealTypeButton: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    flexDirection: 'row',
  },
  mealTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  mealTypeGroup: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  mealTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  mealTypeGroupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginLeft: 8,
  },
  foodsTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f7f8f2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 1000,
  },
  foodsTableHeaderCellFoodName: {
    width: 150,
    paddingHorizontal: 6,
  },
  foodsTableHeaderCellLabel: {
    width: 100,
    paddingHorizontal: 6,
  },
  foodsTableHeaderCell: {
    width: 70,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  foodsTableHeaderCellAction: {
    width: 60,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  foodsTableHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  foodsTableRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
    minHeight: 60,
    minWidth: 1000,
  },
  foodsTableCellFoodName: {
    width: 150,
    paddingHorizontal: 6,
  },
  foodsTableCellLabel: {
    width: 100,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodsTableServingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  foodsTableCell: {
    width: 70,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodsTableCellAction: {
    width: 60,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodsTableFoodNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#222',
  },
  foodsTableLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  foodsTableServingInput: {
    fontSize: 12,
    color: '#222',
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#fff',
    minWidth: 50,
    textAlign: 'center',
    flex: 1,
  },
  foodsTableServingText: {
    fontSize: 10,
    color: '#666',
  },
  foodsTableServingUnit: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  foodsTableText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  removeFoodButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },
});

export default CreateNutritionScreen;
