import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import { useAuth } from './AuthContext';

const API_BASE_URL = ENV_API_BASE_URL;

const NotificationContext = createContext(undefined);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);
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
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const refresh = useCallback(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Decrement count immediately when notification is marked as read
  const decrementCount = useCallback(() => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Set count to a specific value (useful for mark all as read)
  const setCount = useCallback((count) => {
    setUnreadCount(Math.max(0, count));
  }, []);

  // Fetch unread count on mount and when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
    } else {
      setUnreadCount(0);
    }
  }, [isAuthenticated, fetchUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        loading,
        refresh,
        fetchUnreadCount,
        decrementCount,
        setCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
