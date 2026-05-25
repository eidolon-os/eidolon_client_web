import { useEffect, useRef } from "react";
import type { Track } from "livekit-client";

interface AudioAnalyserAPI {
  /** 实时音量 0..1 (RMS)，每帧读取，不触发 re-render */
  getVolume: () => number;
}

/**
 * 把 LiveKit 的 audio Track（agent microphone）接到 Web Audio 的 AnalyserNode，
 * 通过 ref 暴露实时 RMS。Track 也会被 LiveKit 的 <RoomAudioRenderer /> 同时播放，
 * 这里只是分叉一路用于分析，不影响声音输出。
 */
export function useAudioAnalyser(track: Track | undefined): AudioAnalyserAPI {
  const volumeRef = useRef(0);

  useEffect(() => {
    if (!track) {
      volumeRef.current = 0;
      return;
    }
    const mediaStreamTrack: MediaStreamTrack | undefined = (track as { mediaStreamTrack?: MediaStreamTrack }).mediaStreamTrack;
    if (!mediaStreamTrack) {
      return;
    }

    const stream = new MediaStream([mediaStreamTrack]);
    const AudioCtx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    let raf = 0;
    let cancelled = false;

    const loop = () => {
      if (cancelled) return;
      analyser.getFloatTimeDomainData(buffer);
      let sumSq = 0;
      for (let i = 0; i < buffer.length; i++) {
        sumSq += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumSq / buffer.length);
      // 经验放大：人声 RMS 一般 0.02–0.15，映射到 0..1
      const normalized = Math.min(1, rms * 6);
      // 简单一阶平滑
      volumeRef.current = volumeRef.current * 0.6 + normalized * 0.4;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      try { source.disconnect(); } catch { /* noop */ }
      try { analyser.disconnect(); } catch { /* noop */ }
      audioCtx.close().catch(() => { /* noop */ });
      volumeRef.current = 0;
    };
  }, [track]);

  return {
    getVolume: () => volumeRef.current,
  };
}
