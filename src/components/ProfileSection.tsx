import type { User } from '../api/client';

interface Props {
  user: User;
  onLogout: () => void;
}

export function ProfileSection({ user, onLogout }: Props) {
  return (
    <section className="section">
      <h2>Профиль</h2>

      <div className="profile-card">
        <div className="profile-row">
          <span className="label">Имя пользователя:</span>
          <span>{user.username}</span>
        </div>
        <div className="profile-row">
          <span className="label">Email:</span>
          <span>{user.email}</span>
        </div>
        <div className="profile-row">
          <span className="label">Отображаемое имя:</span>
          <span>{user.displayName || '—'}</span>
        </div>
        <div className="profile-row">
          <span className="label">Telegram:</span>
          <span>{user.telegramLinked ? '✅ Привязан' : '❌ Не привязан'}</span>
        </div>
      </div>

      <button className="btn-danger" onClick={onLogout} style={{ marginTop: '1.5rem' }}>
        Выйти из аккаунта
      </button>
    </section>
  );
}
