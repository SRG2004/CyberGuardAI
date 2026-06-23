const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const REQUEST_TIMEOUT_MS = 20_000;

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta?: { page: number; total: number; limit: number };
  error?: ApiError;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('accessToken');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE}${path}`, {
      ...options,
      credentials: 'include',
      signal: options.signal ?? controller.signal,
      headers: { ...headers, ...('headers' in options ? (options.headers as Record<string, string>) : {}) },
    });

    const contentType = response.headers.get('content-type') || '';
    const json = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok || !json?.success) {
      const err = new Error(json?.error?.message || `Request failed with HTTP ${response.status}`) as Error & { code?: string };
      err.code = json?.error?.code || String(response.status);
      throw err;
    }

    return json;
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.name === 'AbortError') {
      err.message = 'Request timed out. Please try again.';
      err.code = 'TIMEOUT';
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function multipartPost<T>(path: string, body: FormData) {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('accessToken');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body,
  }).then(r => r.json());
}

const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
  multipartPost,
};

export default api;
