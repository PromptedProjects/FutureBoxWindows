import {
  Capability,
  type LLMProvider,
  type ChatMessage,
  type ChatResponse,
  type ChatOptions,
  type ModelInfo,
  type ToolCall,
} from './provider.interface.js';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'gpt-4o', name: 'GPT-4o', provider: this.name, capabilities: [Capability.Language, Capability.Vision] },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: this.name, capabilities: [Capability.Language, Capability.Vision] },
      { id: 'o1', name: 'o1', provider: this.name, capabilities: [Capability.Language, Capability.Reasoning] },
    ];
  }

  private formatMessages(messages: ChatMessage[]): any[] {
    return messages.map((m) => {
      // Tool result message
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.tool_call_id,
          content: m.content,
        };
      }

      // Assistant message with tool_calls
      if (m.role === 'assistant' && m.tool_calls?.length) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        };
      }

      // Vision message
      if (m.images?.length) {
        const content: any[] = [{ type: 'text', text: m.content }];
        for (const img of m.images) {
          content.push({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${img}` },
          });
        }
        return { role: m.role, content };
      }

      return { role: m.role, content: m.content };
    });
  }

  async chat(model: string, messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const body: any = {
      model,
      messages: this.formatMessages(messages),
    };
    if (options?.tools?.length) {
      body.tools = options.tools;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${err}`);
    }

    const data = await response.json() as any;
    const msg = data.choices?.[0]?.message;
    const content = msg?.content ?? '';
    const tokensUsed = data.usage?.total_tokens ?? 0;

    const result: ChatResponse = { content, model, tokens_used: tokensUsed };

    if (msg?.tool_calls?.length) {
      result.tool_calls = msg.tool_calls.map((tc: any): ToolCall => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
    }

    return result;
  }

  async *chatStream(model: string, messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string, ChatResponse> {
    const body: any = {
      model,
      stream: true,
      messages: this.formatMessages(messages),
    };
    if (options?.tools?.length) {
      body.tools = options.tools;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${err}`);
    }

    let fullContent = '';
    // Accumulate tool call deltas by index
    const toolCallAccum = new Map<number, { id: string; name: string; arguments: string }>();

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
          const delta = event.choices?.[0]?.delta;
          if (!delta) continue;

          // Content token
          if (delta.content) {
            fullContent += delta.content;
            yield delta.content;
          }

          // Tool call deltas
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallAccum.has(idx)) {
                toolCallAccum.set(idx, { id: '', name: '', arguments: '' });
              }
              const acc = toolCallAccum.get(idx)!;
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name += tc.function.name;
              if (tc.function?.arguments) acc.arguments += tc.function.arguments;
            }
          }
        } catch {
          // skip
        }
      }
    }

    const result: ChatResponse = { content: fullContent, model };

    if (toolCallAccum.size > 0) {
      result.tool_calls = Array.from(toolCallAccum.values()).map((acc): ToolCall => ({
        id: acc.id,
        type: 'function',
        function: { name: acc.name, arguments: acc.arguments },
      }));
    }

    return result;
  }
}
