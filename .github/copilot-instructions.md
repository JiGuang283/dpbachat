<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# AI 聊天应用项目

这是一个使用 Next.js 和 TypeScript 构建的应用程序，允许用户自定义语言模型 API 配置，支持多种语言模型（deepseek、gemini、claude 和 openai）进行聊天交互，并提供预设配置功能。

## 功能特点

1. 支持多种语言模型 API 配置：

   - OpenAI
   - DeepSeek
   - Gemini
   - Claude

2. 聊天预设功能：
   - 预设分为"穿甲弹"和"预设"两部分
   - 实现方式为先向 AI 发送预设，再等待其返回后开始对话
   - 允许用户自定义名称和内容并保存
   - 在创建对话前选择模型和预设

## 项目结构

- src/app：Next.js 应用程序目录
- src/components：UI 组件
- src/lib：实用工具和工具函数
- src/types：TypeScript 类型定义
- src/store：Zustand 状态管理
- src/services：API 服务调用

请在编写代码时遵循 TypeScript 类型安全标准和 Next.js 最佳实践。
