/**
 * Warteliste — Queue Service v3
 * DUAL WRITE con UUID: SQLite usa INTEGER id, Supabase usa uuid_id.
 * Cada INSERT local genera un uuid_id → se envía ese UUID a Supabase.
 *
 * Ubicación: service/queueservice.ts
 */

import { getDatabase, Queue, ServiceSection, SectionAssignment } from './database';
import { logAudit } from './authservice';
import { bus, EVENTS, TicketCalledPayload, TicketCreatedPayload } from './eventBus';
import { syncToSupabase, generateUUID } from './syncService';

// ─── company activo ───────────────────────────────────────────────────────────

let _companyId   = 1;
let _companyUuid = '';

export function setActiveCompanyId(id: number) {
  _companyId = id;
  try {
    const row = getDatabase().getFirstSync<{ uuid_id: string }>(
      `SELECT uuid_id FROM companies WHERE id = ?`, [id]
    );
    _companyUuid = row?.uuid_id ?? '';
  } catch { _companyUuid = ''; }
}
export function getActiveCompanyId():   number { return _companyId; }
export function getActiveCompanyUuid(): string { return _companyUuid; }

// ─── helpers UUID de entidades ────────────────────────────────────────────────

function uuidOf(table: string, localId: number | null | undefined): string | null {
  if (!localId) return null;
  try {
    return getDatabase().getFirstSync<{ uuid_id: string }>(
      `SELECT uuid_id FROM ${table} WHERE id = ?`, [localId]
    )?.uuid_id ?? null;
  } catch { return null; }
}

// ─── Config ───────────────────────────────────────────────────────────────────

export function getSystemConfig(key: string): string | null {
  try {
    const r = getDatabase().getFirstSync<{ value: string }>(
      `SELECT value FROM company_config WHERE company_id = ? AND key = ?`,
      [_companyId, key]
    );
    if (r) return r.value;
  } catch { /* ok */ }
  try {
    return getDatabase().getFirstSync<{ value: string }>(
      `SELECT value FROM system_config WHERE key = ?`, [key]
    )?.value ?? null;
  } catch { return null; }
}

export function setSystemConfig(key: string, value: string): void {
  try {
    getDatabase().runSync(
      `INSERT INTO company_config (company_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT(company_id, key)
       DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [_companyId, key, value]
    );
    if (_companyUuid) {
      syncToSupabase('system_config', 'INSERT', {
        company_id: _companyUuid, key, value,
      }).catch(() => {});
    }
  } catch { /* ok */ }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function getWaitingQueue(): Queue[] {
  return getDatabase().getAllSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color,
           u.full_name AS served_by_name
    FROM queue q
    LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    LEFT JOIN users u ON q.served_by = u.id
    WHERE q.status IN ('waiting','calling','serving')
    ORDER BY q.created_at ASC
  `);
}

export function getActiveTicketForEmployee(userId: number): Queue | null {
  return getDatabase().getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color
    FROM queue q
    LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    WHERE q.served_by = ? AND q.status IN ('calling','serving')
    ORDER BY q.called_at DESC LIMIT 1
  `, [userId]);
}

export function getQueueStats() {
  const db = getDatabase();
  const w  = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM queue WHERE status IN ('waiting','calling')`);
  const s  = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM queue WHERE status = 'serving'`);
  const c  = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM queue WHERE status = 'completed' AND date(completed_at) = date('now')`);
  const a  = db.getFirstSync<{ avg: number | null }>(`SELECT AVG(wait_time_seconds) as avg FROM queue WHERE status = 'completed' AND date(completed_at) = date('now')`);
  return { waiting: w?.count??0, serving: s?.count??0, completed_today: c?.count??0, avg_wait_seconds: Math.round(a?.avg??0) };
}

