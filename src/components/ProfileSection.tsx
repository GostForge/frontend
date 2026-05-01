import { useState } from 'react';
import { changePassword, type User } from '../api/client';

interface Props {
  user: User;
  onLogout: () => void;
}

export function ProfileSection({ user, onLogout }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError('Заполните все поля для смены пароля');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Новый пароль и подтверждение не совпадают');
      return;
    }
    if (newPassword.length < 6) {
      setError('Новый пароль должен быть не менее 6 символов');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Новый пароль должен отличаться от текущего');
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSuccess('Пароль успешно изменен');
    } catch (err: any) {
      setError(err.message || 'Не удалось изменить пароль');
    } finally {
      setSaving(false);
    }
  }

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
      </div>

      <h3 style={{ marginTop: '1.5rem' }}>Смена пароля</h3>
      <form onSubmit={handleChangePassword} style={{ maxWidth: '440px', display: 'grid', gap: '0.7rem' }}>
        <input
          type="password"
          placeholder="Текущий пароль"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          disabled={saving}
          autoComplete="current-password"
        />
        <input
          type="password"
          placeholder="Новый пароль"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          disabled={saving}
          autoComplete="new-password"
        />
        <input
          type="password"
          placeholder="Повторите новый пароль"
          value={confirmNewPassword}
          onChange={e => setConfirmNewPassword(e.target.value)}
          disabled={saving}
          autoComplete="new-password"
        />
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Сохраняем...' : 'Сменить пароль'}
        </button>
      </form>

      {error && <div className="error-msg" style={{ marginTop: '0.8rem' }}>{error}</div>}
      {success && <div className="success-msg" style={{ marginTop: '0.8rem' }}>{success}</div>}

      <button className="btn-danger" onClick={onLogout} style={{ marginTop: '1.5rem' }}>
        Выйти из аккаунта
      </button>
    </section>
  );
}
