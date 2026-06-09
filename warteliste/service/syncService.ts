/**
 * Warteliste — Sync Service v5
 * FIXES:
 *   1. Mutex: bootstrapSupabase() no puede correr en paralelo
 *   2. Si el primer request falla por red → abortar todo, no continuar
 *   3. _bootstrapped se resetea solo cuando la red se recupera
 *   4. initNetworkListener() no llama bootstrap si ya está corriendo
 *   5. drainPendingQueue() usa mismo mutex
 *
 * Ubicación: service/syncService.ts
 */

import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabaseClient';
import { getDatabase } from './database';
import { bus, EVENTS } from './eventBus';

// ─── UUID v4 ──────────────────────────────────────────────────────────────────

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getUuidForRow(table: string, localId: number): string {
  try {
    const row = getDatabase().getFirstSync<{ uuid_id: string }>(
      `SELECT uuid_id FROM ${table} WHERE id = ?`, [localId]
    );
    if (row?.uuid_id) return row.uuid_id;
  } catch { /* ok */ }
  const uuid = generateUUID();
  try { getDatabase().runSync(`UPDATE ${table} SET uuid_id = ? WHERE id = ?`, [uuid, localId]); } catch { /* ok */ }
  return uuid;
}

// ─── Estado ───────────────────────────────────────────────────────────────────

let _online       = false;
let _bootstrapped = false;
let _bootstrapRunning = false; // mutex
let _draining         = false; // mutex

export function isOnline(): boolean { return _online; }

// ─── Network listener ─────────────────────────────────────────────────────────

export function initNetworkListener(): () => void {
  const unsub = NetInfo.addEventListener(state => {
    const wasOffline = !_online;
    _online = !!(state.isConnected && state.isInternetReachable);

    if (wasOffline && _online) {
      // Volvió la red → resetear flags y sincronizar
      _bootstrapped = false;
      console.log('[Sync] Red recuperada — iniciando bootstrap...');
      bootstrapSupabase()
        .then(() => drainPendingQueue())
        .catch(() => {/* silenciar */});
    }

    if (!_online) {
      // Perdió la red → resetear para que bootstrap vuelva a correr cuando regrese
      _bootstrapped     = false;
      _bootstrapRunning = false;
    }
  });

  // Check inicial único
  NetInfo.fetch().then(state => {
    _online = !!(state.isConnected && state.isInternetReachable);
    if (_online && !_bootstrapped && !_bootstrapRunning) {
      bootstrapSupabase().catch(() => {/* silenciar */});
    }
  });

  return unsub;
}

// ─── BOOTSTRAP ───────────────────────────────────────────────────────────────
// Mutex: solo una ejecución a la vez.
// Si falla el primer request (sin red) → aborta inmediatamente.

