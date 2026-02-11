// Mirrors server ws-protocol.ts exactly

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
  id: string;
  payload: T;
  timestamp: string;
}

// Client → Server payloads
export interface ChatSendPayload {
  message: string;
  conversation_id?: string;
  images?: string[];
}

export interface ActionDecisionPayload {
  action_id: string;
}

// Server → Client payloads
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

export interface NotificationActionPayload {
  action_id: string;
  type: string;
  tier: 'red' | 'yellow' | 'green';
  title: string;
  description?: string;
}

export interface NotificationInfoPayload {
  result: 'approved' | 'denied' | 'not_found';
}

// Shell payloads
export interface ShellExecPayload {
  tab_id: string;
  command: string;
  cwd?: string;
}

export interface ShellInputPayload {
  tab_id: string;
  data: string;
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
