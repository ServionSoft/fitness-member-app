import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, BackHandler, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AppState, AppStateStatus } from 'react-native';
import ActivityLogService from './services/ActivityLogService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StripeProvider } from '@stripe/stripe-react-native';
import { API_BASE_URL as ENV_API_BASE_URL, STRIPE_PUBLISHABLE_KEY as ENV_STRIPE_PUBLISHABLE_KEY } from '@env';

// @ts-ignore - Navigation ref typing
import type { NavigationContainerRef } from '@react-navigation/native';

import LoginScreen from './screens/LoginScreen';
import SplashScreen from './screens/splash_screen.js';
import SignupScreen from './screens/SignupScreen';
import SignupGenderScreen from './screens/signup/signup_gender';
import SignupDobScreen from './screens/signup/signup_Dob';
import SignupHeightScreen from './screens/signup/signup_weight';
import Dashboard from './screens/Dashboard';
import ProfileScreen from './screens/ProfileScreen';
import AppointmentScreen from './screens/AppointmentScreen';
import MemberTask from './screens/MemberTask';
import AllNutritionScreen from './screens/AllNutritionScreen';
import CommunityScreen from './screens/CommunityScreen';
import NotificationScreen from './screens/NotificationScreen';
import SettingsScreen from './screens/SettingsScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import ScheduleDetailScreen from './screens/ScheduleDetailScreen';
import ActivityCalendarScreen from './screens/ActivityCalendarScreen';
import WorkoutScreen from './screens/WorkoutScreen';
import WorkoutDetailsScreen from './screens/WorkoutDetailsScreen';
import WorkoutStart from './screens/WorkoutStart';
import WorkoutSessionScreen from './screens/WorkoutSessionScreen';
import WorkoutFinishedScreen from './screens/WorkoutFinishedScreen';
import ActivityDetailsScreen from './screens/ActivityDetailsScreen';
import NutritionScreen from './screens/NutritionScreen';
import NutritionDetailsScreen from './screens/NutritionDetailsScreen';
import DiscoverScreen from './screens/DiscoverScreen';
import AllActivitiesScreen from './screens/AllActivitiesScreen';
import DayActivitiesScreen from './screens/DayActivitiesScreen';
import AccountScreen from './screens/AccountScreen';
import HelpScreen from './screens/HelpScreen';
import NotificationSettingsScreen from './screens/NotificationSettingsScreen';
import PrivacyScreen from './screens/PrivacyScreen';
import ChallengesScreen from './screens/ChallengesScreen';
import ChallengeDetailsScreen from './screens/ChallengeDetailsScreen';
import CreateNutritionScreen from './screens/CreateNutritionScreen';
import FoodScreen from './screens/FoodScreen';
import CreateWorkoutScreen from './screens/CreateWorkoutScreen';
import ProgressPhotosScreen from './screens/ProgressPhotosScreen';
import SelectActivitiesScreen from './screens/SelectActivitiesScreen';
import PostsScreen from './screens/PostsScreen';
import PaymentScreen from './screens/PaymentScreen';
import ChatScreen from './screens/ChatScreen';
import ContactsScreen from './screens/ContactsScreen';
import MembershipScreen from './screens/MembershipScreen';
import WeeklyProgressScreen from './screens/WeeklyProgressScreen';
import CheckInCheckOutScreen from './screens/CheckInCheckOutScreen';
import BarcodeScannerScreen from './screens/BarcodeScannerScreen';
import ProductDetailsScreen from './screens/ProductDetailsScreen';
import MessagesListScreen from './screens/MessagesListScreen';
import MessageDetailScreen from './screens/MessageDetailScreen';
import NewMessageScreen from './screens/NewMessageScreen';
import TaskDetailScreen from './screens/TaskDetailScreen';
import PlanWorkoutScreen from './screens/PlanWorkoutScreen';
import NotesScreen from './screens/NotesScreen';
import ProductHistoryScreen from './screens/ProductHistoryScreen';



const Stack = createNativeStackNavigator();

