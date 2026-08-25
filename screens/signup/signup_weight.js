import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function SignupHeightScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [unit, setUnit] = useState('cm');
  const [height, setHeight] = useState('180');

  // Convert height if unit changes
  const handleUnitChange = (newUnit) => {
    if (unit !== newUnit) {
      if (newUnit === 'cm') {
        setHeight(Math.round(parseFloat(height) * 2.54).toString());
      } else {
        setHeight((parseFloat(height) / 2.54).toFixed(1).toString());
      }
      setUnit(newUnit);
    }
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

      {/* Height Section */}
      <Text style={styles.label}>Height</Text>
      <View style={styles.heightInputWrapper}>
        <TextInput
          style={styles.heightInput}
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
          maxLength={unit === 'cm' ? 3 : 5}
        />
        <Text style={styles.unitText}>{unit}</Text>
      </View>

      {/* Unit Toggle */}
      <View style={styles.unitToggleRow}>
        <TouchableOpacity
          style={[styles.unitToggle, unit === 'cm' && styles.unitToggleSelected]}
          onPress={() => handleUnitChange('cm')}
        >
          <Text style={[styles.unitToggleText, unit === 'cm' && styles.unitToggleTextSelected]}>cm</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unitToggle, unit === 'inch' && styles.unitToggleSelected]}
          onPress={() => handleUnitChange('inch')}
        >
          <Text style={[styles.unitToggleText, unit === 'inch' && styles.unitToggleTextSelected]}>inch</Text>
        </TouchableOpacity>
      </View>

      {/* Next Button */}
      <TouchableOpacity style={styles.nextButton} onPress={() => navigation.navigate('LoginScreen')}>
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
    marginHorizontal: 30,
    marginBottom: 40,
    textAlign: 'center',
    alignSelf: 'center',
    lineHeight: 18,
  },
  label: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  heightInputWrapper: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#EDEDEB',
    borderRadius: 30,
    width: 220,
    paddingHorizontal: 30,
    paddingVertical: 0,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
    justifyContent: 'space-between',
  },
  heightInput: {
    fontSize: 25,
    fontWeight: '700',
    color: '#111',
    backgroundColor: 'transparent',
    textAlign: 'right',
    width: 100,
    marginRight: 8,
  },
  unitText: {
    fontSize: 20,
    color: '#888',
    fontWeight: '600',
  },
  unitToggleRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginBottom: 40,
  },
  unitToggle: {
    paddingVertical: 6,
    paddingHorizontal: 22,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#111',
    marginHorizontal: 5,
  },
  unitToggleSelected: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  unitToggleText: {
    fontSize: 16,
    color: '#111',
    fontWeight: '600',
  },
  unitToggleTextSelected: {
    color: '#fff',
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
});
