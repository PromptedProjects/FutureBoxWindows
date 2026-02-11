/** All WebSocket message types */
export type WSMessageType =
  // Client → Server
  | 'chat.send'
  | 'chat.cancel'
  | 'action.approve'
  | 'action.deny'
  | 'shell.exec'
  | 'shell.input'
  | 'shell.resize'
  | 'shell.kill'
  | 'screen.capture'
  | 'browser.command'
  | 'ping'
  // Server → Client
  | 'chat.token'
  | 'chat.tool_start'
  | 'chat.tool_result'
  | 'chat.done'
  | 'chat.error'
  | 'shell.output'
  | 'shell.exit'
  | 'screen.frame'
  | 'browser.result'
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
  images?: string[]; // base64-encoded images
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

export interface ChatToolStartPayload {
  conversation_id: string;
  tool_call_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
}

export interface ChatToolResultPayload {
  conversation_id: string;
  tool_call_id: string;
  tool_name: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// --- Shell payloads ---

export interface ShellExecPayload {
  tab_id: string;
  command: string;
  cwd?: string;
}

export interface ShellInputPayload {
  tab_id: string;
  data: string;
}

export interface ShellResizePayload {
  tab_id: string;
  cols: number;
  rows: number;
}

export interface ShellKillPayload {
  tab_id: string;
}

export interface ShellOutputPayload {
  tab_id: string;
  data: string;
  stream: 'stdout' | 'stderr';
}

export interface ShellExitPayload {
  tab_id: string;
  code: number | null;
  signal: string | null;
}

export function createWSMessage<T>(type: WSMessageType, id: string, payload: T): WSMessage<T> {
  return { type, id, payload, timestamp: new Date().toISOString() };
}
