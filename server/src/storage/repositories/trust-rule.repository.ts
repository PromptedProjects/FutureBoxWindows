import { getDatabase } from '../database.js';

export interface TrustRule {
  id: string;
  service: string;
  action: string;
  decision: 'auto_approve' | 'auto_deny' | 'ask';
  created_at: string;
}

export function createTrustRule(id: string, service: string, action: string, decision: TrustRule['decision']): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO trust_rules (id, service, action, decision)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(service, action) DO UPDATE SET decision = excluded.decision`
  ).run(id, service, action, decision);
}

export function findTrustRule(service: string, action: string): TrustRule | undefined {
  const db = getDatabase();
  // Check for exact match first, then wildcard
  const exact = db.prepare(
    'SELECT * FROM trust_rules WHERE service = ? AND action = ?'
  ).get(service, action) as TrustRule | undefined;
  if (exact) return exact;

  // Wildcard: service=* matches any service for that action
  return db.prepare(
    "SELECT * FROM trust_rules WHERE service = '*' AND action = ?"
  ).get(action) as TrustRule | undefined;
}

export function listTrustRules(): TrustRule[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM trust_rules ORDER BY service, action').all() as unknown as TrustRule[];
}

export function deleteTrustRule(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM trust_rules WHERE id = ?').run(id);
  return result.changes > 0;
}