export function getRecentCompleted(limit = 5): Queue[] {
  return getDatabase().getAllSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color
    FROM queue q LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    WHERE q.status = 'completed' ORDER BY q.completed_at DESC LIMIT ?
  `, [limit]);
}

// ─── Crear ticket ─────────────────────────────────────────────────────────────

export function createTicket(
  customerName: string,
  serviceSectionId: number | null,
  customerContact?: string,
): Queue | null {
  const db     = getDatabase();
  let prefix   = 'A';
  let secTitle = 'General';

  if (serviceSectionId) {
    const sec = db.getFirstSync<{ prefix: string; title: string }>(
      `SELECT prefix, title FROM service_sections WHERE id = ?`, [serviceSectionId]
    );
    if (sec) { prefix = sec.prefix; secTitle = sec.title; }
  }

  const nextNum  = (parseInt(getSystemConfig(`ticket_counter_${prefix}`) ?? '0') + 1);
  setSystemConfig(`ticket_counter_${prefix}`, nextNum.toString());

  const ticketNumber = `${prefix}-${nextNum.toString().padStart(3,'0')}`;
  const uuid         = generateUUID();
  const now          = new Date().toISOString();

  const result = db.runSync(
    `INSERT INTO queue
       (uuid_id, company_id, ticket_number, prefix, customer_name,
        customer_contact, service_section_id, status, priority, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', 'normal', ?)`,
    [uuid, _companyId, ticketNumber, prefix, customerName,
     customerContact ?? null, serviceSectionId, now]
  );

  const ticket = db.getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color
    FROM queue q LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    WHERE q.id = ?
  `, [result.lastInsertRowId]);

  if (ticket && _companyUuid) {
    syncToSupabase('queue', 'INSERT', {
      id:                 uuid,          // UUID para Supabase
      company_id:         _companyUuid,
      ticket_number:      ticketNumber,
      prefix,
      customer_name:      customerName,
      customer_contact:   customerContact ?? null,
      service_section_id: uuidOf('service_sections', serviceSectionId),
      status:             'waiting',
      priority:           'normal',
      created_at:         now,
    }).catch(() => {});
  }

  const wc = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM queue WHERE status = 'waiting'`);
  bus.emit(EVENTS.TICKET_CREATED, { ticketNumber, customerName, sectionTitle: secTitle, waitingCount: wc?.count??1 } as TicketCreatedPayload);
  bus.emit(EVENTS.QUEUE_UPDATED, null);

  return ticket;
}

// ─── Llamar siguiente ─────────────────────────────────────────────────────────

export function callNextTicket(userId: number, desk: string): Queue | null {
  const db  = getDatabase();
  const now = new Date().toISOString();

  // Completar turno anterior
  const prev = db.getFirstSync<{ id: number; uuid_id: string }>(
    `SELECT id, uuid_id FROM queue WHERE status IN ('serving','calling') AND served_by = ? LIMIT 1`,
    [userId]
  );
  if (prev) {
    db.runSync(`
      UPDATE queue SET status='completed', completed_at=?,
        wait_time_seconds=CAST((julianday(?)-julianday(created_at))*86400 AS INTEGER)
      WHERE id=?
    `, [now, now, prev.id]);
    const wt = db.getFirstSync<{ wait_time_seconds: number }>(`SELECT wait_time_seconds FROM queue WHERE id=?`, [prev.id]);
    if (prev.uuid_id) {
      syncToSupabase('queue','UPDATE',{ id: prev.uuid_id, status:'completed', completed_at:now, wait_time_seconds: wt?.wait_time_seconds }).catch(()=>{});
    }
  }

  const next = db.getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color
    FROM queue q LEFT JOIN service_sections ss ON q.service_section_id=ss.id
    WHERE q.status='waiting' ORDER BY q.created_at ASC LIMIT 1
  `);
  if (!next) return null;

  db.runSync(
    `UPDATE queue SET status='calling', desk=?, served_by=?, called_at=? WHERE id=?`,
    [desk, userId, now, next.id]
  );

  if (next.uuid_id) {
    syncToSupabase('queue','UPDATE',{
      id:         next.uuid_id,
      status:     'calling',
      desk,
      served_by:  uuidOf('users', userId),
      called_at:  now,
    }).catch(()=>{});
  }

  logAudit('TICKET_CALLED','queue',userId,next.id,`Ticket: ${next.ticket_number}`);

  const updated = db.getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color, u.full_name AS served_by_name
    FROM queue q
    LEFT JOIN service_sections ss ON q.service_section_id=ss.id
    LEFT JOIN users u ON u.id=q.served_by
    WHERE q.id=?
  `, [next.id]);

  if (updated) {
    bus.emit(EVENTS.TICKET_CALLED, {
      ticketNumber: updated.ticket_number,
      desk,
      sectionTitle: updated.section_title ?? 'General',
      servedBy:     updated.served_by_name ?? 'Empleado',
    } as TicketCalledPayload);
    bus.emit(EVENTS.QUEUE_UPDATED, null);
  }
  return updated ?? next;
}

