import { useState } from 'react';
import type { User } from '../api/client';
import { ConvertSection } from '../components/ConvertSection';
import { PatSection } from '../components/PatSection';
import { TelegramSection } from '../components/TelegramSection';
import { ProfileSection } from '../components/ProfileSection';

interface Props {
  user: User;
  onLogout: () => void;
  onUserUpdate: (u: User) => void;
}

type Tab = 'convert' | 'tokens' | 'telegram' | 'profile';

export function DashboardPage({ user, onLogout, onUserUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('convert');

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
          <button className={tab === 'telegram' ? 'active' : ''} onClick={() => setTab('telegram')}>
            Telegram
          </button>
          <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>
            Профиль
          </button>
        </nav>
        <div className="user-info">
          <span>{user.displayName || user.username}</span>
          <button className="btn-link" onClick={onLogout}>Выйти</button>
        </div>
      </header>

      <main className="content">
        {tab === 'convert' && <ConvertSection />}
        {tab === 'tokens' && <PatSection />}
        {tab === 'telegram' && <TelegramSection user={user} onUserUpdate={onUserUpdate} />}
        {tab === 'profile' && <ProfileSection user={user} onLogout={onLogout} />}
      </main>
    </div>
  );
}
