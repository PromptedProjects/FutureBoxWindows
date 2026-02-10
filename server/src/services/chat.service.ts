import { nanoid } from 'nanoid';
import { Capability, type ChatMessage } from '../providers/provider.interface.js';
import { routeChat, routeChatStream } from './model-router.service.js';
import {
  createConversation,
  getConversation,
  updateConversationTimestamp,
  updateConversationTitle,
} from '../storage/repositories/conversation.repository.js';
import { createMessage, listMessages } from '../storage/repositories/message.repository.js';

const SYSTEM_PROMPT = `You are FutureBox, a personal AI assistant that lives on a local device. You help your owner with tasks, answer questions, and can take actions on the host machine when asked. Be concise, helpful, and proactive. If an action requires permission, say so clearly.`;

export interface SendMessageResult {
  conversation_id: string;
  message_id: string;
  content: string;
  model?: string;
}

/** Send a message and get a full response (non-streaming) */
export async function sendMessage(
  conversationId: string | undefined,
  userContent: string,
): Promise<SendMessageResult> {
  // Create or reuse conversation
  const convId = conversationId ?? nanoid();
  if (!conversationId) {
    createConversation(convId);
  } else if (!getConversation(convId)) {
    createConversation(convId);
  }

  // Save user message
  const userMsgId = nanoid();
  createMessage({ id: userMsgId, conversation_id: convId, role: 'user', content: userContent, model: null, tokens_used: null });

  // Build message history for context
  const history = listMessages(convId, 50);
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Route to AI
  const response = await routeChat(Capability.Language, messages);

  // Save assistant message
  const assistantMsgId = nanoid();
  createMessage({
    id: assistantMsgId,
    conversation_id: convId,
    role: 'assistant',
    content: response.content,
    model: response.model,
    tokens_used: response.tokens_used ?? null,
  });

  updateConversationTimestamp(convId);

  // Auto-title on first exchange
  if (history.length <= 1) {
    const title = userContent.slice(0, 80);
    updateConversationTitle(convId, title);
  }

  return {
    conversation_id: convId,
    message_id: assistantMsgId,
    content: response.content,
    model: response.model,
  };
}

/** Stream a response token by token. Saves full message when done. */
export async function* streamMessage(
  conversationId: string | undefined,
  userContent: string,
): AsyncGenerator<{ type: 'token'; data: string } | { type: 'done'; data: SendMessageResult }> {
  const convId = conversationId ?? nanoid();
  if (!conversationId) {
    createConversation(convId);
  } else if (!getConversation(convId)) {
    createConversation(convId);
  }

  // Save user message
  const userMsgId = nanoid();
  createMessage({ id: userMsgId, conversation_id: convId, role: 'user', content: userContent, model: null, tokens_used: null });

  // Build context
  const history = listMessages(convId, 50);
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Stream from AI
  const stream = routeChatStream(Capability.Language, messages);
  let fullContent = '';
  let model: string | undefined;
  let tokensUsed: number | undefined;

  while (true) {
    const { value, done } = await stream.next();
    if (done) {
      // `value` is the final ChatResponse on return
      const final = value;
      model = final.model;
      tokensUsed = final.tokens_used;
      break;
    }
    fullContent += value;
    yield { type: 'token', data: value };
  }

  // Save assistant message
  const assistantMsgId = nanoid();
  createMessage({
    id: assistantMsgId,
    conversation_id: convId,
    role: 'assistant',
    content: fullContent,
    model: model ?? null,
    tokens_used: tokensUsed ?? null,
  });

  updateConversationTimestamp(convId);

  if (history.length <= 1) {
    updateConversationTitle(convId, userContent.slice(0, 80));
  }

  yield {
    type: 'done',
    data: { conversation_id: convId, message_id: assistantMsgId, content: fullContent, model },
  };
}
