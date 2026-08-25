import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';

const FoodScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { nutritionType, existingFoods = [] } = route.params || {};

  const [foods, setFoods] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [searchingFoods, setSearchingFoods] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [selectedFoods, setSelectedFoods] = useState(new Set());

  const API_BASE_URL = ENV_API_BASE_URL;

  // Initialize selected foods from existing foods
  useEffect(() => {
    if (existingFoods && existingFoods.length > 0) {
      // Only include foods that have valid food_id
      const validFoods = existingFoods.filter(food => food.food_id || food.id);
      if (validFoods.length > 0) {
        const existingIds = new Set(validFoods.map(food => String(food.food_id || food.id)));
        setSelectedFoods(existingIds);
      } else {
        setSelectedFoods(new Set());
      }
    } else {
      setSelectedFoods(new Set());
    }
  }, [existingFoods]);

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
        const foodsData = data.data || data.foods || data || [];
        setFoods(foodsData);
      } else {
        console.error('Failed to fetch foods');
      }
    } catch (error) {
      console.error('Error fetching foods:', error);
    } finally {
      setLoadingFoods(false);
    }
  };

  // Search foods using API endpoint with filters
  const searchFoods = async (query) => {
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

      // Build query parameters
      const params = new URLSearchParams();
      if (query && query.trim()) {
        params.append('query', query.trim());
      }

      const searchUrl = `${API_BASE_URL}/mobile/nutrition/foods/search?${params.toString()}`;
      
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
        const foodsData = data.data || data.foods || [];
        setSearchResults(foodsData);
      } else {
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
    const timeoutId = setTimeout(() => {
      // If there's a search query, search
      if (foodSearchQuery.trim()) {
        searchFoods(foodSearchQuery);
      } else {
        // If no query, use initial foods
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [foodSearchQuery]);

  // Memoized filtered foods
  const filteredFoods = useMemo(() => {
    // If there's a search query, use search results
    if (foodSearchQuery.trim()) {
      return searchResults;
    }
    return foods;
  }, [foods, foodSearchQuery, searchResults]);
  

  const toggleFoodSelection = (foodId) => {
    const foodIdStr = String(foodId);
    setSelectedFoods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(foodIdStr)) {
        newSet.delete(foodIdStr);
      } else {
        newSet.add(foodIdStr);
      }
      return newSet;
    });
  };

  const handleDone = () => {
    const selectedFoodsArray = filteredFoods.filter(food => {
      const foodId = food.id || food.food_id;
      return selectedFoods.has(String(foodId));
    }).map(food => ({
      ...food, // Include all food data
      id: food.id || food.food_id,
      food_id: food.id || food.food_id,
      name: food.name || food.food_name,
    }));

    navigation.navigate('CreateNutrition', {
      selectedFoods: selectedFoodsArray,
      nutritionType: nutritionType,
    });
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

  return (
    <View style={styles.container}>
      {/* Custom Header with Search */}
      <View style={[styles.customHeader, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#6b6b6b" />
        </TouchableOpacity>
        <View style={styles.headerSearchContainer}>
          <Feather name="search" size={18} color="#888" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.headerSearchInput}
            placeholder="Search foods..."
            value={foodSearchQuery}
            onChangeText={setFoodSearchQuery}
            placeholderTextColor="#bbb"
            autoFocus={false}
          />
          {foodSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setFoodSearchQuery('')} style={styles.headerClearButton}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Food List */}
      <View style={{ paddingTop: insets.top + 60, flex: 1 }}>
        {loadingFoods ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#222" />
            <Text style={styles.loadingText}>Loading foods...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredFoods}
            keyExtractor={(item, index) => {
              const foodId = item.id || item.food_id || index;
              return `food-${foodId}`;
            }}
            style={styles.foodList}
            contentContainerStyle={[
              styles.foodListContent,
              {
                // Add extra padding when foods are selected to accommodate floating button
                paddingBottom: selectedFoods.size > 0 
                  ? Math.max(insets.bottom, 16) + 80 
                  : Math.max(insets.bottom, 16) + 20
              }
            ]}
            renderItem={({ item, index }) => {
              const foodId = item.id || item.food_id || index;
              const foodName = item.name || item.food_name || `Food ${foodId}`;
              const isSelected = selectedFoods.has(String(foodId));

              // Extract nutritional values (per 100g)
              const calories = item.calories || item.kcal || item.energy || 0;
              const protein = item.protein || item.protein_g || 0;
              const carbs = item.carbs || item.carbohydrates || item.total_carb || 0;
              const fats = item.fats || item.fat || item.fat_g || 0;

              // Format nutritional info
              const formatValue = (value) => {
                const num = parseFloat(value);
                return isNaN(num) ? 0 : num.toFixed(1);
              };

              const nutritionText = `${formatValue(calories)} kcal • ${formatValue(protein)}g P • ${formatValue(carbs)}g C • ${formatValue(fats)}g F`;

              return (
                <TouchableOpacity
                  style={[styles.foodItem, isSelected && styles.foodItemSelected]}
                  onPress={() => toggleFoodSelection(foodId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.foodItemContent}>
                    <View style={styles.foodItemLeft}>
                      <MaterialCommunityIcons 
                        name="food" 
                        size={20} 
                        color={isSelected ? "#222" : "#999"} 
                        style={styles.foodIcon}
                      />
                      <View style={styles.foodItemTextContainer}>
                        <Text style={[styles.foodItemText, isSelected && styles.foodItemTextSelected]}>
                          {foodName}
                        </Text>
                        <Text style={[styles.foodItemNutrition, isSelected && styles.foodItemNutritionSelected]}>
                          {nutritionText}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {searchingFoods ? (
                  <ActivityIndicator size="small" color="#222" />
                ) : (
                  <Text style={styles.noFoodsText}>
                    {foodSearchQuery ? 'No foods found matching your search' : 'No foods available'}
                  </Text>
                )}
              </View>
            }
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews={true}
          />
        )}
      </View>

      {/* Floating Done Button - Only visible when foods are selected */}
      {selectedFoods.size > 0 && (
        <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Selected Foods ({selectedFoods.size})</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  customHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8f2',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    marginRight: 12,
  },
  headerSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 40,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    color: '#1a1a1a',
    paddingVertical: 0,
  },
  headerClearButton: {
    padding: 6,
    marginRight: 8,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  doneButton: {
    backgroundColor: '#222',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  foodList: {
    flex: 1,
  },
  foodListContent: {
    padding: 20,
  },
  foodItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  foodItemSelected: {
    borderColor: '#222',
    backgroundColor: '#f9f9f9',
  },
  foodItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foodItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  foodIcon: {
    marginRight: 12,
  },
  foodItemTextContainer: {
    flex: 1,
  },
  foodItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  foodItemTextSelected: {
    color: '#222',
  },
  foodItemNutrition: {
    fontSize: 11,
    color: '#999',
    fontWeight: '400',
  },
  foodItemNutritionSelected: {
    color: '#666',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  loadingContainer: {
    flex: 1,
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noFoodsText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
  },
});

export default FoodScreen;


