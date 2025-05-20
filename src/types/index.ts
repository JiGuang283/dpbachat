// 语言模型类型
export enum ModelType {
  OpenAI = "openai",
  DeepSeek = "deepseek",
  Gemini = "gemini",
  Claude = "claude",
}

// 消息角色
export enum MessageRole {
  System = "system",
  User = "user",
  Assistant = "assistant",
}

// 消息类型
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

// 对话类型
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  modelId: string;
  presetId: string | null;
  createdAt: number;
  updatedAt: number;
}

// 模型配置接口
export interface ModelConfig {
  id: string;
  name: string;
  type: ModelType;
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  enabled: boolean;
}

// 预设类型
export interface Preset {
  id: string;
  name: string;
  armoringPrompt: string; // 穿甲弹部分
  systemPrompt: string; // 预设部分
}

// API调用参数
export interface ApiCallOptions {
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// API调用响应
export interface ApiResponse {
  content: string;
  error?: string;
}
