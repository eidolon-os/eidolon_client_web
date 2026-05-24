# Avatar Scaffold

人物形象（2D / 3D）渲染层的占位骨架。当前所有文件都是空实现，目的是把接口契约和挂载点固定下来，让真正的渲染接入只是替换实现。

## 文件

- `types.ts` — `AvatarController` / `AvatarState` / `AvatarStageProps` 接口
- `useAvatarController.ts` — 从 LiveKit `useVoiceAssistant` + `useTrackVolume` 派生出统一的控制信号
- `AvatarStage.tsx` — 渲染占位 div，将来替换为 Three.js / Live2D / VRM / Pixi 实现

## 挂载点

`src/components/ConversationRoom.tsx` 内 audio-visualizer 区块旁边是计划中的挂载点：

```tsx
const controller = useAvatarController(agentTrack);
// ...
<AvatarStage controller={controller} className="..." />
```

## 接入指南（未来）

1. **2D（Live2D / PixiJS）**：在 `AvatarStage` 中 `useEffect` 启动渲染循环，把 `controller.volume` 映射到 ParamMouthOpenY，把 `controller.state` 映射到 motion / expression。
2. **3D（Three.js + GLTF/VRM）**：用 `next/dynamic({ ssr: false })` 加载，避免 SSR 报错；morph target 由 `controller.volume` 驱动。
3. **精细 lipsync**：扩展 LiveKit 数据通道，新增 `topic="viseme"`，server 侧 TTS 同步推送音素序列，填到 `controller.visemeHint`。
4. **Manual / PTT 模式**：daemon WS 协议目前不带 viseme，可在客户端对接收到的 AAC 流做 AnalyserNode 算 volume，再喂给 `AvatarStage`。

## 为什么独立目录

人物形象库（three / live2d / pixi）体积都不小，独立目录便于按需 dynamic import，不拖慢首屏。
