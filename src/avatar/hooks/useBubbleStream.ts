import { useCallback, useEffect, useRef, useState } from "react";
import { useDataChannel } from "@livekit/components-react";
import { BUBBLE_MAX_VISIBLE, BUBBLE_TTL_MS } from "../constants";
import { BubbleMessage, BubbleSource } from "../types";

interface UseBubbleStreamOptions {
  /** 可选：注入 mock 数据用于纯视觉调试 */
  mock?: BubbleMessage[];
}

/**
 * 监听 LiveKit data channel 的 transcription topic，把 agent / user 字幕转成
 * 带 TTL 自动淡出的气泡队列。
 *
 * 数据约定（与 ConversationRoom.tsx 现有解析一致）：
 *   topic = "transcription"
 *   payload (JSON) = { text: string, timestamp?: number, source?: "agent"|"user" }
 *   不带 source 时默认为 "agent"
 */
export function useBubbleStream(opts: UseBubbleStreamOptions = {}) {
  const [bubbles, setBubbles] = useState<BubbleMessage[]>(opts.mock ?? []);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleExpire = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== id));
      timersRef.current.delete(id);
    }, BUBBLE_TTL_MS);
    timersRef.current.set(id, t);
  }, []);

  const push = useCallback((source: BubbleSource, text: string, timestamp?: number) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const msg: BubbleMessage = { id, source, text: cleaned, timestamp: timestamp ?? Date.now() };
    setBubbles((prev) => {
      const next = [...prev, msg];
      // 同屏最多 N 个；超过的直接挤掉最早的
      if (next.length > BUBBLE_MAX_VISIBLE) {
        const dropped = next.slice(0, next.length - BUBBLE_MAX_VISIBLE);
        for (const d of dropped) {
          const t = timersRef.current.get(d.id);
          if (t) { clearTimeout(t); timersRef.current.delete(d.id); }
        }
        return next.slice(-BUBBLE_MAX_VISIBLE);
      }
      return next;
    });
    scheduleExpire(id);
  }, [scheduleExpire]);

  useDataChannel((msg) => {
    if (msg.topic !== "transcription") return;
    try {
      const text = new TextDecoder("utf-8").decode(msg.payload);
      const data = JSON.parse(text) as { text?: string; timestamp?: number; source?: BubbleSource };
      if (typeof data.text === "string" && data.text.length > 0) {
        push(data.source ?? "agent", data.text, data.timestamp);
      }
    } catch {
      // ignore malformed
    }
  });

  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  }, []);

  return { bubbles, push };
}
