import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Define the options
const months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const years = Array.from({ length: 30 }, (_, i) => (1995 + i).toString());

export default function SignupDobScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Track selected values directly
  const [selectedDay, setSelectedDay] = useState('05');
  const [selectedMonth, setSelectedMonth] = useState('May');
  const [selectedYear, setSelectedYear] = useState('2014');

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
      <Text style={styles.label}>Date of birth</Text>

      <View style={{marginLeft:100,marginRight:100}}>
      <View style={styles.dobSection}>
        {/* Day Picker */}
        <View style={styles.pickerCol}>
          <Picker
            selectedValue={selectedDay}
            style={styles.picker}
            itemStyle={styles.pickerItem}
            onValueChange={setSelectedDay}
            mode="dropdown"
          >
            {days.map(day => (
              <Picker.Item
                key={day}
                label={day}
                value={day}
                color={day === selectedDay ? '#111' : '#bbb'}
              />
            ))}
          </Picker>
        </View>
        {/* Month Picker */}
        <View style={styles.pickerCol}>
          <Picker
            selectedValue={selectedMonth}
            style={styles.picker}
            itemStyle={styles.pickerItem}
            onValueChange={setSelectedMonth}
            mode="dropdown"
          >
            {months.map(month => (
              <Picker.Item
                key={month}
                label={month}
                value={month}
                color={month === selectedMonth ? '#111' : '#bbb'}
              />
            ))}
          </Picker>
        </View>
        {/* Year Picker */}
        <View style={styles.pickerCol}>
          <Picker
            selectedValue={selectedYear}
            style={styles.picker}
            itemStyle={styles.pickerItem}
            onValueChange={setSelectedYear}
            mode="dropdown"
          >
            {years.map(year => (
              <Picker.Item
                key={year}
                label={year}
                value={year}
                color={year === selectedYear ? '#111' : '#bbb'}
              />
            ))}
          </Picker>
        </View>
      </View>
      </View>
      {/* Next Button */}
      <TouchableOpacity style={styles.nextButton} onPress={() => navigation.navigate('SignupHeightScreen')}>
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
  dobSection: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 30,
    padding: 5,
    marginBottom: 40,
    marginTop: 10,
    
  },
  pickerCol: {
    borderBottomWidth: 2,
    borderBottomColor: '#111',
    marginHorizontal: 8,
    width: 90,
    alignItems: 'center',
  },
  picker: {
    width: 100,
    height: Platform.OS === 'ios' ? 180 : 50,
    color: '#111',
  },
  pickerItem: {
    fontSize: 20,
    textAlign: 'center',
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
