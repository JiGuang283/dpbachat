# 多模型聊天应用

一个基于 Next.js 和 TypeScript 构建的应用程序，允许用户自定义语言模型 API 配置，支持多种语言模型（DeepSeek、Gemini、Claude 和 OpenAI）进行聊天交互，并提供预设配置功能。

## 功能特点

1. **多模型支持**

   - 支持配置多种 AI 语言模型 API：OpenAI、DeepSeek、Gemini 和 Claude
   - 用户可自行管理 API 密钥和配置

2. **预设系统**

   - 预设分为"穿甲弹"和"预设"两部分
   - 先向 AI 发送预设，等待返回后再开始对话
   - 用户可自定义预设名称和内容并保存
   - 创建对话时可选择模型和预设

3. **对话管理**
   - 以对话为管理单元
   - 保存历史对话记录
   - 支持创建、删除和编辑对话

## 技术栈

- **前端框架**: Next.js + React 19
- **语言**: TypeScript
- **样式**: TailwindCSS + Shadcn UI
- **状态管理**: Zustand
- **表单处理**: React Hook Form + Zod
- **API 调用**: Axios

## 开始使用

首先，运行开发服务器:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用运行效果。

## 项目结构

```
src/
├── app/                 # Next.js应用目录
│   ├── api/             # API路由
│   └── (routes)/        # 页面路由
├── components/          # UI组件
│   ├── ui/              # 基础UI组件
│   └── (feature)/       # 功能组件
├── lib/                 # 工具函数
├── types/               # TypeScript类型定义
├── store/               # 状态管理
└── services/            # API服务
```

## 配置模型

应用支持以下 AI 语言模型：

- **OpenAI**: GPT-3.5/GPT-4 系列
- **DeepSeek**: DeepSeek 系列模型
- **Gemini**: Google 的 Gemini 模型
- **Claude**: Anthropic 的 Claude 模型

每个模型都需要配置对应的 API 密钥和基本参数。
