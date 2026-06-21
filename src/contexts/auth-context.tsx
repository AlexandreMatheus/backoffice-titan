'use client';

import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { setupAutoRefresh } from '@/lib/auth/auto-refresh';

const BO_ACCESS_TOKEN_KEY = 'atlas_bo_access_token';
const BO_REFRESH_TOKEN_KEY = 'atlas_bo_refresh_token';
const BO_USER_KEY = 'atlas_bo_user';

interface User {
  id: string;
  email: string;
  full_name?: string;
  user_type?: 'admin' | 'trainer' | 'student';
  status?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  accessToken: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshCleanupRef = useRef<(() => void) | null>(null);
  const router = useRouter();

  const startAutoRefresh = useCallback((onToken: (t: string) => void) => {
    refreshCleanupRef.current?.();
    refreshCleanupRef.current = setupAutoRefresh(onToken);
  }, []);

  useEffect(() => {
    let cancelled = false;

    try {
      const token = localStorage.getItem(BO_ACCESS_TOKEN_KEY);
      const userData = localStorage.getItem(BO_USER_KEY);

      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData) as User;
          if (!cancelled) {
            setAccessToken(token);
            setUser(parsedUser);
            startAutoRefresh((newToken) => {
              setAccessToken(newToken);
            });
          }
        } catch {
          localStorage.removeItem(BO_ACCESS_TOKEN_KEY);
          localStorage.removeItem(BO_REFRESH_TOKEN_KEY);
          localStorage.removeItem(BO_USER_KEY);
        }
      }
    } catch (err) {
      console.error('Error restoring session:', err);
    }

    setIsLoading(false);

    return () => {
      cancelled = true;
      refreshCleanupRef.current?.();
      refreshCleanupRef.current = null;
    };
  }, [startAutoRefresh]);

  const login = useCallback(async (email: string, password: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const contentType = response.headers.get('content-type') ?? '';
      const rawBody = await response.text();
      let data: Record<string, unknown> = {};

      if (contentType.includes('application/json') && rawBody) {
        try {
          data = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          throw new Error('Resposta inválida do servidor. Tente novamente.');
        }
      }

      if (!response.ok) {
        const msg = (data.message as string) || 'Erro ao fazer login.';
        if (response.status === 403) {
          throw new Error('Acesso negado. Você não tem permissão de administrador.');
        }
        throw new Error(msg);
      }

      const { access_token, refresh_token, user: userData } = data as {
        access_token: string;
        refresh_token: string;
        user: User;
      };

      localStorage.setItem(BO_ACCESS_TOKEN_KEY, access_token);
      localStorage.setItem(BO_REFRESH_TOKEN_KEY, refresh_token);
      localStorage.setItem(BO_USER_KEY, JSON.stringify(userData));

      setAccessToken(access_token);
      setUser(userData);

      startAutoRefresh((newToken) => {
        setAccessToken(newToken);
      });

      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido.';
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [startAutoRefresh, router]);

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem(BO_ACCESS_TOKEN_KEY);
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            refresh_token: localStorage.getItem(BO_REFRESH_TOKEN_KEY),
          }),
        }).catch(() => {});
      }
    } finally {
      localStorage.removeItem(BO_ACCESS_TOKEN_KEY);
      localStorage.removeItem(BO_REFRESH_TOKEN_KEY);
      localStorage.removeItem(BO_USER_KEY);

      refreshCleanupRef.current?.();
      refreshCleanupRef.current = null;

      setUser(null);
      setAccessToken(null);

      router.push('/login');
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSubmitting,
        isAuthenticated: !!user && !!accessToken,
        login,
        logout,
        error,
        accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
