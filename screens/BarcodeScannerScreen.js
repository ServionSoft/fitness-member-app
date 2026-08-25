import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Linking, TextInput } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Camera, useCameraDevice, useCodeScanner, useCameraPermission } from 'react-native-vision-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ModernAlert from '../components/ModernAlert';

const BarcodeScannerScreen = () => {
  const navigation = useNavigation();
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  
  const API_BASE_URL = ENV_API_BASE_URL;

  // Request camera permission
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    } else {
      setIsActive(true);
    }
  }, [hasPermission, requestPermission]);

  // Reactivate camera when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reactivate camera when screen is focused and has permission
      if (hasPermission && !loading) {
        setIsActive(true);
      }
      
      // Cleanup: deactivate camera when screen loses focus
      return () => {
        setIsActive(false);
      };
    }, [hasPermission, loading])
  );

  // Handle permission denied
  useEffect(() => {
    if (hasPermission === false) {
      setAlertConfig({
        title: 'Camera Permission Required',
        message: 'Please enable camera permission in settings to scan barcodes.',
        type: 'warning',
        buttons: [
          {
            text: 'Cancel',
            onPress: () => navigation.goBack(),
            style: 'secondary',
          },
          {
            text: 'Open Settings',
            onPress: () => {
              Linking.openSettings();
            },
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
    }
  }, [hasPermission, navigation]);

  // Barcode scanner configuration
  // Using most common food product barcode types
  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e'], // Most common barcode types for food products
    onCodeScanned: async (codes) => {
      if (codes.length > 0 && !loading && hasPermission) {
        const barcode = codes[0].value;
        console.log('Barcode scanned:', barcode);
        await fetchProductDetails(barcode);
      }
    }
  });

  // Fetch product details from Open Food Facts API
  const fetchProductDetails = async (barcode) => {
    setLoading(true);
    setIsActive(false); // Stop scanning
    
    try {
      // First try your backend API (if you have one)
      const userToken = await AsyncStorage.getItem('userToken');
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Try backend endpoint first
      try {
        const backendResponse = await fetch(`${API_BASE_URL}/mobile/nutrition/foods/barcode/${barcode}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader,
          },
        });

        if (backendResponse.ok) {
          const result = await backendResponse.json();
          
          if (result.success && result.data) {
            // Navigate to product details screen
            navigation.navigate('ProductDetails', { 
              product: result.data,
              barcode: barcode 
            });
            return;
          }
        }
      } catch (backendError) {
        console.log('Backend API not available, using Open Food Facts');
      }

      // Fallback to Open Food Facts API directly
      const openFoodFactsResponse = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        {
          headers: {
            'User-Agent': 'Thor Strength Fitness/1.0 - Android/iOS'
          }
        }
      );

      if (openFoodFactsResponse.ok) {
        const data = await openFoodFactsResponse.json();
        
        if (data.status === 1 && data.product) {
          const product = data.product;
          
          // Transform Open Food Facts data to your format
          const productData = {
            id: product.code || barcode,
            name: product.product_name || product.product_name_en || 'Unknown Product',
            barcode: product.code || barcode,
            brand: product.brands || '',
            image: product.image_url || product.image_front_url || product.image_front_small_url || null,
            
            // Nutrition per 100g
            calories: product.nutriments?.['energy-kcal_100g'] || 
                      product.nutriments?.['energy-kcal'] || 0,
            protein: product.nutriments?.proteins_100g || 
                     product.nutriments?.proteins || 0,
            carbs: product.nutriments?.carbohydrates_100g || 
                   product.nutriments?.carbohydrates || 0,
            fats: product.nutriments?.fat_100g || 
                  product.nutriments?.fat || 0,
            fiber: product.nutriments?.fiber_100g || 
                   product.nutriments?.fiber || 0,
            sugar: product.nutriments?.sugars_100g || 
                   product.nutriments?.sugars || 0,
            sodium: product.nutriments?.sodium_100g || 0,
            
            // Serving size info
            serving_size: product.serving_size || '100g',
            quantity: product.quantity || '',
            
            // Additional info
            ingredients: product.ingredients_text || product.ingredients_text_en || '',
            nutrition_grade: product.nutrition_grade_fr || product.nutriscore_grade || '',
            
            // Source
            source: 'openfoodfacts'
          };
          
          // Navigate to product details screen
          navigation.navigate('ProductDetails', { 
            product: productData,
            barcode: barcode 
          });
        } else {
          setAlertConfig({
            title: 'Product Not Found',
            message: 'This product is not available in the database. Please try scanning again or add manually.',
            type: 'warning',
            buttons: [
              {
                text: 'Try Again',
                onPress: () => {
                  setLoading(false);
                  setIsActive(true);
                },
                style: 'primary',
              },
              {
                text: 'Cancel',
                onPress: () => navigation.goBack(),
                style: 'secondary',
              },
            ],
          });
          setAlertVisible(true);
        }
      } else {
        throw new Error('API request failed');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to fetch product details. Please check your internet connection and try again.',
        type: 'error',
        buttons: [
          {
            text: 'Try Again',
            onPress: () => {
              setLoading(false);
              setIsActive(true);
            },
            style: 'primary',
          },
          {
            text: 'Cancel',
            onPress: () => navigation.goBack(),
            style: 'secondary',
          },
        ],
      });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle manual barcode entry
  const handleManualEntry = () => {
    if (manualBarcode.trim().length >= 8) { // Minimum barcode length
      fetchProductDetails(manualBarcode.trim());
      setManualEntryVisible(false);
      setManualBarcode('');
    } else {
      setAlertConfig({
        title: 'Invalid Barcode',
        message: 'Please enter a valid barcode (minimum 8 digits)',
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

  if (!device) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="camera-off" size={64} color="#999" />
          <Text style={styles.errorText}>Camera not available</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="camera-off" size={64} color="#999" />
          <Text style={styles.errorText}>Camera permission required</Text>
          <Text style={styles.errorSubtext}>Please enable camera permission to scan barcodes</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        codeScanner={codeScanner}
      />
      
      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Scan Barcode</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Scanning area */}
        <View style={styles.scanningArea}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.instructionText}>
            Position the barcode within the frame
          </Text>
        </View>

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Fetching product details...</Text>
          </View>
        )}

        {/* Manual Entry Button */}
        {!loading && (
          <View style={styles.bottomActions}>
            <TouchableOpacity 
              style={styles.manualEntryButton}
              onPress={() => setManualEntryVisible(true)}
            >
              <MaterialCommunityIcons name="keyboard" size={18} color="#fff" />
              <Text style={styles.manualEntryText}>Enter Barcode Manually</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Manual Entry Modal */}
      {manualEntryVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Barcode</Text>
              <TouchableOpacity 
                onPress={() => {
                  setManualEntryVisible(false);
                  setManualBarcode('');
                }}
              >
                <Ionicons name="close" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.barcodeInput}
              placeholder="Enter barcode number"
              placeholderTextColor="#999"
              value={manualBarcode}
              onChangeText={setManualBarcode}
              keyboardType="number-pad"
              autoFocus={true}
              maxLength={20}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setManualEntryVisible(false);
                  setManualBarcode('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.submitButton, manualBarcode.length < 8 && styles.submitButtonDisabled]}
                onPress={handleManualEntry}
                disabled={manualBarcode.length < 8}
              >
                <Text style={styles.submitButtonText}>Search</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scanningArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 180,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fff',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 30,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f8f2',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 30,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  manualEntryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  barcodeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#f7f8f2',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BarcodeScannerScreen;

