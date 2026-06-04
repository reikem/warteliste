/**
 * Warteliste — Priority Queue Service v2
 * DUAL WRITE: usa uuid_id para sincronizar con Supabase.
 * Orden: urgent(0) > vip(1) > senior(2) > normal(3)
 *
 * Ubicación: service/priorityQueue.ts
 */

import { getDatabase, Queue, type TicketPriority } from './database';
import { logAudit } from './authservice';
import { bus, EVENTS, type TicketCalledPayload, type TicketCreatedPayload } from './eventBus';
import { syncToSupabase, generateUUID } from './syncService';
import {
  getActiveCompanyId,
  getActiveCompanyUuid,
  getSystemConfig,
  setSystemConfig,
} from './queueservice';

export type { TicketPriority };

export const PRIORITY_ORDER: Record<TicketPriority, number> = {
  urgent: 0, vip: 1, senior: 2, normal: 3,
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  urgent: 'Urgente', vip: 'VIP', senior: 'Adulto mayor', normal: 'Normal',
};

export const PRIORITY_ICONS: Record<TicketPriority, string> = {
  urgent: '🔴', vip: '⭐', senior: '♿', normal: '🟢',
};

// ─── Obtener cola ordenada por prioridad ──────────────────────────────────────

export function getWaitingQueueByPriority(): Queue[] {
  return getDatabase().getAllSync<Queue>(`
    SELECT q.*,
           ss.title AS section_title,
           ss.color AS section_color,
           CASE q.priority
             WHEN 'urgent' THEN 0 WHEN 'vip' THEN 1
             WHEN 'senior' THEN 2 ELSE 3
           END AS priority_order
    FROM queue q
    LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    WHERE q.status IN ('waiting','calling')
    ORDER BY priority_order ASC, q.created_at ASC
  `);
}

// ─── Crear ticket prioritario ─────────────────────────────────────────────────

export function createPriorityTicket(
  customerName: string,
  serviceSectionId: number | null,
  priority: TicketPriority = 'normal',
  customerContact?: string,
): Queue | null {
  const db          = getDatabase();
  const companyId   = getActiveCompanyId();
  const companyUuid = getActiveCompanyUuid();
  let   prefix      = 'A';
  let   secTitle    = 'General';

  if (serviceSectionId) {
    const sec = db.getFirstSync<{ prefix: string; title: string }>(
      `SELECT prefix, title FROM service_sections WHERE id = ?`, [serviceSectionId]
    );
    if (sec) { prefix = sec.prefix; secTitle = sec.title; }
  }

  const nextNum = (parseInt(getSystemConfig(`ticket_counter_${prefix}`) ?? '0') + 1);
  setSystemConfig(`ticket_counter_${prefix}`, nextNum.toString());

  const ticketNumber = `${prefix}-${nextNum.toString().padStart(3, '0')}`;
  const uuid         = generateUUID();
  const now          = new Date().toISOString();

  // Obtener uuid de sección
  const secUuid = serviceSectionId
    ? db.getFirstSync<{ uuid_id: string }>(
        `SELECT uuid_id FROM service_sections WHERE id = ?`, [serviceSectionId]
      )?.uuid_id ?? null
    : null;

  const result = db.runSync(
    `INSERT INTO queue
       (uuid_id, company_id, ticket_number, prefix, customer_name,
        customer_contact, service_section_id, status, priority, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?)`,
    [uuid, companyId, ticketNumber, prefix, customerName,
     customerContact ?? null, serviceSectionId, priority, now]
  );

  const ticket = db.getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color
    FROM queue q LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    WHERE q.id = ?
  `, [result.lastInsertRowId]);

  if (ticket && companyUuid) {
    syncToSupabase('queue', 'INSERT', {
      id:                 uuid,
      company_id:         companyUuid,
      ticket_number:      ticketNumber,
      prefix,
      customer_name:      customerName,
      customer_contact:   customerContact ?? null,
      service_section_id: secUuid,
      status:             'waiting',
      priority,
      created_at:         now,
    }).catch(() => {});
  }

  logAudit('TICKET_CREATED', 'queue', undefined, result.lastInsertRowId, `${ticketNumber} [${priority}]`);

  const wc = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM queue WHERE status = 'waiting'`
  );
  bus.emit(EVENTS.TICKET_CREATED, {
    ticketNumber, customerName, sectionTitle: secTitle, waitingCount: wc?.count ?? 1,
  } as TicketCreatedPayload);
  bus.emit(EVENTS.QUEUE_UPDATED, null);

  return ticket;
}

// ─── Llamar siguiente por prioridad ──────────────────────────────────────────

export function callNextByPriority(userId: number, desk: string): Queue | null {
  const db  = getDatabase();
  const now = new Date().toISOString();

  // Completar turno anterior del mismo empleado
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
    const wt = db.getFirstSync<{ wait_time_seconds: number }>(
      `SELECT wait_time_seconds FROM queue WHERE id=?`, [prev.id]
    );
    if (prev.uuid_id) {
      syncToSupabase('queue', 'UPDATE', {
        id: prev.uuid_id, status: 'completed',
        completed_at: now, wait_time_seconds: wt?.wait_time_seconds,
      }).catch(() => {});
    }
  }

  // Siguiente por prioridad + FIFO
  const next = db.getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color,
           CASE q.priority WHEN 'urgent' THEN 0 WHEN 'vip' THEN 1
                           WHEN 'senior' THEN 2 ELSE 3 END AS priority_order
    FROM queue q
    LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    WHERE q.status = 'waiting'
    ORDER BY priority_order ASC, q.created_at ASC LIMIT 1
  `);
  if (!next) return null;

  const userUuid = db.getFirstSync<{ uuid_id: string }>(
    `SELECT uuid_id FROM users WHERE id=?`, [userId]
  )?.uuid_id ?? null;

  db.runSync(
    `UPDATE queue SET status='calling', desk=?, served_by=?, called_at=? WHERE id=?`,
    [desk, userId, now, next.id]
  );

  if (next.uuid_id) {
    syncToSupabase('queue', 'UPDATE', {
      id:        next.uuid_id,
      status:    'calling',
      desk,
      served_by: userUuid,
      called_at: now,
    }).catch(() => {});
  }

  logAudit('TICKET_CALLED', 'queue', userId, next.id, `${next.ticket_number} [${(next as any).priority ?? 'normal'}]`);

  const updated = db.getFirstSync<Queue>(`
    SELECT q.*, ss.title AS section_title, ss.color AS section_color,
           u.full_name AS served_by_name
    FROM queue q
    LEFT JOIN service_sections ss ON q.service_section_id = ss.id
    LEFT JOIN users u ON u.id = q.served_by
    WHERE q.id = ?
  `, [next.id]);

  if (updated) {
    bus.emit(EVENTS.TICKET_CALLED, {
      ticketNumber: updated.ticket_number,
      desk,
      sectionTitle: updated.section_title ?? 'General',
      servedBy:     updated.served_by_name ?? 'Empleado',
      priority:     (updated as any).priority ?? 'normal',
    } as TicketCalledPayload & { priority?: string });
    bus.emit(EVENTS.QUEUE_UPDATED, null);
  }

  return updated ?? next;
}