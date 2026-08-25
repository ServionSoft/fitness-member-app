import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const PrivacyScreen = () => {
  const navigation = useNavigation();
  const [privateAccount, setPrivateAccount] = useState(true);
  const [hideFollowers, setHideFollowers] = useState(true);
  const [hideFollowing, setHideFollowing] = useState(true);
  const [hideLikes, setHideLikes] = useState(true);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backArrowBtn}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Account Privacy */}
        <Text style={styles.sectionTitle}>Account privacy</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Private account</Text>
          <Switch
            value={privateAccount}
            onValueChange={setPrivateAccount}
            trackColor={{ false: '#ccc', true: '#222' }}
            thumbColor={privateAccount ? '#fff' : '#fff'}
          />
        </View>
        <Text style={styles.descText}>
          When your account is private, only your followers can see your profile and activity.
        </Text>
        {/* Connections */}
        <Text style={styles.sectionTitle}>Connections</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Hide followers</Text>
          <Switch
            value={hideFollowers}
            onValueChange={setHideFollowers}
            trackColor={{ false: '#ccc', true: '#222' }}
            thumbColor={hideFollowers ? '#fff' : '#fff'}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Hide following</Text>
          <Switch
            value={hideFollowing}
            onValueChange={setHideFollowing}
            trackColor={{ false: '#ccc', true: '#222' }}
            thumbColor={hideFollowing ? '#fff' : '#fff'}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Hide likes</Text>
          <Switch
            value={hideLikes}
            onValueChange={setHideLikes}
            trackColor={{ false: '#ccc', true: '#222' }}
            thumbColor={hideLikes ? '#fff' : '#fff'}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: '5%', paddingBottom: 18, paddingHorizontal: 18, backgroundColor: 'transparent' },
  backArrowBtn: { marginRight: 10, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#222' },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginTop: 18, marginBottom: 10, marginLeft: 18, color: '#1a1a1a' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 18, marginBottom: 8, elevation: 2 },
  settingLabel: { color: '#1a1a1a', fontWeight: '600', fontSize: 15 },
  descText: { color: '#888', fontSize: 13, marginLeft: 18, marginBottom: 8, marginTop: -4 },
  backButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, position: 'absolute', bottom: 40, alignSelf: 'center' },
  backText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
});

export default PrivacyScreen; 