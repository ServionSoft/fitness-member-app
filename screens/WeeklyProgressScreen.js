import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import HeaderBar from '../components/HeaderBar';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import DatePicker from 'react-native-date-picker';
import { format, parseISO } from 'date-fns';
import ModernAlert from '../components/ModernAlert';

const { width: screenWidth } = Dimensions.get('window');

const WeeklyProgressScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerOffset = insets.top + 70;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [progressRecords, setProgressRecords] = useState([]);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });

  // Helper function to show modern alert
  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    body_fat: '',
    water_intake: '',
    hunger: '',
    strength: '',
    energy: '',
    meal_deviations: '',
    activities: '',
    feel: '',
    cardio_plan: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    notes: '',
  });

  const API_BASE_URL = ENV_API_BASE_URL;

  // Fetch progress records
  const fetchProgressRecords = async () => {
    try {
      setFetching(true);
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setFetching(false);
        return;
      }

      let authHeader = userToken.startsWith('Bearer ')
        ? userToken
        : `Bearer ${userToken}`;

      const response = await fetch(`${API_BASE_URL}/mobile/weekly-progress`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setProgressRecords(result.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching progress records:', error);
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchProgressRecords();
  }, []);

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchProgressRecords();
  };

  // Open form modal
  const openFormModal = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      weight: '',
      body_fat: '',
      water_intake: '',
      hunger: '',
      strength: '',
      energy: '',
      meal_deviations: '',
      activities: '',
      feel: '',
      cardio_plan: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      notes: '',
    });
    setFormModalVisible(true);
  };

  // Close form modal
  const closeFormModal = () => {
    setFormModalVisible(false);
  };

  // Open details modal and fetch details
  const openDetailsModal = async (record) => {
    setDetailsModalVisible(true);
    setLoadingDetails(true);
    setSelectedRecord(record); // Show basic info immediately
    
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        showAlert('Error', 'Authentication required', 'error');
        setLoadingDetails(false);
        return;
      }

      let authHeader = userToken.startsWith('Bearer ')
        ? userToken
        : `Bearer ${userToken}`;

      const response = await fetch(`${API_BASE_URL}/mobile/weekly-progress/${record.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          console.log('Fetched details:', result.data);
          setSelectedRecord(result.data);
        } else {
          console.log('API Response:', result);
          // Keep the basic record if API fails, but show error
          showAlert('Warning', result.message || 'Some details may not be available', 'error');
        }
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch details' }));
        console.log('API Error:', errorData);
        // Keep the basic record even if API fails
        showAlert('Warning', errorData.message || 'Some details may not be available', 'error');
      }
    } catch (error) {
      console.error('Error fetching progress details:', error);
      showAlert('Error', 'Network error occurred', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Close details modal
  const closeDetailsModal = () => {
    setDetailsModalVisible(false);
    setSelectedRecord(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDateConfirm = () => {
    setDatePickerVisible(false);
    setFormData(prev => ({
      ...prev,
      date: format(selectedDate, 'yyyy-MM-dd')
    }));
  };

  const handleDateCancel = () => {
    setDatePickerVisible(false);
  };

  const validateForm = () => {
    if (!formData.date) {
      showAlert('Error', 'Please select a date', 'error');
      return false;
    }
    return true;
  };

  const handleSaveProgress = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        showAlert('Error', 'Authentication required', 'error');
        setLoading(false);
        return;
      }

      let authHeader = userToken.startsWith('Bearer ')
        ? userToken
        : `Bearer ${userToken}`;

      // Prepare data - convert numeric fields and match backend field names (camelCase)
      const progressData = {
        date: formData.date,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        bodyFat: formData.body_fat ? parseFloat(formData.body_fat) : null,
        waterIntake: formData.water_intake ? parseFloat(formData.water_intake) : null,
        hunger: formData.hunger || null,
        strength: formData.strength || null,
        energy: formData.energy || null,
        mealDeviations: formData.meal_deviations || null,
        activities: formData.activities || null,
        feel: formData.feel || null,
        cardio: formData.cardio_plan || null,
        plan: formData.cardio_plan || null, // If backend needs both
        calories: formData.calories ? parseFloat(formData.calories) : null,
        protein: formData.protein ? parseFloat(formData.protein) : null,
        carb: formData.carbs ? parseFloat(formData.carbs) : null, // Backend uses 'carb' not 'carbs'
        fat: formData.fat ? parseFloat(formData.fat) : null,
        notes: formData.notes || null,
      };

      const response = await fetch(`${API_BASE_URL}/mobile/weekly-progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(progressData),
      });

      if (response.ok) {
        showAlert(
          'Success', 
          'Progress saved successfully!', 
          'success',
          [
            { 
              text: 'OK', 
              onPress: () => {
                closeFormModal();
                fetchProgressRecords();
              },
              style: 'primary'
            }
          ]
        );
      } else {
        const errorData = await response.json();
        console.log('Error data:', errorData);
        const errorMessages = errorData.errors
          ? Object.entries(errorData.errors)
              .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
              .join('\n')
          : errorData.message;
        showAlert('Error', errorMessages || 'Failed to save progress', 'error');
      }
    } catch (error) {
      console.error('Error saving progress:', error);
      showAlert('Error', 'Network error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar
        title="Weekly Progress"
        onBackPress={() => navigation.goBack()}
        showBack={true}
        showNotification={false}
      />
      
      {fetching && progressRecords.length === 0 ? (
        <View style={[styles.loadingContainer, { paddingTop: headerOffset }]}>
          <ActivityIndicator size="large" color="#222" />
        </View>
      ) : progressRecords.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingTop: headerOffset }]}>
          <MaterialCommunityIcons name="chart-line" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No progress records yet</Text>
          <Text style={styles.emptySubtext}>Tap the + icon to add your first progress entry</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerOffset }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#222']}
            />
          }
        >
            <View style={styles.recordsContainer}>
              {progressRecords.map((record) => (
                <TouchableOpacity
                  key={record.id}
                  style={styles.recordCard}
                  onPress={() => openDetailsModal(record)}
                  activeOpacity={0.7}
                >
                  <View style={styles.recordHeader}>
                    <View style={styles.recordDateContainer}>
                      <MaterialCommunityIcons name="calendar" size={18} color="#666" />
                      <Text style={styles.recordDate}>
                        {record.date ? format(parseISO(record.date), 'MMM dd, yyyy') : 'No date'}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
                  </View>
                  
                  <View style={styles.recordContent}>
                    {record.weight && (
                      <View style={styles.recordItem}>
                        <Text style={styles.recordLabel}>Weight:</Text>
                        <Text style={styles.recordValue}>{record.weight} kg</Text>
                      </View>
                    )}
                    {record.bodyFat && (
                      <View style={styles.recordItem}>
                        <Text style={styles.recordLabel}>Body Fat:</Text>
                        <Text style={styles.recordValue}>{record.bodyFat}%</Text>
                      </View>
                    )}
                    {record.waterIntake && (
                      <View style={styles.recordItem}>
                        <Text style={styles.recordLabel}>Water Intake:</Text>
                        <Text style={styles.recordValue}>{record.waterIntake} L</Text>
                      </View>
                    )}
                    {record.calories && (
                      <View style={styles.recordItem}>
                        <Text style={styles.recordLabel}>Calories:</Text>
                        <Text style={styles.recordValue}>{record.calories} kcal</Text>
                      </View>
                    )}
                    {(record.protein || record.carb || record.fat) && (
                      <View style={styles.recordItem}>
                        <Text style={styles.recordLabel}>Macros:</Text>
                        <Text style={styles.recordValue}>
                          {record.protein ? `P: ${record.protein}g` : ''}
                          {record.protein && record.carb ? ' • ' : ''}
                          {record.carb ? `C: ${record.carb}g` : ''}
                          {(record.protein || record.carb) && record.fat ? ' • ' : ''}
                          {record.fat ? `F: ${record.fat}g` : ''}
                        </Text>
                      </View>
                    )}
                    {record.notes && (
                      <View style={styles.recordItem}>
                        <Text style={styles.recordLabel}>Notes:</Text>
                        <Text style={styles.recordValue} numberOfLines={2}>{record.notes}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
        </ScrollView>
      )}

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={openFormModal}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Form Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={formModalVisible}
        onRequestClose={closeFormModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Track Your Progress</Text>
              <TouchableOpacity onPress={closeFormModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formContainer}>
          
          {/* Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                setSelectedDate(formData.date ? new Date(formData.date) : new Date());
                setDatePickerVisible(true);
              }}
            >
              <MaterialCommunityIcons name="calendar" size={20} color="#666" />
              <Text style={styles.dateText}>{formData.date || 'Select Date'}</Text>
            </TouchableOpacity>
          </View>

          {/* Weight */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.textInput}
              value={formData.weight}
              onChangeText={(text) => handleInputChange('weight', text)}
              placeholder="Enter weight"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Body Fat */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Body Fat (%)</Text>
            <TextInput
              style={styles.textInput}
              value={formData.body_fat}
              onChangeText={(text) => handleInputChange('body_fat', text)}
              placeholder="Enter body fat percentage"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Water Intake */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Water Intake (liters)</Text>
            <TextInput
              style={styles.textInput}
              value={formData.water_intake}
              onChangeText={(text) => handleInputChange('water_intake', text)}
              placeholder="Enter water intake"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Hunger */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Hunger</Text>
            <TextInput
              style={styles.textInput}
              value={formData.hunger}
              onChangeText={(text) => handleInputChange('hunger', text)}
              placeholder="Rate your hunger level"
              placeholderTextColor="#999"
            />
          </View>

          {/* Strength */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Strength</Text>
            <TextInput
              style={styles.textInput}
              value={formData.strength}
              onChangeText={(text) => handleInputChange('strength', text)}
              placeholder="Rate your strength level"
              placeholderTextColor="#999"
            />
          </View>

          {/* Energy */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Energy</Text>
            <TextInput
              style={styles.textInput}
              value={formData.energy}
              onChangeText={(text) => handleInputChange('energy', text)}
              placeholder="Rate your energy level"
              placeholderTextColor="#999"
            />
          </View>

          {/* Meal Deviations */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meal Deviations</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.meal_deviations}
              onChangeText={(text) => handleInputChange('meal_deviations', text)}
              placeholder="Note any meal deviations from plan"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Activities */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Activities</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.activities}
              onChangeText={(text) => handleInputChange('activities', text)}
              placeholder="List activities performed"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Feel */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Feel</Text>
            <TextInput
              style={styles.textInput}
              value={formData.feel}
              onChangeText={(text) => handleInputChange('feel', text)}
              placeholder="How do you feel today?"
              placeholderTextColor="#999"
            />
          </View>

          {/* Cardio Plan */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cardio Plan</Text>
            <TextInput
              style={styles.textInput}
              value={formData.cardio_plan}
              onChangeText={(text) => handleInputChange('cardio_plan', text)}
              placeholder="Cardio plan for the day"
              placeholderTextColor="#999"
            />
          </View>

          {/* Calories */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Calories</Text>
            <TextInput
              style={styles.textInput}
              value={formData.calories}
              onChangeText={(text) => handleInputChange('calories', text)}
              placeholder="Enter calories consumed"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Protein */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Protein (g)</Text>
            <TextInput
              style={styles.textInput}
              value={formData.protein}
              onChangeText={(text) => handleInputChange('protein', text)}
              placeholder="Enter protein intake"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Carbs */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Carbs (g)</Text>
            <TextInput
              style={styles.textInput}
              value={formData.carbs}
              onChangeText={(text) => handleInputChange('carbs', text)}
              placeholder="Enter carbs intake"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Fat */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Fat (g)</Text>
            <TextInput
              style={styles.textInput}
              value={formData.fat}
              onChangeText={(text) => handleInputChange('fat', text)}
              placeholder="Enter fat intake"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => handleInputChange('notes', text)}
              placeholder="Additional notes"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSaveProgress}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Progress</Text>
              </>
            )}
          </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailsModalVisible}
        onRequestClose={closeDetailsModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Progress Details</Text>
              <TouchableOpacity onPress={closeDetailsModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.detailsContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {selectedRecord && (
                <>
                  {/* Date */}
                  <View style={styles.detailsSection}>
                    <View style={styles.detailsHeader}>
                      <MaterialCommunityIcons name="calendar" size={20} color="#222" />
                      <Text style={styles.detailsSectionTitle}>Date</Text>
                    </View>
                    <Text style={styles.detailsValue}>
                      {selectedRecord.date ? format(parseISO(selectedRecord.date), 'EEEE, MMMM dd, yyyy') : 'No date'}
                    </Text>
                  </View>

                  {/* Body Metrics */}
                  <View style={styles.detailsSection}>
                    <View style={styles.detailsHeader}>
                      <MaterialCommunityIcons name="human" size={20} color="#222" />
                      <Text style={styles.detailsSectionTitle}>Body Metrics</Text>
                    </View>
                    {selectedRecord.weight != null ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Weight:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.weight} kg</Text>
                      </View>
                    ) : (
                      <Text style={styles.noDataText}>No weight data</Text>
                    )}
                    {selectedRecord.bodyFat != null ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Body Fat:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.bodyFat}%</Text>
                      </View>
                    ) : null}
                    {selectedRecord.waterIntake != null ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Water Intake:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.waterIntake} L</Text>
                      </View>
                    ) : null}
                    {!selectedRecord.weight && !selectedRecord.bodyFat && !selectedRecord.waterIntake && (
                      <Text style={styles.noDataText}>No body metrics recorded</Text>
                    )}
                  </View>

                  {/* Nutrition */}
                  <View style={styles.detailsSection}>
                    <View style={styles.detailsHeader}>
                      <MaterialCommunityIcons name="food-apple" size={20} color="#222" />
                      <Text style={styles.detailsSectionTitle}>Nutrition</Text>
                    </View>
                    {selectedRecord.calories != null ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Calories:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.calories} kcal</Text>
                      </View>
                    ) : null}
                    {selectedRecord.protein != null ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Protein:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.protein} g</Text>
                      </View>
                    ) : null}
                    {selectedRecord.carb != null ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Carbs:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.carb} g</Text>
                      </View>
                    ) : null}
                    {selectedRecord.fat != null ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Fat:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.fat} g</Text>
                      </View>
                    ) : null}
                    {!selectedRecord.calories && !selectedRecord.protein && !selectedRecord.carb && !selectedRecord.fat && (
                      <Text style={styles.noDataText}>No nutrition data recorded</Text>
                    )}
                  </View>

                  {/* Energy & Feelings */}
                  <View style={styles.detailsSection}>
                    <View style={styles.detailsHeader}>
                      <MaterialCommunityIcons name="heart-pulse" size={20} color="#222" />
                      <Text style={styles.detailsSectionTitle}>Energy & Feelings</Text>
                    </View>
                    {selectedRecord.hunger ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Hunger:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.hunger}</Text>
                      </View>
                    ) : null}
                    {selectedRecord.strength ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Strength:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.strength}</Text>
                      </View>
                    ) : null}
                    {selectedRecord.energy ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Energy:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.energy}</Text>
                      </View>
                    ) : null}
                    {selectedRecord.feel ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Feel:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.feel}</Text>
                      </View>
                    ) : null}
                    {!selectedRecord.hunger && !selectedRecord.strength && !selectedRecord.energy && !selectedRecord.feel && (
                      <Text style={styles.noDataText}>No energy & feelings data recorded</Text>
                    )}
                  </View>

                  {/* Activities & Cardio */}
                  <View style={styles.detailsSection}>
                    <View style={styles.detailsHeader}>
                      <MaterialCommunityIcons name="dumbbell" size={20} color="#222" />
                      <Text style={styles.detailsSectionTitle}>Activities & Cardio</Text>
                    </View>
                    {selectedRecord.activities ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Activities:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.activities}</Text>
                      </View>
                    ) : null}
                    {selectedRecord.cardio ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Cardio Plan:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.cardio}</Text>
                      </View>
                    ) : null}
                    {selectedRecord.plan ? (
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Plan:</Text>
                        <Text style={styles.detailsValue}>{selectedRecord.plan}</Text>
                      </View>
                    ) : null}
                    {!selectedRecord.activities && !selectedRecord.cardio && !selectedRecord.plan && (
                      <Text style={styles.noDataText}>No activities data recorded</Text>
                    )}
                  </View>

                  {/* Meal Deviations */}
                  <View style={styles.detailsSection}>
                    <View style={styles.detailsHeader}>
                      <MaterialCommunityIcons name="food-off" size={20} color="#222" />
                      <Text style={styles.detailsSectionTitle}>Meal Deviations</Text>
                    </View>
                    {selectedRecord.mealDeviations ? (
                      <Text style={styles.detailsTextValue}>{selectedRecord.mealDeviations}</Text>
                    ) : (
                      <Text style={styles.noDataText}>No meal deviations recorded</Text>
                    )}
                  </View>

                  {/* Notes */}
                  <View style={styles.detailsSection}>
                    <View style={styles.detailsHeader}>
                      <MaterialCommunityIcons name="note-text" size={20} color="#222" />
                      <Text style={styles.detailsSectionTitle}>Notes</Text>
                    </View>
                    {selectedRecord.notes ? (
                      <Text style={styles.detailsTextValue}>{selectedRecord.notes}</Text>
                    ) : (
                      <Text style={styles.noDataText}>No notes recorded</Text>
                    )}
                  </View>

                  {/* Meal Details */}
                  {loadingDetails ? (
                    <View style={styles.detailsSection}>
                      <ActivityIndicator size="large" color="#222" />
                      <Text style={styles.loadingText}>Loading meal details...</Text>
                    </View>
                  ) : selectedRecord.mealDetails && Object.keys(selectedRecord.mealDetails).length > 0 ? (
                    <View style={styles.detailsSection}>
                      <View style={styles.detailsHeader}>
                        <MaterialCommunityIcons name="silverware-fork-knife" size={20} color="#222" />
                        <Text style={styles.detailsSectionTitle}>Meal Details</Text>
                      </View>
                      {Object.entries(selectedRecord.mealDetails).map(([nutritionType, foods]) => (
                        <View key={nutritionType} style={styles.mealTypeContainer}>
                          <Text style={styles.mealTypeTitle}>
                            {nutritionType.charAt(0).toUpperCase() + nutritionType.slice(1)}
                          </Text>
                          {foods.map((food, index) => (
                            <View key={food.id || index} style={styles.mealItem}>
                              <Text style={styles.mealItemName}>{food.foodName}</Text>
                              <View style={styles.mealItemDetails}>
                                {food.quantity && (
                                  <Text style={styles.mealItemDetail}>
                                    Qty: {food.quantity} {food.unit || ''}
                                  </Text>
                                )}
                                {food.calories && (
                                  <Text style={styles.mealItemDetail}>
                                    {food.calories} kcal
                                  </Text>
                                )}
                                {(food.protein || food.carbs || food.fats) && (
                                  <Text style={styles.mealItemDetail}>
                                    {food.protein ? `P: ${food.protein}g` : ''}
                                    {food.protein && food.carbs ? ' • ' : ''}
                                    {food.carbs ? `C: ${food.carbs}g` : ''}
                                    {(food.protein || food.carbs) && food.fats ? ' • ' : ''}
                                    {food.fats ? `F: ${food.fats}g` : ''}
                                  </Text>
                                )}
                              </View>
                              {food.notes && (
                                <Text style={styles.mealItemNotes}>{food.notes}</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={datePickerVisible}
        onRequestClose={handleDateCancel}
      >
        <View style={styles.datePickerOverlay}>
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Select Date</Text>
              <TouchableOpacity onPress={handleDateCancel} style={styles.datePickerCloseButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.datePickerWrapper}>
              <DatePicker
                date={selectedDate}
                onDateChange={setSelectedDate}
                mode="date"
                maximumDate={new Date()}
                style={styles.datePicker}
                theme={Platform.OS === 'ios' ? 'light' : 'light'}
                textColor="#222"
                fadeToColor="none"
              />
            </View>
            
            <View style={styles.datePickerButtons}>
              <TouchableOpacity 
                style={styles.datePickerCancelButton}
                onPress={handleDateCancel}
              >
                <Text style={styles.datePickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.datePickerConfirmButton}
                onPress={handleDateConfirm}
              >
                <Text style={styles.datePickerConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    backgroundColor: '#fafaf8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#222',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  dateButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateText: {
    fontSize: 16,
    color: '#222',
  },
  saveButton: {
    backgroundColor: '#222',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#999',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // Date Picker Styles
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    width: '100%',
    alignItems: 'center',
    minHeight: Platform.OS === 'ios' ? 320 : 280,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eceee7',
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  datePickerCloseButton: {
    padding: 4,
  },
  datePickerWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: Platform.OS === 'ios' ? 200 : 180,
  },
  datePicker: {
    width: screenWidth,
    height: Platform.OS === 'ios' ? 200 : 180,
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 12,
  },
  datePickerCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  datePickerCancelText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  datePickerConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
  },
  datePickerConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Floating Add Button
  floatingAddButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Loading Container
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  // Records Container
  recordsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recordHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  recordContent: {
    gap: 8,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recordLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    minWidth: 100,
  },
  recordValue: {
    fontSize: 14,
    color: '#222',
    flex: 1,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fafaf8',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.9,
    height: Dimensions.get('window').height * 0.85,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    flexGrow: 1,
  },
  modalScrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  // Details Modal Styles
  detailsContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  detailsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  detailsValue: {
    fontSize: 14,
    color: '#222',
    flex: 1,
    textAlign: 'right',
  },
  detailsTextValue: {
    fontSize: 14,
    color: '#222',
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  mealTypeContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  mealTypeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  mealItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  mealItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 6,
  },
  mealItemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  mealItemDetail: {
    fontSize: 12,
    color: '#666',
  },
  mealItemNotes: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
});

export default WeeklyProgressScreen;

