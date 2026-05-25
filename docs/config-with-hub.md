# Client Web 与 Hub 配置对照

`eidolon_client_web` 使用 Next.js 的 `.env.local`（`NEXT_PUBLIC_*`），不读取 hub 的 `config/settings.yaml`。

| client-web `.env.local` | hub `config/.env` / `settings.yaml` |
|-------------------------|-------------------------------------|
| `NEXT_PUBLIC_LIVEKIT_URL` | `EIDOLON_LIVEKIT_URL` 或 `esp32.livekit_ip` + `livekit_port`（见 hub `GET /api/config` 解析逻辑） |
| `NEXT_PUBLIC_LIVEKIT_TOKEN_URL` | `http://<hub-host>:<HUB_PORT>/api/config`（`settings.yaml` 的 `api.port`，默认 8082） |

本地 dev 示例：

```dotenv
NEXT_PUBLIC_LIVEKIT_URL=ws://127.0.0.1:7880
NEXT_PUBLIC_LIVEKIT_TOKEN_URL=http://127.0.0.1:8082/api/config
```

修改 hub 端口时，请同步更新 `NEXT_PUBLIC_LIVEKIT_TOKEN_URL` 并重启 `next dev`。
