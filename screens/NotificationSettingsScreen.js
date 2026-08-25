import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NotificationSettingsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [allNotifications, setAllNotifications] = useState(true);
  const [activitiesReminder, setActivitiesReminder] = useState(true);
  const [scheduleNotifications, setScheduleNotifications] = useState(true);
  const [communityNotifications, setCommunityNotifications] = useState(true);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backArrowBtn}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* App Notifications */}
        <Text style={styles.sectionTitle}>App Notifications</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>All notifications</Text>
          <Switch
            value={allNotifications}
            onValueChange={setAllNotifications}
            trackColor={{ false: '#ccc', true: '#222' }}
            thumbColor={allNotifications ? '#fff' : '#fff'}
          />
        </View>
        {/* Undone activities reminder */}
        <Text style={styles.sectionTitle}>Undone activities reminder</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Activities notification</Text>
          <Switch
            value={activitiesReminder}
            onValueChange={setActivitiesReminder}
            trackColor={{ false: '#ccc', true: '#222' }}
            thumbColor={activitiesReminder ? '#fff' : '#fff'}
          />
        </View>
        {/* Schedule notifications */}
        <Text style={styles.sectionTitle}>Schedule notifications</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Class booking or cancellation</Text>
          <Switch
            value={scheduleNotifications}
            onValueChange={setScheduleNotifications}
            trackColor={{ false: '#ccc', true: '#222' }}
            thumbColor={scheduleNotifications ? '#fff' : '#fff'}
          />
        </View>
        {/* Community notifications */}
        <Text style={styles.sectionTitle}>Community notifications</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Groups and chats</Text>
          <Switch
            value={communityNotifications}
            onValueChange={setCommunityNotifications}
            trackColor={{ false: '#ccc', true: '#222' }}
            thumbColor={communityNotifications ? '#fff' : '#fff'}
          />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 18,
    paddingHorizontal: 18,
    backgroundColor: 'transparent',
    minHeight: 44,
  },
  backArrowBtn: { marginRight: 10, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#222' },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginTop: 18, marginBottom: 10, marginLeft: 18, color: '#1a1a1a' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 18, marginBottom: 8, elevation: 2 },
  settingLabel: { color: '#1a1a1a', fontWeight: '600', fontSize: 15 },
  backButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, position: 'absolute', bottom: 40, alignSelf: 'center' },
  backText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
});

export default NotificationSettingsScreen; 