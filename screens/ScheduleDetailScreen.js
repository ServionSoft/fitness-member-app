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
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { format, parseISO } from 'date-fns';
import ModernAlert from '../components/ModernAlert';
import { useAuth } from '../contexts/AuthContext';

const { width: screenWidth } = Dimensions.get('window');

const ScheduleDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { eventId, event, fromMySchedules } = route.params || {};
  const { userData } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [eventDetails, setEventDetails] = useState(event || null);
  const [error, setError] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [alert, setAlert] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = API_BASE_URL.replace('/api', '');

  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlert({
      visible: true,
      title,
      message,
      type,
      buttons: buttons.length > 0 ? buttons : [{ text: 'OK', onPress: () => {}, style: 'primary' }],
    });
  };

  const closeAlert = () => {
    setAlert(prev => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    if (event) {
      // If we have event data, use it immediately
      setEventDetails(event);
      setLoading(false);
      
      // Only try to fetch from API if:
      // 1. We have an eventId AND
      // 2. This is NOT from "My Schedules" (which might have booking IDs instead of event IDs)
      if (eventId && !fromMySchedules) {
        // Try to fetch fresh data in background
        fetchEventDetails().catch(() => {
          // Silently fail - we already have event data
          console.log('Failed to fetch fresh event details, using provided event data');
        });
      }
    } else if (eventId) {
      // Only eventId provided, must fetch from API
      fetchEventDetails();
    } else {
      setError('No event information provided');
      setLoading(false);
    }
  }, [eventId, event, fromMySchedules]);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/schedule/events/${eventId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Event Details Response:', JSON.stringify(result, null, 2));
        const eventData = result.data || result.event || result;
        setEventDetails(eventData);
        setError(null);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch event details' }));
        console.error('Failed to fetch event details:', response.status, errorData);
        
        // If we have event data from params, use it as fallback instead of showing error
        if (event) {
          console.log('Using event data from params as fallback - API returned 404');
          // Don't update state if we already have event data set (to avoid flicker)
          if (!eventDetails) {
            setEventDetails(event);
            setLoading(false);
          }
          setError(null);
        } else {
          setError(errorData.message || 'Failed to fetch event details');
          showAlert('Error', errorData.message || 'Failed to fetch event details', 'error');
        }
      }
    } catch (err) {
      console.error('Error fetching event details:', err);
      setError('Network error occurred');
      showAlert('Error', 'Network error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = parseISO(dateString);
      return format(date, 'EEEE, MMMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '';
    try {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const durationMinutes = endMinutes - startMinutes;
      return durationMinutes > 0 ? `${durationMinutes} minutes` : '';
    } catch (e) {
      return '';
    }
  };

  const handleBookEvent = async () => {
    if (!eventId) {
      showAlert('Error', 'Event ID is missing', 'error');
      return;
    }

    setBookingLoading(true);
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        showAlert('Error', 'Authentication required', 'error');
        setBookingLoading(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/schedule/events/${eventId}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Book Event Response:', JSON.stringify(result, null, 2));
        showAlert('Success', 'Event booked successfully!', 'success', [
          { text: 'OK', onPress: () => {
            // Refresh event details after booking
            if (eventId) {
              fetchEventDetails();
            }
          }, style: 'primary' }
        ]);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to book event' }));
        console.error('Failed to book event:', response.status, errorData);
        showAlert('Error', errorData.message || 'Failed to book event. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Error booking event:', err);
      showAlert('Error', 'Network error occurred. Please try again.', 'error');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!eventId) {
      showAlert('Error', 'Event ID is missing', 'error');
      return;
    }

    setBookingLoading(true);
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        showAlert('Error', 'Authentication required', 'error');
        setBookingLoading(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/schedule/events/${eventId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Cancel Booking Response:', JSON.stringify(result, null, 2));
        showAlert('Success', 'Booking cancelled successfully!', 'success', [
          { text: 'OK', onPress: () => {
            // Refresh event details after canceling
            if (eventId) {
              fetchEventDetails();
            }
          }, style: 'primary' }
        ]);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to cancel booking' }));
        console.error('Failed to cancel booking:', response.status, errorData);
        showAlert('Error', errorData.message || 'Failed to cancel booking. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Error canceling booking:', err);
      showAlert('Error', 'Network error occurred. Please try again.', 'error');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#222" />
          </TouchableOpacity>
          <Text 
            style={styles.headerTitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Event Details
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#222" />
          <Text style={styles.loadingText}>Loading event details...</Text>
        </View>
      </View>
    );
  }

  if (error && !eventDetails) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#222" />
          </TouchableOpacity>
          <Text 
            style={styles.headerTitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Event Details
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#ccc" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchEventDetails}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!eventDetails) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#222" />
          </TouchableOpacity>
          <Text 
            style={styles.headerTitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Event Details
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No event details available</Text>
        </View>
      </View>
    );
  }

  const title = eventDetails.activity_name || eventDetails.title || 'Scheduled Event';
  const date = formatDate(eventDetails.date);
  const startTime = eventDetails.start_time || '';
  const endTime = eventDetails.end_time || '';
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime || '';
  const duration = calculateDuration(startTime, endTime);
  const location = eventDetails.location || '';
  const capacity = eventDetails.capacity || '';
  const description = eventDetails.description || '';
  const coachName = eventDetails.coach_name || '';
  const tab = eventDetails.tab || '';
  const scheduleName = eventDetails.schedule_name || '';
  const participants = eventDetails.participants || [];
  const currentBookings = eventDetails.current_bookings || 0;
  const maxParticipants = eventDetails.max_participants || 0;
  const link = eventDetails.link || '';
  const linkText = eventDetails.link_text || '';
  const showLinkBeforeBooking = eventDetails.show_link_before_booking || false;
  
  // Check if current user is a participant
  const currentUserId = userData?.id || null;
  const isUserParticipant = currentUserId && participants.some(
    participant => participant.member_id === currentUserId
  );
  
  // Determine booking status - prioritize participant check, then API flags
  const isBooked = isUserParticipant || eventDetails.is_booked || false;
  const isAssigned = eventDetails.is_assigned || false;
  const canBook = !isUserParticipant && !isBooked && eventDetails.can_book && !eventDetails.is_full || false;
  const isFull = eventDetails.is_full || false;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text 
          style={styles.headerTitle}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Event Details
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Event Image */}
      
          <Image 
            source={{ uri: "https://sa1s3optim.patientpop.com/filters:format(webp)/assets/images/provider/photos/2503470.jpg" }} 
            style={styles.eventImage}
            resizeMode="cover"
          />
     
       
      

        {/* Event Title */}
        <View style={styles.section}>
          <Text style={styles.eventTitle}>{title}</Text>
          {tab && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabText}>{tab}</Text>
            </View>
          )}
        </View>

        {/* Event Info Card */}
        <View style={styles.infoCard}>
          {/* Date */}
          {date && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color="#888" />
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>{date}</Text>
            </View>
          )}

          {/* Time */}
          {timeRange && (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color="#888" />
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>{timeRange}</Text>
            </View>
          )}

          {/* Duration */}
          {duration && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="timer-outline" size={20} color="#888" />
              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{duration}</Text>
            </View>
          )}

          {/* Location */}
          {location && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#888" />
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{location}</Text>
            </View>
          )}

          {/* Capacity */}
          {capacity && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account-group-outline" size={20} color="#888" />
              <Text style={styles.infoLabel}>Capacity</Text>
              <Text style={styles.infoValue}>{capacity}</Text>
            </View>
          )}

          {/* Coach */}
          {coachName && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account-tie-outline" size={20} color="#888" />
              <Text style={styles.infoLabel}>Coach</Text>
              <Text style={styles.infoValue}>{coachName}</Text>
            </View>
          )}

          {/* Schedule Name */}
          {scheduleName && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="calendar-check-outline" size={20} color="#888" />
              <Text style={styles.infoLabel}>Schedule</Text>
              <Text style={styles.infoValue}>{scheduleName}</Text>
            </View>
          )}

          {/* Current Bookings */}
          {maxParticipants > 0 && (
            <View style={[styles.infoRow, { marginBottom: 0 }]}>
              <MaterialCommunityIcons name="account-check-outline" size={20} color="#888" />
              <Text style={styles.infoLabel}>Booked</Text>
              <Text style={styles.infoValue}>{currentBookings} of {maxParticipants}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <View style={styles.infoCard}>
              <Text style={styles.descriptionText}>{description}</Text>
            </View>
          </View>
        )}

        {/* Participants List */}
        {participants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants ({participants.length})</Text>
            <View style={styles.participantsCard}>
              {participants.map((participant, index) => (
                <View key={participant.member_id || index} style={[styles.participantRow, index === participants.length - 1 && { marginBottom: 0 }]}>
                  <View style={styles.participantAvatar}>
                    <Text style={styles.participantInitial}>
                      {(participant.member_name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.participantName}>{participant.member_name || 'Unknown'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Link Section */}
        {link && (showLinkBeforeBooking || isBooked) && (
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={async () => {
                try {
                  const canOpen = await Linking.canOpenURL(link);
                  if (canOpen) {
                    await Linking.openURL(link);
                  } else {
                    showAlert('Error', 'Cannot open this link', 'error');
                  }
                } catch (error) {
                  console.error('Error opening link:', error);
                  showAlert('Error', 'Failed to open link', 'error');
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="link-outline" size={20} color="#2196F3" />
              <Text style={styles.linkButtonText}>{linkText || 'View Link'}</Text>
              <Ionicons name="open-outline" size={16} color="#2196F3" />
            </TouchableOpacity>
          </View>
        )}

        {/* Booking Status */}
        <View style={styles.statusCard}>
          {isBooked ? (
            <View style={styles.statusBadgeBooked}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.statusTextBooked}>You are booked for this event</Text>
            </View>
          ) : isFull ? (
            <View style={styles.statusBadgeFull}>
              <Ionicons name="close-circle" size={20} color="#F44336" />
              <Text style={styles.statusTextFull}>This event is full</Text>
            </View>
          ) : canBook ? (
            <View style={styles.statusBadgeAvailable}>
              <Ionicons name="calendar-outline" size={20} color="#2196F3" />
              <Text style={styles.statusTextAvailable}>Available for booking</Text>
            </View>
          ) : null}
        </View>

        {/* Book/Cancel Button */}
        {(isBooked || (canBook && !isFull)) && (
          <View style={styles.actionButtonContainer}>
            {isBooked ? (
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancelBooking}
                activeOpacity={0.8}
                disabled={bookingLoading}
              >
                {bookingLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.bookButton}
                onPress={handleBookEvent}
                activeOpacity={0.8}
                disabled={bookingLoading}
              >
                {bookingLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="calendar" size={20} color="#fff" />
                    <Text style={styles.bookButtonText}>Book This Event</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modern Alert */}
      <ModernAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={closeAlert}
        buttons={alert.buttons}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: 'transparent',
    minHeight: 56,
  },
  backButton: {
    marginRight: 10,
    padding: 4,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
    textAlign: 'center',
    minWidth: 0, // Important for text truncation in flexbox
  },
  headerRight: {
    width: 40,
    flexShrink: 0, // Prevent spacer from shrinking
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  eventImage: {
    width: '90%',
    height: 200,
    borderRadius: 16,
    marginTop: 18,
    marginHorizontal: '5%',
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    width: '90%',
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    marginHorizontal: '5%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  section: {
    marginTop: 18,
    marginBottom: 10,
    marginHorizontal: '5%',
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 12,
    color: '#222',
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  tabBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  tabText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginTop: 10,
    marginHorizontal: '5%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
    marginLeft: 12,
    minWidth: 90,
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
    marginLeft: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    fontWeight: '400',
  },
  statusCard: {
    marginTop: 18,
    marginBottom: 20,
    marginHorizontal: '5%',
  },
  statusBadgeBooked: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statusBadgeFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statusBadgeAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statusTextBooked: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
  },
  statusTextFull: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#F44336',
  },
  statusTextAvailable: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#2196F3',
  },
  participantsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
    marginHorizontal: '5%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  participantName: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
    flex: 1,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginTop: 12,
    marginHorizontal: '5%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  linkButtonText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#2196F3',
  },
  actionButtonContainer: {
    paddingHorizontal: '5%',
    paddingBottom: 30,
    marginTop: 20,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ScheduleDetailScreen;
