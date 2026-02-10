import { getDatabase } from '../database.js';

export interface Action {
  id: string;
  conversation_id: string | null;
  type: string;
  tier: 'red' | 'yellow' | 'green';
  title: string;
  description: string | null;
  payload: string | null; // JSON stringified
  status: 'pending' | 'approved' | 'denied' | 'expired';
  created_at: string;
  resolved_at: string | null;
}

export function createAction(action: Omit<Action, 'created_at' | 'resolved_at' | 'status'>): void {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO actions (id, conversation_id, type, tier, title, description, payload) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(action.id, action.conversation_id ?? null, action.type, action.tier, action.title, action.description ?? null, action.payload ?? null);
}

export function getAction(id: string): Action | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM actions WHERE id = ?').get(id) as Action | undefined;
}

export function listPendingActions(): Action[] {
  const db = getDatabase();
  return db.prepare(
    "SELECT * FROM actions WHERE status = 'pending' ORDER BY created_at ASC"
  ).all() as unknown as Action[];
}

export function approveAction(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare(
    "UPDATE actions SET status = 'approved', resolved_at = datetime('now') WHERE id = ? AND status = 'pending'"
  ).run(id);
  return result.changes > 0;
}

export function denyAction(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare(
    "UPDATE actions SET status = 'denied', resolved_at = datetime('now') WHERE id = ? AND status = 'pending'"
  ).run(id);
  return result.changes > 0;
}

export function expireOldActions(maxAgeMs: number): number {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const result = db.prepare(
    "UPDATE actions SET status = 'expired', resolved_at = datetime('now') WHERE status = 'pending' AND created_at < ?"
  ).run(cutoff);
  return Number(result.changes);
}
