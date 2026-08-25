import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';

const helpOptions = [
  { icon: <Feather name="help-circle" size={22} color="#333" />, label: 'Ask a question' },
  { icon: <Feather name="alert-triangle" size={22} color="#333" />, label: 'Report an app problem' },
  { icon: <Feather name="list" size={22} color="#333" />, label: 'Request an app feature' },
  { icon: <Feather name="message-square" size={22} color="#333" />, label: 'Write a review' },
];

const HelpScreen = () => {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backArrowBtn}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.optionsContainer}>
          {helpOptions.map((item) => (
            <TouchableOpacity key={item.label} style={styles.option}>
              {item.icon}
              <Text style={styles.optionText}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={22} color="#888" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 18, paddingHorizontal: 18, backgroundColor: 'transparent' },
  backArrowBtn: { marginRight: 10, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#222' },
  optionsContainer: { width: '90%', alignSelf: 'center', marginTop: 20 },
  option: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  optionText: { flex: 1, marginLeft: 12, fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  backButton: { flexDirection: 'row', bottom: '5%', alignItems: 'center', backgroundColor: '#222', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, position: 'absolute', alignSelf: 'center' },
  backText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
});

export default HelpScreen; 