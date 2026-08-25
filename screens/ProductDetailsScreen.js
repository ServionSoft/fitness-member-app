import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: screenWidth } = Dimensions.get('window');

const ProductDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { product } = route.params;

  // Helper function to get color for nutrition grade
  const getGradeColor = (grade) => {
    const colors = {
      'a': '#4CAF50',
      'b': '#8BC34A',
      'c': '#FFC107',
      'd': '#FF9800',
      'e': '#F44336',
    };
    return colors[grade.toLowerCase()] || '#666';
  };

  return (
    <View style={styles.container}>
      {/* Top Back Button */}
      <TouchableOpacity 
        style={styles.topBackButton} 
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={20} color="#222" />
      </TouchableOpacity>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Product Image */}
        {product.image ? (
          <Image 
            source={{ uri: product.image }} 
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons name="food-apple-outline" size={64} color="#ccc" />
          </View>
        )}

        {/* Header Card */}
        <View style={styles.headerCard}>
          {product.brand && (
            <Text style={styles.brand}>{product.brand}</Text>
          )}
          
          <Text style={styles.productName}>{product.name || 'Unknown Product'}</Text>
          
          {product.barcode && (
            <View style={styles.barcodeContainer}>
              <MaterialCommunityIcons name="barcode" size={12} color="#999" />
              <Text style={styles.barcode}>{product.barcode}</Text>
            </View>
          )}
        </View>

        {/* Nutrition Info Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Nutrition (per 100g)</Text>
          
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <MaterialCommunityIcons name="fire" size={18} color="#FF6B35" />
              <Text style={styles.nutritionValue} numberOfLines={1}>{Math.round(product.calories || 0)}</Text>
              <Text style={styles.nutritionLabel} numberOfLines={1}>Calories</Text>
            </View>
            
            <View style={styles.nutritionItem}>
              <MaterialCommunityIcons name="water" size={18} color="#4CAF50" />
              <Text style={styles.nutritionValue} numberOfLines={1}>{Math.round(product.protein || 0)}g</Text>
              <Text style={styles.nutritionLabel} numberOfLines={1}>Protein</Text>
            </View>
            
            <View style={styles.nutritionItem}>
              <MaterialCommunityIcons name="circle-multiple" size={18} color="#2196F3" />
              <Text style={styles.nutritionValue} numberOfLines={1}>{Math.round(product.carbs || 0)}g</Text>
              <Text style={styles.nutritionLabel} numberOfLines={1}>Carbs</Text>
            </View>
            
            <View style={styles.nutritionItem}>
              <MaterialCommunityIcons name="oil" size={18} color="#757575" />
              <Text style={styles.nutritionValue} numberOfLines={1}>{Math.round(product.fats || 0)}g</Text>
              <Text style={styles.nutritionLabel} numberOfLines={1}>Fat</Text>
            </View>
          </View>

          {/* Additional nutrition details */}
          {(product.fiber > 0 || product.sugar > 0 || product.sodium > 0) && (
            <View style={styles.additionalNutrition}>
              {product.fiber > 0 && (
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionRowLabel}>Fiber</Text>
                  <Text style={styles.nutritionRowValue}>{Math.round(product.fiber)}g</Text>
                </View>
              )}
              
              {product.sugar > 0 && (
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionRowLabel}>Sugar</Text>
                  <Text style={styles.nutritionRowValue}>{Math.round(product.sugar)}g</Text>
                </View>
              )}
              
              {product.sodium > 0 && (
                <View style={styles.nutritionRow}>
                  <Text style={styles.nutritionRowLabel}>Sodium</Text>
                  <Text style={styles.nutritionRowValue}>{Math.round(product.sodium)}mg</Text>
                </View>
              )}
            </View>
          )}

          {product.nutrition_grade && (
            <View style={styles.gradeContainer}>
              <Text style={styles.gradeLabel}>Nutrition Grade</Text>
              <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(product.nutrition_grade) + '20' }]}>
                <Text style={[styles.gradeValue, { color: getGradeColor(product.nutrition_grade) }]}>
                  {product.nutrition_grade.toUpperCase()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Ingredients Card */}
        {product.ingredients && product.ingredients.trim() && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Ingredients</Text>
            <Text style={styles.ingredientsText}>{product.ingredients}</Text>
          </View>
        )}

        {/* Additional Info */}
        {product.quantity && (
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="scale" size={16} color="#666" />
            <Text style={styles.infoText}>Quantity: {product.quantity}</Text>
          </View>
        )}

        {/* Source Info */}
        {product.source === 'openfoodfacts' && (
          <View style={styles.sourceCard}>
            <MaterialCommunityIcons name="information-outline" size={14} color="#999" />
            <Text style={styles.sourceText}>Data provided by Open Food Facts</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
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
  scrollContent: {
    paddingBottom: 40,
  },
  productImage: {
    width: screenWidth,
    height: 260,
    backgroundColor: '#fff',
  },
  imagePlaceholder: {
    width: screenWidth,
    height: 260,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    backgroundColor: '#fff',
    marginHorizontal: '5%',
    marginTop: -25,
    borderRadius: 16,
    padding: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 20,
  },
  productName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 2,
    marginBottom: 10,
    letterSpacing: 0.1,
    lineHeight: 26,
  },
  brand: {
    fontSize: 11,
    color: '#999',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  barcode: {
    fontSize: 10,
    color: '#999',
    marginLeft: 6,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: '5%',
    marginBottom: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 18,
    letterSpacing: 0.2,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  nutritionItem: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    minWidth: 0,
    maxWidth: '25%',
  },
  nutritionValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 6,
    marginBottom: 3,
    textAlign: 'center',
  },
  nutritionLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  additionalNutrition: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
    marginTop: 8,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  nutritionRowLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  nutritionRowValue: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  gradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  gradeLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  gradeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  gradeValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  ingredientsText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: '5%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: '5%',
    marginTop: 8,
  },
  sourceText: {
    fontSize: 11,
    color: '#999',
    marginLeft: 6,
    fontWeight: '500',
  },
});

export default ProductDetailsScreen;
