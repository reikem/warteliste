/**
 * QueueMaster Pro — Auth Context
 * Proveedor global de autenticación para toda la app.
 *
 * Uso en componentes:
 *   const { user, login, logout, isLoading } = useAuth();
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as dbLogin,
  logout as dbLogout,
  restoreSession,
  registerUser,
  changePassword,
  AuthUser,
  LoginResult,
  RegisterInput,
} from '../service/authservice';
import { initializeDatabase, resetDatabase } from '../service/database';

// ─── Tipos del contexto ───────────────────────────────────────────────────────

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

// ─── Contexto ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);

  // Inicializar BD y restaurar sesión al arrancar
  useEffect(() => {
    async function bootstrap() {
      try {
       // await resetDatabase()
        await initializeDatabase();
        setDbReady(true);

        const restored = await restoreSession();
        if (restored) {
          setUser(restored);
        }
      } catch (e) {
        console.error('[Auth] Error al inicializar:', e);
      } finally {
        setIsLoading(false);
      }
    }
    bootstrap();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const result = await dbLogin(email, password);
      if (result.success && result.user) {
        setUser(result.user);
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await dbLogout(user?.id);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const register = useCallback(async (input: RegisterInput): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const result = await registerUser(input);
      if (result.success && result.user) {
        setUser(result.user);
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChangePassword = useCallback(
    async (current: string, next: string) => {
      if (!user) return { success: false, error: 'No hay sesión activa.' };
      return changePassword(user.id, current, next);
    },
    [user]
  );

  const refreshUser = useCallback(async () => {
    const restored = await restoreSession();
    setUser(restored);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        dbReady,
        login,
        logout,
        register,
        changePassword: handleChangePassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}