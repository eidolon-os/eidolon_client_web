# Avatar Module — 虚拟人陪伴模块

独立的虚拟人陪伴体验，自包含、可单独迭代。
当前形象为**全息粒子人像**（原生 three.js），随 listening/thinking/speaking 状态与音频实时变化。

**几何来源（两种，AvatarStage 内切换）：**
- **默认：肖像图 → 粒子**（`particles/createImageParticles.ts`）。把清晰正面肖像放到
  `public/avatar/portrait.jpg`（或设 `NEXT_PUBLIC_PORTRAIT_URL`）。清晰度=图片分辨率，2.5D 浮雕。
- **可选：GLB 头模 → 表面采样**（`particles/sampleHeadFromGLB.ts`）。向
  `<AvatarStage modelUrl="xxx.glb" />` 传 GLB 即可（真 3D 可转）。
- 两者失败都回退到程序化抽象头（`particles/createHeadParticles.ts`）。

## 快速开始 / Live 测试

```bash
npm run dev        # 开发模式 + 热更新（默认 http://localhost:3000）
```

两个测试入口：

| 路由 | 用途 | 是否需要后端 |
|---|---|---|
| **`/particle-demo`** | 纯视觉/动画测试：自动循环 idle→listening→thinking→speaking，正弦波模拟音量，底部按钮可手动切状态 | ❌ 不需要 |
| **`/companion`** | 真实交互：状态来自 AI agent（`useVoiceAssistant`），speaking 亮度由 agent 真实语音驱动 | ✅ 需要 LiveKit token 后端 + agent（`.env.local` 的 `NEXT_PUBLIC_LIVEKIT_*`） |

- 先用 `/particle-demo` 调外观/看动画（无需 agent）。
- `/companion` 看真实状态/口型联动前，先把 agent 服务跑起来。
- `/particle-demo` 调试参数：`?model=/avatar/x.glb`（改走 3D 路径）、`?count=110000`（覆盖点数）。
- 生产部署：`npm run build && npm start`。

### 换形象（图片）
1. 把清晰**正面肖像**存为 `public/avatar/portrait.jpg`（覆盖），刷新即可；或设环境变量 `NEXT_PUBLIC_PORTRAIT_URL` 指向你的图。
2. 选图诀窍（决定清晰度）：**正面、清晰、高分辨率**；**背景纯色/深色或透明 PNG**；脸/头占画面主体。
   AI 生成可用提示词：`front-facing portrait, plain dark background, sharp, high detail`。
3. 当前形象：`public/avatar/portrait.jpg`（一张科技机器人插图，仅交流学习使用——商用前请替换为可商用素材）。

## 入口

- 路由：`/`（`src/pages/index.tsx`，仅作胶水）——打开即对话，无表单。身份由
  `useCompanionBootstrap` 经 admin `/api/bootstrap` 解析（owner→master→web body）。
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
            └─ controller ──→ AvatarStage ──→ ParticleHead (three.js)
                  │
                  ├─ rAF:           update(getVolume(), dt) 驱动粒子运动/口型
                  └─ state useEffect: setState() 平滑切换四态运动模式
```

## 文件

| 路径 | 作用 |
|---|---|
| `index.ts` | 模块出口 |
| `types.ts` | `AvatarController`、`BubbleMessage` 等接口 |
| `constants.ts` | 配色 token（全息青蓝 PALETTE / HOLO_COLORS）、气泡 TTL |
| `components/CompanionScene.tsx` | 顶层场景（pre-call / connecting / in-call 状态机） |
| `components/AvatarStage.tsx` | 粒子渲染挂载层（dynamic import，驱动 ParticleHead） |
| `particles/createImageParticles.ts` | **默认**：肖像图 → 粒子（像素采样，亮度→深度/明暗） |
| `particles/sampleHeadFromGLB.ts` | 可选：GLB 头模表面采样（MeshSurfaceSampler，传 modelUrl 时用） |
| `particles/createHeadParticles.ts` | 兜底：程序化抽象头部点云几何 |
| `particles/headShaders.ts` | GLSL：四态光效、全息着色、高对比、fresnel |
| `particles/ParticleHead.ts` | 命令式封装：renderer/camera/points/bloom，setState/update/flat |
| `components/HudOverlay.tsx` | 四角角标 + 状态/连接读数 HUD |
| `components/BubbleLayer.tsx` | 气泡管理 |
| `components/SpeechBubble.tsx` | 单个气泡（全息玻璃风） |
| `components/ControlDock.tsx` | 底部 HUD 控件 |
| `components/PreCallCard.tsx` | 进入前卡 |
| `components/ConnectionOverlay.tsx` | 连接中遮罩 |
| `components/AmbientBackground.tsx` | 全息背景（网格/星点/扫描线/暗角） |
| `hooks/useCompanionSession.ts` | 复用 useConnection，提供陪伴态状态机 |
| `hooks/useAvatarController.ts` | state + getVolume 聚合 |
| `hooks/useAudioAnalyser.ts` | MediaStreamTrack → AnalyserNode → volume ref |
| `hooks/useBubbleStream.ts` | 监听字幕 data channel，管理气泡 TTL |
| `styles/companion.module.css` | 全息背景、HUD 玻璃、发光按钮、背光 |

## 渲染层

渲染层是 `particles/` 下的原生 three.js 点云，与 LiveKit 完全解耦——
只消费 `controller: AvatarController`：
- `controller.state` — `idle | listening | thinking | speaking`（驱动 `ParticleHead.setState`，0.6s 平滑过渡）
- `controller.getVolume()` — 实时 0..1 音量（每帧调用，speaking 态驱动外扩与口型）

要换成别的渲染（VRM / Live2D / 写实头模）只需改写 `AvatarStage.tsx` 挂载的实现，
保持消费这两个信号即可。

### 四态表达 = 光效（不形变几何）
为保持轮廓清晰，状态变化**通过亮度/能量表达，粒子基本不移动**（见 `headShaders.ts` 的 `motion()`）：
- **idle**：柔和整体呼吸光
- **listening**：从中心向外扩散的亮环（能量涟漪）
- **thinking**：自下而上循环的扫描亮线（全息扫描）
- **speaking**：随 `getVolume()` 整体亮度脉动 + 嘴部区域高亮
清晰度调节：点数（`AvatarStage` 内图片路径默认桌面 110k）、片元高对比（`headShaders.ts` 的 `lumC`）、辉光强度（`ParticleHead.ts` 的 `UnrealBloomPass` 参数）。

## 后续扩展点

- **精细 viseme**：在 `useAudioAnalyser` 里加 FFT 共振峰分析，输出 A/E/I/O/U 权重，
  AvatarStage 改用 `viseme_aa / viseme_E / viseme_I / viseme_O / viseme_U` morph target
- **服务端 viseme 推送**：扩展 LiveKit data channel `topic="viseme"`，TTS 同步发送
  音素时间轴；AvatarStage 监听并 schedule 到 audio currentTime
- **手势 from LLM**：让 LLM 输出 emotion/gesture tag（`{"emotion":"happy","gesture":"wave"}`），
  通过 data channel 推送，state machine 接住
- **VRM 路线**：用 `@pixiv/three-vrm` 替换 AvatarStage 内部，接口不变
