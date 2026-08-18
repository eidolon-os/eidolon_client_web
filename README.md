# eidolon_client_web

Eidolon Agent 的 Web 客户端。基于 Next.js + LiveKit，连接 [eidolon_hub](../eidolon_hub) 的 LiveKit 房间与 Hub API；后续将在此基础上扩展 2D / 3D 人物形象。

代码原始来源：`eidolon_hub/client/web/`（保留作参考）。

## 功能

三种与 Agent 对话的模式：

| 模式 | 路径 | 说明 |
|---|---|---|
| Real-time | LiveKit Room | 实时双向语音；通过数据通道接收字幕 |
| Upload Audio | Daemon WS | 上传音频文件批处理；返回 AAC 流播放 |
| Push to Talk | Daemon WS | 按住录音，松开提交 |

## 外部依赖

| 依赖 | 默认地址 | 用途 |
|---|---|---|
| LiveKit | `ws://127.0.0.1:7880` | 实时语音信令 |
| Hub API | `http://127.0.0.1:8081/api/config` | 签发 LiveKit token |
| Daemon WS | `ws://localhost:8080/ws` | Manual / PTT 模式后端（预留） |

均通过 `NEXT_PUBLIC_*` 环境变量配置，见 `.env.local.example`。

## 开发

```bash
npm install
cp .env.local.example .env.local   # 按需修改地址
npm run dev                        # http://localhost:3000
```

构建与启动：

```bash
npm run build
npm start
```

## 目录结构

```
src/
├── pages/                  # Next pages router
│   ├── _app.tsx
│   ├── _document.tsx
│   └── index.tsx           # 模式切换 + 三种会话容器
├── components/
│   ├── ConversationRoom.tsx    # LiveKit 实时会话 UI（未来 avatar 挂载点）
│   ├── ManualMode.tsx
│   ├── PushToTalkMode.tsx
│   ├── ChatMessage.tsx
│   └── AudioVisualizer.tsx
├── hooks/
│   ├── useConfig.ts            # 读 NEXT_PUBLIC_*
│   └── useConnection.ts        # 调 Hub /api/config 拿 token
├── utils/
│   └── audio.ts                # Daemon WS 协议封装 + 音频分帧
├── avatar/                     # 2D/3D 人物形象骨架（未实现）
│   ├── types.ts
│   ├── AvatarStage.tsx
│   ├── useAvatarController.ts
│   └── README.md
└── styles/
    └── globals.css
```

## 后续路线

- 在 `ConversationRoom` 的可视化区域挂载 `<AvatarStage />`
- `useAvatarController` 已经把 LiveKit voice-assistant state + 音量整合好，直接对接 Live2D / VRM / Three.js 渲染即可
- 详见 [`src/avatar/README.md`](src/avatar/README.md)

## License

Copyright © 2026 Li Jinsong.

本项目允许依据 [PolyForm Noncommercial License 1.0.0](LICENSE) 进行许可范围内的
非商业使用。商业使用需要另行取得书面授权，请联系
[lijinsong@aimanthor.com](mailto:lijinsong@aimanthor.com)。

许可范围、第三方例外和必要声明见 [LICENSING.md](LICENSING.md) 与 [NOTICE](NOTICE)。
