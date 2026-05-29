/**
 * QueueMaster Pro — Local SQLite Database
 * FIX: seedDefaultUsers ahora llama a hashPassword() de authservice
 *      para que el hash almacenado coincida exactamente con el que
 *      genera el login. El hash hardcodeado anterior nunca coincidía.
 *
 * Ubicación: service/database.ts
 */

import * as SQLite from 'expo-sqlite';
import { hashPassword } from './crypto';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync('queuemaster.db');
  return _db;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'employee' | 'monitor' | 'kiosk';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  station: string | null;
  avatar_url: string | null;
  is_active: number;
  created_at: string;
  last_login: string | null;
}

export interface Queue {
  id: number;
  ticket_number: string;
  prefix: string;
  customer_name: string;
  customer_contact: string | null;
  service_section_id: number | null;
  status: 'waiting' | 'calling' | 'serving' | 'completed' | 'no_show';
  desk: string | null;
  served_by: number | null;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  wait_time_seconds: number | null;
  // campos de JOIN
  section_title?: string;
  section_color?: string;
  served_by_name?: string;
}

export interface ServiceSection {
  id: number;
  title: string;
  description: string;
  avg_time_minutes: number;
  prefix: string;
  color: string;
  is_active: number;
  created_at: string;
  staff_count?: number;
}

export interface SectionAssignment {
  id: number;
  user_id: number;
  section_id: number;
  assigned_at: string;
  user_name?: string;
  user_email?: string;
  section_title?: string;
}

export interface SystemConfig {
  key: string;
  value: string;
  updated_at: string;
}

// ─── Inicialización ───────────────────────────────────────────────────────────

export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  db.execSync(`PRAGMA journal_mode = WAL;`);
  db.execSync(`PRAGMA foreign_keys = ON;`);

  // users
  db.execSync(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash   TEXT NOT NULL,
      full_name       TEXT NOT NULL,
      role            TEXT NOT NULL DEFAULT 'employee'
                      CHECK(role IN ('admin','employee','monitor','kiosk')),
      station         TEXT,
      avatar_url      TEXT,
      is_active       INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      last_login      TEXT
    );
  `);

  // service_sections
  db.execSync(`
    CREATE TABLE IF NOT EXISTS service_sections (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      title             TEXT NOT NULL,
      description       TEXT,
      avg_time_minutes  INTEGER NOT NULL DEFAULT 10,
      prefix            TEXT NOT NULL DEFAULT 'A',
      color             TEXT NOT NULL DEFAULT '#00685f',
      is_active         INTEGER NOT NULL DEFAULT 1,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // section_assignments
  db.execSync(`
    CREATE TABLE IF NOT EXISTS section_assignments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      section_id  INTEGER NOT NULL REFERENCES service_sections(id) ON DELETE CASCADE,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, section_id)
    );
  `);

  // queue
  db.execSync(`
    CREATE TABLE IF NOT EXISTS queue (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number       TEXT NOT NULL,
      prefix              TEXT NOT NULL DEFAULT 'A',
      customer_name       TEXT NOT NULL,
      customer_contact    TEXT,
      service_section_id  INTEGER REFERENCES service_sections(id),
      status              TEXT NOT NULL DEFAULT 'waiting'
                          CHECK(status IN ('waiting','calling','serving','completed','no_show')),
      desk                TEXT,
      served_by           INTEGER REFERENCES users(id),
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      called_at           TEXT,
      completed_at        TEXT,
      wait_time_seconds   INTEGER
    );
  `);

  // system_config
  db.execSync(`
    CREATE TABLE IF NOT EXISTS system_config (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // audit_logs
  db.execSync(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id),
      action      TEXT NOT NULL,
      entity      TEXT NOT NULL,
      entity_id   INTEGER,
      details     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // sessions
  db.execSync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT NOT NULL UNIQUE,
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Índices
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_queue_status     ON queue(status);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_queue_created    ON queue(created_at);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_audit_user       ON audit_logs(user_id);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_sessions_tok     ON sessions(token);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_assign_user      ON section_assignments(user_id);`);
  db.execSync(`CREATE INDEX IF NOT EXISTS idx_assign_section   ON section_assignments(section_id);`);

  await seedDefaultConfig(db);
  await seedDefaultUsers(db);  // ← usa hashPassword real, no hardcodeado
  await seedDefaultSections(db);

  console.log('[DB] SQLite inicializada.');
}

// ─── Seeds ────────────────────────────────────────────────────────────────────

async function seedDefaultConfig(db: SQLite.SQLiteDatabase) {
  const configs: [string, string][] = [
    ['brand_name',       'QueueMaster Pro'],
    ['brand_color',      '#00685f'],
    ['active_desks',     '12'],
    ['auto_allocate',    'true'],
    ['show_weather',     'true'],
    ['weather_location', 'New York'],
    ['weather_unit',     'F'],
    ['ticket_counter_A', '0'],
    ['ticket_counter_B', '0'],
    ['ticket_counter_C', '0'],
  ];
  for (const [key, value] of configs) {
    db.runSync(`INSERT OR IGNORE INTO system_config (key, value) VALUES (?, ?)`, [key, value]);
  }
}

