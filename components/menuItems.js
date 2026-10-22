
const menuItems = [
  { icon: 'calendar', label: 'Appointment', lib: 'MaterialCommunityIcons' },
  { icon: 'account-group', label: 'Community', lib: 'MaterialCommunityIcons' },
  { icon: 'message-text', label: 'Messages', lib: 'MaterialCommunityIcons' },
  { icon: 'clipboard-text', label: 'Tasks', lib: 'MaterialCommunityIcons' },
  { icon: 'food-apple-outline', label: 'Nutrition', lib: 'MaterialCommunityIcons' },
  { icon: 'dumbbell', label: 'Workouts', lib: 'MaterialCommunityIcons' },
  { icon: 'chart-line', label: 'My Progress', lib: 'MaterialCommunityIcons' },
  { icon: 'scale-bathroom', label: 'Self Check-in', lib: 'MaterialCommunityIcons' },
  { icon: 'trophy', label: 'Challenges', lib: 'MaterialCommunityIcons' },
  { icon: 'login', label: 'Gym Check In/Out', lib: 'MaterialCommunityIcons' },
  { icon: 'calendar-outline', label: 'Schedule', lib: 'Ionicons' },
  { icon: 'settings', label: 'Settings', lib: 'Feather' },
  { icon: 'logout', label: 'Logout', lib: 'MaterialCommunityIcons' },
];

export default menuItems;

export function handleMenuItemAction(item, navigation, logout, onLogoutRequest) {
  switch (item.label) {
    case 'Appointment':
      navigation.navigate('AppointmentScreen');
      break;
    case 'Community':
      navigation.navigate('CommunityScreen');
      break;
    case 'Messages':
      navigation.navigate('MessagesListScreen');
      break;
    case 'Tasks':
      navigation.navigate('MemberTask');
      break;
    case 'Notification':
      navigation.navigate('NotificationScreen');
      break;
    case 'Settings':
      navigation.navigate('SettingsScreen');
      break;
    case 'Schedule':
      navigation.navigate('ScheduleScreen');
      break;
    case 'Workouts':
      navigation.navigate('WorkoutScreen');
      break;
    case 'My Progress':
      navigation.navigate('MyProgress');
      break;
    case 'Self Check-in':
      navigation.navigate('WeeklyProgress', { openForm: true });
      break;
    case 'Nutrition':
      navigation.navigate('NutritionScreen');
      break;
    case 'Challenges':
      navigation.navigate('ChallengesScreen');
      break;
    case 'Gym Check In/Out':
    case 'Check In/Out':
      navigation.navigate('CheckInCheckOut');
      break;
    case 'Payments':
      navigation.navigate('PaymentScreen');
      break;
    case 'Logout':
      if (logout) {
        // Use custom logout handler (ModernAlert) - all screens should provide this
        if (onLogoutRequest) {
          onLogoutRequest(logout);
        } else {
          // If no handler provided, call logout directly (should not happen in production)
          console.warn('Logout requested but no onLogoutRequest handler provided');
          logout();
        }
      }
      break;
    // Add more cases for other menu items as needed
    default:
      // Optionally handle unknown menu items
      break;
  }
} 