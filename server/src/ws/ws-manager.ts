import type { WebSocket } from 'ws';
import type { WSMessage } from './ws-protocol.js';

interface WSClient {
  socket: WebSocket;
  sessionId: string;
  connectedAt: Date;
}

class WSManager {
  private clients = new Map<string, WSClient>();

  add(sessionId: string, socket: WebSocket): void {
    this.clients.set(sessionId, { socket, sessionId, connectedAt: new Date() });
  }

  remove(sessionId: string): void {
    this.clients.delete(sessionId);
  }

  get(sessionId: string): WSClient | undefined {
    return this.clients.get(sessionId);
  }

  /** Send a message to a specific session */
  send(sessionId: string, message: WSMessage): void {
    const client = this.clients.get(sessionId);
    if (client && client.socket.readyState === 1) { // WebSocket.OPEN
      client.socket.send(JSON.stringify(message));
    }
  }

  /** Broadcast to all connected clients */
  broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.socket.readyState === 1) {
        client.socket.send(data);
      }
    }
  }

  getConnectedCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WSManager();
