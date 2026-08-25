import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import { useAuth } from '../contexts/AuthContext';
import ModernAlert from '../components/ModernAlert';



const SettingsScreen = () => {
  const [menuVisible, setMenuVisible] = useState(false);
  const navigation = useNavigation();
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });

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
        onMenuPress={() => setMenuVisible(true)}
      />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 80, alignItems: 'center', flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* Settings Title */}
        <Text style={styles.title}>Settings</Text>
        {/* Settings Options */}
        <View style={styles.optionsContainer}>
          <SettingsOption icon="account" label="Account" onPress={() => navigation.navigate('AccountScreen')} />
          <SettingsOption icon="bell" label="Notifications"  onPress={() => navigation.navigate('NotificationSettingsScreen')}/>
          <SettingsOption icon="lock" label="Privacy"  onPress={() => navigation.navigate('PrivacyScreen')} />
          {/* <SettingsOption icon="credit-card-outline" label="Payments" onPress={() => navigation.navigate('PaymentScreen')} /> */}
          <SettingsOption icon="help-circle-outline" label="Help"  onPress={() => navigation.navigate('HelpScreen')}/>
        </View>
        {/* App Version */}
        <Text style={styles.version}>App version 11.5.9</Text>
        {/* Back Button */}
        
      </ScrollView>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Dashboard')}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        
      {/* Modern Alert */}
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

const SettingsOption = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.option} onPress={onPress}>
    <MaterialCommunityIcons name={icon} size={22} color="#333" />
    <Text style={styles.optionText}>{label}</Text>
    <Ionicons name="chevron-forward" size={22} color="#888" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8' },
  title: { fontSize: 24,color: '#000', fontWeight: 'bold', marginTop: 10, alignSelf: 'flex-start', marginLeft: '8%' },
  optionsContainer: { width: '90%', marginTop: 20 },
  option: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  optionText: { flex: 1, marginLeft: 12, fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  version: { color: '#888', marginTop: 20, alignSelf: 'center' },
  backButton: { flexDirection: 'row',bottom:'5%', alignItems: 'center', backgroundColor: '#222', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginTop: 40, alignSelf: 'center' },
  backText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
});

export default SettingsScreen; 