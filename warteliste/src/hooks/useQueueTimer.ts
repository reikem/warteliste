/**
 * Warteliste — useQueueTimer v2
 * Hook para Kiosko/PrintPreview: actualiza en tiempo real la posición
 * del cliente en la cola. Compatible con uuid_id.
 *
 * Ubicación: hooks/useQueueTimer.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { bus, EVENTS } from '../../service/eventBus';
import { getDatabase } from '../../service/database';


export interface QueueTimerResult {
  position:             number;
  ahead:                number;
  estimatedWaitMinutes: number;
  elapsedSeconds:       number;
  elapsedFormatted:     string;
  isNext:               boolean;
  isCalled:             boolean;
}

export function useQueueTimer(
  ticketId: number | null,
  sectionAvgTimeMinutes = 10,
): QueueTimerResult {
  const [position, setPosition] = useState(0);
  const [ahead, setAhead]       = useState(0);
  const [elapsed, setElapsed]   = useState(0);
  const [isCalled, setIsCalled] = useState(false);

  const refresh = useCallback(() => {
    if (!ticketId) return;
    try {
      const db = getDatabase();

      const mine = db.getFirstSync<{
        status: string; created_at: string;
        service_section_id: number | null; priority: string;
      }>(
        `SELECT status, created_at, service_section_id, COALESCE(priority,'normal') as priority
         FROM queue WHERE id = ?`, [ticketId]
      );
      if (!mine) return;

      if (mine.status === 'calling' || mine.status === 'serving') {
        setIsCalled(true); setAhead(0); setPosition(0); return;
      }

      const aheadRow = db.getFirstSync<{ count: number }>(`
        SELECT COUNT(*) as count FROM queue
        WHERE status = 'waiting'
          AND service_section_id IS ?
          AND (
            CASE COALESCE(priority,'normal')
              WHEN 'urgent' THEN 0 WHEN 'vip' THEN 1
              WHEN 'senior' THEN 2 ELSE 3
            END
            <
            CASE ?
              WHEN 'urgent' THEN 0 WHEN 'vip' THEN 1
              WHEN 'senior' THEN 2 ELSE 3
            END
            OR (
              CASE COALESCE(priority,'normal')
                WHEN 'urgent' THEN 0 WHEN 'vip' THEN 1
                WHEN 'senior' THEN 2 ELSE 3
              END
              =
              CASE ?
                WHEN 'urgent' THEN 0 WHEN 'vip' THEN 1
                WHEN 'senior' THEN 2 ELSE 3
              END
              AND created_at < ?
            )
          )
      `, [mine.service_section_id, mine.priority, mine.priority, mine.created_at]);

      const a = aheadRow?.count ?? 0;
      setAhead(a);
      setPosition(a + 1);
      setIsCalled(false);
    } catch { /* ok */ }
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId) return;
    refresh();
    const u1 = bus.on(EVENTS.QUEUE_UPDATED, refresh);
    const u2 = bus.on(EVENTS.TICKET_CALLED, refresh);
    return () => { u1(); u2(); };
  }, [ticketId, refresh]);

  useEffect(() => {
    if (!ticketId) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [ticketId]);

  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');

  return {
    position,
    ahead,
    estimatedWaitMinutes: Math.max(0, ahead * sectionAvgTimeMinutes),
    elapsedSeconds:       elapsed,
    elapsedFormatted:     `${mins}:${secs}`,
    isNext:               ahead <= 1 && !isCalled,
    isCalled,
  };
}