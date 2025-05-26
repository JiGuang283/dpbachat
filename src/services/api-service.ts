import axios, { AxiosError } from "axios";
import { ApiCallOptions, ApiResponse, ModelConfig, ModelType } from "@/types";

/**
 * 流式响应处理函数（传递增量内容）
 */
export type StreamResponseHandler = (
  chunk: string, // 当前增量内容（非累积）
  isComplete: boolean
) => void;

/**
 * 通用API请求配置 - 增加超时和响应大小处理
 */
const API_REQUEST_CONFIG = {
  timeout: 180000, // 2分钟超时
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
};

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
 * 基础API服务抽象类（修正参数后）
 */
abstract class BaseApiService {
  protected config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  /**
   * 标准化消息角色（支持更多角色）
   */
  protected normalizeRole(role: string, supportedRoles: string[]): string {
    const normalizedRole = role.toLowerCase();
    return supportedRoles.includes(normalizedRole) ? normalizedRole : "user";
  }

  /**
   * 提取API错误信息（使用AxiosError类型断言）
   */
  protected extractErrorMessage(error: unknown, defaultPrefix: string): string {
    if (error instanceof AxiosError) {
      const responseData = error.response?.data;
      if (responseData?.error) {
        return typeof responseData.error === "string"
          ? responseData.error
          : responseData.error.message || `${defaultPrefix} API错误`;
      }
      if (responseData?.message) return responseData.message;

      const status = error.response?.status;
      switch (status) {
        case 401:
          return `${defaultPrefix} API密钥无效或已过期`;
        case 404:
          return `${defaultPrefix} 模型不存在或API端点错误`;
        case 429:
          return `${defaultPrefix} 请求频率限制，请稍后再试`;
        default:
          return `${defaultPrefix} API请求失败 (${status || "未知状态码"})`;
      }
    }

    return error instanceof Error
      ? `${defaultPrefix} ${error.message || "未知错误"}`
      : `${defaultPrefix} 未知错误`;
  }

