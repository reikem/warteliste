/**
 * Warteliste — Sync Service v2
 * FIX: SQLite usa INTEGER id, Supabase usa UUID.
 * Solución: cada entidad tiene un campo uuid_id adicional en SQLite
 * que se usa para sincronizar con Supabase.
 * Los ids locales siguen siendo INTEGER para las FKs locales.
 *
 * Ubicación: service/syncService.ts
 */

import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabaseClient';
import { getDatabase } from './database';
import { bus, EVENTS } from './eventBus';

// ─── Generador de UUID v4 (sin dependencias) ──────────────────────────────────

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Asegurar columnas uuid en las tablas ─────────────────────────────────────
// Llama esto una vez en initializeDatabase() o en getDatabase()

export function ensureUuidColumns(): void {
  const db = getDatabase();
  const tables = ['users', 'companies', 'queue', 'service_sections',
                  'section_assignments', 'audit_logs'];
  for (const t of tables) {
    try {
      db.execSync(`ALTER TABLE ${t} ADD COLUMN uuid_id TEXT;`);
    } catch { /* ya existe */ }
  }
  // Rellenar uuid_id vacíos con nuevos UUIDs
  for (const t of tables) {
    try {
      // Solo actualiza filas que aún no tienen uuid_id
      const rows = db.getAllSync<{ id: number }>(
        `SELECT id FROM ${t} WHERE uuid_id IS NULL OR uuid_id = ''`
      );
      for (const row of rows) {
        db.runSync(`UPDATE ${t} SET uuid_id = ? WHERE id = ?`, [generateUUID(), row.id]);
      }
    } catch { /* tabla no existe todavía */ }
  }
}

// ─── Obtener uuid_id de una fila local ────────────────────────────────────────

export function getUuidForRow(table: string, localId: number): string {
  try {
    const row = getDatabase().getFirstSync<{ uuid_id: string }>(
      `SELECT uuid_id FROM ${table} WHERE id = ?`, [localId]
    );
    if (row?.uuid_id) return row.uuid_id;
  } catch { /* ok */ }
  // Generar y guardar uno nuevo
  const uuid = generateUUID();
  try {
    getDatabase().runSync(`UPDATE ${table} SET uuid_id = ? WHERE id = ?`, [uuid, localId]);
  } catch { /* ok */ }
  return uuid;
}

// ─── Mapear payload: reemplazar ids INTEGER por UUIDs ────────────────────────
// Convierte { id: 1, company_id: 1, served_by: 2 } →
//           { id: 'uuid-xxx', company_id: 'uuid-yyy', served_by: 'uuid-zzz' }

export function mapIdsToUuids(
  table: string,
  payload: Record<string, any>,
): Record<string, any> {
  const mapped = { ...payload };

  // Mapeo de campos enteros → tabla origen para resolver UUID
  const FK_MAP: Record<string, string> = {
    id:                 table,
    company_id:         'companies',
    served_by:          'users',
    user_id:            'users',
    section_id:         'service_sections',
    service_section_id: 'service_sections',
  };

  for (const [field, sourceTable] of Object.entries(FK_MAP)) {
    if (mapped[field] !== undefined && mapped[field] !== null &&
        typeof mapped[field] === 'number') {
      mapped[field] = getUuidForRow(sourceTable, mapped[field]);
    }
  }

  return mapped;
}

// ─── Estado de red ────────────────────────────────────────────────────────────

let _isOnline    = false;
let _drainActive = false;

export function initNetworkListener(): () => void {
  const unsub = NetInfo.addEventListener(state => {
    const wasOffline = !_isOnline;
    _isOnline = !!(state.isConnected && state.isInternetReachable);
    if (wasOffline && _isOnline) {
      console.log('[Sync] Red disponible — drenando cola...');
      drainPendingQueue().catch(console.warn);
    }
  });
  NetInfo.fetch().then(state => {
    _isOnline = !!(state.isConnected && state.isInternetReachable);
  });
  return unsub;
}

export function isOnline(): boolean { return _isOnline; }

// ─── Cola de operaciones pendientes (SQLite) ──────────────────────────────────

function ensurePendingTable(): void {
  try {
    getDatabase().execSync(`
      CREATE TABLE IF NOT EXISTS sync_pending (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        operation  TEXT NOT NULL,
        payload    TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        attempts   INTEGER NOT NULL DEFAULT 0
      );
    `);
  } catch { /* ok */ }
}

