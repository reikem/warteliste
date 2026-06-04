/**
 * Warteliste — Local SQLite Database v3
 * CAMBIO CLAVE: cada tabla tiene uuid_id TEXT para sincronizar con Supabase.
 * SQLite sigue usando INTEGER id para FKs locales (rápido, sin cambios en lógica).
 * uuid_id se genera automáticamente en _applyMigrations() para filas existentes.
 *
 * Ubicación: service/database.ts
 */

import * as SQLite from 'expo-sqlite';
import { hashPassword } from './crypto';

let _db: SQLite.SQLiteDatabase | null = null;

// ─── UUID v4 inline (no deps) ─────────────────────────────────────────────────

function _uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── getDatabase ──────────────────────────────────────────────────────────────

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('warteliste.db');
    _applyMigrations(_db);
  }
  return _db;
}

// ─── Migraciones síncronas ────────────────────────────────────────────────────

function _applyMigrations(db: SQLite.SQLiteDatabase): void {

  // M000 — tablas mínimas necesarias antes de cualquier query
  db.execSync(`
    CREATE TABLE IF NOT EXISTS companies (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid_id     TEXT UNIQUE,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      logo_url    TEXT,
      brand_color TEXT NOT NULL DEFAULT '#00685f',
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.execSync(`
    INSERT OR IGNORE INTO companies (id, name, slug, brand_color)
    VALUES (1, 'Warteliste Demo', 'warteliste', '#00685f');
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS company_config (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL DEFAULT 1,
      key        TEXT NOT NULL,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(company_id, key)
    );
  `);

  // M001 — migrar system_config → company_config
  try {
    const old = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='system_config'`
    );
    if (old && old.count > 0) {
      db.execSync(`INSERT OR IGNORE INTO company_config (company_id,key,value) SELECT 1,key,value FROM system_config;`);
    }
  } catch { /* ok */ }

  // M002–M006 — columnas en tablas existentes
  const alters: [string, string][] = [
    ['queue',            `ALTER TABLE queue ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','senior','vip','urgent'));`],
    ['users',            `ALTER TABLE users ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1;`],
    ['queue',            `ALTER TABLE queue ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1;`],
    ['service_sections', `ALTER TABLE service_sections ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1;`],
    // uuid_id en todas las tablas
    ['companies',           `ALTER TABLE companies ADD COLUMN uuid_id TEXT;`],
    ['users',               `ALTER TABLE users ADD COLUMN uuid_id TEXT;`],
    ['queue',               `ALTER TABLE queue ADD COLUMN uuid_id TEXT;`],
    ['service_sections',    `ALTER TABLE service_sections ADD COLUMN uuid_id TEXT;`],
    ['section_assignments', `ALTER TABLE section_assignments ADD COLUMN uuid_id TEXT;`],
    ['audit_logs',          `ALTER TABLE audit_logs ADD COLUMN uuid_id TEXT;`],
  ];
  for (const [, sql] of alters) {
    try { db.execSync(sql); } catch { /* columna ya existe */ }
  }

  // Rellenar uuid_id vacíos en todas las tablas que lo tienen
  const tablesWithUuid = [
    'companies','users','queue','service_sections','section_assignments','audit_logs',
  ];
  for (const t of tablesWithUuid) {
    try {
      const rows = db.getAllSync<{ id: number }>(
        `SELECT id FROM ${t} WHERE uuid_id IS NULL OR uuid_id = ''`
      );
      for (const row of rows) {
        db.runSync(`UPDATE ${t} SET uuid_id = ? WHERE id = ?`, [_uuid(), row.id]);
      }
    } catch { /* tabla aún no existe */ }
  }
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type UserRole       = 'admin' | 'employee' | 'monitor' | 'kiosk';
export type TicketStatus   = 'waiting' | 'calling' | 'serving' | 'completed' | 'no_show';
export type TicketPriority = 'normal' | 'senior' | 'vip' | 'urgent';

