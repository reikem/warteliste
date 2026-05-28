/**
 * QueueMaster Pro — Queue Service
 * Ubicación: service/queueservice.ts
 */

import { getDatabase, Queue, ServiceSection, SectionAssignment, UserRole } from './database';
import { logAudit } from './authservice';
import { bus, EVENTS, TicketCalledPayload, TicketCreatedPayload } from './eventBus';

// ─── Queue queries ────────────────────────────────────────────────────────────

export function getWaitingQueue(): Queue[] {
  return getDatabase().getAllSync<Queue>(`
    SELECT q.*,
           ss.title AS section_title,
           ss.color AS section_color,
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
  const waiting    = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM queue WHERE status IN ('waiting','calling')`);
  const serving    = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM queue WHERE status = 'serving'`);
  const completed  = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM queue WHERE status = 'completed' AND date(completed_at) = date('now')`);
  const avgWait    = db.getFirstSync<{ avg: number | null }>(`SELECT AVG(wait_time_seconds) as avg FROM queue WHERE status = 'completed' AND date(completed_at) = date('now')`);
  return {
    waiting:          waiting?.count ?? 0,
    serving:          serving?.count ?? 0,
    completed_today:  completed?.count ?? 0,
    avg_wait_seconds: Math.round(avgWait?.avg ?? 0),
  };
}

export function getRecentCompleted(limit = 5): Queue[] {
  return getDatabase().getAllSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color
    FROM queue q
    LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    WHERE q.status = 'completed'
    ORDER BY q.completed_at DESC LIMIT ?
  `, [limit]);
}

// ─── Kiosk: crear ticket ──────────────────────────────────────────────────────

export function createTicket(
  customerName: string,
  serviceSectionId: number | null,
  customerContact?: string
): Queue | null {
  const db = getDatabase();

  let prefix = 'A';
  let sectionTitle = 'General';
  let avgTime = 10;

  if (serviceSectionId) {
    const section = db.getFirstSync<{ prefix: string; title: string; avg_time_minutes: number }>(
      `SELECT prefix, title, avg_time_minutes FROM service_sections WHERE id = ?`,
      [serviceSectionId]
    );
    if (section) {
      prefix = section.prefix;
      sectionTitle = section.title;
      avgTime = section.avg_time_minutes;
    }
  }

  const configKey = `ticket_counter_${prefix}`;
  const current = db.getFirstSync<{ value: string }>(`SELECT value FROM system_config WHERE key = ?`, [configKey]);
  const nextNum = (parseInt(current?.value ?? '0') + 1);
  db.runSync(`UPDATE system_config SET value = ?, updated_at = datetime('now') WHERE key = ?`, [nextNum.toString(), configKey]);

  const ticketNumber = `${prefix}-${nextNum.toString().padStart(3, '0')}`;

  const result = db.runSync(
    `INSERT INTO queue (ticket_number, prefix, customer_name, customer_contact, service_section_id)
     VALUES (?, ?, ?, ?, ?)`,
    [ticketNumber, prefix, customerName, customerContact ?? null, serviceSectionId]
  );

  const ticket = db.getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color
    FROM queue q LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    WHERE q.id = ?
  `, [result.lastInsertRowId]);

  if (ticket) {
    const waitingCount = db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM queue WHERE status = 'waiting'`);
    const payload: TicketCreatedPayload = {
      ticketNumber,
      customerName,
      sectionTitle,
      waitingCount: waitingCount?.count ?? 1,
    };
    bus.emit(EVENTS.TICKET_CREATED, payload);
    bus.emit(EVENTS.QUEUE_UPDATED, null);
  }

  return ticket;
}

// ─── Dashboard: llamar siguiente turno ───────────────────────────────────────

export function callNextTicket(userId: number, desk: string): Queue | null {
  const db = getDatabase();

  // Completar el turno actual si existe
  db.runSync(`
    UPDATE queue SET
      status = 'completed',
      completed_at = datetime('now'),
      wait_time_seconds = CAST((julianday('now') - julianday(created_at)) * 86400 AS INTEGER)
    WHERE status IN ('serving','calling') AND served_by = ?
  `, [userId]);

  // Tomar el siguiente en espera
  const next = db.getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color
    FROM queue q
    LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    WHERE q.status = 'waiting'
    ORDER BY q.created_at ASC LIMIT 1
  `);

  if (!next) return null;

  db.runSync(`
    UPDATE queue SET status = 'calling', desk = ?, served_by = ?, called_at = datetime('now')
    WHERE id = ?
  `, [desk, userId, next.id]);

  logAudit('TICKET_CALLED', 'queue', userId, next.id, `Ticket: ${next.ticket_number}`);

  const updated = db.getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color,
           u.full_name AS served_by_name, u.station
    FROM queue q
    LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    LEFT JOIN users u ON u.id = ?
    WHERE q.id = ?
  `, [userId, next.id]);

  const userInfo = db.getFirstSync<{ full_name: string }>(`SELECT full_name FROM users WHERE id = ?`, [userId]);

  if (updated) {
    const payload: TicketCalledPayload = {
      ticketNumber: updated.ticket_number,
      desk,
      sectionTitle: updated.section_title ?? 'General',
      servedBy: userInfo?.full_name ?? 'Empleado',
    };
    bus.emit(EVENTS.TICKET_CALLED, payload);
    bus.emit(EVENTS.QUEUE_UPDATED, null);
  }

  return updated ?? next;
}

export function repeatCall(ticketId: number, userId: number): Queue | null {
  const db = getDatabase();
  const ticket = db.getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title
    FROM queue q LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    WHERE q.id = ? AND q.served_by = ?
  `, [ticketId, userId]);

  if (!ticket) return null;

  const userInfo = db.getFirstSync<{ full_name: string; station: string }>(`SELECT full_name, station FROM users WHERE id = ?`, [userId]);
  const payload: TicketCalledPayload = {
    ticketNumber: ticket.ticket_number,
    desk: ticket.desk ?? 'Desk',
    sectionTitle: ticket.section_title ?? 'General',
    servedBy: userInfo?.full_name ?? 'Empleado',
  };
  bus.emit(EVENTS.TICKET_CALLED, payload);
  logAudit('TICKET_REPEAT', 'queue', userId, ticketId);
  return ticket;
}