  /**
   * 通用流式处理方法（修正参数：明确包含onStream）
   */
  protected async handleStreamRequest(
    url: string,
    requestBody: any,
    headers: Record<string, string>,
    parseChunk: (chunk: any) => string, // 子类实现的增量解析函数
    onStream: StreamResponseHandler // 新增：流式回调参数
  ): Promise<void> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `HTTP错误: ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error("API返回了空响应流");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onStream("", true); // 流结束时触发完成回调
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              const delta = parseChunk(jsonData); // 子类解析增量
              if (delta) onStream(delta, false); // 传递增量内容
            } catch (parseError) {
              console.warn("流式数据解析失败:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("流式请求失败:", error);
      onStream("", true); // 异常时强制结束
      throw error;
    }
  }

  abstract sendMessage(options: ApiCallOptions): Promise<ApiResponse>;
  abstract sendMessageStream(
    options: ApiCallOptions,
    onStream: StreamResponseHandler
  ): Promise<void>;
}

/**
 * OpenAI API服务实现（修正流式调用）
 */
class OpenAIService extends BaseApiService {
  async sendMessage(options: ApiCallOptions): Promise<ApiResponse> {
    try {
      const baseUrl = this.config.baseUrl || "https://api.openai.com/v1";
      if (!this.config.model)
        return { content: "", error: "未指定OpenAI模型名称" };

      const messages = options.messages.map((msg) => ({
        role: this.normalizeRole(msg.role, ["user", "system", "assistant"]),
        content: msg.content,
      }));

      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: this.config.model,
          messages,
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
        },
        {
          headers: { Authorization: `Bearer ${this.config.apiKey}` },
          ...API_REQUEST_CONFIG,
        }
      );

      return {
        content: response.data.choices?.[0]?.message?.content || "",
        error: response.data.error?.message,
      };
    } catch (error) {
      return {
        content: "",
        error: this.extractErrorMessage(error, "OpenAI"),
      };
    }
  }

  async sendMessageStream(
    options: ApiCallOptions,
    onStream: StreamResponseHandler
  ): Promise<void> {
    const baseUrl = this.config.baseUrl || "https://api.openai.com/v1";
    if (!this.config.model) {
      onStream("", true);
      return;
    }

    const messages = options.messages.map((msg) => ({
      role: this.normalizeRole(msg.role, ["user", "system", "assistant"]),
      content: msg.content,
    }));

    // 调用handleStreamRequest时传递完整5个参数（新增onStream）
    await this.handleStreamRequest(
      `${baseUrl}/chat/completions`,
      {
        model: this.config.model,
        messages,
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        stream: true,
      },
      { Authorization: `Bearer ${this.config.apiKey}` },
      (jsonData) => jsonData.choices?.[0]?.delta?.content || "",
      onStream // 补充第5个参数：流式回调
    );
  }
}

/**
 * DeepSeek API服务实现（修正流式调用）
 */
class DeepSeekService extends BaseApiService {
  async sendMessage(options: ApiCallOptions): Promise<ApiResponse> {
    try {
      const baseUrl = this.config.baseUrl || "https://api.deepseek.com/v1";
      if (!this.config.model)
        return { content: "", error: "未指定DeepSeek模型名称" };

      const messages = options.messages.map((msg) => ({
        role: this.normalizeRole(msg.role, ["user", "system", "assistant"]),
        content: msg.content,
      }));

      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: this.config.model,
          messages,
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
        },
        {
          headers: { Authorization: `Bearer ${this.config.apiKey}` },
          ...API_REQUEST_CONFIG,
        }
      );

      return {
        content: response.data.choices?.[0]?.message?.content || "",
        error: response.data.error?.message,
      };
    } catch (error) {
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
    const baseUrl = this.config.baseUrl || "https://api.deepseek.com/v1";
    if (!this.config.model) {
      onStream("", true);
      return;
    }

    const messages = options.messages.map((msg) => ({
      role: this.normalizeRole(msg.role, ["user", "system", "assistant"]),
      content: msg.content,
    }));

    await this.handleStreamRequest(
      `${baseUrl}/chat/completions`,
      {
        model: this.config.model,
        messages,
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        stream: true,
      },
      { Authorization: `Bearer ${this.config.apiKey}` },
      (jsonData) => jsonData.choices?.[0]?.delta?.content || "",
      onStream // 补充第5个参数
    );
  }
}

/**
 * Gemini API服务实现（修正流式调用）
 */
class GeminiService extends BaseApiService {
  async sendMessage(options: ApiCallOptions): Promise<ApiResponse> {
    try {
      const baseUrl =
        this.config.baseUrl ||
        "https://generativelanguage.googleapis.com/v1beta";
      if (!this.config.model)
        return { content: "", error: "未指定Gemini模型名称" };

      const contents = options.messages.map((msg) => ({
        role: this.normalizeRole(msg.role, ["user", "system", "model"]),
        parts: [{ text: msg.content }],
      }));

      const response = await axios.post(
        `${baseUrl}/models/${this.config.model}:generateContent`,
        {
          contents,
          generationConfig: {
            temperature: options.temperature ?? this.config.temperature ?? 0.7,
          },
        },
        {
          headers: { "x-goog-api-key": this.config.apiKey },
          ...API_REQUEST_CONFIG,
        }
      );

      if (response.data.promptFeedback?.blockReason) {
        return {
          content: "",
          error: `内容被过滤: ${response.data.promptFeedback.blockReason}`,
        };
      }

      return {
        content: response.data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        error: response.data.error?.message,
      };
    } catch (error) {
      return {
        content: "",
        error: this.extractErrorMessage(error, "Gemini"),
      };
    }
  }

  async sendMessageStream(
    options: ApiCallOptions,
    onStream: StreamResponseHandler
  ): Promise<void> {
    const baseUrl =
      this.config.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
    if (!this.config.model) {
      onStream("", true);
      return;
    }

    const contents = options.messages.map((msg) => ({
      role: this.normalizeRole(msg.role, ["user", "system", "model"]),
      parts: [{ text: msg.content }],
    }));

    // Gemini 流式响应的特殊处理
    await this.handleGeminiStreamRequest(
      `${baseUrl}/models/${this.config.model}:streamGenerateContent?alt=sse`,
      {
        contents,
        generationConfig: {
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
        },
      },
      { "x-goog-api-key": this.config.apiKey },
      onStream
    );
  }

  /**
   * Gemini 特殊的流式处理方法
   */
  private async handleGeminiStreamRequest(
    url: string,
    requestBody: any,
    headers: Record<string, string>,
    onStream: StreamResponseHandler
  ): Promise<void> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `HTTP错误: ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error("API返回了空响应流");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onStream("", true); // 流结束时触发完成回调
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 保留最后一行不完整的数据

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              onStream("", true);
              return;
            }

            try {
              const jsonData = JSON.parse(data);
              // Gemini 流式响应格式：candidates[0].content.parts[0].text
              const delta =
                jsonData.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (delta) {
                onStream(delta, false); // 传递增量内容
              }
            } catch (parseError) {
              console.warn(
                "Gemini 流式数据解析失败:",
                parseError,
                "原始数据:",
                data
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Gemini 流式请求失败:", error);
      onStream("", true); // 异常时强制结束
      throw error;
    }
  }
}

/**
 * Claude API服务实现（修正流式调用）
 */
class ClaudeService extends BaseApiService {
  async sendMessage(options: ApiCallOptions): Promise<ApiResponse> {
    try {
      const baseUrl = this.config.baseUrl || "https://api.anthropic.com/v1";
      if (!this.config.model)
        return { content: "", error: "未指定Claude模型名称" };

      const messages = options.messages.map((msg) => ({
        role: this.normalizeRole(msg.role, ["user", "system", "assistant"]),
        content: msg.content,
      }));

      const response = await axios.post(
        `${baseUrl}/messages`,
        {
          model: this.config.model,
          messages,
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
        },
        {
          headers: {
            "x-api-key": this.config.apiKey,
            "anthropic-version": "2023-06-01",
          },
          ...API_REQUEST_CONFIG,
        }
      );

      return {
        content: response.data.content?.[0]?.text || "",
        error: response.data.error?.message,
      };
    } catch (error) {
      return {
        content: "",
        error: this.extractErrorMessage(error, "Claude"),
      };
    }
  }

  async sendMessageStream(
    options: ApiCallOptions,
    onStream: StreamResponseHandler
  ): Promise<void> {
    const baseUrl = this.config.baseUrl || "https://api.anthropic.com/v1";
    if (!this.config.model) {
      onStream("", true);
      return;
    }

    const messages = options.messages.map((msg) => ({
      role: this.normalizeRole(msg.role, ["user", "system", "assistant"]),
      content: msg.content,
    }));

    await this.handleStreamRequest(
      `${baseUrl}/messages`,
      {
        model: this.config.model,
        messages,
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        stream: true,
      },
      {
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "messages-2023-12-15",
      },
      (jsonData) =>
        jsonData.type === "content_block_delta"
          ? jsonData.delta?.text || ""
          : "",
      onStream // 补充第5个参数
    );
  }
}
