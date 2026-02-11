import { Ollama } from 'ollama';
import {
  Capability,
  type LLMProvider,
  type VisionProvider,
  type ChatMessage,
  type ChatResponse,
  type ChatOptions,
  type ModelInfo,
} from './provider.interface.js';

const VISION_MODELS = new Set(['llava', 'llava:13b', 'llava:34b', 'bakllava', 'moondream']);

export class OllamaProvider implements LLMProvider, VisionProvider {
  readonly name = 'ollama';
  private client: Ollama;

  constructor(host: string) {
    this.client = new Ollama({ host });
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const { models } = await this.client.list();
    return models.map((m) => {
      const id = m.name;
      const capabilities: Capability[] = [Capability.Language];
      if (VISION_MODELS.has(id.split(':')[0])) {
        capabilities.push(Capability.Vision);
      }
      return {
        id,
        name: m.name,
        provider: this.name,
        capabilities,
        size: m.details?.parameter_size,
      };
    });
  }

  async chat(model: string, messages: ChatMessage[], _options?: ChatOptions): Promise<ChatResponse> {
    const response = await this.client.chat({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        images: m.images,
      })),
      stream: false,
    });

    return {
      content: response.message.content,
      model,
      tokens_used: response.eval_count,
    };
  }

  async *chatStream(model: string, messages: ChatMessage[], _options?: ChatOptions): AsyncGenerator<string, ChatResponse> {
    const stream = await this.client.chat({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        images: m.images,
      })),
      stream: true,
    });

    let fullContent = '';
    let tokensUsed: number | undefined;

    for await (const chunk of stream) {
      const token = chunk.message.content;
      fullContent += token;
      if (chunk.done) {
        tokensUsed = chunk.eval_count;
      }
      yield token;
    }

    return { content: fullContent, model, tokens_used: tokensUsed };
  }

  async describeImage(model: string, image: string, prompt?: string): Promise<ChatResponse> {
    return this.chat(model, [
      { role: 'user', content: prompt ?? 'Describe this image.', images: [image] },
    ]);
  }
}
