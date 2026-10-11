/**
 * Client-Side Real-Time WebSocket / Socket.io Event Bus
 * Provides socket.on() and socket.off() subscription pattern with automatic reconnect
 */

type SocketCallback = (data: any) => void;

class RealtimeSocket {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<SocketCallback>> = new Map();
  private reconnectTimer: any = null;
  private isConnecting: boolean = false;
  private pingInterval: any = null;

  constructor() {
    this.connect();
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      this.isConnecting = true;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        console.log('📡 [WebSocket] Terhubung ke server RKCE Real-Time:', wsUrl);
        this.trigger('_open', { status: 'connected' });

        // Heartbeat ping every 25 seconds
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 25000);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const packet = JSON.parse(event.data);
          const eventName = packet.event || packet.type;
          
          if (eventName) {
            this.trigger(eventName, packet);
          }
          // Also trigger universal listener
          this.trigger('*', packet);
        } catch (e) {
          // ignore non-json messages
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.trigger('_close', { status: 'disconnected' });
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        this.isConnecting = false;
        this.trigger('_error', err);
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  /**
   * Subscribe to event: socket.on("EVENT_NAME", callback)
   */
  public on(event: string, callback: SocketCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from event: socket.off("EVENT_NAME", callback)
   */
  public off(event: string, callback: SocketCallback): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Trigger registered event callbacks
   */
  private trigger(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[WebSocket] Error in handler for event "${event}":`, err);
        }
      });
    }
  }

  /**
   * Send packet to backend
   */
  public emit(event: string, data: any = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, ...data }));
    }
  }
}

// Global Singleton Instance
export const socket = new RealtimeSocket();
