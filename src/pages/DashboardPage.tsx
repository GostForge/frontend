import { useState, useEffect } from 'react';
import type { User } from '../api/client';
import { getProfile } from '../api/client';
import { ConvertSection } from '../components/ConvertSection';
import { PatSection } from '../components/PatSection';
import { ProfileSection } from '../components/ProfileSection';
import { PublicConversionBoard } from '../components/PublicConversionBoard';

interface Props {
  user: User;
  onLogout: () => void;
  onUserUpdate: (u: User) => void;
}

type Tab = 'convert' | 'tokens' | 'profile' | 'pulse';

export function DashboardPage({ user, onLogout, onUserUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('convert');

  // ── Refresh profile when tab regains focus ────────────
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        try {
          const updated = await getProfile();
          onUserUpdate(updated);
        } catch {
          // Silently ignore profile refresh errors
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [onUserUpdate]);

  return (
    <div className="dashboard">
      <header className="topbar">
        <span className="logo-sm">GostForge</span>
        <nav className="nav-tabs">
          <button className={tab === 'convert' ? 'active' : ''} onClick={() => setTab('convert')}>
            Конвертация
          </button>
          <button className={tab === 'tokens' ? 'active' : ''} onClick={() => setTab('tokens')}>
            PAT-токены
          </button>
          <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>
            Профиль
          </button>
          <button className={tab === 'pulse' ? 'active' : ''} onClick={() => setTab('pulse')}>
            Пульс проекта
          </button>
        </nav>
        <div className="user-info">
          <span>{user.username}</span>
          <button className="btn-link" onClick={onLogout}>Выйти</button>
        </div>
      </header>

      <main className="content">
        {tab === 'convert' && <ConvertSection />}
        {tab === 'tokens' && <PatSection />}
        {tab === 'profile' && <ProfileSection user={user} onLogout={onLogout} />}
        {tab === 'pulse' && <PublicConversionBoard />}
      </main>
    </div>
  );
}
