import { useState, useEffect, useCallback } from 'react';
import {
  getCurrentUser, getAccessToken, login, register, logout, refresh,
  miniAppAuth, loadRefreshFromCloudStorage, setAuth, setRefreshToken,
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
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initData) {
          tg.ready();
          tg.expand();
          try {
            // Try auto-auth (works if chatId is already linked)
            const auth = await miniAppAuth(tg.initData);
            handleAuth(auth);
            setLoading(false);
            return;
          } catch (e: any) {
            // NOT_LINKED — store initData, show auth form for login/register
            setTelegramInitData(tg.initData);
            // fall through to show auth page
          }
          setLoading(false);
          return;
        }

        // Try CloudStorage / localStorage refresh token
        const storedRt = await loadRefreshFromCloudStorage();
        if (storedRt) {
          // Load into memory so doRefresh() can use it
          setRefreshToken(storedRt);
          try {
            const auth = await refresh();
            handleAuth(auth);
          } catch { /* ignore, show login */ }
          setLoading(false);
          return;
        }

        // Regular web — try silent refresh (cookie might be set)
        if (getAccessToken()) {
          setLoading(false);
          return;
        }

        // Try silent refresh (cookie might be set)
        try {
          const auth = await refresh();
          handleAuth(auth);
        } catch { /* no session, show login */ }
      } catch (e: any) {
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