function enqueue(table: string, op: 'INSERT'|'UPDATE'|'DELETE', payload: object): void {
  ensurePendingTable();
  try {
    getDatabase().runSync(
      `INSERT INTO sync_pending (table_name, operation, payload) VALUES (?, ?, ?)`,
      [table, op, JSON.stringify(payload)]
    );
  } catch (e) { console.warn('[Sync] enqueue error:', e); }
}

export async function drainPendingQueue(): Promise<void> {
  if (_drainActive || !_isOnline) return;
  _drainActive = true;
  try {
    ensurePendingTable();
    const items = getDatabase().getAllSync<{
      id: number; table_name: string; operation: string;
      payload: string; attempts: number;
    }>(`SELECT * FROM sync_pending ORDER BY created_at ASC LIMIT 50`);

    for (const item of items) {
      if (item.attempts >= 5) {
        getDatabase().runSync(`DELETE FROM sync_pending WHERE id = ?`, [item.id]);
        continue;
      }
      try {
        const raw     = JSON.parse(item.payload);
        // Re-mapear UUIDs al drenar (los ids locales siguen siendo válidos)
        const payload = mapIdsToUuids(item.table_name, raw);
        await _execSupabase(item.table_name, item.operation as any, payload);
        getDatabase().runSync(`DELETE FROM sync_pending WHERE id = ?`, [item.id]);
      } catch (e) {
        console.warn(`[Sync] Drain error item ${item.id}:`, e);
        getDatabase().runSync(
          `UPDATE sync_pending SET attempts = attempts + 1 WHERE id = ?`, [item.id]
        );
      }
    }
  } finally {
    _drainActive = false;
  }
}

// ─── Ejecutar operación en Supabase ──────────────────────────────────────────

async function _execSupabase(
  table: string, op: 'INSERT'|'UPDATE'|'DELETE', payload: any,
): Promise<void> {
  if (op === 'INSERT') {
    const { error } = await supabase.from(table).upsert(payload, { ignoreDuplicates: false });
    if (error) throw error;
  } else if (op === 'UPDATE') {
    const { id, ...data } = payload;
    const { error } = await supabase.from(table).update(data).eq('id', id);
    if (error) throw error;
  } else if (op === 'DELETE') {
    const { error } = await supabase.from(table).delete().eq('id', payload.id);
    if (error) throw error;
  }
}

// ─── Función principal de dual-write ─────────────────────────────────────────

export async function syncToSupabase(
  table: string,
  op: 'INSERT'|'UPDATE'|'DELETE',
  rawPayload: Record<string, any>,
): Promise<void> {
  // Mapear ids INTEGER → UUIDs ANTES de enviar a Supabase
  const payload = mapIdsToUuids(table, rawPayload);

  if (_isOnline) {
    try {
      await _execSupabase(table, op, payload);
    } catch (e: any) {
      console.warn(`[Sync] ${table}/${op} falló, encolando:`, e?.message ?? e);
      enqueue(table, op, payload); // guardar payload ya con UUIDs
    }
  } else {
    enqueue(table, op, payload);
  }
}

// ─── Sync inicial al autenticar ───────────────────────────────────────────────

