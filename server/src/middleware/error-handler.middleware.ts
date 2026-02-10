import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply): void {
  request.log.error(error);

  const statusCode = error.statusCode ?? 500;

  reply.code(statusCode).send({
    ok: false,
    error: statusCode >= 500 ? 'Internal server error' : error.message,
  });
}
