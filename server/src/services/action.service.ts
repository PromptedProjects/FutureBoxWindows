import { nanoid } from 'nanoid';
import {
  createAction,
  getAction,
  approveAction,
  denyAction,
  listPendingActions,
  expireOldActions,
  type Action,
} from '../storage/repositories/action.repository.js';
import { findTrustRule } from '../storage/repositories/trust-rule.repository.js';
import { wsManager } from '../ws/ws-manager.js';
import { createWSMessage } from '../ws/ws-protocol.js';

const ACTION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export type ActionTier = 'red' | 'yellow' | 'green';

export interface SubmitActionRequest {
  type: string;         // e.g. "shell.exec", "file.write", "email.send"
  tier: ActionTier;
  title: string;
  description?: string;
  payload?: unknown;    // Action-specific data
  conversationId?: string;
}

export type ActionResult =
  | { decision: 'auto_approved'; action: Action }
  | { decision: 'auto_denied'; action: Action }
  | { decision: 'pending'; action: Action };

/** Submit an action for permission gating */
export function submitAction(req: SubmitActionRequest): ActionResult {
  const id = nanoid();

  // Check trust rules first
  const rule = findTrustRule(req.type.split('.')[0], req.type);

  const actionData = {
    id,
    conversation_id: req.conversationId ?? null,
    type: req.type,
    tier: req.tier,
    title: req.title,
    description: req.description ?? null,
    payload: req.payload ? JSON.stringify(req.payload) : null,
  };

  createAction(actionData);
  const action = getAction(id)!;

  // Green tier = auto-approve (no user interaction)
  if (req.tier === 'green') {
    approveAction(id);
    return { decision: 'auto_approved', action: { ...action, status: 'approved' } };
  }

  // Check trust rules
  if (rule) {
    if (rule.decision === 'auto_approve') {
      approveAction(id);
      return { decision: 'auto_approved', action: { ...action, status: 'approved' } };
    }
    if (rule.decision === 'auto_deny') {
      denyAction(id);
      return { decision: 'auto_denied', action: { ...action, status: 'denied' } };
    }
  }

  // Yellow/Red with no matching rule → notify user and wait
  wsManager.broadcast(createWSMessage('notification.action', id, {
    action_id: id,
    type: req.type,
    tier: req.tier,
    title: req.title,
    description: req.description,
  }));

  return { decision: 'pending', action };
}

/** Approve a pending action. Returns the action or null if not found/already resolved. */
export function handleApprove(actionId: string): Action | null {
  const success = approveAction(actionId);
  if (!success) return null;
  return getAction(actionId) ?? null;
}

/** Deny a pending action. */
export function handleDeny(actionId: string): Action | null {
  const success = denyAction(actionId);
  if (!success) return null;
  return getAction(actionId) ?? null;
}

/** Get all pending actions */
export function getPendingActions(): Action[] {
  return listPendingActions();
}

/** Expire stale actions — call periodically */
export function expireStaleActions(): number {
  return expireOldActions(ACTION_TIMEOUT_MS);
}
