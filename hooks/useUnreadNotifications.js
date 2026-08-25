import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = ENV_API_BASE_URL;

export const useUnreadNotifications = () => {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        setUnreadCount(0);
        return;
      }

      let authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;

      const response = await fetch(`${API_BASE_URL}/mobile/notifications/unread-count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Unread count response:', result);
        
        // Handle different response structures
        let count = 0;
        if (result.success && result.data !== undefined) {
          count = typeof result.data === 'number' ? result.data : (result.data.count || result.data.unread_count || 0);
        } else if (result.count !== undefined) {
          count = result.count;
        } else if (result.unread_count !== undefined) {
          count = result.unread_count;
        } else if (typeof result === 'number') {
          count = result;
        }

        setUnreadCount(count);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch unread count:', errorData);
        setError('Failed to fetch unread count');
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setError(error.message);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch on mount and when authentication status changes
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Refresh count when screen comes into focus
  // This is called immediately when notifications are marked as read
  const refresh = useCallback(() => {
    // Call immediately without delay for instant updates
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    error,
    refresh,
    fetchUnreadCount,
  };
};
