import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPendingActions, handleApprove, handleDeny, submitAction } from '../services/action.service.js';
import { listTrustRules, createTrustRule, deleteTrustRule } from '../storage/repositories/trust-rule.repository.js';
import { nanoid } from 'nanoid';

const submitBodySchema = z.object({
  type: z.string().min(1),
  tier: z.enum(['red', 'yellow', 'green']),
  title: z.string().min(1),
  description: z.string().optional(),
  payload: z.unknown().optional(),
  conversation_id: z.string().optional(),
});

const trustRuleBodySchema = z.object({
  service: z.string().min(1),
  action: z.string().min(1),
  decision: z.enum(['auto_approve', 'auto_deny', 'ask']),
});

export async function actionRoutes(app: FastifyInstance): Promise<void> {
  /** List pending actions awaiting approval */
  app.get('/pending', async () => {
    const actions = getPendingActions();
    return { ok: true, data: { actions } };
  });

  /** Submit a new action (used internally by AI agent) */
  app.post('/actions', async (request, reply) => {
    const body = submitBodySchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'Invalid action request' });
      return;
    }
    const result = submitAction({
      type: body.data.type,
      tier: body.data.tier,
      title: body.data.title,
      description: body.data.description,
      payload: body.data.payload,
      conversationId: body.data.conversation_id,
    });
    return { ok: true, data: result };
  });

  /** Approve a pending action */
  app.post<{ Params: { id: string } }>('/approve/:id', async (request, reply) => {
    const action = handleApprove(request.params.id);
    if (!action) {
      reply.code(404).send({ ok: false, error: 'Action not found or already resolved' });
      return;
    }
    return { ok: true, data: { action } };
  });

  /** Deny a pending action */
  app.post<{ Params: { id: string } }>('/deny/:id', async (request, reply) => {
    const action = handleDeny(request.params.id);
    if (!action) {
      reply.code(404).send({ ok: false, error: 'Action not found or already resolved' });
      return;
    }
    return { ok: true, data: { action } };
  });

  // --- Trust Rules ---

  /** List all trust rules */
  app.get('/trust-rules', async () => {
    const rules = listTrustRules();
    return { ok: true, data: { rules } };
  });

  /** Create or update a trust rule */
  app.post('/trust-rules', async (request, reply) => {
    const body = trustRuleBodySchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'Invalid trust rule' });
      return;
    }
    const id = nanoid();
    createTrustRule(id, body.data.service, body.data.action, body.data.decision);
    return { ok: true, data: { id } };
  });

  /** Delete a trust rule */
  app.delete<{ Params: { id: string } }>('/trust-rules/:id', async (request, reply) => {
    const deleted = deleteTrustRule(request.params.id);
    if (!deleted) {
      reply.code(404).send({ ok: false, error: 'Trust rule not found' });
      return;
    }
    return { ok: true };
  });
}
