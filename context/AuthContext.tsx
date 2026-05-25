'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { decodeJwt, isExpired, getAccessToken, setTokens, clearTokens } from '@/lib/auth';
import client from '@/lib/api';

interface AuthContextValue {
  token: string | null;
  role: string | null;
  userId: number | null;
  loading: boolean;
  signIn: (access: string, refresh: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const access = getAccessToken();
    const refresh = localStorage.getItem('refresh_token');
    if (!access) { setLoading(false); return; }
    if (!isExpired(access)) {
      const payload = decodeJwt(access);
      setToken(access); setRole(payload?.role ?? null); setUserId(payload?.sub ?? null);
      setLoading(false); return;
    }
    if (refresh) {
      client.post('/auth/refresh', { refresh_token: refresh })
        .then(({ data }) => {
          setTokens(data.access_token, data.refresh_token);
          const payload = decodeJwt(data.access_token);
          setToken(data.access_token); setRole(payload?.role ?? null); setUserId(payload?.sub ?? null);
        })
        .catch(() => clearTokens())
        .finally(() => setLoading(false));
    } else { clearTokens(); setLoading(false); }
  }, []);

  const signIn = (access: string, refresh: string) => {
    setTokens(access, refresh);
    const payload = decodeJwt(access);
    setToken(access); setRole(payload?.role ?? null); setUserId(payload?.sub ?? null);
  };

  const signOut = () => { clearTokens(); setToken(null); setRole(null); setUserId(null); };

  return (
    <AuthContext.Provider value={{ token, role, userId, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
