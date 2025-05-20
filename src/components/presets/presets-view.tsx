"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store";
import { PlusCircle, Pencil, Trash, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// 预设表单验证模式
const presetFormSchema = z.object({
  name: z.string().min(1, "请输入预设名称"),
  armoringPrompt: z.string(),
  systemPrompt: z.string(),
});

// 预设表单数据类型
type PresetFormValues = z.infer<typeof presetFormSchema>;

export default function PresetsView() {
  const { presets, addPreset, updatePreset, deletePreset } = useAppStore();
  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);

  // 初始化表单
  const form = useForm<PresetFormValues>({
    resolver: zodResolver(presetFormSchema),
    defaultValues: {
      name: "",
      armoringPrompt: "",
      systemPrompt: "",
    },
  });

  // 打开添加预设对话框
  const openAddPresetDialog = () => {
    form.reset();
    setEditingPresetId(null);
    setIsPresetDialogOpen(true);
  };

  // 打开编辑预设对话框
  const openEditPresetDialog = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      form.reset({
        name: preset.name,
        armoringPrompt: preset.armoringPrompt,
        systemPrompt: preset.systemPrompt,
      });
      setEditingPresetId(presetId);
      setIsPresetDialogOpen(true);
    }
  };

  // 打开删除预设确认对话框
  const openDeleteDialog = (presetId: string) => {
    setPresetToDelete(presetId);
    setDeleteDialogOpen(true);
  };

  // 提交预设表单
  const onSubmit = (data: PresetFormValues) => {
    if (editingPresetId) {
      updatePreset(editingPresetId, data);
    } else {
      addPreset(data);
    }
    setIsPresetDialogOpen(false);
  };

  // 确认删除预设
  const confirmDelete = () => {
    if (presetToDelete) {
      deletePreset(presetToDelete);
      setPresetToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>预设配置</CardTitle>
          <CardDescription>
            管理AI对话的预设内容，包括穿甲弹和系统消息
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {presets.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">暂无配置的预设</p>
                <Button onClick={openAddPresetDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  添加预设
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {presets.map((preset) => (
                    <Card key={preset.id}>
                      <CardHeader>
                        <div className="flex justify-between">
                          <CardTitle>{preset.name}</CardTitle>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditPresetDialog(preset.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(preset.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {preset.armoringPrompt && (
                            <div>
                              <h4 className="text-sm font-semibold">穿甲弹:</h4>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {preset.armoringPrompt}
                              </p>
                            </div>
                          )}
                          {preset.systemPrompt && (
                            <div>
                              <h4 className="text-sm font-semibold">
                                系统预设:
                              </h4>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {preset.systemPrompt}
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-center mt-6">
                  <Button onClick={openAddPresetDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    添加预设
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 预设配置对话框 */}
      <Dialog open={isPresetDialogOpen} onOpenChange={setIsPresetDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingPresetId ? "编辑预设" : "添加预设"}
            </DialogTitle>
            <DialogDescription>
              配置AI对话的预设内容，包括穿甲弹和系统消息
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>预设名称</FormLabel>
                    <FormControl>
                      <Input placeholder="预设名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="armoringPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>穿甲弹 (可选)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="输入穿甲弹内容，会先向AI发送这段内容并等待回复"
                        {...field}
                        rows={5}
                      />
                    </FormControl>
                    <FormDescription>
                      穿甲弹是初始向AI发送的指令，用于设置上下文或绕过限制
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>系统预设 (可选)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="输入系统预设内容，会作为系统消息添加到对话中"
                        {...field}
                        rows={5}
                      />
                    </FormControl>
                    <FormDescription>
                      系统预设会作为系统消息添加到对话中，用于定义AI的角色和行为
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPresetDialogOpen(false)}
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
            <DialogTitle>删除预设</DialogTitle>
            <DialogDescription>
              确定要删除此预设吗？此操作不可撤销。
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
