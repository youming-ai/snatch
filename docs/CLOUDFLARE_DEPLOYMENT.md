# Snatch - Cloudflare 部署方案

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                      Cloudflare 全球网络                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Cloudflare Pages + Workers                     │ │
│  │                                                           │ │
│  │  ┌──────────────────┐         ┌──────────────────────┐     │ │
│  │  │   Astro 前端     │         │  Cloudflare Workers  │     │ │
│  │  │   (Pages 部署)    │◄──────►│  (可选边缘代理)     │     │ │
│  │  │                  │         │                      │     │ │
│  │  │  - 全球 CDN       │         │  - KV 限流/缓存      │     │ │
│  │  │  - 自动 HTTPS     │         │  - 边缘计算          │     │ │
│  │  │  - DDoS 防护      │         │                      │     │ │
│  │  └──────────────────┘         └──────────────────────┘     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ HTTPS (Tunnel 加密)
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Cloudflare Tunnel                             │
│              (连接你的服务器，无需开放端口)                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    cloudflared                              │ │
│  │                                                             │ │
│  │   你的服务器 ◄────────────────────────────────────────     │ │
│  │   (本地机器 / VPS)                                         │ │
│  │                                                             │ │
│  │   ┌─────────────────────────────────────────────────────┐ │ │
│  │   │              snatch-rs (Rust API)                      │ │ │
│  │   │              - yt-dlp 集成                            │ │ │
│  │   │              - 视频下载处理                            │ │ │
│  │   │              - localhost:3001                         │ │ │
│  │   └─────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 优势

| 特性 | 说明 |
|------|------|
| **零成本前端** | Cloudflare Pages 和 Workers 免费套餐 |
| **全球 CDN** | 前端 300+ 节点自动分发 |
| **DDoS 防护** | Cloudflare 自动防御攻击 |
| **自动 HTTPS** | 免费 SSL 证书 |
| **无需开放端口** | Tunnel 安全隧道，不暴露服务器 IP |
| **服务器灵活** | 可以是本地机器或任何 VPS |
| **边缘计算** | Workers 在边缘运行（可选） |
| **持久化后端** | 完全控制后端服务器 |

---

## 部署步骤

### 第一步：准备 Rust API 服务器

在你的服务器（本地机器或 VPS）上部署 Rust API：

```bash
# 1. 克隆代码到服务器
git clone <repo-url> /opt/snatch
cd /opt/snatch/snatch-rs

# 2. 构建并运行
cargo build --release
./target/release/snatch-rs

# 或使用 Docker（推荐使用项目端口配置）
docker build -t snatch-rs .
docker run -d -p 38701:3001 --name snatch-api snatch-rs

# 3. 验证 API 运行
curl http://localhost:38701/health
# 预期响应: "OK"
```

**确保 Rust API 监听在 localhost:3001（内部）或 0.0.0.0:3001**

### 第二步：安装和配置 Cloudflare Tunnel

```bash
# 1. 安装 cloudflared
# Linux (AMD64)
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# 或使用安装脚本
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# 2. 登录 Cloudflare
cloudflared tunnel login
# 这会打开浏览器进行认证

# 3. 创建 Tunnel
cloudflared tunnel create snatch

# 输出示例:
# Tunnel ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# 保存此 ID，后续需要使用
```

### 第三步：配置 Tunnel 路由

创建配置文件 `~/.cloudflared/config.yml`：

```yaml
# ~/.cloudflared/config.yml
tunnel: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
credentials-file: /home/user/.cloudflared/xxxxxxxxxxxx.json

ingress:
  # 将 Tunnel 的公网地址路由到本地 Rust API
  - hostname: snatch-api.your-domain.com
    service: http://localhost:3001  # Docker 内部端口

  # 如果使用 Docker 端口映射，也可以用:
  # service: http://localhost:38701

  # 抓取所有其他流量返回 404
  - service: http_status:404
```

### 第四步：启动 Tunnel

```bash
# 测试运行（前台）
cloudflared tunnel run snatch

# 后台运行
nohup cloudflared tunnel run snatch > /var/log/cloudflared.log 2>&1 &

# 或使用 systemd 服务（推荐）
sudo nano /etc/systemd/system/cloudflared.service
```

**Systemd 服务配置**：

```ini
# /etc/systemd/system/cloudflared.service
[Unit]
Description=Cloudflare Tunnel for Snatch
After=network.target

[Service]
Type=simple
User=your-username
ExecStart=/usr/local/bin/cloudflared tunnel run snatch
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

```bash
# 启用并启动服务
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

### 第五步：获取 Tunnel URL

你的 Rust API 现在可以通过以下地址访问：

```
https://xxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.cfargotunnel.com
```

或者如果你配置了域名：

```
https://snatch-api.your-domain.com
```

### 第六步：部署前端到 Cloudflare Pages

**1. 添加 Cloudflare 适配器**

```bash
bun add @astrojs/cloudflare
```

**2. 配置 Astro**

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'server',
  adapter: cloudflare({
    platform: 'pages',
  }),
});
```

**3. 更新环境变量**

在 Cloudflare Pages 设置中添加：
- Settings > Environment variables
- `RUST_API_URL` = `https://xxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.cfargotunnel.com`

**4. 部署到 Pages**

```bash
# 通过 Git 集成部署（推荐）
git push origin main

# 或手动部署
bunx astro build
bunx wrangler pages deploy dist --project-name=snatch
```

