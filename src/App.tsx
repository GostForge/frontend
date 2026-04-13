import { useState, useEffect, useCallback } from 'react';
import {
  getCurrentUser, getAccessToken, login, register, logout,
  miniAppAuth, setAuth, restoreAccessTokenFromStorage, getProfile,
  onAuthExpired,
  type User, type AuthResponse,
} from './api/client';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import './styles.css';

export function App() {
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** Telegram initData — stored when Mini App opens but user not yet linked */
  const [telegramInitData, setTelegramInitData] = useState<string | null>(null);

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
    onAuthExpired(() => setUser(null));
  }, []);

  // ── Mini App auto-auth on mount ──────────────────────
  useEffect(() => {
    (async () => {
      try {
        const tg = (globalThis as any).Telegram?.WebApp;
        if (tg?.initData) {
          tg.ready();
          tg.expand();
          try {
            // Try auto-auth (works if chatId is already linked)
            const auth = await miniAppAuth(tg.initData);
            handleAuth(auth);
            setLoading(false);
            return;
          } catch {
            // NOT_LINKED — store initData, show auth form for login/register
            setTelegramInitData(tg.initData);
            // fall through to show auth page
          }
          setLoading(false);
          return;
        }

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

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  if (!user) {
    return (
      <AuthPage
        onAuth={handleAuth}
        error={error}
        onError={setError}
        onLogin={login}
        onRegister={register}
        telegramInitData={telegramInitData}
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
