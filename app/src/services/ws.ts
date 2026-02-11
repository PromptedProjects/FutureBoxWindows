import { uid } from '../utils/uid';
import { useAuthStore } from '../stores/auth.store';
import { useConnectionStore } from '../stores/connection.store';
import type {
  WSMessage,
  WSMessageType,
  ChatSendPayload,
  ActionDecisionPayload,
  ChatTokenPayload,
  ChatDonePayload,
  ChatErrorPayload,
  NotificationActionPayload,
  NotificationInfoPayload,
} from '../types/ws';

type Listener<T = unknown> = (payload: T) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private listeners = new Map<WSMessageType, Set<Listener>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30_000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;

  connect() {
    const { token, host } = useAuthStore.getState();
    if (!token || !host) return;

    this.intentionalClose = false;
    useConnectionStore.getState().setWSState('connecting');

    const protocol = host.startsWith('https') ? 'wss' : 'ws';
    const cleanHost = host.replace(/^https?:\/\//, '');
    const url = `${protocol}://${cleanHost}/ws?token=${token}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      useConnectionStore.getState().setWSState('connected');
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data as string);
        this.emit(msg.type, msg.payload);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.cleanup();
      useConnectionStore.getState().setWSState('disconnected');
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  disconnect() {
    this.intentionalClose = true;
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    useConnectionStore.getState().setWSState('disconnected');
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send('ping', {});
    }, 25_000);
  }

  private send<T>(type: WSMessageType, payload: T) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const msg: WSMessage<T> = {
      type,
      id: uid(),
      payload,
      timestamp: new Date().toISOString(),
    };
    this.ws.send(JSON.stringify(msg));
  }

  // --- Public send methods ---

  sendChat(message: string, conversationId?: string, images?: string[]) {
    const payload: ChatSendPayload = { message };
    if (conversationId) payload.conversation_id = conversationId;
    if (images?.length) payload.images = images;
    this.send('chat.send', payload);
  }

  cancelChat() {
    this.send('chat.cancel', {});
  }

  shellExec(tabId: string, command: string, cwd?: string) {
    this.send('shell.exec', { tab_id: tabId, command, cwd });
  }

  shellInput(tabId: string, data: string) {
    this.send('shell.input', { tab_id: tabId, data });
  }

  shellKill(tabId: string) {
    this.send('shell.kill', { tab_id: tabId });
  }

  shellResize(tabId: string, cols: number, rows: number) {
    this.send('shell.resize', { tab_id: tabId, cols, rows });
  }

  approveAction(actionId: string) {
    const payload: ActionDecisionPayload = { action_id: actionId };
    this.send('action.approve', payload);
  }

  denyAction(actionId: string) {
    const payload: ActionDecisionPayload = { action_id: actionId };
    this.send('action.deny', payload);
  }

  // --- Event listeners ---

  on<T = unknown>(type: WSMessageType, listener: Listener<T>) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener as Listener);
    return () => this.off(type, listener);
  }

  off<T = unknown>(type: WSMessageType, listener: Listener<T>) {
    this.listeners.get(type)?.delete(listener as Listener);
  }

  private emit(type: WSMessageType, payload: unknown) {
    this.listeners.get(type)?.forEach((fn) => fn(payload));
  }
}

// Singleton
export const wsManager = new WebSocketManager();

// Re-export payload types for convenience
export type {
  ChatTokenPayload,
  ChatDonePayload,
  ChatErrorPayload,
  NotificationActionPayload,
  NotificationInfoPayload,
};
