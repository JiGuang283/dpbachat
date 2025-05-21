import axios from "axios";
import { ApiCallOptions, ApiResponse, ModelConfig, ModelType } from "@/types";

/**
 * 流式响应处理函数
 */
export type StreamResponseHandler = (
  chunk: string,
  isComplete: boolean
) => void;

/**
 * API错误响应类型定义
 */
interface ApiErrorResponse {
  status?: number;
  data?: {
    error?: { message?: string } | string;
    message?: string;
  };
}

/**
 * 通用API请求配置 - 增加超时和响应大小处理
 */
const API_REQUEST_CONFIG = {
  timeout: 180000, // 2分钟超时
  maxContentLength: Infinity, // 不限制响应大小
  maxBodyLength: Infinity, // 不限制请求体大小
};

/**
 * API错误响应类型定义
 */
interface ApiErrorResponse {
  status?: number;
  data?: {
    error?: { message?: string } | string;
    message?: string;
  };
}

/**
 * API错误类型定义
 */
interface ApiError extends Error {
  // Ensure it extends Error for proper error handling
  response?: ApiErrorResponse;
}

/**
 * API服务工厂 - 根据模型类型创建对应的API服务实例
 */
export const createApiService = (modelConfig: ModelConfig) => {
  switch (modelConfig.type) {
    case ModelType.OpenAI:
      return new OpenAIService(modelConfig);
    case ModelType.DeepSeek:
      return new DeepSeekService(modelConfig);
    case ModelType.Gemini:
      return new GeminiService(modelConfig);
    case ModelType.Claude:
      return new ClaudeService(modelConfig);
    default:
      throw new Error(`不支持的模型类型: ${modelConfig.type}`);
  }
};

/**
 * 基础API服务抽象类 - 所有具体API服务的基类
 */
abstract class BaseApiService {
  protected config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  /**
   * 标准化消息角色 - 处理大小写并根据支持情况转换角色
   */
  protected normalizeRole(role: string, supportedRoles: string[]): string {
    const normalizedRole = role.toLowerCase();
    return supportedRoles.includes(normalizedRole) ? normalizedRole : "user";
  }

  /**
   * 提取API错误信息 - 统一错误处理逻辑
   */
  protected extractErrorMessage(error: unknown, defaultPrefix: string): string {
    // 类型守卫函数
    const isApiError = (err: unknown): err is ApiError => {
      return (
        err !== null && typeof err === "object" && "message" in err
        // Optionally, check for 'response' if it's a critical part of ApiError
        // && (typeof (err as any).response === 'object' || (err as any).response === undefined)
      );
    };

    if (isApiError(error)) {
      // 首先尝试从响应数据中获取错误信息
      if (error.response?.data?.error) {
        if (typeof error.response.data.error === "string") {
          return error.response.data.error;
        } else if (error.response.data.error.message) {
          return error.response.data.error.message;
        }
      }
      if (error.response?.data?.message) {
        return error.response.data.message;
      }
      // 如果响应中没有具体的错误信息，但 error 对象本身有 message 属性
      if (error.message) {
        // 基于HTTP状态码给出友好提示 (如果存在response)
        if (error.response?.status) {
          const status = error.response.status;
          if (status === 401) {
            return `${defaultPrefix} API密钥无效或已过期 (${error.message})`;
          } else if (status === 404) {
            return `${defaultPrefix} 模型不存在或API端点错误 (${error.message})`;
          } else if (status === 429) {
            return `${defaultPrefix} 请求频率限制，请稍后再试 (${error.message})`;
          }
        }
        return error.message; // Fallback to the direct error message
      }
    }

    // 如果不是 ApiError 或者没有提取到特定消息，则使用通用 HTTP 状态码提示
    // This part requires error to be of a type that allows property access, or use type guards.
    // We assume error might have a response property.
    const potentialAxiosError = error as { response?: { status?: number } };
    if (potentialAxiosError?.response?.status) {
      const status = potentialAxiosError.response.status;
      if (status === 401) {
        return `${defaultPrefix} API密钥无效或已过期`;
      } else if (status === 404) {
        return `${defaultPrefix} 模型不存在或API端点错误`;
      } else if (status === 429) {
        return `${defaultPrefix} 请求频率限制，请稍后再试`;
      }
    }

    // 如果 error 不是 Error 的实例，则返回通用未知错误
    if (error instanceof Error) {
      return `${defaultPrefix} ${error.message || "未知错误"}`;
    }

    return `${defaultPrefix} 未知错误`;
  }