/**
 * FIX CRÍTICO: importar hashPassword aquí para que el hash del seed
 * sea idéntico al que genera authservice.login() al hacer el login real.
 * Antes: hash hardcodeado ≠ hash de expo-crypto → "contraseña incorrecta"
 * Ahora: mismo algoritmo → hashes coinciden → login funciona
 */
async function seedDefaultUsers(db: SQLite.SQLiteDatabase) {
  const existing = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM users`);
  if (existing && existing.count > 0) return;

  // Importar la función real de hash para que coincida con el login
  const hash = await hashPassword('admin123');
// DEBUG TEMPORAL
console.log('=== DEBUG SEED ===');
console.log('Hash generado en seed:', hash);
console.log('==================');
  const users: [string, string, UserRole, string][] = [
    ['admin@queuemaster.com',    'Administrador',   'admin',    'Station 01'],
    ['marcus@queuemaster.com',   'Marcus Johnson',  'employee', 'Station 04'],
    ['employee2@queuemaster.com','Laura García',    'employee', 'Station 02'],
    ['monitor@queuemaster.com',  'Monitor Lobby',   'monitor',  'Lobby'],
    ['kiosk@queuemaster.com',    'Kiosco 01',       'kiosk',    'Kiosk 01'],
  ];

  for (const [email, name, role, station] of users) {
    db.runSync(
      `INSERT INTO users (email, password_hash, full_name, role, station, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [email, hash, name, role, station]
    );
    console.log(`[DB] Usuario creado: ${email} (rol: ${role})`);
  }

  console.log('[DB] ✅ Todos los usuarios seed creados con hash correcto. Contraseña: admin123');
}

async function seedDefaultSections(db: SQLite.SQLiteDatabase) {
  const existing = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM service_sections`);
  if (existing && existing.count > 0) return;

  const sections: [string, string, number, string, string][] = [
    ['Sales',    'Consultas y contratos.',           12, 'A', '#00685f'],
    ['Support',  'Asistencia técnica.',              25, 'B', '#565e74'],
    ['Payments', 'Pagos, reembolsos y facturación.',  5, 'C', '#008378'],
  ];

  for (const [title, desc, avg, prefix, color] of sections) {
    db.runSync(
      `INSERT INTO service_sections (title, description, avg_time_minutes, prefix, color)
       VALUES (?, ?, ?, ?, ?)`,
      [title, desc, avg, prefix, color]
    );
  }

  // Asignaciones por defecto
  const marcus  = db.getFirstSync<{ id: number }>(`SELECT id FROM users WHERE email = 'marcus@queuemaster.com'`);
  const laura   = db.getFirstSync<{ id: number }>(`SELECT id FROM users WHERE email = 'employee2@queuemaster.com'`);
  const sales    = db.getFirstSync<{ id: number }>(`SELECT id FROM service_sections WHERE prefix = 'A'`);
  const support  = db.getFirstSync<{ id: number }>(`SELECT id FROM service_sections WHERE prefix = 'B'`);
  const payments = db.getFirstSync<{ id: number }>(`SELECT id FROM service_sections WHERE prefix = 'C'`);

  if (marcus && sales)    db.runSync(`INSERT OR IGNORE INTO section_assignments (user_id, section_id) VALUES (?,?)`, [marcus.id, sales.id]);
  if (marcus && support)  db.runSync(`INSERT OR IGNORE INTO section_assignments (user_id, section_id) VALUES (?,?)`, [marcus.id, support.id]);
  if (laura  && payments) db.runSync(`INSERT OR IGNORE INTO section_assignments (user_id, section_id) VALUES (?,?)`, [laura.id, payments.id]);
}

// ─── Utilidad: resetear BD (solo para desarrollo) ─────────────────────────────

export async function resetDatabase(): Promise<void> {
  const db = getDatabase();
  console.log('[DB] Reseteando base de datos...');
  db.execSync(`DROP TABLE IF EXISTS sessions;`);
  db.execSync(`DROP TABLE IF EXISTS audit_logs;`);
  db.execSync(`DROP TABLE IF EXISTS section_assignments;`);
  db.execSync(`DROP TABLE IF EXISTS queue;`);
  db.execSync(`DROP TABLE IF EXISTS service_sections;`);
  db.execSync(`DROP TABLE IF EXISTS system_config;`);
  db.execSync(`DROP TABLE IF EXISTS users;`);
  db.closeSync(); // ← agrega esto para cerrar limpiamente
  _db = null;
  // ← elimina el await initializeDatabase() que estaba aquí
  console.log('[DB] ✅ Base de datos reseteada.');
}