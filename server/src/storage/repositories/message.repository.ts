import { getDatabase } from '../database.js';

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  tokens_used: number | null;
  created_at: string;
}

export function createMessage(msg: Omit<Message, 'created_at'>): void {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO messages (id, conversation_id, role, content, model, tokens_used) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(msg.id, msg.conversation_id, msg.role, msg.content, msg.model ?? null, msg.tokens_used ?? null);
}

export function listMessages(conversationId: string, limit = 100, offset = 0): Message[] {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?'
  ).all(conversationId, limit, offset) as unknown as Message[];
}

export function getMessageCount(conversationId: string): number {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?'
  ).get(conversationId) as { count: number };
  return row.count;
}
