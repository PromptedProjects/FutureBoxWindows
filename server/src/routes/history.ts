import type { FastifyInstance } from 'fastify';
import { listConversations, getConversation } from '../storage/repositories/conversation.repository.js';
import { listMessages, getMessageCount } from '../storage/repositories/message.repository.js';

export async function historyRoutes(app: FastifyInstance): Promise<void> {
  /** List conversations (paginated) */
  app.get('/conversations', async (request) => {
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const conversations = listConversations(
      Math.min(Number(limit) || 50, 100),
      Number(offset) || 0,
    );
    return { ok: true, data: { conversations } };
  });

  /** Get messages for a conversation (paginated) */
  app.get<{ Params: { id: string } }>('/conversations/:id/messages', async (request, reply) => {
    const { id } = request.params;
    const conv = getConversation(id);
    if (!conv) {
      reply.code(404).send({ ok: false, error: 'Conversation not found' });
      return;
    }

    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const messages = listMessages(id, Math.min(Number(limit) || 100, 200), Number(offset) || 0);
    const total = getMessageCount(id);

    return { ok: true, data: { conversation: conv, messages, total } };
  });
}
