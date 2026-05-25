# Avatar Module — 虚拟人陪伴模块

独立的 3D 虚拟人陪伴体验，自包含、可单独迭代。

## 入口

- 路由：`/companion`（`src/pages/companion.tsx`，仅作胶水）
- 对外只导出 `<CompanionScene />` 和类型

## 数据流

```
useConnection ──→ token
   │
   ▼
<LiveKitRoom>
   ├─ useVoiceAssistant ──→ state (idle/listening/thinking/speaking)
   │
   ├─ useTracks([Microphone, agent]) ──→ agentTrack
   │     │
   │     └─ useAudioAnalyser(track) ──→ getVolume() ref (60fps, 不重渲)
   │
   └─ useDataChannel("transcription") ──→ useBubbleStream ──→ BubbleLayer
            │
            └─ controller ──→ AvatarStage
                  │
                  ├─ TalkingHead (rAF):  setFixedValue("jawOpen", volume)
                  └─ state useEffect:    setMood / playGesture
```

## 文件

| 路径 | 作用 |
|---|---|
| `index.ts` | 模块出口 |
| `types.ts` | `AvatarController`、`BubbleMessage` 等接口 |
| `constants.ts` | 默认模型 URL、state→mood/gesture 映射、配色 |
| `components/CompanionScene.tsx` | 顶层场景（pre-call / connecting / in-call 状态机） |
| `components/AvatarStage.tsx` | 3D 渲染（TalkingHead，dynamic import） |
| `components/BubbleLayer.tsx` | 气泡管理 |
| `components/SpeechBubble.tsx` | 单个气泡 |
| `components/ControlDock.tsx` | 底部毛玻璃控件 |
| `components/PreCallCard.tsx` | 进入前卡 |
| `components/ConnectionOverlay.tsx` | 连接中遮罩 |
| `components/AmbientBackground.tsx` | 动态渐变背景 |
| `hooks/useCompanionSession.ts` | 复用 useConnection，提供陪伴态状态机 |
| `hooks/useAvatarController.ts` | state + getVolume 聚合 |
| `hooks/useAudioAnalyser.ts` | MediaStreamTrack → AnalyserNode → volume ref |
| `hooks/useBubbleStream.ts` | 监听字幕 data channel，管理气泡 TTL |
| `styles/companion.module.css` | 极光背景、毛玻璃、呼吸光 |

## 替换渲染层

替换为 VRM / Live2D 只需改写一个文件：
**`components/AvatarStage.tsx`**

入参 `controller: AvatarController` 提供：
- `controller.state` — `idle | listening | thinking | speaking`
- `controller.getVolume()` — 实时 0..1 音量（每帧调用）

只要在新渲染层里把这两个信号映射到对应的嘴型 / 表情 / 动作即可。

## 默认头像

来自 Ready Player Me 的免费 demo 头像（TalkingHead 官方 minimal demo 同款），
URL 在 `constants.ts` 的 `DEFAULT_AVATAR_URL`。

替换方式：
1. 临时换：设置 `NEXT_PUBLIC_AVATAR_URL` 环境变量
2. 永久换：改 `constants.ts`
3. 本地自托管：把 .glb 放 `public/avatar/yourmodel.glb`，URL 写 `/avatar/yourmodel.glb`

## 后续扩展点

- **精细 viseme**：在 `useAudioAnalyser` 里加 FFT 共振峰分析，输出 A/E/I/O/U 权重，
  AvatarStage 改用 `viseme_aa / viseme_E / viseme_I / viseme_O / viseme_U` morph target
- **服务端 viseme 推送**：扩展 LiveKit data channel `topic="viseme"`，TTS 同步发送
  音素时间轴；AvatarStage 监听并 schedule 到 audio currentTime
- **手势 from LLM**：让 LLM 输出 emotion/gesture tag（`{"emotion":"happy","gesture":"wave"}`），
  通过 data channel 推送，state machine 接住
- **VRM 路线**：用 `@pixiv/three-vrm` 替换 AvatarStage 内部，接口不变
