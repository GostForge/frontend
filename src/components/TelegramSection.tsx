import { useEffect, useRef, useState } from 'react';
import { getTelegramLinkCode, unlinkTelegram, type User } from '../api/client';

interface Props {
  readonly user: User;
  readonly onUserUpdate: (u: User) => void;
}

export function TelegramSection({ user, onUserUpdate }: Props) {
  const [linkCode, setLinkCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const linkCodeExpireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearLinkCodeTimer() {
    if (linkCodeExpireTimerRef.current) {
      clearTimeout(linkCodeExpireTimerRef.current);
      linkCodeExpireTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearLinkCodeTimer();
    };
  }, []);

  async function handleGenerateCode() {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await getTelegramLinkCode();
      clearLinkCodeTimer();
      setLinkCode(data.code);
      linkCodeExpireTimerRef.current = setTimeout(() => {
        setLinkCode('');
        setSuccess('Код привязки истёк. Сгенерируйте новый.');
      }, 10 * 60 * 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink() {
    if (!confirm('Отвязать Telegram? Бот не сможет конвертировать от вашего имени.')) return;
    setLoading(true);
    setError('');
    try {
      await unlinkTelegram();
      onUserUpdate({ ...user, telegramLinked: false });
      setSuccess('Telegram отвязан');
      clearLinkCodeTimer();
      setLinkCode('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section">
      <h2>Привязка Telegram</h2>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      {user.telegramLinked ? (
        <div>
          <p className="status-ok">✅ Telegram привязан</p>
          <p className="hint">Вы можете конвертировать файлы через бота GostForge.</p>
          <button className="btn-danger" onClick={handleUnlink} disabled={loading}>
            {loading ? 'Отвязка...' : 'Отвязать Telegram'}
          </button>
        </div>
      ) : (
        <div>
          <p className="hint">
            <strong>Основной способ:</strong> нажмите кнопку «Войти» в Telegram-боте — привязка произойдёт автоматически.
          </p>
          <hr />
          <p className="hint">
            <strong>Fallback:</strong> generate a code and send it to the bot with <code>/link CODE</code>.
          </p>
          <button className="btn-secondary" onClick={handleGenerateCode} disabled={loading}>
            {loading ? 'Генерация...' : 'Сгенерировать код привязки'}
          </button>

          {linkCode && (
            <div className="link-code">
              <p>Отправьте боту:</p>
              <code className="token-value">/link {linkCode}</code>
              <p className="hint">Код действителен 10 минут.</p>
              <button className="btn-link" onClick={() => navigator.clipboard.writeText(`/link ${linkCode}`)}>
                Копировать команду
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
