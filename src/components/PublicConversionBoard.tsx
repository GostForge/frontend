import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getPublicConversionBoard,
  type PublicConversionBoard,
} from '../api/client';

interface Props {
  compact?: boolean;
}

const REFRESH_MS = 15000;

export function PublicConversionBoard({ compact = false }: Props) {
  const [board, setBoard] = useState<PublicConversionBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const limit = compact ? 8 : 20;

  const load = useCallback(async () => {
    try {
      const data = await getPublicConversionBoard(limit);
      setBoard(data);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить пульс проекта');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const recentItems = useMemo(() => board?.recent ?? [], [board]);

  return (
    <section className={`public-board ${compact ? 'compact' : ''}`}>
      <div className="public-board-header">
        <h3>Пульс проекта</h3>
        <span className="public-board-subtitle">
          {board ? `Обновлено ${formatDateTime(board.generatedAt)}` : 'Загрузка...'}
        </span>
      </div>

      <p className="public-board-note">
        Публичная доска показывает только обезличенные технические статусы конвертаций.
      </p>

      {loading && !board && <div className="status-msg">Загружаем активность...</div>}
      {error && <div className="error-msg">{error}</div>}

      {board && (
        <>
          <div className="public-board-stats">
            <Stat title="Всего задач" value={board.totalJobs} />
            <Stat title="Активные" value={board.activeJobs} />
            <Stat title="Успешные" value={board.completedJobs} tone="ok" />
            <Stat title="Ошибки" value={board.failedJobs} tone="bad" />
            <Stat title="За 24ч" value={board.submittedLast24h} />
            <Stat title="Успешно за 24ч" value={board.completedLast24h} tone="ok" />
          </div>

          <div className="public-board-list">
            {recentItems.length === 0 && (
              <div className="hint">Пока нет задач для отображения.</div>
            )}

            {recentItems.map((item) => (
              <article key={`${item.publicId}-${item.createdAt}`} className="public-board-item">
                <div className="public-board-item-main">
                  <span className={`badge ${badgeClass(item.status)}`}>{statusLabel(item.status)}</span>
                  <span className="public-board-id">#{item.publicId}</span>
                  <span className="public-board-format">{item.outputFormat}</span>
                </div>
                <div className="public-board-item-meta">
                  <span>Старт: {formatDateTime(item.createdAt)}</span>
                  {item.durationMs != null && <span>Длительность: {formatDuration(item.durationMs)}</span>}
                  {item.warningCount > 0 && <span>⚠ Предупреждений: {item.warningCount}</span>}
                  {item.hasError && <span className="danger-text">Ошибка</span>}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ title, value, tone = 'default' }: { title: string; value: number; tone?: 'default' | 'ok' | 'bad' }) {
  return (
    <div className={`public-board-stat tone-${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'В очереди',
    MERGING_MD: 'Подготовка',
    CONVERTING_DOCX: 'DOCX',
    CONVERTING_PDF: 'PDF',
    CONVERTING_MD: 'Markdown',
    COMPLETED: 'Готово',
    FAILED: 'Ошибка',
  };
  return map[status] || status;
}

function badgeClass(status: string): string {
  if (status === 'COMPLETED') return 'badge-ok';
  if (status === 'FAILED') return 'badge-bad';
  if (status === 'PENDING') return 'badge-wait';
  return 'badge-run';
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)} c`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}м ${rem}с`;
}
