/**
 * Warteliste — Auth Context
 * Compatible con AuthUser que ahora incluye uuid_id y company_id.
 * setUser ANTES de setIsLoading(false) → evita loop de redirect en AuthGate.
 *
 * Ubicación: store/authcontext.tsx
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import { initializeDatabase } from '../service/database';
import {
  login as dbLogin,
  logout as dbLogout,
  restoreSession,
  registerUser,
  changePassword,
  type AuthUser,
  type LoginResult,
  type RegisterInput,
} from '../service/authservice';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user:            AuthUser | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
  dbReady:         boolean;
  login:           (email: string, password: string) => Promise<LoginResult>;
  logout:          () => Promise<void>;
  register:        (input: RegisterInput) => Promise<LoginResult>;
  changePassword:  (current: string, next: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser:     () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [isLoading, setLoad]  = useState(true);
  const [dbReady, setDbReady] = useState(false);

  // Bootstrap al arrancar
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        await initializeDatabase();
        if (!cancelled) setDbReady(true);

        const restored = await restoreSession();

        if (!cancelled) {
          // ⚠️ ORDEN CRÍTICO: setUser primero, luego setIsLoading(false)
          // Si se invierte, AuthGate ve isLoading=false con user=null por un frame
          // y hace router.replace('/login') causando el loop.
          setUser(restored);
          setLoad(false);
        }
      } catch (e) {
        console.error('[Auth] bootstrap:', e);
        if (!cancelled) setLoad(false);
      }
    }

    bootstrap();
    return () => { cancelled = true; };
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      // No usamos isLoading global aquí — la pantalla de login tiene su propio spinner
      const result = await dbLogin(email, password);
      if (result.success && result.user) setUser(result.user);
      return result;
    },
    [],
  );

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    await dbLogout(user?.id);
    setUser(null);
  }, [user]);

  // ── Registro ──────────────────────────────────────────────────────────────

  const register = useCallback(
    async (input: RegisterInput): Promise<LoginResult> => {
      const result = await registerUser(input);
      if (result.success && result.user) setUser(result.user);
      return result;
    },
    [],
  );

  // ── Cambio de contraseña ──────────────────────────────────────────────────

  const handleChangePassword = useCallback(
    async (current: string, next: string) => {
      if (!user) return { success: false, error: 'No hay sesión activa.' };
      return changePassword(user.id, current, next);
    },
    [user],
  );

  // ── Refresh ───────────────────────────────────────────────────────────────

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