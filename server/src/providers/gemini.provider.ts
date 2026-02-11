import {
  Capability,
  type LLMProvider,
  type ChatMessage,
  type ChatResponse,
  type ChatOptions,
  type ModelInfo,
} from './provider.interface.js';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: this.name, capabilities: [Capability.Language, Capability.Vision] },
      { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', provider: this.name, capabilities: [Capability.Language, Capability.Reasoning, Capability.Vision] },
    ];
  }

  async chat(model: string, messages: ChatMessage[], _options?: ChatOptions): Promise<ChatResponse> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMsgs = messages.filter((m) => m.role !== 'system');

    const contents = chatMsgs.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${err}`);
    }

    const data = await response.json() as any;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const tokensUsed = (data.usageMetadata?.promptTokenCount ?? 0) + (data.usageMetadata?.candidatesTokenCount ?? 0);

    return { content, model, tokens_used: tokensUsed };
  }

  async *chatStream(model: string, messages: ChatMessage[], _options?: ChatOptions): AsyncGenerator<string, ChatResponse> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMsgs = messages.filter((m) => m.role !== 'system');

    const contents = chatMsgs.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${err}`);
    }

    let fullContent = '';
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
        try {
          const event = JSON.parse(line.slice(6));
          const text = event.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullContent += text;
            yield text;
          }
        } catch {
          // skip
        }
      }
    }

    return { content: fullContent, model };
  }
}
