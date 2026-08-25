import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
 * MemberTask Screen Component
 * 
 * Displays tasks assigned to the member
 * 
 * API Endpoints:
 * - GET /api/mobile/tasks - Get all tasks
 * - GET /api/mobile/tasks/statistics - Get task statistics
 * - GET /api/mobile/tasks/{id} - Get task details
 * - PUT /api/mobile/tasks/{id}/status - Update task status
 * 
 * Features:
 * - List of tasks with filters (status, priority)
 * - Task statistics
 * - Update task status
 * - Filter by status and priority
 * - Pull-to-refresh
 */
export default function MemberTask() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, pending, in_progress, completed, overdue
  const [selectedPriority, setSelectedPriority] = useState('all'); // all, low, medium, high, urgent
  const [menuVisible, setMenuVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const API_BASE_URL = ENV_API_BASE_URL;

  // Load tasks when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadTasks();
      loadStatistics();
    }, [])
  );

  // Filter tasks when filters change
  useEffect(() => {
    filterTasks();
  }, [tasks, selectedFilter, selectedPriority]);

  const loadTasks = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/tasks`, {
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
        setTasks(data.data);
        if (data.statistics) {
          setStatistics(data.statistics);
        }
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError(err.message || 'Failed to load tasks');
      if (!isRefresh) {
        setAlertConfig({
          title: 'Error',
          message: err.message || 'Failed to load tasks',
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

  const loadStatistics = async () => {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) return;

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/tasks/statistics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setStatistics(data.data);
        }
      }
    } catch (err) {
      console.error('Error loading statistics:', err);
    }
  };

  const filterTasks = () => {
    let filtered = [...tasks];

    // Filter by status
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'overdue') {
        filtered = filtered.filter(task => task.is_overdue);
      } else {
        filtered = filtered.filter(task => task.status === selectedFilter);
      }
    }

    // Filter by priority
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(task => task.priority === selectedPriority);
    }

    setFilteredTasks(filtered);
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
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

      // Show success message for completion
      if (newStatus === 'completed') {
        setAlertConfig({
          title: 'Task Completed',
          message: 'Task has been marked as completed successfully!',
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
      }

      // Reload tasks
      loadTasks();
      loadStatistics();
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
    }
  };

  const onRefresh = () => {
    loadTasks(true);
    loadStatistics();
  };

  const handleTaskPress = (task) => {
    navigation.navigate('TaskDetailScreen', { taskId: task.id });
  };

  const handleStatusChange = (taskId, currentStatus) => {
    // Don't allow cycling for completed tasks
    if (currentStatus === 'completed') {
      return;
    }
    const statusOptions = ['pending', 'in_progress', 'completed', 'cancelled'];
    const currentIndex = statusOptions.indexOf(currentStatus);
    const nextStatus = statusOptions[(currentIndex + 1) % statusOptions.length];
    updateTaskStatus(taskId, nextStatus);
  };

  const handleCompleteTask = (task) => {
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
            updateTaskStatus(task.id, 'completed');
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
        return '#ff4444';
      case 'high':
        return '#ff8800';
      case 'medium':
        return '#ffbb33';
      case 'low':
        return '#00C851';
      default:
        return '#888';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#00C851';
      case 'in_progress':
        return '#2196F3';
      case 'pending':
        return '#ffbb33';
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
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderTaskItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={[
          styles.taskCard,
          item.is_overdue && styles.taskCardOverdue,
          item.is_due_today && styles.taskCardDueToday,
          item.status === 'completed' && styles.taskCardCompleted,
        ]}
        onPress={() => handleTaskPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.taskHeader}>
          <View style={styles.taskTitleContainer}>
            <Ionicons
              name={getStatusIcon(item.status)}
              size={20}
              color={getStatusColor(item.status)}
              style={styles.statusIcon}
            />
            <Text style={styles.taskTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: getPriorityColor(item.priority) + '20' },
            ]}
          >
            <View
              style={[
                styles.priorityDot,
                { backgroundColor: getPriorityColor(item.priority) },
              ]}
            />
            <Text
              style={[
                styles.priorityText,
                { color: getPriorityColor(item.priority) },
              ]}
            >
              {item.priority?.toUpperCase() || 'NORMAL'}
            </Text>
          </View>
        </View>

        {item.description && (
          <Text style={styles.taskDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.taskFooter}>
          <View style={styles.taskMeta}>
            {item.due_date && (
              <View style={styles.taskMetaItem}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={item.is_overdue && item.status !== 'completed' ? '#ff4444' : '#666'}
                />
                <Text
                  style={[
                    styles.taskMetaText,
                    item.is_overdue && item.status !== 'completed' && styles.taskMetaTextOverdue,
                    item.status === 'completed' && styles.taskMetaTextCompleted,
                  ]}
                >
                  {item.status === 'completed' ? 'Completed' : formatDate(item.due_date)}
                </Text>
              </View>
            )}
            {item.category && (
              <View style={styles.taskMetaItem}>
                <MaterialCommunityIcons name="tag-outline" size={14} color={item.status === 'completed' ? '#999' : '#666'} />
                <Text style={[styles.taskMetaText, item.status === 'completed' && styles.taskMetaTextCompleted]}>
                  {item.category}
                </Text>
              </View>
            )}
          </View>

          {item.status === 'completed' ? (
            <View style={[styles.statusButton, styles.statusButtonCompletedOnly]}>
              <Ionicons name="checkmark-circle" size={14} color="#00C851" />
              <Text style={[styles.statusButtonText, { color: '#00C851' }]}>
                COMPLETED
              </Text>
            </View>
          ) : (
            <View style={styles.taskActions}>
              {item.status !== 'cancelled' && (
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleCompleteTask(item);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.completeButtonText}>Complete</Text>
                </TouchableOpacity>
              )}
              {item.status !== 'cancelled' && (
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    { backgroundColor: getStatusColor(item.status) + '20' },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleStatusChange(item.id, item.status);
                  }}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      { color: getStatusColor(item.status) },
                    ]}
                  >
                    {item.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              )}
              {item.status === 'cancelled' && (
                <View style={[styles.statusButton, { backgroundColor: '#88820' }]}>
                  <Text style={[styles.statusButtonText, { color: '#888' }]}>
                    CANCELLED
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };



  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="clipboard-text-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>No tasks found</Text>
      <Text style={styles.emptySubtext}>
        {selectedFilter !== 'all' || selectedPriority !== 'all'
          ? 'Try adjusting your filters'
          : 'You have no tasks assigned'}
      </Text>
    </View>
  );

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
          <Text style={styles.loadingText}>Loading tasks...</Text>
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
      
      {error && !loading ? (
        <View style={[styles.errorContainer, { paddingTop: insets.top + 80 }]}>
          <Ionicons name="alert-circle-outline" size={48} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadTasks()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
     
          <FlatList
            data={filteredTasks}
            renderItem={renderTaskItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={[
              filteredTasks.length === 0 ? styles.emptyListContainer : styles.listContainer,
              { paddingTop: insets.top + 80 }
            ]}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#000"
              />
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

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
    color: '#ff6b6b',
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
  statisticsContainer: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statCard: {
    alignItems: 'center',
    marginRight: 20,
    minWidth: 60,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontWeight: '500',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  priorityFilters: {
    marginTop: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    marginLeft: 8,
  },
  filterChipActive: {
    backgroundColor: '#000',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  emptyListContainer: {
    flex: 1,
  },
  taskCard: {
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
  taskCardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff4444',
  },
  taskCardDueToday: {
    borderLeftWidth: 4,
    borderLeftColor: '#ffbb33',
  },
  taskCardCompleted: {
    opacity: 0.7,
    backgroundColor: '#f5f5f5',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  statusIcon: {
    marginRight: 8,
  },
  taskTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskMeta: {
    flexDirection: 'row',
    flex: 1,
  },
  taskMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  taskMetaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  taskMetaTextOverdue: {
    color: '#ff4444',
    fontWeight: '600',
  },
  taskMetaTextCompleted: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00C851',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusButtonCompletedOnly: {
    backgroundColor: '#00C85120',
    gap: 6,
  },
  statusButtonCompleted: {
    opacity: 0.6,
  },
  statusButtonText: {
    fontSize: 11,
    fontWeight: '700',
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
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

