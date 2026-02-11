import { Capability, type LLMProvider, type ChatMessage, type ChatResponse, type ChatOptions } from '../providers/provider.interface.js';
import { registry } from '../providers/provider-registry.js';

/** Route a chat request through the capability system with fallback */
export async function routeChat(
  capability: Capability,
  messages: ChatMessage[],
  options?: ChatOptions,
): Promise<ChatResponse> {
  const chain = registry.resolveChain(capability);

  if (chain.length === 0) {
    throw new Error(`No provider assigned for capability: ${capability}`);
  }

  for (const slot of chain) {
    const provider = slot.provider as LLMProvider;
    try {
      if (await provider.isAvailable()) {
        return await provider.chat(slot.model, messages, options);
      }
    } catch {
      // Try next in chain
    }
  }

  throw new Error(`All providers failed for capability: ${capability}`);
}

/** Route a streaming chat request through the capability system */
export async function* routeChatStream(
  capability: Capability,
  messages: ChatMessage[],
  options?: ChatOptions,
): AsyncGenerator<string, ChatResponse> {
  const chain = registry.resolveChain(capability);

  if (chain.length === 0) {
    throw new Error(`No provider assigned for capability: ${capability}`);
  }

  for (const slot of chain) {
    const provider = slot.provider as LLMProvider;
    try {
      if (await provider.isAvailable()) {
        return yield* provider.chatStream(slot.model, messages, options);
      }
    } catch {
      // Try next in chain
    }
  }

  throw new Error(`All providers failed for capability: ${capability}`);
}
