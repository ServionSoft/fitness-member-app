/**
 * Thin wrapper around NotificationContext so all screens share one unread-count
 * source. Avoids each consumer firing its own /mobile/notifications/unread-count request.
 */
import { useNotificationContext } from '../contexts/NotificationContext';

export const useUnreadNotifications = () => {
  const {
    unreadCount,
    loading,
    refresh,
    fetchUnreadCount,
  } = useNotificationContext();

  return {
    unreadCount,
    loading,
    // Context does not track error; keep shape for existing callers
    error: null,
    refresh,
    fetchUnreadCount,
  };
};
