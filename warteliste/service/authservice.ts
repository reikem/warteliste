/**
 * QueueMaster Pro — Auth Service
 * Ubicación: service/authservice.ts
 */

import * as SecureStore from 'expo-secure-store';
import { getDatabase, User, UserRole } from './database';
import { generateToken, hashPassword } from './crypto';


const SESSION_KEY   = 'qm_session_token';
const SESSION_HOURS = 8;
const SALT          = 'queuemaster_salt_2026';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  station: string | null;
  avatar_url: string | null;
}

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
  station?: string;
}

// ─── Seguridad ────────────────────────────────────────────────────────────────



function sessionExpiry(): string {
  const d = new Date();
  d.setHours(d.getHours() + SESSION_HOURS);
  return d.toISOString();
}

// ─── Auditoría ────────────────────────────────────────────────────────────────

export function logAudit(action: string, entity: string, userId?: number, entityId?: number, details?: string) {
  try {
    getDatabase().runSync(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [userId ?? null, action, entity, entityId ?? null, details ?? null]
    );
  } catch (e) { console.warn('[Audit]', e); }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    if (!email.trim() || !password.trim()) return { success: false, error: 'Completa todos los campos.' };
    const db   = getDatabase();
    const hash = await hashPassword(password);
    const user = db.getFirstSync<User>(`SELECT * FROM users WHERE email = ? COLLATE NOCASE AND is_active = 1`, [email.trim()]);

    if (!user) return { success: false, error: 'Usuario no encontrado o inactivo.' };
    if (user.password_hash !== hash) {
        console.log('=== DEBUG LOGIN ===');
console.log('Email ingresado:', email.trim());
console.log('Hash generado en login:', hash);
console.log('Hash guardado en BD:', user?.password_hash);
console.log('¿Coinciden?', user?.password_hash === hash);
console.log('User encontrado:', JSON.stringify(user));
console.log('==================');
      logAudit('LOGIN_FAILED', 'users', undefined, user.id, email);
      return { success: false, error: 'Contraseña incorrecta.' };
    }

    const token = generateToken();
    db.runSync(`DELETE FROM sessions WHERE user_id = ?`, [user.id]);
    db.runSync(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`, [user.id, token, sessionExpiry()]);
    db.runSync(`UPDATE users SET last_login = datetime('now') WHERE id = ?`, [user.id]);
    await SecureStore.setItemAsync(SESSION_KEY, token);
    logAudit('LOGIN_SUCCESS', 'users', user.id, user.id, email);

    return { success: true, token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, station: user.station, avatar_url: user.avatar_url } };
  } catch (e) {
    console.error('[Auth] login:', e);
    return { success: false, error: 'Error interno.' };
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(userId?: number): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(SESSION_KEY);
    if (token) getDatabase().runSync(`DELETE FROM sessions WHERE token = ?`, [token]);
    await SecureStore.deleteItemAsync(SESSION_KEY);
    if (userId) logAudit('LOGOUT', 'users', userId, userId);
  } catch (e) { console.error('[Auth] logout:', e); }
}

// ─── Restaurar sesión ─────────────────────────────────────────────────────────

export async function restoreSession(): Promise<AuthUser | null> {
  try {
    const token = await SecureStore.getItemAsync(SESSION_KEY);
    if (!token) return null;
    const db      = getDatabase();
    const session = db.getFirstSync<{ user_id: number; expires_at: string }>(`SELECT user_id, expires_at FROM sessions WHERE token = ?`, [token]);
    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) {
      db.runSync(`DELETE FROM sessions WHERE token = ?`, [token]);
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
    const user = db.getFirstSync<User>(`SELECT * FROM users WHERE id = ? AND is_active = 1`, [session.user_id]);
    if (!user) return null;
    db.runSync(`UPDATE sessions SET expires_at = ? WHERE token = ?`, [sessionExpiry(), token]);
    return { id: user.id, email: user.email, full_name: user.full_name, role: user.role, station: user.station, avatar_url: user.avatar_url };
  } catch (e) { console.error('[Auth] restoreSession:', e); return null; }
}

// ─── Registro ─────────────────────────────────────────────────────────────────

export async function registerUser(input: RegisterInput): Promise<LoginResult> {
  try {
    if (!input.email.trim() || !input.password.trim() || !input.full_name.trim())
      return { success: false, error: 'Todos los campos son obligatorios.' };
    if (input.password.length < 6)
      return { success: false, error: 'Contraseña mínimo 6 caracteres.' };

    const db = getDatabase();
    const existing = db.getFirstSync<{ id: number }>(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`, [input.email.trim()]);
    if (existing) return { success: false, error: 'Este correo ya está registrado.' };

    const hash   = await hashPassword(input.password);
    const result = db.runSync(
      `INSERT INTO users (email, password_hash, full_name, role, station) VALUES (?, ?, ?, ?, ?)`,
      [input.email.trim().toLowerCase(), hash, input.full_name.trim(), input.role ?? 'employee', input.station ?? null]
    );
    logAudit('USER_CREATED', 'users', result.lastInsertRowId, result.lastInsertRowId, input.email);
    return login(input.email, input.password);
  } catch (e) { return { success: false, error: 'Error al crear usuario.' }; }
}

// ─── Cambio de contraseña ─────────────────────────────────────────────────────

export async function changePassword(userId: number, current: string, next: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db   = getDatabase();
    const user = db.getFirstSync<User>(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!user) return { success: false, error: 'Usuario no encontrado.' };
    const currentHash = await hashPassword(current);
    if (currentHash !== user.password_hash) return { success: false, error: 'Contraseña actual incorrecta.' };
    if (next.length < 6) return { success: false, error: 'Nueva contraseña mínimo 6 caracteres.' };
    const newHash = await hashPassword(next);
    db.runSync(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, userId]);
    logAudit('PASSWORD_CHANGED', 'users', userId, userId);
    return { success: true };
  } catch (e) { return { success: false, error: 'Error al cambiar contraseña.' }; }
}

export function getAllUsers() {
  return getDatabase().getAllSync<User>(`SELECT * FROM users WHERE is_active = 1 ORDER BY role, full_name`);
}