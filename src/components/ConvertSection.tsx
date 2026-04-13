import { useState, useRef, useCallback } from 'react';
import {
  submitConversion,
  getJobStatus,
  downloadResult,
  type ConversionChain,
} from '../api/client';
import { GPT_PROMPT_EXTENDED_MD } from '../constants/gptPromptExtendedMd';

export function ConvertSection() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
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
  const dropZoneTitle = file
    ? file.name
    : (markdownMode ? 'Перетащите DOCX-файл сюда' : 'Перетащите MD или ZIP сюда');

  const reset = useCallback(() => {
    setFile(null);
    setDragOver(false);
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

  const setSelectedFile = useCallback((candidate: File | null) => {
    if (!candidate) return;
    setFile(candidate);
    setError('');
  }, []);

  const copyPromptTemplate = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(GPT_PROMPT_EXTENDED_MD);
      setCopiedPrompt(true);
      globalThis.setTimeout(() => setCopiedPrompt(false), 2000);
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
    setWarnings([]);

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

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] || null);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    setSelectedFile(e.dataTransfer.files?.[0] || null);
  }

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
  }

  function pollJob(id: string) {
    fallbackPoll(id);
  }

  async function fallbackPoll(id: string) {
    for (let i = 0; i < 120; i++) {
      await sleep(1500);
      try {
        const s = await getJobStatus(id);
        setStatus(statusLabel(s.status, s.queuePosition));
        if (s.status === 'COMPLETED') {
          setDownloadReady(true);
          setWarnings(s.warnings ?? []);
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

      <div className="convert-card">
        <form onSubmit={handleSubmit} className="convert-form">
          <input
            id="convert-file-input"
            ref={fileRef}
            className="file-input-hidden"
            type="file"
            accept={inputAccept}
            onChange={handleFileInputChange}
          />
          <label
            htmlFor="convert-file-input"
            className={`file-drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <span className="file-drop-icon">{file ? '✅' : '📦'}</span>
            <span className="file-drop-title">{dropZoneTitle}</span>
            <span className="file-drop-hint">
              {file ? 'Нажмите, чтобы заменить файл' : 'Или нажмите, чтобы выбрать файл с диска'}
            </span>
          </label>

          <div className="form-row form-row-inline">
            <label htmlFor="conversion-chain">Цепочка:</label>
            <div className="select-wrap">
              <select
                id="conversion-chain"
                value={conversionChain}
                onChange={e => setConversionChain(e.target.value as ConversionChain)}
              >
                <option value="MD_TO_DOCX">Markdown → DOCX</option>
                <option value="MD_TO_DOCX_TO_PDF">Markdown → DOCX → PDF</option>
                <option value="DOCX_TO_MD">DOCX → Markdown (ZIP)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={!file || busy}>
            {busy ? 'Конвертация...' : 'Конвертировать'}
          </button>
        </form>
      </div>

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
        <div className="warnings-msg">
          <strong>⚠️ Предупреждения конвертации:</strong>
          <ul>
            {warnings.map((w, i) => <li key={`${w}-${i}`}>{w}</li>)}
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
  const queueSuffix = queuePos ? ` (позиция: ${queuePos})` : '';
  const map: Record<string, string> = {
    PENDING: `⏳ В очереди${queueSuffix}`,
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
