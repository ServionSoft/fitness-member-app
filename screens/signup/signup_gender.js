import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const GENDERS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' }
];

export default function SignupGenderScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('female');
  const [buttonLayouts, setButtonLayouts] = useState([]);
  const underlineAnim = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;

  // Scale animation for each button
  const scaleAnims = useRef(GENDERS.map(() => new Animated.Value(1))).current;
  const prevSelected = useRef(GENDERS.findIndex(g => g.value === selected));

  // Find the index of the selected gender
  const selectedIndex = GENDERS.findIndex(g => g.value === selected);

  useEffect(() => {
    if (buttonLayouts[selectedIndex]) {
      Animated.spring(underlineAnim, {
        toValue: buttonLayouts[selectedIndex].x,
        useNativeDriver: false,
      }).start();
      Animated.spring(underlineWidth, {
        toValue: buttonLayouts[selectedIndex].width,
        useNativeDriver: false,
      }).start();
    }
  }, [selected, buttonLayouts]);

  // Animate scale when selected changes
  useEffect(() => {
    if (prevSelected.current !== selectedIndex) {
      Animated.spring(scaleAnims[selectedIndex], {
        toValue: 1.1,
        friction: 5,
        useNativeDriver: true,
      }).start();
      Animated.spring(scaleAnims[prevSelected.current], {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();
      prevSelected.current = selectedIndex;
    }
  }, [selectedIndex, scaleAnims]);

  const handleLayout = (event, idx) => {
    const { x, width } = event.nativeEvent.layout;
    setButtonLayouts(prev => {
      const next = [...prev];
      next[idx] = { x, width };
      return next;
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity>
          <Icon name="close" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Create an account</Text>
        <TouchableOpacity>
          <Icon name="more-vert" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Heading */}
      <Text style={styles.heading}>Tell us about yourself</Text>
      <Text style={styles.subheading}>
        This information is used to personalize your experience, for example to calculate your burned calories and required intake more accurately.
      </Text>

      {/* Gender Selection */}
      <View style={styles.genderSection}>
        <Text style={styles.genderLabel}>Gender</Text>
        <View style={styles.genderRow}>
          {GENDERS.map((g, idx) => (
            <Animated.View
              key={g.value}
              style={{
                transform: [{ scale: scaleAnims[idx] }],
              }}
            >
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  selected === g.value && styles.genderButtonSelected,
                ]}
                onPress={() => setSelected(g.value)}
                onLayout={e => handleLayout(e, idx)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.genderText,
                    selected === g.value && styles.genderTextSelected,
                  ]}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
          {/* Animated Underline */}
          {buttonLayouts[selectedIndex] && (
            <Animated.View
              style={[
                styles.underline,
                {
                  width: underlineWidth,
                  transform: [{ translateX: underlineAnim }],
                },
              ]}
            />
          )}
        </View>
      </View>

      {/* Next Button */}
      <TouchableOpacity style={styles.nextButton} onPress={() => navigation.navigate('SignupDobScreen')}>
        <Icon name="arrow-forward" size={28} color="#fff" />
      </TouchableOpacity>
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
    fontSize: 24,
    
    fontWeight: '900',
    color: '#000',
    marginBottom: 10,
    marginTop: 40,
    lineHeight: 30,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 14,
    color: '#888',
    marginLeft: 30,
    marginRight: 30,
    marginBottom: 40,
    textAlign: 'center',
    alignSelf: 'center',
    lineHeight: 18,
  },
  genderLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight:'bold'
    // marginTop: 10,
  },
  genderRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#222',
    borderRadius: 30,
    padding: 5,
    marginBottom: 40,
    position: 'relative', // for underline absolute positioning
  },
  genderButton: {
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 30,
    backgroundColor: 'transparent',
    marginHorizontal: 2,
    minWidth: width * 0.18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#EDEDEB',
  },
  genderText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  genderTextSelected: {
    color: '#222',
    fontWeight: '700',
    
  },
  nextButton: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: '#111',
    borderRadius: 30,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  genderSection: {
    flex: 1,
    marginTop:'30%',
    // justifyContent: 'center',
    // alignItems: 'center',
  },
  underline: {
    position: 'absolute',
    height: 4,
    // backgroundColor: '#fff',
    borderRadius: 2,
    bottom: 0,
    left: 0,
  },
});
