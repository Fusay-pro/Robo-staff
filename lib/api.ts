import axios, { type InternalAxiosRequestConfig } from 'axios';
import { errorKind, errorStatus, shouldToast } from './errors.ts';
import { emitToast } from './toastBus.ts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const client = axios.create({
  baseURL: API_URL,
  headers: { 'ngrok-skip-browser-warning': 'true' },
});

function parseHost(url: string): string {
  try { return new URL(url).host; } catch { return ''; }
}
const API_HOST = parseHost(API_URL);

function expireSession() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/login';
}

// Refresh tokens are single-use. Background queries and session restoration
// must wait for the same renewal instead of racing to consume that token.
let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const refresh_token = localStorage.getItem('refresh_token');
  if (!refresh_token) {
    expireSession();
    return Promise.reject(new Error('Session expired'));
  }

  refreshPromise = axios.post<{ access_token: string; refresh_token: string }>(
    `${API_URL}/auth/refresh`,
    { refresh_token },
    { headers: { 'ngrok-skip-browser-warning': 'true' } },
  ).then(({ data }) => {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    return data.access_token;
  }).catch((error: unknown) => {
    // A network/proxy outage is not an expired session. Let the query show its
    // error and retry without erasing credentials or reloading an open dialog.
    if (axios.isAxiosError(error) && error.response?.status === 401) expireSession();
    throw error;
  }).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  const reqHost = config.url?.startsWith('http') ? parseHost(config.url) : API_HOST;
  if (token && reqHost === API_HOST) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  res => res,
  async (error) => {
    if (!error.config) return Promise.reject(error);
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original.url?.includes('/auth/')) {
      if (original._retry) {
        expireSession();
        return Promise.reject(error);
      }
      original._retry = true;

      // Another request may have renewed the session while this old-token
      // response was in flight. Retry with that token without renewing again.
      const currentToken = localStorage.getItem('access_token');
      if (currentToken && original.headers.Authorization !== `Bearer ${currentToken}`) {
        original.headers.Authorization = `Bearer ${currentToken}`;
        return client(original);
      }

      let accessToken: string;
      try {
        accessToken = await refreshAccessToken();
      } catch (renewalError) {
        // This throw leaves the interceptor above its toast line, so without
        // reporting here the most important failure of all — the tunnel being
        // down — would be the silent one. A 401 on the renewal is different:
        // the session is genuinely over and expireSession is already
        // navigating to /login, which is the message.
        if (errorStatus(renewalError) !== 401) {
          emitToast({ tone: 'error', error: errorKind(renewalError) });
        }
        throw renewalError;
      }
      original.headers.Authorization = `Bearer ${accessToken}`;
      return client(original);
    }
    // Anything still failing here is reported, whether or not the caller
    // handles it. An interceptor cannot know if its caller shows the error,
    // and the alternative — an opt-out threaded through every call site —
    // costs more than the mild duplication of a toast beside an inline
    // message. 401s, the refresh call and cancellations are excluded.
    if (shouldToast(error)) emitToast({ tone: 'error', error: errorKind(error) });

    return Promise.reject(error);
  }
);

export default client;