export async function bootstrapSupabase(): Promise<void> {
  // Mutex: no correr en paralelo
  if (_bootstrapRunning || _bootstrapped || !_online) return;
  _bootstrapRunning = true;

  const db = getDatabase();

  try {
    // ── TEST DE CONECTIVIDAD ───────────────────────────────────────────────
    // Un request pequeño para verificar que Supabase responde antes de procesar
    try {
      const { error } = await supabase.from('companies').select('id').limit(1);
      if (error) throw error;
    } catch (e: any) {
      console.warn('[Bootstrap] Sin conexión a Supabase, abortando:', e?.message);
      _bootstrapRunning = false;
      return;
    }

    // ── 1. EMPRESAS ───────────────────────────────────────────────────────

    const companies = db.getAllSync<{
      id: number; uuid_id: string | null; name: string; slug: string;
      brand_color: string; is_active: number; created_at: string;
    }>(`SELECT id, uuid_id, name, slug, brand_color, is_active, created_at FROM companies`);

    for (const co of companies) {
      // Asegurar uuid_id local
      if (!co.uuid_id) {
        co.uuid_id = generateUUID();
        db.runSync(`UPDATE companies SET uuid_id=? WHERE id=?`, [co.uuid_id, co.id]);
      }

      const { error } = await supabase.from('companies').upsert({
        id: co.uuid_id, name: co.name, slug: co.slug,
        brand_color: co.brand_color, is_active: co.is_active === 1,
        created_at: co.created_at,
      }, { onConflict: 'id' });

      if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        // Error de red → abortar todo el proceso
        console.warn('[Bootstrap] Error de red, abortando:', error.message);
        _bootstrapRunning = false;
        return;
      }

      if (error?.message?.includes('slug')) {
        // Slug duplicado → leer UUID real de Supabase y actualizar local
        const { data: existing } = await supabase
          .from('companies').select('id').eq('slug', co.slug).single();
        if (existing?.id && existing.id !== co.uuid_id) {
          db.runSync(`UPDATE companies SET uuid_id=? WHERE id=?`, [existing.id, co.id]);
          co.uuid_id = existing.id;
          console.log(`[Bootstrap] Empresa "${co.slug}" → UUID actualizado: ${existing.id}`);
        }
      } else if (!error) {
        console.log('[Bootstrap] Empresa sincronizada:', co.slug);
      }
    }

    // ── 2. USUARIOS ──────────────────────────────────────────────────────

    const users = db.getAllSync<{
      id: number; uuid_id: string | null; company_id: number;
      email: string; full_name: string; role: string;
      station: string | null; is_active: number; created_at: string;
    }>(`SELECT id, uuid_id, company_id, email, full_name, role, station, is_active, created_at FROM users`);

    for (const u of users) {
      if (!u.uuid_id) {
        u.uuid_id = generateUUID();
        db.runSync(`UPDATE users SET uuid_id=? WHERE id=?`, [u.uuid_id, u.id]);
      }

      // Leer uuid de empresa (puede haber sido actualizado arriba)
      const coUuid = db.getFirstSync<{ uuid_id: string }>(
        `SELECT uuid_id FROM companies WHERE id=?`, [u.company_id]
      )?.uuid_id;
      if (!coUuid) continue;

      const { error } = await supabase.from('users').upsert({
        id: u.uuid_id, company_id: coUuid,
        email: u.email, full_name: u.full_name, role: u.role,
        station: u.station, is_active: u.is_active === 1,
        created_at: u.created_at,
        password_hash: 'MANAGED_LOCALLY',
      }, { onConflict: 'id' });

      if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        console.warn('[Bootstrap] Error de red en usuarios, abortando');
        _bootstrapRunning = false;
        return;
      }

      if (error?.message?.includes('email') || error?.message?.includes('unique')) {
        // Email duplicado → leer UUID real
        const { data: existing } = await supabase
          .from('users').select('id').eq('email', u.email).eq('company_id', coUuid).single();
        if (existing?.id && existing.id !== u.uuid_id) {
          db.runSync(`UPDATE users SET uuid_id=? WHERE id=?`, [existing.id, u.id]);
        }
      }
    }

    // ── 3. CONFIG (en batch para reducir requests) ────────────────────────

    const configs = db.getAllSync<{
      company_id: number; key: string; value: string;
    }>(`SELECT company_id, key, value FROM company_config`);

    // Agrupar por empresa
    const configByCompany = new Map<string, { key: string; value: string }[]>();
    for (const c of configs) {
      const coUuid = db.getFirstSync<{ uuid_id: string }>(
        `SELECT uuid_id FROM companies WHERE id=?`, [c.company_id]
      )?.uuid_id;
      if (!coUuid) continue;
      if (!configByCompany.has(coUuid)) configByCompany.set(coUuid, []);
      configByCompany.get(coUuid)!.push({ key: c.key, value: c.value });
    }

    for (const [coUuid, items] of configByCompany) {
      // Upsert en batch de hasta 20 items para no saturar
      const batches = [];
      for (let i = 0; i < items.length; i += 20)
        batches.push(items.slice(i, i + 20));

      for (const batch of batches) {
        const { error } = await supabase.from('system_config').upsert(
          batch.map(b => ({ company_id: coUuid, key: b.key, value: b.value })),
          { onConflict: 'company_id,key' }
        );
        if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
          console.warn('[Bootstrap] Error de red en config, abortando');
          _bootstrapRunning = false;
          return;
        }
        if (error) console.warn('[Bootstrap] config batch error:', error.message);
      }
    }

    // ── 4. SECCIONES ──────────────────────────────────────────────────────

    const sections = db.getAllSync<{
      id: number; uuid_id: string | null; company_id: number;
      title: string; description: string; avg_time_minutes: number;
      prefix: string; color: string; is_active: number; created_at: string;
    }>(`SELECT * FROM service_sections`);

    const secRows = [];
    for (const s of sections) {
      if (!s.uuid_id) {
        s.uuid_id = generateUUID();
        db.runSync(`UPDATE service_sections SET uuid_id=? WHERE id=?`, [s.uuid_id, s.id]);
      }
      const coUuid = db.getFirstSync<{ uuid_id: string }>(
        `SELECT uuid_id FROM companies WHERE id=?`, [s.company_id]
      )?.uuid_id;
      if (!coUuid) continue;
      secRows.push({
        id: s.uuid_id, company_id: coUuid, title: s.title,
        description: s.description ?? '', avg_time_minutes: s.avg_time_minutes,
        prefix: s.prefix, color: s.color, is_active: s.is_active === 1,
        created_at: s.created_at,
      });
    }

    if (secRows.length > 0) {
      const { error } = await supabase.from('service_sections')
        .upsert(secRows, { onConflict: 'id' });
      if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        console.warn('[Bootstrap] Error de red en secciones, abortando');
        _bootstrapRunning = false;
        return;
      }
      if (error) console.warn('[Bootstrap] sections error:', error.message);
    }

    _bootstrapped     = true;
    _bootstrapRunning = false;
    console.log('[Bootstrap] ✅ Sincronización completada con Supabase.');

  } catch (e: any) {
    console.warn('[Bootstrap] Error general:', e?.message ?? e);
    _bootstrapRunning = false;
    // No marcar como bootstrapped para reintentar
  }
}

