import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Dimensions, Image, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { DataCache } from '../utils/dataCache';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

const { width: screenWidth } = Dimensions.get('window');



const NutritionScreen = () => {
  const { userData, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [nutritionPlans, setNutritionPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filteredNutritionPlans, setFilteredNutritionPlans] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [assignedMeals, setAssignedMeals] = useState([]);
  const [loadingAssignedMeals, setLoadingAssignedMeals] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedCaloriesRange, setSelectedCaloriesRange] = useState(null);
  const [selectedMacronutrientFocus, setSelectedMacronutrientFocus] = useState([]);
  const navigation = useNavigation();
  const isInitialMount = useRef(true);

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

  const handleNutritionCardPress = async (nutrition) => {
    // Check if this is an assigned meal (has template_id or template object)
    // Assigned meals already have complete template data, so we can navigate directly
    const isAssignedMeal = nutrition.template_id || nutrition.template || (nutrition.start_date && nutrition.template_id);
    
    if (isAssignedMeal) {
      // For assigned meals, use the template_id to fetch full template details
      // Or if template data is already complete, navigate directly
      const templateId = nutrition.template_id || nutrition.template?.id;
      
      if (templateId && nutrition.template?.details) {
        // Template data is already loaded, navigate directly
        navigation.navigate('NutritionDetails', { nutrition: nutrition });
        return;
      }
      
      // If template data is incomplete, fetch it using template_id
      if (templateId) {
        try {
          const userToken = await AsyncStorage.getItem('userToken');
          if (!userToken) {
            navigation.navigate('NutritionDetails', { nutrition: nutrition });
            return;
          }

          let authHeader = userToken;
          if (!userToken.startsWith('Bearer ')) {
            authHeader = `Bearer ${userToken}`;
          }

          const response = await fetch(`${API_BASE_URL}/mobile/nutrition/${templateId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader,
            },
          });

          if (response.ok) {
            const data = await response.json();
            const detailedTemplate = data.data || data;
            
            // Merge assigned meal data with template details
            const mergedNutrition = {
              ...nutrition,
              template: {
                ...detailedTemplate,
                ...nutrition.template,
              },
              // Preserve assigned meal specific fields
              start_date: nutrition.start_date,
              end_date: nutrition.end_date,
              date: nutrition.date,
              is_assigned: true,
              // Preserve image fields from original nutrition
              meal_image: nutrition.meal_image || nutrition.template?.meal_image || detailedTemplate.meal_image,
              thumbnail: nutrition.thumbnail || nutrition.template?.meal_image || detailedTemplate.meal_image,
            };

            navigation.navigate('NutritionDetails', { nutrition: mergedNutrition });
          } else {
            // Fallback: navigate with existing data
            navigation.navigate('NutritionDetails', { nutrition: nutrition });
          }
        } catch (error) {
          // Fallback: navigate with existing data
          navigation.navigate('NutritionDetails', { nutrition: nutrition });
        }
        return;
      }
      
      // No template_id, navigate with existing data
      navigation.navigate('NutritionDetails', { nutrition: nutrition });
      return;
    }
    
    // For regular nutrition plans (MealPlanTemplate), check if we already have details
    // If details are already present, navigate directly without fetching
    if (nutrition.id) {
      // Check if we already have sufficient data (details field)
      if (nutrition.details && Array.isArray(nutrition.details) && nutrition.details.length > 0) {
        // We already have details, navigate directly
        navigation.navigate('NutritionDetails', { nutrition: nutrition });
        return;
      }

      // If we don't have details, try to fetch them
      try {
        const userToken = await AsyncStorage.getItem('userToken');
        if (!userToken) {
          // Fallback: navigate with existing data
          navigation.navigate('NutritionDetails', { nutrition: nutrition });
          return;
        }

        let authHeader = userToken;
        if (!userToken.startsWith('Bearer ')) {
          authHeader = `Bearer ${userToken}`;
        }

        const response = await fetch(`${API_BASE_URL}/mobile/nutrition/${nutrition.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const detailedNutrition = data.data || data;
          
          // Merge with original nutrition data to preserve any card-specific fields
          const mergedNutrition = {
            ...detailedNutrition,
            // Preserve fields from original nutrition object
            name: nutrition.name || detailedNutrition.name || detailedNutrition.template?.name,
            meal_name: nutrition.meal_name || detailedNutrition.meal_name || detailedNutrition.name,
            meal_image: nutrition.meal_image || detailedNutrition.meal_image || detailedNutrition.template?.meal_image,
            thumbnail: nutrition.thumbnail || detailedNutrition.thumbnail || detailedNutrition.meal_image,
            category: nutrition.category || detailedNutrition.category || detailedNutrition.template?.category,
          };

          navigation.navigate('NutritionDetails', { nutrition: mergedNutrition });
        } else {
          // Get error details for better debugging
          let errorMessage = `Status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {
            // Error parsing response
          }
          
          // Fallback: navigate with existing data (even if incomplete)
          navigation.navigate('NutritionDetails', { nutrition: nutrition });
        }
      } catch (error) {
        // Fallback: navigate with existing data
        navigation.navigate('NutritionDetails', { nutrition: nutrition });
      }
    } else {
      // No ID, navigate with existing data
      navigation.navigate('NutritionDetails', { nutrition: nutrition });
    }
  };

  // Search filtering function
  const filterNutritionPlans = (searchTerm) => {
    if (!searchTerm.trim()) {
      setFilteredNutritionPlans(nutritionPlans);
      return;
    }

    const filtered = nutritionPlans.filter(plan => {
      const planName = plan.name || plan.meal_name || plan.template?.name || '';
      return planName.toLowerCase().includes(searchTerm.toLowerCase());
    });

    setFilteredNutritionPlans(filtered);
  };

  // Handle search input change
  const handleSearchChange = (text) => {
    setSearch(text);
    filterNutritionPlans(text);
  };

  // Helper function to safely get category name (handles both object and string)
  const getCategoryName = (item) => {
    // Check category directly on item (from MealPlanTemplate)
    if (item.category) {
      if (typeof item.category === 'object' && item.category.name) {
        return item.category.name;
      }
      if (typeof item.category === 'string') {
        return item.category;
      }
    }
    // Fallback to template category (for assigned meals)
    if (item.template?.category) {
      if (typeof item.template.category === 'object' && item.template.category.name) {
        return item.template.category.name;
      }
      if (typeof item.template.category === 'string') {
        return item.template.category;
      }
    }
    return '';
  };

  const renderMenuIcon = (item, idx) => {
    let IconComponent = MaterialCommunityIcons;
    if (item.lib === 'Feather') IconComponent = Feather;
    if (item.lib === 'Ionicons') IconComponent = Ionicons;
    return (
      <View key={item.label} style={{ alignItems: 'center' }}>
        <IconComponent name={item.icon} size={32} color="#222" />
        <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 5, color: '#000' }}>{item.label}</Text>
      </View>
    );
  };
 

  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = API_BASE_URL.replace('/api', ''); // For image URLs
  
  const fetchNutritionPlans = async (forceRefresh = false) => {
    try {
      const cacheKey = 'nutrition_plans';
      
      // If force refresh, clear cache first
      if (forceRefresh) {
        await DataCache.clear(cacheKey);
        setLoading(true);
      } else {
        // Try to load from cache first
        const cachedData = await DataCache.get(cacheKey);
        if (cachedData && cachedData.length > 0) {
          setNutritionPlans(cachedData);
          setFilteredNutritionPlans(cachedData);
          setLoading(false);
        } else {
          setLoading(true);
        }
      }
      setError(null);
      
      // Get the stored token with the correct key (userToken, not @auth_token)
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        setError('Authentication required');
        setLoading(false);
        return null;
      }
  
      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }
  
      // Build query parameters for filters
      const params = new URLSearchParams();
      if (selectedCategories.length > 0) {
        selectedCategories.forEach(cat => {
          params.append('categories[]', cat);
        });
      }
      if (selectedCaloriesRange) {
        params.append('calories_range', selectedCaloriesRange);
      }
      if (selectedMacronutrientFocus.length > 0) {
        selectedMacronutrientFocus.forEach(focus => {
          params.append('macronutrient_focus[]', focus);
        });
      }
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const queryString = params.toString();
      const url = `${API_BASE_URL}/mobile/nutrition${queryString ? '?' + queryString : ''}`;
  
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });
  
      if (response.ok) {
        const data = await response.json();
        const plans = data.data || [];
        setNutritionPlans(plans);
        setFilteredNutritionPlans(plans);
        
        // Cache the data
        if (plans.length > 0) {
          await DataCache.set(cacheKey, plans);
        }
        
        return data;
      } else {
        // Get the error response body
        await response.json();
        setError('Failed to fetch nutrition plans');
        return null;
      }
    } catch (error) {
      setError('Network error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedMeals = async (forceRefresh = false) => {
    try {
      const cacheKey = 'assigned_meals';
      
      // If force refresh, clear cache first
      if (forceRefresh) {
        await DataCache.clear(cacheKey);
        setLoadingAssignedMeals(true);
      } else {
        // Try to load from cache first
        const cachedData = await DataCache.get(cacheKey);
        if (cachedData && cachedData.length > 0) {
          setAssignedMeals(cachedData);
          setLoadingAssignedMeals(false);
          return;
        } else {
          setLoadingAssignedMeals(true);
        }
      }
      
      // Get the stored token
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        setLoadingAssignedMeals(false);
        return null;
      }
  
      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }
  
      const response = await fetch(`${API_BASE_URL}/mobile/nutrition/assigned-meals`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });
  
      if (response.ok) {
        const data = await response.json();
        const meals = data.data || data || [];
        setAssignedMeals(meals);
        
        // Cache the data
        if (meals.length > 0) {
          await DataCache.set(cacheKey, meals);
        }
        
        return data;
      } else {
        await response.json();
        setAssignedMeals([]);
        return null;
      }
    } catch (error) {
      setAssignedMeals([]);
      return null;
    } finally {
      setLoadingAssignedMeals(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setLoadingCategories(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/nutrition/categories`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const cats = data.data || data.categories || [];
        setCategories(Array.isArray(cats) ? cats : []);
      }
    } catch (err) {
      // Error fetching categories
    } finally {
      setLoadingCategories(false);
    }
  };

  // Filter handlers
  const handleCategoryToggle = (categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const handleCaloriesRangeToggle = (range) => {
    setSelectedCaloriesRange(prev => prev === range ? null : range);
  };

  const handleMacronutrientFocusToggle = (focus) => {
    setSelectedMacronutrientFocus(prev => {
      if (prev.includes(focus)) {
        return prev.filter(f => f !== focus);
      } else {
        return [...prev, focus];
      }
    });
  };

  useEffect(() => {
    fetchCategories();
    fetchNutritionPlans();
    fetchAssignedMeals();
    // Mark initial mount as complete after a short delay
    setTimeout(() => {
      isInitialMount.current = false;
    }, 1000);
  }, []);

  useEffect(() => {
    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      if (!isInitialMount.current) {
        fetchNutritionPlans(true);
      }
    }, search.trim() ? 500 : 0); // 500ms delay for search, immediate for filters

    return () => clearTimeout(timeoutId);
  }, [selectedCategories, selectedCaloriesRange, selectedMacronutrientFocus, search]);

  // Refresh data when screen comes into focus (e.g., after creating a nutrition plan)
  useFocusEffect(
    useCallback(() => {
      // Only refresh if we're not on initial mount and have existing data
      // This ensures fresh data after creating a new plan without unnecessary reloads
      if (!isInitialMount.current && nutritionPlans.length > 0) {
        fetchNutritionPlans(true); // Force refresh to get latest data
        fetchAssignedMeals(true); // Also refresh assigned meals
      }
    }, [nutritionPlans.length])
  );

  // Update filtered plans when nutritionPlans change
  useEffect(() => {
    setFilteredNutritionPlans(nutritionPlans);
  }, [nutritionPlans]);

  // Group nutrition plans by category using useMemo for performance
  const groupedNutritionPlans = useMemo(() => {
    const grouped = {};
    filteredNutritionPlans.forEach(plan => {
      // Get category name from plan object
      const categoryName = getCategoryName(plan) || plan.category?.name || 'Uncategorized';
      if (!grouped[categoryName]) {
        grouped[categoryName] = [];
      }
      grouped[categoryName].push(plan);
    });
    return grouped;
  }, [filteredNutritionPlans]);

  // Group all nutrition plans (unfiltered) by category - used when search returns no results
  const groupedAllNutritionPlans = useMemo(() => {
    const grouped = {};
    nutritionPlans.forEach(plan => {
      const categoryName = getCategoryName(plan) || plan.category?.name || 'Uncategorized';
      if (!grouped[categoryName]) {
        grouped[categoryName] = [];
      }
      grouped[categoryName].push(plan);
    });
    return grouped;
  }, [nutritionPlans]);

  const nutritionCategories = useMemo(() => {
    return Object.keys(groupedNutritionPlans).sort();
  }, [groupedNutritionPlans]);

  const allNutritionCategories = useMemo(() => {
    return Object.keys(groupedAllNutritionPlans).sort();
  }, [groupedAllNutritionPlans]);

  // Helper function to handle back navigation
  const handleBackNavigation = () => {
    const state = navigation.getState();
    const routes = state.routes;
    
    // Check if CreateNutritionScreen is anywhere in the navigation stack
    const hasCreateNutritionScreen = routes.some(route => route.name === 'CreateNutrition');
    
    if (hasCreateNutritionScreen) {
      // Navigate directly to Dashboard, skipping CreateNutritionScreen
      navigation.navigate('Dashboard');
    } else {
      // Otherwise, go back normally
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // Fallback: navigate to Dashboard if we can't go back
        navigation.navigate('Dashboard');
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchNutritionPlans(true),
      fetchAssignedMeals(true)
    ]);
    setRefreshing(false);
  };

  // Show loading state
  if (loading) {
    return (
      <View style={styles.container}>
        {/* Search Header */}
        <View style={[styles.searchHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={handleBackNavigation}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={styles.searchBarContainer}>
            <Feather name="search" size={16} color="#888" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search nutrition plans"
              value={search}
              onChangeText={handleSearchChange}
              placeholderTextColor="#bbb"
              editable={false}
            />
          </View>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
          >
            <Feather name="menu" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#222" />
          <Text style={styles.loadingText}>Loading nutrition plans...</Text>
        </View>
      </View>
    );
  }

    // Show error state
  if (error) {
    return (
      <View style={styles.container}>
        {/* Search Header */}
        <View style={[styles.searchHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={handleBackNavigation}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={styles.searchBarContainer}>
            <Feather name="search" size={16} color="#888" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search nutrition plans"
              value={search}
              onChangeText={handleSearchChange}
              placeholderTextColor="#bbb"
              editable={false}
            />
          </View>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
          >
            <Feather name="menu" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchNutritionPlans}>
            <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
        </View>
      </View>
    );
  }



  // Check if there are no nutrition plans AND no assigned meals
  // We only show the full empty state when the user really has nothing here.
  if (
    (!nutritionPlans || nutritionPlans.length === 0) &&
    (!assignedMeals || assignedMeals.length === 0)
  ) {
    return (
      <View style={styles.container}>
        {/* Menu Modal */}
        <MenuModal
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          menuItems={menuItems}
          renderMenuIcon={renderMenuIcon}
          onMenuItemPress={handleMenuItemPress}
        />
        {/* Search Header */}
        <View style={[styles.searchHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={handleBackNavigation}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={styles.searchBarContainer}>
            <Feather name="search" size={16} color="#888" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search nutrition plans"
              value={search}
              onChangeText={handleSearchChange}
              placeholderTextColor="#bbb"
            />
          </View>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
          >
            <Feather name="menu" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
        <View style={styles.noPlansContainer}>
          <View style={styles.noPlansIconContainer}>
            <MaterialCommunityIcons name="food-apple-outline" size={80} color="#ccc" />
          </View>
          <Text style={styles.noPlansTitle}>No Nutrition Plans Available</Text>
          <Text style={styles.noPlansSubtitle}>
            It looks like there are no nutrition plans available at the moment. You can create your own nutrition plan or check back later.
          </Text>
          <TouchableOpacity style={styles.createNutritionButton} onPress={() => navigation.navigate('AllNutritionScreen')}>
            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
            <Text style={styles.createNutritionButtonText}>Create Nutrition Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchNutritionPlans}>
            <MaterialCommunityIcons name="refresh" size={16} color="#fff" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={16} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Menu Modal */}
      <MenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        menuItems={menuItems}
        renderMenuIcon={renderMenuIcon}
        onMenuItemPress={handleMenuItemPress}
      />
      {/* Search Header */}
      <View style={[styles.searchHeader, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          style={styles.headerBackButton}
          onPress={handleBackNavigation}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={16} color="#888" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search nutrition plans"
            value={search}
            onChangeText={handleSearchChange}
            placeholderTextColor="#bbb"
          />
        </View>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setMenuVisible(true)}
        >
          <Feather name="menu" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        </View>
      
      {/* Filter Chips */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContentContainer}
      >
        {/* Category Filter */}
        {categories.length > 0 && (
          <>
            {categories.map((category) => {
              const categoryId = category.id || category;
              const categoryName = category.name || category;
              const isSelected = selectedCategories.includes(categoryId);
              return (
                <TouchableOpacity
                  key={categoryId}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipActive
                  ]}
                  onPress={() => handleCategoryToggle(categoryId)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive
                  ]}>
                    {categoryName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Calories Range Filter */}
        {['Low Calorie', 'Medium Calorie', 'High Calorie'].map((range) => {
          const rangeValue = range.toLowerCase().replace(' calorie', '');
          const isSelected = selectedCaloriesRange === rangeValue;
          return (
            <TouchableOpacity
              key={range}
              style={[
                styles.filterChip,
                isSelected && styles.filterChipActive
              ]}
              onPress={() => handleCaloriesRangeToggle(rangeValue)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterChipText,
                isSelected && styles.filterChipTextActive
              ]}>
                {range}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Macronutrient Focus Filter */}
        {[
          { label: 'High Protein', value: 'high_protein' },
          { label: 'Low Carb', value: 'low_carb' },
          { label: 'High Carb', value: 'high_carb' },
          { label: 'Balanced', value: 'balanced' }
        ].map((focus) => {
          const isSelected = selectedMacronutrientFocus.includes(focus.value);
          return (
            <TouchableOpacity
              key={focus.value}
              style={[
                styles.filterChip,
                isSelected && styles.filterChipActive
              ]}
              onPress={() => handleMacronutrientFocusToggle(focus.value)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterChipText,
                isSelected && styles.filterChipTextActive
              ]}>
                {focus.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      <ScrollView 
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 120, flexGrow: 1 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#222']}
            tintColor="#222"
          />
        }
      >
        {/* Create your own */}
        <Text style={styles.sectionLabel}>Created by me</Text>
        <TouchableOpacity 
          style={styles.createNutritionBox}
          onPress={() => navigation.navigate('CreateNutrition')}
          activeOpacity={0.8}
        >
          <Feather name="plus-circle" size={18} color="#000" />
          <Text style={styles.createNutritionText}>Create nutrition plan</Text>
        </TouchableOpacity>
        
        {/* Assigned Meals Section */}
        <View>
          <Text style={styles.sectionLabel}>Assigned Meals</Text>
          {loadingAssignedMeals ? (
            <View style={styles.sectionLoadingContainer}>
              <ActivityIndicator size="small" color="#222" />
              <Text style={styles.sectionLoadingText}>Loading...</Text>
            </View>
          ) : assignedMeals && assignedMeals.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalCardsRow}>
              {assignedMeals.map((item, idx) => (
                <TouchableOpacity
                  key={item.id || idx}
                  style={[styles.nutritionCard, { width: screenWidth * 0.65, marginRight: idx === assignedMeals.length - 1 ? 0 : 16 }]}
                  onPress={() => handleNutritionCardPress(item)}
                  activeOpacity={0.8}
                >
                  {item.template?.meal_image || item.meal_image || item.thumbnail ? (
                    <Image 
                      source={{ 
                        uri: (item.template?.meal_image || item.meal_image || item.thumbnail)?.startsWith('http') 
                          ? (item.template?.meal_image || item.meal_image || item.thumbnail)
                          : item.template?.meal_image 
                            ? `${BASE_URL}/${item.template.meal_image}` 
                            : item.meal_image 
                              ? `${BASE_URL}/${item.meal_image}` 
                              : `${BASE_URL}/${item.thumbnail}` 
                      }} 
                      style={styles.nutritionCardImage}
                    />
                  ) : (
                    <View style={styles.nutritionCardPlaceholder}>
                      <MaterialCommunityIcons name="food-apple-outline" size={48} color="#ccc" />
                    </View>
                  )}
                  <View style={styles.nutritionCardOverlay} />
                  <View style={styles.nutritionCardTextBox}>
                    <Text style={styles.nutritionCardTitle}>{item.template?.name || item.name || item.meal_name || 'Assigned Meal'}</Text>
                    <Text style={styles.nutritionCardSubtitle}>
                      {item.template?.calories || item.calories ? `${item.template?.calories || item.calories} cal` : ''}
                      {item.template?.protein || item.protein ? ` · ${item.template?.protein || item.protein}g` : ''}
                      {getCategoryName(item) ? ` · ${getCategoryName(item)}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptySectionContainer}>
              <Text style={styles.emptySectionText}>No assigned meals found</Text>
            </View>
          )}
        </View>
        
        {/* All Nutrition Plans Section - Grouped by Category */}
        <View>
          <Text style={styles.sectionLabel}>All Nutrition Plans</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#222" />
            </View>
          ) : (search && search.trim() !== '' && filteredNutritionPlans.length > 0) ? (
            // When searching and results found, show filtered plans in a single section
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalCardsRow}>
              {filteredNutritionPlans.map((item, idx) => (
                <TouchableOpacity
                  key={item.id || idx}
                  style={[
                    styles.nutritionCard, 
                    { 
                      width: screenWidth * 0.65, 
                      marginRight: idx === filteredNutritionPlans.length - 1 ? 0 : 16 
                    }
                  ]}
                  onPress={() => handleNutritionCardPress(item)}
                  activeOpacity={0.8}
                >
                  {item.meal_image || item.thumbnail ? (
                    <Image 
                      source={{ 
                        uri: (item.meal_image || item.thumbnail)?.startsWith('http') 
                          ? (item.meal_image || item.thumbnail)
                          : item.meal_image 
                            ? `${BASE_URL}/${item.meal_image}` 
                            : `${BASE_URL}/${item.thumbnail}` 
                      }} 
                      style={styles.nutritionCardImage}
                    />
                  ) : (
                    <View style={styles.nutritionCardPlaceholder}>
                      <MaterialCommunityIcons name="food-apple-outline" size={48} color="#ccc" />
                    </View>
                  )}
                  <View style={styles.nutritionCardOverlay} />
                  <View style={styles.nutritionCardTextBox}>
                    <Text style={styles.nutritionCardTitle}>
                      {item.name || item.meal_name}
                    </Text>
                    <Text style={styles.nutritionCardSubtitle}>
                      {item.calories ? `${item.calories} cal` : ''} 
                      {item.protein ? ` · ${item.protein}g` : ''}
                      {getCategoryName(item) ? ` · ${getCategoryName(item)}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : allNutritionCategories.length > 0 ? (
            // When not searching OR when search returns no results, show all plans grouped by category
            allNutritionCategories.map((category) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryHeader}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.horizontalCardsRow}
                >
                  {groupedAllNutritionPlans[category].map((item, idx) => (
                    <TouchableOpacity
                      key={item.id || idx}
                      style={[
                        styles.nutritionCard, 
                        { 
                          width: screenWidth * 0.65, 
                          marginRight: idx === groupedAllNutritionPlans[category].length - 1 ? 0 : 16 
                        }
                      ]}
                      onPress={() => handleNutritionCardPress(item)}
                      activeOpacity={0.8}
                    >
                      {item.meal_image || item.thumbnail ? (
                        <Image 
                          source={{ 
                            uri: (item.meal_image || item.thumbnail)?.startsWith('http') 
                              ? (item.meal_image || item.thumbnail)
                              : item.meal_image 
                                ? `${BASE_URL}/${item.meal_image}` 
                                : `${BASE_URL}/${item.thumbnail}` 
                          }} 
                          style={styles.nutritionCardImage}
                        />
                      ) : (
                        <View style={styles.nutritionCardPlaceholder}>
                          <MaterialCommunityIcons name="food-apple-outline" size={48} color="#ccc" />
                        </View>
                      )}
                      <View style={styles.nutritionCardOverlay} />
                      <View style={styles.nutritionCardTextBox}>
                        <Text style={styles.nutritionCardTitle}>
                          {item.name || item.meal_name}
                        </Text>
                        <Text style={styles.nutritionCardSubtitle}>
                          {item.calories ? `${item.calories} cal` : ''} 
                          {item.protein ? ` · ${item.protein}g` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ))
          ) : (
            <View style={styles.emptySectionContainer}>
              <Text style={styles.emptySectionText}>
                {search && search.trim() !== '' ? 'No nutrition plans found matching your search' : 'No nutrition plans available'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      <TouchableOpacity style={styles.backButtonBottom} onPress={handleBackNavigation}>
        <Ionicons name="arrow-back" size={16} color="#fff" />
        <Text style={styles.backTextBottom}>Back</Text>
      </TouchableOpacity>

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
  container: { flex: 1, backgroundColor: '#f7f8f2' },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingTop: 80 
  },
  loadingText: { 
    marginTop: 12, 
    fontSize: 13, 
    color: '#888',
    fontWeight: '500'
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 20
  },
  errorText: { 
    fontSize: 13, 
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500'
  },
  retryButton: {
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: '5%',
    paddingBottom: 12,
    backgroundColor: '#f7f8f2',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerBackButton: {
    marginRight: 12,
    padding: 8,
  },
  menuButton: {
    marginLeft: 12,
    padding: 8,
  },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, flex: 1, height: 40, elevation: 2 },
  searchInput: { flex: 1, fontSize: 13, marginLeft: 10, color: '#1a1a1a', paddingVertical: 0 },
  sectionLabel: { fontWeight: 'bold', fontSize: 20, marginTop: 2, marginBottom: 10, marginLeft: '5%', color: '#1a1a1a' },
  categorySection: { marginBottom: 0 },
  categoryHeader: { 
    fontWeight: 'bold', 
    fontSize: 20, 
    marginTop: 0, 
    marginBottom: 4, 
    marginLeft: '5%', 
    color: '#1a1a1a',
    textTransform: 'capitalize'
  },
  horizontalCardsRow: { marginHorizontal: '5%', marginBottom: 10 },
  createNutritionBox: { width:'70%', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#bbb', borderRadius: 16, height: 160, justifyContent: 'center', alignItems: 'center', marginHorizontal: '5%', marginBottom: 12, backgroundColor: '#fff', padding: 14 },
  createNutritionText: { color: '#1a1a1a', fontWeight: '600', fontSize: 13, marginTop: 6, letterSpacing: 0.3 },
  nutritionCard: { position: 'relative', width: '48%', height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  nutritionCardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  nutritionCardPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  nutritionCardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  nutritionCardTextBox: { position: 'absolute', left: 0, bottom: 0, padding: 14 },
  nutritionCardTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 4, lineHeight: 18 },
  nutritionCardSubtitle: { color: '#fff', fontSize: 11, fontWeight: '600' },
  backButton: { flexDirection: 'row', bottom: '5%', alignItems: 'center',  paddingHorizontal: 5, paddingVertical: 10, marginTop: 10, alignSelf: 'center' },
  backText: { color: '#fff', marginLeft: 8, fontWeight: '600', fontSize: 13, letterSpacing: 0.3 },
  backButtonBottom: { flexDirection: 'row', backgroundColor: '#222', borderRadius: 20, bottom: '5%', alignItems: 'center',  paddingHorizontal: 25, paddingVertical: 15, marginTop: 10, alignSelf: 'center' },
  backTextBottom: { color: '#fff', marginLeft: 8, fontWeight: '600', fontSize: 13, letterSpacing: 0.3 },
  emptySectionContainer: {
    paddingVertical: 20,
    paddingHorizontal: '5%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  emptySectionText: {
    color: '#999',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  sectionLoadingContainer: {
    paddingVertical: 30,
    paddingHorizontal: '5%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  sectionLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  noPlansContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 20
  },
  noPlansIconContainer: {
    marginBottom: 24,
    opacity: 0.7
  },
  noPlansTitle: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#666',
    marginBottom: 6,
    textAlign: 'center'
  },
  noPlansSubtitle: { 
    fontSize: 12, 
    color: '#999',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 32,
    paddingHorizontal: 20
  },
  createNutritionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16
  },
  createNutritionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    marginHorizontal: '5%',
  },
  noResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 6,
  },
  noResultsSubtitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 6,
  },
  loadingMealsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginHorizontal: '5%',
  },
  loadingMealsText: {
    marginLeft: 12,
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  noAssignedMealsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    marginHorizontal: '5%',
  },
  noAssignedMealsText: {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  filterContainer: {
    backgroundColor: '#f7f8f2',
    paddingVertical: 10,
  },
  filterContentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#ddd',
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  filterChipTextActive: {
    color: '#fff',
  },
});

export default NutritionScreen;
