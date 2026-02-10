import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sendMessage } from '../services/chat.service.js';

const chatBodySchema = z.object({
  message: z.string().min(1),
  conversation_id: z.string().optional(),
});

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  /** Send a message and get a full (non-streaming) response */
  app.post('/chat', async (request, reply) => {
    const body = chatBodySchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'Invalid request: message is required' });
      return;
    }

    try {
      const result = await sendMessage(body.data.conversation_id, body.data.message);
      return { ok: true, data: result };
    } catch (err: any) {
      reply.code(502).send({ ok: false, error: err.message ?? 'AI provider error' });
    }
  });
}