  /**
   * 发送消息到语言模型 - 子类必须实现此方法
   */
  abstract sendMessage(options: ApiCallOptions): Promise<ApiResponse>;

  /**
   * 使用流式传输发送消息到语言模型 - 子类必须实现此方法
   */
  abstract sendMessageStream(
    options: ApiCallOptions,
    onStream: StreamResponseHandler
  ): Promise<void>;
}

/**
 * OpenAI API服务实现
 */
class OpenAIService extends BaseApiService {
  async sendMessage(options: ApiCallOptions): Promise<ApiResponse> {
    try {
      const baseUrl = this.config.baseUrl || "https://api.openai.com/v1";

      if (!this.config.model) {
        return { content: "", error: "未指定OpenAI模型名称" };
      }

      // 标准化消息格式
      const messages = options.messages.map((msg) => ({
        role: this.normalizeRole(msg.role, ["user", "system", "assistant"]),
        content: msg.content,
      }));

      console.log(`OpenAI请求(${this.config.model}): ${messages.length}条消息`);

      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: this.config.model,
          messages: messages,
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
          // max_tokens 参数已移除
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          ...API_REQUEST_CONFIG, // 使用通用请求配置增加超时和大小限制
        }
      );

      if (!response.data.choices || response.data.choices.length === 0) {
        return { content: "", error: "OpenAI返回了空响应" };
      }

      return { content: response.data.choices[0].message.content || "" };
    } catch (error) {
      console.error("OpenAI API调用失败:", error);
      return { content: "", error: this.extractErrorMessage(error, "OpenAI") };
    }
  }

  async sendMessageStream(
    options: ApiCallOptions,
    onStream: StreamResponseHandler
  ): Promise<void> {
    try {
      const baseUrl = this.config.baseUrl || "https://api.openai.com/v1";

      if (!this.config.model) {
        onStream("", true);
        throw new Error("未指定OpenAI模型名称");
      }

      // 标准化消息格式
      const messages = options.messages.map((msg) => ({
        role: this.normalizeRole(msg.role, ["user", "system", "assistant"]),
        content: msg.content,
      }));

      console.log(
        `OpenAI流式请求(${this.config.model}): ${messages.length}条消息`
      );

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message || `HTTP error! status: ${response.status}`;
        onStream("", true);
        throw new Error(`OpenAI API错误: ${errorMessage}`);
      }

      if (!response.body) {
        onStream("", true);
        throw new Error("OpenAI返回了空响应流");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullContent = "";

      // 处理流式响应
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onStream(fullContent, true);
          break;
        }

        // 解码接收到的数据
        const chunk = decoder.decode(value, { stream: true });

        // 处理SSE格式的数据
        const lines = chunk
          .split("\n")
          .filter(
            (line) => line.trim() !== "" && line.trim() !== "data: [DONE]"
          );

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              // 提取文本块
              const content = jsonData.choices?.[0]?.delta?.content || "";
              if (content) {
                fullContent += content;
                onStream(fullContent, false);
              }
            } catch (e) {
              console.warn("无法解析OpenAI流式数据", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("OpenAI流式API调用失败:", error);
      onStream("", true);
      throw error;
    }
  }
}

/**
 * DeepSeek API服务实现
 */