export function completeTicket(ticketId: number, userId: number): boolean {
  getDatabase().runSync(`
    UPDATE queue SET
      status = 'completed',
      completed_at = datetime('now'),
      wait_time_seconds = CAST((julianday('now') - julianday(created_at)) * 86400 AS INTEGER)
    WHERE id = ? AND served_by = ?
  `, [ticketId, userId]);
  logAudit('TICKET_COMPLETED', 'queue', userId, ticketId);
  bus.emit(EVENTS.QUEUE_UPDATED, null);
  return true;
}

export function markNoShow(ticketId: number, userId: number): boolean {
  getDatabase().runSync(`
    UPDATE queue SET status = 'no_show', completed_at = datetime('now') WHERE id = ?
  `, [ticketId]);
  logAudit('TICKET_NO_SHOW', 'queue', userId, ticketId);
  bus.emit(EVENTS.QUEUE_UPDATED, null);
  return true;
}

// ─── Service Sections ─────────────────────────────────────────────────────────

export function getServiceSections(): ServiceSection[] {
  return getDatabase().getAllSync<ServiceSection>(`
    SELECT ss.*,
           COUNT(sa.user_id) AS staff_count
    FROM service_sections ss
    LEFT JOIN section_assignments sa ON sa.section_id = ss.id
    WHERE ss.is_active = 1
    GROUP BY ss.id
    ORDER BY ss.prefix ASC
  `);
}

export function createSection(title: string, description: string, avgTime: number, prefix: string, color: string): ServiceSection | null {
  const db = getDatabase();
  // Verificar prefijo único
  const existing = db.getFirstSync<{ id: number }>(`SELECT id FROM service_sections WHERE prefix = ? AND is_active = 1`, [prefix]);
  if (existing) throw new Error(`Ya existe una sección con el prefijo "${prefix}"`);

  const result = db.runSync(
    `INSERT INTO service_sections (title, description, avg_time_minutes, prefix, color) VALUES (?, ?, ?, ?, ?)`,
    [title, description, avgTime, prefix.toUpperCase(), color]
  );
  // Inicializar counter
  db.runSync(`INSERT OR IGNORE INTO system_config (key, value) VALUES (?, '0')`, [`ticket_counter_${prefix.toUpperCase()}`]);

  return db.getFirstSync<ServiceSection>(`SELECT * FROM service_sections WHERE id = ?`, [result.lastInsertRowId]);
}

export function updateSection(id: number, title: string, description: string, avgTime: number, color: string): boolean {
  getDatabase().runSync(
    `UPDATE service_sections SET title=?, description=?, avg_time_minutes=?, color=? WHERE id=?`,
    [title, description, avgTime, color, id]
  );
  return true;
}

export function deleteSection(id: number): boolean {
  getDatabase().runSync(`UPDATE service_sections SET is_active = 0 WHERE id = ?`, [id]);
  return true;
}

// ─── Section Assignments ──────────────────────────────────────────────────────

export function getSectionAssignments(): SectionAssignment[] {
  return getDatabase().getAllSync<SectionAssignment>(`
    SELECT sa.*,
           u.full_name AS user_name,
           u.email AS user_email,
           ss.title AS section_title
    FROM section_assignments sa
    JOIN users u ON u.id = sa.user_id
    JOIN service_sections ss ON ss.id = sa.section_id
    ORDER BY ss.title, u.full_name
  `);
}

export function assignEmployeeToSection(userId: number, sectionId: number): boolean {
  getDatabase().runSync(
    `INSERT OR IGNORE INTO section_assignments (user_id, section_id) VALUES (?, ?)`,
    [userId, sectionId]
  );
  return true;
}

export function removeEmployeeFromSection(userId: number, sectionId: number): boolean {
  getDatabase().runSync(
    `DELETE FROM section_assignments WHERE user_id = ? AND section_id = ?`,
    [userId, sectionId]
  );
  return true;
}

export function getEmployees() {
  return getDatabase().getAllSync<{ id: number; full_name: string; email: string; station: string | null }>(`
    SELECT id, full_name, email, station FROM users WHERE role = 'employee' AND is_active = 1 ORDER BY full_name
  `);
}

// ─── Config ───────────────────────────────────────────────────────────────────

export function getSystemConfig(key: string): string | null {
  const row = getDatabase().getFirstSync<{ value: string }>(`SELECT value FROM system_config WHERE key = ?`, [key]);
  return row?.value ?? null;
}

export function setSystemConfig(key: string, value: string): void {
  getDatabase().runSync(
    `INSERT INTO system_config (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, value]
  );
}