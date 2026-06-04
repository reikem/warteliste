/**
 * Warteliste — Auth Service v3
 * DUAL WRITE con UUID: usa uuid_id de las filas locales para Supabase.
 *
 * Ubicación: service/authservice.ts
 */

import * as SecureStore from 'expo-secure-store';
import { getDatabase, User, UserRole } from './database';
import { generateToken, hashPassword } from './crypto';
import { syncToSupabase, generateUUID } from './syncService';

const SESSION_KEY   = 'qm_session_token';
const SESSION_HOURS = 8;

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number; uuid_id: string; company_id: number;
  email: string; full_name: string; role: UserRole;
  station: string | null; avatar_url: string | null;
}

export interface LoginResult {
  success: boolean; user?: AuthUser; token?: string; error?: string;
}

export interface RegisterInput {
  email: string; password: string; full_name: string;
  role?: UserRole; station?: string;
  company_name?: string; company_slug?: string; company_color?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sessionExpiry(): string {
  const d = new Date();
  d.setHours(d.getHours() + SESSION_HOURS);
  return d.toISOString();
}

function companyUuid(companyId: number): string | null {
  try {
    return getDatabase().getFirstSync<{ uuid_id: string }>(
      `SELECT uuid_id FROM companies WHERE id=?`, [companyId]
    )?.uuid_id ?? null;
  } catch { return null; }
}

export function logAudit(action: string, entity: string, userId?: number, entityId?: number, details?: string): void {
  try {
    getDatabase().runSync(
      `INSERT INTO audit_logs (uuid_id,company_id,user_id,action,entity,entity_id,details) VALUES (?,1,?,?,?,?,?)`,
      [generateUUID(), userId??null, action, entity, entityId??null, details??null]
    );
  } catch (e) { console.warn('[Audit]',e); }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    if (!email.trim()||!password.trim())
      return { success:false, error:'Completa todos los campos.' };

    const db   = getDatabase();
    const hash = await hashPassword(password);
    const user = db.getFirstSync<User>(
      `SELECT * FROM users WHERE email=? COLLATE NOCASE AND is_active=1`, [email.trim()]
    );

    if (!user) return { success:false, error:'Usuario no encontrado o inactivo.' };
    if (user.password_hash !== hash) {
      logAudit('LOGIN_FAILED','users',undefined,user.id,email);
      return { success:false, error:'Contraseña incorrecta.' };
    }

    const token = generateToken();
    const now   = new Date().toISOString();
    db.runSync(`DELETE FROM sessions WHERE user_id=?`,[user.id]);
    db.runSync(`INSERT INTO sessions (user_id,token,expires_at) VALUES (?,?,?)`,
      [user.id, token, sessionExpiry()]);
    db.runSync(`UPDATE users SET last_login=? WHERE id=?`,[now,user.id]);
    await SecureStore.setItemAsync(SESSION_KEY, token);

    // Sync last_login usando uuid_id
    if (user.uuid_id) {
      syncToSupabase('users','UPDATE',{ id:user.uuid_id, last_login:now }).catch(()=>{});
    }
    logAudit('LOGIN_SUCCESS','users',user.id,user.id,email);

    return {
      success:true, token,
      user: {
        id:         user.id,
        uuid_id:    user.uuid_id ?? '',
        company_id: user.company_id ?? 1,
        email:      user.email,
        full_name:  user.full_name,
        role:       user.role,
        station:    user.station,
        avatar_url: user.avatar_url,
      },
    };
  } catch(e) {
    console.error('[Auth] login:',e);
    return { success:false, error:'Error interno.' };
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(userId?: number): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(SESSION_KEY);
    if (token) getDatabase().runSync(`DELETE FROM sessions WHERE token=?`,[token]);
    await SecureStore.deleteItemAsync(SESSION_KEY);
    if (userId) logAudit('LOGOUT','users',userId,userId);
  } catch(e) { console.error('[Auth] logout:',e); }
}

// ─── Restaurar sesión ─────────────────────────────────────────────────────────

export async function restoreSession(): Promise<AuthUser | null> {
  try {
    const token = await SecureStore.getItemAsync(SESSION_KEY);
    if (!token) return null;
    const db      = getDatabase();
    const session = db.getFirstSync<{ user_id:number; expires_at:string }>(
      `SELECT user_id, expires_at FROM sessions WHERE token=?`,[token]
    );
    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) {
      db.runSync(`DELETE FROM sessions WHERE token=?`,[token]);
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
    const user = db.getFirstSync<User>(
      `SELECT * FROM users WHERE id=? AND is_active=1`,[session.user_id]
    );
    if (!user) return null;
    db.runSync(`UPDATE sessions SET expires_at=? WHERE token=?`,[sessionExpiry(),token]);
    return {
      id:         user.id,
      uuid_id:    user.uuid_id ?? '',
      company_id: user.company_id ?? 1,
      email:      user.email,
      full_name:  user.full_name,
      role:       user.role,
      station:    user.station,
      avatar_url: user.avatar_url,
    };
  } catch(e) {
    console.error('[Auth] restoreSession:',e);
    return null;
  }
}

