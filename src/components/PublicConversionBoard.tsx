import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getPublicConversionBoard,
  type PublicConversionBoard,
} from '../api/client';

interface Props {
  readonly compact?: boolean;
}

const REFRESH_MS = 15000;

interface StatProps {
  readonly title: string;
  readonly value: number;
  readonly tone?: 'default' | 'ok' | 'bad';
}

export function PublicConversionBoard({ compact = false }: Props) {
  const [board, setBoard] = useState<PublicConversionBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const limit = compact ? 8 : 20;

  const load = useCallback(async (isActive?: () => boolean) => {
    try {
      const data = await getPublicConversionBoard(limit);
      if (isActive && !isActive()) return;
      setBoard(data);
      setError('');
    } catch (e: any) {
      if (isActive && !isActive()) return;
      setError(e?.message || 'Не удалось загрузить пульс проекта');
    } finally {
      if (isActive && !isActive()) return;
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    let active = true;
    const isActive = () => active;

    void load(isActive);
    const timer = globalThis.setInterval(() => {
      void load(isActive);
    }, REFRESH_MS);

    return () => {
      active = false;
      globalThis.clearInterval(timer);
    };
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
          <div className="public-board-groups">
            <div className="public-board-group">
              <h4 className="public-board-group-title">Конвертации (всего)</h4>
              <div className="public-board-stats">
                <Stat title="Всего задач" value={safeMetric(board.totalJobs)} />
                <Stat title="Активные" value={safeMetric(board.activeJobs)} />
                <Stat title="Успешные" value={safeMetric(board.completedJobs)} tone="ok" />
                <Stat title="Ошибки" value={safeMetric(board.failedJobs)} tone="bad" />
              </div>
            </div>

            <div className="public-board-group">
              <h4 className="public-board-group-title">Конвертации (24ч)</h4>
              <div className="public-board-stats">
                <Stat title="Запущено" value={safeMetric(board.submittedLast24h)} />
                <Stat title="Успешно" value={safeMetric(board.completedLast24h)} tone="ok" />
                <Stat title="Ошибки" value={safeMetric(board.failedLast24h)} tone="bad" />
              </div>
            </div>

            <div className="public-board-group">
              <h4 className="public-board-group-title">Пользователи</h4>
              <div className="public-board-stats">
                <Stat title="Всего пользователей" value={safeMetric(board.totalUsers)} />
                <Stat title="Новые за 24ч" value={safeMetric(board.registeredLast24h)} tone="ok" />
                <Stat title="Новые за 30д" value={safeMetric(board.registeredLast30d)} tone="ok" />
              </div>
            </div>
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
                  <span className="public-board-format">{chainLabel(item.conversionChain)}</span>
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

function Stat({ title, value, tone = 'default' }: StatProps) {
  return (
    <div className={`public-board-stat tone-${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function safeMetric(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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

function chainLabel(chain: string): string {
  const map: Record<string, string> = {
    MD_TO_DOCX: 'MD → DOCX',
    MD_TO_DOCX_TO_PDF: 'MD → DOCX → PDF',
    DOCX_TO_MD: 'DOCX → MD',
  };
  return map[chain] || chain;
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
