import { useState, useRef, useCallback } from 'react';
import {
  submitConversion,
  getJobStatus,
  downloadResult,
  createSSE,
  type ConversionChain,
} from '../api/client';
import { GPT_PROMPT_EXTENDED_MD } from '../constants/gptPromptExtendedMd';

export function ConvertSection() {
  const [file, setFile] = useState<File | null>(null);
  const [conversionChain, setConversionChain] = useState<ConversionChain>('MD_TO_DOCX');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobChain, setJobChain] = useState<ConversionChain>('MD_TO_DOCX');
  const [downloadReady, setDownloadReady] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const markdownMode = conversionChain === 'DOCX_TO_MD';
  const inputAccept = markdownMode ? '.docx' : '.zip,.md';
  const uploadHint = markdownMode
    ? 'Загрузите исходный .docx (до 50 MB), получите ZIP с Markdown и assets.'
    : 'Загрузите .md или .zip с Markdown-файлами и картинками (до 50 MB).';

  const reset = useCallback(() => {
    setFile(null);
    setJobId(null);
    setJobChain('MD_TO_DOCX');
    setStatus('');
    setError('');
    setWarnings([]);
    setDownloadReady(false);
    setCopiedPrompt(false);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const copyPromptTemplate = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(GPT_PROMPT_EXTENDED_MD);
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      setError('Не удалось скопировать шаблон в буфер обмена');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    if (markdownMode && !isDocxFile(file.name)) {
      setError('Для режима DOCX → Markdown нужен файл .docx');
      return;
    }

    if (!markdownMode && !isMdSourceFile(file.name)) {
      setError('Для режима Markdown → DOCX/PDF загрузите .md или .zip');
      return;
    }

    setBusy(true);
    setError('');
    setStatus('Отправка...');
    setDownloadReady(false);

    try {
      const job = await submitConversion(file, conversionChain);
      setJobId(job.jobId);
      setJobChain(conversionChain);
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

  async function handleDownload(fmt: 'docx' | 'pdf' | 'zip') {
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
      <p className="hint">{uploadHint}</p>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            ref={fileRef}
            type="file"
            accept={inputAccept}
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="form-row">
          <label>Формат:</label>
          <select value={conversionChain} onChange={e => setConversionChain(e.target.value as ConversionChain)}>
            <option value="MD_TO_DOCX">Markdown → DOCX</option>
            <option value="MD_TO_DOCX_TO_PDF">Markdown → DOCX → PDF</option>
            <option value="DOCX_TO_MD">DOCX → Markdown (ZIP)</option>
          </select>
        </div>

        <button type="submit" className="btn-primary" disabled={!file || busy}>
          {busy ? 'Конвертация...' : 'Конвертировать'}
        </button>
      </form>

      {!markdownMode && (
        <div className="prompt-card">
          <div className="prompt-card-head">
            <h3>Шаблон запроса к GPT (Extended Markdown)</h3>
            <button className="btn-secondary" onClick={copyPromptTemplate} type="button">
              {copiedPrompt ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
          <p className="hint">Используйте шаблон при генерации Markdown перед конвертацией в ГОСТ DOCX/PDF.</p>
          <textarea className="prompt-template" value={GPT_PROMPT_EXTENDED_MD} readOnly />
        </div>
      )}

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
          {jobChain === 'MD_TO_DOCX' && (
            <button className="btn-secondary" onClick={() => handleDownload('docx')}>
              📄 Скачать DOCX
            </button>
          )}
          {jobChain === 'MD_TO_DOCX_TO_PDF' && (
            <button className="btn-secondary" onClick={() => handleDownload('pdf')}>
              📑 Скачать PDF
            </button>
          )}
          {jobChain === 'DOCX_TO_MD' && (
            <button className="btn-secondary" onClick={() => handleDownload('zip')}>
              🗂 Скачать ZIP (Markdown + assets)
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
    CONVERTING_MD: '🧩 Конвертация DOCX в Markdown...',
    COMPLETED: '✅ Готово!',
    FAILED: '❌ Ошибка',
  };
  return map[s] || `🔄 ${s}...`;
}

function isDocxFile(name: string): boolean {
  return name.toLowerCase().endsWith('.docx');
}

function isMdSourceFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.zip') || lower.endsWith('.md');
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
