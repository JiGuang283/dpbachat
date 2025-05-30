"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store";
// 重新导入 ChatService 以解决导入错误
import { ChatService } from "@/services/chat-service";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Loader2, Send, ArrowLeft, Trash, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageRole } from "@/types";

export default function ChatView() {
  const router = useRouter();
  const {
    currentConversationId,
    conversations,
    models,
    presets,
    deleteConversation,
    creating,
  } = useAppStore();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [useStreamingMode, setUseStreamingMode] = useState(true);
  const [streamingContent, setStreamingContent] = useState("");
  // 添加一个状态来跟踪流式传输是否在进行中
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 获取当前对话
  const conversation = conversations.find(
    (conv) => conv.id === currentConversationId
  );

  // 获取当前使用的预设（如果有）
  const currentPreset = conversation?.presetId
    ? presets.find((preset) => preset.id === conversation.presetId)
    : null;

  // 如果找不到当前对话，返回主页
  useEffect(() => {
    if (!currentConversationId || !conversation) {
      router.push("/");
    }
  }, [currentConversationId, conversation, router]);

  // 滚动到最新消息 - 优化流式传输时的滚动行为
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 使用防抖来减少滚动频率，特别是在流式传输时
  const scrollToBottomDebounced = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTime = useRef<number>(0);

  const handleScroll = () => {
    const now = Date.now();
    // 在流式传输期间，限制滚动频率到每500ms最多一次
    const minInterval = isStreaming ? 500 : 100;

    if (scrollToBottomDebounced.current) {
      clearTimeout(scrollToBottomDebounced.current);
    }

    const timeToWait = Math.max(
      0,
      minInterval - (now - lastScrollTime.current)
    );

    scrollToBottomDebounced.current = setTimeout(() => {
      lastScrollTime.current = Date.now();
      scrollToBottom();
    }, timeToWait);
  };

  useEffect(() => {
    // 只在消息数量变化或流式传输结束时滚动
    if (!isStreaming || !sending) {
      handleScroll();
    }
  }, [conversation?.messages?.length, isStreaming, sending]);

  // 为流式传输添加专门的滚动处理
  useEffect(() => {
    if (isStreaming && sending && streamingContent) {
      // 流式传输时，每接收到内容就尝试滚动，但有频率限制
      handleScroll();
    }
  }, [streamingContent, isStreaming, sending]);

  if (!conversation) return null;

  // 获取当前模型
  const currentModel = models.find(
    (model) => model.id === conversation.modelId
  );
  const modelName = currentModel ? currentModel.name : "未知模型";

  // 发送消息
  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    const messageContent = message.trim();
    setMessage(""); // 立即清空输入框

    try {
      setSending(true);
      setStreamingContent(""); // 重置流式内容

      if (useStreamingMode) {
        // 使用流式传输
        setIsStreaming(true); // 标记流式传输开始
        await ChatService.sendMessageStream(
          conversation.id,
          messageContent,
          (content, isComplete) => {
            setStreamingContent(content);
            if (isComplete) {
              setSending(false);
              setIsStreaming(false); // 标记流式传输结束
            }
          }
        );
      } else {
        // 使用常规传输
        await ChatService.sendMessage(conversation.id, messageContent);
        setSending(false);
      }
    } catch (error) {
      console.error("发送消息失败:", error);
      setSending(false);
      setIsStreaming(false); // 确保在出错时也重置流式状态
    }
  };

  // 返回主页
  const goBack = () => {
    useAppStore.getState().setCurrentConversation(null);
    // 不强制切换到特定视图，让用户保持在当前视图
  };

  // 确认删除对话
  const confirmDelete = () => {
    if (conversation) {
      deleteConversation(conversation.id);
      setDeleteDialogOpen(false);
      router.push("/");
    }
  };

  // 根据消息角色渲染不同样式
  const getMessageStyle = (role: string) => {
    switch (role) {
      case MessageRole.User:
        return "bg-primary text-primary-foreground";
      case MessageRole.Assistant:
        return "bg-muted";
      case MessageRole.System:
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300";
      default:
        return "";
    }
  };

  // 根据消息角色显示不同标题
  const getMessageRoleName = (role: string) => {
    switch (role) {
      case MessageRole.User:
        return "你";
      case MessageRole.Assistant:
        return "AI";
      case MessageRole.System:
        return "系统";
      default:
        return role;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 穿甲弹与预设加载动画 */}
      {creating && currentPreset && (
        <LoadingAnimation
          armoringPrompt={currentPreset.armoringPrompt}
          systemPrompt={currentPreset.systemPrompt}
        />
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <Button variant="ghost" onClick={goBack} className="mr-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> 返回
          </Button>
          <h2 className="text-xl font-semibold">{conversation?.title}</h2>
          {currentPreset && (
            <span className="ml-2 px-2 py-1 bg-secondary text-xs rounded-full">
              预设: {currentPreset.name}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            模型: {modelName}
          </span>
          <div className="flex items-center mr-2">
            <Switch
              id="streamMode"
              checked={useStreamingMode}
              onCheckedChange={setUseStreamingMode}
              className="mr-2"
            />
            <Label htmlFor="streamMode" className="flex items-center text-sm">
              <Zap className="h-4 w-4 mr-1" />
              流式传输
            </Label>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>

      <Card className="flex-1 mb-4 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4">
          {conversation.messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              开始你的对话吧
            </div>
          ) : (
            <div className="space-y-4">
              {conversation.messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-4 ${getMessageStyle(msg.role)}`}
                >
                  <div className="font-semibold mb-1">
                    {getMessageRoleName(msg.role)}
                    {sending &&
                      index === conversation.messages.length - 1 &&
                      msg.role === MessageRole.Assistant && (
                        <span className="ml-2 text-xs font-normal animate-pulse">
                          正在生成...
                        </span>
                      )}
                  </div>
                  <div
                    className={`${
                      sending &&
                      index === conversation.messages.length - 1 &&
                      msg.role === MessageRole.Assistant &&
                      useStreamingMode &&
                      isStreaming
                        ? "typing-animation"
                        : ""
                    }`}
                  >
                    {/* 根据消息角色选择渲染方式 */}
                    {msg.role === MessageRole.Assistant ? (
                      <MarkdownRenderer
                        content={
                          sending &&
                          index === conversation.messages.length - 1 &&
                          msg.role === MessageRole.Assistant &&
                          useStreamingMode
                            ? streamingContent
                            : msg.content
                        }
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex space-x-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="输入消息..."
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          disabled={sending}
        />
        <Button onClick={sendMessage} disabled={sending || !message.trim()}>
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除对话</DialogTitle>
            <DialogDescription>
              确定要删除此对话吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
