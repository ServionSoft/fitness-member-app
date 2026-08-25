import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import ModernAlert from '../components/ModernAlert';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { getAuthToken } from '../utils/tokenUtils';

const API_BASE_URL = ENV_API_BASE_URL;

const ProductHistoryScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { logout } = useAuth();

  const [menuVisible, setMenuVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  const service = route.params?.service || null;

  // Fetch credit history from API
  const fetchCreditHistory = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const authHeader = await getAuthToken();
      if (!authHeader) {
        throw new Error('Authentication required');
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (service?.id) {
        queryParams.append('service_id', service.id);
      }
      // Add other optional filters here if needed:
      // queryParams.append('transaction_type', 'deduction');
      // queryParams.append('date_from', '2025-01-01');
      // queryParams.append('date_to', '2025-01-31');
      // queryParams.append('limit', '20');

      const queryString = queryParams.toString();
      const url = `${API_BASE_URL}/mobile/credits/history${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Credit history data:', data);
      
      // Handle API response structure: data.data.transactions
      const historyData = data.data?.transactions || data.data || data.history || data.transactions || [];
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (err) {
      console.error('Error fetching credit history:', err);
      setError(err.message || 'Failed to load credit history');
      setHistory([]);
      
      // Show error alert
      setAlertConfig({
        title: 'Error',
        message: err.message || 'Failed to load credit history. Please try again.',
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
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch history on mount
  useEffect(() => {
    if (service?.id) {
      fetchCreditHistory();
    } else {
      setLoading(false);
    }
  }, [service?.id]);

  // Format date for display - use formatted date from API if available
  const formatDate = (entry) => {
    // Prefer the formatted date from API
    if (entry.created_at_formatted) {
      return entry.created_at_formatted;
    }
    if (entry.created_at) {
      try {
        const date = new Date(entry.created_at);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (e) {
        return entry.created_at;
      }
    }
    return '';
  };

  // Determine if transaction is a credit (addition) or deduction
  const isCreditTransaction = (entry) => {
    const type = entry.type?.toLowerCase() || '';
    // Deduction types
    if (type === 'deduction') {
      return false;
    }
    // Credit types (initial_allocation, addition, refund, adjustment, etc.)
    if (type === 'initial_allocation' || type === 'addition' || type === 'refund' || type === 'adjustment') {
      return true;
    }
    // Fallback: check amount (positive = credit, negative = deduction)
    const amount = entry.amount || 0;
    return amount > 0;
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
          style: 'secondary',
        },
      ],
    });
    setAlertVisible(true);
  };

  const onRefresh = () => {
    if (service?.id) {
      fetchCreditHistory(true);
    }
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
        <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 5, color: '#000' }}>
          {item.label}
        </Text>
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
      <HeaderBar onMenuPress={() => setMenuVisible(true)} />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: 140,
          paddingTop: insets.top + 60,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#222"
            colors={['#222']}
          />
        }
      >
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>
            {service?.name || 'Product History'}
          </Text>
          <Text style={styles.headerSubtitle}>
            View your service credits history
          </Text>
          {typeof service?.amount === 'number' && (
            <View style={styles.currentCreditsCard}>
              <View style={styles.currentCreditsRow}>
                <View style={styles.currentCreditsLeft}>
                  <Ionicons name="ticket-outline" size={22} color="#222" />
                  <Text style={styles.currentCreditsLabel}>Current Credits</Text>
                </View>
                <Text style={styles.currentCreditsValue}>{service.amount}x</Text>
              </View>
            </View>
          )}
        </View>

        {/* History List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage history</Text>
          {!service && (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="small" color="#222" />
              <Text style={styles.emptyText}>
                No service selected. Please go back and try again.
              </Text>
            </View>
          )}

          {loading && !refreshing ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="small" color="#222" />
              <Text style={styles.emptyText}>Loading history...</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={32} color="#F44336" />
              <Text style={styles.emptyText}>{error}</Text>
              <Text style={styles.emptySubText}>
                Pull down to refresh and try again.
              </Text>
            </View>
          ) : service && history && history.length > 0 ? (
            history.map((entry, index) => {
              const isCredit = isCreditTransaction(entry);
              // Use amount_display if available (absolute value), otherwise use absolute of amount
              const amount = entry.amount_display || Math.abs(entry.amount || 1);
              const typeLabel = entry.type_label || entry.type || 'Transaction';
              
              return (
                <View key={entry.id || index} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <View style={styles.historyIcon}>
                      <Ionicons
                        name={isCredit ? 'add-circle' : 'remove-circle'}
                        size={18}
                        color={isCredit ? '#4CAF50' : '#F44336'}
                      />
                    </View>
                    <View style={styles.historyTextContainer}>
                      <Text style={styles.historyTitle}>
                        {entry.description || typeLabel}
                      </Text>
                      <Text style={styles.historySubtitle}>
                        {formatDate(entry)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyRight}>
                    <Text
                      style={[
                        styles.historyAmount,
                        isCredit
                          ? styles.historyAmountCredit
                          : styles.historyAmountDebit,
                      ]}
                    >
                      {isCredit ? '+' : '-'}
                      {amount}
                    </Text>
                    {entry.balance_after !== undefined && (
                      <Text style={styles.balanceAfter}>
                        Balance: {entry.balance_after}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          ) : service ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={32} color="#ccc" />
              <Text style={styles.emptyText}>No history available yet</Text>
              <Text style={styles.emptySubText}>
                Your usage records for this service will appear here.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  headerSection: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#222',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  currentCreditsCard: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  currentCreditsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentCreditsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentCreditsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginLeft: 8,
  },
  currentCreditsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  historyTextContainer: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
  },
  historySubtitle: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyAmountCredit: {
    color: '#4CAF50',
  },
  historyAmountDebit: {
    color: '#F44336',
  },
  balanceAfter: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default ProductHistoryScreen;

