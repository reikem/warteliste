/**
 * QueueMaster Pro — Reports Service
 * Consultas para el panel de reportes del día (admin).
 * No requiere librerías externas — todo SQL sobre SQLite.
 *
 * Ubicación: service/reports.ts
 */

import { getDatabase } from './database';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DailySummary {
  totalServed:       number;
  totalNoShow:       number;
  totalWaiting:      number;
  avgWaitMinutes:    number;
  peakHour:          string;   // "10:00"
  peakHourCount:     number;
}

export interface SectionReport {
  sectionId:    number;
  title:        string;
  color:        string;
  prefix:       string;
  served:       number;
  noShow:       number;
  avgWaitMin:   number;
}

export interface HourlyBucket {
  hour:   string;   // "08:00"
  count:  number;
}

export interface PriorityBreakdown {
  priority: string;
  count:    number;
  percent:  number;
}

// ─── Resumen del día ──────────────────────────────────────────────────────────

export function getDailySummary(): DailySummary {
  const db = getDatabase();

  const served = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM queue
     WHERE status = 'completed' AND date(completed_at) = date('now')`
  );
  const noshow = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM queue
     WHERE status = 'no_show' AND date(completed_at) = date('now')`
  );
  const waiting = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM queue WHERE status IN ('waiting','calling','serving')`
  );
  const avgWait = db.getFirstSync<{ avg: number | null }>(
    `SELECT AVG(wait_time_seconds) as avg FROM queue
     WHERE status = 'completed' AND date(completed_at) = date('now')`
  );

  // Hora pico: agrupar llamados por hora
  const peakRow = db.getFirstSync<{ hour: string; count: number }>(
    `SELECT strftime('%H:00', called_at) as hour, COUNT(*) as count
     FROM queue
     WHERE called_at IS NOT NULL AND date(called_at) = date('now')
     GROUP BY hour ORDER BY count DESC LIMIT 1`
  );

  return {
    totalServed:    served?.count ?? 0,
    totalNoShow:    noshow?.count ?? 0,
    totalWaiting:   waiting?.count ?? 0,
    avgWaitMinutes: Math.round((avgWait?.avg ?? 0) / 60),
    peakHour:       peakRow?.hour ?? '--:--',
    peakHourCount:  peakRow?.count ?? 0,
  };
}

// ─── Reporte por sección ──────────────────────────────────────────────────────

export function getSectionReports(): SectionReport[] {
  return getDatabase().getAllSync<SectionReport>(`
    SELECT
      ss.id            AS sectionId,
      ss.title,
      ss.color,
      ss.prefix,
      COUNT(CASE WHEN q.status = 'completed' THEN 1 END) AS served,
      COUNT(CASE WHEN q.status = 'no_show'   THEN 1 END) AS noShow,
      ROUND(AVG(CASE WHEN q.wait_time_seconds IS NOT NULL
                     THEN q.wait_time_seconds / 60.0 END), 1) AS avgWaitMin
    FROM service_sections ss
    LEFT JOIN queue q
      ON q.service_section_id = ss.id
     AND date(q.completed_at) = date('now')
    WHERE ss.is_active = 1
    GROUP BY ss.id
    ORDER BY served DESC
  `);
}

// ─── Flujo por hora ───────────────────────────────────────────────────────────
// Devuelve buckets cada hora desde las 08:00 hasta las 20:00

export function getHourlyFlow(): HourlyBucket[] {
  const rows = getDatabase().getAllSync<{ hour: string; count: number }>(`
    SELECT strftime('%H:00', created_at) as hour, COUNT(*) as count
    FROM queue
    WHERE date(created_at) = date('now')
    GROUP BY hour
    ORDER BY hour ASC
  `);

  // Rellenar horas sin datos con 0
  const map = new Map(rows.map(r => [r.hour, r.count]));
  const buckets: HourlyBucket[] = [];
  for (let h = 8; h <= 20; h++) {
    const key = `${h.toString().padStart(2, '0')}:00`;
    buckets.push({ hour: key, count: map.get(key) ?? 0 });
  }
  return buckets;
}

// ─── Desglose por prioridad ───────────────────────────────────────────────────

export function getPriorityBreakdown(): PriorityBreakdown[] {
  const rows = getDatabase().getAllSync<{ priority: string; count: number }>(`
    SELECT COALESCE(priority, 'normal') as priority, COUNT(*) as count
    FROM queue
    WHERE date(created_at) = date('now')
    GROUP BY priority
    ORDER BY
      CASE priority WHEN 'urgent' THEN 0 WHEN 'vip' THEN 1
                    WHEN 'senior' THEN 2 ELSE 3 END
  `);

  const total = rows.reduce((sum, r) => sum + r.count, 0) || 1;
  return rows.map(r => ({
    priority: r.priority,
    count:    r.count,
    percent:  Math.round((r.count / total) * 100),
  }));
}

// ─── Tiempo de espera percentilar ─────────────────────────────────────────────

export function getWaitPercentiles(): { p50: number; p90: number; max: number } {
  const times = getDatabase().getAllSync<{ wait: number }>(`
    SELECT wait_time_seconds as wait FROM queue
    WHERE status = 'completed'
      AND wait_time_seconds IS NOT NULL
      AND date(completed_at) = date('now')
    ORDER BY wait_time_seconds ASC
  `).map(r => Math.round(r.wait / 60));

  if (!times.length) return { p50: 0, p90: 0, max: 0 };

  const p = (pct: number) => times[Math.floor((pct / 100) * (times.length - 1))];

  return {
    p50: p(50),
    p90: p(90),
    max: times[times.length - 1],
  };
}