export interface Company {
  id: number; uuid_id: string; name: string; slug: string;
  logo_url: string | null; brand_color: string;
  is_active: number; created_at: string;
}

export interface User {
  id: number; uuid_id: string; company_id: number; email: string;
  password_hash: string; full_name: string; role: UserRole;
  station: string | null; avatar_url: string | null;
  is_active: number; created_at: string; last_login: string | null;
}

export interface Queue {
  id: number; uuid_id: string; company_id: number;
  ticket_number: string; prefix: string;
  customer_name: string; customer_contact: string | null;
  service_section_id: number | null; status: TicketStatus;
  priority: TicketPriority; desk: string | null; served_by: number | null;
  created_at: string; called_at: string | null; completed_at: string | null;
  wait_time_seconds: number | null;
  section_title?: string; section_color?: string; served_by_name?: string;
}

export interface ServiceSection {
  id: number; uuid_id: string; company_id: number;
  title: string; description: string;
  avg_time_minutes: number; prefix: string; color: string;
  is_active: number; created_at: string; staff_count?: number;
}

export interface SectionAssignment {
  id: number; uuid_id: string; user_id: number; section_id: number;
  assigned_at: string;
  user_name?: string; user_email?: string; section_title?: string;
}

// ─── initializeDatabase ───────────────────────────────────────────────────────

