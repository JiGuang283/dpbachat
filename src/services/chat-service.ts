// import { v4 as uuidv4 } from "uuid"; // 未使用，暂时注释
import { createApiService } from "./api-service";
import { useAppStore } from "@/store";
import {
  ApiCallOptions,
  Conversation,
  // Message, // 未使用，暂时注释
  MessageRole,
  ModelConfig,
  Preset,
} from "@/types";
import { StreamResponseHandler } from "./api-service";

export class ChatService {
  /**
   * 发送预设并等待AI响应
   */
  static async initializeWithPreset(
    conversation: Conversation,
    model: ModelConfig,
    preset: Preset | null
  ): Promise<void> {
    if (!preset) return;

    const store = useAppStore.getState();
    try {
      // 标记创建中，UI可监听此状态显示动画
      store.setCreating(true);

      // 1. 发送穿甲弹（以用户消息身份），等待AI回复
      if (preset.armoringPrompt.trim()) {
        console.log(
          `开始发送穿甲弹: ${preset.armoringPrompt.substring(0, 50)}...`
        );

        // 添加用户穿甲弹消息
        store.addMessage(
          conversation.id,
          MessageRole.User,
          preset.armoringPrompt
        );

        // 确保模型配置有效
        if (!model.apiKey || model.apiKey.trim() === "") {
          store.addMessage(
            conversation.id,
            MessageRole.Assistant,
            `错误: 模型API密钥未配置或为空`
          );
          return;
        }

        // 发送穿甲弹消息并等待AI回复
        await this.sendSingleMessageAndWait(conversation.id, model);
        console.log(`穿甲弹发送完成，AI已回复`);
      }

      // 2. 发送系统预设（以用户消息身份），等待AI回复
      if (preset.systemPrompt.trim()) {
        console.log(
          `开始发送系统预设: ${preset.systemPrompt.substring(0, 50)}...`
        );

        // 添加用户系统预设消息
        store.addMessage(
          conversation.id,
          MessageRole.User,
          preset.systemPrompt
        );

        // 发送系统预设消息并等待AI回复
        await this.sendSingleMessageAndWait(conversation.id, model);
        console.log(`系统预设发送完成，AI已回复，对话初始化完成`);
      }
    } catch (error) {
      console.error(`预设初始化异常:`, error);
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      store.addMessage(
        conversation.id,
        MessageRole.Assistant,
        `初始化对话失败: ${errorMessage}`
      );
    } finally {
      // 创建结束，关闭动画
      store.setCreating(false);
    }
  }

  /**
   * 辅助方法：发送对话中最后一条用户消息并等待AI回复
   */
  private static async sendSingleMessageAndWait(
    conversationId: string,
    model: ModelConfig
  ): Promise<void> {
    const store = useAppStore.getState();
    const conversation = store.conversations.find(
      (c) => c.id === conversationId
    );
    if (!conversation) throw new Error("找不到对话");

    // 只发送最后一条用户消息
    const lastUserMsg = [...conversation.messages]
      .reverse()
      .find((m) => m.role === MessageRole.User);
    if (!lastUserMsg) {
      console.warn("找不到用户消息，无法发送");
      return;
    }

    console.log(`准备发送消息至${model.type}模型:`, {
      modelName: model.name,
      modelType: model.type,
      lastMessagePreview: lastUserMsg.content.substring(0, 30) + "...",
    });

    // 重新获取最新的对话内容，确保包含所有消息
    const updatedConversation = useAppStore
      .getState()
      .conversations.find((c) => c.id === conversationId);

    if (!updatedConversation) {
      throw new Error("找不到更新后的对话");
    }

    // 组装消息历史，发送全部对话消息，保证上下文完整
    const apiMessages = updatedConversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      if (!model.apiKey || model.apiKey.trim() === "") {
        throw new Error("模型API密钥未配置或为空");
      }

      const apiService = createApiService(model);
      const response = await apiService.sendMessage({ messages: apiMessages });

      if (response.error) {
        console.error(`API返回错误:`, response.error);
        store.addMessage(
          conversationId,
          MessageRole.Assistant,
          `错误: ${response.error}`
        );
      } else {
        console.log(`收到AI回复，长度: ${response.content.length}`);
        store.addMessage(
          conversationId,
          MessageRole.Assistant,
          response.content
        );
      }

      // 返回前短暂延迟，确保UI更新
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`发送消息异常:`, error);

      // 定义API错误响应接口
      interface ApiErrorResponse {
        status: number;
        data:
          | string
          | {
              error?: string | { message?: string };
            };
      }

      // 类型守卫函数，用于检查对象是否符合API错误类型
      const isApiError = (
        err: unknown
      ): err is {
        message: string;
        response?: ApiErrorResponse;
        code?: string;
      } => {
        return err !== null && typeof err === "object" && "message" in err;
      };

