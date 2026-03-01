import { useState, useEffect, useCallback } from 'react';
import { createPat, listPats, revokePat, type PatResponse } from '../api/client';

export function PatSection() {
  const [pats, setPats] = useState<PatResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState('api:full');
  const [createdToken, setCreatedToken] = useState('');
  const [creating, setCreating] = useState(false);

  const loadPats = useCallback(async () => {
    try {
      const data = await listPats();
      setPats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPats(); }, [loadPats]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    setCreatedToken('');
    try {
      const pat = await createPat(name.trim(), scopes);
      setCreatedToken(pat.token || '');
      setName('');
      await loadPats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Отозвать этот токен? Действие необратимо.')) return;
    try {
      await revokePat(id);
      await loadPats();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <section className="section">
      <h2>Personal Access Tokens</h2>
      <p className="hint">Токены для VS Code Extension и других интеграций. Токен показывается только один раз при создании.</p>

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleCreate} className="pat-form">
        <input type="text" placeholder="Название (напр. VS Code)" value={name}
          onChange={e => setName(e.target.value)} required />
        <select value={scopes} onChange={e => setScopes(e.target.value)}>
          <option value="api:full">api:full — Полный доступ</option>
          <option value="convert:write">convert:write — Только конвертация</option>
        </select>
        <button type="submit" className="btn-primary" disabled={creating}>
          {creating ? 'Создание...' : 'Создать'}
        </button>
      </form>

      {createdToken && (
        <div className="created-token">
          <strong>Ваш новый токен (скопируйте, показывается один раз):</strong>
          <code className="token-value">{createdToken}</code>
          <button className="btn-link" onClick={() => {
            navigator.clipboard.writeText(createdToken);
          }}>Копировать</button>
        </div>
      )}

      <h3>Активные токены</h3>
      {loading ? (
        <p>Загрузка...</p>
      ) : pats.length === 0 ? (
        <p className="hint">Нет активных токенов</p>
      ) : (
        <table className="pat-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Scope</th>
              <th>Создан</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pats.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td><code>{p.scopes}</code></td>
                <td>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('ru') : '—'}</td>
                <td>
                  <button className="btn-danger-sm" onClick={() => handleRevoke(p.id)}>
                    Отозвать
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
