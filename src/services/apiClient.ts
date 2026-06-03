/**
 * API Client with Automatic Token Management
 * Handles JWT token injection, refresh, and error handling
 * Provides automatic retry on token expiration
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  retry?: number;
}

class APIClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.loadTokens();
  }

  /**
   * Load tokens from localStorage
   */
  private loadTokens(): void {
    try {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    } catch (error) {
      console.error('Failed to load tokens from localStorage', error);
    }
  }

  /**
   * Save tokens to localStorage
   */
  private saveTokens(tokens: TokenPair): void {
    try {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      localStorage.setItem('tokenExpiry', String(Date.now() + tokens.expiresIn * 1000));
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
    } catch (error) {
      console.error('Failed to save tokens to localStorage', error);
    }
  }

  /**
   * Clear tokens from localStorage and memory
   */
  private clearTokens(): void {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tokenExpiry');
      this.accessToken = null;
      this.refreshToken = null;
    } catch (error) {
      console.error('Failed to clear tokens from localStorage', error);
    }
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(): boolean {
    try {
      const expiry = localStorage.getItem('tokenExpiry');
      if (!expiry) return true;
      return Date.now() > parseInt(expiry, 10);
    } catch (error) {
      return true;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    // Prevent multiple refresh requests simultaneously
    if (this.refreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshing = true;
    this.refreshPromise = (async () => {
      try {
        if (!this.refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });

        if (!response.ok) {
          // If refresh fails (401), clear tokens and redirect to login
          if (response.status === 401) {
            this.clearTokens();
            window.dispatchEvent(new CustomEvent('auth-expired'));
          }
          throw new Error(`Token refresh failed: ${response.status}`);
        }

        const data = await response.json();
        this.saveTokens(data);
        return true;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        this.clearTokens();
        window.dispatchEvent(new CustomEvent('auth-error', { detail: error }));
        return false;
      } finally {
        this.refreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Make authenticated API request with automatic token management
   */
  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { skipAuth = false, retry = 0, ...fetchOptions } = options;
    
    // Construct URL robustly to avoid double /api/
    let url = endpoint.startsWith(API_BASE_URL) 
      ? endpoint 
      : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    if (url.includes('/api/api/')) {
      url = url.replace('/api/api/', '/api/');
    }
    
    const headers = new Headers(fetchOptions.headers || {});

    // Add authorization header if not skipped
    if (!skipAuth && this.accessToken) {
      // Refresh token if expired
      if (this.isTokenExpired()) {
        const refreshSuccess = await this.refreshAccessToken();
        if (!refreshSuccess) {
          throw new Error('Authentication expired. Please login again.');
        }
      }

      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    headers.set('Content-Type', 'application/json');

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      // Handle 401 - token expired or invalid
      if (response.status === 401 && !skipAuth && retry < 1) {
        console.warn('Received 401, attempting token refresh...');
        const refreshSuccess = await this.refreshAccessToken();
        if (refreshSuccess) {
          // Retry the original request
          return this.request<T>(endpoint, { ...options, retry: retry + 1 });
        }
        throw new Error('Authentication failed');
      }

      // Handle other errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(
          errorData.message || `API Error: ${response.status} ${response.statusText}`
        );
        (error as any).status = response.status;
        (error as any).data = errorData;
        throw error;
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      }
      return response.text() as any;
    } catch (error: any) {
      // Don't log abort errors as they are intentional
      const isAbortError = 
        error?.name === 'AbortError' || 
        error?.message?.includes('AbortError') || 
        error?.message?.includes('unmounted') || 
        error?.message?.includes('New request') ||
        (typeof error === 'string' && (error.includes('unmounted') || error.includes('New request')));

      if (!isAbortError) {
        console.error(`API request failed: ${endpoint}`, error);
      }
      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * Set tokens (called after login)
   */
  setTokens(tokens: TokenPair): void {
    this.saveTokens(tokens);
  }

  /**
   * Clear tokens (called on logout)
   */
  logoutClient(): void {
    this.clearTokens();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null && !this.isTokenExpired();
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }
}

// Export singleton instance
export const apiClient = new APIClient();

export default apiClient;
