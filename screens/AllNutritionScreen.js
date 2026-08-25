import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

const API_BASE_URL = ENV_API_BASE_URL;

const AllNutritionScreen = () => {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [nutritionItems, setNutritionItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedCaloriesRange, setSelectedCaloriesRange] = useState(null);
  const [selectedMacronutrientFocus, setSelectedMacronutrientFocus] = useState([]);
  const navigation = useNavigation();

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
    if (item.lib === 'Feather') IconComponent = Feather;
    if (item.lib === 'Ionicons') IconComponent = Ionicons;
    return (
      <View key={item.label} style={{ alignItems: 'center' }}>
        <IconComponent name={item.icon} size={32} color="#222" />
        <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 5, color: '#000' }}>{item.label}</Text>
      </View>
    );
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
      console.error('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Fetch all nutrition items with filters
  const fetchNutritionItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Build query parameters
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
        // Handle different response structures
        const items = data.data || data.nutrition || data.nutrition_plans || data || [];
        setNutritionItems(Array.isArray(items) ? items : []);
      } else {
        setError('Failed to load nutrition items');
      }
    } catch (err) {
      console.error('Error fetching nutrition items:', err);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchNutritionItems();
  }, [selectedCategories, selectedCaloriesRange, selectedMacronutrientFocus, search]);

  const handleNutritionItemPress = (item) => {
    // Navigate to nutrition details screen
    navigation.navigate('NutritionDetails', { nutrition: item });
  };

  const handleEditPress = (item) => {
    navigation.navigate('CreateNutrition', { nutritionItem: item });
  };

  const handleDeletePress = (item) => {
    // Handle delete functionality
    setAlertConfig({
      title: 'Delete Nutrition Plan',
      message: 'Are you sure you want to delete this nutrition plan?',
      type: 'warning',
      buttons: [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'secondary',
        },
        {
          text: 'Delete',
          onPress: () => {
            // TODO: Implement delete API call
            console.log('Delete nutrition plan:', item.id);
          },
          style: 'danger',
        },
      ],
    });
    setAlertVisible(true);
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

  const getCategoryName = (item) => {
    if (item.category) {
      if (typeof item.category === 'object' && item.category.name) {
        return item.category.name;
      }
      if (typeof item.category === 'string') {
        return item.category;
      }
    }
    return '';
  };

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
      
      {/* Fixed Header */}
      <HeaderBar
        onMenuPress={() => setMenuVisible(true)}
      />

      <ScrollView 
        contentContainerStyle={{ 
          paddingTop: insets.top + 80, 
          paddingBottom: 120,
        }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color="#888" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search meal plans..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#bbb"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={18} color="#888" />
              </TouchableOpacity>
            )}
          </View>
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

        {/* Products Section */}
        <View style={styles.productsSection}>
          <Text style={styles.productsTitle}>Meal Plans</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#222" />
              <Text style={styles.loadingText}>Loading nutrition items...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchNutritionItems}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : nutritionItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="food-apple-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No nutrition items available</Text>
            </View>
          ) : (
            <View style={styles.productsList}>
              {nutritionItems.map((item, index) => {
                const nutritionName = item.name || item.title || item.meal_plan_name || `Nutrition Item ${index + 1}`;
                const calories = item.calories || item.template?.calories || 0;
                const protein = item.protein || item.template?.protein || 0;
                const carbs = item.carbs || item.template?.carbs || 0;
                const fats = item.fats || item.fat || item.template?.fats || item.template?.fat || 0;
                
                return (
                  <TouchableOpacity 
                    key={item.id || index} 
                    style={styles.nutritionCard}
                    onPress={() => handleNutritionItemPress(item)}
                    activeOpacity={0.7}
                  >
                    {/* Top Section - Title and Action Icons */}
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{nutritionName}</Text>
                      <View style={styles.cardActions}>
                        <TouchableOpacity 
                          style={styles.actionIcon}
                          onPress={() => handleNutritionItemPress(item)}
                        >
                          <MaterialCommunityIcons name="account-plus" size={18} color="#4CAF50" />
                        </TouchableOpacity>
                        {/* <TouchableOpacity 
                          style={styles.actionIcon}
                          onPress={() => handleEditPress(item)}
                        >
                          <MaterialCommunityIcons name="pencil" size={18} color="#666" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.actionIcon}
                          onPress={() => handleDeletePress(item)}
                        >
                          <MaterialCommunityIcons name="delete" size={18} color="#FF6B6B" />
                        </TouchableOpacity> */}
                      </View>
                    </View>
                    
                    {/* Separator */}
                    <View style={styles.cardSeparator} />
                    
                    {/* Bottom Section - Nutrition Info */}
                    <View style={styles.nutritionGrid}>
                      <View style={styles.nutritionItem}>
                        <MaterialCommunityIcons name="fire" size={20} color="#FF6B35" />
                        <Text style={styles.nutritionValue}>{Math.round(calories)}</Text>
                        <Text style={styles.nutritionLabel}>CAL</Text>
                      </View>
                      
                      <View style={styles.nutritionItem}>
                        <MaterialCommunityIcons name="egg" size={20} color="#4CAF50" />
                        <Text style={styles.nutritionValue}>{parseFloat(protein).toFixed(1)}g</Text>
                        <Text style={styles.nutritionLabel}>PROTEIN</Text>
                      </View>
                      
                      <View style={styles.nutritionItem}>
                        <MaterialCommunityIcons name="circle-multiple" size={20} color="#2196F3" />
                        <Text style={styles.nutritionValue}>{parseFloat(carbs).toFixed(1)}g</Text>
                        <Text style={styles.nutritionLabel}>CARBS</Text>
                      </View>
                      
                      <View style={styles.nutritionItem}>
                        <MaterialCommunityIcons name="oil" size={20} color="#757575" />
                        <Text style={styles.nutritionValue}>{parseFloat(fats).toFixed(1)}g</Text>
                        <Text style={styles.nutritionLabel}>FATS</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignSelf: 'center',
    marginBottom: 20,
  },
  backText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    height: 44,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#000',
  },
  clearButton: {
    padding: 8,
    marginRight: 4,
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
  productsSection: {
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  productsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  productsList: {
    gap: 12,
  },
  nutritionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    padding: 4,
  },
  cardSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 12,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    flex: 1,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 4,
  },
  nutritionLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 14,
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#222',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    color: '#888',
    fontSize: 14,
  },
});

export default AllNutritionScreen;

