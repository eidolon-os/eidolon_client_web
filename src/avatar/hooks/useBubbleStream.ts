import { useCallback, useEffect, useRef, useState } from "react";
import {
  useLocalParticipant,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { BUBBLE_LOG_MAX } from "../constants";
import { BubbleMessage, BubbleSource } from "../types";

interface UseBubbleStreamOptions {
  /** 可选：注入 mock 数据用于纯视觉调试（提供时不接真实字幕流） */
  mock?: BubbleMessage[];
}

interface Entry {
  source: BubbleSource;
  text: string;
  firstTs: number; // 首次出现时间，用于排序（流式更新不改变顺序）
}

/**
 * 字幕来源 —— LiveKit 原生字幕 API，输出**持久聊天记录**（不淡出，向上滚动）。
 *
 *  - 每条「话语」按其原生 id（agent 段 id / 文本流 id）聚成**一条**消息，
 *    流式更新文本（不会每个 chunk 新建），说完后定格保留在记录里。
 *  - 两路来源合并：useTranscriptions()（文本流，按 identity 分 user/agent）
 *    + useVoiceAssistant().agentTranscriptions（段式，agent 专属，优先以避免重复）。
 *  - 超过 BUBBLE_LOG_MAX 条后丢弃最早的；不再按时间淡出。
 */
export function useBubbleStream(opts: UseBubbleStreamOptions = {}) {
  const transcriptions = useTranscriptions();
  const { agent, agentTranscriptions } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const agentIdentity = agent?.identity;
  const localIdentity = localParticipant?.identity;

  const [bubbles, setBubbles] = useState<BubbleMessage[]>(opts.mock ?? []);
  const storeRef = useRef<Map<string, Entry>>(new Map());

  const rebuild = useCallback(() => {
    let items = [...storeRef.current.entries()]
      .map(([id, e]) => ({ id, source: e.source, text: e.text, timestamp: e.firstTs }))
      .sort((a, b) => a.timestamp - b.timestamp);
    if (items.length > BUBBLE_LOG_MAX) {
      // 丢弃最早的，连带从 store 清除（限制内存）
      const drop = items.slice(0, items.length - BUBBLE_LOG_MAX);
      for (const d of drop) storeRef.current.delete(d.id);
      items = items.slice(-BUBBLE_LOG_MAX);
    }
    setBubbles(items);
  }, []);

  /** upsert：同一 id 流式更新文本（保持原顺序）；文本无变化则跳过 */
  const upsert = useCallback((id: string, source: BubbleSource, rawText: string) => {
    const text = rawText.trim();
    if (!text) return false;
    const prev = storeRef.current.get(id);
    if (prev) {
      if (prev.text === text) return false;
      prev.text = text; // 原地更新，firstTs 不变
    } else {
      storeRef.current.set(id, { source, text, firstTs: Date.now() });
    }
    return true;
  }, []);

  useEffect(() => {
    if (opts.mock) return;

    let changed = false;
    const hasAgentSegs = agentTranscriptions.length > 0;

    // 文本流：user 按 identity 区分；agent 仅在无段式来源时取（避免重复）
    for (const seg of transcriptions) {
      const identity = seg.participantInfo?.identity;
      const isUser = identity
        ? identity === localIdentity || (!!agentIdentity && identity !== agentIdentity)
        : false;
      if (isUser) {
        if (upsert(`ts:${seg.streamInfo.id}`, "user", seg.text)) changed = true;
      } else if (!hasAgentSegs) {
        if (upsert(`ts:${seg.streamInfo.id}`, "agent", seg.text)) changed = true;
      }
    }

    // 段式：agent 逐条流式（优先来源）
    if (hasAgentSegs) {
      for (const seg of agentTranscriptions) {
        if (upsert(`seg:${seg.id}`, "agent", seg.text)) changed = true;
      }
    }

    if (changed) rebuild();
  }, [transcriptions, agentTranscriptions, agentIdentity, localIdentity, upsert, rebuild, opts.mock]);

  /** 手动推一条消息（mock / 外部使用） */
  const push = useCallback((source: BubbleSource, text: string, timestamp?: number) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const id = `manual:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    storeRef.current.set(id, { source, text: cleaned, firstTs: timestamp ?? Date.now() });
    rebuild();
  }, [rebuild]);

  return { bubbles, push };
}
