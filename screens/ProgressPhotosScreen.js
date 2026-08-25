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
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import DatePicker from 'react-native-date-picker';
import { format } from 'date-fns';
import ModernAlert from '../components/ModernAlert';

const { width: screenWidth } = Dimensions.get('window');

const API_BASE_URL = ENV_API_BASE_URL;

const ProgressPhotosScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null); // 'before' or 'after'
  const [beforePhoto, setBeforePhoto] = useState(null);
  const [afterPhoto, setAfterPhoto] = useState(null);
  const [progressPhotos, setProgressPhotos] = useState([]);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pendingImageUri, setPendingImageUri] = useState(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });

  // Helper function to show modern alert
  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  const selectImage = () => {
    // Directly open gallery
    openImageLibrary();
  };

  const openPhotoSelectionModal = (section) => {
    setSelectedSection(section);
    setModalVisible(true);
  };

  const selectPhotoFromModal = (photo) => {
    if (selectedSection === 'before') {
      setBeforePhoto(photo);
    } else if (selectedSection === 'after') {
      setAfterPhoto(photo);
    }
    
    setModalVisible(false);
    setSelectedSection(null);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedSection(null);
  };

  const openCamera = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      includeBase64: false,
      saveToPhotos: false,
    };

    launchCamera(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled camera');
      } else if (response.error) {
        console.error('Camera error:', response.error);
        showAlert('Error', 'Camera error: ' + response.error, 'error');
      } else if (response.assets && response.assets[0]) {
        // Store image URI and show date picker
        setPendingImageUri(response.assets[0].uri);
        setSelectedDate(new Date());
        setDatePickerVisible(true);
      }
    });
  };

  const openImageLibrary = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      includeBase64: false,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled photo library');
      } else if (response.error) {
        console.error('Photo library error:', response.error);
        showAlert('Error', 'Photo library error: ' + response.error, 'error');
      } else if (response.assets && response.assets[0]) {
        // Store image URI and show date picker
        setPendingImageUri(response.assets[0].uri);
        setSelectedDate(new Date());
        setDatePickerVisible(true);
      }
    });
  };

  const handleDateConfirm = () => {
    setDatePickerVisible(false);
    if (pendingImageUri) {
      addProgressPhoto(pendingImageUri, selectedDate);
      setPendingImageUri(null);
    }
  };

  const handleDateCancel = () => {
    setDatePickerVisible(false);
    setPendingImageUri(null);
  };

  const addProgressPhoto = async (imageUri, photoDate = new Date()) => {
    if (!userData?.id) {
      showAlert('Error', 'User not authenticated', 'error');
      return;
    }

    setLoading(true);
    
    try {
      // Get the stored token with the correct key (userToken, not token)
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        console.error('No token found');
        showAlert('Error', 'Authentication token not found', 'error');
        return;
      }

      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Create FormData for multipart/form-data
      const formData = new FormData();
      
      // Add the image file
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `progress_photo_${Date.now()}.jpg`,
      });

      // Add member_id
      formData.append('member_id', userData.id.toString());

      // Add photo date (format: YYYY-MM-DD)
      const dateString = format(photoDate, 'yyyy-MM-dd');
      formData.append('photo_date', dateString);

      console.log('Uploading photo to:', `${API_BASE_URL}/mobile/comparison-photos/upload`);
      console.log('Photo date:', dateString);
      console.log('FormData:', formData);
      console.log('Auth header:', authHeader);

      const response = await fetch(`${API_BASE_URL}/mobile/comparison-photos/upload`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
        },
        body: formData,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Upload response:', result);

      if (result.success) {
        const newPhoto = {
          id: result.data.id,
          date: result.data.photo_date || result.data.created_at.split(' ')[0], // Use photo_date if available
          photo: result.data.image_url, // Use image_url for full URL
          notes: '',
          image_name: result.data.image_name,
          created_at: result.data.created_at,
          is_before: result.data.is_before,
          is_after: result.data.is_after,
        };
        
        setProgressPhotos(prev => [newPhoto, ...prev]);
        showAlert('Success', 'Progress photo uploaded successfully!', 'success');
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      showAlert('Error', `Failed to upload photo: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async () => {
    if (!userData?.id) {
      console.log('No user ID available');
      return;
    }

    try {
      // Get the stored token with the correct key (userToken, not token)
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        console.error('No token found');
        return;
      }

      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      console.log('Fetching photos for member:', userData.id);
      console.log('API URL:', `${API_BASE_URL}/mobile/comparison-photos/${userData.id}`);

      const response = await fetch(`${API_BASE_URL}/mobile/comparison-photos/${userData.id}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch photos:', response.status, errorText);
        return;
      }

      const result = await response.json();
      console.log('Photos response:', result);

      if (result.success && result.data) {
        // Transform API data to match our local state format
        const photos = result.data.map(photo => ({
          id: photo.id,
          date: photo.photo_date || photo.created_at.split(' ')[0], // Use photo_date if available
          photo: photo.image_url, // Use image_url for full URL
          notes: photo.notes || '',
          image_name: photo.image_name,
          created_at: photo.created_at,
          is_before: photo.is_before,
          is_after: photo.is_after,
        }));
        
        setProgressPhotos(photos);
        console.log('Photos loaded successfully:', photos.length);
        console.log('Transformed photos:', photos);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Fetch photos when component mounts
  useEffect(() => {
    fetchPhotos();
  }, [userData?.id]);

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text 
            style={styles.headerTitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Progress Photos
          </Text>
          <Text 
            style={styles.headerSubtitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Track your transformation
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.headerAddButton}
          onPress={selectImage}
          disabled={loading}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#222" />
          ) : (
            <Ionicons name="add" size={20} color="#222" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 140, paddingTop: 10 }} showsVerticalScrollIndicator={false}>
        
        {/* Before Photos Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="camera-outline" size={18} color="#222" />
            <Text style={styles.sectionTitle}>Before Photos</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.selectPhotoButton}
            onPress={() => openPhotoSelectionModal('before')}
          >
            <View style={styles.selectPhotoContent}>
              {beforePhoto ? (
                <View style={styles.selectedPhotoContainer}>
                  <Image source={{ uri: beforePhoto.photo }} style={styles.selectedPhoto} />
                  <View style={styles.selectedPhotoOverlay}>
                    <Text style={styles.selectedPhotoDate}>{formatDate(beforePhoto.date)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.selectPhotoPlaceholder}>
                  <MaterialCommunityIcons name="camera-plus" size={28} color="#666" />
                  <Text style={styles.selectPhotoText}>Select Before Photo</Text>
                  <Text style={styles.selectPhotoSubtext}>Choose from your uploaded photos</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* After Photos Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="camera-outline" size={18} color="#222" />
            <Text style={styles.sectionTitle}>After Photos</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.selectPhotoButton}
            onPress={() => openPhotoSelectionModal('after')}
          >
            <View style={styles.selectPhotoContent}>
              {afterPhoto ? (
                <View style={styles.selectedPhotoContainer}>
                  <Image source={{ uri: afterPhoto.photo }} style={styles.selectedPhoto} />
                  <View style={styles.selectedPhotoOverlay}>
                    <Text style={styles.selectedPhotoDate}>{formatDate(afterPhoto.date)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.selectPhotoPlaceholder}>
                  <MaterialCommunityIcons name="camera-plus" size={28} color="#666" />
                  <Text style={styles.selectPhotoText}>Select After Photo</Text>
                  <Text style={styles.selectPhotoSubtext}>Choose from your uploaded photos</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Photo Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeModal} />
          <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {selectedSection === 'before' ? 'Before' : 'After'} Photo
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {progressPhotos.filter(photo => photo.photo).length === 0 ? (
              <View style={styles.modalEmptyState}>
                <MaterialCommunityIcons name="image-off-outline" size={48} color="#999" />
                <Text style={styles.modalEmptyTitle}>No images yet</Text>
                <Text style={styles.modalEmptyText}>
                  Upload images first using the + button, then select them here for Before / After comparison.
                </Text>
                <TouchableOpacity
                  style={styles.modalUploadButton}
                  onPress={() => {
                    closeModal();
                    selectImage();
                  }}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.modalUploadButtonText}>Upload Images First</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={progressPhotos.filter(photo => photo.photo)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalPhotoItem}
                    onPress={() => selectPhotoFromModal(item)}
                  >
                    <Image source={{ uri: item.photo }} style={styles.modalPhoto} />
                    <View style={styles.modalPhotoInfo}>
                      <Text style={styles.modalPhotoDate}>{formatDate(item.date)}</Text>
                      {item.notes && (
                        <Text style={styles.modalPhotoNotes} numberOfLines={2}>{item.notes}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              />
            )}
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
              <Text style={styles.datePickerTitle}>Select Photo Date</Text>
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
    backgroundColor: '#f7f8f2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#f7f8f2',
    minHeight: 56,
  },
  backButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
    minWidth: 0, // Important for text truncation in flexbox
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    letterSpacing: 0.3,
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    flexShrink: 0, // Prevent from shrinking
  },
  headerAddButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#eceee7',
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#e7ead7',
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginLeft: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#eceee7',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  selectPhotoButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eceee7',
    overflow: 'hidden',
  },
  selectPhotoContent: {
    minHeight: 120,
  },
  selectedPhotoContainer: {
    position: 'relative',
  },
  selectedPhoto: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  selectedPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  selectedPhotoDate: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  selectPhotoPlaceholder: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectPhotoText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
    color: '#1a1a1a',
    letterSpacing: 0.3,
  },
  selectPhotoSubtext: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '55%',
    maxHeight: '80%',
    paddingTop: 8,
    marginBottom: 0,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eceee7',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  modalEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  modalUploadButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalPhotoItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalPhoto: {
    width: 50,
    height: 50,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  modalPhotoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  modalPhotoDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  modalPhotoNotes: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    lineHeight: 18,
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
});

export default ProgressPhotosScreen;