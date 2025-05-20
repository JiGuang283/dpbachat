"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { Loader2 } from "lucide-react";

interface LoadingAnimationProps {
  armoringPrompt?: string;
  systemPrompt?: string;
}

export function LoadingAnimation({
  armoringPrompt,
  systemPrompt,
}: LoadingAnimationProps) {
  const [stage, setStage] = useState<"armoring" | "system" | "complete">(
    "armoring"
  );
  const [progress, setProgress] = useState(0);
  const { creating } = useAppStore();

  // 初始化阶段
  useEffect(() => {
    // 设置初始阶段
    if (armoringPrompt) {
      setStage("armoring");
    } else if (systemPrompt) {
      setStage("system");
    }

    // 重置进度
    setProgress(0);
  }, [armoringPrompt, systemPrompt]);

  // 动画效果
  useEffect(() => {
    if (!creating) {
      setStage("complete");
      return;
    }

    let interval: NodeJS.Timeout | undefined;

    // 处理当前阶段的进度动画
    if (stage === "armoring" && armoringPrompt) {
      // 穿甲弹阶段动画
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);

            // 如果有系统预设，延迟后切换到系统预设阶段
            if (systemPrompt) {
              setTimeout(() => {
                setStage("system");
                setProgress(0);
              }, 800);
            } else {
              // 没有系统预设，动画完成
              setTimeout(() => {
                setStage("complete");
              }, 500);
            }
            return 100;
          }
          return Math.min(prev + 2, 100); // 控制速度，最大100%
        });
      }, 100);
    } else if (stage === "system" && systemPrompt) {
      // 系统预设阶段动画
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);

            // 动画完成
            setTimeout(() => {
              setStage("complete");
            }, 500);

            return 100;
          }
          return Math.min(prev + 2, 100); // 控制速度，最大100%
        });
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [creating, stage, armoringPrompt, systemPrompt]);

  // 如果没有创建中或者已完成，则不显示
  if (!creating || stage === "complete") {
    return null;
  }

  // 判断是否显示当前阶段（有些阶段可能没有内容）
  const shouldShow =
    (stage === "armoring" && armoringPrompt) ||
    (stage === "system" && systemPrompt);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
      <div className="bg-card shadow-lg rounded-lg p-6 w-96 max-w-sm">
        <div className="flex items-center justify-center mb-4">
          <Loader2 className="animate-spin h-6 w-6 mr-2" />
          <h3 className="font-semibold">
            {stage === "armoring"
              ? "正在初始化穿甲弹..."
              : "正在加载系统预设..."}
          </h3>
        </div>

        <div className="w-full h-2 bg-muted rounded-full mb-2">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-sm text-muted-foreground mb-2">
          {stage === "armoring"
            ? "正在突破AI限制，请稍等..."
            : "正在设置AI行为模式，马上就好..."}
        </p>

        <p className="text-xs text-secondary-foreground font-medium mb-1">
          {stage === "armoring" ? "穿甲弹内容:" : "预设内容:"}
        </p>

        <div className="p-2 bg-muted/50 rounded-md text-xs text-muted-foreground overflow-hidden whitespace-nowrap text-ellipsis">
          {stage === "armoring" && armoringPrompt
            ? `"${armoringPrompt.substring(0, 45)}${
                armoringPrompt.length > 45 ? "..." : ""
              }"`
            : stage === "system" && systemPrompt
            ? `"${systemPrompt.substring(0, 45)}${
                systemPrompt.length > 45 ? "..." : ""
              }"`
            : ""}
        </div>
      </div>
    </div>
  );
}
