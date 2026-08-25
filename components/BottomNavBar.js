import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BottomNavBar({ selectedTab, navigation, onTabChange }) {
  const insets = useSafeAreaInsets();
  
  const handleTabPress = (tab) => {
    if (onTabChange) onTabChange(tab);
    if (navigation) {
      if (tab === 'Home') navigation.navigate('Dashboard');
      else if (tab === 'Calendar') navigation.navigate('ActivityCalendarScreen');
      else if (tab === 'Profile') navigation.navigate('ProfileScreen');
    }
  };

  return (
    <View style={[styles.bottomNavPillContainer, { bottom: insets.bottom + 10 }]}>
      <View style={styles.bottomNavPill}>
        <TouchableOpacity
          style={[
            styles.navItemPill,
            selectedTab === 'Home' ? styles.navItemPillActive : styles.navItemPillInactive,
            styles.navItemPillLeft,
          ]}
          onPress={() => handleTabPress('Home')}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.navTextPill,
            selectedTab === 'Home' ? styles.navTextPillActive : styles.navTextPillInactive,
          ]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.navItemPill,
            selectedTab === 'Calendar' ? styles.navItemPillActive : styles.navItemPillInactive,
          ]}
          onPress={() => handleTabPress('Calendar')}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.navTextPill,
            selectedTab === 'Calendar' ? styles.navTextPillActive : styles.navTextPillInactive,
          ]}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.navItemPill,
            selectedTab === 'Profile' ? styles.navItemPillActive : styles.navItemPillInactive,
            styles.navItemPillRight,
          ]}
          onPress={() => handleTabPress('Profile')}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.navTextPill,
            selectedTab === 'Profile' ? styles.navTextPillActive : styles.navTextPillInactive,
          ]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavPillContainer: {
    position: 'absolute',
    left: 10,
    right: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  bottomNavPill: {
    flexDirection: 'row',
    backgroundColor: '#222',
    borderRadius: 30,
    overflow: 'hidden',
    width: 300,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  navItemPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  navItemPillLeft: {
    borderTopLeftRadius: 30,
    borderBottomLeftRadius: 30,
  },
  navItemPillRight: {
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
  },
  navItemPillActive: {
    backgroundColor: '#e7ead7',
    borderRadius: 50,
  },
  navItemPillInactive: {
    backgroundColor: '#222',
  },
  navTextPill: {
    fontSize: 15,
    fontWeight: '600',
  },
  navTextPillActive: {
    color: '#222',
    fontWeight: 'bold',
  },
  navTextPillInactive: {
    color: '#fff',
    fontWeight: '600',
  },
}); 