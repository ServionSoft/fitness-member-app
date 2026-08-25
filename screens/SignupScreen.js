import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import CheckBox from '@react-native-community/checkbox';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';

const { width } = Dimensions.get('window');
const API_BASE_URL = ENV_API_BASE_URL;

export default function SignupScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [remember, setRemember] = useState(false);
  const [gender, setGender] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSignup = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    const trimmedFirst = (firstname || '').trim();
    const trimmedLast = (lastname || '').trim();
    const trimmedEmail = (email || '').trim();
    if (!trimmedFirst) {
      setErrorMessage('First name is required.');
      return;
    }
    if (!trimmedLast) {
      setErrorMessage('Last name is required.');
      return;
    }
    if (!trimmedEmail) {
      setErrorMessage('Email is required.');
      return;
    }
    if (!gender) {
      setErrorMessage('Gender is required.');
      return;
    }
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    if (!password || password.length < 6 || !hasLetter || !hasNumber || !hasSymbol) {
      setErrorMessage('Password must be 6+ characters and include letters, numbers, and a symbol.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/mobile/auth/signup-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          firstname: trimmedFirst,
          lastname: trimmedLast,
          email: trimmedEmail,
          password,
          gender,
        }),
      });
      const data = await response.json();
      console.log(data);
      if (response.ok && data.success) {
        setFirstname('');
        setLastname('');
        setEmail('');
        setPassword('');
        setGender('');
        setRemember(false);
        setShowPassword(false);
        setSuccessMessage(data.message || 'Check your email and click the link to verify. Then you can log in.');
      } else {
        setErrorMessage(data.message || 'Signup failed. Please try again.');
      }
    } catch (error) {
      setErrorMessage(error.message === 'Network request failed'
        ? 'Network error. Check your connection.'
        : (error.message || 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace('LoginScreen');
            }
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="close" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Create an account</Text>
        <View style={{ width: 28 }} />
      </View>
<KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ marginLeft: 10, marginRight: 10, marginTop: 10, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
      >
      {/* Heading */}
      <Text style={styles.heading}>
        Complete your{"\n"}
        <Text style={{ fontWeight: '900' }}>Registration</Text>
      </Text>

      {/* Form */}
      <View style={styles.form}>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
        <TextInput
          placeholder="First name"
          placeholderTextColor="#bbb"
          style={styles.input}
          value={firstname}
          onChangeText={setFirstname}
          editable={!loading}
        />
        <TextInput
          placeholder="Last name"
          placeholderTextColor="#bbb"
          style={styles.input}
          value={lastname}
          onChangeText={setLastname}
          editable={!loading}
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[styles.genderOption, gender === 'male' && styles.genderOptionSelected]}
            onPress={() => setGender('male')}
          >
            <Text style={[styles.genderOptionText, gender === 'male' && styles.genderOptionTextSelected]}>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderOption, gender === 'female' && styles.genderOptionSelected]}
            onPress={() => setGender('female')}
          >
            <Text style={[styles.genderOptionText, gender === 'female' && styles.genderOptionTextSelected]}>Female</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          placeholder="Email"
          placeholderTextColor="#bbb"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Password (6+ chars, letter, number, symbol)"
            placeholderTextColor="#bbb"
            secureTextEntry={!showPassword}
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(prev => !prev)}
            disabled={loading}
            style={styles.passwordToggle}
          >
            <Icon name={showPassword ? 'visibility-off' : 'visibility'} size={22} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <CheckBox
            value={remember}
            onValueChange={setRemember}
            tintColors={{ true: '#000', false: '#bbb' }}
            disabled={loading}
          />
          <Text style={styles.rememberText}>Remember me</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Join</Text>
          )}
        </TouchableOpacity>

        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F7F4',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 20,
    minHeight: 44,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginLeft: 30,
    marginBottom: 30,
    marginTop: 30,
    lineHeight: 34,
  },
  form: {
    marginHorizontal: 20,
    marginTop: 0,
  },
  input: {
    backgroundColor: '#EDEDEB',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginVertical: 8,
    fontSize: 16,
    color: '#000',
  },
  passwordContainer: {
    backgroundColor: '#EDEDEB',
    borderRadius: 20,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 16,
    color: '#000',
  },
  passwordToggle: {
    padding: 4,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  genderOption: {
    flex: 1,
    backgroundColor: '#EDEDEB',
    borderRadius: 20,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderOptionSelected: {
    backgroundColor: '#111',
  },
  genderOptionText: {
    fontSize: 16,
    color: '#666',
  },
  genderOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  rememberText: {
    marginLeft: 8,
    color: '#333',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    color: '#c00',
    marginBottom: 8,
    fontSize: 14,
  },
  successText: {
    color: '#0a0',
    marginBottom: 8,
    fontSize: 14,
  },
}); 