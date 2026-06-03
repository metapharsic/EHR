import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiClient } from '../services/apiClient';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; requiresTwoFactor?: boolean; userId?: string; error?: string }>;
  verify2FA: (code: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (allowedRoles: UserRole[]) => boolean;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  twoFactorRequired: boolean;
  twoFactorUserId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const buildFingerprint = (): string => {
  const seed = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(window.screen?.width || 0),
    String(window.screen?.height || 0)
  ].join('|');

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return `fp_${Math.abs(hash)}`;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorUserId, setTwoFactorUserId] = useState<string | null>(null);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('AuthContext: Initializing auth state...');
      try {
        if (apiClient.isAuthenticated()) {
          console.log('AuthContext: Token found in storage, verifying...');
          // Verify token is still valid by making a simple request
          try {
            // Try to fetch user profile (implementation depends on your backend)
            // For now, just verify the token exists and set a default user
            // In a real app, you would call GET /auth/me here
            const userData: User = {
              id: localStorage.getItem('userId') || '1',
              username: localStorage.getItem('username') || 'admin',
              name: localStorage.getItem('name') || 'Admin',
              role: (localStorage.getItem('role') || 'ADMIN') as UserRole,
            };
            setUser(userData);
            console.log('AuthContext: User state restored from storage');
            setLoading(false);
          } catch (err) {
            console.error('AuthContext: Token validation failed', err);
            apiClient.logoutClient();
            setLoading(false);
          }
        } else {
          console.log('AuthContext: No valid token found');
          setLoading(false);
        }
      } catch (err) {
        console.error('AuthContext: Auth initialization failed', err);
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth expiration events
    const handleAuthExpired = () => {
      setUser(null);
      apiClient.logoutClient();
      setError('Session expired. Please login again.');
    };

    const handleAuthError = (event: Event) => {
      const customEvent = event as CustomEvent;
      setError(customEvent.detail?.message || 'Authentication error occurred');
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    window.addEventListener('auth-error', handleAuthError);

    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
      window.removeEventListener('auth-error', handleAuthError);
    };
  }, []);

  const login = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; requiresTwoFactor?: boolean; userId?: string; error?: string }> => {
    setLoading(true);
    setError(null);

    try {
      if (!username || !password) {
        throw new Error('Username and password are required');
      }

      const response = await apiClient.post<any>('/auth/login', {
        username,
        password,
        fingerprint: buildFingerprint()
      }, { skipAuth: true });

      if (response.requiresTwoFactor) {
        // 2FA is required - show 2FA verification UI
        setTwoFactorRequired(true);
        setTwoFactorUserId(response.userId);
        setLoading(false);
        return {
          success: false,
          requiresTwoFactor: true,
          userId: response.userId,
        };
      }

      // Login successful, save tokens
      if (response.accessToken && response.refreshToken) {
        apiClient.setTokens({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          expiresIn: response.expiresIn || 86400,
        });

        // Extract user info from token or response
        const userData: User = {
          id: response.user?.id || response.userId || '1',
          username: response.user?.username || username,
          name: response.user?.name || username,
          role: (response.user?.role || 'ADMIN') as UserRole,
        };

        setUser(userData);
        setTwoFactorRequired(false);
        setTwoFactorUserId(null);
        setLoading(false);

        return { success: true };
      }

      throw new Error('No tokens received');
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      setLoading(false);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const verify2FA = async (
    code: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    setError(null);

    try {
      if (!code || !userId) {
        throw new Error('Verification code and user ID are required');
      }

      const response = await apiClient.post<any>(
        '/auth/verify-2fa',
        {
          userId,
          code,
          fingerprint: buildFingerprint()
        },
        { skipAuth: true }
      );

      if (response.accessToken && response.refreshToken) {
        apiClient.setTokens({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          expiresIn: response.expiresIn || 86400,
        });

        const userData: User = {
          id: response.user?.id || userId || '1',
          username: response.user?.username || 'user',
          name: response.user?.name || 'User',
          role: (response.user?.role || 'ADMIN') as UserRole,
        };

        setUser(userData);
        setTwoFactorRequired(false);
        setTwoFactorUserId(null);
        setLoading(false);

        return { success: true };
      }

      throw new Error('No tokens received after 2FA verification');
    } catch (err: any) {
      const errorMessage = err.message || '2FA verification failed';
      setError(errorMessage);
      setLoading(false);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Call logout endpoint to blacklist token
      await apiClient.post('/auth/logout', {});
    } catch (err) {
      console.error('Logout API call failed:', err);
      // Continue with local logout even if API fails
    } finally {
      apiClient.logoutClient();
      setUser(null);
      setTwoFactorRequired(false);
      setTwoFactorUserId(null);
      setError(null);
    }
  };

  const hasPermission = (allowedRoles: UserRole[]): boolean => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        verify2FA,
        logout,
        hasPermission,
        loading,
        error,
        isAuthenticated: user !== null && apiClient.isAuthenticated(),
        twoFactorRequired,
        twoFactorUserId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
