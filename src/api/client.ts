/**
 * GostForge API client.
 *
 * Access token is kept in memory and mirrored to localStorage so the
 * session survives page reloads without refresh-token endpoints.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// ── Token storage (in-memory) ─────────────────────────────

let accessToken: string | null = null;
let currentUser: User | null = null;
const ACCESS_TOKEN_KEY = 'gf_access';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  telegramLinked: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface PatResponse {
  id: string;
  name: string;
  token?: string;       // shown only once on creation
  scopes: string;
  expiresAt: string | null;
  createdAt?: string;
}

export interface JobStatus {
  jobId: string;
  status: string;
  queuePosition?: number;
  conversionChain: string;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  errorStage?: string;
  warnings?: string[];
}

export type ConversionChain = 'MD_TO_DOCX' | 'MD_TO_DOCX_TO_PDF' | 'DOCX_TO_MD';

export interface PublicConversionBoardItem {
  publicId: string;
  status: string;
  conversionChain: string;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
  warningCount: number;
  hasError: boolean;
}

export interface PublicConversionBoard {
  generatedAt: string;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalUsers: number;
  registeredLast24h: number;
  registeredLast30d: number;
  submittedLast24h: number;
  completedLast24h: number;
  failedLast24h: number;
  recent: PublicConversionBoardItem[];
}

// ── Auth-expired callback ─────────────────────────────────

let onAuthExpiredCallback: (() => void) | null = null;

export function onAuthExpired(cb: () => void): () => void {
  onAuthExpiredCallback = cb;
  return () => {
    if (onAuthExpiredCallback === cb) {
      onAuthExpiredCallback = null;
    }
  };
}

// ── Getters / setters ─────────────────────────────────────

export function getAccessToken() { return accessToken; }
export function getCurrentUser() { return currentUser; }

export function restoreAccessTokenFromStorage(): string | null {
  try {
    const stored = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (stored && stored !== 'undefined' && stored !== 'null') {
      accessToken = stored;
      return stored;
    }
  } catch { /* ignore */ }
  return null;
}

export function setAuth(auth: AuthResponse) {
  accessToken = auth.accessToken;
  currentUser = auth.user;
  try { localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken); } catch { /* ignore */ }
}

export function clearAuth() {
  accessToken = null;
  currentUser = null;
  try { localStorage.removeItem(ACCESS_TOKEN_KEY); } catch { /* ignore */ }
}

// ── HTTP helpers ──────────────────────────────────────────

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = opts.headers
    ? { ...(opts.headers as Record<string, string>) }
    : {};

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (!headers['Content-Type'] && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...opts, headers, credentials: 'include' });

  if (res.status === 401) {
    const isAuthEndpoint = path.includes('/auth/login') || path.includes('/auth/register') || path.includes('/auth/telegram');
    if (!isAuthEndpoint) {
      clearAuth();
      if (onAuthExpiredCallback) onAuthExpiredCallback();
    }
    throw await buildError(res);
  }

  if (!res.ok) throw await buildError(res);
  if (res.status === 204) return null as T;
  return res.json();
}

async function requestBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(url, { headers, credentials: 'include' });
  if (res.status === 401) {
    clearAuth();
    if (onAuthExpiredCallback) onAuthExpiredCallback();
    throw new Error('Session expired, please log in again');
  }

  if (!res.ok) throw await buildError(res);

  const cd = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";\s]+)"?/.exec(cd);
  const filename = match?.[1] || 'output';

  return { blob: await res.blob(), filename };
}

async function buildError(res: Response): Promise<Error> {
  let msg: string;
  try {
    const body = await res.json();
    msg = body.message || body.error || JSON.stringify(body);
  } catch {
    msg = res.statusText;
  }
  return new Error(`HTTP ${res.status}: ${msg}`);
}

// ── Auth API ──────────────────────────────────────────────

export async function register(
  username: string, email: string, password: string,
  displayName?: string, telegramInitData?: string,
): Promise<AuthResponse> {
  const body = await request<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username, email, password,
      displayName: displayName || null,
      telegramInitData: telegramInitData || null,
    }),
  });
  setAuth(body);
  return body;
}

export async function login(
  loginStr: string, password: string,
  telegramInitData?: string,
): Promise<AuthResponse> {
  const body = await request<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      login: loginStr, password,
      telegramInitData: telegramInitData || null,
    }),
  });
  setAuth(body);
  return body;
}

export async function logout(): Promise<void> {
  clearAuth();
}

// ── Mini App Auth ─────────────────────────────────────────

export async function miniAppAuth(initData: string): Promise<AuthResponse> {
  const body = await request<AuthResponse>('/api/v1/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  });
  setAuth(body);
  return body;
}

// ── Profile ───────────────────────────────────────────────

export async function getProfile(): Promise<User> {
  const user = await request<User>('/api/v1/users/me');
  currentUser = user;
  return user;
}

// ── PAT ───────────────────────────────────────────────────

export async function createPat(name: string, scopes: string): Promise<PatResponse> {
  return request<PatResponse>('/api/v1/users/me/tokens', {
    method: 'POST',
    body: JSON.stringify({ name, scopes }),
  });
}

export async function listPats(): Promise<PatResponse[]> {
  return request<PatResponse[]>('/api/v1/users/me/tokens');
}

export async function revokePat(id: string): Promise<void> {
  await request(`/api/v1/users/me/tokens/${id}`, { method: 'DELETE' });
}

// ── Telegram link ─────────────────────────────────────────

export async function getTelegramLinkCode(): Promise<{ code: string }> {
  return request('/api/v1/users/me/telegram/link-code');
}

export async function unlinkTelegram(): Promise<void> {
  await request('/api/v1/users/me/telegram/unlink', { method: 'POST' });
  if (currentUser) currentUser.telegramLinked = false;
}

// ── Conversion ────────────────────────────────────────────

export async function submitConversion(
  file: File,
  conversionChain: ConversionChain,
): Promise<{ jobId: string; status: string }> {
  const fd = new FormData();
  const multipartField = conversionChain === 'DOCX_TO_MD' ? 'file' : 'archive';
  fd.append(multipartField, file, file.name);
  fd.append('conversionChain', conversionChain);
  fd.append('options', JSON.stringify({ conversionChain, syntaxHighlighting: true }));
  return request('/api/v1/conversions', { method: 'POST', body: fd });
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return request(`/api/v1/conversions/${jobId}`);
}

export async function downloadResult(jobId: string, format: string): Promise<{ blob: Blob; filename: string }> {
  const normalizedFormat = format.trim().toLowerCase();
  if (!['docx', 'pdf', 'zip'].includes(normalizedFormat)) {
    throw new Error('Unsupported result format');
  }
  return requestBlob(`/api/v1/conversions/${jobId}/result?format=${encodeURIComponent(normalizedFormat)}`);
}

export async function getPublicConversionBoard(limit = 20): Promise<PublicConversionBoard> {
  return request(`/api/v1/conversions/public/board?limit=${encodeURIComponent(String(limit))}`);
}
