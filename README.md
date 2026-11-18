# eidolon_client_web

Eidolon 伙伴的 Web 对话客户端（Next.js + LiveKit），带粒子/视频形象。

## 状态（2026-11-18 按各仓 main 核对）

**停用：连不上现在的 Host。** 它依赖的两个服务端接口都已删除：

| 依赖 | 现状 |
|---|---|
| Admin `GET /api/bootstrap`（解析 owner → 主伙伴 → web body）、`GET /api/owners` | 08-07 随 Admin 对齐 Data v2 删除（Admin `9a5880f`）；当前 Admin 不再提供旧 `/api/owners` 等接口（见 docs《当前实现架构》§5） |
| Hub `GET /api/config?client_type=web`（签发 LiveKit token） | 08-01 Hub 重建为设备总线时删除（Hub `85aea34`） |

- Ops 不部署它：Mac 源码主机只把它列为外部服务（`eidolon_ops` `source_assets.py`，端口 3001），Pi 产品发布里没有它的 unit。
- 产品蓝图 v7 列的客户端是手机 App、ESP32 固件、Reachy Mini，不含 Web。
- 不依赖后端还能用的只有 `/particle-demo`（粒子形象动画测试）。
- 08 月之后的提交只是线上契约镜像的维护（`0d0799b`、`e40cd64`、`a4224b9`、`3ca5ffd`、`11973e3`）：让本仓声明的常量与 `eidolon_sdk` 的契约一致，`tests/wireContractMirror.test.ts` 检查。会话链路本身没有更新。

### 去留

- 不做：本文件原「后续路线」（在 `ConversationRoom` 挂 `<AvatarStage />`、接 Live2D / VRM）和 `src/avatar/README.md` 的「后续扩展点」（精细 viseme、服务端 viseme 推送、LLM 手势、VRM）。理由：`AvatarStage` 已挂在 `CompanionScene` 里（`bc018d0`）；其余各项在客户端连不上 Host 时没有使用者，也没有观测到对应的用户问题。
- 待拍板：Web 客户端要不要接回现在的 Host？接回需要新的会话入口（例如作为一台 Device 走 Hub 准入和 Channel Provider 发会话，或经 Local API 的 Controller 会话鉴权），不是改两个 URL。不接回，就把本仓归档，契约镜像的维护也随之停止。

## 代码（停用前的实现）

打开即对话：`src/pages/index.tsx` 经 `useCompanionBootstrap` 解析身份，`useConnection` 取 token 后进入 LiveKit 房间，`src/avatar/` 渲染形象（全息粒子人像；会话要求数字人时用 `VideoAvatarStage` 播放 avatar 视频轨，`6d3c0d4`；空闲脸 `8865988`、`7c2a884`）。旧的三种模式（Upload Audio、Push to Talk、Daemon WS）已在 `bc018d0`（07-18）删除。

```
src/
├── pages/            index.tsx（入口）、particle-demo.tsx、api/debug/client-audio-state.ts
├── components/       OwnerPicker.tsx（多 Owner 时选择）
├── hooks/            useCompanionBootstrap、useConnection、useOwners、useConfig、useClientAudioStatePublisher
├── lib/contracts.ts  线上契约镜像
├── avatar/           形象模块，见 src/avatar/README.md
└── styles/
tests/                useCompanionBootstrap.test.tsx、wireContractMirror.test.ts
```

## 开发

```bash
npm install
cp .env.local.example .env.local   # .env.local.example 里的 Hub / Admin 地址指向已删除的接口
npm run dev                        # /particle-demo 不需要后端
npm test                           # vitest
```

## License

Copyright © 2026 Li Jinsong.

本项目允许依据 [PolyForm Noncommercial License 1.0.0](LICENSE) 进行许可范围内的
非商业使用。商业使用需要另行取得书面授权，请联系
[lijinsong@aimanthor.com](mailto:lijinsong@aimanthor.com)。

许可范围、第三方例外和必要声明见 [LICENSING.md](LICENSING.md) 与 [NOTICE](NOTICE)。
