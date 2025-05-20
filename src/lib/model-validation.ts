import { ModelConfig, ModelType } from "@/types";

// 验证模型配置的有效性 - 现在只进行基本验证和警告提示，不再强制要求模型标识符必须在预定义列表中
export function validateModelConfig(config: ModelConfig): string | null {
  // 检查必要字段
  if (!config.apiKey || config.apiKey.trim() === "") {
    return "API密钥不能为空";
  }

  if (!config.model || config.model.trim() === "") {
    return "模型标识符不能为空";
  }

  // 不再对模型名称做强制验证，已删除特定类型验证方法的调用
  return null; // 验证通过
}

// 验证OpenAI模型配置 - 改为只提供提示信息，不强制限制模型
function validateOpenAIConfig(config: ModelConfig): string | null {
  // 这些方法保留但不再实际调用它们，只作为帮助信息的参考
  return null;
}

// 验证DeepSeek模型配置 - 改为只提供提示信息，不强制限制模型
function validateDeepSeekConfig(config: ModelConfig): string | null {
  // 这些方法保留但不再实际调用它们，只作为帮助信息的参考
  return null;
}

// 验证Gemini模型配置 - 改为只提供提示信息，不强制限制模型
function validateGeminiConfig(config: ModelConfig): string | null {
  // 这些方法保留但不再实际调用它们，只作为帮助信息的参考
  return null;
}

// 验证Claude模型配置 - 改为只提供提示信息，不强制限制模型
function validateClaudeConfig(config: ModelConfig): string | null {
  // 这些方法保留但不再实际调用它们，只作为帮助信息的参考
  return null;
}

// 获取模型类型的显示名称
export function getModelTypeName(type: ModelType): string {
  switch (type) {
    case ModelType.OpenAI:
      return "OpenAI";
    case ModelType.DeepSeek:
      return "DeepSeek";
    case ModelType.Gemini:
      return "Gemini";
    case ModelType.Claude:
      return "Claude";
    default:
      return type;
  }
}

// 获取模型类型的常见模型列表
export function getCommonModelsForType(type: ModelType): string[] {
  switch (type) {
    case ModelType.OpenAI:
      return [
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-16k",
        "gpt-4",
        "gpt-4-turbo",
        "gpt-4o",
        "gpt-4o-mini",
      ];
    case ModelType.DeepSeek:
      return ["deepseek-chat", "deepseek-reasoner"];
    case ModelType.Gemini:
      return [
        "gemini-2.5-flash-preview-04-17",
        "gemini-2.5-pro-preview-05-06",
        "gemini-2.0-flash",
      ];
    case ModelType.Claude:
      return [
        "claude-instant-1",
        "claude-2",
        "claude-2.1",
        "claude-3-opus",
        "claude-3-sonnet",
        "claude-3-haiku",
      ];
    default:
      return [];
  }
}

// 模型错误帮助信息
export const modelErrorHelp = {
  deepseek: {
    model_not_exist: `
DeepSeek模型不存在错误通常有以下几个原因：
1. 模型名称输入错误：确保使用正确的DeepSeek模型名称，仅支持"deepseek-chat"或"deepseek-reasoner"
2. API访问权限问题：确保您的DeepSeek API密钥有权限访问该模型

常见的DeepSeek模型名称包括：
- deepseek-chat
- deepseek-reasoner
    `,
  },
  gemini: {
    model_not_exist: `
Gemini模型不存在错误通常有以下几个原因：
1. 模型名称输入错误：确保使用指定的Gemini模型名称，不支持自定义名称
2. API访问权限问题：确保您的Gemini API密钥有权限访问该模型

仅支持以下Gemini模型：
- gemini-2.5-flash-preview-04-17
- gemini-2.5-pro-preview-05-06
- gemini-2.0-flash
    `,
  },
  openai: {
    model_not_exist: `
OpenAI模型不存在错误通常有以下几个原因：
1. 模型名称输入错误：确保使用正确的OpenAI模型名称，例如"gpt-4"、"gpt-3.5-turbo"等
2. API访问权限问题：确保您的OpenAI API密钥有权限访问该模型
3. 模型已弃用：某些旧模型可能已停止支持，请使用最新的模型版本

常见的OpenAI模型名称包括：
- gpt-3.5-turbo
- gpt-4
- gpt-4o
- gpt-4o-mini
    `,
  },
};

// 获取模型错误帮助信息
export function getModelErrorHelp(
  modelType: ModelType,
  errorType: string
): string | null {
  const modelHelp = modelErrorHelp[modelType as keyof typeof modelErrorHelp];
  if (!modelHelp) return null;

  return modelHelp[errorType as keyof typeof modelHelp] || null;
}
