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
import * as SecureStore from 'expo-secure-store';
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
    let cancelled = false;
  
    async function bootstrap() {
      try {
        const fixed = await SecureStore.getItemAsync('db_hash_fixed_v4');
        if (!fixed) {
          await resetDatabase();
          await SecureStore.setItemAsync('db_hash_fixed_v4', '1');
        }
        await initializeDatabase();
        if (!cancelled) setDbReady(true);
        const restored = await restoreSession();
        if (!cancelled) {
          setUser(restored);
          setIsLoading(false);
        }
      } catch (e) {
        console.error('[Auth] bootstrap error:', e);
        if (!cancelled) setIsLoading(false);
      }
    }
  //**  Esto usar cuando la función resetDatabase ya no hace initialize, para evitar doble inicialización
  //async function bootstrap() {
  //  try {
   //   console.log('[Auth] bootstrap iniciado');
    //  await resetDatabase();        // solo resetea, no inicializa
     // console.log('[Auth] Reset completado');
     // await initializeDatabase();   // una sola vez aquí
     // if (!cancelled) setDbReady(true);
      //const restored = await restoreSession();
      //if (!cancelled) {
       // setUser(restored);
        //setIsLoading(false);
     // }
   // } catch (e) {
     // console.error('[Auth] bootstrap error:', e);
      //if (!cancelled) setIsLoading(false);
   // }
 // }
  //  */
    bootstrap();
    return () => { cancelled = true; };
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