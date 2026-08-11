# WOLF Telegram Relay Worker

Cloudflare Worker 中转 Telegram Bot `sendMessage` API，
用于解决部分地区无法直接调用 Telegram API 的问题。

## 本地开发

```bash
npm install
npx wrangler dev
```

本地开发时，将敏感变量写入项目根目录的 `.dev.vars` 文件（已被 .gitignore 忽略）：

```
BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
CHAT_ID=987654321
AUTH_KEY=my-secret-key
```

## 部署

### 方式一：连接 GitHub 仓库自动部署

1. 将本仓库推送到 GitHub
2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages**
3. 点击 **Create** → **Connect to Git** → 选择本仓库
4. 部署完成后，进入该 Worker → **Settings → Variables and Secrets**
5. 添加以下变量（类型选 **Secret**）：

   | 变量名       | 必需 | 说明                    |
   |-------------|------|------------------------|
   | `BOT_TOKEN` | 是   | Telegram Bot 的 Token   |
   | `CHAT_ID`   | 是   | 接收消息的 Chat ID       |
   | `AUTH_KEY`  | 否   | 接口访问密钥，不设则不限制 |

6. 后续推送到仓库主分支即自动部署

### 方式二：命令行部署

```bash
npx wrangler deploy
npx wrangler secret put BOT_TOKEN
npx wrangler secret put CHAT_ID
npx wrangler secret put AUTH_KEY   # 可选
```

## 接口说明

### `GET /`

健康检查，返回服务状态。

### `GET /send`

```
/send?message=Hello
```

### `POST /send`

```bash
curl -X POST https://your-worker.workers.dev/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from relay"}'
```

如果配置了 `AUTH_KEY`，请求时需附带：

```
Header: X-Auth-Key: your-key
或 Query: ?key=your-key&message=Hello
```
