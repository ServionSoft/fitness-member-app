import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import BottomNavBar from '../components/BottomNavBar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

const ContactsScreen = () => {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState('Profile');
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const navigation = useNavigation();

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

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    // Validate form
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setAlertConfig({
        title: 'Validation Error',
        message: 'Please fill in all required fields (Name, Email, and Message).',
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
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setAlertConfig({
        title: 'Validation Error',
        message: 'Please enter a valid email address.',
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
      return;
    }

    setLoading(true);
    
    try {
      // Get the stored token
      const userToken = await AsyncStorage.getItem('userToken');
      
      if (!userToken) {
        setAlertConfig({
          title: 'Authentication Error',
          message: 'Please log in to submit the contact form.',
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
        setLoading(false);
        return;
      }

      // Check if token has "Bearer " prefix already
      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const API_BASE_URL = ENV_API_BASE_URL;
      
      const response = await fetch(`${API_BASE_URL}/mobile/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          subject: formData.subject.trim() || null,
          message: formData.message.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAlertConfig({
          title: 'Success',
          message: data.message || 'Thank you for contacting us! We will get back to you soon.',
          type: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: () => {
                setFormData({
                  name: '',
                  email: '',
                  subject: '',
                  message: '',
                });
              },
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      } else {
        // Handle validation errors
        if (data.errors) {
          const errorMessages = Object.values(data.errors).flat().join('\n');
          setAlertConfig({
            title: 'Validation Error',
            message: errorMessages,
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
        } else {
          setAlertConfig({
            title: 'Error',
            message: data.message || 'Failed to send message. Please try again later.',
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
      }
    } catch (error) {
      console.error('Contact form submission error:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to send message. Please check your internet connection and try again.',
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
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneCall = (phone) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleLocation = () => {
    // Open maps app with address
    const address = '123 Fitness Street, Health City, HC 12345';
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address)}`);
  };

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
      
      {/* Fixed Header */}
      <HeaderBar
        showBack
        title="Contact Us"
        showNotification={false}
        onBackPress={() => navigation.goBack()}
      />
      
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 140, paddingTop: insets.top + 60 }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Contact Us</Text>
          <Text style={styles.headerSubtitle}>We'd love to hear from you. Send us a message and we'll respond as soon as possible.</Text>
        </View>

        {/* Contact Form */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Send us a Message</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Your full name"
              placeholderTextColor="#999"
              value={formData.name}
              onChangeText={(value) => handleInputChange('name', value)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="your.email@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.textInput}
              placeholder="What is this regarding?"
              placeholderTextColor="#999"
              value={formData.subject}
              onChangeText={(value) => handleInputChange('subject', value)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Message *</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Tell us how we can help you..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={formData.message}
              onChangeText={(value) => handleInputChange('message', value)}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" style={styles.submitIcon} />
                <Text style={styles.submitButtonText}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Contact Information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Get in Touch</Text>
          
          <TouchableOpacity style={styles.infoCard} onPress={() => handlePhoneCall('+1234567890')}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="call" size={24} color="#222" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>+1 (234) 567-8900</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoCard} onPress={() => handleEmail('info@fitnessapp.com')}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="mail" size={24} color="#222" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>info@fitnessapp.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoCard} onPress={handleLocation}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="location" size={24} color="#222" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>123 Fitness Street{'\n'}Health City, HC 12345</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavBar
        selectedTab={selectedTab}
        navigation={navigation}
        onTabChange={setSelectedTab}
      />

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
    backgroundColor: '#f7f8f2',
  },
  headerSection: {
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  formSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  infoSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f7f8f2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#222',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  submitButton: {
    backgroundColor: '#222',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitIcon: {
    marginRight: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f7f8f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    lineHeight: 20,
  },
});

export default ContactsScreen;