### 第七步：部署 Cloudflare Worker（可选边缘代理）

如果你想在边缘添加限流和缓存层：

```typescript
// src/workers/api-proxy.ts
interface Env {
  RUST_API_URL: string;
  RATE_LIMIT_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API 路由
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    return new Response('Not Found', { status: 404 });
  }
};

async function handleAPI(request: Request, env: Env): Promise<Response> {
  // 1. 检查限流
  const clientId = getClientId(request);
  const rateLimitOk = await checkRateLimit(clientId, env.RATE_LIMIT_KV);

  if (!rateLimitOk) {
    return new Response(
      JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. 检查缓存
  const cacheKey = getCacheKey(request);
  const cached = await env.RATE_LIMIT_KV.get(cacheKey, 'json');

  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT'
      }
    });
  }

  // 3. 转发到 Rust API (通过 Tunnel)
  const rustResponse = await fetch(`${env.RUST_API_URL}${url.pathname}`, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  const result = await rustResponse.json();

  // 4. 缓存结果 (5分钟)
  await env.RATE_LIMIT_KV.put(cacheKey, JSON.stringify(result), {
    expirationTtl: 300
  });

  return new Response(JSON.stringify(result), {
    status: rustResponse.status,
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS'
    }
  });
}

async function checkRateLimit(clientId: string, kv: KVNamespace): Promise<boolean> {
  const key = `rate_limit:${clientId}`;
  const data = await kv.get(key, 'json');

  if (!data) {
    await kv.put(key, JSON.stringify({ count: 1 }), { expirationTtl: 60 });
    return true;
  }

  if (data.count >= 10) {
    return false;
  }

  await kv.put(key, JSON.stringify({ count: data.count + 1 }), { expirationTtl: 60 });
  return true;
}

function getClientId(request: Request): string {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const cf = request.cf as { colo?: string };
  return `${ip}-${cf.colo}`;
}

function getCacheKey(request: Request): string {
  return `cache:${request.url}`;
}
```

**wrangler.toml**

```toml
name = "snatch-worker"
main = "src/workers/api-proxy.ts"
compatibility_date = "2024-01-01"

# KV 命名空间
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-namespace-id"

# 环境变量
[vars]
RUST_API_URL = "https://xxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.cfargotunnel.com"

# 路由配置 (如果使用自定义域名)
[[routes]]
pattern = "snatch.your-domain.com/api/*"
zone_name = "your-domain.com"
```

**部署 Worker**

```bash
# 创建 KV 命名空间
wrangler kv:namespace create "RATE_LIMIT"

# 部署 Worker
wrangler deploy
```

### 第八步：配置域名

```bash
# 在 Cloudflare DNS 中添加记录

# 前端 (Pages)
# 类型: CNAME
# 名称: snatch (或 www)
# 目标: snatch.pages.dev

# 后端 (Tunnel) - 可选
# 类型: CNAME
# 名称: api
# 目标: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.cfargotunnel.com
```

---

## 环境变量配置

### Cloudflare Pages

```bash
# Pages Settings > Environment variables
RUST_API_URL=https://xxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.cfargotunnel.com
PUBLIC_RATE_LIMIT_MAX=10
PUBLIC_RATE_LIMIT_WINDOW=60000
```

### Cloudflare Workers (可选)

```toml
# wrangler.toml
[vars]
RUST_API_URL = "https://xxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.cfargotunnel.com"
```

### Rust API 服务器

```bash
# Docker 方式（推荐）
docker run -d -p 38701:3001 \
  -e ALLOWED_ORIGINS=https://your-pages.dev,https://your-domain.com \
  --name snatch-api snatch-rs

# 或本地运行
export ALLOWED_ORIGINS=https://your-pages.dev,https://your-domain.com
./target/release/snatch-rs
# 监听在 localhost:3001
```

---

## 成本

| 服务 | 费用 |
|------|------|
| Cloudflare Pages | $0 |
| Cloudflare Workers (免费套餐) | $0 |
| Cloudflare KV (免费套餐) | 100,000 读取/天 |
| Cloudflare Tunnel | $0 |
| 服务器 (VPS) | $5-20/月 |
| **总计** | **$5-20/月** |

---

## 监控

### Cloudflare Dashboard

| 功能 | 位置 |
|------|------|
| Analytics | Dashboard > Analytics |
| Security Events | Dashboard > Security > Overview |
| Workers Logs | Dashboard > Workers > snatch-worker > Logs |
| Tunnel Status | Dashboard > Zero Trust > Networks > Tunnels |

### 服务器监控

```bash
# 查看 Tunnel 日志
journalctl -u cloudflared -f

# 查看 Rust API 日志
journalctl -u snatch-rs -f
# 或
docker logs -f snatch-api
```

---

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| Tunnel 无法连接 | 检查 cloudflared 服务状态 |
| Worker 调用失败 | 检查 KV 命名空间 ID |
| CORS 错误 | 在 Rust API 设置 ALLOWED_ORIGINS |
| 限流失效 | KV 可能被清空，重新部署 Worker |
| 前端无法连接后端 | 检查 RUST_API_URL 环境变量 |

---

## 升级部署

```bash
# 1. 更新代码
git pull

# 2. 前端自动部署
# 推送到主分支后 Pages 自动构建

# 3. Worker 手动部署
wrangler deploy

# 4. 后端更新
cd /opt/snatch/snatch-rs
git pull
cargo build --release
sudo systemctl restart snatch-rs
```
