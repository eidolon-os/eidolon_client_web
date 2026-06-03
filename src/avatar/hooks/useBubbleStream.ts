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
 * 字幕气泡来源 —— LiveKit 原生字幕 API（标准做法）。
 *
 * 行为约定：
 *  - **用户(STT)**：合并为**单条**气泡（key=`user:live`），随识别结果不断刷新/最终修正，
 *    不会每个 chunk 新建一条；停说后 TTL 淡出。
 *  - **Agent 回复**：逐条气泡，流式追加（同一段/流 id 持续更新同一条），说完后 TTL 淡出。
 *  - 数据源两路合并：`useTranscriptions()`(现代文本流，按 identity 分 user/agent)
 *    + `useVoiceAssistant().agentTranscriptions`(旧段式，agent 专属)。
 *    agent 若两路都来，优先段式、避免重复。
 *  - 去重 / 防重生：seenRef 记录每个 id 已提交的文本，TTL 过期后不会因残留数据复活。
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
  const seenRef = useRef<Map<string, string>>(new Map()); // id -> 最近已提交文本

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

  /** upsert：仅当该 id 的文本变化才更新（流式追加同一条；过期后同文本不再重生） */
  const upsert = useCallback((id: string, source: BubbleSource, rawText: string) => {
    const text = rawText.trim();
    if (!text) return false;
    if (seenRef.current.get(id) === text) return false;
    seenRef.current.set(id, text);
    storeRef.current.set(id, { source, text, ts: Date.now() });
    scheduleExpire(id);
    return true;
  }, [scheduleExpire]);

  useEffect(() => {
    if (opts.mock) return;

    let changed = false;
    const hasAgentSegs = agentTranscriptions.length > 0;

    // 文本流：用户合并为单条；agent 仅在无段式来源时取（避免重复）
    let newestUser: { text: string; ts: number } | null = null;
    for (const seg of transcriptions) {
      const identity = seg.participantInfo?.identity;
      const isUser = identity
        ? identity === localIdentity || (!!agentIdentity && identity !== agentIdentity)
        : false;
      if (isUser) {
        const ts = seg.streamInfo?.timestamp ?? 0;
        if (!newestUser || ts >= newestUser.ts) newestUser = { text: seg.text, ts };
      } else if (!hasAgentSegs) {
        if (upsert(`ts:${seg.streamInfo.id}`, "agent", seg.text)) changed = true;
      }
    }
    if (newestUser && upsert("user:live", "user", newestUser.text)) changed = true;

    // 段式：agent 逐条流式（优先来源）
    if (hasAgentSegs) {
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

  /** 手动推一条气泡（mock / 外部使用） */
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
