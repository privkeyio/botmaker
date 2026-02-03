import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock functions
const mockGetAdminToken = vi.fn();
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockSetAuthInvalidatedCallback = vi.fn();

// Mock the api module
vi.mock('../api', () => ({
  getAdminToken: () => mockGetAdminToken() as string | null,
  login: (password: string) => mockLogin(password) as Promise<string>,
  logout: () => mockLogout() as Promise<void>,
  setAuthInvalidatedCallback: (cb: (() => void) | null): void => { mockSetAuthInvalidatedCallback(cb); },
}));

// Test component to access auth context
function TestComponent() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="authenticated">{auth.isAuthenticated.toString()}</span>
      <span data-testid="loading">{auth.isLoading.toString()}</span>
      <span data-testid="error">{auth.error ?? 'no-error'}</span>
      <button onClick={() => { auth.login('test-password').catch(() => { /* Error handled by context */ }); }}>Login</button>
      <button onClick={() => { void auth.logout(); }}>Logout</button>
      <button onClick={() => { auth.clearError(); }}>Clear Error</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminToken.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide isAuthenticated false when no token exists', async () => {
    mockGetAdminToken.mockReturnValue(null);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('should provide isAuthenticated true when token exists', async () => {
    mockGetAdminToken.mockReturnValue('existing-token');

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
  });

  it('should set isAuthenticated to true after successful login', async () => {
    mockGetAdminToken.mockReturnValue(null);
    mockLogin.mockResolvedValueOnce('new-token');

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');

    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    expect(mockLogin).toHaveBeenCalledWith('test-password');
  });

  it('should set error on login failure', async () => {
    mockGetAdminToken.mockReturnValue(null);
    mockLogin.mockRejectedValueOnce(new Error('Invalid password'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Invalid password');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('should set isAuthenticated to false after logout', async () => {
    mockGetAdminToken.mockReturnValue('existing-token');
    mockLogout.mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    act(() => {
      screen.getByText('Logout').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });

    expect(mockLogout).toHaveBeenCalled();
  });

  it('should clear error when clearError is called', async () => {
    mockGetAdminToken.mockReturnValue(null);
    mockLogin.mockRejectedValueOnce(new Error('Invalid password'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Invalid password');
    });

    act(() => {
      screen.getByText('Clear Error').click();
    });

    expect(screen.getByTestId('error').textContent).toBe('no-error');
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { /* suppress React error */ });

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleError.mockRestore();
  });

  it('should register auth invalidation callback on mount', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(mockSetAuthInvalidatedCallback).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should set isAuthenticated false and clear error when auth invalidation callback is called', async () => {
    mockGetAdminToken.mockReturnValue('existing-token');
    mockLogin.mockRejectedValueOnce(new Error('Some error'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial load with token
    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    // Trigger login to set an error
    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Some error');
    });

    // Simulate auth invalidation by calling the registered callback
    const callback = mockSetAuthInvalidatedCallback.mock.calls[0][0] as () => void;
    act(() => {
      callback();
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('no-error');
  });
});
