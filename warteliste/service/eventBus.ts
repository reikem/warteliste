/**
 * QueueMaster Pro — Event Bus
 * Comunicación en tiempo real entre pantallas sin servidor.
 * Monitor escucha eventos de llamada de tickets desde Dashboard.
 *
 * Ubicación: service/eventBus.ts
 */

type EventHandler<T = any> = (data: T) => void;

class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    // Retorna función de cleanup
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit<T>(event: string, data: T): void {
    this.listeners.get(event)?.forEach(h => h(data));
  }
}

export const bus = new EventBus();

// ─── Eventos del sistema ──────────────────────────────────────────────────────

export const EVENTS = {
  TICKET_CALLED:    'ticket:called',    // Dashboard → Monitor
  TICKET_COMPLETED: 'ticket:completed', // Dashboard → Monitor
  TICKET_CREATED:   'ticket:created',   // Kiosk → Dashboard/Monitor
  QUEUE_UPDATED:    'queue:updated',    // Cualquier cambio de fila
} as const;

export interface TicketCalledPayload {
  ticketNumber: string;
  desk: string;
  sectionTitle: string;
  servedBy: string;
}

export interface TicketCreatedPayload {
  ticketNumber: string;
  customerName: string;
  sectionTitle: string;
  waitingCount: number;
}