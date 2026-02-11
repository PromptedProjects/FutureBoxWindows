import {
  Capability,
  type LLMProvider,
  type ChatMessage,
  type ChatResponse,
  type ChatOptions,
  type ModelInfo,
  type ToolCall,
  type ToolDefinition,
} from './provider.interface.js';

export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude';
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: this.name, capabilities: [Capability.Language, Capability.Vision] },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: this.name, capabilities: [Capability.Language, Capability.Vision] },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: this.name, capabilities: [Capability.Language, Capability.Reasoning, Capability.Vision] },
    ];
  }

  /** Convert OpenAI-format tool defs to Claude format */
  private formatTools(tools: ToolDefinition[]): any[] {
    return tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  /** Format messages for Claude API, handling tool_calls and tool results */
  private formatMessages(messages: ChatMessage[]): any[] {
    const result: any[] = [];

    for (const m of messages) {
      if (m.role === 'system') continue; // handled separately

      // Assistant message with tool_calls → content array with text + tool_use blocks
      if (m.role === 'assistant' && m.tool_calls?.length) {
        const content: any[] = [];
        if (m.content) {
          content.push({ type: 'text', text: m.content });
        }
        for (const tc of m.tool_calls) {
          let input: any = {};
          try { input = JSON.parse(tc.function.arguments); } catch { /* empty */ }
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input,
          });
        }
        result.push({ role: 'assistant', content });
        continue;
      }

      // Tool result → user message with tool_result content block
      if (m.role === 'tool') {
        // Claude expects tool results as user messages with content array
        // Check if previous message is a user message with tool_result — merge into it
        const prev = result[result.length - 1];
        const block = {
          type: 'tool_result',
          tool_use_id: m.tool_call_id,
          content: m.content,
        };
        if (prev?.role === 'user' && Array.isArray(prev.content) && prev.content[0]?.type === 'tool_result') {
          prev.content.push(block);
        } else {
          result.push({ role: 'user', content: [block] });
        }
        continue;
      }

      // Regular message
      result.push({ role: m.role, content: m.content });
    }

    return result;
  }

  async chat(model: string, messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const systemMsg = messages.find((m) => m.role === 'system');

    const body: any = {
      model,
      max_tokens: 4096,
      system: systemMsg?.content,
      messages: this.formatMessages(messages),
    };
    if (options?.tools?.length) {
      body.tools = this.formatTools(options.tools);
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error: ${response.status} ${err}`);
    }

    const data = await response.json() as any;
    const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    // Extract text and tool_use blocks
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content ?? []) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    const result: ChatResponse = { content, model, tokens_used: tokensUsed };
    if (toolCalls.length > 0) {
      result.tool_calls = toolCalls;
    }
    return result;
  }

  async *chatStream(model: string, messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string, ChatResponse> {
    const systemMsg = messages.find((m) => m.role === 'system');

    const body: any = {
      model,
      max_tokens: 4096,
      stream: true,
      system: systemMsg?.content,
      messages: this.formatMessages(messages),
    };
    if (options?.tools?.length) {
      body.tools = this.formatTools(options.tools);
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error: ${response.status} ${err}`);
    }

    let fullContent = '';
    let tokensUsed = 0;
    const toolCalls: ToolCall[] = [];

    // Track current content block for tool_use streaming
    let currentBlockType: 'text' | 'tool_use' | null = null;
    let currentToolId = '';
    let currentToolName = '';
    let currentToolArgs = '';

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6);
        if (json === '[DONE]') continue;

        try {
          const event = JSON.parse(json);

          if (event.type === 'content_block_start') {
            const block = event.content_block;
            if (block.type === 'text') {
              currentBlockType = 'text';
            } else if (block.type === 'tool_use') {
              currentBlockType = 'tool_use';
              currentToolId = block.id;
              currentToolName = block.name;
              currentToolArgs = '';
            }
          } else if (event.type === 'content_block_delta') {
            if (currentBlockType === 'text' && event.delta?.text) {
              fullContent += event.delta.text;
              yield event.delta.text;
            } else if (currentBlockType === 'tool_use' && event.delta?.partial_json) {
              currentToolArgs += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            if (currentBlockType === 'tool_use') {
              toolCalls.push({
                id: currentToolId,
                type: 'function',
                function: {
                  name: currentToolName,
                  arguments: currentToolArgs,
                },
              });
            }
            currentBlockType = null;
          } else if (event.type === 'message_delta' && event.usage) {
            tokensUsed = (event.usage.input_tokens ?? 0) + (event.usage.output_tokens ?? 0);
          }
        } catch {
          // skip malformed events
        }
      }
    }

    const result: ChatResponse = { content: fullContent, model, tokens_used: tokensUsed };
    if (toolCalls.length > 0) {
      result.tool_calls = toolCalls;
    }
    return result;
  }
}
