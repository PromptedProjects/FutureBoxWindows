import { nanoid } from 'nanoid';
import { Capability, type ChatMessage, type ToolCall } from '../providers/provider.interface.js';
import { routeChat, routeChatStream } from './model-router.service.js';
import {
  createConversation,
  getConversation,
  updateConversationTimestamp,
  updateConversationTitle,
} from '../storage/repositories/conversation.repository.js';
import { createMessage, listMessages } from '../storage/repositories/message.repository.js';
import { getToolDefinitions, executeSkillAction, getActionTier, parseToolName } from './skills.service.js';
import { submitAction, type ActionResult } from './action.service.js';
import { getAction } from '../storage/repositories/action.repository.js';

const MAX_TOOL_ROUNDS = 10;

const BASE_SYSTEM_PROMPT = `You are FutureBox, a personal AI assistant running on your owner's local machine (Windows PC). You have direct access to the host system through tools.

CRITICAL RULES:
- When the user asks you to DO something (open a URL, check clipboard, set volume, take a screenshot, run a command, etc.), ALWAYS call the appropriate tool. NEVER just describe what you would do.
- Act first, explain after. Call the tool, then briefly confirm what happened.
- You can chain multiple tool calls in a single response when needed.
- If a tool call fails, tell the user what went wrong and suggest alternatives.
- For simple questions that don't need tools, just answer normally.
- Be concise. No filler.`;

// Re-export for external use
export { executeSkillAction };

export interface SendMessageResult {
  conversation_id: string;
  message_id: string;
  content: string;
  model?: string;
}

export type StreamChunk =
  | { type: 'token'; data: string }
  | { type: 'tool_start'; tool_call_id: string; tool_name: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; tool_call_id: string; tool_name: string; success: boolean; result?: unknown; error?: string }
  | { type: 'done'; data: SendMessageResult };

/** Execute a single tool call, gating through the action/approval system */
async function executeTool(
  tc: ToolCall,
  conversationId: string,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const apiName = tc.function.name; // e.g. "clipboard__read"
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(tc.function.arguments);
  } catch {
    return { success: false, error: 'Invalid tool arguments JSON' };
  }

  const parsed = parseToolName(apiName);
  if (!parsed) {
    return { success: false, error: `Invalid tool name format: ${apiName}` };
  }
  const [skillId, actionName] = parsed;

  const tier = getActionTier(apiName);
  if (!tier) {
    return { success: false, error: `Unknown tool: ${apiName}` };
  }

  console.log(`[tool] ${apiName} tier=${tier} args=${JSON.stringify(args)}`);

  // Green tier: auto-execute without approval prompt
  if (tier === 'green') {
    return executeSkillAction(skillId, actionName, args);
  }

  // Yellow/red: go through action approval system
  const internalName = `${skillId}.${actionName}`;
  const actionResult: ActionResult = submitAction({
    type: internalName,
    tier,
    title: `AI wants to run: ${internalName}`,
    description: `Arguments: ${JSON.stringify(args)}`,
    payload: args,
    conversationId,
  });

  if (actionResult.decision === 'auto_approved') {
    return executeSkillAction(skillId, actionName, args);
  }

  if (actionResult.decision === 'auto_denied') {
    return { success: false, error: 'Action denied by trust rules' };
  }

  // Pending — wait for user approval (poll with timeout)
  console.log(`[tool] ${internalName} waiting for user approval...`);
  const actionId = actionResult.action.id;
  const deadline = Date.now() + 120_000; // 2 minute timeout
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    const action = getAction(actionId);
    if (!action) return { success: false, error: 'Action not found' };
    if (action.status === 'approved') {
      console.log(`[tool] ${internalName} approved`);
      return executeSkillAction(skillId, actionName, args);
    }
    if (action.status === 'denied') {
      console.log(`[tool] ${internalName} denied`);
      return { success: false, error: 'Action denied by user' };
    }
  }

  return { success: false, error: 'Action approval timed out' };
}

