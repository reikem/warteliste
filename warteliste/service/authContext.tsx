/**
 * QueueMaster Pro — Auth Context
 * Fix crítico: setUser() ANTES de setIsLoading(false)
 * Ubicación: service/authContext.tsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initializeDatabase } from './database';
import { login as dbLogin, logout as dbLogout, restoreSession, registerUser, changePassword, AuthUser, LoginResult, RegisterInput } from './authservice';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  dbReady: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  register: (input: RegisterInput) => Promise<LoginResult>;
  changePassword: (current: string, next: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dbReady, setDbReady]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        await initializeDatabase();
        if (!cancelled) setDbReady(true);
        const restored = await restoreSession();
        if (!cancelled) {
          setUser(restored);       // ← primero usuario
          setIsLoading(false);     // ← luego loading=false (evita loop)
        }
      } catch (e) {
        console.error('[Auth] bootstrap:', e);
        if (!cancelled) setIsLoading(false);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const result = await dbLogin(email, password);
    if (result.success && result.user) setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await dbLogout(user?.id);
    setUser(null);
  }, [user]);

  const register = useCallback(async (input: RegisterInput): Promise<LoginResult> => {
    const result = await registerUser(input);
    if (result.success && result.user) setUser(result.user);
    return result;
  }, []);

  const handleChangePassword = useCallback(async (current: string, next: string) => {
    if (!user) return { success: false, error: 'No hay sesión activa.' };
    return changePassword(user.id, current, next);
  }, [user]);

  const refreshUser = useCallback(async () => {
    const restored = await restoreSession();
    setUser(restored);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, dbReady, login, logout, register, changePassword: handleChangePassword, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}