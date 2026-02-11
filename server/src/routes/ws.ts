import type { FastifyInstance } from 'fastify';
import { validateSession } from '../services/auth.service.js';
import { wsManager } from '../ws/ws-manager.js';
import { createWSMessage, type WSMessage, type ChatSendPayload, type ActionDecisionPayload, type ShellExecPayload, type ShellInputPayload, type ShellKillPayload, type ShellResizePayload } from '../ws/ws-protocol.js';
import { handleChatSend, handleChatCancel } from '../ws/handlers/chat.handler.js';
import { handleShellExec, handleShellInput, handleShellKill, handleShellResize, cleanupShells } from '../ws/handlers/shell.handler.js';
import { handleApprove, handleDeny } from '../services/action.service.js';
import { handleScreenCapture } from '../ws/handlers/screen.handler.js';

export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (socket, request) => {
    // Authenticate via query param: /ws?token=xxx
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.close(4001, 'Missing token');
      return;
    }

    const session = validateSession(token);
    if (!session) {
      socket.close(4001, 'Invalid token');
      return;
    }

    const sessionId = session.sessionId;
    wsManager.add(sessionId, socket);
    request.log.info(`WebSocket connected: ${sessionId}`);

    socket.on('message', async (raw) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        socket.send(JSON.stringify(createWSMessage('chat.error', 'unknown', { error: 'Invalid JSON' })));
        return;
      }

      switch (msg.type) {
        case 'chat.send':
          handleChatSend(sessionId, msg.id, msg.payload as ChatSendPayload);
          break;
        case 'chat.cancel':
          handleChatCancel(msg.id);
          break;
        case 'action.approve': {
          const ap = msg.payload as ActionDecisionPayload;
          const approved = handleApprove(ap.action_id);
          socket.send(JSON.stringify(createWSMessage('notification.info', msg.id, {
            result: approved ? 'approved' : 'not_found',
          })));
          break;
        }
        case 'action.deny': {
          const dp = msg.payload as ActionDecisionPayload;
          const denied = handleDeny(dp.action_id);
          socket.send(JSON.stringify(createWSMessage('notification.info', msg.id, {
            result: denied ? 'denied' : 'not_found',
          })));
          break;
        }
        case 'shell.exec':
          handleShellExec(sessionId, msg.id, msg.payload as ShellExecPayload);
          break;
        case 'shell.input':
          handleShellInput(sessionId, msg.payload as ShellInputPayload);
          break;
        case 'shell.kill':
          handleShellKill(sessionId, msg.payload as ShellKillPayload);
          break;
        case 'shell.resize':
          handleShellResize(sessionId, msg.payload as ShellResizePayload);
          break;
        case 'screen.capture':
          handleScreenCapture(sessionId, msg.id, msg.payload as { display_id?: number });
          break;
        case 'ping':
          socket.send(JSON.stringify(createWSMessage('pong', msg.id, {})));
          break;
        default:
          socket.send(JSON.stringify(createWSMessage('chat.error', msg.id, { error: `Unknown type: ${msg.type}` })));
      }
    });

    socket.on('close', () => {
      cleanupShells(sessionId);
      wsManager.remove(sessionId);
      request.log.info(`WebSocket disconnected: ${sessionId}`);
    });
  });
}