// Create a QueryClient instance with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes - cache garbage collection (formerly cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on window focus in React Native
      refetchOnMount: true, // Refetch when component mounts if data is stale
      retry: 2, // Retry failed requests 2 times
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
  },
});

const STRIPE_PUBLISHABLE_KEY = ENV_STRIPE_PUBLISHABLE_KEY || '';

// Check if Stripe is properly configured
const isStripeConfigured = STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY.startsWith('pk_');

function AppNavigator() {
  const { isAuthenticated, isLoading, hasCompletedOnboarding } = useAuth();
  const navigationRef = React.useRef<NavigationContainerRef<any>>(null);

  // Handle Android back button
  // Navigate to previous page, or Dashboard if at root
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!navigationRef.current) return false;

        // @ts-ignore - navigation ref typing
        const state = navigationRef.current.getRootState();
        const routes = state?.routes || [];
        const currentRoute = routes[routes.length - 1];

        // If on SplashScreen, allow default (exit app)
        if (currentRoute?.name === 'SplashScreen') return false;

        // If authenticated, try to go back to previous screen
        if (isAuthenticated) {
          // @ts-ignore - navigation ref typing
          const navigation = navigationRef.current;
          
          // Check if we can go back (there's a previous screen in the stack)
          if (navigation.canGoBack()) {
            // @ts-ignore - navigation ref typing
            navigation.goBack();
            return true;
          } else {
            // If we're at the root and on Dashboard, allow default (exit app)
            if (currentRoute?.name === 'Dashboard') return false;
            // If we're at the root but not on Dashboard, navigate to Dashboard
            // @ts-ignore - navigation ref typing
            navigation.navigate('Dashboard');
            return true;
          }
        }

        // Not authenticated: allow default back behavior
        return false;
      });

      return () => backHandler.remove();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F7F4' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const navigationContent = (
    <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName={
            !hasCompletedOnboarding 
              ? "SplashScreen" 
              : isAuthenticated 
                ? "Dashboard" 
                : "LoginScreen"
          }
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
        {!hasCompletedOnboarding ? (
            // Onboarding flow (show only once)
            <>
              <Stack.Screen name="SplashScreen" component={SplashScreen} />
            </>
          ) : !isAuthenticated ? (
            // Auth screens (after onboarding)
            <>
              <Stack.Screen name="LoginScreen" component={LoginScreen} />
              <Stack.Screen name="SignupScreen" component={SignupScreen} />
              <Stack.Screen name="SignupGenderScreen" component={SignupGenderScreen} />
              <Stack.Screen name="SignupDobScreen" component={SignupDobScreen} />
              <Stack.Screen name="SignupHeightScreen" component={SignupHeightScreen} />
            </>
          ) : (
            // App screens (authenticated)
            <>
              <Stack.Screen name="Dashboard" component={Dashboard} />
              <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
              <Stack.Screen name="ContactsScreen" component={ContactsScreen} />
              <Stack.Screen name="MembershipScreen" component={MembershipScreen} />
              <Stack.Screen name="AppointmentScreen" component={AppointmentScreen} />
              <Stack.Screen name="CommunityScreen" component={CommunityScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="MessagesListScreen" component={MessagesListScreen} />
              <Stack.Screen name="MessageDetailScreen" component={MessageDetailScreen} />
              <Stack.Screen name="NewMessageScreen" component={NewMessageScreen} />
              <Stack.Screen name="MemberTask" component={MemberTask} />
              <Stack.Screen name="TaskDetailScreen" component={TaskDetailScreen} />
              <Stack.Screen name="NotificationScreen" component={NotificationScreen} />
              <Stack.Screen name="AllNutritionScreen" component={AllNutritionScreen} />
              <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
              <Stack.Screen name="ScheduleScreen" component={ScheduleScreen} />
              <Stack.Screen name="ScheduleDetail" component={ScheduleDetailScreen} />
              <Stack.Screen name="ActivityCalendarScreen" component={ActivityCalendarScreen} />
              <Stack.Screen name="WorkoutScreen" component={WorkoutScreen} />
              <Stack.Screen name="WorkoutDetails" component={WorkoutDetailsScreen} />
              <Stack.Screen name="PlanWorkout" component={PlanWorkoutScreen} />
              <Stack.Screen name="WorkoutStart" component={WorkoutStart} />
              <Stack.Screen name="WorkoutSession" component={WorkoutSessionScreen} />
              <Stack.Screen name="WorkoutFinished" component={WorkoutFinishedScreen} />
              <Stack.Screen name="ActivityDetails" component={ActivityDetailsScreen} />
              <Stack.Screen name="NutritionScreen" component={NutritionScreen} />
              <Stack.Screen name="NutritionDetails" component={NutritionDetailsScreen} />
              <Stack.Screen name="DiscoverScreen" component={DiscoverScreen} />
              <Stack.Screen name="AllActivitiesScreen" component={AllActivitiesScreen} />
              <Stack.Screen name="DayActivitiesScreen" component={DayActivitiesScreen} />
              <Stack.Screen name="AccountScreen" component={AccountScreen} />
              <Stack.Screen name="HelpScreen" component={HelpScreen} />
              <Stack.Screen name="PrivacyScreen" component={PrivacyScreen} />
              <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
              <Stack.Screen name="NotificationSettingsScreen" component={NotificationSettingsScreen} />
              <Stack.Screen name="ChallengesScreen" component={ChallengesScreen} />
              <Stack.Screen name="ChallengeDetails" component={ChallengeDetailsScreen} />
              <Stack.Screen name="CreateNutrition" component={CreateNutritionScreen} />
              <Stack.Screen name="FoodScreen" component={FoodScreen} />
              <Stack.Screen name="CreateWorkout" component={CreateWorkoutScreen} />
              <Stack.Screen name="ProgressPhotos" component={ProgressPhotosScreen} />
              <Stack.Screen name="SelectActivities" component={SelectActivitiesScreen} />
              <Stack.Screen name="PostsScreen" component={PostsScreen} />
              <Stack.Screen name="WeeklyProgress" component={WeeklyProgressScreen} />
              <Stack.Screen name="CheckInCheckOut" component={CheckInCheckOutScreen} />
              <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
              <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
              <Stack.Screen name="NotesScreen" component={NotesScreen} />
              <Stack.Screen name="ProductHistoryScreen" component={ProductHistoryScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
  );

  // Only wrap with StripeProvider if key is configured
  if (isStripeConfigured) {
    return (
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.your-app.identifier"
        urlScheme="fitnessappmobile"
      >
        {navigationContent}
      </StripeProvider>
    );
  }

  // Return without StripeProvider if not configured
  return navigationContent;
}

function AppContent() {
  const { userData, isAuthenticated, isLoading } = useAuth();

  // Track app state changes for activity logging
  React.useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Only log if user is authenticated and not loading
      if (nextAppState === 'active' && isAuthenticated && !isLoading && userData) {
        // App became active (user opened app or returned to it)
        try {
          await ActivityLogService.logAppLaunch(
            userData.id, 
            userData.gym_id || null
          );
        } catch (error) {
          // Silently handle errors - don't spam console if token is expired
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage && !errorMessage.includes('Token invalid or expired')) {
            console.error('Failed to log app open activity:', error);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [userData, isAuthenticated, isLoading]);

  // Log initial app open if user is authenticated
  React.useEffect(() => {
    // Only log if user is authenticated and not loading
    if (isAuthenticated && !isLoading && userData) {
      ActivityLogService.logAppLaunch(userData.id, userData.gym_id || null)
        .then((result) => {
          // Check if the result indicates token issues
          if (result && !result.success && result.message && result.message.includes('Token invalid or expired')) {
            // Silently handle - token will be cleared by the service
            return;
          }
        })
        .catch((error: unknown) => {
          // Silently handle errors - don't spam console if token is expired
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage && !errorMessage.includes('Token invalid or expired')) {
            console.error('Failed to log initial app open activity:', error);
          }
        });
    }
  }, [userData, isAuthenticated, isLoading]);

  return <AppNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}