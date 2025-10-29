const runtimeBackendUrl = import.meta.env.VITE_BACKEND_URL?.trim();
const fallbackBackendUrl = import.meta.env.VITE_BACKEND_FALLBACK?.trim();

function deriveBackendFromLocation(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const { protocol, host, hostname } = window.location;
  if (!hostname) {
    return null;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const port = host.includes(':') ? host.split(':')[1] : '5173';
    const backendPort = port === '5173' ? '4000' : port;
    return `${protocol}//${hostname}:${backendPort}`;
  }

  const renderLike = hostname.match(/^([a-z0-9-]+?)(?:-frontend)?(?:-[\w-]+)?\.vercel\.app$/i);
  if (renderLike?.[1]) {
    return `https://${renderLike[1]}.onrender.com`;
  }

  return null;
}

function normalizeBase(base: string): string {
  const trimmed = base.replace(/\/+$/u, '');
  if (trimmed.toLowerCase().endsWith('/api')) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

function resolveApiBase(): string {
  const candidate =
    runtimeBackendUrl ||
    fallbackBackendUrl ||
    deriveBackendFromLocation();

  if (!candidate) {
    return '/api';
  }

  return normalizeBase(candidate);
}

const API_BASE = resolveApiBase();

export function getApiBase(): string {
  return API_BASE;
}

export interface ApiRequestOptions extends RequestInit {
  accessToken?: string | null;
  userId?: string | null;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { accessToken, userId, headers, ...init } = options;
  const finalHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (accessToken) {
    finalHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  if (userId) {
    finalHeaders['X-User-ID'] = userId;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: finalHeaders,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : `Request to ${path} failed`;
    throw new Error(message);
  }

  return data as T;
}
