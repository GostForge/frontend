import { useState } from 'react';
import type { AuthResponse } from '../api/client';
import { PublicConversionBoard } from '../components/PublicConversionBoard';

interface Props {
  onAuth: (auth: AuthResponse) => void;
  error: string;
  onError: (msg: string) => void;
  onLogin: (login: string, password: string, telegramInitData?: string) => Promise<AuthResponse>;
  onRegister: (username: string, email: string, password: string, displayName?: string, telegramInitData?: string) => Promise<AuthResponse>;
  /** Telegram initData — present when opened as Mini App and chatId not yet linked */
  telegramInitData?: string | null;
}

export function AuthPage({ onAuth, error, onError, onLogin, onRegister, telegramInitData }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [showPulse, setShowPulse] = useState(false);

  // Login fields
  const [loginStr, setLoginStr] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register fields
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regDisplay, setRegDisplay] = useState('');

  const isMiniApp = !!telegramInitData;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError('');
    try {
      const auth = await onLogin(loginStr, loginPass, telegramInitData ?? undefined);
      onAuth(auth);
    } catch (err: any) {
      onError(err.message || 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError('');
    try {
      const auth = await onRegister(
        regUser, regEmail, regPass,
        regDisplay || undefined,
        telegramInitData ?? undefined,
      );
      onAuth(auth);
    } catch (err: any) {
      onError(err.message || 'Ошибка регистрации');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-card-wrap">
          <div className="auth-card">
            <h1 className="logo">GostForge</h1>
            <p className="subtitle">Markdown → ГОСТ DOCX/PDF</p>

            {isMiniApp && (
              <div className="info-msg">
                📡 Открыто из Telegram. Войдите или зарегистрируйтесь — аккаунт привяжется автоматически.
              </div>
            )}

            <div className="tab-bar">
              <button className={tab === 'login' ? 'active' : ''} onClick={() => { setTab('login'); onError(''); }}>
                Вход
              </button>
              <button className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); onError(''); }}>
                Регистрация
              </button>
            </div>

            {error && <div className="error-msg">{error}</div>}

            {tab === 'login' ? (
              <form onSubmit={handleLogin}>
                <input type="text" placeholder="Логин или email" value={loginStr}
                  onChange={e => setLoginStr(e.target.value)} required />
                <input type="password" placeholder="Пароль" value={loginPass}
                  onChange={e => setLoginPass(e.target.value)} required />
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Вход...' : 'Войти'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <input type="text" placeholder="Имя пользователя" value={regUser}
                  onChange={e => setRegUser(e.target.value)} required />
                <input type="email" placeholder="Email" value={regEmail}
                  onChange={e => setRegEmail(e.target.value)} required />
                <input type="password" placeholder="Пароль" value={regPass}
                  onChange={e => setRegPass(e.target.value)} required />
                <input type="text" placeholder="Отображаемое имя (необязательно)" value={regDisplay}
                  onChange={e => setRegDisplay(e.target.value)} />
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Регистрация...' : 'Зарегистрироваться'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="auth-pulse-toggle">
          <button type="button" className="btn-secondary" onClick={() => setShowPulse((v) => !v)}>
            {showPulse ? 'Скрыть пульс проекта' : 'Показать пульс проекта'}
          </button>
        </div>

        {showPulse && (
          <div className="auth-pulse-panel">
            <PublicConversionBoard compact />
          </div>
        )}
      </div>
    </div>
  );
}
