import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WorkoutFinishedScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { duration = 0, calories = 0, activities = 0, sets = 0, summary } = route.params || {};

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Close Button */}
        <TouchableOpacity 
          style={styles.closeBtn} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="close" size={24} color="#222" />
        </TouchableOpacity>

        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="trophy" size={64} color="#4CAF50" />
          </View>
          <Text style={styles.title}>Great job!</Text>
          <Text style={styles.subtitle}>Training finished</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialCommunityIcons name="clock-outline" size={28} color="#222" />
              </View>
              <Text style={styles.statValue}>{formatDuration(duration)}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialCommunityIcons name="fire" size={28} color="#FF9800" />
              </View>
              <Text style={styles.statValue}>{calories}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialCommunityIcons name="dumbbell" size={28} color="#2196F3" />
              </View>
              <Text style={styles.statValue}>{activities}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialCommunityIcons name="repeat" size={28} color="#9C27B0" />
              </View>
              <Text style={styles.statValue}>{sets}</Text>
              <Text style={styles.statLabel}>Sets</Text>
            </View>
          </View>
        </View>

        {/* Completion Badge */}
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
            <Text style={styles.badgeText}>Workout Completed</Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity 
          style={styles.doneButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

function formatDuration(mins) {
  const m = Math.max(0, Math.floor(mins));
  const mm = String(m).padStart(2, '0');
  return `${mm}:00`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf8',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },
  hero: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#222',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  statsContainer: {
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 6,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#222',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2e7d32',
    marginLeft: 8,
  },
  doneButton: {
    backgroundColor: '#222',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginBottom: 20,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default WorkoutFinishedScreen;
