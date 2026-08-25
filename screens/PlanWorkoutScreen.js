import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DatePicker from 'react-native-date-picker';
import { format, addWeeks, addDays } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

const { width: screenWidth } = Dimensions.get('window');

const PlanWorkoutScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { workout } = route.params || {};
  
  const [startDate, setStartDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [weeksPickerVisible, setWeeksPickerVisible] = useState(false);
  const [numberOfWeeks, setNumberOfWeeks] = useState(1);
  const [selectedDays, setSelectedDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });

  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = API_BASE_URL.replace('/api', '');

  const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const weekDaysFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weeksOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Calculate end date
  const endDate = addWeeks(startDate, numberOfWeeks);

  // Get available days from workout
  useEffect(() => {
    if (workout) {
      let workoutDays = [];
      if (workout.days && Array.isArray(workout.days)) {
        workoutDays = workout.days.map(day => day.day);
      } else if (workout.workout_days && Array.isArray(workout.workout_days)) {
        workoutDays = workout.workout_days.map(day => day.day);
      }
      
      // Map full day names to short names
      const mappedDays = workoutDays.map(day => {
        const dayIndex = weekDaysFull.indexOf(day);
        return dayIndex !== -1 ? weekDays[dayIndex] : null;
      }).filter(Boolean);
      
      // If workout has specific days, use them; otherwise default to all days
      if (mappedDays.length > 0) {
        setSelectedDays(mappedDays);
      } else {
        // Default to all days if no specific days in workout
        setSelectedDays(weekDays);
      }
    }
  }, [workout]);

  const handleDateConfirm = (date) => {
    setStartDate(date);
    setDatePickerVisible(false);
  };

  const toggleDay = (day) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const handlePlanWorkout = async () => {
    if (selectedDays.length === 0) {
      setAlertConfig({
        title: 'Error',
        message: 'Please select at least one workout day',
        type: 'error',
        buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
      });
      setAlertVisible(true);
      return;
    }

    try {
      setLoading(true);
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setAlertConfig({
          title: 'Error',
          message: 'Authentication required',
          type: 'error',
          buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
        });
        setAlertVisible(true);
        setLoading(false);
        return;
      }

      let authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;

      // Map short day names back to full day names
      const fullDayNames = selectedDays.map(day => {
        const dayIndex = weekDays.indexOf(day);
        return dayIndex !== -1 ? weekDaysFull[dayIndex] : null;
      }).filter(Boolean);

      // Prepare assignment data
      const workoutId = workout?.id || workout?.workout_id;
      if (!workoutId) {
        throw new Error('Workout ID is required');
      }

      // Call assignment API - Using mobile member-specific endpoint
      // POST /api/mobile/member-workouts/assign
      // This creates a WorkoutAssignment that will appear in GET /api/mobile/member-workouts
      const response = await fetch(`${API_BASE_URL}/mobile/member-workouts/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          workout_id: workoutId,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          notes: `Workout planned for ${numberOfWeeks} week(s). Selected days: ${fullDayNames.join(', ')}`,
          // Note: Days are part of the workout structure, not the assignment
          // The assignment links the workout to the member with start/end dates
          // This will create a WorkoutAssignment that shows in /mobile/member-workouts
        }),
      });

      // Check if response is ok before parsing JSON
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error('Invalid response from server');
      }

      if (response.ok) {
        setAlertConfig({
          title: 'Success',
          message: 'Workout planned successfully! It will now appear in your assigned workouts.',
          type: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to previous screen
                navigation.goBack();
              },
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      } else {
        // Handle different error scenarios
        const errorMessage = data.message || data.error || data.errors?.workout_id?.[0] || 'Failed to plan workout';
        throw new Error(errorMessage);
      }
    } catch (error) {
      setAlertConfig({
        title: 'Error',
        message: error.message || 'Failed to plan workout. Please try again.',
        type: 'error',
        buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
      });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Workout</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Workout Info Section */}
        <View style={styles.workoutInfoContainer}>
          {workout?.thumbnail ? (
            <Image
              source={{
                uri: workout.thumbnail.startsWith('http')
                  ? workout.thumbnail
                  : `${BASE_URL}/${workout.thumbnail}`,
              }}
              style={styles.workoutImage}
            />
          ) : (
            <View style={styles.workoutImagePlaceholder}>
              <MaterialCommunityIcons name="dumbbell" size={40} color="#ccc" />
            </View>
          )}
          <View style={styles.workoutTextContainer}>
            <Text style={styles.workoutName}>
              {workout?.exercise_name || workout?.name || workout?.workout_name || 'Workout'}
            </Text>
            <Text style={styles.workoutLevel}>
              {workout?.level || 'Intermediate'}
            </Text>
          </View>
        </View>

        {/* Select Start Date */}
        <View style={styles.section}>
          <Text style={styles.label}>Select a start date</Text>
          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setDatePickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.inputText}>{format(startDate, 'd MMM yyyy')}</Text>
            <Ionicons name="chevron-down" size={20} color="#222" />
          </TouchableOpacity>
        </View>

        {/* Number of Weeks */}
        <View style={styles.section}>
          <Text style={styles.label}>Number of weeks</Text>
          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setWeeksPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.inputText}>
              {numberOfWeeks} {numberOfWeeks === 1 ? 'week' : 'weeks'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#222" />
          </TouchableOpacity>
        </View>

        {/* Ends On */}
        <View style={styles.section}>
          <Text style={styles.label}>Ends on</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputText}>{format(endDate, 'd MMM yyyy')}</Text>
          </View>
        </View>

        {/* Selected Workout Days */}
        <View style={styles.section}>
          <Text style={styles.label}>Selected workout days</Text>
          <View style={styles.daysContainer}>
            {weekDays.map((day) => {
              const isSelected = selectedDays.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayButton,
                    isSelected && styles.dayButtonSelected,
                  ]}
                  onPress={() => toggleDay(day)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      isSelected && styles.dayButtonTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Plan This Workout Button */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={[styles.planButton, loading && styles.planButtonDisabled]}
          onPress={handlePlanWorkout}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.planButtonText}>Plan this workout</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      <DatePicker
        modal
        open={datePickerVisible}
        date={startDate}
        mode="date"
        minimumDate={new Date()}
        onConfirm={handleDateConfirm}
        onCancel={() => setDatePickerVisible(false)}
        theme="light"
      />

      {/* Weeks Picker Modal */}
      {weeksPickerVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity
                onPress={() => setWeeksPickerVisible(false)}
                style={styles.pickerCancelButton}
              >
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>Select Weeks</Text>
              <TouchableOpacity
                onPress={() => setWeeksPickerVisible(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerOptions}>
              {weeksOptions.map((weeks) => (
                <TouchableOpacity
                  key={weeks}
                  style={[
                    styles.pickerOption,
                    numberOfWeeks === weeks && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setNumberOfWeeks(weeks);
                    setWeeksPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      numberOfWeeks === weeks && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {weeks} {weeks === 1 ? 'week' : 'weeks'}
                  </Text>
                  {numberOfWeeks === weeks && (
                    <Ionicons name="checkmark" size={20} color="#000" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#f7f8f2',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eceee7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  workoutInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  workoutImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  workoutImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  workoutTextContainer: {
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  workoutLevel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dayButtonSelected: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  dayButtonTextSelected: {
    color: '#fff',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#f7f8f2',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  planButton: {
    backgroundColor: '#000',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planButtonDisabled: {
    opacity: 0.6,
  },
  planButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerCancelButton: {
    padding: 8,
  },
  pickerCancelText: {
    fontSize: 16,
    color: '#666',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  pickerDoneButton: {
    padding: 8,
  },
  pickerDoneText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  pickerOptions: {
    maxHeight: 300,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerOptionSelected: {
    backgroundColor: '#f8f8f8',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#666',
  },
  pickerOptionTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
});

export default PlanWorkoutScreen;

