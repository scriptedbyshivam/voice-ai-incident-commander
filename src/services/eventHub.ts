import { RealtimeEventName, RealtimeEventEnvelope } from '@/types/events';

/**
 * In-process realtime event hub.
 *
 * The analysis engine (and other services) emit typed events through this hub.
 * Transport adapters (e.g. the transcription WebSocket server, a future dedicated
 * dashboard WS) subscribe here and relay events to clients. This keeps event
 * emission decoupled from any specific transport so secrets never leak to browsers.
 */

type Listener<T extends RealtimeEventName> = (envelope: RealtimeEventEnvelope<T>) => void;

class RealtimeEventHub {
  private listeners = new Map<RealtimeEventName, Set<Listener<any>>>();

  on<T extends RealtimeEventName>(event: T, fn: Listener<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => {
      this.listeners.get(event)?.delete(fn);
    };
  }

  emit<T extends RealtimeEventName>(event: T, payload: RealtimeEventEnvelope<T>['payload']): void {
    const envelope: RealtimeEventEnvelope<T> = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((fn) => {
      try {
        fn(envelope);
      } catch (err) {
        console.error(`[EventHub] Listener error for ${event}:`, err);
      }
    });
  }

  emitToIncident<T extends RealtimeEventName>(
    incidentId: string,
    event: T,
    payload: RealtimeEventEnvelope<T>['payload'] & { incidentId?: string }
  ): void {
    this.emit(event, { ...payload, incidentId } as any);
  }
}

export const realtimeEventHub = new RealtimeEventHub();

// The transcription server can subscribe a broadcaster like this:
// realtimeEventHub.on('incident.updated', (e) => relay(incidentId, e));
