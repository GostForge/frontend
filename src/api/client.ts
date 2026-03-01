/**
 * GostForge API client with automatic token refresh.
 *
 * Access token: kept in memory (not localStorage).
 * Refresh token: stored in Telegram.CloudStorage when in Mini App,
 *                otherwise relies on HttpOnly cookie from backend.
 *                Also kept in memory for explicit refresh calls.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// ── Token storage (in-memory) ─────────────────────────────

let accessToken: string | null = null;
let refreshToken: string | null = null;
let currentUser: User | null = null;

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  telegramLinked: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
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
  outputFormat: string;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  errorStage?: string;
  warnings?: string[];
}

// ── Auth-expired callback ─────────────────────────────────

let onAuthExpiredCallback: (() => void) | null = null;

export function onAuthExpired(cb: () => void) { onAuthExpiredCallback = cb; }

// ── Getters / setters ─────────────────────────────────────

export function getAccessToken() { return accessToken; }
export function getRefreshToken() { return refreshToken; }
export function setRefreshToken(rt: string) { refreshToken = rt; }
export function getCurrentUser() { return currentUser; }

export function setAuth(auth: AuthResponse) {
  accessToken = auth.accessToken;
  refreshToken = auth.refreshToken;
  currentUser = auth.user;
  if (isMiniApp()) {
    saveTelegramCloudStorage(auth.refreshToken);
  } else {
    try { localStorage.setItem('gf_refresh', auth.refreshToken); } catch { /* ignore */ }
  }
}

export function clearAuth() {
  accessToken = null;
  refreshToken = null;
  currentUser = null;
  clearTelegramCloudStorage();
  try { localStorage.removeItem('gf_refresh'); } catch { /* ignore */ }
}

// ── Telegram CloudStorage helpers ─────────────────────────

function isMiniApp(): boolean {
  return !!(window as any).Telegram?.WebApp?.initData;
}

function saveTelegramCloudStorage(rt: string) {
  if (!isMiniApp()) return;
  try {
    (window as any).Telegram.WebApp.CloudStorage.setItem('gf_refresh', rt);
  } catch { /* ignore */ }
}

function clearTelegramCloudStorage() {
  if (!isMiniApp()) return;
  try {
    (window as any).Telegram.WebApp.CloudStorage.removeItem('gf_refresh');
  } catch { /* ignore */ }
}

export function loadRefreshFromCloudStorage(): Promise<string | null> {
  if (isMiniApp()) {
    return new Promise((resolve) => {
      try {
        (window as any).Telegram.WebApp.CloudStorage.getItem('gf_refresh', (_err: any, val: string) => {
          resolve(val || null);
        });
      } catch {
        resolve(null);
      }
    });
  }
  // Regular web — try localStorage
  try {
    const val = localStorage.getItem('gf_refresh');
    return Promise.resolve(val || null);
  } catch {
    return Promise.resolve(null);
  }
}

// ── HTTP helpers ──────────────────────────────────────────

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> || {}) };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (!headers['Content-Type'] && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...opts, headers, credentials: 'include' });

  // Auto-refresh on 401
  if (res.status === 401 && refreshToken) {
    const refreshed = await doRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retry = await fetch(url, { ...opts, headers, credentials: 'include' });
      if (!retry.ok) throw await buildError(retry);
      if (retry.status === 204) return null as T;
      return retry.json();
    }
    // Refresh failed — session expired, force logout
    if (onAuthExpiredCallback) onAuthExpiredCallback();
    throw new Error('Session expired, please log in again');
  }

  if (res.status === 401) {
    // No refresh token available
    clearAuth();
    if (onAuthExpiredCallback) onAuthExpiredCallback();
    throw new Error('Session expired, please log in again');
  }

  if (!res.ok) throw await buildError(res);
  if (res.status === 204) return null as T;
  return res.json();
}

async function requestBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(url, { headers, credentials: 'include' });

  // Auto-refresh on 401
  if (res.status === 401 && refreshToken) {
    const refreshed = await doRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(url, { headers, credentials: 'include' });
    } else {
      if (onAuthExpiredCallback) onAuthExpiredCallback();
      throw new Error('Session expired, please log in again');
    }
  } else if (res.status === 401) {
    clearAuth();
    if (onAuthExpiredCallback) onAuthExpiredCallback();
    throw new Error('Session expired, please log in again');
  }

  if (!res.ok) throw await buildError(res);

  const cd = res.headers.get('Content-Disposition') || '';
  const match = cd.match(/filename="?([^";\s]+)"?/);
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

async function doRefresh(): Promise<boolean> {
  try {
    const body: AuthResponse = await request('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    setAuth(body);
    return true;
  } catch {
    clearAuth();
    return false;
  }
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

export async function refresh(): Promise<AuthResponse> {
  const body = await request<AuthResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  setAuth(body);
  return body;
}

export async function logout(): Promise<void> {
  try {
    await request('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  } finally {
    clearAuth();
  }
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

export async function submitConversion(file: File, outputFormat: string): Promise<{ jobId: string; status: string }> {
  const fd = new FormData();
  fd.append('archive', file);
  fd.append('options', JSON.stringify({ outputFormat, syntaxHighlighting: true }));
  return request('/api/v1/convert/quick', { method: 'POST', body: fd });
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return request(`/api/v1/convert/quick/jobs/${jobId}`);
}

export async function downloadResult(jobId: string, format: string): Promise<{ blob: Blob; filename: string }> {
  return requestBlob(`/api/v1/convert/quick/jobs/${jobId}/download/${format}`);
}

export function createSSE(jobId: string): EventSource {
  const url = `${API_BASE}/api/v1/convert/quick/jobs/${jobId}/stream`;
  return new EventSource(url, { withCredentials: true });
}
