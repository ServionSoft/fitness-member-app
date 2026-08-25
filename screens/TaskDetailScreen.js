import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import BottomNavBar from '../components/BottomNavBar';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useAuth } from '../contexts/AuthContext';
import ModernAlert from '../components/ModernAlert';

/**
 * TaskDetailScreen Component
 * 
 * Displays detailed information about a specific task
 * 
 * API Endpoints:
 * - GET /api/mobile/tasks/{id} - Get task details
 * - PUT /api/mobile/tasks/{id}/status - Update task status
 * 
 * Features:
 * - Display full task details
 * - Update task status
 * - Show task metadata (priority, due date, category, etc.)
 * - Pull-to-refresh
 */
export default function TaskDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { taskId } = route.params || {};
  const { logout } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const API_BASE_URL = ENV_API_BASE_URL;

  // Load task details when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (taskId) {
        loadTaskDetails();
      } else {
        setError('Task ID is required');
        setLoading(false);
      }
    }, [taskId])
  );

  const loadTaskDetails = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      if (!taskId) {
        throw new Error('Task ID is required');
      }

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setTask(data.data);
      } else if (data.data) {
        setTask(data.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error loading task details:', err);
      setError(err.message || 'Failed to load task details');
      if (!isRefresh) {
        setAlertConfig({
          title: 'Error',
          message: err.message || 'Failed to load task details',
          type: 'error',
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateTaskStatus = async (newStatus) => {
    try {
      setUpdatingStatus(true);

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update task status');
      }

      // If completing, update local state immediately for instant UI feedback
      if (newStatus === 'completed' && task) {
        setTask({
          ...task,
          status: 'completed',
        });
      }

      // Reload task details to get latest data from server
      await loadTaskDetails();
      
      // Show success message with specific message for completion
      const successMessage = newStatus === 'completed' 
        ? 'Task has been marked as completed successfully!'
        : 'Task status updated successfully';
      
      setAlertConfig({
        title: newStatus === 'completed' ? 'Task Completed' : 'Success',
        message: successMessage,
        type: 'success',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
    } catch (err) {
      console.error('Error updating task status:', err);
      setAlertConfig({
        title: 'Error',
        message: err.message || 'Failed to update task status',
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const onRefresh = () => {
    loadTaskDetails(true);
  };

  const handleStatusChange = () => {
    if (!task || updatingStatus) return;

    // Don't allow cycling for completed tasks
    if (task.status === 'completed') {
      return;
    }

    const statusOptions = ['pending', 'in_progress', 'completed', 'cancelled'];
    const currentIndex = statusOptions.indexOf(task.status);
    const nextStatus = statusOptions[(currentIndex + 1) % statusOptions.length];
    updateTaskStatus(nextStatus);
  };

  const handleCompleteTask = () => {
    if (!task || updatingStatus) return;

    // Show confirmation dialog before completing
    setAlertConfig({
      title: 'Complete Task',
      message: `Are you sure you want to mark "${task.title}" as completed?`,
      type: 'warning',
      buttons: [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'secondary',
        },
        {
          text: 'Complete',
          onPress: () => {
            updateTaskStatus('completed');
          },
          style: 'primary',
        },
      ],
    });
    setAlertVisible(true);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return '#000';
      case 'high':
        return '#222';
      case 'medium':
        return '#666';
      case 'low':
        return '#888';
      default:
        return '#888';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#000';
      case 'in_progress':
        return '#222';
      case 'pending':
        return '#666';
      case 'cancelled':
        return '#888';
      default:
        return '#888';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'in_progress':
        return 'time';
      case 'pending':
        return 'hourglass';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'ellipse';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);
    const diffTime = taskDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
          style: 'primary',
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
    if (item.lib === 'Feather') IconComponent = require('react-native-vector-icons/Feather').default;
    if (item.lib === 'Ionicons') IconComponent = Ionicons;
    return (
      <View key={item.label} style={{ alignItems: 'center' }}>
        <IconComponent name={item.icon} size={32} color="#222" />
        <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 5, color: '#000' }}>{item.label}</Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <HeaderBar onMenuPress={() => setMenuVisible(true)} />
        <View style={[styles.loadingContainer, { paddingTop: insets.top + 80 }]}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Loading task details...</Text>
        </View>
        <MenuModal
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          menuItems={menuItems}
          renderMenuIcon={renderMenuIcon}
          onMenuItemPress={handleMenuItemPress}
        />
      </SafeAreaView>
    );
  }

  if (error && !task) {
    return (
      <SafeAreaView style={styles.container}>
        <HeaderBar onMenuPress={() => setMenuVisible(true)} />
        <View style={[styles.errorContainer, { paddingTop: insets.top + 80 }]}>
          <Ionicons name="alert-circle-outline" size={48} color="#000" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadTaskDetails()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
        <MenuModal
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          menuItems={menuItems}
          renderMenuIcon={renderMenuIcon}
          onMenuItemPress={handleMenuItemPress}
        />
        <ModernAlert
          visible={alertVisible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          buttons={alertConfig.buttons}
          onClose={() => setAlertVisible(false)}
        />
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <HeaderBar onMenuPress={() => setMenuVisible(true)} />
        <View style={[styles.emptyContainer, { paddingTop: insets.top + 80 }]}>
          <MaterialCommunityIcons name="clipboard-text-off-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Task not found</Text>
        </View>
        <MenuModal
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          menuItems={menuItems}
          renderMenuIcon={renderMenuIcon}
          onMenuItemPress={handleMenuItemPress}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar onMenuPress={() => setMenuVisible(true)} />
      
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 80, paddingBottom: 120 }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Task Header Card */}
        <View style={[
          styles.headerCard,
          task.is_overdue && task.status !== 'completed' && styles.headerCardOverdue,
          task.status === 'completed' && styles.headerCardCompleted,
        ]}>
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Ionicons
                name={getStatusIcon(task.status)}
                size={24}
                color={getStatusColor(task.status)}
                style={styles.statusIcon}
              />
              <Text style={styles.taskTitle} numberOfLines={3}>
                {task.title}
              </Text>
            </View>
            <View
              style={[
                styles.priorityBadge,
                { backgroundColor: '#f0f0f0' },
              ]}
            >
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: getPriorityColor(task.priority) },
                ]}
              />
              <Text
                style={[
                  styles.priorityText,
                  { color: getPriorityColor(task.priority) },
                ]}
              >
                {task.priority?.toUpperCase() || 'NORMAL'}
              </Text>
            </View>
          </View>

          {/* Status Badge */}
          <View style={styles.statusRow}>
            {task.status === 'completed' ? (
              <View
                style={[
                  styles.statusBadge,
                  styles.statusBadgeCompleted,
                  { backgroundColor: '#00C85120' },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#00C851"
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: '#00C851', fontWeight: '700' },
                  ]}
                >
                  COMPLETED
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.statusBadge,
                  { backgroundColor: '#f0f0f0' },
                ]}
                onPress={handleStatusChange}
                disabled={updatingStatus || task.status === 'completed'}
              >
                <Ionicons
                  name={getStatusIcon(task.status)}
                  size={16}
                  color={getStatusColor(task.status)}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(task.status) },
                  ]}
                >
                  {task.status.replace('_', ' ').toUpperCase()}
                </Text>
                {updatingStatus && (
                  <ActivityIndicator size="small" color={getStatusColor(task.status)} style={{ marginLeft: 8 }} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Description Card */}
        {task.description && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Description</Text>
            <Text style={styles.descriptionText}>{task.description}</Text>
          </View>
        )}

        {/* Task Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Task Details</Text>
          
          {/* Due Date */}
          {task.due_date && (
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={task.is_overdue ? '#000' : '#666'}
                />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Due Date</Text>
                <Text
                  style={[
                    styles.detailValue,
                    task.is_overdue && styles.detailValueOverdue,
                  ]}
                >
                  {formatDate(task.due_date)}
                </Text>
                <Text style={styles.detailSubtext}>
                  {formatDateTime(task.due_date)}
                </Text>
              </View>
            </View>
          )}

          {/* Category */}
          {task.category && (
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <MaterialCommunityIcons name="tag-outline" size={18} color="#666" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>{task.category}</Text>
              </View>
            </View>
          )}

          {/* Created Date */}
          {task.created_at && (
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="time-outline" size={18} color="#666" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>
                  {formatDateTime(task.created_at)}
                </Text>
              </View>
            </View>
          )}

          {/* Updated Date */}
          {task.updated_at && task.updated_at !== task.created_at && (
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="refresh-outline" size={18} color="#666" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Last Updated</Text>
                <Text style={styles.detailValue}>
                  {formatDateTime(task.updated_at)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {task.status !== 'completed' && task.status !== 'cancelled' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.completeButton,
                updatingStatus && styles.actionButtonDisabled,
              ]}
              onPress={handleCompleteTask}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>
                    Complete Task
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <MenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        menuItems={menuItems}
        renderMenuIcon={renderMenuIcon}
        onMenuItemPress={handleMenuItemPress}
      />
      <BottomNavBar navigation={navigation} />
      <ModernAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#222',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    marginTop: 16,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerCardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: '#000',
  },
  headerCardCompleted: {
    borderLeftWidth: 4,
    borderLeftColor: '#00C851',
    backgroundColor: '#f5f9f7',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 8,
  },
  statusIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  taskTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    lineHeight: 28,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusBadgeCompleted: {
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValueOverdue: {
    color: '#000',
    fontWeight: '700',
  },
  detailSubtext: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  actionsContainer: {
    marginTop: 8,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#222',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  completeButton: {
    backgroundColor: '#00C851',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  secondaryButtonText: {
    color: '#222',
  },
});

