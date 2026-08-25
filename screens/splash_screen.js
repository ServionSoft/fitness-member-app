import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const IMAGE_BOX_SIZE = width * 0.95;

export default function SplashScreen() {
  const navigation = useNavigation();
  const { hasCompletedOnboarding, isAuthenticated, completeOnboarding } = useAuth();

  useEffect(() => {
    // If onboarding is completed, navigate to appropriate screen
    if (hasCompletedOnboarding && navigation?.isReady()) {
      if (isAuthenticated) {
        navigation.replace('Dashboard');
      } else {
        navigation.replace('LoginScreen');
      }
    }
  }, [hasCompletedOnboarding, isAuthenticated, navigation]);

  const handleStartTraining = async () => {
    try {
      // Mark onboarding as completed
      await completeOnboarding();
      // Navigate to login screen only if navigation is ready
      if (navigation?.isReady()) {
        navigation.replace('LoginScreen');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerText}>
        <Text style={styles.titleLine1}>Let's</Text>
        <Text style={styles.titleLine2}>Workout</Text>
        <Text style={styles.titleLine3}>TOGETHER</Text>
      </View>
      <View style={styles.imageBox}>
        <Image
          source={require('../assets/images/startpagegirl.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
      <TouchableOpacity onPress={handleStartTraining} style={styles.button}>
        <Text style={styles.buttonText}>START TRAINING</Text>
        <Icon name="arrow-forward" size={24} color="#fff" style={{ marginLeft: 10, marginRight: 10 }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F7F4',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  headerText: {
    width: '90%',
    marginBottom: 0,
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginTop: 10,
  },
  titleLine1: {
    fontSize: 65,
    fontWeight: '900',
    color: '#000',
    lineHeight: 65,
    letterSpacing: -2,
    textAlign: 'left',
  },
  titleLine2: {
    fontSize: 75,
    fontWeight: '900',
    color: '#000',
    lineHeight: 80,
    letterSpacing: -2,
    textAlign: 'left',
  },
  titleLine3: {
    fontSize: 60,
    fontWeight: '900',
    color: '#000',
    lineHeight: 65,
    letterSpacing: -2,
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  imageBox: {
    width: '100%',
    height: 430,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 0,
    alignSelf: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  button: {
    position: 'absolute',
    left: 25,
    right: 25,
    bottom: '5%',
    backgroundColor: '#000',
    borderRadius: 50,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
    flex: 1,
    textAlign: 'center',
  },
  arrow: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 10,
    marginRight: 20,
  },
});
