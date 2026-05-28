'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { decodeJwt, isExpired, getAccessToken, setTokens, clearTokens } from '@/lib/auth';
import client from '@/lib/api';

interface AuthContextValue {
  token: string | null;
  role: string | null;
  userId: number | null;
  name: string | null;
  loading: boolean;
  signIn: (access: string, refresh: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialAccess = getAccessToken();
  const initialPayload = initialAccess && !isExpired(initialAccess) ? decodeJwt(initialAccess) : null;

  const [token, setToken] = useState<string | null>(initialPayload ? initialAccess : null);
  const [role, setRole] = useState<string | null>(initialPayload?.role ?? null);
  const [userId, setUserId] = useState<number | null>(initialPayload?.sub ?? null);
  const [name, setName] = useState<string | null>(initialPayload?.name ?? null);
  const [loading, setLoading] = useState<boolean>(() => {
    if (!initialAccess) return false;
    return isExpired(initialAccess);
  });

  useEffect(() => {
    const access = getAccessToken();
    const refresh = localStorage.getItem('refresh_token');
    if (!access || !isExpired(access)) return;

    if (refresh) {
      client.post('/auth/refresh', { refresh_token: refresh })
        .then(({ data }) => {
          setTokens(data.access_token, data.refresh_token);
          const payload = decodeJwt(data.access_token);
          setToken(data.access_token);
          setRole(payload?.role ?? null);
          setUserId(payload?.sub ?? null);
          setName(payload?.name ?? null);
        })
        .catch(() => clearTokens())
        .finally(() => setLoading(false));
    } else {
      clearTokens();
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  const signIn = (access: string, refresh: string) => {
    setTokens(access, refresh);
    const payload = decodeJwt(access);
    setToken(access);
    setRole(payload?.role ?? null);
    setUserId(payload?.sub ?? null);
    setName(payload?.name ?? null);
  };

  const signOut = () => {
    clearTokens();
    setToken(null);
    setRole(null);
    setUserId(null);
    setName(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, userId, name, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