export function repeatCall(ticketId: number, userId: number): Queue | null {
  const db     = getDatabase();
  const ticket = db.getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title
    FROM queue q LEFT JOIN service_sections ss ON q.service_section_id=ss.id
    WHERE q.id=? AND q.served_by=?
  `, [ticketId, userId]);
  if (!ticket) return null;
  const ui = db.getFirstSync<{ full_name: string }>(`SELECT full_name FROM users WHERE id=?`,[userId]);
  bus.emit(EVENTS.TICKET_CALLED, {
    ticketNumber: ticket.ticket_number,
    desk:         ticket.desk ?? 'Desk',
    sectionTitle: ticket.section_title ?? 'General',
    servedBy:     ui?.full_name ?? 'Empleado',
  } as TicketCalledPayload);
  logAudit('TICKET_REPEAT','queue',userId,ticketId);
  return ticket;
}

export function completeTicket(ticketId: number, userId: number): boolean {
  const now = new Date().toISOString();
  const db  = getDatabase();
  db.runSync(`
    UPDATE queue SET status='completed', completed_at=?,
      wait_time_seconds=CAST((julianday(?)-julianday(created_at))*86400 AS INTEGER)
    WHERE id=? AND served_by=?
  `, [now, now, ticketId, userId]);
  const t = db.getFirstSync<{ uuid_id: string; wait_time_seconds: number }>(`SELECT uuid_id, wait_time_seconds FROM queue WHERE id=?`,[ticketId]);
  if (t?.uuid_id) syncToSupabase('queue','UPDATE',{ id:t.uuid_id, status:'completed', completed_at:now, wait_time_seconds:t.wait_time_seconds }).catch(()=>{});
  logAudit('TICKET_COMPLETED','queue',userId,ticketId);
  bus.emit(EVENTS.QUEUE_UPDATED,null);
  return true;
}

export function markNoShow(ticketId: number, userId: number): boolean {
  const now = new Date().toISOString();
  getDatabase().runSync(`UPDATE queue SET status='no_show', completed_at=? WHERE id=?`,[now,ticketId]);
  const t = getDatabase().getFirstSync<{ uuid_id: string }>(`SELECT uuid_id FROM queue WHERE id=?`,[ticketId]);
  if (t?.uuid_id) syncToSupabase('queue','UPDATE',{ id:t.uuid_id, status:'no_show', completed_at:now }).catch(()=>{});
  logAudit('TICKET_NO_SHOW','queue',userId,ticketId);
  bus.emit(EVENTS.QUEUE_UPDATED,null);
  return true;
}

// ─── Secciones ────────────────────────────────────────────────────────────────

export function getServiceSections(): ServiceSection[] {
  return getDatabase().getAllSync<ServiceSection>(`
    SELECT ss.*, COUNT(sa.user_id) AS staff_count
    FROM service_sections ss
    LEFT JOIN section_assignments sa ON sa.section_id=ss.id
    WHERE ss.is_active=1 GROUP BY ss.id ORDER BY ss.prefix ASC
  `);
}

export function createSection(title: string, description: string, avgTime: number, prefix: string, color: string): ServiceSection | null {
  const db  = getDatabase();
  const ex  = db.getFirstSync<{ id: number }>(
    `SELECT id FROM service_sections WHERE prefix=? AND is_active=1 AND company_id=?`,
    [prefix, _companyId]
  );
  if (ex) throw new Error(`Ya existe una sección con el prefijo "${prefix}"`);

  const uuid = generateUUID();
  const now  = new Date().toISOString();
  const res  = db.runSync(
    `INSERT INTO service_sections (uuid_id,company_id,title,description,avg_time_minutes,prefix,color,created_at) VALUES (?,?,?,?,?,?,?,?)`,
    [uuid, _companyId, title, description, avgTime, prefix.toUpperCase(), color, now]
  );
  setSystemConfig(`ticket_counter_${prefix.toUpperCase()}`, '0');

  const section = db.getFirstSync<ServiceSection>(`SELECT * FROM service_sections WHERE id=?`,[res.lastInsertRowId]);
  if (section && _companyUuid) {
    syncToSupabase('service_sections','INSERT',{
      id: uuid, company_id: _companyUuid,
      title, description, avg_time_minutes: avgTime,
      prefix: prefix.toUpperCase(), color, is_active: true, created_at: now,
    }).catch(()=>{});
  }
  return section;
}

export function updateSection(id: number, title: string, description: string, avgTime: number, color: string): boolean {
  getDatabase().runSync(
    `UPDATE service_sections SET title=?,description=?,avg_time_minutes=?,color=? WHERE id=?`,
    [title, description, avgTime, color, id]
  );
  const uuid = uuidOf('service_sections', id);
  if (uuid) syncToSupabase('service_sections','UPDATE',{ id:uuid, title, description, avg_time_minutes:avgTime, color }).catch(()=>{});
  return true;
}

export function deleteSection(id: number): boolean {
  getDatabase().runSync(`UPDATE service_sections SET is_active=0 WHERE id=?`,[id]);
  const uuid = uuidOf('service_sections', id);
  if (uuid) syncToSupabase('service_sections','UPDATE',{ id:uuid, is_active:false }).catch(()=>{});
  return true;
}

// ─── Asignaciones ─────────────────────────────────────────────────────────────

export function getSectionAssignments(): SectionAssignment[] {
  return getDatabase().getAllSync<SectionAssignment>(`
    SELECT sa.*, u.full_name AS user_name, u.email AS user_email, ss.title AS section_title
    FROM section_assignments sa
    JOIN users u ON u.id=sa.user_id
    JOIN service_sections ss ON ss.id=sa.section_id
    ORDER BY ss.title, u.full_name
  `);
}

export function assignEmployeeToSection(userId: number, sectionId: number): boolean {
  const now  = new Date().toISOString();
  const uuid = generateUUID();
  getDatabase().runSync(
    `INSERT OR IGNORE INTO section_assignments (uuid_id,user_id,section_id,assigned_at) VALUES (?,?,?,?)`,
    [uuid, userId, sectionId, now]
  );
  const uuUser = uuidOf('users', userId);
  const uuSec  = uuidOf('service_sections', sectionId);
  if (uuUser && uuSec) {
    syncToSupabase('section_assignments','INSERT',{ id:uuid, user_id:uuUser, section_id:uuSec, assigned_at:now }).catch(()=>{});
  }
  return true;
}

export function removeEmployeeFromSection(userId: number, sectionId: number): boolean {
  const row = getDatabase().getFirstSync<{ uuid_id: string }>(
    `SELECT uuid_id FROM section_assignments WHERE user_id=? AND section_id=?`,[userId,sectionId]
  );
  getDatabase().runSync(`DELETE FROM section_assignments WHERE user_id=? AND section_id=?`,[userId,sectionId]);
  if (row?.uuid_id) syncToSupabase('section_assignments','DELETE',{ id:row.uuid_id }).catch(()=>{});
  return true;
}

export function getEmployees() {
  return getDatabase().getAllSync<{ id: number; full_name: string; email: string; station: string | null }>(
    `SELECT id, full_name, email, station FROM users WHERE role='employee' AND is_active=1 ORDER BY full_name`
  );
}