// ─── Registro ─────────────────────────────────────────────────────────────────

export async function registerUser(input: RegisterInput): Promise<LoginResult> {
  try {
    if (!input.email.trim()||!input.password.trim()||!input.full_name.trim())
      return { success:false, error:'Todos los campos son obligatorios.' };
    if (input.password.length < 6)
      return { success:false, error:'Contraseña mínimo 6 caracteres.' };

    const db  = getDatabase();
    let coId  = 1;

    if (input.company_name) {
      const slug  = input.company_slug
        ?? input.company_name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
      const color = input.company_color ?? '#00685f';
      const now   = new Date().toISOString();

      const ex = db.getFirstSync<{ id:number }>(`SELECT id FROM companies WHERE slug=?`,[slug]);
      if (ex) return { success:false, error:`El identificador "${slug}" ya está en uso.` };

      const coUuid  = generateUUID();
      const coRes   = db.runSync(
        `INSERT INTO companies (uuid_id,name,slug,brand_color,created_at) VALUES (?,?,?,?,?)`,
        [coUuid, input.company_name.trim(), slug, color, now]
      );
      coId = coRes.lastInsertRowId;

      const cfgDefaults: [string,string][] = [
        ['brand_name',input.company_name.trim()],['brand_color',color],
        ['active_desks','6'],['auto_allocate','true'],['show_weather','true'],
        ['weather_city','chile_vina'],['monitor_sound','chime'],
        ['ticket_counter_A','0'],['ticket_counter_B','0'],['ticket_counter_C','0'],
      ];
      for (const [k,v] of cfgDefaults) {
        db.runSync(`INSERT OR IGNORE INTO company_config (company_id,key,value) VALUES (?,?,?)`,[coId,k,v]);
      }

      syncToSupabase('companies','INSERT',{
        id:coUuid, name:input.company_name.trim(), slug, brand_color:color,
        is_active:true, created_at:now,
      }).catch(()=>{});
      logAudit('COMPANY_CREATED','companies',undefined,coId,input.company_name);
    } else {
      coId = db.getFirstSync<{ id:number }>(`SELECT id FROM companies ORDER BY id ASC LIMIT 1`)?.id ?? 1;
    }

    const ex = db.getFirstSync<{ id:number }>(
      `SELECT id FROM users WHERE email=? COLLATE NOCASE AND company_id=?`,
      [input.email.trim(), coId]
    );
    if (ex) return { success:false, error:'Este correo ya está registrado.' };

    const hash    = await hashPassword(input.password);
    const now     = new Date().toISOString();
    const userUuid = generateUUID();

    const res = db.runSync(
      `INSERT INTO users (uuid_id,company_id,email,password_hash,full_name,role,station,created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [userUuid, coId, input.email.trim().toLowerCase(), hash,
       input.full_name.trim(), input.role??'employee', input.station??null, now]
    );

    syncToSupabase('users','INSERT',{
      id:userUuid, company_id: companyUuid(coId),
      email:input.email.trim().toLowerCase(),
      full_name:input.full_name.trim(),
      role:input.role??'employee',
      station:input.station??null,
      is_active:true, created_at:now,
    }).catch(()=>{});

    logAudit('USER_CREATED','users',res.lastInsertRowId,res.lastInsertRowId,input.email);
    return login(input.email, input.password);
  } catch(e:any) {
    console.error('[Auth] register:',e);
    return { success:false, error:e?.message??'Error al crear usuario.' };
  }
}

// ─── Cambio de contraseña ─────────────────────────────────────────────────────

export async function changePassword(userId:number, current:string, next:string): Promise<{ success:boolean; error?:string }> {
  try {
    const db   = getDatabase();
    const user = db.getFirstSync<User>(`SELECT * FROM users WHERE id=?`,[userId]);
    if (!user) return { success:false, error:'Usuario no encontrado.' };
    if (await hashPassword(current)!==user.password_hash)
      return { success:false, error:'Contraseña actual incorrecta.' };
    if (next.length<6) return { success:false, error:'Nueva contraseña mínimo 6 caracteres.' };
    const newHash = await hashPassword(next);
    db.runSync(`UPDATE users SET password_hash=? WHERE id=?`,[newHash,userId]);
    logAudit('PASSWORD_CHANGED','users',userId,userId);
    return { success:true };
  } catch(e) { return { success:false, error:'Error al cambiar contraseña.' }; }
}

export function getAllUsers(companyId: number): User[] {
  return getDatabase().getAllSync<User>(
    `SELECT * FROM users WHERE company_id=? AND is_active=1 ORDER BY role,full_name`,[companyId]
  );
}