export async function initializeDatabase(): Promise<void> {
  const db = getDatabase(); // migraciones ya aplicadas

  db.execSync(`PRAGMA journal_mode = WAL;`);
  db.execSync(`PRAGMA foreign_keys = ON;`);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid_id       TEXT UNIQUE,
      company_id    INTEGER NOT NULL DEFAULT 1,
      email         TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      full_name     TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'employee'
                    CHECK(role IN ('admin','employee','monitor','kiosk')),
      station       TEXT,
      avatar_url    TEXT,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login    TEXT,
      UNIQUE(company_id, email)
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS service_sections (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid_id          TEXT UNIQUE,
      company_id       INTEGER NOT NULL DEFAULT 1,
      title            TEXT NOT NULL,
      description      TEXT,
      avg_time_minutes INTEGER NOT NULL DEFAULT 10,
      prefix           TEXT NOT NULL DEFAULT 'A',
      color            TEXT NOT NULL DEFAULT '#00685f',
      is_active        INTEGER NOT NULL DEFAULT 1,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS section_assignments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid_id     TEXT UNIQUE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      section_id  INTEGER NOT NULL REFERENCES service_sections(id) ON DELETE CASCADE,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, section_id)
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS queue (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid_id            TEXT UNIQUE,
      company_id         INTEGER NOT NULL DEFAULT 1,
      ticket_number      TEXT NOT NULL,
      prefix             TEXT NOT NULL DEFAULT 'A',
      customer_name      TEXT NOT NULL,
      customer_contact   TEXT,
      service_section_id INTEGER REFERENCES service_sections(id),
      status             TEXT NOT NULL DEFAULT 'waiting'
                         CHECK(status IN ('waiting','calling','serving','completed','no_show')),
      priority           TEXT NOT NULL DEFAULT 'normal'
                         CHECK(priority IN ('normal','senior','vip','urgent')),
      desk               TEXT,
      served_by          INTEGER REFERENCES users(id),
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      called_at          TEXT,
      completed_at       TEXT,
      wait_time_seconds  INTEGER
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid_id    TEXT UNIQUE,
      company_id INTEGER NOT NULL DEFAULT 1,
      user_id    INTEGER REFERENCES users(id),
      action     TEXT NOT NULL,
      entity     TEXT NOT NULL,
      entity_id  INTEGER,
      details    TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS sync_pending (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation  TEXT NOT NULL,
      payload    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      attempts   INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.execSync(`CREATE INDEX IF NOT EXISTS idx_queue_status    ON queue(status);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_queue_priority  ON queue(priority);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_queue_created   ON queue(created_at);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_queue_uuid      ON queue(uuid_id);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_users_uuid      ON users(uuid_id);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_sessions_token  ON sessions(token);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_cfg_cid_key     ON company_config(company_id,key);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_sections_uuid   ON service_sections(uuid_id);`);

  await _seedCompany(db);
  await _seedUsers(db);

  console.log('[DB] Warteliste inicializada.');
}

// ─── Seeds ────────────────────────────────────────────────────────────────────

async function _seedCompany(db: SQLite.SQLiteDatabase) {
  // Asignar uuid_id a empresa demo si no tiene
  const co = db.getFirstSync<{ id: number; uuid_id: string | null }>(
    `SELECT id, uuid_id FROM companies WHERE id = 1`
  );
  if (co && !co.uuid_id) {
    db.runSync(`UPDATE companies SET uuid_id = ? WHERE id = 1`, [_uuid()]);
  }

  const defaults: [string, string][] = [
    ['brand_name',       'Warteliste'],
    ['brand_color',      '#00685f'],
    ['active_desks',     '6'],
    ['auto_allocate',    'true'],
    ['show_weather',     'true'],
    ['weather_city',     'chile_vina'],
    ['monitor_sound',    'chime'],
    ['repeat_sound',     'true'],
    ['ticket_counter_A', '0'],
    ['ticket_counter_B', '0'],
    ['ticket_counter_C', '0'],
  ];
  for (const [key, value] of defaults) {
    db.runSync(
      `INSERT OR IGNORE INTO company_config (company_id, key, value) VALUES (1, ?, ?)`,
      [key, value]
    );
  }
}

async function _seedUsers(db: SQLite.SQLiteDatabase) {
  const existing = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM users`);
  if (existing && existing.count > 0) return;

  const hash = await hashPassword('admin123');
  const users: [string, string, UserRole, string][] = [
    ['admin@warteliste.com',   'Administrador',  'admin',    'Station 01'],
    ['marcus@warteliste.com',  'Marcus Johnson', 'employee', 'Station 04'],
    ['laura@warteliste.com',   'Laura García',   'employee', 'Station 02'],
    ['monitor@warteliste.com', 'Monitor Lobby',  'monitor',  'Lobby'],
    ['kiosk@warteliste.com',   'Kiosco 01',      'kiosk',    'Kiosk 01'],
  ];
  for (const [email, name, role, station] of users) {
    db.runSync(
      `INSERT INTO users (uuid_id, company_id, email, password_hash, full_name, role, station, is_active)
       VALUES (?, 1, ?, ?, ?, ?, ?, 1)`,
      [_uuid(), email, hash, name, role, station]
    );
  }
  console.log('[DB] Seed usuarios creados. Contraseña: admin123');
}

// ─── Helpers de config ────────────────────────────────────────────────────────

export function getCompanyConfig(companyId: number, key: string): string | null {
  try {
    return getDatabase().getFirstSync<{ value: string }>(
      `SELECT value FROM company_config WHERE company_id = ? AND key = ?`,
      [companyId, key]
    )?.value ?? null;
  } catch { return null; }
}

export function setCompanyConfig(companyId: number, key: string, value: string): void {
  try {
    getDatabase().runSync(
      `INSERT INTO company_config (company_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT(company_id, key)
       DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [companyId, key, value]
    );
  } catch (e) { console.warn('[DB] setCompanyConfig:', e); }
}

// ─── Reset (solo desarrollo) ──────────────────────────────────────────────────

export async function resetDatabase(): Promise<void> {
  const db = getDatabase();
  db.execSync(`PRAGMA foreign_keys = OFF;`);
  for (const t of [
    'sessions','audit_logs','section_assignments','queue',
    'service_sections','company_config','users','companies','sync_pending',
  ]) {
    try { db.execSync(`DROP TABLE IF EXISTS ${t};`); } catch { /* ok */ }
  }
  db.closeSync();
  _db = null;
  console.log('[DB] Reseteada. Reinicia la app.');
}