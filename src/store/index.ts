import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { Conversation, Message, ModelConfig, Preset, MessageRole } from "@/types";

interface AppState {
  conversations: Conversation[];
  currentConversationId: string | null;
  models: ModelConfig[];
  presets: Preset[];
  selectedConversations: string[]; // 新增：存储选中的对话ID
  batchMode: boolean; // 新增：批量模式状态

  // 对话操作
  createConversation: (
    title: string,
    modelId: string,
    presetId: string | null
  ) => string;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  deleteMultipleConversations: (ids: string[]) => void; // 新增：批量删除对话
  setCurrentConversation: (id: string | null) => void;
  
  // 选择操作
  toggleBatchMode: (enabled: boolean) => void; // 新增：切换批量模式
  toggleSelectConversation: (id: string) => void; // 新增：切换选择状态
  selectAllConversations: () => void; // 新增：全选所有对话
  clearSelectedConversations: () => void; // 新增：清除所有选择

  // 消息操作
  addMessage: (conversationId: string, role: string, content: string) => void;

  // 模型操作
  addModel: (model: Omit<ModelConfig, "id">) => string;
  updateModel: (id: string, updates: Partial<ModelConfig>) => void;
  deleteModel: (id: string) => void;

  // 预设操作
  addPreset: (preset: Omit<Preset, "id">) => string;
  updatePreset: (id: string, updates: Partial<Preset>) => void;
  deletePreset: (id: string) => void;

  // 创建动画状态
  creating: boolean;
  setCreating: (creating: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      conversations: [],
      currentConversationId: null,
      models: [],
      presets: [],
      creating: false,
      selectedConversations: [], // 初始化选中对话为空数组
      batchMode: false, // 初始化批量模式为关闭

      // 对话操作
      createConversation: (title, modelId, presetId) => {
        const id = uuidv4();
        const now = Date.now();

        set((state) => ({
          conversations: [
            {
              id,
              title,
              modelId,
              presetId,
              messages: [],
              createdAt: now,
              updatedAt: now,
            },
            ...state.conversations,
          ],
          currentConversationId: id,
        }));

        return id;
      },

      updateConversation: (id, updates) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id
              ? { ...conv, ...updates, updatedAt: Date.now() }
              : conv
          ),
        }));
      },

      deleteConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.filter((conv) => conv.id !== id),
          currentConversationId:
            state.currentConversationId === id
              ? null
              : state.currentConversationId,
          // 从选中列表中移除被删除的对话
          selectedConversations: state.selectedConversations.filter(
            (convId) => convId !== id
          ),
        }));
      },

      // 批量删除对话
      deleteMultipleConversations: (ids) => {
        set((state) => ({
          conversations: state.conversations.filter(
            (conv) => !ids.includes(conv.id)
          ),
          currentConversationId: ids.includes(state.currentConversationId || '')
            ? null
            : state.currentConversationId,
          selectedConversations: [],
          batchMode: false, // 删除后关闭批量模式
        }));
      },

      setCurrentConversation: (id) => {
        set({ currentConversationId: id });
      },
      
      // 切换批量模式
      toggleBatchMode: (enabled) => {
        set((state) => ({
          batchMode: enabled,
          selectedConversations: enabled ? state.selectedConversations : [],
        }));
      },

      // 切换选择对话
      toggleSelectConversation: (id) => {
        set((state) => {
          if (state.selectedConversations.includes(id)) {
            return {
              selectedConversations: state.selectedConversations.filter(
                (convId) => convId !== id
              ),
            };
          } else {
            return {
              selectedConversations: [...state.selectedConversations, id],
            };
          }
        });
      },

      // 全选所有对话
      selectAllConversations: () => {
        set((state) => ({
          selectedConversations: state.conversations.map((conv) => conv.id),
        }));
      },

      // 清除所有选择
      clearSelectedConversations: () => {
        set({ selectedConversations: [] });
      },

      // 消息操作
      addMessage: (conversationId, role, content) => {
        const message: Message = {
          id: uuidv4(),
          role: role as MessageRole,
          content,
          timestamp: Date.now(),
        };

        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, message],
                  updatedAt: Date.now(),
                }
              : conv
          ),
        }));
      },

      // 模型操作
      addModel: (model) => {
        const id = uuidv4();

        set((state) => ({
          models: [...state.models, { ...model, id }],
        }));

        return id;
      },

      updateModel: (id, updates) => {
        set((state) => ({
          models: state.models.map((model) =>
            model.id === id ? { ...model, ...updates } : model
          ),
        }));
      },

      deleteModel: (id) => {
        set((state) => ({
          models: state.models.filter((model) => model.id !== id),
        }));
      },

      // 预设操作
      addPreset: (preset) => {
        const id = uuidv4();

        set((state) => ({
          presets: [...state.presets, { ...preset, id }],
        }));

        return id;
      },

      updatePreset: (id, updates) => {
        set((state) => ({
          presets: state.presets.map((preset) =>
            preset.id === id ? { ...preset, ...updates } : preset
          ),
        }));
      },

      deletePreset: (id) => {
        set((state) => ({
          presets: state.presets.filter((preset) => preset.id !== id),
          conversations: state.conversations.map((conv) =>
            conv.presetId === id ? { ...conv, presetId: null } : conv
          ),
        }));
      },

      setCreating: (creating) => {
        set({ creating });
      },
    }),
    {
      name: "ai-chat-app-storage",
    }
  )
);
