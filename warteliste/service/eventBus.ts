/**
 * Warteliste — Event Bus
 * Comunicación en tiempo real entre pantallas sin servidor.
 * Monitor, Dashboard y Kiosko escuchan eventos entre sí.
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

export const EVENTS = {
  TICKET_CALLED:    'ticket:called',
  TICKET_COMPLETED: 'ticket:completed',
  TICKET_CREATED:   'ticket:created',
  QUEUE_UPDATED:    'queue:updated',    // cualquier cambio en la cola o secciones
} as const;

export interface TicketCalledPayload {
  ticketNumber: string;
  desk: string;
  sectionTitle: string;
  servedBy: string;
  priority?: string;
}

export interface TicketCreatedPayload {
  ticketNumber: string;
  customerName: string;
  sectionTitle: string;
  waitingCount: number;
}