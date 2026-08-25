import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, ScrollView, RefreshControl, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');


export default function AppointmentScreen({ navigation }) {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });

  // Helper function to show modern alert
  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

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

  const API_BASE_URL = ENV_API_BASE_URL;

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the stored token with the correct key (userToken, not @auth_token)
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        console.error('No token found');
        setError('Authentication required');
        setLoading(false);
        return null;
      }
  
      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }
  
      const response = await fetch(`${API_BASE_URL}/mobile/appointments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });
  
      if (response.ok) {
        const data = await response.json();
        console.log('Appointments data:', data.data);
        
        // Show future appointments OR completed appointments (for rating)
        const allAppointments = data.data || [];
        const filteredAppointments = allAppointments.filter((appointment) => {
          const appointmentDate = new Date(appointment.date);
          const [hours, minutes] = appointment.end_time.split(':');
          appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          const now = new Date();
          // Show future appointments OR completed appointments
          return appointmentDate > now || appointment.status === 'completed';
        });
        
        setAppointments(filteredAppointments);
        return data;
      } else {
        // Get the error response body
        const errorData = await response.json();
        console.error('Error response:', errorData);
        console.error('Failed to fetch appointments:', response.status);
        setError('Failed to fetch appointments');
        return null;
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setError('Network error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const handleRateAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setSelectedRating(appointment.rating || 0);
    setRatingModalVisible(true);
  };

  const submitRating = async () => {
    if (!selectedAppointment || selectedRating === 0) {
      showAlert('Error', 'Please select a rating', 'error');
      return;
    }

    try {
      setSubmittingRating(true);
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        showAlert('Error', 'Authentication required', 'error');
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/appointments/${selectedAppointment.id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          rating: selectedRating,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showAlert('Success', 'Appointment rated successfully!', 'success', [
          {
            text: 'OK',
            onPress: () => {
              setRatingModalVisible(false);
              setSelectedAppointment(null);
              setSelectedRating(0);
              fetchAppointments();
            },
            style: 'primary'
          }
        ]);
      } else {
        showAlert('Error', data.message || 'Failed to rate appointment', 'error');
      }
    } catch (error) {
      console.error('Error rating appointment:', error);
      showAlert('Error', 'Network error occurred', 'error');
    } finally {
      setSubmittingRating(false);
    }
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original if invalid
      const options = { weekday: 'long', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  // Helper function to format time
  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      if (isNaN(hour)) return timeString; // Return original if invalid
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:${minutes || '00'} ${ampm}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return timeString;
    }
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
        return '#4CAF50';
      case 'completed':
        return '#2196F3';
      case 'cancelled':
        return '#F44336';
      case 'pending':
        return '#FF9800';
      default:
        return '#666';
    }
  };

  // Helper function to get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'scheduled':
        return 'calendar-check';
      case 'completed':
        return 'check-circle';
      case 'cancelled':
        return 'close-circle';
      case 'pending':
        return 'clock-outline';
      default:
        return 'calendar';
    }
  };

  // Show loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderBar
          onMenuPress={() => setMenuVisible(true)}
        />
        <View style={[styles.loadingContainer, { paddingTop: insets.top + 80 }]}>
          <ActivityIndicator size="large" color="#222" />
          <Text style={styles.loadingText}>Loading appointments...</Text>
        </View>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.container}>
        <HeaderBar
          onMenuPress={() => setMenuVisible(true)}
        />
        <View style={[styles.errorContainer, { paddingTop: insets.top + 80 }]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAppointments}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
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
      {/* HeaderBar */}
      <HeaderBar
        onMenuPress={() => setMenuVisible(true)}
      />
      {/* Content */}
      <ScrollView 
        style={[styles.content, { paddingTop: insets.top + 80 }]} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Appointment Schedule</Text>
        {appointments.length > 0 ? (
          <Text style={styles.subtitle}>You have {appointments.length} appointment(s) scheduled</Text>
        ) : (
          <Text style={styles.subtitle}>No appointments scheduled yet</Text>
        )}
        
                 {/* Appointments List */}
         {appointments && appointments.length > 0 ? (
           <View style={styles.appointmentsContainer}>
             {appointments.map((appointment, index) => (
               <View key={appointment.id} style={styles.appointmentCard}>
                 {/* Header with status */}
                 <View style={styles.cardHeader}>
                   <View style={styles.statusContainer}>
                     <MaterialCommunityIcons 
                       name={getStatusIcon(appointment.status)} 
                       size={14} 
                       color={getStatusColor(appointment.status)} 
                     />
                     <Text style={[styles.statusText, { color: getStatusColor(appointment.status) }]}>
                       {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                     </Text>
                   </View>
                   <Text style={styles.appointmentId}>#{appointment.id}</Text>
                 </View>

                 {/* Workout Info */}
                 {appointment.workout && (
                   <View style={styles.workoutSection}>
                     <View style={styles.workoutIconContainer}>
                       <MaterialCommunityIcons name="dumbbell" size={20} color="#222" />
                     </View>
                     <View style={styles.workoutInfo}>
                       <Text style={styles.workoutName}>{appointment.workout?.name || 'N/A'}</Text>
                       <Text style={styles.workoutCategory}>{appointment.workout?.category || ''}</Text>
                     </View>
                   </View>
                 )}

                 {/* Date and Time */}
                 <View style={styles.timeSection}>
                   <View style={styles.timeItem}>
                     <MaterialCommunityIcons name="calendar" size={14} color="#666" />
                     <Text style={styles.timeText}>{formatDate(appointment.date)}</Text>
                   </View>
                   <View style={styles.timeItem}>
                     <MaterialCommunityIcons name="clock-outline" size={14} color="#666" />
                     <Text style={styles.timeText}>
                       {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                     </Text>
                   </View>
                 </View>

                 {/* Coach Info */}
                 {appointment.coach && (
                   <View style={styles.coachSection}>
                     <View style={styles.coachIconContainer}>
                       <MaterialCommunityIcons name="account-tie" size={18} color="#666" />
                     </View>
                     <View style={styles.coachInfo}>
                       <Text style={styles.coachLabel}>Coach</Text>
                       <Text style={styles.coachName}>{appointment.coach?.name || 'N/A'}</Text>
                     </View>
                   </View>
                 )}

                 {/* Notes if available */}
                 {appointment.notes && (
                   <View style={styles.notesSection}>
                     <MaterialCommunityIcons name="note-text" size={14} color="#666" />
                     <Text style={styles.notesText}>{appointment.notes}</Text>
                   </View>
                 )}

                 {/* Rating Section - Only show for completed appointments */}
                 {appointment.status === 'completed' && (
                   <View style={styles.ratingSection}>
                     {appointment.rating ? (
                       <View style={styles.ratingDisplay}>
                         <Text style={styles.ratingLabel}>Your Rating:</Text>
                         <View style={styles.starContainer}>
                           {[1, 2, 3, 4, 5].map((star) => (
                             <MaterialCommunityIcons
                               key={star}
                               name={star <= appointment.rating ? 'star' : 'star-outline'}
                               size={18}
                               color="#FFD700"
                             />
                           ))}
                         </View>
                       </View>
                     ) : (
                       <TouchableOpacity
                         style={styles.rateButton}
                         onPress={() => handleRateAppointment(appointment)}
                       >
                         <MaterialCommunityIcons name="star-outline" size={16} color="#222" />
                         <Text style={styles.rateButtonText}>Rate this appointment</Text>
                       </TouchableOpacity>
                     )}
                   </View>
                 )}

            
               </View>
             ))}
           </View>
         ) : (
           <View style={styles.noAppointmentsContainer}>
             <View style={styles.noAppointmentsIcon}>
               <MaterialCommunityIcons name="calendar-blank" size={80} color="#ccc" />
             </View>
             <Text style={styles.noAppointmentsTitle}>No Appointments Scheduled</Text>
           
           
           </View>
         )}
      </ScrollView>

      {/* Rating Modal */}
      <Modal
        visible={ratingModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rate Your Appointment</Text>
            <Text style={styles.modalSubtitle}>How was your experience?</Text>
            
            {/* Star Rating */}
            <View style={styles.starRatingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  style={styles.starButton}
                >
                  <MaterialCommunityIcons
                    name={star <= selectedRating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= selectedRating ? '#FFD700' : '#ccc'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setRatingModalVisible(false);
                  setSelectedRating(0);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={submitRating}
                disabled={submittingRating || selectedRating === 0}
              >
                {submittingRating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
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
    fontSize: 13
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 24,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    left: width / 2 - 32,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  // Appointment Cards Styles
  appointmentsContainer: {
    marginTop: 10,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  appointmentId: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
  },
  workoutSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  workoutIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f7f8f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e8e9e4',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 6,
    lineHeight: 18,
  },
  workoutCategory: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  timeSection: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 8,
    fontWeight: '600',
  },
  coachSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  coachIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f7f8f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e8e9e4',
  },
  coachInfo: {
    flex: 1,
  },
  coachLabel: {
    fontSize: 9,
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  coachName: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  notesSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notesText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // No Appointments Styles
  noAppointmentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  noAppointmentsIcon: {
    marginBottom: 24,
    opacity: 0.7,
  },
  noAppointmentsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    textAlign: 'center',
  },
  noAppointmentsSubtitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 6,
  },
  noAppointmentsActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  browseButtonText: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  // Rating Styles
  ratingSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginRight: 8,
  },
  starContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rateButtonText: {
    fontSize: 13,
    color: '#222',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  starRatingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  starButton: {
    padding: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#222',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
}); 