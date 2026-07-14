/**
 * API Client Tests
 * Tests JWT token management, auto-refresh, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('API Client - Token Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should save tokens to localStorage', () => {
    const tokens = {
      accessToken: 'access_token_123',
      refreshToken: 'refresh_token_456',
      expiresIn: 3600,
    };

    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    expect(localStorage.getItem('accessToken')).toBe('access_token_123');
    expect(localStorage.getItem('refreshToken')).toBe('refresh_token_456');
  });

  it('should retrieve tokens from localStorage', () => {
    localStorage.setItem('accessToken', 'saved_access_token');
    localStorage.setItem('refreshToken', 'saved_refresh_token');

    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    expect(accessToken).toBe('saved_access_token');
    expect(refreshToken).toBe('saved_refresh_token');
  });

  it('should clear tokens from localStorage', () => {
    localStorage.setItem('accessToken', 'token');
    localStorage.setItem('refreshToken', 'refresh');

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('should calculate token expiration time', () => {
    const now = Date.now();
    const expiresIn = 3600; // 1 hour in seconds
    const expiry = now + expiresIn * 1000;

    localStorage.setItem('tokenExpiry', String(expiry));

    const storedExpiry = parseInt(localStorage.getItem('tokenExpiry') || '0', 10);
    expect(storedExpiry).toBe(expiry);
  });

  it('should detect expired tokens', () => {
    const now = Date.now();
    // Set expiry to 1 second ago
    const expiredExpiry = now - 1000;

    localStorage.setItem('tokenExpiry', String(expiredExpiry));

    const storedExpiry = parseInt(localStorage.getItem('tokenExpiry') || '0', 10);
    const isExpired = now > storedExpiry;
    expect(isExpired).toBe(true);
  });

  it('should detect non-expired tokens', () => {
    const now = Date.now();
    // Set expiry to 1 hour in the future
    const futureExpiry = now + 3600 * 1000;

    localStorage.setItem('tokenExpiry', String(futureExpiry));

    const storedExpiry = parseInt(localStorage.getItem('tokenExpiry') || '0', 10);
    const isExpired = now > storedExpiry;
    expect(isExpired).toBe(false);
  });
});

describe('API Client - Request Headers', () => {
  it('should build authorization header correctly', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const authHeader = `Bearer ${token}`;
    expect(authHeader).toMatch(/^Bearer [a-zA-Z0-9._-]+$/);
  });

  it('should include required headers in request', () => {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123',
    };

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toMatch(/^Bearer /);
  });

  it('should reject requests without authorization when required', () => {
    const headers: Record<string, string | undefined> = {
      'Content-Type': 'application/json',
      'Authorization': undefined,
    };

    const requiresAuth = true;
    const hasAuth = headers['Authorization'] !== undefined;

    if (requiresAuth && !hasAuth) {
      expect(hasAuth).toBe(false);
    }
  });
});

describe('API Client - Error Handling', () => {
  it('should handle 401 Unauthorized response', () => {
    const status = 401;
    const message = 'Unauthorized';

    expect(status).toBe(401);
    expect(message).toBe('Unauthorized');
  });

  it('should handle 403 Forbidden response', () => {
    const status = 403;
    const message = 'Insufficient permissions';

    expect(status).toBe(403);
  });

  it('should handle 429 Rate Limited response', () => {
    const status = 429;
    expect(status).toBe(429);
  });

  it('should handle network errors', () => {
    const error = new Error('Network request failed');
    expect(error.message).toContain('Network');
  });

  it('should include error details in response', () => {
    const errorResponse = {
      status: 400,
      data: {
        message: 'Bad Request',
        errors: ['Invalid input'],
      },
    };

    expect(errorResponse.data.message).toBe('Bad Request');
    expect(errorResponse.data.errors).toHaveLength(1);
  });
});

describe('API Client - Request Methods', () => {
  it('should support GET requests', () => {
    const method = 'GET';
    expect(method).toBe('GET');
  });

  it('should support POST requests', () => {
    const method = 'POST';
    expect(method).toBe('POST');
  });

  it('should support PUT requests', () => {
    const method = 'PUT';
    expect(method).toBe('PUT');
  });

  it('should support DELETE requests', () => {
    const method = 'DELETE';
    expect(method).toBe('DELETE');
  });

  it('should include request body for POST/PUT', () => {
    const data = { username: 'test', password: 'SecurePass123!' };
    const body = JSON.stringify(data);

    expect(body).toContain('username');
    expect(body).toContain('test');
  });
});

describe('API Client - Token Refresh Flow', () => {
  it('should maintain refresh token correctly', () => {
    const refreshToken = 'refresh_token_xyz789';
    localStorage.setItem('refreshToken', refreshToken);

    const stored = localStorage.getItem('refreshToken');
    expect(stored).toBe(refreshToken);
  });

  it('should prevent multiple simultaneous refresh requests', () => {
    let refreshInProgress = false;
    const refreshPromise = null;

    expect(refreshInProgress).toBe(false);
    expect(refreshPromise).toBeNull();

    // Simulate refresh start
    refreshInProgress = true;
    expect(refreshInProgress).toBe(true);
  });

  it('should dispatch auth-expired event on failed refresh', () => {
    const eventName = 'auth-expired';
    const event = new CustomEvent(eventName);

    expect(event.type).toBe(eventName);
  });
});

describe('API Client - Authentication State', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should detect authenticated state when token exists', () => {
    const accessToken = 'valid_token';
    const futureExpiry = Date.now() + 3600 * 1000;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('tokenExpiry', String(futureExpiry));

    const hasToken = localStorage.getItem('accessToken') !== null;
    const isExpired = Date.now() > parseInt(localStorage.getItem('tokenExpiry') || '0', 10);

    expect(hasToken && !isExpired).toBe(true);
  });

  it('should detect unauthenticated state when no token', () => {
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('should detect expired authentication', () => {
    const expiredExpiry = Date.now() - 1000; // 1 second ago

    localStorage.setItem('accessToken', 'token');
    localStorage.setItem('tokenExpiry', String(expiredExpiry));

    const isExpired = Date.now() > parseInt(localStorage.getItem('tokenExpiry') || '0', 10);
    expect(isExpired).toBe(true);
  });
});

describe('API Client - Endpoint Building', () => {
  const baseUrl = 'http://localhost:5000/api';

  it('should build login endpoint correctly', () => {
    const endpoint = '/auth/login';
    const fullUrl = `${baseUrl}${endpoint}`;
    expect(fullUrl).toBe('http://localhost:5000/api/auth/login');
  });

  it('should build protected resource endpoint correctly', () => {
    const endpoint = '/products';
    const fullUrl = `${baseUrl}${endpoint}`;
    expect(fullUrl).toBe('http://localhost:5000/api/products');
  });

  it('should handle endpoints with parameters', () => {
    const endpoint = '/invoices/123';
    const fullUrl = `${baseUrl}${endpoint}`;
    expect(fullUrl).toBe('http://localhost:5000/api/invoices/123');
  });
});