      const errorMessage = isApiError(error) ? error.message : "未知错误";

      // 提取更详细的错误信息
      let detailedError = errorMessage;

      // 处理网络错误和超时错误
      if (isApiError(error) && error.code === "ECONNABORTED") {
        detailedError =
          "请求超时，模型生成响应时间过长。请尝试减少输入内容或分批发送消息";
      } else if (isApiError(error) && error.code === "ERR_NETWORK") {
        detailedError = "网络连接错误，请检查您的网络连接并重试";
      }
      if (isApiError(error) && error.response) {
        const statusCode = error.response.status;
        detailedError = `请求失败 (${statusCode}): `;

        // 尝试提取响应中的错误信息
        if (error.response.data) {
          try {
            const errorData =
              typeof error.response.data === "string"
                ? JSON.parse(error.response.data)
                : error.response.data;

            if (errorData.error) {
              detailedError +=
                typeof errorData.error === "object"
                  ? JSON.stringify(errorData.error)
                  : errorData.error;
            }
          } catch {} // 去除未使用变量 _parseError
        }
      }

      store.addMessage(
        conversationId,
        MessageRole.Assistant,
        `错误: ${detailedError}`
      );
    }
  }

  /**
   * 发送穿甲弹并等待AI响应
   */
  private static async sendArmoringPrompt(
    conversationId: string,
    model: ModelConfig,
    armoringPrompt: string
  ): Promise<void> {
    const store = useAppStore.getState();

    // 添加用户穿甲弹消息
    store.addMessage(conversationId, MessageRole.User, armoringPrompt);

    try {
      // 检查模型配置是否有效
      if (!model.apiKey || model.apiKey.trim() === "") {
        store.addMessage(
          conversationId,
          MessageRole.Assistant,
          `错误: 模型API密钥未配置或为空`
        );
        return;
      }

      // 发送给AI
      const apiService = createApiService(model);

      // 重新获取最新的对话内容
      const updatedConversation = useAppStore
        .getState()
        .conversations.find((c) => c.id === conversationId);

      if (!updatedConversation) {
        throw new Error("找不到更新后的对话");
      }

      // 使用系统消息模式发送穿甲弹，这样更有效
      // 注意：这里特意不使用对话历史，而是单独构建消息列表，以便穿甲弹起效
      const messages = [
        { role: MessageRole.System, content: "您是一个有用的AI助手。" },
        { role: MessageRole.User, content: armoringPrompt },
      ];

      console.log(`发送穿甲弹请求到${model.type}模型:`, {
        modelId: model.id,
        modelName: model.name,
        modelType: model.type,
        model: model.model,
        baseUrl: model.baseUrl,
      });

      const response = await apiService.sendMessage({ messages });

      if (response.error) {
        console.error(`穿甲弹API错误:`, response.error);
        store.addMessage(
          conversationId,
          MessageRole.Assistant,
          `错误: ${response.error}`
        );
      } else {
        store.addMessage(
          conversationId,
          MessageRole.Assistant,
          response.content
        );
      }
    } catch (error) {
      console.error(`穿甲弹发送异常:`, error);
      // Safely access error properties
      let errorMessageText = "发送穿甲弹失败";
      if (error instanceof Error) {
        errorMessageText = error.message;
      }

      let detailedError = errorMessageText;
      // Check if error is Axios-like error
      // Assuming error might have a 'response' property like Axios errors
      const potentialAxiosError = error as {
        response?: { status?: number; data?: unknown };
        code?: string;
        message?: string;
      }; // More specific type

      // 处理网络错误和超时错误
      if (potentialAxiosError.code === "ECONNABORTED") {
        detailedError =
          "请求超时，模型生成响应时间过长。请尝试减少输入内容或分批发送消息";
      } else if (potentialAxiosError.code === "ERR_NETWORK") {
        detailedError = "网络连接错误，请检查您的网络连接并重试";
      } else if (
        potentialAxiosError?.response?.status &&
        potentialAxiosError?.response?.data
      ) {
        detailedError += ` (状态码: ${potentialAxiosError.response.status})`;
        if (potentialAxiosError.response.data) {
          try {
            const errorData =
              typeof potentialAxiosError.response.data === "string"
                ? JSON.parse(potentialAxiosError.response.data)
                : potentialAxiosError.response.data;
            if (errorData.error) {
              detailedError += `: ${
                typeof errorData.error === "string"
                  ? errorData.error
                  : JSON.stringify(errorData.error)
              }`;
            }
          } catch {} // 去除未使用变量 _ignoredJsonParseError
        }
      }

      // 特殊处理常见的错误信息
      if (
        detailedError.toLowerCase().includes("model") &&
        detailedError.toLowerCase().includes("not exist")
      ) {
        detailedError = `模型不存在或无法访问。请在设置中检查模型名称 "${model.model}" 是否正确。`;
      }

      store.addMessage(
        conversationId,
        MessageRole.Assistant,
        `错误: ${detailedError}`
      );
    }
  }

  /**
   * 发送常规消息(非流式)
   */
  static async sendMessage(
    conversationId: string,
    content: string
  ): Promise<void> {
    const store = useAppStore.getState();
    const conversation = store.conversations.find(
      (c) => c.id === conversationId
    );

    if (!conversation) {
      throw new Error("找不到对话");
    }

    const model = store.models.find((m) => m.id === conversation.modelId);

    if (!model) {
      throw new Error("找不到模型配置");
    }

    // 检查模型配置是否有效
    if (!model.apiKey || model.apiKey.trim() === "") {
      store.addMessage(
        conversationId,
        MessageRole.Assistant,
        `错误: 模型API密钥未配置或为空，请先在设置中配置有效的API密钥`
      );
      return;
    }

    // 添加用户消息
    store.addMessage(conversationId, MessageRole.User, content);

    // 重新获取更新后的对话内容，确保包含刚添加的消息
    const updatedConversation = useAppStore
      .getState()
      .conversations.find((c) => c.id === conversationId);

    if (!updatedConversation) {
      throw new Error("找不到更新后的对话");
    }

    try {
      // 准备API调用的消息，使用更新后的对话消息列表
      const apiMessages = updatedConversation.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      console.log(`发送聊天请求到${model.type}模型:`, {
        modelId: model.id,
        modelName: model.name,
        modelType: model.type,
        model: model.model,
        messageCount: apiMessages.length,
        baseUrl: model.baseUrl,
        lastUserMessage:
          content.substring(0, 30) + (content.length > 30 ? "..." : ""),
      });

      // 发送给AI
      const apiService = createApiService(model);
      const response = await apiService.sendMessage({ messages: apiMessages });

      if (response.error) {
        console.error(`聊天API错误:`, response.error);
        store.addMessage(
          conversationId,
          MessageRole.Assistant,
          `错误: ${response.error}`
        );
      } else {
        store.addMessage(
          conversationId,
          MessageRole.Assistant,
          response.content
        );
      }
    } catch (error) {
      console.error(`聊天发送异常:`, error);
      let errorMessageText = "未知错误";
      if (error instanceof Error) {
        errorMessageText = error.message;
      }

      // Check if error is Axios-like error
      // Assuming error might have a 'response' property like Axios errors
      const potentialAxiosError = error as {
        response?: { status?: number; data?: unknown };
        code?: string;
        message?: string;
      }; // More specific type

      // 处理网络错误和超时错误
      if (potentialAxiosError.code === "ECONNABORTED") {
        errorMessageText =
          "请求超时，模型生成响应时间过长。请尝试减少输入内容或分批发送消息";
      } else if (potentialAxiosError.code === "ERR_NETWORK") {
        errorMessageText = "网络连接错误，请检查您的网络连接并重试";
      } else if (
        potentialAxiosError?.response?.status &&
        potentialAxiosError?.response?.data
      ) {
        const statusCode = potentialAxiosError.response.status;
        let detailedErrorText = `请求失败 (${statusCode})`;

        // 针对常见HTTP错误给出友好提示
        if (statusCode === 401) {
          detailedErrorText = "API密钥无效或已过期，请更新您的密钥";
        } else if (statusCode === 404) {
          detailedErrorText =
            "模型不存在或API端点错误，请检查模型名称和API配置";
        } else if (statusCode === 400) {
          detailedErrorText = "请求参数错误，可能是模型配置不正确";
        } else if (statusCode === 429) {
          detailedErrorText = "达到API请求限制，请稍后再试";
        } else if (statusCode >= 500) {
          detailedErrorText = "服务器错误，请稍后再试";
        }

        // 尝试提取响应中的错误信息
        if (potentialAxiosError.response.data) {
          try {
            const errorData =
              typeof potentialAxiosError.response.data === "string"
                ? JSON.parse(potentialAxiosError.response.data)
                : potentialAxiosError.response.data;
            if (errorData.error && typeof errorData.error === "object") {
              detailedErrorText += `: ${
                errorData.error.message || JSON.stringify(errorData.error)
              }`;
            } else if (errorData.error) {
              detailedErrorText += `: ${errorData.error}`;
            }
          } catch {} // 去除未使用变量 _ignoredJsonParseError
        }
        errorMessageText = detailedErrorText;
      }

      store.addMessage(
        conversationId,
        MessageRole.Assistant,
        `错误: ${errorMessageText}`
      );
    }
  }

  /**
   * 发送流式消息 - 通过流式API实时返回响应
   */
  static async sendMessageStream(
    conversationId: string,
    content: string,
    onStreamUpdate: (content: string, isComplete: boolean) => void
  ): Promise<void> {
    const store = useAppStore.getState();
    const conversation = store.conversations.find(
      (c) => c.id === conversationId
    );

    if (!conversation) {
      throw new Error("找不到对话");
    }

    const model = store.models.find((m) => m.id === conversation.modelId);

    if (!model) {
      throw new Error("找不到模型配置");
    }

    // 检查模型配置是否有效
    if (!model.apiKey || model.apiKey.trim() === "") {
      onStreamUpdate(
        `错误: 模型API密钥未配置或为空，请先在设置中配置有效的API密钥`,
        true
      );
      store.addMessage(
        conversationId,
        MessageRole.Assistant,
        `错误: 模型API密钥未配置或为空，请先在设置中配置有效的API密钥`
      );
      return;
    }

    // 添加用户消息
    store.addMessage(conversationId, MessageRole.User, content);

    // 创建一个空的助手消息，后续会更新内容
    const assistantMessageId = store.addMessage(
      conversationId,
      MessageRole.Assistant,
      ""
    );

    // 重新获取更新后的对话内容，确保包含刚添加的消息
    const updatedConversation = useAppStore
      .getState()
      .conversations.find((c) => c.id === conversationId);

    if (!updatedConversation) {
      throw new Error("找不到更新后的对话");
    }

    try {
      // 准备API调用的消息，但排除最后一条空的助手消息
      const apiMessages = updatedConversation.messages
        .filter((msg) => msg.id !== assistantMessageId)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      console.log(`发送流式聊天请求到${model.type}模型:`, {
        modelId: model.id,
        modelName: model.name,
        modelType: model.type,
        model: model.model,
        messageCount: apiMessages.length,
        baseUrl: model.baseUrl,
        lastUserMessage:
          content.substring(0, 30) + (content.length > 30 ? "..." : ""),
      });

      // 创建流式处理函数
      const handleStreamResponse: StreamResponseHandler = (
        text,
        isComplete
      ) => {
        // 更新UI
        onStreamUpdate(text, isComplete);

        // 更新存储中的消息
        store.updateMessageContent(conversationId, assistantMessageId, text);
      };

      // 发送给AI并处理流式响应
      const apiService = createApiService(model);
      await apiService.sendMessageStream(
        { messages: apiMessages },
        handleStreamResponse
      );
    } catch (error) {
      console.error(`流式聊天发送异常:`, error);
      let errorMessageText = "未知错误";
      if (error instanceof Error) {
        errorMessageText = error.message;
      }

      // 处理网络错误和超时错误
      const potentialAxiosError = error as {
        response?: { status?: number; data?: unknown };
        code?: string;
        message?: string;
      };

      if (potentialAxiosError.code === "ECONNABORTED") {
        errorMessageText =
          "请求超时，模型生成响应时间过长。请尝试减少输入内容或分批发送消息";
      } else if (potentialAxiosError.code === "ERR_NETWORK") {
        errorMessageText = "网络连接错误，请检查您的网络连接并重试";
      } else if (
        potentialAxiosError?.response?.status &&
        potentialAxiosError?.response?.data
      ) {
        const statusCode = potentialAxiosError.response.status;
        let detailedErrorText = `请求失败 (${statusCode})`;

        // 针对常见HTTP错误给出友好提示
        if (statusCode === 401) {
          detailedErrorText = "API密钥无效或已过期，请更新您的密钥";
        } else if (statusCode === 404) {
          detailedErrorText =
            "模型不存在或API端点错误，请检查模型名称和API配置";
        } else if (statusCode === 400) {
          detailedErrorText = "请求参数错误，可能是模型配置不正确";
        } else if (statusCode === 429) {
          detailedErrorText = "达到API请求限制，请稍后再试";
        } else if (statusCode >= 500) {
          detailedErrorText = "服务器错误，请稍后再试";
        }

        // 尝试提取响应中的错误信息
        if (potentialAxiosError.response.data) {
          try {
            const errorData =
              typeof potentialAxiosError.response.data === "string"
                ? JSON.parse(potentialAxiosError.response.data)
                : potentialAxiosError.response.data;
            if (errorData.error && typeof errorData.error === "object") {
              detailedErrorText += `: ${
                errorData.error.message || JSON.stringify(errorData.error)
              }`;
            } else if (errorData.error) {
              detailedErrorText += `: ${errorData.error}`;
            }
          } catch {} // 去除未使用变量 _ignoredJsonParseError
        }
        errorMessageText = detailedErrorText;
      }

      const errorText = `错误: ${errorMessageText}`;
      onStreamUpdate(errorText, true);
      store.updateMessageContent(conversationId, assistantMessageId, errorText);
    }
  }
}