export async function initialSync(companyId: number): Promise<void> {
  if (!_isOnline) return;
  try {
    const companyUuid = getUuidForRow('companies', companyId);

    // Secciones
    const { data: sections } = await supabase
      .from('service_sections')
      .select('*')
      .eq('company_id', companyUuid)
      .eq('is_active', true);

    if (sections?.length) {
      const db = getDatabase();
      for (const s of sections) {
        // Verificar si ya existe por uuid_id
        const existing = db.getFirstSync<{ id: number }>(
          `SELECT id FROM service_sections WHERE uuid_id = ?`, [s.id]
        );
        if (!existing) {
          db.runSync(`
            INSERT OR IGNORE INTO service_sections
              (uuid_id, company_id, title, description, avg_time_minutes, prefix, color, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [s.id, companyId, s.title, s.description ?? '',
              s.avg_time_minutes, s.prefix, s.color, s.is_active ? 1 : 0, s.created_at]);
        }
      }
    }

    // Cola activa
    const { data: queue } = await supabase
      .from('queue')
      .select('*')
      .eq('company_id', companyUuid)
      .in('status', ['waiting','calling','serving'])
      .order('created_at', { ascending: true });

    if (queue?.length) {
      const db = getDatabase();
      for (const t of queue) {
        const existing = db.getFirstSync<{ id: number }>(
          `SELECT id FROM queue WHERE uuid_id = ?`, [t.id]
        );
        if (!existing) {
          // Resolver FK section_id local
          const sec = db.getFirstSync<{ id: number }>(
            `SELECT id FROM service_sections WHERE uuid_id = ?`,
            [t.service_section_id]
          );
          db.runSync(`
            INSERT OR IGNORE INTO queue
              (uuid_id, company_id, ticket_number, prefix, customer_name,
               customer_contact, service_section_id, status, priority,
               desk, created_at, called_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [t.id, companyId, t.ticket_number, t.prefix, t.customer_name,
              t.customer_contact, sec?.id ?? null, t.status,
              t.priority ?? 'normal', t.desk, t.created_at, t.called_at]);
        }
      }
      bus.emit(EVENTS.QUEUE_UPDATED, null);
    }

    // Config
    const { data: config } = await supabase
      .from('system_config')
      .select('key, value')
      .eq('company_id', companyUuid);

    if (config?.length) {
      const db = getDatabase();
      for (const c of config) {
        db.runSync(`
          INSERT OR REPLACE INTO company_config (company_id, key, value)
          VALUES (?, ?, ?)
        `, [companyId, c.key, c.value]);
      }
    }

    console.log('[Sync] Sincronización inicial completada.');
  } catch (e) {
    console.warn('[Sync] initialSync error:', e);
  }
}

// ─── Realtime ────────────────────────────────────────────────────────────────

export function subscribeRealtimeQueue(
  companyId: number,
  onTicketCalled?: (ticketNumber: string, desk: string, section: string) => void,
): () => void {
  const companyUuid = getUuidForRow('companies', companyId);

  const channel = supabase
    .channel(`rt-queue-${companyId}`)
    .on('postgres_changes' as any, {
      event: '*', schema: 'public', table: 'queue',
      filter: `company_id=eq.${companyUuid}`,
    }, async (payload: any) => {
      const record = payload.new ?? payload.old;
      if (!record) return;

      const db = getDatabase();

      if (payload.eventType === 'DELETE') {
        try { db.runSync(`DELETE FROM queue WHERE uuid_id = ?`, [record.id]); } catch { /* ok */ }
      } else {
        // Resolver FKs locales
        const sec = db.getFirstSync<{ id: number }>(
          `SELECT id FROM service_sections WHERE uuid_id = ?`, [record.service_section_id]
        );
        const servedByRow = record.served_by
          ? db.getFirstSync<{ id: number }>(
              `SELECT id FROM users WHERE uuid_id = ?`, [record.served_by]
            )
          : null;

        const existing = db.getFirstSync<{ id: number }>(
          `SELECT id FROM queue WHERE uuid_id = ?`, [record.id]
        );

        if (existing) {
          db.runSync(`
            UPDATE queue SET status=?, desk=?, served_by=?, called_at=?,
              completed_at=?, wait_time_seconds=?, priority=?
            WHERE uuid_id=?
          `, [record.status, record.desk, servedByRow?.id ?? null,
              record.called_at, record.completed_at,
              record.wait_time_seconds, record.priority ?? 'normal', record.id]);
        } else {
          db.runSync(`
            INSERT OR IGNORE INTO queue
              (uuid_id, company_id, ticket_number, prefix, customer_name,
               customer_contact, service_section_id, status, priority,
               desk, served_by, created_at, called_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [record.id, companyId, record.ticket_number, record.prefix,
              record.customer_name, record.customer_contact,
              sec?.id ?? null, record.status, record.priority ?? 'normal',
              record.desk, servedByRow?.id ?? null,
              record.created_at, record.called_at]);
        }

        // Si es un llamado → EventBus → sonido en monitor
        if (record.status === 'calling' && payload.eventType === 'UPDATE') {
          const secTitle = sec
            ? db.getFirstSync<{ title: string }>(
                `SELECT title FROM service_sections WHERE id = ?`, [sec.id]
              )?.title ?? 'General'
            : 'General';
          const servedName = servedByRow
            ? db.getFirstSync<{ full_name: string }>(
                `SELECT full_name FROM users WHERE id = ?`, [servedByRow.id]
              )?.full_name ?? 'Empleado'
            : 'Empleado';

          bus.emit(EVENTS.TICKET_CALLED, {
            ticketNumber: record.ticket_number,
            desk:         record.desk ?? 'Estación',
            sectionTitle: secTitle,
            servedBy:     servedName,
            priority:     record.priority ?? 'normal',
          });
          onTicketCalled?.(record.ticket_number, record.desk ?? '', secTitle);
        }
      }

      bus.emit(EVENTS.QUEUE_UPDATED, null);
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED')
        console.log('[Sync] Realtime conectado para empresa', companyId);
    });

  return () => { supabase.removeChannel(channel); };
}