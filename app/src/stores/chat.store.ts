import { create } from 'zustand';
import type { Message, Conversation } from '../types/models';

export interface ToolActivity {
  tool_call_id: string;
  tool_name: string;
  status: 'running' | 'done' | 'error';
  error?: string;
}

interface ChatState {
  conversationId: string | null;
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  conversations: Conversation[];
  toolActivities: ToolActivity[];

  setConversationId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendToken: (token: string) => void;
  finishStream: (message: Message) => void;
  setStreaming: (streaming: boolean) => void;
  clearStream: () => void;
  setConversations: (conversations: Conversation[]) => void;
  newConversation: () => void;
  addToolStart: (tool_call_id: string, tool_name: string) => void;
  updateToolResult: (tool_call_id: string, success: boolean, error?: string) => void;
  clearTools: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversationId: null,
  messages: [],
  streamingContent: '',
  isStreaming: false,
  conversations: [],
  toolActivities: [],

  setConversationId: (id) => set({ conversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),
  appendToken: (token) =>
    set((s) => ({ streamingContent: s.streamingContent + token })),
  finishStream: (message) =>
    set((s) => ({
      messages: [...s.messages, message],
      streamingContent: '',
      isStreaming: false,
      toolActivities: [],
    })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  clearStream: () => set({ streamingContent: '', isStreaming: false, toolActivities: [] }),
  setConversations: (conversations) => set({ conversations }),
  newConversation: () =>
    set({ conversationId: null, messages: [], streamingContent: '', isStreaming: false, toolActivities: [] }),
  addToolStart: (tool_call_id, tool_name) =>
    set((s) => ({
      toolActivities: [...s.toolActivities, { tool_call_id, tool_name, status: 'running' }],
    })),
  updateToolResult: (tool_call_id, success, error) =>
    set((s) => ({
      toolActivities: s.toolActivities.map((t) =>
        t.tool_call_id === tool_call_id
          ? { ...t, status: success ? 'done' : 'error', error }
          : t,
      ),
    })),
  clearTools: () => set({ toolActivities: [] }),
}));
