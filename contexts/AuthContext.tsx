import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActivityLogService from '../services/ActivityLogService';
import { cleanToken, isValidTokenFormat, storeToken, getAuthToken } from '../utils/tokenUtils';
import { API_BASE_URL } from '@env';

interface UserData {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  avatar: string | null;
  profile_image: string | null;
  username: string | null;
  role_id: number | null;
  statut: string | null;
  gym_id?: number; // Optional gym_id for activity logging
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  userData: UserData | null;
  login: (token: string, userData: UserData, expiry: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  getUserData: () => UserData | null;
  refreshMemberDetails: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);

  const checkAuthStatus = async () => {
    try {
      // Check if user has completed onboarding
      const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
      setHasCompletedOnboarding(onboardingCompleted === 'true');

      // Check authentication status
      const userToken = await AsyncStorage.getItem('userToken');
      const tokenExpiry = await AsyncStorage.getItem('tokenExpiry');
      const storedUserData = await AsyncStorage.getItem('userData');
      
      if (userToken && tokenExpiry) {
        const expiryDate = new Date(tokenExpiry);
        if (expiryDate > new Date()) {
          setIsAuthenticated(true);
          if (storedUserData) {
            setUserData(JSON.parse(storedUserData));
          }
        } else {
          // Token expired, clear storage
          await AsyncStorage.multiRemove(['userToken', 'userData', 'tokenExpiry']);
          setIsAuthenticated(false);
          setUserData(null);
        }
      } else {
        setIsAuthenticated(false);
        setUserData(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
      setUserData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (token: string, userData: UserData, expiry: string) => {
    try {
      // Validate and clean token before storing
      if (!isValidTokenFormat(token)) {
        throw new Error('Invalid token format received from server');
      }
      
      // Clean token (remove Bearer prefix if present) before storing
      const cleanedToken = cleanToken(token);
      console.log('Storing token - Length:', cleanedToken.length, 'First 20 chars:', cleanedToken.substring(0, 20) + '...');
      
      await storeToken(cleanedToken);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      await AsyncStorage.setItem('tokenExpiry', expiry);
      setIsAuthenticated(true);
      setUserData(userData);
      
      // Small delay to ensure token is fully stored before making API call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fetch member details to get profile_image
      try {
        await refreshMemberDetails();
      } catch (error) {
        console.warn('Failed to refresh member details after login:', error);
        // Don't fail login if this fails
      }
      
      // Log successful login activity using app-launch endpoint
      try {
        const result = await ActivityLogService.logAppLaunch(userData.id, userData.gym_id || null);
        // Check if token was invalid (shouldn't happen on fresh login, but handle gracefully)
        if (result && !result.success) {
          if (result.message && result.message.includes('Token invalid or expired')) {
            // This shouldn't happen on fresh login, but log a warning with details
            console.warn('⚠️ Token issue detected during login activity log');
            console.warn('Result:', JSON.stringify(result, null, 2));
            console.warn('This might indicate a backend middleware issue or token format mismatch');
          } else {
            console.warn('App launch logging failed:', result);
          }
        }
      } catch (logError) {
        // Only log if it's not a token expiration error
        const errorMessage = logError instanceof Error ? logError.message : String(logError);
        if (!errorMessage.includes('Token invalid or expired')) {
          console.error('Failed to log activity, but login continues:', logError);
        }
      }
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(['userToken', 'userData', 'tokenExpiry']);
      setIsAuthenticated(false);
      setUserData(null);
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('onboardingCompleted', 'true');
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  };

  const getUserData = (): UserData | null => {
    return userData;
  };

  // Fetch member details including profile_image and update userData
  const refreshMemberDetails = async () => {
    try {
      const authHeader = await getAuthToken();
      if (!authHeader) {
        console.warn('No auth token available for member details refresh');
        return;
      }

      // Get current userData from state or storage
      const currentUserData = userData || JSON.parse(await AsyncStorage.getItem('userData') || 'null');
      if (!currentUserData) {
        return;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/member/details`, {
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
          // Get latest userData
          const latestUserData = userData || JSON.parse(await AsyncStorage.getItem('userData') || 'null') || currentUserData;
          
          // Update userData with profile_image from member details
          const updatedUserData: UserData = {
            ...latestUserData,
            profile_image: data.data.profile_image || latestUserData.profile_image,
            firstname: data.data.firstname || latestUserData.firstname,
            lastname: data.data.lastname || latestUserData.lastname,
            email: data.data.email || latestUserData.email,
            phone: data.data.mobile_phone || data.data.phone || latestUserData.phone,
            username: data.data.username || latestUserData.username,
            gym_id: data.data.gym_id || latestUserData.gym_id,
          };
          
          setUserData(updatedUserData);
          await AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
        }
      }
    } catch (error) {
      console.error('Error refreshing member details:', error);
      // Don't throw error, just log it
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      await checkAuthStatus();
      // After checking auth status, refresh member details if authenticated
      // Use a small delay to ensure state is updated
      setTimeout(() => {
        refreshMemberDetails();
      }, 500);
    };
    initializeAuth();
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    hasCompletedOnboarding,
    userData,
    login,
    logout,
    completeOnboarding,
    checkAuthStatus,
    getUserData,
    refreshMemberDetails,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
