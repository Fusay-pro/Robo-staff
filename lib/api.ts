import axios, { InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.1.104:3000';
const client = axios.create({ baseURL: API_URL });

function parseHost(url: string): string {
  try { return new URL(url).host; } catch { return ''; }
}
const API_HOST = parseHost(API_URL);

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
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh_token = localStorage.getItem('refresh_token');
      if (refresh_token) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token });
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return client(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
