import { useState, useEffect, useCallback } from 'react';
import {
  getCurrentUser, getAccessToken, login, register, logout,
  setAuth, restoreAccessTokenFromStorage, getProfile,
  onAuthExpired,
  type User, type AuthResponse,
} from './api/client';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import './styles.css';

export function App() {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleAuth = useCallback((auth: AuthResponse) => {
    setAuth(auth);
    setUser(auth.user);
    setError('');
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch { /* ignore */ }
    setUser(null);
  }, []);

  // Force logout when token expires and refresh fails
  useEffect(() => {
    return onAuthExpired(() => setUser(null));
  }, []);

  // ── Restore session on mount ──────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const hasTokenInMemory = !!getAccessToken();
        const restoredToken = restoreAccessTokenFromStorage();
        if (!hasTokenInMemory && !restoredToken) {
          setLoading(false);
          return;
        }

        try {
          const profile = await getProfile();
          setUser(profile);
          setError('');
        } catch {
          setUser(null);
        }
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen for logout from other tabs ──────────────────
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gf_access' && e.newValue === null) {
        setUser(null);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  if (!user) {
    return (
      <LandingPage
        onAuth={handleAuth}
        onError={setError}
      />
    );
  }

  return (
    <DashboardPage
      user={user}
      onLogout={handleLogout}
      onUserUpdate={setUser}
    />
  );
}
