import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_URL } from '@env';
import { getAuthToken } from '../utils/tokenUtils';
import ModernAlert from '../components/ModernAlert';

const { width: screenWidth } = Dimensions.get('window');

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', icon: 'weather-sunny' },
  { key: 'snack_morning', label: 'Snacks (Morning)', icon: 'coffee' },
  { key: 'lunch', label: 'Lunch', icon: 'weather-sunset' },
  { key: 'snack_afternoon', label: 'Snacks (Afternoon)', icon: 'cookie' },
  { key: 'dinner', label: 'Dinner', icon: 'weather-night' },
  { key: 'snack_evening', label: 'Snacks (Evening)', icon: 'food-apple' },
];

const ProductDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { product } = route.params || {};
  const [nutritionModalVisible, setNutritionModalVisible] = useState(false);
  const [mealModalVisible, setMealModalVisible] = useState(false);
  const [assignedNutritions, setAssignedNutritions] = useState([]);
  const [loadingNutritions, setLoadingNutritions] = useState(false);
  const [selectedNutrition, setSelectedNutrition] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedFood, setSavedFood] = useState(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlertConfig({
      title,
      message,
      type,
      buttons:
        buttons.length > 0
          ? buttons
          : [{ text: 'OK', onPress: () => {}, style: 'primary' }],
    });
    setAlertVisible(true);
  };

  if (!product) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Product not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const servingLabel =
    product.serving_size || product.serving_description || '100g';

  const buildFoodFromProduct = (saved = null) => {
    const src = saved || product;
    const name = src.name || src.food_name || 'Scanned Product';
    const foodId = src.id || src.food_id || src.barcode || `barcode-${Date.now()}`;

    return {
      id: foodId,
      food_id: foodId,
      name,
      food_name: name,
      calories: parseFloat(src.calories || src.kcal || 0) || 0,
      protein: parseFloat(src.protein || src.protein_g || 0) || 0,
      carbs: parseFloat(src.carbs || src.carbohydrate || src.carbohydrates || 0) || 0,
      fats: parseFloat(src.fats || src.fat || 0) || 0,
      fiber: parseFloat(src.fiber || src.fiber_g || 0) || 0,
      sugar: parseFloat(src.sugar || src.sugars || 0) || 0,
      sodium: parseFloat(src.sodium || src.sodium_mg || 0) || 0,
      serving_size_g: 100,
      serving_grams: 100,
      barcode: src.barcode || product.barcode || null,
      image: src.image || product.image || null,
      brand: src.brand || product.brand || null,
      source: src.source || product.source || 'barcode',
    };
  };

  /**
   * Ensure product exists in backend `foods` table; return mapped food with real DB id.
   * Same flow as coach: POST from-barcode / foods.
   */
  const saveProductToFoodsLibrary = async () => {
    if (savedFood) {
      return savedFood;
    }

    const authHeader = await getAuthToken();
    if (!authHeader) {
      throw new Error('Please login again to save this food.');
    }

    const existingId = product.id || product.food_id;
    if (
      product.source === 'database' &&
      existingId &&
      String(existingId).match(/^\d+$/)
    ) {
      const mapped = buildFoodFromProduct(product);
      setSavedFood(mapped);
      return mapped;
    }

    const barcode = String(product.barcode || '').replace(/[^0-9]/g, '');

    if (barcode.length >= 8) {
      const fromBarcodeUrl = `${API_BASE_URL}/mobile/nutrition/foods/from-barcode`;
      console.log('[ProductDetails] POST from-barcode', { url: fromBarcodeUrl, barcode });
      const response = await fetch(fromBarcodeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({ barcode }),
      });
      const json = await response.json().catch(() => ({}));
      console.log('[ProductDetails] from-barcode response', {
        status: response.status,
        ok: response.ok,
        json,
      });
      if (response.ok && json.success && json.data) {
        const mapped = buildFoodFromProduct(json.data);
        setSavedFood(mapped);
        return mapped;
      }
      console.warn('[ProductDetails] from-barcode failed, falling back to POST /foods', {
        status: response.status,
        message: json?.message,
        errors: json?.errors,
        json,
      });
    }

    const createPayload = {
      name: product.name || product.food_name || 'Scanned Product',
      barcode: product.barcode || null,
      brand: product.brand || null,
      description: product.ingredients || product.brand || null,
      calories: product.calories || 0,
      protein: product.protein || 0,
      carbs: product.carbs || 0,
      fats: product.fats || 0,
      fiber: product.fiber || 0,
      sugar: product.sugar || 0,
      sodium: product.sodium || 0,
      image: product.image || null,
      serving_size: product.serving_size || '100g',
    };
    const createUrl = `${API_BASE_URL}/mobile/nutrition/foods`;
    console.log('[ProductDetails] POST /foods', { url: createUrl, payload: createPayload });

    const response = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(createPayload),
    });

    const json = await response.json().catch(() => ({}));
    console.log('[ProductDetails] /foods response', {
      status: response.status,
      ok: response.ok,
      json,
    });
    if (!response.ok || !json.success || !json.data) {
      console.error('[ProductDetails] Save food failed', {
        status: response.status,
        message: json?.message,
        errors: json?.errors,
        json,
      });
      throw new Error(json.message || 'Failed to save food to library');
    }

    const mapped = buildFoodFromProduct(json.data);
    setSavedFood(mapped);
    return mapped;
  };

  /** Coach: Save to database */
  const handleSaveToDatabase = async () => {
    setSaving(true);
    try {
      await saveProductToFoodsLibrary();
      showAlert('Saved', 'Food saved to database.', 'success', [
        {
          text: 'OK',
          style: 'primary',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('[ProductDetails] Save to database error:', error);
      console.error('[ProductDetails] Error message:', error?.message);
      console.error('[ProductDetails] Error stack:', error?.stack);
      showAlert(
        'Could not save food',
        error?.message || 'Please try again.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const fetchAssignedNutritions = async () => {
    const authHeader = await getAuthToken();
    if (!authHeader) {
      throw new Error('Please login again.');
    }

    const response = await fetch(
      `${API_BASE_URL}/mobile/nutrition/assigned-meals`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
      },
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json.message || 'Failed to load assigned nutritions');
    }
    const meals = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
    // Newest / most recently updated first
    return [...meals].sort((a, b) => {
      const timeA = Date.parse(a?.updated_at || a?.created_at || a?.date || a?.start_date || '') || 0;
      const timeB = Date.parse(b?.updated_at || b?.created_at || b?.date || b?.start_date || '') || 0;
      if (timeB !== timeA) return timeB - timeA;
      return (b?.id || 0) - (a?.id || 0);
    });
  };

  const getNutritionTitle = (nutrition) =>
    nutrition?.template?.name ||
    nutrition?.name ||
    nutrition?.meal_name ||
    'Nutrition plan';

  const getNutritionSubtitle = (nutrition) => {
    const parts = [];
    if (nutrition?.date) parts.push(String(nutrition.date));
    else if (nutrition?.start_date) {
      parts.push(
        nutrition.end_date
          ? `${nutrition.start_date} → ${nutrition.end_date}`
          : String(nutrition.start_date),
      );
    }
    const calories =
      nutrition?.template?.calories || nutrition?.calories;
    if (calories) parts.push(`${calories} cal`);
    return parts.join(' · ');
  };

  /**
   * Save & Add to Template:
   * 1) save food to DB
   * 2) pick assigned nutrition
   * 3) pick meal type (breakfast/dinner/…)
   * 4) open that nutrition in edit mode with food added
   */
  const handleSaveAndAddToTemplate = async () => {
    setSaving(true);
    setLoadingNutritions(true);
    try {
      await saveProductToFoodsLibrary();
      const meals = await fetchAssignedNutritions();
      if (!meals.length) {
        showAlert(
          'No nutrition found',
          'No assigned nutrition plans found for your account.',
          'warning',
        );
        return;
      }
      setAssignedNutritions(meals);
      setSelectedNutrition(null);
      setNutritionModalVisible(true);
    } catch (error) {
      console.error('[ProductDetails] Save & Add to Template error:', error);
      showAlert(
        'Could not continue',
        error?.message || 'Please try again.',
        'error',
      );
    } finally {
      setLoadingNutritions(false);
      setSaving(false);
    }
  };

  const handleSelectNutrition = (nutrition) => {
    setSelectedNutrition(nutrition);
    setNutritionModalVisible(false);
    setMealModalVisible(true);
  };

  const handleAddToMeal = (nutritionType) => {
    if (!selectedNutrition) {
      showAlert('Error', 'Please select a nutrition plan first.', 'error');
      return;
    }

    const food = savedFood || buildFoodFromProduct(product);
    setMealModalVisible(false);

    navigation.navigate('CreateNutrition', {
      editMode: true,
      nutritionData: selectedNutrition,
      assignedMealId: selectedNutrition.id,
      selectedFoods: [food],
      nutritionType,
      // Keep existing meal foods; only append the scanned item
      appendSelectedFoods: true,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Scanned Food Details</Text>
        <TouchableOpacity
          style={styles.closeIconBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={22} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {product.image ? (
          <Image
            source={{ uri: product.image }}
            style={styles.productImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons name="food-apple-outline" size={64} color="#ccc" />
          </View>
        )}

        <View style={styles.nameBox}>
          <Text style={styles.productName}>{product.name || 'Unknown Product'}</Text>
        </View>

        {product.brand ? (
          <Text style={styles.metaLine}>
            <Text style={styles.metaLabel}>Brand: </Text>
            {product.brand}
          </Text>
        ) : null}

        {product.barcode ? (
          <Text style={styles.metaLine}>
            <Text style={styles.metaLabel}>Barcode: </Text>
            {product.barcode}
          </Text>
        ) : null}

        <Text style={styles.servingNote}>
          Nutritional Information (per {servingLabel} Serving Size)
        </Text>

        <View style={styles.nutritionGrid}>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{Math.round(product.calories || 0)}</Text>
            <Text style={styles.nutritionLabel}>Calories</Text>
            <Text style={styles.nutritionUnit}>cal</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>
              {Number(product.protein || 0).toFixed(1)}
            </Text>
            <Text style={styles.nutritionLabel}>Protein</Text>
            <Text style={styles.nutritionUnit}>g</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>
              {Number(product.carbs || 0).toFixed(1)}
            </Text>
            <Text style={styles.nutritionLabel}>Carbs</Text>
            <Text style={styles.nutritionUnit}>g</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>
              {Number(product.fats || 0).toFixed(1)}
            </Text>
            <Text style={styles.nutritionLabel}>Fat</Text>
            <Text style={styles.nutritionUnit}>g</Text>
          </View>
        </View>
      </ScrollView>

      {/* Coach-style actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={handleSaveToDatabase}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Save to database</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, saving && styles.buttonDisabled]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Text style={styles.secondaryButtonText}>Close</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButtonHalf, saving && styles.buttonDisabled]}
            onPress={handleSaveAndAddToTemplate}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>Save & Add to Template</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Step 1: pick assigned nutrition */}
      <Modal
        visible={nutritionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNutritionModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setNutritionModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select nutrition</Text>
            <Text style={styles.modalSubtitle}>
              Choose which assigned plan to add “{product.name || 'this product'}” to
            </Text>
            {loadingNutritions ? (
              <ActivityIndicator color="#222" style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {assignedNutritions.map((nutrition) => (
                  <TouchableOpacity
                    key={String(nutrition.id)}
                    style={styles.mealRow}
                    onPress={() => handleSelectNutrition(nutrition)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.mealIconWrap}>
                      <MaterialCommunityIcons
                        name="food-variant"
                        size={22}
                        color="#2E7D32"
                      />
                    </View>
                    <View style={styles.nutritionTextWrap}>
                      <Text style={styles.mealLabel} numberOfLines={1}>
                        {getNutritionTitle(nutrition)}
                      </Text>
                      {!!getNutritionSubtitle(nutrition) && (
                        <Text style={styles.nutritionSubLabel} numberOfLines={1}>
                          {getNutritionSubtitle(nutrition)}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setNutritionModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Step 2: pick breakfast / lunch / dinner */}
      <Modal
        visible={mealModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMealModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMealModalVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add to meal</Text>
            <Text style={styles.modalSubtitle}>
              {selectedNutrition
                ? `Add to “${getNutritionTitle(selectedNutrition)}”`
                : `Choose where to add “${product.name || 'this product'}”`}
            </Text>
            {MEAL_TYPES.map((meal) => (
              <TouchableOpacity
                key={meal.key}
                style={styles.mealRow}
                onPress={() => handleAddToMeal(meal.key)}
                activeOpacity={0.7}
              >
                <View style={styles.mealIconWrap}>
                  <MaterialCommunityIcons name={meal.icon} size={22} color="#2E7D32" />
                </View>
                <Text style={styles.mealLabel}>{meal.label}</Text>
                <Ionicons name="chevron-forward" size={18} color="#999" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setMealModalVisible(false);
                setNutritionModalVisible(true);
              }}
            >
              <Text style={styles.cancelButtonText}>Back</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
    backgroundColor: '#fff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  closeIconBtn: {
    position: 'absolute',
    right: 16,
    top: 50,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 160,
    alignItems: 'center',
  },
  productImage: {
    width: screenWidth * 0.45,
    height: screenWidth * 0.45,
    marginBottom: 16,
  },
  imagePlaceholder: {
    width: screenWidth * 0.45,
    height: screenWidth * 0.45,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  nameBox: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  metaLine: {
    width: '100%',
    fontSize: 14,
    color: '#444',
    marginBottom: 6,
  },
  metaLabel: {
    fontWeight: '700',
    color: '#222',
  },
  servingNote: {
    width: '100%',
    fontSize: 13,
    color: '#666',
    marginTop: 16,
    marginBottom: 14,
    fontWeight: '500',
  },
  nutritionGrid: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  nutritionUnit: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  primaryButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: 10,
  },
  primaryButtonHalf: {
    flex: 1.4,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginLeft: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryButton: {
    flex: 0.8,
    backgroundColor: '#e8e8e8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
    maxHeight: '75%',
  },
  modalList: {
    maxHeight: 360,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#777',
    marginBottom: 16,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  mealIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nutritionTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  mealLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  nutritionSubLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
});

export default ProductDetailsScreen;
