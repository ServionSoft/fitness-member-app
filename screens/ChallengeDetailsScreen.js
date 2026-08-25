import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';

const { width: screenWidth } = Dimensions.get('window');

export default function ChallengeDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { participation, challenge } = route.params || {};
  
  // Extract challenge data from participation or direct challenge prop
  const challengeData = participation?.challenge || challenge || {};
  const participationData = participation || {};
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [challengeDetails, setChallengeDetails] = useState(null);
  
  const API_BASE_URL = ENV_API_BASE_URL;
  const BASE_URL = API_BASE_URL.replace('/api', '');

  // Calculate time remaining
  const calculateTimeRemaining = () => {
    if (!challengeData.end_date && !challengeData.duration) return null;
    
    let endDate;
    if (challengeData.end_date) {
      endDate = new Date(challengeData.end_date);
    } else if (participationData.start_date && challengeData.duration) {
      const startDate = new Date(participationData.start_date);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + challengeData.duration);
    } else {
      return null;
    }
    
    const now = new Date();
    const diff = endDate - now;
    
    if (diff <= 0) return { days: 0, hours: 0, expired: true };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return { days, hours, expired: false };
  };

  const timeRemaining = calculateTimeRemaining();
  
  // Get challenge status
  const getStatus = () => {
    if (participationData.status) {
      return participationData.status.toLowerCase();
    }
    if (participationData.progress >= 100) {
      return 'completed';
    }
    if (timeRemaining?.expired) {
      return 'expired';
    }
    return 'active';
  };

  const status = getStatus();
  const progress = participationData.progress || 0;
  const currentValue = participationData.current_value || 0;
  const targetValue = challengeData.target_value || challengeData.goal || 'N/A';
  const unit = challengeData.unit || '';

  // Fetch challenge details (placeholder for future API call)
  useEffect(() => {
    // For now, use the data passed from navigation
    if (participation || challenge) {
      setChallengeDetails({
        ...challengeData,
        participation: participationData,
      });
      setLoading(false);
    } else {
      setError('Challenge data not found');
      setLoading(false);
    }
  }, [participation, challenge]);

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'expired':
        return '#999';
      case 'active':
        return '#007bff';
      default:
        return '#666';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'expired':
        return 'Expired';
      case 'active':
        return 'Active';
      default:
        return 'Unknown';
    }
  };

  const imageUri = challengeData.image || challengeData.image_url || null;

  if (loading && !challengeDetails) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#222" />
          <Text style={styles.loadingText}>Loading challenge details...</Text>
        </View>
      </View>
    );
  }

  if (error && !challengeDetails) {
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.topBackButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#999" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity 
        style={styles.topBackButton} 
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={20} color="#222" />
      </TouchableOpacity>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Challenge Image */}
        {imageUri ? (
          <Image 
            source={{ uri: imageUri }} 
            style={styles.challengeImage}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons name="trophy" size={64} color="#ccc" />
          </View>
        )}

        {/* Challenge Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
            </View>
          </View>
          
          <Text style={styles.challengeTitle}>
            {challengeData.name || 'Challenge'}
          </Text>
          
          {challengeData.description && (
            <Text style={styles.challengeDescription}>
              {challengeData.description}
            </Text>
          )}

          {/* Challenge Meta Info */}
          <View style={styles.metaContainer}>
            {challengeData.duration && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.metaText}>{challengeData.duration} days</Text>
              </View>
            )}
            {challengeData.goal && (
              <View style={styles.metaItem}>
                <Ionicons name="flag-outline" size={16} color="#666" />
                <Text style={styles.metaText}>Goal: {challengeData.goal}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Progress Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Progress</Text>
            <Text style={styles.progressPercentage}>{progress}%</Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${Math.min(progress, 100)}%`,
                    backgroundColor: status === 'completed' ? '#4CAF50' : '#222'
                  }
                ]} 
              />
            </View>
          </View>

          {/* Workout-based progress display */}
          {challengeData.challenge_type === 'workout_based' && challengeData.required_workouts && participationData.completed_workouts !== null && participationData.completed_workouts !== undefined ? (
            <View style={styles.progressStats}>
              <View style={styles.progressStatItem}>
                <Text style={styles.progressStatLabel}>Completed</Text>
                <Text style={styles.progressStatValue}>
                  {participationData.completed_workouts || 0}
                </Text>
              </View>
              <View style={styles.progressStatDivider} />
              <View style={styles.progressStatItem}>
                <Text style={styles.progressStatLabel}>Required</Text>
                <Text style={styles.progressStatValue}>
                  {challengeData.required_workouts}
                </Text>
              </View>
              <View style={styles.progressStatDivider} />
              <View style={styles.progressStatItem}>
                <Text style={styles.progressStatLabel}>Remaining</Text>
                <Text style={styles.progressStatValue}>
                  {Math.max(0, challengeData.required_workouts - (participationData.completed_workouts || 0))}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.progressStats}>
              <View style={styles.progressStatItem}>
                <Text style={styles.progressStatLabel}>Current</Text>
                <Text style={styles.progressStatValue}>
                  {currentValue} {unit}
                </Text>
              </View>
              <View style={styles.progressStatDivider} />
              <View style={styles.progressStatItem}>
                <Text style={styles.progressStatLabel}>Target</Text>
                <Text style={styles.progressStatValue}>
                  {targetValue} {unit}
                </Text>
              </View>
              <View style={styles.progressStatDivider} />
              <View style={styles.progressStatItem}>
                <Text style={styles.progressStatLabel}>Remaining</Text>
                <Text style={styles.progressStatValue}>
                  {Math.max(0, (typeof targetValue === 'number' ? targetValue : parseFloat(targetValue) || 0) - currentValue)} {unit}
                </Text>
              </View>
            </View>
          )}
          
          {/* Workout progress text */}
          {challengeData.challenge_type === 'workout_based' && challengeData.required_workouts && participationData.completed_workouts !== null && participationData.completed_workouts !== undefined && (
            <View style={styles.workoutProgressTextContainer}>
              <Text style={styles.workoutProgressText}>
                {participationData.completed_workouts || 0}/{challengeData.required_workouts} workouts completed ({Math.round(progress)}%)
              </Text>
            </View>
          )}
        </View>

        {/* Time Remaining */}
        {timeRemaining && !timeRemaining.expired && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="hourglass-outline" size={20} color="#222" />
              <Text style={styles.cardTitle}>Time Remaining</Text>
            </View>
            <View style={styles.timeContainer}>
              <View style={styles.timeItem}>
                <Text style={styles.timeValue}>{timeRemaining.days}</Text>
                <Text style={styles.timeLabel}>Days</Text>
              </View>
              <View style={styles.timeItem}>
                <Text style={styles.timeValue}>{timeRemaining.hours}</Text>
                <Text style={styles.timeLabel}>Hours</Text>
              </View>
            </View>
          </View>
        )}

        {/* Reward Section */}
        {challengeData.reward && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="gift-outline" size={20} color="#222" />
              <Text style={styles.cardTitle}>Reward</Text>
            </View>
            <View style={styles.rewardContainer}>
              <MaterialCommunityIcons name="trophy" size={32} color="#FFD700" />
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardName}>
                  {challengeData.reward.name || 'Challenge Reward'}
                </Text>
                {challengeData.reward.points && (
                  <Text style={styles.rewardPoints}>
                    {challengeData.reward.points} points
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Activities/Workouts Section */}
        {challengeData.challenge_type === 'workout_based' && challengeData.required_workouts ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="fitness-outline" size={20} color="#222" />
              <Text style={styles.cardTitle}>Workout Progress</Text>
            </View>
            <View style={styles.workoutInfoContainer}>
              <View style={styles.workoutInfoItem}>
                <MaterialCommunityIcons name="dumbbell" size={24} color="#222" />
                <View style={styles.workoutInfoText}>
                  <Text style={styles.workoutInfoLabel}>Workouts Completed</Text>
                  <Text style={styles.workoutInfoValue}>
                    {participationData.completed_workouts || 0} of {challengeData.required_workouts}
                  </Text>
                </View>
              </View>
              <View style={styles.workoutInfoDivider} />
              <View style={styles.workoutInfoItem}>
                <Ionicons name="information-circle-outline" size={24} color="#666" />
                <View style={styles.workoutInfoText}>
                  <Text style={styles.workoutInfoLabel}>How it works</Text>
                  <Text style={styles.workoutInfoDescription}>
                    Each workout day you complete counts toward this challenge. Progress updates automatically.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="list-outline" size={20} color="#222" />
              <Text style={styles.cardTitle}>Activities Counted</Text>
            </View>
            <View style={styles.placeholderContainer}>
              <Ionicons name="information-circle-outline" size={24} color="#999" />
              <Text style={styles.placeholderText}>
                Activities and workouts that count toward this challenge will appear here
              </Text>
            </View>
          </View>
        )}

        {/* Challenge Info */}
        {(challengeData.start_date || challengeData.end_date) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={20} color="#222" />
              <Text style={styles.cardTitle}>Challenge Period</Text>
            </View>
            <View style={styles.dateContainer}>
              {participationData.start_date && (
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <Text style={styles.dateValue}>
                    {new Date(participationData.start_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
              )}
              {challengeData.end_date && (
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>End Date</Text>
                  <Text style={styles.dateValue}>
                    {new Date(challengeData.end_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  topBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  challengeImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    backgroundColor: '#fff',
    marginHorizontal: '5%',
    marginTop: -30,
    borderRadius: 16,
    padding: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  challengeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  challengeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: '5%',
    marginBottom: 16,
    borderRadius: 16,
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
    marginLeft: 'auto',
  },
  progressBarContainer: {
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 10,
    backgroundColor: '#e8e9e4',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    transition: 'width 0.3s ease',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  progressStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  progressStatLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
    marginBottom: 4,
  },
  progressStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  progressStatDivider: {
    width: 1,
    backgroundColor: '#e8e9e4',
    marginHorizontal: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  timeItem: {
    alignItems: 'center',
    flex: 1,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#222',
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rewardInfo: {
    marginLeft: 12,
    flex: 1,
  },
  rewardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  rewardPoints: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  placeholderContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  placeholderText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  dateContainer: {
    gap: 12,
  },
  dateItem: {
    paddingVertical: 8,
  },
  dateLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  workoutProgressTextContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  workoutProgressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  workoutInfoContainer: {
    gap: 12,
  },
  workoutInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  workoutInfoText: {
    flex: 1,
  },
  workoutInfoLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    marginBottom: 4,
  },
  workoutInfoValue: {
    fontSize: 18,
    color: '#222',
    fontWeight: '700',
  },
  workoutInfoDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  workoutInfoDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 4,
  },
});