// ─── Cola pendiente ───────────────────────────────────────────────────────────

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

function enqueue(table: string, op: string, payload: object): void {
  ensurePendingTable();
  try {
    getDatabase().runSync(
      `INSERT INTO sync_pending (table_name, operation, payload) VALUES (?,?,?)`,
      [table, op, JSON.stringify(payload)]
    );
  } catch { /* ok */ }
}

export async function drainPendingQueue(): Promise<void> {
  if (_draining || !_online) return;
  if (!_bootstrapped) {
    await bootstrapSupabase();
    if (!_bootstrapped) return; // bootstrap falló, no drenar
  }

  _draining = true;
  try {
    ensurePendingTable();
    const items = getDatabase().getAllSync<{
      id: number; table_name: string; operation: string;
      payload: string; attempts: number;
    }>(`SELECT * FROM sync_pending ORDER BY created_at ASC LIMIT 50`);

    if (!items.length) return;

    let networkFailed = false;
    for (const item of items) {
      if (networkFailed) break; // parar si perdió la red

      if (item.attempts >= 5) {
        getDatabase().runSync(`DELETE FROM sync_pending WHERE id=?`, [item.id]);
        continue;
      }
      try {
        await _exec(item.table_name, item.operation as any, JSON.parse(item.payload));
        getDatabase().runSync(`DELETE FROM sync_pending WHERE id=?`, [item.id]);
      } catch (e: any) {
        if (e?.message?.includes('network') || e?.message?.includes('fetch')) {
          networkFailed = true;
          _bootstrapped = false;
        } else {
          getDatabase().runSync(
            `UPDATE sync_pending SET attempts=attempts+1 WHERE id=?`, [item.id]
          );
        }
      }
    }
    console.log(`[Sync] Cola procesada.`);
  } finally {
    _draining = false;
  }
}

// ─── Ejecutar en Supabase ─────────────────────────────────────────────────────

async function _exec(table: string, op: 'INSERT'|'UPDATE'|'DELETE', payload: any): Promise<void> {
  if (op === 'INSERT') {
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  } else if (op === 'UPDATE') {
    const { id, ...data } = payload;
    const { error } = await supabase.from(table).update(data).eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from(table).delete().eq('id', payload.id);
    if (error) throw error;
  }
}

