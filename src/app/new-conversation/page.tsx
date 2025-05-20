"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { validateModelConfig } from "@/lib/model-validation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { useAppStore } from "@/store";
import { ChatService } from "@/services/chat-service";

// 表单验证模式
const formSchema = z.object({
  title: z.string().min(1, "请输入对话标题"),
  modelId: z.string().min(1, "请选择模型"),
  presetId: z.string().optional(),
});

// 表单数据类型
type FormData = z.infer<typeof formSchema>;

export default function NewConversation() {
  const router = useRouter();
  const { models, presets, createConversation, creating } = useAppStore();
  const [isCreating, setIsCreating] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<null | {
    id: string;
    armoringPrompt: string;
    systemPrompt: string;
  }>(null);

  // 初始化表单
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      modelId: models.length > 0 ? models[0].id : "",
      presetId: "",
    },
  });

  // 提交表单
  const onSubmit = async (data: FormData) => {
    setIsCreating(true);

    try {
      // 验证所选模型是否存在且已启用
      const selectedModel = models.find((m) => m.id === data.modelId);
      if (!selectedModel) {
        alert("所选模型不存在，请重新选择");
        setIsCreating(false);
        return;
      }

      if (!selectedModel.enabled) {
        alert("所选模型已被禁用，请在设置中启用该模型或选择其他模型");
        setIsCreating(false);
        return;
      }

      // 验证模型配置
      if (!selectedModel.apiKey || selectedModel.apiKey.trim() === "") {
        alert(`错误: ${selectedModel.name} 的API密钥未配置或为空`);
        setIsCreating(false);
        return;
      }

      if (!selectedModel.model || selectedModel.model.trim() === "") {
        alert(`错误: ${selectedModel.name} 的模型标识符未配置或为空`);
        setIsCreating(false);
        return;
      }

      // 使用模型验证工具验证模型配置
      const validationError = validateModelConfig(selectedModel);
      if (validationError) {
        console.warn(`模型验证警告: ${validationError}`);
        // 如果是警告而非错误，仅显示警告但不阻止对话创建
        if (!validationError.startsWith("警告")) {
          alert(validationError);
          setIsCreating(false);
          return;
        }
      }

      // 如果选择了预设，验证预设是否存在
      let selectedPreset = null;
      if (data.presetId && data.presetId !== "none") {
        selectedPreset = presets.find((p) => p.id === data.presetId);
        if (!selectedPreset) {
          alert("所选预设不存在，请重新选择");
          setIsCreating(false);
          return;
        }
      }

      console.log("创建新对话:", {
        title: data.title,
        modelId: data.modelId,
        modelName: selectedModel.name,
        presetId: data.presetId || "无预设",
        presetName: selectedPreset?.name || "无预设",
      });

      // 创建新对话
      const conversationId = createConversation(
        data.title,
        data.modelId,
        data.presetId && data.presetId !== "none" ? data.presetId : null
      );

      // 如果选择了预设，则初始化对话
      if (data.presetId && data.presetId !== "none" && selectedPreset) {
        const conversation = useAppStore
          .getState()
          .conversations.find((c) => c.id === conversationId);

        if (conversation) {
          console.log("初始化预设:", {
            conversationId,
            presetName: selectedPreset.name,
            hasArmoringPrompt: !!selectedPreset.armoringPrompt?.trim(),
            hasSystemPrompt: !!selectedPreset.systemPrompt?.trim(),
          });

          // 设置当前预设，用于显示动画
          setCurrentPreset(selectedPreset);

          await ChatService.initializeWithPreset(
            conversation,
            selectedModel,
            selectedPreset
          );

          // 清除当前预设
          setCurrentPreset(null);
        }
      }

      // 重定向到主页
      router.push("/");
    } catch (error) {
      console.error("创建对话失败:", error);
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      alert(`创建对话失败: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  const enabledModels = models.filter((model) => model.enabled);

  return (
    <div className="container max-w-lg mx-auto py-10">
      {/* 穿甲弹与预设加载动画 */}
      {creating && currentPreset && (
        <LoadingAnimation
          armoringPrompt={currentPreset.armoringPrompt}
          systemPrompt={currentPreset.systemPrompt}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>创建新对话</CardTitle>
          <CardDescription>配置新的AI聊天对话</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>对话标题</FormLabel>
                    <FormControl>
                      <Input placeholder="输入对话标题" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>选择模型</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择语言模型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {enabledModels.length === 0 ? (
                          <SelectItem value="none" disabled>
                            请先在设置中配置并启用模型
                          </SelectItem>
                        ) : (
                          enabledModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="presetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>选择预设 (可选)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择预设 (可选)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">不使用预设</SelectItem>
                        {presets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => router.push("/")}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || enabledModels.length === 0}
                >
                  {isCreating ? "创建中..." : "创建对话"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
