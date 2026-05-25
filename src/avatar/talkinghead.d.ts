// 最小化的 @met4citizen/talkinghead 类型声明。
// 该包是 ESM .mjs，无官方 d.ts。我们只在 AvatarStage.tsx 用到了少量方法，
// 其它能力以 any 暴露，按需扩展。
declare module "@met4citizen/talkinghead" {
  export class TalkingHead {
    constructor(node: HTMLElement, opts: Record<string, unknown>);
    showAvatar(
      opt: Record<string, unknown>,
      onProgress?: (ev: ProgressEvent) => void
    ): Promise<void>;
    setFixedValue(key: string, val: number): void;
    setMood(mood: string): void;
    playGesture(name: string, durationSec: number, mirror?: boolean, ms?: number): void;
    stopGesture(ms?: number): void;
    speakText(text: string): Promise<void>;
    speakAudio(opt: Record<string, unknown>): Promise<void>;
    streamStart(opt: Record<string, unknown>): Promise<void>;
    streamAudio(opt: Record<string, unknown>): void;
    streamNotifyEnd(): void;
    stop(): void;
    dispose?(): void;
    // 兜底
    [k: string]: unknown;
  }
}