/** Send a message and get a full response (non-streaming) */
export async function sendMessage(
  conversationId: string | undefined,
  userContent: string,
): Promise<SendMessageResult> {
  const convId = conversationId ?? nanoid();
  if (!conversationId) {
    createConversation(convId);
  } else if (!getConversation(convId)) {
    createConversation(convId);
  }

  const userMsgId = nanoid();
  createMessage({ id: userMsgId, conversation_id: convId, role: 'user', content: userContent, model: null, tokens_used: null });

  const history = listMessages(convId, 50);
  const messages: ChatMessage[] = [
    { role: 'system', content: BASE_SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const tools = getToolDefinitions();
  const options = tools.length > 0 ? { tools } : undefined;

  // Tool loop
  let allContent = '';
  let model: string | undefined;
  let hadToolCalls = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await routeChat(Capability.Language, messages, options);
    model = response.model;
    allContent += response.content;

    if (!response.tool_calls?.length) {
      break;
    }

    hadToolCalls = true;
    console.log(`[tool-loop/sync] round ${round + 1}: AI called ${response.tool_calls.length} tool(s)`);

    // AI wants to call tools — add assistant message with tool_calls
    messages.push({
      role: 'assistant',
      content: response.content,
      tool_calls: response.tool_calls,
    });

    // Execute each tool and add results
    for (const tc of response.tool_calls) {
      const result = await executeTool(tc, convId);
      console.log(`[tool-loop/sync] ${tc.function.name} → ${result.success ? 'OK' : 'FAIL'}`);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  // If we ended on tool calls, get final text
  if (hadToolCalls) {
    const finalResp = await routeChat(Capability.Language, messages);
    allContent += finalResp.content;
    model = finalResp.model;
  }

  const finalContent = allContent;

  const assistantMsgId = nanoid();
  createMessage({
    id: assistantMsgId,
    conversation_id: convId,
    role: 'assistant',
    content: finalContent,
    model: model ?? null,
    tokens_used: null,
  });

  updateConversationTimestamp(convId);

  if (history.length <= 1) {
    updateConversationTitle(convId, userContent.slice(0, 80));
  }

  return {
    conversation_id: convId,
    message_id: assistantMsgId,
    content: finalContent,
    model,
  };
}

/** Stream a response token by token with tool execution loop */
export async function* streamMessage(
  conversationId: string | undefined,
  userContent: string,
  images?: string[],
): AsyncGenerator<StreamChunk> {
  const convId = conversationId ?? nanoid();
  if (!conversationId) {
    createConversation(convId);
  } else if (!getConversation(convId)) {
    createConversation(convId);
  }

  const userMsgId = nanoid();
  createMessage({ id: userMsgId, conversation_id: convId, role: 'user', content: userContent, model: null, tokens_used: null });

  const history = listMessages(convId, 50);
  const messages: ChatMessage[] = [
    { role: 'system', content: BASE_SYSTEM_PROMPT },
    ...history.map((m, i) => {
      const msg: ChatMessage = { role: m.role, content: m.content };
      if (i === history.length - 1 && m.role === 'user' && images?.length) {
        msg.images = images;
      }
      return msg;
    }),
  ];

  const tools = getToolDefinitions();
  const options = tools.length > 0 ? { tools } : undefined;

  let allContent = ''; // ALL text streamed to client across all rounds
  let model: string | undefined;
  let tokensUsed: number | undefined;
  let hadToolCalls = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = routeChatStream(Capability.Language, messages, options);
    let roundContent = '';
    hadToolCalls = false;

    while (true) {
      const { value, done } = await stream.next();
      if (done) {
        const final = value;
        model = final.model;
        tokensUsed = final.tokens_used;

        if (final.tool_calls?.length) {
          hadToolCalls = true;
          console.log(`[tool-loop] round ${round + 1}: AI called ${final.tool_calls.length} tool(s)`);

          // Add assistant message with tool_calls to context
          messages.push({
            role: 'assistant',
            content: roundContent,
            tool_calls: final.tool_calls,
          });

          for (const tc of final.tool_calls) {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.function.arguments); } catch { /* empty */ }

            yield {
              type: 'tool_start',
              tool_call_id: tc.id,
              tool_name: tc.function.name,
              arguments: args,
            };

            const result = await executeTool(tc, convId);
            console.log(`[tool-loop] ${tc.function.name} → ${result.success ? 'OK' : 'FAIL'}: ${JSON.stringify(result.result ?? result.error).slice(0, 200)}`);

            yield {
              type: 'tool_result',
              tool_call_id: tc.id,
              tool_name: tc.function.name,
              success: result.success,
              result: result.result,
              error: result.error,
            };

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          }
        }
        break;
      }

      // Stream text tokens to client
      roundContent += value;
      allContent += value;
      yield { type: 'token', data: value };
    }

    // If no tool calls this round, we're done
    if (!hadToolCalls) break;
  }

  // If we exhausted all rounds with tool calls, get a final text response
  if (hadToolCalls) {
    console.log('[tool-loop] final round — getting text response after tools');
    const lastStream = routeChatStream(Capability.Language, messages);
    while (true) {
      const { value, done } = await lastStream.next();
      if (done) {
        model = value.model;
        break;
      }
      allContent += value;
      yield { type: 'token', data: value };
    }
  }

  const finalContent = allContent;

  const assistantMsgId = nanoid();
  createMessage({
    id: assistantMsgId,
    conversation_id: convId,
    role: 'assistant',
    content: finalContent,
    model: model ?? null,
    tokens_used: tokensUsed ?? null,
  });

  updateConversationTimestamp(convId);

  if (history.length <= 1) {
    updateConversationTitle(convId, userContent.slice(0, 80));
  }

  yield {
    type: 'done',
    data: { conversation_id: convId, message_id: assistantMsgId, content: finalContent, model },
  };
}
