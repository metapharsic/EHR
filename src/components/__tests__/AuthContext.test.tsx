import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../../context/AuthContext';

vi.mock('../../services/apiClient', () => ({
 apiClient: {
 isAuthenticated: vi.fn(() => false),
 post: vi.fn(async (endpoint: string) => {
 if (endpoint === '/auth/login') {
 return {
 accessToken: 'access-token',
 refreshToken: 'refresh-token',
 expiresIn: 86400,
 user: {
 id: '1',
 username: 'admin',
 name: 'Admin',
 role: 'ADMIN',
 },
 };
 }
 return {};
 }),
 setTokens: vi.fn(),
 logoutClient: vi.fn(),
 },
}));

// Test component that uses auth
const TestComponent = () => {
 const { user, login, logout, hasPermission } = useAuth();
 
 return (
 <div>
 {user ? (
 <>
 <span data-testid="username">{user.username}</span>
 <span data-testid="role">{user.role}</span>
 <button data-testid="logout-btn" onClick={logout}>Logout</button>
 </>
 ) : (
 <button data-testid="login-btn" onClick={() => login('admin', 'admin')}>Login</button>
 )}
 <span data-testid="has-admin-perm">
 {hasPermission(['ADMIN']) ? 'true' : 'false'}
 </span>
 </div>
 );
};

describe('AuthContext', () => {
 beforeEach(() => {
 localStorage.clear();
 vi.clearAllMocks();
 });

 it('should login and show user data', async () => {
 render(
 <AuthProvider>
 <TestComponent />
 </AuthProvider>
 );

 fireEvent.click(screen.getByTestId('login-btn'));
 
 await waitFor(() => {
 expect(screen.getByTestId('username').textContent).toBe('admin');
 expect(screen.getByTestId('role').textContent).toBe('ADMIN');
 });
 });

 it('should have ADMIN permission', async () => {
 render(
 <AuthProvider>
 <TestComponent />
 </AuthProvider>
 );

 fireEvent.click(screen.getByTestId('login-btn'));
 
 await waitFor(() => {
 expect(screen.getByTestId('has-admin-perm').textContent).toBe('true');
 });
 });

 it('should logout successfully', async () => {
 render(
 <AuthProvider>
 <TestComponent />
 </AuthProvider>
 );

 fireEvent.click(screen.getByTestId('login-btn'));
 
 await waitFor(() => screen.getByTestId('logout-btn'));
 
 // Logout
 fireEvent.click(screen.getByTestId('logout-btn'));
 
 await waitFor(() => {
 expect(screen.getByTestId('login-btn')).toBeDefined();
 });
 });
});

