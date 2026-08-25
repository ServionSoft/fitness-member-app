import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { useAuth } from '../contexts/AuthContext';
import ModernAlert from '../components/ModernAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth } = Dimensions.get('window');

const NutritionDetailsScreen = () => {
  const { logout } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { nutrition } = route.params || {};
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const [isAssigned, setIsAssigned] = useState(false);
  const [checkingAssignment, setCheckingAssignment] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [targets] = useState({
    protein: 7,
    carbs: 135,
    fat: 1
  });
  const [currentValues, setCurrentValues] = useState({
    protein: nutrition?.template?.protein || nutrition?.protein || 0,
    carbs: nutrition?.template?.carbs || nutrition?.carbs || 0,
    fat: nutrition?.template?.fats || nutrition?.fats || 0,
    calories: nutrition?.template?.calories || nutrition?.calories || 0
  });

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

  // Check if meal plan is already assigned
  useEffect(() => {
    const checkAssignment = async () => {
      // Only check for MealPlanTemplate (not NutritionPlan which is already assigned)
      // If nutrition has a template_id or is a direct template, check assignment
      const templateId = nutrition?.template?.id || nutrition?.id;
      
      // If this is already a NutritionPlan (assigned meal), it's already assigned
      if (nutrition?.start_date || nutrition?.template_id) {
        setIsAssigned(true);
        setCheckingAssignment(false);
        return;
      }

      // If no template ID, can't check
      if (!templateId) {
        setCheckingAssignment(false);
        return;
      }

      try {
        const userToken = await AsyncStorage.getItem('userToken');
        if (!userToken) {
          setCheckingAssignment(false);
          return;
        }

        let authHeader = userToken;
        if (!userToken.startsWith('Bearer ')) {
          authHeader = `Bearer ${userToken}`;
        }

        const response = await fetch(`${API_BASE_URL}/mobile/nutrition/check-assignment/${templateId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsAssigned(data.is_assigned || false);
        }
      } catch (error) {
        // Error checking assignment
      } finally {
        setCheckingAssignment(false);
      }
    };

    checkAssignment();
  }, [nutrition]);

  // Handle assign meal plan
  const handleAssignMealPlan = async () => {
    const templateId = nutrition?.template?.id || nutrition?.id;
    
    if (!templateId) {
      setAlertConfig({
        title: 'Error',
        message: 'Unable to assign meal plan: Template ID not found',
        type: 'error',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
      setAlertVisible(true);
      return;
    }

    setAssigning(true);

    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setAlertConfig({
          title: 'Error',
          message: 'Authentication required',
          type: 'error',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        setAlertVisible(true);
        setAssigning(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/nutrition/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          template_id: templateId,
          start_date: new Date().toISOString().split('T')[0], // Today's date
          description: `Self-assigned meal plan: ${nutrition?.template?.name || nutrition?.name || 'Meal Plan'}`,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsAssigned(true);
        setAlertConfig({
          title: 'Success',
          message: 'Meal plan assigned successfully!',
          type: 'success',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        setAlertVisible(true);
      } else {
        setAlertConfig({
          title: 'Error',
          message: data.message || 'Failed to assign meal plan',
          type: 'error',
          buttons: [{ text: 'OK', onPress: () => {} }],
        });
        setAlertVisible(true);
      }
    } catch (error) {
      setAlertConfig({
        title: 'Error',
        message: 'An error occurred while assigning the meal plan',
        type: 'error',
        buttons: [{ text: 'OK', onPress: () => {} }],
      });
      setAlertVisible(true);
    } finally {
      setAssigning(false);
    }
  };

  const calculateProgressPercentage = (current, target) => {
    if (!target || target === 0 || !current) return 0;
    const percentage = Math.min((current / target) * 100, 100);
    return isNaN(percentage) ? 0 : percentage;
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
  const BASE_URL = API_BASE_URL.replace('/api', ''); // Remove /api for image URLs

  const onRefresh = React.useCallback(async () => {
    if (!nutrition) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setRefreshing(false);
        return;
      }
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }
      const resourceId = nutrition.id || nutrition.template_id || nutrition.template?.id;
      if (!resourceId) {
        setRefreshing(false);
        return;
      }
      const response = await fetch(`${API_BASE_URL}/mobile/nutrition/${resourceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const detailed = data.data || data;
        const mergedNutrition = {
          ...nutrition,
          ...detailed,
          template: { ...(nutrition.template || {}), ...(detailed.template || detailed) },
          name: nutrition.name || detailed.name || detailed.template?.name,
          meal_name: nutrition.meal_name || detailed.meal_name || detailed.name,
          meal_image: nutrition.meal_image || detailed.meal_image || detailed.template?.meal_image,
          thumbnail: nutrition.thumbnail || detailed.thumbnail || detailed.meal_image,
          protein: detailed.protein ?? nutrition.protein ?? detailed.template?.protein,
          carbs: detailed.carbs ?? nutrition.carbs ?? detailed.template?.carbs,
          fats: detailed.fats ?? nutrition.fats ?? detailed.template?.fats,
          calories: detailed.calories ?? nutrition.calories ?? detailed.template?.calories,
        };
        navigation.setParams({ nutrition: mergedNutrition });
        setCurrentValues({
          protein: mergedNutrition.template?.protein ?? mergedNutrition.protein ?? 0,
          carbs: mergedNutrition.template?.carbs ?? mergedNutrition.carbs ?? 0,
          fat: mergedNutrition.template?.fats ?? mergedNutrition.fats ?? 0,
          calories: mergedNutrition.template?.calories ?? mergedNutrition.calories ?? 0,
        });
      }
    } catch (error) {
      // Refresh failed silently
    } finally {
      setRefreshing(false);
    }
  }, [nutrition, navigation]);

  if (!nutrition) {
    return (
      <View style={styles.container}>
        {/* Custom Back Button */}
        <TouchableOpacity 
          style={styles.topBackButton} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No nutrition data available</Text>
        </View>
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

      {/* Custom Back Button */}
      <TouchableOpacity 
        style={styles.topBackButton} 
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={20} color="#222" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Nutrition Image */}
        {!!(nutrition.template?.meal_image || nutrition.meal_image || nutrition.thumbnail) ? (
          <Image 
            source={{ 
              uri: (() => {
                const imageUrl = nutrition.template?.meal_image || nutrition.meal_image || nutrition.thumbnail;
                // Check if URL is already absolute (starts with http)
                if (imageUrl?.startsWith('http')) {
                  return imageUrl;
                }
                // Otherwise, prepend BASE_URL
                return `${BASE_URL}/${imageUrl}`;
              })()
            }} 
            style={styles.nutritionImage}
          />
        ) : (
          <View style={styles.nutritionImagePlaceholder}>
            <MaterialCommunityIcons name="food-apple-outline" size={64} color="#ccc" />
          </View>
        )}
        
        {/* Nutrition Tracking UI */}
        <View style={styles.nutritionTrackingContainer}>
        <View style={styles.mealNameContainer}>
          <Text style={styles.mealName}>{String(nutrition.template?.name || nutrition.name || nutrition.meal_name || '')}</Text>
          {/* Edit Button - Only show for assigned meals */}
          {!!(nutrition?.start_date || nutrition?.template_id) && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                // Navigate to CreateNutritionScreen with edit data
                navigation.navigate('CreateNutrition', {
                  editMode: true,
                  nutritionData: nutrition,
                  assignedMealId: nutrition.id, // The assigned meal ID
                });
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="pencil" size={18} color="#222" />
            </TouchableOpacity>
          )}
        </View>
        
          {!!(nutrition.template?.description || nutrition.description) && (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionLabel}>Description</Text>
              <Text style={styles.descriptionText}>
                {String(nutrition.template?.description || nutrition.description || '')}
              </Text>
            </View>
          )}
          {!!(nutrition.template?.instructions || nutrition.instructions) && (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionLabel}>Instructions</Text>
              <Text style={styles.descriptionText}>
                {String(nutrition.template?.instructions || nutrition.instructions || '')}
              </Text>
            </View>
          )}
          {/* Meal Plan Targets Section */}
          <View style={styles.targetsCard}>
            <View style={styles.targetsHeader}>
              <Text style={styles.targetsTitle}>Meal Plan Targets</Text>
            </View>
            
            {/* Macronutrient Progress Bars - Horizontal Layout */}
            <View style={styles.macroSectionHorizontal}>
              {/* Protein */}
              <View style={styles.macroItemHorizontal}>
                <View style={styles.macroHeaderHorizontal}>
                  <Text style={styles.macroLabelHorizontal}>PROTEIN</Text>
                  <Text style={styles.macroTargetHorizontal}>{targets.protein}g</Text>
                </View>
                <View style={styles.progressBarContainerHorizontal}>
                  <View style={[styles.progressBarHorizontal, styles.proteinBar, { width: `${calculateProgressPercentage(currentValues.protein || 0, targets.protein)}%` }]} />
                </View>
                <Text style={styles.macroCurrentHorizontal}>{currentValues.protein || 0}g</Text>
              </View>

              {/* Carbs */}
              <View style={styles.macroItemHorizontal}>
                <View style={styles.macroHeaderHorizontal}>
                  <Text style={styles.macroLabelHorizontal}>CARBS</Text>
                  <Text style={styles.macroTargetHorizontal}>{targets.carbs}g</Text>
                </View>
                <View style={styles.progressBarContainerHorizontal}>
                  <View style={[styles.progressBarHorizontal, styles.carbsBar, { width: `${calculateProgressPercentage(currentValues.carbs || 0, targets.carbs)}%` }]} />
                </View>
                <Text style={styles.macroCurrentHorizontal}>{currentValues.carbs || 0}g</Text>
              </View>

              {/* Fat */}
              <View style={styles.macroItemHorizontal}>
                <View style={styles.macroHeaderHorizontal}>
                  <Text style={styles.macroLabelHorizontal}>FAT</Text>
                  <Text style={styles.macroTargetHorizontal}>{targets.fat}g</Text>
                </View>
                <View style={styles.progressBarContainerHorizontal}>
                  <View style={[styles.progressBarHorizontal, styles.fatBar, { width: `${calculateProgressPercentage(currentValues.fat || 0, targets.fat)}%` }]} />
                </View>
                <Text style={styles.macroCurrentHorizontal}>{currentValues.fat || 0}g</Text>
              </View>
            </View>

            {/* Combined Progress Bar */}
            <View style={styles.combinedProgressContainer}>
              <View style={styles.combinedProgressBar}>
                <View style={[styles.combinedSegment, styles.proteinSegment]} />
                <View style={[styles.combinedSegment, styles.carbsSegment]} />
                <View style={[styles.combinedSegment, styles.fatSegment]} />
              </View>
              <View style={styles.combinedLabels}>
                <Text style={styles.combinedLabel}>{currentValues.protein || 0}</Text>
                <Text style={styles.combinedLabel}>{currentValues.carbs || 0}g</Text>
                <Text style={styles.combinedLabel}>{currentValues.fat || 0}</Text>
              </View>
            </View>
          </View>

          {/* Nutrition Levels Section */}
          <View style={styles.nutritionLevelsCard}>
            <View style={styles.nutritionLevelsHeader}>
              <Text style={styles.nutritionLevelsTitle}>Nutrition Levels</Text>
              <Text style={styles.nutritionLevelsSubtitle}>(Current/Daily Target)</Text>
            </View>
            
            <View style={styles.nutritionLevelsList}>
              <View style={styles.nutritionLevelItem}>
                <Text style={styles.nutritionLevelLabel}>Total Calories</Text>
                <Text style={styles.nutritionLevelValue}>{currentValues.calories || 0} cal</Text>
              </View>
              
              <View style={styles.nutritionLevelItem}>
                <Text style={styles.nutritionLevelLabel}>Total Protein</Text>
                <Text style={styles.nutritionLevelValue}>{currentValues.protein || 0}g / {targets.protein}g</Text>
              </View>
              
              <View style={styles.nutritionLevelItem}>
                <Text style={styles.nutritionLevelLabel}>Total Carbs</Text>
                <Text style={styles.nutritionLevelValue}>{currentValues.carbs || 0}g / {targets.carbs}g</Text>
              </View>
              
              <View style={styles.nutritionLevelItem}>
                <Text style={styles.nutritionLevelLabel}>Total Fat</Text>
                <Text style={styles.nutritionLevelValue}>{currentValues.fat || 0}g / {targets.fat}g</Text>
              </View>
              
              {/* Additional nutrition info from nutrition data */}
              {!!(nutrition?.template?.fiber) && (
                <View style={styles.nutritionLevelItem}>
                  <Text style={styles.nutritionLevelLabel}>Total Fiber</Text>
                  <Text style={styles.nutritionLevelValue}>{String(nutrition.template.fiber || 0)}g</Text>
                </View>
              )}
              
              {!!(nutrition?.template?.sodium) && (
                <View style={styles.nutritionLevelItem}>
                  <Text style={styles.nutritionLevelLabel}>Total Sodium</Text>
                  <Text style={styles.nutritionLevelValue}>{String(nutrition.template.sodium || 0)}mg</Text>
                </View>
              )}
              
              {!!(nutrition?.template?.potassium) && (
                <View style={styles.nutritionLevelItem}>
                  <Text style={styles.nutritionLevelLabel}>Total Potassium (K)</Text>
                  <Text style={styles.nutritionLevelValue}>{String(nutrition.template.potassium || 0)}mg</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.content}>

        
          {!!(nutrition.template?.details || nutrition.details) && (nutrition.template?.details?.length > 0 || nutrition.details?.length > 0) && (
            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>Meal Details</Text>
              <View>
              {(() => {
                try {
                  const details = nutrition.template?.details || nutrition.details;
                  if (!details || !Array.isArray(details) || details.length === 0) {
                    return null;
                  }
                  
                  // Group details by nutrition_type
                  const groupedDetails = details.reduce((groups, detail) => {
                    if (!detail) return groups;
                    const type = detail.nutrition_type || 'other';
                    if (!groups[type]) {
                      groups[type] = [];
                    }
                    groups[type].push(detail);
                    return groups;
                  }, {});

                  // Define meal type order and display names
                  const mealTypeOrder = ['breakfast', 'lunch', 'dinner', 'snack_morning', 'snack_afternoon', 'snack_evening', 'snack', 'other'];
                  const mealTypeNames = {
                    breakfast: 'Breakfast',
                    lunch: 'Lunch', 
                    dinner: 'Dinner',
                    snack_morning: 'Snacks (Morning)',
                    snack_afternoon: 'Snacks (Afternoon)',
                    snack_evening: 'Snacks (Evening)',
                    snack: 'Snack',
                    other: 'Other'
                  };

                  const result = mealTypeOrder.map(mealType => {
                    if (!groupedDetails[mealType] || !Array.isArray(groupedDetails[mealType]) || groupedDetails[mealType].length === 0) {
                      return null;
                    }

                    return (
                      <View key={mealType} style={styles.mealTypeSection}>
                        <Text style={styles.mealTypeHeader}>{String(mealTypeNames[mealType] || mealType)}</Text>
                        {groupedDetails[mealType].map((detail, index) => {
                          if (!detail) return null;
                          return (
                            <View key={`${mealType}-${index}`} style={styles.detailItem}>
                              <View style={styles.detailHeader}>
                                <Text style={styles.detailFoodName}>• {String(detail.food?.name || detail.name || 'Unknown Food')}</Text>
                                <Text style={styles.detailQuantity}>
                                  {String(detail.food?.serving_description || detail.serving_description || detail.quantity || '')}
                                </Text>
                              </View>
                              <View style={styles.detailNutritionRow}>
                                <Text style={styles.detailCalories}>{String(detail.calories || detail.food?.calories || 0)} cal</Text>
                                <Text style={styles.detailMacros}>
                                  P: {String(detail.protein || detail.food?.protein || 0)}g | C: {String(detail.carbs || detail.food?.carbohydrate || 0)}g | F: {String(detail.fats || detail.food?.fat || 0)}g
                                </Text>
                              </View>
                              {!!(((detail.food?.fiber && detail.food.fiber > 0) || (detail.food?.sugar && detail.food.sugar > 0))) && (
                                <View style={styles.detailExtraRow}>
                                  <Text style={styles.detailExtraText}>
                                    Fiber: {String(detail.food?.fiber || 0)}g | Sugar: {String(detail.food?.sugar || 0)}g
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  }).filter(Boolean);
                  
                  return result.length > 0 ? result : null;
                } catch (error) {
                  return null;
                }
              })()}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Assign Meal Plan Button - Only show for MealPlanTemplate that's not already assigned */}
      {!checkingAssignment && !isAssigned && (nutrition?.template?.id || nutrition?.id) && !nutrition?.start_date && (
        <TouchableOpacity 
          style={[styles.assignButton, assigning && styles.assignButtonDisabled]} 
          onPress={handleAssignMealPlan}
          disabled={assigning}
          activeOpacity={0.8}
        >
          {assigning ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="plus-circle" size={18} color="#fff" />
              <Text style={styles.assignButtonText}>Assign Meal Plan</Text>
            </>
          )}
        </TouchableOpacity>
      )}

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
    backgroundColor: '#f7f8f2' 
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20
  },
  errorText: { 
    fontSize: 13, 
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500'
  },
  topBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  nutritionImagePlaceholder: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nutritionImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  nutritionTrackingContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  targetsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  targetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  targetsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  editButton: {
    padding: 4,
  },
  macroSectionHorizontal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  macroItemHorizontal: {
    flex: 1,
    alignItems: 'center',
  },
  macroHeaderHorizontal: {
    alignItems: 'center',
    marginBottom: 8,
  },
  macroLabelHorizontal: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  macroTargetHorizontal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  progressBarContainerHorizontal: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 6,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarHorizontal: {
    height: '100%',
    borderRadius: 4,
  },
  proteinBar: {
    backgroundColor: '#8B5CF6',
  },
  carbsBar: {
    backgroundColor: '#10B981',
  },
  fatBar: {
    backgroundColor: '#EF4444',
  },
  macroCurrentHorizontal: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  combinedProgressContainer: {
    marginTop: 10,
  },
  combinedProgressBar: {
    height: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 8,
  },
  combinedSegment: {
    height: '100%',
  },
  proteinSegment: {
    backgroundColor: '#8B5CF6',
    width: '5%',
  },
  carbsSegment: {
    backgroundColor: '#10B981',
    width: '85%',
  },
  fatSegment: {
    backgroundColor: '#EF4444',
    width: '10%',
  },
  combinedLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  combinedLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  nutritionLevelsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  nutritionLevelsHeader: {
    marginBottom: 10,
  },
  nutritionLevelsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  nutritionLevelsSubtitle: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  nutritionLevelsList: {
    gap: 12,
  },
  nutritionLevelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  nutritionLevelLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  nutritionLevelValue: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  content: {
    padding: 14,
  },
  mealNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 12,
  },
  mealName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#1a1a1a',
    textAlign: 'center',
    flex: 1,
  },
  editButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  categorySection: {
    alignItems: 'center',
    marginBottom: 25,
  },
  categoryBadge: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  nutritionInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  nutritionInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionInfoLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 5,
    marginBottom: 3,
    textAlign: 'center',
    fontWeight: '600',
  },
  nutritionInfoValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  descriptionSection: {
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    fontWeight: '500',
  },
  detailsSection: {
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  mealTypeSection: {
    marginBottom: 14,
  },
  mealTypeHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  detailItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailFoodName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
    lineHeight: 18,
  },
  detailQuantity: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
  },
  detailNutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 15,
  },
  detailCalories: {
    fontSize: 11,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  detailMacros: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
  },
  detailExtraRow: {
    marginLeft: 15,
    marginTop: 4,
  },
  detailExtraText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  assignButton: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 25,
    paddingHorizontal: 24,
    paddingVertical: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 100,
  },
  assignButtonDisabled: {
    opacity: 0.6,
  },
  assignButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  backButton: { 
    flexDirection: 'row', 
    bottom: '5%', 
    alignItems: 'center', 
    backgroundColor: '#222', 
    borderRadius: 20, 
    paddingHorizontal: 24, 
    paddingVertical: 10, 
    marginTop: 10, 
    alignSelf: 'center' 
  },
  backText: { 
    color: '#fff', 
    marginLeft: 8, 
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    width: '90%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalBody: {
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  inputField: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: '#f9f9f9',
    color: '#1a1a1a',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#888',
    fontWeight: '500',
    fontSize: 13,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3,
  },
});

export default NutritionDetailsScreen;
