import { nanoid } from 'nanoid';
import { streamMessage } from '../../services/chat.service.js';
import { wsManager } from '../ws-manager.js';
import {
  createWSMessage,
  type ChatSendPayload,
  type ChatTokenPayload,
  type ChatDonePayload,
  type ChatErrorPayload,
  type ChatToolStartPayload,
  type ChatToolResultPayload,
} from '../ws-protocol.js';

/** Active streams that can be cancelled */
const activeStreams = new Map<string, AbortController>();

export async function handleChatSend(sessionId: string, messageId: string, payload: ChatSendPayload): Promise<void> {
  const abort = new AbortController();
  activeStreams.set(messageId, abort);

  try {
    const stream = streamMessage(payload.conversation_id, payload.message, payload.images);

    for await (const chunk of stream) {
      if (abort.signal.aborted) break;

      if (chunk.type === 'token') {
        wsManager.send(sessionId, createWSMessage<ChatTokenPayload>('chat.token', messageId, {
          conversation_id: payload.conversation_id ?? '',
          token: chunk.data,
        }));
      } else if (chunk.type === 'tool_start') {
        wsManager.send(sessionId, createWSMessage<ChatToolStartPayload>('chat.tool_start', messageId, {
          conversation_id: payload.conversation_id ?? '',
          tool_call_id: chunk.tool_call_id,
          tool_name: chunk.tool_name,
          arguments: chunk.arguments,
        }));
      } else if (chunk.type === 'tool_result') {
        wsManager.send(sessionId, createWSMessage<ChatToolResultPayload>('chat.tool_result', messageId, {
          conversation_id: payload.conversation_id ?? '',
          tool_call_id: chunk.tool_call_id,
          tool_name: chunk.tool_name,
          success: chunk.success,
          result: chunk.result,
          error: chunk.error,
        }));
      } else if (chunk.type === 'done') {
        wsManager.send(sessionId, createWSMessage<ChatDonePayload>('chat.done', messageId, {
          conversation_id: chunk.data.conversation_id,
          message_id: chunk.data.message_id,
          content: chunk.data.content,
          model: chunk.data.model,
        }));
      }
    }
  } catch (err: any) {
    wsManager.send(sessionId, createWSMessage<ChatErrorPayload>('chat.error', messageId, {
      conversation_id: payload.conversation_id,
      error: err.message ?? 'Stream failed',
    }));
  } finally {
    activeStreams.delete(messageId);
  }
}

export function handleChatCancel(messageId: string): void {
  const abort = activeStreams.get(messageId);
  if (abort) {
    abort.abort();
    activeStreams.delete(messageId);
  }
}