class DeepSeekService extends BaseApiService {
  async sendMessage(options: ApiCallOptions): Promise<ApiResponse> {
    try {
      const baseUrl = this.config.baseUrl || "https://api.deepseek.com/v1";

      // 标准化消息格式
      const messages = options.messages.map((msg) => ({
        role: this.normalizeRole(msg.role, ["user", "system", "assistant"]),
        content: msg.content,
      }));

      // 特殊处理当最后一条消息不是用户消息时，添加一个用户消息作为结尾
      if (
        messages.length > 0 &&
        messages[messages.length - 1].role !== "user"
      ) {
        messages.push({ role: "user", content: "请回答上述问题。" });
      }

      console.log(
        `DeepSeek请求(${this.config.model}): ${messages.length}条消息`
      );

      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: this.config.model,
          messages: messages,
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
          // max_tokens 参数已移除
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          ...API_REQUEST_CONFIG, // 使用通用请求配置增加超时和大小限制
        }
      );

      return { content: response.data.choices[0].message.content };
    } catch (error) {
      console.error("DeepSeek API调用失败:", error);
      return {
        content: "",
        error: this.extractErrorMessage(error, "DeepSeek"),
      };
    }
  }

  async sendMessageStream(
    options: ApiCallOptions,
    onStream: StreamResponseHandler
  ): Promise<void> {
    try {
      const baseUrl = this.config.baseUrl || "https://api.deepseek.com/v1";

      // 标准化消息格式
      const messages = options.messages.map((msg) => ({
        role: this.normalizeRole(msg.role, ["user", "system", "assistant"]),
        content: msg.content,
      }));

      // 特殊处理当最后一条消息不是用户消息时，添加一个用户消息作为结尾
      if (
        messages.length > 0 &&
        messages[messages.length - 1].role !== "user"
      ) {
        messages.push({ role: "user", content: "请回答上述问题。" });
      }

      console.log(
        `DeepSeek流式请求(${this.config.model}): ${messages.length}条消息`
      );

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message || `HTTP error! status: ${response.status}`;
        onStream("", true);
        throw new Error(`DeepSeek API错误: ${errorMessage}`);
      }

      if (!response.body) {
        onStream("", true);
        throw new Error("DeepSeek返回了空响应流");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullContent = "";

      // 处理流式响应
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onStream(fullContent, true);
          break;
        }

        // 解码接收到的数据
        const chunk = decoder.decode(value, { stream: true });

        // 处理SSE格式的数据
        const lines = chunk
          .split("\n")
          .filter(
            (line) => line.trim() !== "" && line.trim() !== "data: [DONE]"
          );

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              // 提取文本块
              const content = jsonData.choices?.[0]?.delta?.content || "";
              if (content) {
                fullContent += content;
                onStream(fullContent, false);
              }
            } catch (e) {
              console.warn("无法解析DeepSeek流式数据", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("DeepSeek流式API调用失败:", error);
      onStream("", true);
      throw error;
    }
  }
}

/**
 * Gemini API服务实现
 */
