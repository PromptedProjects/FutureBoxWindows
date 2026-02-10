import { getDatabase } from '../database.js';

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export function createConversation(id: string, title?: string): void {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO conversations (id, title) VALUES (?, ?)'
  ).run(id, title ?? null);
}

export function getConversation(id: string): Conversation | undefined {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM conversations WHERE id = ?'
  ).get(id) as Conversation | undefined;
}

export function listConversations(limit = 50, offset = 0): Conversation[] {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as unknown as Conversation[];
}

export function updateConversationTimestamp(id: string): void {
  const db = getDatabase();
  db.prepare(
    "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?"
  ).run(id);
}

export function updateConversationTitle(id: string, title: string): void {
  const db = getDatabase();
  db.prepare(
    "UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title, id);
}
