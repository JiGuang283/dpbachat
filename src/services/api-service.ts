import axios from "axios";
import { ApiCallOptions, ApiResponse, ModelConfig, ModelType } from "@/types";

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
  protected extractErrorMessage(error: any, defaultPrefix: string): string {
    // 首先尝试从响应数据中获取错误信息
    if (error.response?.data?.error?.message) {
      return error.response.data.error.message;
    } else if (error.response?.data?.message) {
      return error.response.data.message;
    } else if (error.message) {
      return error.message;
    }

    // 基于HTTP状态码给出友好提示
    if (error.response?.status === 401) {
      return `${defaultPrefix} API密钥无效或已过期`;
    } else if (error.response?.status === 404) {
      return `${defaultPrefix} 模型不存在或API端点错误`;
    } else if (error.response?.status === 429) {
      return `${defaultPrefix} 请求频率限制，请稍后再试`;
    }

    return `${defaultPrefix} 未知错误`;
  }

  /**
   * 发送消息到语言模型 - 子类必须实现此方法
   */
  abstract sendMessage(options: ApiCallOptions): Promise<ApiResponse>;
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
          max_tokens: options.maxTokens ?? this.config.maxTokens ?? 2000,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (!response.data.choices || response.data.choices.length === 0) {
        return { content: "", error: "OpenAI返回了空响应" };
      }

      return { content: response.data.choices[0].message.content || "" };
    } catch (error: any) {
      console.error("OpenAI API调用失败:", error);
      return { content: "", error: this.extractErrorMessage(error, "OpenAI") };
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
      const validModels = ["deepseek-chat", "deepseek-reasoner"];

      if (!validModels.includes(this.config.model)) {
        return {
          content: "",
          error: `不支持的DeepSeek模型: ${
            this.config.model
          }。请使用: ${validModels.join(", ")}`,
        };
      }

      // 标准化消息格式
      let messages = options.messages.map((msg) => ({
        role: this.normalizeRole(msg.role, ["user", "system", "assistant"]),
        content: msg.content,
      }));

      // 特殊处理 deepseek-reasoner 模型
      if (
        this.config.model === "deepseek-reasoner" &&
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
          max_tokens: options.maxTokens ?? this.config.maxTokens,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        }
      );

      return { content: response.data.choices[0].message.content };
    } catch (error: any) {
      console.error("DeepSeek API调用失败:", error);
      return {
        content: "",
        error: this.extractErrorMessage(error, "DeepSeek"),
      };
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
      const validModels = [
        "gemini-2.5-flash-preview-04-17",
        "gemini-2.5-pro-preview-05-06",
        "gemini-2.0-flash",
      ];

      if (!validModels.includes(this.config.model)) {
        return {
          content: "",
          error: `不支持的Gemini模型: ${
            this.config.model
          }。请使用: ${validModels.join(", ")}`,
        };
      }

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
            maxOutputTokens: options.maxTokens ?? this.config.maxTokens,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.config.apiKey,
          },
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
    } catch (error: any) {
      console.error("Gemini API调用失败:", error);
      return { content: "", error: this.extractErrorMessage(error, "Gemini") };
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
          max_tokens: options.maxTokens ?? this.config.maxTokens,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.config.apiKey,
            "anthropic-version": "2023-06-01",
          },
        }
      );

      if (!response.data.content?.[0]?.text) {
        return { content: "", error: "Claude返回了无效响应" };
      }

      return { content: response.data.content[0].text };
    } catch (error: any) {
      console.error("Claude API调用失败:", error);
      return { content: "", error: this.extractErrorMessage(error, "Claude") };
    }
  }
}
