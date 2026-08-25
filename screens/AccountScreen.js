import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Modal, Image, Alert, Platform, PermissionsAndroid } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { getProfileImageSource } from '../utils/imageUtils';

const AccountScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userData, refreshMemberDetails, logout } = useAuth();
  const [showShadow, setShowShadow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [memberDetails, setMemberDetails] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info' });
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const API_BASE_URL = ENV_API_BASE_URL;

  // Helper function to show modern alert
  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  const handleDeleteAccountPress = () => {
    showAlert(
      'Delete Account',
      'You will lose all your data. This cannot be undone and your account cannot be recovered. Are you sure you want to delete your account?',
      'warning',
      [
        { text: 'Cancel', onPress: () => {}, style: 'secondary' },
        { text: 'Delete Account', onPress: confirmDeleteAccount, style: 'danger' },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      const userToken = await AsyncStorage.getItem('userToken');

      if (!userToken) {
        showAlert('Authentication Error', 'Please log in to delete your account.', 'error');
        setDeletingAccount(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/member/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await logout();
      } else {
        showAlert('Error', data.message || 'Failed to delete account. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      showAlert('Error', 'Failed to delete account. Please check your internet connection.', 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  // Fetch member details from API
  const fetchMemberDetails = async () => {
    try {
      setLoading(true);
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        showAlert('Authentication Error', 'Please log in to view account details.', 'error');
        setLoading(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const requestUrl = `${API_BASE_URL}/mobile/member/details`;
      const requestHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader,
      };

      // Log request details for debugging
      console.log('=== Account Screen API Request ===');
      console.log('Request URL:', requestUrl);
      console.log('Request Headers:', JSON.stringify(requestHeaders, null, 2));
      console.log('User Token (first 20 chars):', userToken ? userToken.substring(0, 20) + '...' : 'No token');
      console.log('================================');

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: requestHeaders,
      });

      const data = await response.json();

      // Log full response for debugging
      console.log('=== Account Screen API Response ===');
      console.log('Response Status:', response.status);
      console.log('Response OK:', response.ok);
      console.log('Response Status Text:', response.statusText);
      console.log('Response Data:', JSON.stringify(data, null, 2));
      console.log('Response Data (raw):', data);
      console.log('===================================');

      if (response.ok && data.success) {
        setMemberDetails(data.data);
        // Log profile image path details
        const baseUrl = API_BASE_URL.replace('/api', '');
        const imageSource = getProfileImageSource(data.data, baseUrl);
        console.log('=== Profile Image Path Debug ===');
        console.log('API Base URL:', API_BASE_URL);
        console.log('Base URL (for images):', baseUrl);
        console.log('Profile Image from API:', data.data?.profile_image);
        if (data.data?.profile_image) {
          // Use getProfileImageSource to get the correct path (handles old format)
          if (imageSource?.uri) {
            console.log('Full Image Path:', imageSource.uri);
          } else {
            console.log('Using default image (no profile_image)');
          }
        } else {
          console.log('No profile_image found in response');
        }
        console.log('================================');
      } else {
        console.log('API Error - Response not OK or success is false');
        console.log('Error Message:', data.message);
        console.log('Error Data:', data);
        showAlert('Error', data.message || 'Failed to fetch member details.', 'error');
      }
    } catch (error) {
      console.error('Error fetching member details:', error);
      showAlert('Error', 'Failed to fetch member details. Please check your internet connection.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Update member details with custom data object
  const updateMemberDetailsWithData = async (updateData) => {
    try {
      setSaving(true);
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        showAlert('Authentication Error', 'Please log in to update account details.', 'error');
        setSaving(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/member/details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMemberDetails(data.data);
        setEditingField(null);
        showAlert('Success', 'Member details updated successfully.', 'success');
      } else {
        if (data.errors) {
          const errorMessages = Object.values(data.errors).flat().join('\n');
          showAlert('Validation Error', errorMessages, 'warning');
        } else {
          showAlert('Error', data.message || 'Failed to update member details.', 'error');
        }
      }
    } catch (error) {
      console.error('Error updating member details:', error);
      showAlert('Error', 'Failed to update member details. Please check your internet connection.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Update member details
  const updateMemberDetails = async (field, value) => {
    try {
      setSaving(true);
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        showAlert('Authentication Error', 'Please log in to update account details.', 'error');
        setSaving(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Prepare update data based on field
      const updateData = {};
      if (field === 'firstname' || field === 'lastname') {
        // For name fields, we need to update both
        if (field === 'firstname') {
          updateData.firstname = value;
          updateData.lastname = memberDetails?.lastname || '';
        } else {
          updateData.firstname = memberDetails?.firstname || '';
          updateData.lastname = value;
        }
      } else if (field === 'weight') {
        // Extract numeric value from "80 kg" format
        const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
        updateData.weight = numericValue || null;
      } else if (field === 'height') {
        // Extract numeric value from "180 cm" format
        const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
        updateData.height = numericValue || null;
      } else {
        updateData[field] = value || null;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/member/details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMemberDetails(data.data);
        setEditingField(null);
        showAlert('Success', 'Member details updated successfully.', 'success');
      } else {
        if (data.errors) {
          const errorMessages = Object.values(data.errors).flat().join('\n');
          showAlert('Validation Error', errorMessages, 'warning');
        } else {
          showAlert('Error', data.message || 'Failed to update member details.', 'error');
        }
      }
    } catch (error) {
      console.error('Error updating member details:', error);
      showAlert('Error', 'Failed to update member details. Please check your internet connection.', 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchMemberDetails();
  }, []);

  // Log image path whenever memberDetails changes
  useEffect(() => {
    if (memberDetails) {
      const baseUrl = API_BASE_URL.replace('/api', '');
      const imageSource = getProfileImageSource(memberDetails, baseUrl);
      
      console.log('=== Image Source Debug (useEffect) ===');
      console.log('Member Details Profile Image:', memberDetails.profile_image);
      console.log('Base URL:', baseUrl);
      console.log('Image Source Object:', imageSource);
      if (imageSource?.uri) {
        console.log('Full Image URI:', imageSource.uri);
      } else if (typeof imageSource === 'number') {
        console.log('Using Local Asset (default image)');
      }
      console.log('=====================================');
    }
  }, [memberDetails]);

  // Handle profile photo upload
  const uploadProfilePhoto = async (imageUri) => {
    try {
      setUploadingPhoto(true);
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        showAlert('Authentication Error', 'Please log in to upload profile photo.', 'error');
        setUploadingPhoto(false);
        return;
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Create FormData for multipart/form-data
      const formData = new FormData();
      
      // Add the image file
      formData.append('profile_photo', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `profile_photo_${Date.now()}.jpg`,
      });

      const response = await fetch(`${API_BASE_URL}/mobile/member/profile-photo`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const baseUrl = API_BASE_URL.replace('/api', '');
        const imageSource = getProfileImageSource(data.data, baseUrl);
        console.log('=== Profile Photo Upload Success ===');
        console.log('Response Data:', data.data);
        console.log('Profile Image Path from API:', data.data?.profile_image);
        if (data.data?.profile_image) {
          // Use getProfileImageSource to get the correct path (handles old format)
          if (imageSource?.uri) {
            console.log('Full Image Path:', imageSource.uri);
          } else {
            console.log('Using default image (no profile_image)');
          }
        }
        console.log('===================================');
        setMemberDetails(data.data);
        // Refresh member details in AuthContext so HeaderBar and ProfileScreen show updated image
        if (refreshMemberDetails) {
          await refreshMemberDetails();
        }
        showAlert('Success', 'Profile photo uploaded successfully.', 'success');
      } else {
        showAlert('Error', data.message || 'Failed to upload profile photo.', 'error');
      }
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      showAlert('Error', 'Failed to upload profile photo. Please check your internet connection.', 'error');
    } finally {
      setUploadingPhoto(false);
      setShowPhotoOptions(false);
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission Required',
          message: 'Allow camera access to take a profile photo.',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }

      showAlert('Permission Required', 'Camera permission is required to take a profile photo.', 'warning');
      return false;
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      showAlert('Error', 'Failed to request camera permission.', 'error');
      return false;
    }
  };

  // Open camera
  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      setShowPhotoOptions(false);
      return;
    }

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
        setShowPhotoOptions(false);
      } else if (response.error) {
        console.error('Camera error:', response.error);
        showAlert('Error', 'Camera error: ' + response.error, 'error');
        setShowPhotoOptions(false);
      } else if (response.assets && response.assets[0]) {
        uploadProfilePhoto(response.assets[0].uri);
      }
    });
  };

  // Open image library
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
        setShowPhotoOptions(false);
      } else if (response.error) {
        console.error('Photo library error:', response.error);
        showAlert('Error', 'Photo library error: ' + response.error, 'error');
        setShowPhotoOptions(false);
      } else if (response.assets && response.assets[0]) {
        uploadProfilePhoto(response.assets[0].uri);
      }
    });
  };

  // Show photo options alert
  const handleChangePhoto = () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        { text: 'Camera', onPress: openCamera },
        { text: 'Photo Library', onPress: openImageLibrary },
        { text: 'Cancel', onPress: () => setShowPhotoOptions(false), style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // Get display value for a field
  const getFieldValue = (field) => {
    if (!memberDetails) {
      // Fallback to userData if memberDetails not loaded yet
      if (field === 'email') return userData?.email || '';
      if (field === 'username') return userData?.username || '';
      if (field === 'name') {
        const firstName = userData?.firstname || '';
        const lastName = userData?.lastname || '';
        return `${firstName} ${lastName}`.trim() || 'User';
      }
      return '';
    }

    switch (field) {
      case 'email':
        return memberDetails.email || '';
      case 'username':
        return memberDetails.username || '';
      case 'password':
        return '••••••••'; // Masked password display
      case 'name':
        return memberDetails.name || `${memberDetails.firstname || ''} ${memberDetails.lastname || ''}`.trim() || 'User';
      case 'date_of_birth':
        return memberDetails.date_of_birth || '';
      case 'gender':
        return memberDetails.gender || '';
      case 'weight':
        return memberDetails.weight ? `${memberDetails.weight} ${memberDetails.weight_unit || 'kg'}` : '';
      case 'height':
        return memberDetails.height ? `${memberDetails.height} cm` : '';
      case 'mobile_phone':
        return memberDetails.mobile_phone || '';
      case 'address':
        return memberDetails.address || '';
      case 'city':
        return memberDetails.city || '';
      case 'zip_code':
        return memberDetails.zip_code || '';
      case 'weight_unit':
        return memberDetails.weight_unit || 'kg';
      case 'distance_unit':
        return memberDetails.distance_unit || 'km';
      default:
        return '';
    }
  };

  const handleEditField = (field) => {
    let currentValue = getFieldValue(field);
    
    // Clean up value for editing
    if (field === 'weight' || field === 'height') {
      currentValue = currentValue.replace(/[^0-9.]/g, '');
    }
    
    // Reset password fields when editing password
    if (field === 'password') {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    }
    
    setEditValue(currentValue);
    setEditingField(field);
  };

  const handleSaveField = () => {
    if (editingField === null) return;

    // Handle password field separately
    if (editingField === 'password') {
      // Validate password fields
      if (!currentPassword || !newPassword || !confirmPassword) {
        showAlert('Validation Error', 'Please fill in all password fields.', 'warning');
        return;
      }

      if (newPassword.length < 6) {
        showAlert('Validation Error', 'New password must be at least 6 characters long.', 'warning');
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert('Validation Error', 'New password and confirm password do not match.', 'warning');
        return;
      }

      // Update password
      const updateData = {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      };
      updateMemberDetailsWithData(updateData);
      return;
    }

    let valueToSave = editValue.trim();
    
    // Validate based on field type
    if (editingField === 'email' && valueToSave) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(valueToSave)) {
        showAlert('Validation Error', 'Please enter a valid email address.', 'warning');
        return;
      }
    }

    if (editingField === 'weight' || editingField === 'height') {
      const numericValue = parseFloat(valueToSave);
      if (valueToSave && (isNaN(numericValue) || numericValue < 0)) {
        showAlert('Validation Error', 'Please enter a valid number.', 'warning');
        return;
      }
    }

    // Handle name field - split into firstname and lastname
    if (editingField === 'name') {
      const nameParts = valueToSave.split(' ');
      const firstname = nameParts[0] || '';
      const lastname = nameParts.slice(1).join(' ') || '';
      // Update both firstname and lastname together
      const updateData = {
        firstname: firstname,
        lastname: lastname,
      };
      updateMemberDetailsWithData(updateData);
    } else {
      updateMemberDetails(editingField, valueToSave);
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const accountInfo = [
    { key: 'email', label: 'E-mail', editable: false },
    { key: 'password', label: 'Password', editable: true },
    { key: 'name', label: 'Name', editable: true },
    { key: 'date_of_birth', label: 'Date of birth', editable: true },
    { key: 'gender', label: 'Gender', editable: true },
    { key: 'weight', label: 'Weight', editable: true },
    { key: 'height', label: 'Height', editable: true },
    { key: 'mobile_phone', label: 'Mobile phone', editable: true },
    { key: 'address', label: 'Address', editable: true },
    { key: 'city', label: 'City', editable: true },
    { key: 'zip_code', label: 'ZIP Code', editable: true },
  ];

  const handleScroll = (event) => {
    setShowShadow(event.nativeEvent.contentOffset.y > 5);
  };


  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backArrowBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text 
          style={styles.headerTitle}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Account 
        </Text>
      </View>
      {/* Shadow/Gradient Overlay */}
      {showShadow && (
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0)']}
          style={styles.shadowOverlay}
          pointerEvents="none"
        />
      )}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#222" />
            <Text style={styles.loadingText}>Loading account details...</Text>
          </View>
        ) : (
          <>
            {/* Profile Photo Section */}
            <View style={styles.profilePhotoSection}>
              <TouchableOpacity
                style={styles.profilePhotoContainer}
                onPress={handleChangePhoto}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <View style={styles.profilePhotoLoading}>
                    <ActivityIndicator size="large" color="#222" />
                  </View>
                ) : (
                  <>
                    {(() => {
                      const baseUrl = API_BASE_URL.replace('/api', '');
                      const imageSource = getProfileImageSource(memberDetails, baseUrl);
                      console.log('=== Image Source at Render ===');
                      console.log('Base URL:', baseUrl);
                      console.log('Member Details:', memberDetails);
                      console.log('Profile Image Path:', memberDetails?.profile_image);
                      console.log('Image Source:', imageSource);
                      if (imageSource?.uri) {
                        console.log('Full Image URL:', imageSource.uri);
                      }
                      console.log('============================');
                      return (
                        <Image
                          source={imageSource}
                          style={styles.profilePhoto}
                          resizeMode="cover"
                        />
                      );
                    })()}
                    <View style={styles.profilePhotoOverlay}>
                      <Ionicons name="camera" size={24} color="#fff" />
                      <Text style={styles.profilePhotoOverlayText}>Change Photo</Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Personal Info */}
            <Text style={styles.sectionTitle}>Personal information</Text>
            {accountInfo.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.infoRow}
                onPress={() => item.editable && handleEditField(item.key)}
                disabled={!item.editable || saving}
              >
                <Text style={styles.infoLabel}>{item.label}</Text>
                <View style={styles.infoValueContainer}>
                  <Text style={styles.infoValue}>{getFieldValue(item.key) || 'Not set'}</Text>
                  {item.editable && (
                    <Ionicons name="pencil-outline" size={18} color="#888" style={{ marginLeft: 8 }} />
                  )}
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={handleDeleteAccountPress}
              disabled={deletingAccount || saving}
            >
              {deletingAccount ? (
                <ActivityIndicator size="small" color="#C62828" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#C62828" />
                  <Text style={styles.deleteAccountText}>Delete Account</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editingField !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit {accountInfo.find(item => item.key === editingField)?.label || editingField}
            </Text>
            
            {editingField === 'password' ? (
              <View>
                <Text style={styles.passwordLabel}>Current Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.modalInput, styles.passwordInput]}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor="#bbb"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#888"
                    />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.passwordLabel}>New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.modalInput, styles.passwordInput]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor="#bbb"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#888"
                    />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.passwordLabel}>Confirm New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.modalInput, styles.passwordInput]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor="#bbb"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#888"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ) : editingField === 'gender' ? (
              <View style={styles.genderOptions}>
                {['Male', 'Female', 'Other'].map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={[
                      styles.genderOption,
                      editValue === gender && styles.genderOptionSelected
                    ]}
                    onPress={() => setEditValue(gender)}
                  >
                    <Text style={[
                      styles.genderOptionText,
                      editValue === gender && styles.genderOptionTextSelected
                    ]}>
                      {gender}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View>
                <View style={editingField === 'height' || editingField === 'weight' ? styles.inputWithSuffix : null}>
                  <TextInput
                    style={[styles.modalInput, (editingField === 'height' || editingField === 'weight') && styles.inputWithSuffixText]}
                    value={editValue}
                    onChangeText={setEditValue}
                    placeholder={`Enter ${accountInfo.find(item => item.key === editingField)?.label || editingField}${editingField === 'height' ? ' (cm)' : editingField === 'weight' ? ' (kg)' : ''}`}
                    placeholderTextColor="#bbb"
                    keyboardType={
                      editingField === 'weight' || editingField === 'height' || editingField === 'date_of_birth' || editingField === 'zip_code'
                        ? 'numeric'
                        : editingField === 'email'
                        ? 'email-address'
                        : editingField === 'mobile_phone'
                        ? 'phone-pad'
                        : 'default'
                    }
                    autoCapitalize={editingField === 'name' || editingField === 'address' || editingField === 'city' ? 'words' : 'none'}
                  />
                  {editingField === 'height' && editValue && (
                    <Text style={styles.inputSuffix}>cm</Text>
                  )}
                  {editingField === 'weight' && editValue && (
                    <Text style={styles.inputSuffix}>kg</Text>
                  )}
                </View>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelEdit}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveField}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Modern Alert */}
      <ModernAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons || []}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingBottom: 18, 
    paddingHorizontal: 18, 
    backgroundColor: 'transparent',
    minHeight: 56,
  },
  backArrowBtn: { 
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
    color: '#000',
    includeFontPadding: false, // Remove extra padding on Android
    textAlignVertical: 'center',
    minWidth: 0, // Important for text truncation in flexbox
  },
  sectionTitle: { fontWeight: '700',color: '#1a1a1a', fontSize: 15, marginTop: 18, marginBottom: 10, marginLeft: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, marginHorizontal: 18, marginBottom: 12, elevation: 2 },
  infoLabel: { color: '#888', fontWeight: '600', fontSize: 15 },
  infoValue: { color: '#222', fontWeight: '600', fontSize: 15 },
  backButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, position: 'absolute', bottom: 40, alignSelf: 'center' },
  backText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
  shadowOverlay: {
    position: 'absolute',
    top: 90, // adjust if your header is taller/shorter
    left: 0,
    right: 0,
    height: 30,
    zIndex: 10,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 14,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#222',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#222',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  genderOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderOption: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  genderOptionSelected: {
    borderColor: '#222',
    backgroundColor: '#f5f5f5',
  },
  genderOptionText: {
    color: '#888',
    fontWeight: '600',
    fontSize: 16,
  },
  genderOptionTextSelected: {
    color: '#222',
  },
  unitOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  unitOption: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  unitOptionSelected: {
    borderColor: '#222',
    backgroundColor: '#f5f5f5',
  },
  unitOptionText: {
    color: '#888',
    fontWeight: '600',
    fontSize: 16,
  },
  unitOptionTextSelected: {
    color: '#222',
  },
  passwordLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginTop: 12,
    marginBottom: 8,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    padding: 4,
  },
  inputWithSuffix: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWithSuffixText: {
    paddingRight: 50,
  },
  inputSuffix: {
    position: 'absolute',
    right: 14,
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
  },
  profilePhotoSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  profilePhotoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
  },
  profilePhotoLoading: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  profilePhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePhotoOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E57373',
    elevation: 2,
  },
  deleteAccountText: {
    color: '#C62828',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 8,
  },
});

export default AccountScreen; 