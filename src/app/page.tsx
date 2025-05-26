"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ModelType } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MessageSquare,
  Settings,
  Sparkles,
  Plus,
  CheckSquare,
  Trash,
  X,
  Menu,
  PanelLeftClose,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAppStore } from "@/store";
import ChatView from "@/components/chat/chat-view";
import SettingsView from "@/components/settings/settings-view";
import PresetsView from "@/components/presets/presets-view";

export default function Home() {
  const router = useRouter();
  const {
    currentConversationId,
    conversations,
    batchMode,
    selectedConversations,
    toggleBatchMode,
    toggleSelectConversation,
    selectAllConversations,
    clearSelectedConversations,
    deleteMultipleConversations,
  } = useAppStore();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState(() =>
    currentConversationId ? "chat" : "settings"
  );

  useEffect(() => {
    // 页面加载后，检查是否需要创建初始数据
    const initializeData = async () => {
      const store = useAppStore.getState();

      // 如果没有模型配置，添加一个默认的OpenAI配置
      if (store.models.length === 0) {
        store.addModel({
          name: "OpenAI (请配置)",
          type: ModelType.OpenAI,
          apiKey: "",
          model: "gpt-3.5-turbo",
          temperature: 0.7,
          maxTokens: 2000,
          enabled: false,
        });
      }

      // 如果没有预设，添加一个示例预设
      if (store.presets.length === 0) {
        store.addPreset({
          name: "基础助手示例",
          armoringPrompt:
            "请确认你理解了这条消息，并告诉我你将作为一个友好、乐于助人的AI助手为我服务。",
          systemPrompt:
            "你是一个有用的AI助手，请提供清晰、准确、有帮助的回答。",
        });
      }
    };

    initializeData();
  }, []);

  // 只在初始化时设置默认视图
  useEffect(() => {
    // 只在页面初次加载时，根据是否有当前对话来设置默认视图
    // 之后用户可以自由切换视图
  }, []);

  // 创建新对话
  const createNewConversation = () => {
    router.push("/new-conversation");
  };

  // 确认批量删除对话
  const confirmBatchDelete = () => {
    deleteMultipleConversations(selectedConversations);
    setDeleteDialogOpen(false);
  };

  const sidebarItems = [
    {
      id: "chat",
      label: "聊天",
      icon: MessageSquare,
    },
    {
      id: "presets",
      label: "预设",
      icon: Sparkles,
    },
    {
      id: "settings",
      label: "设置",
      icon: Settings,
    },
  ];

  const renderMainContent = () => {
    switch (activeView) {
      case "chat":
        return currentConversationId ? (
          <ChatView />
        ) : (
          <Card className="text-center p-6">
            <CardHeader>
              <CardTitle>没有进行中的对话</CardTitle>
              <CardDescription>创建一个新的对话或选择已有对话</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {batchMode && selectedConversations.length > 0 && (
                <div className="w-full flex justify-between items-center mb-4 p-3 bg-muted rounded-lg border border-muted-foreground/20">
                  <div className="flex items-center">
                    <span className="font-medium">
                      已选择 {selectedConversations.length} 个对话
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (
                          selectedConversations.length === conversations.length
                        ) {
                          clearSelectedConversations();
                        } else {
                          selectAllConversations();
                        }
                      }}
                      className="ml-2"
                    >
                      {selectedConversations.length === conversations.length
                        ? "取消全选"
                        : "全选"}
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="flex items-center"
                  >
                    <Trash className="mr-2 h-4 w-4" /> 批量删除
                  </Button>
                </div>
              )}

              {conversations.length === 0 ? (
                <p>您还没有任何对话记录</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
                  {conversations.map((conv) => (
                    <Card
                      key={conv.id}
                      className={`relative ${
                        batchMode ? "" : "cursor-pointer"
                      } ${
                        selectedConversations.includes(conv.id)
                          ? "border-2 border-primary bg-primary/5"
                          : ""
                      }`}
                      onClick={
                        batchMode
                          ? () => toggleSelectConversation(conv.id)
                          : () => {
                              useAppStore
                                .getState()
                                .setCurrentConversation(conv.id);
                              setActiveView("chat");
                            }
                      }
                    >
                      {batchMode && (
                        <div className="absolute top-2 left-2 z-10">
                          <Checkbox
                            checked={selectedConversations.includes(conv.id)}
                            className="h-5 w-5"
                          />
                        </div>
                      )}
                      <CardHeader>
                        <CardTitle className="truncate">{conv.title}</CardTitle>
                      </CardHeader>
                      <CardFooter>
                        <p className="text-sm text-muted-foreground">
                          {new Date(conv.updatedAt).toLocaleString()}
                        </p>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-center space-x-4">
              <Button onClick={createNewConversation}>
                <Plus className="mr-2 h-4 w-4" /> 新建对话
              </Button>
              {conversations.length > 0 && (
                <Button
                  variant={batchMode ? "destructive" : "outline"}
                  onClick={() => toggleBatchMode(!batchMode)}
                >
                  {batchMode ? (
                    <>
                      <X className="mr-2 h-4 w-4" /> 取消批量
                    </>
                  ) : (
                    <>
                      <CheckSquare className="mr-2 h-4 w-4" /> 批量管理
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      case "presets":
        return <PresetsView />;
      case "settings":
        return <SettingsView />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex">
      {/* 左侧边栏 */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } bg-background border-r border-border flex flex-col shadow-sm transition-all duration-300 ease-in-out overflow-hidden`}
      >
        {/* 头部 */}
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-foreground whitespace-nowrap">
            Dpbachat
          </h1>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start h-11 ${
                    isActive
                      ? "bg-secondary text-secondary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                  onClick={() => setActiveView(item.id)}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Button>
              );
            })}
          </div>
        </nav>

        {/* 底部新建对话按钮 */}
        <div className="p-4 border-t border-border">
          <Button onClick={createNewConversation} className="w-full h-11">
            <Plus className="mr-2 h-4 w-4" />
            <span className="whitespace-nowrap">新建对话</span>
          </Button>
        </div>
      </div>

      {/* 右侧主内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="flex items-center p-4 border-b border-border bg-background">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-4"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
          <h2 className="text-lg font-semibold">
            {sidebarItems.find((item) => item.id === activeView)?.label}
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-6">{renderMainContent()}</div>
      </div>

      {/* 批量删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量删除对话</DialogTitle>
            <DialogDescription>
              确定要删除选中的 {selectedConversations.length}{" "}
              个对话吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={confirmBatchDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
