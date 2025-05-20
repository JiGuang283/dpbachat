"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// 以下组件在未来可能会用到，暂时注释掉
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/store";
import { ModelConfig, ModelType } from "@/types";
import {
  getCommonModelsForType,
  getModelTypeName,
} from "@/lib/model-validation";
import { PlusCircle, Pencil, Trash, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// 模型表单验证模式
const modelFormSchema = z.object({
  name: z.string().min(1, "请输入模型名称"),
  type: z.enum(["openai", "deepseek", "gemini", "claude"], {
    required_error: "请选择模型类型",
  }),
  apiKey: z.string().min(1, "请输入API密钥"),
  baseUrl: z.string().optional(),
  model: z.string().min(1, "请输入模型标识符"),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxTokens: z.coerce.number().min(100).max(100000).optional(),
  enabled: z.boolean().default(true),
});

// 模型表单数据类型
type ModelFormValues = z.infer<typeof modelFormSchema>;

export default function SettingsView() {
  const { models, addModel, updateModel, deleteModel } = useAppStore();
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);

  // 初始化表单
  const form = useForm({
    resolver: zodResolver(modelFormSchema),
    defaultValues: {
      name: "",
      type: "openai",
      apiKey: "",
      baseUrl: "",
      model: "",
      temperature: 0.7,
      maxTokens: 2000,
      enabled: true,
    },
  });

  // 监听模型类型变化，更新模型列表
  const modelType = form.watch("type");
  useEffect(() => {
    if (modelType) {
      const commonModels = getCommonModelsForType(modelType as ModelType);
      if (commonModels.length > 0) {
        // 设置为该类型的第一个常用模型
        form.setValue("model", commonModels[0]);
      }
    }
  }, [modelType, form]);

  // 打开添加模型对话框
  const openAddModelDialog = () => {
    form.reset();
    setEditingModelId(null);
    setIsModelDialogOpen(true);
  };

  // 打开编辑模型对话框
  const openEditModelDialog = (model: ModelConfig) => {
    form.reset({
      name: model.name,
      type: model.type,
      apiKey: model.apiKey,
      baseUrl: model.baseUrl || "",
      model: model.model,
      temperature: model.temperature || 0.7,
      maxTokens: model.maxTokens || 2000,
      enabled: model.enabled,
    });
    setEditingModelId(model.id);
    setIsModelDialogOpen(true);
  };

  // 打开删除模型确认对话框
  const openDeleteDialog = (modelId: string) => {
    setModelToDelete(modelId);
    setDeleteDialogOpen(true);
  };

  // 表单提交处理
  const onSubmit = (data: ModelFormValues) => {
    const modelData = {
      ...data,
      type: data.type as ModelType, // 转换为枚举类型
    };
    if (editingModelId) {
      updateModel(editingModelId, modelData);
    } else {
      addModel(modelData);
    }
    setIsModelDialogOpen(false);
  };

  // 确认删除模型
  const confirmDelete = () => {
    if (modelToDelete) {
      deleteModel(modelToDelete);
      setModelToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  // 使用导入的getModelTypeName函数

  // 切换模型启用状态
  const toggleModelEnabled = (modelId: string, enabled: boolean) => {
    updateModel(modelId, { enabled });
  };

  return (
    <div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>模型配置</CardTitle>
          <CardDescription>配置和管理不同的语言模型API</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {models.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">暂无配置的模型</p>
                <Button onClick={openAddModelDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  添加模型配置
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {models.map((model) => (
                    <Card key={model.id}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between">
                          <CardTitle>{model.name}</CardTitle>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModelDialog(model)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(model.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription>
                          {getModelTypeName(model.type)} · {model.model}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">
                            {model.enabled ? "已启用" : "已禁用"}
                          </span>
                          <Switch
                            checked={model.enabled}
                            onCheckedChange={(checked) =>
                              toggleModelEnabled(model.id, checked)
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-center mt-6">
                  <Button onClick={openAddModelDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    添加模型配置
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 模型配置对话框 */}
      <Dialog open={isModelDialogOpen} onOpenChange={setIsModelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingModelId ? "编辑模型配置" : "添加模型配置"}
            </DialogTitle>
            <DialogDescription>
              配置语言模型API参数以便进行聊天
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称</FormLabel>
                    <FormControl>
                      <Input placeholder="模型配置名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模型类型</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        // 当类型改变时，重置模型标识符为该类型的第一个常用模型
                        const commonModels = getCommonModelsForType(
                          value as ModelType
                        );
                        if (commonModels.length > 0) {
                          form.setValue("model", commonModels[0]);
                        } else {
                          form.setValue("model", "");
                        }
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择模型类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="claude">Claude</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API密钥</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="API密钥" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>基础URL (可选)</FormLabel>
                    <FormControl>
                      <Input placeholder="API基础URL" {...field} />
                    </FormControl>
                    <FormDescription>留空则使用模型默认API端点</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模型标识符</FormLabel>
                    <div className="space-y-2">
                      {/* 改成自由输入 + 下拉选择的组合 */}
                      <FormControl>
                        <Input
                          placeholder="输入模型标识符"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      {form.watch("type") && (
                        <Select
                          onValueChange={(value) => field.onChange(value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择常用模型" />
                          </SelectTrigger>
                          <SelectContent>
                            {getCommonModelsForType(form.watch("type") as ModelType).map(
                              (model) => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <FormDescription>
                      输入模型标识符，或从下拉列表中选择一个常用模型
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>温度</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          placeholder="0.7"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>0-2之间的值</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxTokens"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>最大令牌数</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用</FormLabel>
                      <FormDescription>启用此模型配置用于聊天</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModelDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除模型配置</DialogTitle>
            <DialogDescription>
              确定要删除此模型配置吗？此操作不可撤销。
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
