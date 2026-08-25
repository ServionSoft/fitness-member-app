import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  Dimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import CheckBox from '@react-native-community/checkbox';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import ModernAlert from '../components/ModernAlert';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const navigation = useNavigation();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // Responsive calculations
  const isSmallScreen = screenHeight < 700;
  const isLargeScreen = screenHeight > 900;
  
  // Responsive header height: 40-50% of screen height, minimum 200px, maximum 60% of screen
  // Add safe area top inset to ensure header doesn't overlap with status bar/notch
  const baseHeaderHeight = Math.max(200, Math.min(screenHeight * 0.5, screenHeight * 0.6));
  const headerHeight = baseHeaderHeight + insets.top;
  
  // Responsive form card min height: adapts to screen size
  const formCardMinHeight = isSmallScreen ? 280 : isLargeScreen ? 360 : 320;
  
  // Responsive font sizes
  const inputFontSize = screenWidth < 360 ? 14 : 15;
  const buttonFontSize = screenWidth < 360 ? 16 : 17;
  const labelFontSize = screenWidth < 360 ? 13 : 14;
  
  // Responsive padding
  const formPadding = screenWidth < 360 ? 20 : 25;
  const inputPadding = screenWidth < 360 ? 15 : 18;
  
  const scrollViewRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const formCardRef = useRef(null);

  // Load saved email when component mounts
  useEffect(() => {
    loadSavedEmail();
  }, []);


  // Function to load saved email from AsyncStorage
  const loadSavedEmail = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('lastUsedEmail');
      if (savedEmail) {
        setEmail(savedEmail);
      }
    } catch (error) {
      console.error('Error loading saved email:', error);
    }
  };

  // Function to save email to AsyncStorage
  const saveEmail = async (emailToSave) => {
    try {
      await AsyncStorage.setItem('lastUsedEmail', emailToSave);
    } catch (error) {
      console.error('Error saving email:', error);
    }
  };

  const API_BASE_URL = ENV_API_BASE_URL;

  const handleLogin = async () => {
    setErrorMessage('');
    setLoading(true);

    if (!email || !password) {
      setErrorMessage('Email and password are required.');
      setLoading(false);
      return;
    }

    try {    
      const response = await fetch(`${API_BASE_URL}/mobile/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

    
      const data = await response.json();
      console.log('Login response:', data);

    
      if (response.ok && data.success) {
        // Debug: Log token structure to verify format
        console.log('=== Login Response Debug ===');
        console.log('Token structure:', {
          hasToken: !!data.data?.token,
          hasAccessToken: !!data.data?.token?.access_token,
          tokenType: typeof data.data?.token?.access_token,
          tokenLength: data.data?.token?.access_token?.length,
          tokenPreview: data.data?.token?.access_token?.substring(0, 30) + '...',
          hasBearer: data.data?.token?.access_token?.startsWith('Bearer '),
          expiresAt: data.data?.token?.expires_at
        });
        console.log('===========================');
  
        // Save the email for future logins
        await saveEmail(email.trim());
        
        // Extract token - handle different possible response structures
        const token = data.data?.token?.access_token || data.data?.token?.token || data.data?.access_token;
        const user = data.data?.user || data.data;
        const expiry = data.data?.token?.expires_at || data.data?.token?.expires_in || data.data?.expires_at;
        
        if (!token) {
          console.error('No token found in login response:', data);
          setErrorMessage('Login failed: Invalid response from server');
          setLoading(false);
          return;
        }
        
        // Use the auth context to handle login
        await login(token, user, expiry);
        
        console.log('Login successful, authentication state updated');
        // No need to navigate manually - the auth context will handle it
      } else {
        setErrorMessage('Incorrect email or password');
      }
    } catch (error) {
      console.error('Full error object:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      if (error.message === 'Network request failed') {
        setErrorMessage('Network error. Please check your internet connection.');
      } else {
        setErrorMessage(`Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // Pre-fill email if available
    setForgotPasswordEmail(email);
    setForgotPasswordVisible(true);
  };

  const handleForgotPasswordSubmit = async () => {
    if (!forgotPasswordEmail || !forgotPasswordEmail.trim()) {
      setAlertConfig({
        title: 'Email Required',
        message: 'Please enter your email address.',
        type: 'warning',
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
    if (!emailRegex.test(forgotPasswordEmail.trim())) {
      setAlertConfig({
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
        type: 'warning',
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

    setForgotPasswordLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/mobile/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          email: forgotPasswordEmail.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAlertConfig({
          title: 'Password Reset Sent',
          message: 'If an account exists with this email, you will receive password reset instructions shortly. Please check your email and click the link to reset your password on the web.',
          type: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: () => {
                setForgotPasswordVisible(false);
                setForgotPasswordEmail('');
              },
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      } else {
        // Show success message even if email doesn't exist (security best practice)
        setAlertConfig({
          title: 'Password Reset Sent',
          message: 'If an account exists with this email, you will receive password reset instructions shortly. Please check your email and click the link to reset your password on the web.',
          type: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: () => {
                setForgotPasswordVisible(false);
                setForgotPasswordEmail('');
              },
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setAlertConfig({
        title: 'Error',
        message: error.message === 'Network request failed' 
          ? 'Network error. Please check your internet connection.'
          : `Error: ${error.message}`,
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
      setForgotPasswordLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    setAlertConfig({
      title: 'Social Login',
      message: `${provider} login functionality coming soon.`,
      type: 'info',
      buttons: [
        {
          text: 'OK',
          onPress: () => {},
          style: 'primary',
        },
      ],
    });
    setAlertVisible(true);
  };

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={20}
        extraHeight={20}
        keyboardOpeningTime={0}
        enableResetScrollToCoords={true}
        resetScrollToCoords={{ x: 0, y: 0 }}
        scrollEnabled={true}
        enableScrollToFocusedInput={true}
        keyboardDismissMode="interactive"
        bounces={false}
      >
        <View style={[styles.headerContainer, { height: headerHeight, paddingTop: insets.top }]}>
          <Image
            source={require('../assets/images/fitness-model.png')}
            style={styles.headerImage}
            resizeMode="cover"
          />
        </View>
        <View 
          ref={formCardRef}
          style={[styles.formCard, { 
            minHeight: formCardMinHeight,
            padding: formPadding,
            paddingBottom: Platform.OS === 'android' ? (isSmallScreen ? 60 : 70) : (isSmallScreen ? 50 : 60)
          }]}
        >
        <TextInput
          ref={emailInputRef}
          placeholder="Email"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          style={[styles.input, { 
            fontSize: inputFontSize,
            paddingHorizontal: inputPadding 
          }]}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          returnKeyType="next"
          onSubmitEditing={() => passwordInputRef.current?.focus()}
        />
        <View style={styles.passwordContainer}>
          <TextInput
            ref={passwordInputRef}
            placeholder="Password"
            placeholderTextColor="#aaa"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            style={[styles.passwordInput, { 
              fontSize: inputFontSize,
              paddingHorizontal: inputPadding 
            }]}
            autoCapitalize="none"
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
            disabled={loading}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color="#aaa"
            />
          </TouchableOpacity>
        </View>
        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        <View style={styles.row}>
          <View style={styles.checkboxContainer}>
            <CheckBox 
              value={remember} 
              onValueChange={setRemember} 
              tintColors={{ true: '#000', false: '#aaa' }}
              disabled={loading}
            />
            <Text style={[styles.checkboxLabel, { fontSize: labelFontSize }]}>Remember me</Text>
          </View>
          <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
            <Text style={[styles.forgot, { fontSize: labelFontSize }]}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.buttonText, { fontSize: buttonFontSize }]}>Sign In</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('SignupScreen')} disabled={loading}>
          <Text style={styles.createAccount}>Create an account</Text>
        </TouchableOpacity>
        {/* <Text style={styles.or}>Or sign in with</Text> */}
        {/* <View style={styles.socialRow}>
          <TouchableOpacity 
            style={styles.socialButton} 
            onPress={() => handleSocialLogin('Facebook')}
            disabled={loading}
          >
            <Image
              source={require('../assets/images/facebook.png')}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.socialButton} 
            onPress={() => handleSocialLogin('Google')}
            disabled={loading}
          >
            <Image
              source={require('../assets/images/google.png')}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View> */}
        </View>
      </KeyboardAwareScrollView>
      <ModernAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
      
      {/* Forgot Password Modal */}
      <Modal
        visible={forgotPasswordVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !forgotPasswordLoading && setForgotPasswordVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Forgot Password</Text>
              <TouchableOpacity
                onPress={() => setForgotPasswordVisible(false)}
                disabled={forgotPasswordLoading}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalMessage}>
              Enter your email address and we'll send you instructions to reset your password.
            </Text>
            
            <TextInput
              placeholder="Email"
              placeholderTextColor="#aaa"
              value={forgotPasswordEmail}
              onChangeText={setForgotPasswordEmail}
              style={[styles.modalInput, { 
                fontSize: inputFontSize,
                paddingHorizontal: inputPadding 
              }]}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!forgotPasswordLoading}
              autoFocus={true}
            />
            
            <TouchableOpacity
              style={[styles.modalSubmitButton, forgotPasswordLoading && styles.modalSubmitButtonDisabled]}
              onPress={handleForgotPasswordSubmit}
              disabled={forgotPasswordLoading}
            >
              {forgotPasswordLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSubmitButtonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setForgotPasswordVisible(false)}
              disabled={forgotPasswordLoading}
              style={styles.modalCancelButton}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F7F4',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'android' ? 0 : 50,
  },
  headerContainer: {
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 0,
    overflow: 'hidden',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerTextOverlay: {
    position: 'absolute',
    left: 20,
    top: 50,
    zIndex: 2,
  },
  title: {
    fontSize: 44,
    fontWeight: '900',
    color: '#000',
    lineHeight: 48,
    letterSpacing: -2,
    textAlign: 'left',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 40,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    marginHorizontal: 0,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 160,
  },
  input: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 13,
    marginVertical: 8,
    color: '#000',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginVertical: 8,
  },
  passwordInput: {
    flex: 1,
    color: '#000',
    paddingVertical: 13,
  },
  eyeButton: {
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    marginLeft: 5,
    color: '#333',
  },
  forgot: {
    color: '#555',
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: '#000',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  errorText: {
    color: '#c00',
    marginTop: 6,
  },
  createAccount: {
    marginTop: 18,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#000',
    textDecorationLine: 'underline',
  },
  or: {
    textAlign: 'center',
    marginVertical: 12,
    color: '#888',
    fontSize: 14,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
    gap: 20,
  },
  socialButton: {
    marginHorizontal: 0,
    padding: 13,
    borderRadius: 30,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: Dimensions.get('window').width * 0.9,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
  },
  closeButton: {
    padding: 4,
  },
  modalMessage: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  modalInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 13,
    marginBottom: 20,
  },
  modalSubmitButton: {
    backgroundColor: '#000',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalSubmitButtonDisabled: {
    opacity: 0.7,
  },
  modalSubmitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
  modalCancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
});