class GeminiService extends BaseApiService {
  async sendMessage(options: ApiCallOptions): Promise<ApiResponse> {
    try {
      const baseUrl =
        this.config.baseUrl ||
        "https://generativelanguage.googleapis.com/v1beta";

      // 移除了模型有效性检查，允许用户自由指定任何模型名称

      // Gemini特殊处理 - 转换为Gemini支持的消息格式
      const processedMessages = this.processGeminiMessages(options.messages);
      const contents = processedMessages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      }));

      console.log(`Gemini请求(${this.config.model}): ${contents.length}条消息`);

      const response = await axios.post(
        `${baseUrl}/models/${this.config.model}:generateContent`,
        {
          contents,
          generationConfig: {
            temperature: options.temperature ?? this.config.temperature ?? 0.7,
            // maxOutputTokens 参数已移除
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.config.apiKey,
          },
          ...API_REQUEST_CONFIG, // 使用通用请求配置增加超时和大小限制
        }
      );

      // 检查安全过滤
      if (response.data.promptFeedback?.blockReason) {
        return {
          content: "",
          error: `Gemini内容被过滤: ${response.data.promptFeedback.blockReason}`,
        };
      }

      // 验证响应
      if (!response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return { content: "", error: "Gemini返回了无效响应" };
      }

      return { content: response.data.candidates[0].content.parts[0].text };
    } catch (error) {
      console.error("Gemini API调用失败:", error);
      return { content: "", error: this.extractErrorMessage(error, "Gemini") };
    }
  }

  async sendMessageStream(
    options: ApiCallOptions,
    onStream: StreamResponseHandler
  ): Promise<void> {
    try {
      const baseUrl =
        this.config.baseUrl ||
        "https://generativelanguage.googleapis.com/v1beta";

      // Gemini特殊处理 - 转换为Gemini支持的消息格式
      const processedMessages = this.processGeminiMessages(options.messages);
      const contents = processedMessages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      }));

      console.log(
        `Gemini流式请求(${this.config.model}): ${contents.length}条消息`
      );

      const response = await fetch(
        `${baseUrl}/models/${this.config.model}:streamGenerateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.config.apiKey,
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature:
                options.temperature ?? this.config.temperature ?? 0.7,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message || `HTTP error! status: ${response.status}`;
        onStream("", true);
        throw new Error(`Gemini API错误: ${errorMessage}`);
      }

      if (!response.body) {
        onStream("", true);
        throw new Error("Gemini返回了空响应流");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullContent = "";

      // 处理流式响应
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onStream(fullContent, true);
          break;
        }

        // 解码接收到的数据
        const chunk = decoder.decode(value, { stream: true });

        try {
          // Gemini流式响应可能是一个JSON对象或多个JSON对象
          // 将块分割成单独的JSON对象
          const jsonLines = chunk
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => {
              try {
                return JSON.parse(line);
              } catch (_) {
                // 忽略解析错误，返回 null
                return null;
              }
            })
            .filter(Boolean);

          for (const jsonData of jsonLines) {
            // 提取文本内容
            const textContent =
              jsonData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (textContent) {
              fullContent += textContent;
              onStream(fullContent, false);
            }

            // 检查安全过滤
            if (jsonData.promptFeedback?.blockReason) {
              throw new Error(
                `Gemini内容被过滤: ${jsonData.promptFeedback.blockReason}`
              );
            }
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes("Gemini内容被过滤")) {
            throw error;
          }
          console.warn("无法解析Gemini流式数据", error);
        }
      }
    } catch (error) {
      console.error("Gemini流式API调用失败:", error);
      onStream("", true);
      throw error;
    }
  }

  // 处理Gemini特有的消息格式
  private processGeminiMessages(
    messages: { role: string; content: string }[]
  ): { role: string; content: string }[] {
    const result: { role: string; content: string }[] = [];
    const isSimpleRequest = messages.length <= 2;

    // 简单请求模式(穿甲弹或预设)
    if (isSimpleRequest) {
      // 只取最后一条用户消息
      const userMsg = messages
        .filter((m) => m.role.toLowerCase() === "user")
        .pop();
      if (userMsg) {
        result.push({ role: "user", content: userMsg.content });
        return result;
      }

      // 没有用户消息时，尝试使用系统消息
      const sysMsg = messages
        .filter((m) => m.role.toLowerCase() === "system")
        .pop();
      if (sysMsg) {
        result.push({ role: "user", content: sysMsg.content });
        return result;
      }

      // 兜底方案
      if (messages.length > 0) {
        result.push({
          role: "user",
          content: messages[messages.length - 1].content,
        });
      }

      return result;
    }

    // 完整对话模式
    let currentRole = ""; // 跟踪当前角色

    // 处理系统消息
    const systemContents = messages
      .filter((msg) => msg.role.toLowerCase() === "system")
      .map((msg) => msg.content)
      .join("\n\n");

    if (systemContents) {
      result.push({ role: "user", content: `[系统指令] ${systemContents}` });
      currentRole = "user";
    }

    // 处理用户和助手消息
    messages
      .filter((msg) => msg.role.toLowerCase() !== "system")
      .forEach((msg) => {
        const msgRole =
          msg.role.toLowerCase() === "assistant" ? "model" : "user";

        // 保证消息交替出现
        if (result.length > 0 && currentRole === msgRole) {
          result.push({
            role: msgRole === "user" ? "model" : "user",
            content: "继续",
          });
        }

        result.push({ role: msgRole, content: msg.content });
        currentRole = msgRole;
      });

    // 确保以用户消息结尾
    if (result.length > 0 && result[result.length - 1].role !== "user") {
      result.push({ role: "user", content: "请回答上述问题。" });
    }

    return result;
  }
}

/**
 * Claude API服务实现
 */
class ClaudeService extends BaseApiService {
  async sendMessage(options: ApiCallOptions): Promise<ApiResponse> {
    try {
      const baseUrl = this.config.baseUrl || "https://api.anthropic.com/v1";

      // Claude只支持user和assistant角色
      const messages = options.messages.map((msg) => ({
        role: this.normalizeRole(msg.role, ["user", "assistant"]),
        content: msg.content,
      }));

      console.log(`Claude请求(${this.config.model}): ${messages.length}条消息`);

      const response = await axios.post(
        `${baseUrl}/messages`,
        {
          model: this.config.model,
          messages: messages,
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
          // max_tokens 参数已移除
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.config.apiKey,
            "anthropic-version": "2023-06-01",
          },
          ...API_REQUEST_CONFIG, // 使用通用请求配置增加超时和大小限制
        }
      );

      if (!response.data.content?.[0]?.text) {
        return { content: "", error: "Claude返回了无效响应" };
      }

      return { content: response.data.content[0].text };
    } catch (error) {
      console.error("Claude API调用失败:", error);
      return { content: "", error: this.extractErrorMessage(error, "Claude") };
    }
  }

  async sendMessageStream(
    options: ApiCallOptions,
    onStream: StreamResponseHandler
  ): Promise<void> {
    try {
      const baseUrl = this.config.baseUrl || "https://api.anthropic.com/v1";

      // Claude只支持user和assistant角色
      const messages = options.messages.map((msg) => ({
        role: this.normalizeRole(msg.role, ["user", "assistant"]),
        content: msg.content,
      }));

      console.log(
        `Claude流式请求(${this.config.model}): ${messages.length}条消息`
      );

      const response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "messages-2023-12-15", // 启用流式传输
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message || `HTTP error! status: ${response.status}`;
        onStream("", true);
        throw new Error(`Claude API错误: ${errorMessage}`);
      }

      if (!response.body) {
        onStream("", true);
        throw new Error("Claude返回了空响应流");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullContent = "";

      // 处理流式响应
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onStream(fullContent, true);
          break;
        }

        // 解码接收到的数据
        const chunk = decoder.decode(value, { stream: true });

        // 处理Claude的SSE格式
        const lines = chunk
          .split("\n")
          .filter(
            (line) => line.trim() !== "" && line.trim() !== "data: [DONE]"
          );

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              // 提取文本块 - Claude特定格式
              if (jsonData.type === "content_block_delta") {
                const deltaText = jsonData.delta?.text || "";
                if (deltaText) {
                  fullContent += deltaText;
                  onStream(fullContent, false);
                }
              } else if (jsonData.type === "message_stop") {
                // 消息结束
                onStream(fullContent, true);
              }
            } catch (e) {
              console.warn("无法解析Claude流式数据", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Claude流式API调用失败:", error);
      onStream("", true);
      throw error;
    }
  }
}