// ─── Dual-write ───────────────────────────────────────────────────────────────

export async function syncToSupabase(
  table: string, op: 'INSERT'|'UPDATE'|'DELETE', payload: Record<string, any>,
): Promise<void> {
  if (!_online) { enqueue(table, op, payload); return; }
  if (!_bootstrapped) {
    await bootstrapSupabase();
    if (!_bootstrapped) { enqueue(table, op, payload); return; }
  }
  try {
    await _exec(table, op, payload);
  } catch (e: any) {
    if (e?.message?.includes('network') || e?.message?.includes('fetch')) {
      _bootstrapped = false;
    }
    enqueue(table, op, payload);
  }
}

// ─── Sync inicial ─────────────────────────────────────────────────────────────

export async function initialSync(companyId: number): Promise<void> {
  if (!_online) return;
  try {
    await bootstrapSupabase();
    if (!_bootstrapped) return;

    const db = getDatabase();
    const coUuid = db.getFirstSync<{ uuid_id: string }>(
      `SELECT uuid_id FROM companies WHERE id=?`, [companyId]
    )?.uuid_id;
    if (!coUuid) return;

    // Secciones
    const { data: sections, error: sErr } = await supabase
      .from('service_sections').select('*')
      .eq('company_id', coUuid).eq('is_active', true);
    if (sErr?.message?.includes('network')) return;

    if (sections?.length) {
      for (const s of sections) {
        const ex = db.getFirstSync<{ id: number }>(
          `SELECT id FROM service_sections WHERE uuid_id=?`, [s.id]
        );
        if (!ex) {
          db.runSync(`
            INSERT OR IGNORE INTO service_sections
              (uuid_id,company_id,title,description,avg_time_minutes,prefix,color,is_active,created_at)
            VALUES (?,?,?,?,?,?,?,?,?)
          `, [s.id,companyId,s.title,s.description??'',
              s.avg_time_minutes,s.prefix,s.color,s.is_active?1:0,s.created_at]);
        }
      }
      bus.emit(EVENTS.QUEUE_UPDATED, null);
    }

    // Cola activa
    const { data: queue } = await supabase
      .from('queue').select('*')
      .eq('company_id', coUuid)
      .in('status', ['waiting','calling','serving'])
      .order('created_at', { ascending: true });

    if (queue?.length) {
      for (const t of queue) {
        const ex = db.getFirstSync<{ id: number }>(`SELECT id FROM queue WHERE uuid_id=?`,[t.id]);
        if (!ex) {
          const sec = db.getFirstSync<{ id: number }>(
            `SELECT id FROM service_sections WHERE uuid_id=?`,[t.service_section_id]
          );
          db.runSync(`
            INSERT OR IGNORE INTO queue
              (uuid_id,company_id,ticket_number,prefix,customer_name,customer_contact,
               service_section_id,status,priority,desk,created_at,called_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
          `, [t.id,companyId,t.ticket_number,t.prefix,t.customer_name,t.customer_contact,
              sec?.id??null,t.status,t.priority??'normal',t.desk,t.created_at,t.called_at]);
        }
      }
      bus.emit(EVENTS.QUEUE_UPDATED, null);
    }

    // Config
    const { data: config } = await supabase
      .from('system_config').select('key,value').eq('company_id', coUuid);
    if (config?.length) {
      for (const c of config) {
        db.runSync(
          `INSERT OR REPLACE INTO company_config (company_id,key,value) VALUES (?,?,?)`,
          [companyId, c.key, c.value]
        );
      }
    }

    console.log('[Sync] Sincronización inicial completada.');
  } catch (e: any) {
    if (!e?.message?.includes('network')) console.warn('[Sync] initialSync:', e?.message);
  }
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

export function subscribeRealtimeQueue(
  companyId: number,
  onTicketCalled?: (ticketNumber: string, desk: string, section: string) => void,
): () => void {
  const db     = getDatabase();
  const coUuid = db.getFirstSync<{ uuid_id: string }>(
    `SELECT uuid_id FROM companies WHERE id=?`, [companyId]
  )?.uuid_id ?? '';

  if (!coUuid) {
    console.warn('[Sync] Sin uuid para empresa', companyId, '— Realtime no iniciado');
    return () => {};
  }

  const qCh = supabase.channel(`rt-q-${companyId}`)
    .on('postgres_changes' as any, {
      event:'*', schema:'public', table:'queue',
      filter:`company_id=eq.${coUuid}`,
    }, (payload: any) => {
      const r = payload.new ?? payload.old; if (!r) return;
      const sec  = db.getFirstSync<{ id:number; title:string }>(
        `SELECT id,title FROM service_sections WHERE uuid_id=?`,[r.service_section_id]);
      const srv  = r.served_by
        ? db.getFirstSync<{ id:number; full_name:string }>(
            `SELECT id,full_name FROM users WHERE uuid_id=?`,[r.served_by])
        : null;
      const ex   = db.getFirstSync<{ id:number }>(`SELECT id FROM queue WHERE uuid_id=?`,[r.id]);

      if (payload.eventType === 'DELETE') {
        try { db.runSync(`DELETE FROM queue WHERE uuid_id=?`,[r.id]); } catch { /* ok */ }
      } else if (ex) {
        db.runSync(
          `UPDATE queue SET status=?,desk=?,served_by=?,called_at=?,completed_at=?,wait_time_seconds=?,priority=? WHERE uuid_id=?`,
          [r.status,r.desk,srv?.id??null,r.called_at,r.completed_at,r.wait_time_seconds,r.priority??'normal',r.id]
        );
      } else {
        db.runSync(`
          INSERT OR IGNORE INTO queue
            (uuid_id,company_id,ticket_number,prefix,customer_name,customer_contact,
             service_section_id,status,priority,desk,served_by,created_at,called_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [r.id,companyId,r.ticket_number,r.prefix,r.customer_name,r.customer_contact,
            sec?.id??null,r.status,r.priority??'normal',r.desk,srv?.id??null,r.created_at,r.called_at]);
      }

      if (r.status === 'calling' && payload.eventType === 'UPDATE') {
        bus.emit(EVENTS.TICKET_CALLED, {
          ticketNumber: r.ticket_number,
          desk:         r.desk ?? 'Estación',
          sectionTitle: sec?.title ?? 'General',
          servedBy:     srv?.full_name ?? 'Empleado',
          priority:     r.priority ?? 'normal',
        });
        onTicketCalled?.(r.ticket_number, r.desk ?? '', sec?.title ?? 'General');
      }
      bus.emit(EVENTS.QUEUE_UPDATED, null);
    })
    .subscribe(s => { if (s === 'SUBSCRIBED') console.log('[Sync] RT queue activo'); });

  const sCh = supabase.channel(`rt-sec-${companyId}`)
    .on('postgres_changes' as any, {
      event:'*', schema:'public', table:'service_sections',
      filter:`company_id=eq.${coUuid}`,
    }, (payload: any) => {
      const r = payload.new; if (!r) return;
      const ex = db.getFirstSync<{ id:number }>(
        `SELECT id FROM service_sections WHERE uuid_id=?`,[r.id]
      );
      if (ex) {
        db.runSync(
          `UPDATE service_sections SET title=?,description=?,avg_time_minutes=?,color=?,is_active=? WHERE uuid_id=?`,
          [r.title,r.description??'',r.avg_time_minutes,r.color,r.is_active?1:0,r.id]
        );
      } else if (r.is_active) {
        db.runSync(`
          INSERT OR IGNORE INTO service_sections
            (uuid_id,company_id,title,description,avg_time_minutes,prefix,color,is_active,created_at)
          VALUES (?,?,?,?,?,?,?,?,?)
        `, [r.id,companyId,r.title,r.description??'',r.avg_time_minutes,r.prefix,r.color,r.is_active?1:0,r.created_at]);
        console.log('[Sync] RT: nueva sección recibida:', r.title);
      }
      bus.emit(EVENTS.QUEUE_UPDATED, null);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(qCh);
    supabase.removeChannel(sCh);
  };
}