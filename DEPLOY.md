# 部署方案

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare CDN                           │
│                   (可选，加速静态资源)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────────────┐
│   Astro 前端 (SSR)  │       │   snatch-rs (Rust API)      │
│   外部端口: 38702   │──────▶│   外部端口: 38701           │
│   内部端口: 4321    │       │   内部端口: 3001            │
│   Node.js Runtime  │       │   yt-dlp 内置               │
└─────────────────────┘       └─────────────────────────────┘
```

---

## 方案 A：单 VPS 部署（推荐入门）

**适合**: 个人使用、小流量

### 要求
- VPS: 1 vCPU, 1GB RAM, 20GB SSD
- 系统: Ubuntu 22.04 / Debian 12
- 域名 + SSL 证书

### 部署步骤

```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 3. 克隆项目
git clone https://github.com/youming-ai/Snatch.git
cd Snatch

# 4. 构建并启动 Rust API
cd snatch-rs
docker build -t snatch-rs .
docker run -d --name snatch-rs --restart always -p 3001:3001 snatch-rs

# 5. 构建并启动前端
cd ..
bun install
bun run build

# 使用 PM2 管理前端进程
npm install -g pm2
pm2 start "node ./dist/server/entry.mjs" --name snatch-frontend
pm2 save
pm2 startup
```

### Nginx 反向代理配置

项目已包含 `nginx.conf.example` 配置文件，可直接使用：

```bash
# 复制配置文件
sudo cp nginx.conf.example /etc/nginx/sites-available/snatch

# 修改域名
sudo nano /etc/nginx/sites-available/snatch
# 将 'your-domain.com' 替换为你的实际域名

# 更新端口（如果使用默认端口无需修改）
# 前端: http://127.0.0.1:38702
# API:  http://127.0.0.1:38701

# 启用站点
sudo ln -s /etc/nginx/sites-available/snatch /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com
```

**或手动配置**：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:38702;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API（可选，如果前端直接调用 Docker 服务）
    location /api/ {
        proxy_pass http://127.0.0.1:38701/api/;
        proxy_read_timeout 300s;
    }
}
```

---

## 方案 B：Docker Compose 一键部署（推荐）

**适合**: 生产环境、易于维护

项目已包含 `docker-compose.yml`，直接使用即可：

```bash
# 一键启动
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

### 自定义配置

编辑 `.env` 文件设置生产环境变量：

```bash
# 复制环境变量模板
cp .env.production.example .env

# 编辑配置
nano .env
```

**关键配置项**：

| 变量 | 说明 | 生产环境推荐值 |
|------|------|----------------|
| `ALLOWED_ORIGINS` | CORS 允许的域名 | `https://your-domain.com` |
| `RUST_LOG` | 日志级别 | `info` 或 `warn` |
| `RATE_LIMIT_MAX` | 速率限制 | `10` (10请求/分钟) |

**更新端口配置**（如需自定义）：

```yaml
# docker-compose.yml
services:
  frontend:
    ports:
      - "38702:4321"  # 外部端口:38702, 内部端口:4321
  api:
    ports:
      - "38701:3001"  # 外部端口:38701, 内部端口:3001
```

---

## 方案 C：前后端分离部署

**适合**: 高流量、需要弹性扩展

### 前端部署（Vercel / Railway）

由于 Astro SSR 需要 Node.js 运行时，推荐：
- **Vercel**: 原生支持 Astro SSR
- **Railway**: 支持 Docker 和 Node.js

### 后端部署（Fly.io / Railway）

```bash
# Fly.io 部署
cd snatch-rs
flyctl launch
flyctl deploy
```

### 环境变量配置

前端需要配置 `RUST_API_URL` 指向后端服务：

```env
RUST_API_URL=https://your-api.fly.dev
```

---

## 成本估算

| 方案 | 服务 | 月费用 |
|------|------|--------|
| A | Vultr/DigitalOcean VPS (1GB) | $5-6 |
| B | 同上 | $5-6 |
| C | Vercel (前端) + Fly.io (后端) | $0 (免费层) |

---

## 推荐

| 场景 | 推荐方案 |
|------|----------|
| 个人使用 | 方案 A (单 VPS) |
| 团队/生产 | 方案 B (Docker Compose) |
| 高流量/弹性 | 方案 C (前后端分离) |

---

## 环境变量参考

参考 `.env.production.example` 文件了解所有可配置项：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `RUST_API_URL` | Rust API 地址 | `http://api:3001` |
| `ALLOWED_ORIGINS` | CORS 允许的域名 | (空=允许所有) |
| `RUST_LOG` | Rust 日志级别 | `info` |
| `PORT` | 前端内部端口 | `4321` |
| `RATE_LIMIT_MAX` | 速率限制（请求数/分钟） | `10` |
| `RATE_LIMIT_WINDOW` | 速率窗口（毫秒） | `60000` |

**默认端口配置**：
- **前端外部端口**: `38702` (映射到容器内 4321)
- **API 外部端口**: `38701` (映射到容器内 3001)

---

## 下一步

1. [ ] 选择部署方案
2. [ ] 准备域名和 SSL 证书
3. [ ] 配置环境变量
4. [ ] 执行部署
