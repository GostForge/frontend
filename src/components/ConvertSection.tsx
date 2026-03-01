import { useState, useRef, useCallback } from 'react';
import {
  submitConversion, getJobStatus, downloadResult, createSSE,
  type JobStatus,
} from '../api/client';

type OutputFormat = 'DOCX' | 'PDF' | 'BOTH';

export function ConvertSection() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<OutputFormat>('DOCX');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobFormat, setJobFormat] = useState<OutputFormat>('DOCX');
  const [downloadReady, setDownloadReady] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setJobId(null);
    setJobFormat('DOCX');
    setStatus('');
    setError('');
    setWarnings([]);
    setDownloadReady(false);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    setStatus('Отправка...');
    setDownloadReady(false);

    try {
      const job = await submitConversion(file, format);
      setJobId(job.jobId);
      setJobFormat(format);
      pollJob(job.jobId);
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки');
      setBusy(false);
    }
  }

  function pollJob(id: string) {
    // Try SSE first, fall back to polling
    try {
      const sse = createSSE(id);
      let closed = false;

      const cleanup = () => {
        if (!closed) { closed = true; sse.close(); }
      };

      sse.addEventListener('completed', () => {
        setStatus('✅ Готово!');
        setDownloadReady(true);
        setBusy(false);
        // Fetch final status to get warnings
        getJobStatus(id).then(s => {
          if (s.warnings?.length) setWarnings(s.warnings);
        }).catch(() => {});
        cleanup();
      });

      sse.addEventListener('failed', (ev) => {
        const data = JSON.parse((ev as MessageEvent).data);
        setError(`Ошибка: ${data.errorMessage || 'неизвестная'}`);
        setStatus('');
        setBusy(false);
        cleanup();
      });

      sse.addEventListener('queued', (ev) => {
        const data = JSON.parse((ev as MessageEvent).data);
        setStatus(`В очереди (позиция: ${data.queuePosition ?? '?'})`);
      });

      sse.addEventListener('status', (ev) => {
        const data = JSON.parse((ev as MessageEvent).data);
        setStatus(statusLabel(data.status));
      });

      sse.onerror = () => {
        cleanup();
        // fallback to polling
        fallbackPoll(id);
      };
    } catch {
      fallbackPoll(id);
    }
  }

  async function fallbackPoll(id: string) {
    for (let i = 0; i < 120; i++) {
      await sleep(1500);
      try {
        const s = await getJobStatus(id);
        setStatus(statusLabel(s.status, s.queuePosition));
        if (s.status === 'COMPLETED') {
          setDownloadReady(true);
          if (s.warnings?.length) setWarnings(s.warnings);
          setBusy(false);
          return;
        }
        if (s.status === 'FAILED') {
          setError(`Ошибка: ${s.errorMessage || 'неизвестная'}`);
          setStatus('');
          setBusy(false);
          return;
        }
      } catch { /* retry */ }
    }
    setError('Превышено время ожидания');
    setBusy(false);
  }

  async function handleDownload(fmt: string) {
    if (!jobId) return;
    try {
      const { blob, filename } = await downloadResult(jobId, fmt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(`Ошибка скачивания: ${err.message}`);
    }
  }

  return (
    <section className="section">
      <h2>Конвертация</h2>
      <p className="hint">Загрузите <code>.zip</code> с <code>.md</code> файлами и картинками (до 50 MB).</p>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.md"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="form-row">
          <label>Формат:</label>
          <select value={format} onChange={e => setFormat(e.target.value as OutputFormat)}>
            <option value="DOCX">DOCX</option>
            <option value="PDF">PDF</option>
            <option value="BOTH">DOCX + PDF</option>
          </select>
        </div>

        <button type="submit" className="btn-primary" disabled={!file || busy}>
          {busy ? 'Конвертация...' : 'Конвертировать'}
        </button>
      </form>

      {status && <div className="status-msg">{status}</div>}
      {error && <div className="error-msg">{error}</div>}

      {warnings.length > 0 && (
        <div className="warnings-msg" style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, padding: '8px 12px', margin: '8px 0' }}>
          <strong>⚠️ Предупреждения конвертации:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {downloadReady && jobId && (
        <div className="download-btns">
          {(jobFormat === 'DOCX' || jobFormat === 'BOTH') && (
            <button className="btn-secondary" onClick={() => handleDownload('docx')}>
              📄 Скачать DOCX
            </button>
          )}
          {(jobFormat === 'PDF' || jobFormat === 'BOTH') && (
            <button className="btn-secondary" onClick={() => handleDownload('pdf')}>
              📑 Скачать PDF
            </button>
          )}
          <button className="btn-link" onClick={reset}>Новая конвертация</button>
        </div>
      )}
    </section>
  );
}

function statusLabel(s: string, queuePos?: number): string {
  const map: Record<string, string> = {
    PENDING: `⏳ В очереди${queuePos ? ` (позиция: ${queuePos})` : ''}`,
    MERGING_MD: '📝 Объединение Markdown...',
    CONVERTING_DOCX: '📄 Конвертация в DOCX...',
    CONVERTING_PDF: '📑 Конвертация в PDF...',
    COMPLETED: '✅ Готово!',
    FAILED: '❌ Ошибка',
  };
  return map[s] || `🔄 ${s}...`;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
