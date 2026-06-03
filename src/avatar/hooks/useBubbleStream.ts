import { useCallback, useEffect, useRef, useState } from "react";
import {
  useLocalParticipant,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { BUBBLE_MAX_VISIBLE, BUBBLE_TTL_MS } from "../constants";
import { BubbleMessage, BubbleSource } from "../types";

interface UseBubbleStreamOptions {
  /** 可选：注入 mock 数据用于纯视觉调试（提供时不接真实字幕流） */
  mock?: BubbleMessage[];
}

interface Entry {
  source: BubbleSource;
  text: string;
  ts: number;
}

/**
 * 字幕气泡来源 —— 使用 LiveKit **原生字幕 API**（标准做法）：
 *
 *  1. 主：`useTranscriptions()` —— 现代文本流字幕，覆盖 agent + user，
 *     按 `participantInfo.identity` 区分来源，流式更新（同一 streamInfo.id 不断追加文本）。
 *  2. 回退：`useVoiceAssistant().agentTranscriptions` —— 旧段式字幕（兼容老版 agent），
 *     仅当上面为空时启用，避免重复。
 *
 * 二者都按"流/段 id"做 upsert（流式追加同一条气泡，而非每条新建），
 * 并在最后一次更新后 BUBBLE_TTL_MS 自动淡出。
 */
export function useBubbleStream(opts: UseBubbleStreamOptions = {}) {
  const transcriptions = useTranscriptions();
  const { agent, agentTranscriptions } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const agentIdentity = agent?.identity;
  const localIdentity = localParticipant?.identity;

  const [bubbles, setBubbles] = useState<BubbleMessage[]>(opts.mock ?? []);
  const storeRef = useRef<Map<string, Entry>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const rebuild = useCallback(() => {
    const items: BubbleMessage[] = [...storeRef.current.entries()]
      .map(([id, e]) => ({ id, source: e.source, text: e.text, timestamp: e.ts }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-BUBBLE_MAX_VISIBLE);
    setBubbles(items);
  }, []);

  const scheduleExpire = useCallback((id: string) => {
    const ex = timersRef.current.get(id);
    if (ex) clearTimeout(ex);
    const t = setTimeout(() => {
      storeRef.current.delete(id);
      timersRef.current.delete(id);
      rebuild();
    }, BUBBLE_TTL_MS);
    timersRef.current.set(id, t);
  }, [rebuild]);

  /** upsert：文本变化才刷新时间戳与 TTL（保证流式追加的同一条气泡持续显示、停说后淡出） */
  const upsert = useCallback((id: string, source: BubbleSource, rawText: string) => {
    const text = rawText.trim();
    if (!text) return false;
    const prev = storeRef.current.get(id);
    if (prev && prev.text === text) return false;
    storeRef.current.set(id, { source, text, ts: Date.now() });
    scheduleExpire(id);
    return true;
  }, [scheduleExpire]);

  useEffect(() => {
    if (opts.mock) return; // 调试 mock 模式不接真实流

    let changed = false;

    if (transcriptions.length > 0) {
      // 主路径：现代文本流字幕
      for (const seg of transcriptions) {
        const identity = seg.participantInfo?.identity;
        const source: BubbleSource =
          identity && identity === localIdentity ? "user"
          : identity && agentIdentity && identity !== agentIdentity ? "user"
          : "agent";
        if (upsert(`ts:${seg.streamInfo.id}`, source, seg.text)) changed = true;
      }
    } else if (agentTranscriptions.length > 0) {
      // 回退：旧段式字幕（agent 专属）
      for (const seg of agentTranscriptions) {
        if (upsert(`seg:${seg.id}`, "agent", seg.text)) changed = true;
      }
    }

    if (changed) rebuild();
  }, [transcriptions, agentTranscriptions, agentIdentity, localIdentity, upsert, rebuild, opts.mock]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  /** 手动推入一条气泡（mock / 外部使用，写入同一 store） */
  const push = useCallback((source: BubbleSource, text: string, timestamp?: number) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const id = `manual:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    storeRef.current.set(id, { source, text: cleaned, ts: timestamp ?? Date.now() });
    scheduleExpire(id);
    rebuild();
  }, [scheduleExpire, rebuild]);

  return { bubbles, push };
}
