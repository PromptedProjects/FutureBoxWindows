/** All WebSocket message types */
export type WSMessageType =
  // Client → Server
  | 'chat.send'
  | 'chat.cancel'
  | 'action.approve'
  | 'action.deny'
  | 'ping'
  // Server → Client
  | 'chat.token'
  | 'chat.done'
  | 'chat.error'
  | 'notification.action'
  | 'notification.info'
  | 'status.update'
  | 'pong';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  id: string;        // Message ID for correlation
  payload: T;
  timestamp: string; // ISO-8601
}

// --- Client payloads ---

export interface ChatSendPayload {
  message: string;
  conversation_id?: string;
}

export interface ActionDecisionPayload {
  action_id: string;
}

// --- Server payloads ---

export interface ChatTokenPayload {
  conversation_id: string;
  token: string;
}

export interface ChatDonePayload {
  conversation_id: string;
  message_id: string;
  content: string;
  model?: string;
}

export interface ChatErrorPayload {
  conversation_id?: string;
  error: string;
}

export function createWSMessage<T>(type: WSMessageType, id: string, payload: T): WSMessage<T> {
  return { type, id, payload, timestamp: new Date().toISOString() };
}
