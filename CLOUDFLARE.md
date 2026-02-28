# Cloudflare Pages + Docker 后端部署指南

## 概述

这个部署方案结合了 Cloudflare Pages 的全球 CDN 加速能力和 Docker 容器的后端控制优势。

- **前端**: Cloudflare Pages (全球 CDN，自动 HTTPS)
- **后端**: Docker 容器 (VPS 或本地运行)

---

## 前置要求

1. Cloudflare 账户（免费）
2. Git 仓库 (GitHub/GitLab)
3. 服务器（VPS 或本地机器）用于运行 Docker
4. 域名（可选，但推荐）

---

## 第一步：部署后端 API

### 1.1 在服务器上克隆代码

```bash
# SSH 到你的服务器
ssh user@your-server

# 克隆项目
git clone <your-repo-url> /opt/snatch
cd /opt/snatch
```

### 1.2 启动 Docker API

```bash
# 只启动 API 服务
docker compose up api -d --build

# 验证运行
curl http://localhost:38701/health
# 应返回: OK
```

### 1.3 配置公网访问（可选）

**选项 A: 直接暴露端口**

```bash
# 配置防火墙
sudo ufw allow 38701/tcp

# API 现在可以通过 http://YOUR-SERVER-IP:38701 访问
```

**选项 B: 使用 Cloudflare Tunnel（推荐，更安全）**

```bash
# 安装 cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# 登录 Cloudflare
cloudflared tunnel login

# 创建 tunnel
cloudflared tunnel create snatch-api
# 保存返回的 Tunnel ID

# 配置 tunnel
cat > ~/.cloudflared/config.yml << EOF
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/user/.cloudflared/YOUR_CREDENTIALS.json

ingress:
  - hostname: api.your-domain.com
    service: http://localhost:38701
  - service: http_status:404
EOF

# 启动 tunnel
cloudflared tunnel run snatch-api
```

你的 API 现在可以通过 `https://api.your-domain.com` 或 Tunnel URL 访问。

---

## 第二步：配置前端

### 2.1 设置环境变量

在项目根目录创建 `.env.production`：

```bash
echo "RUST_API_URL=https://api.your-domain.com" > .env.production
```

或使用 Tunnel URL：

```bash
echo "RUST_API_URL=https://your-tunnel-id.cfargotunnel.com" > .env.production
```

### 2.2 切换到 Cloudflare 适配器

```bash
# 备份 Node.js 配置
cp astro.config.mjs astro.config.node.mjs

# 使用 Cloudflare 配置
cp astro.config.cloudflare.mjs astro.config.mjs
```

### 2.3 提交代码

```bash
git add astro.config.cloudflare.mjs .env.production
git commit -m "chore: configure for Cloudflare Pages deployment"
git push origin main
```

---

## 第三步：部署到 Cloudflare Pages

### 3.1 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 点击 **Create application**
4. 选择 **Pages** 标签
5. 点击 **Connect to Git**

### 3.2 连接 Git 仓库

**GitHub**:

1. 点击 **Connect GitHub**
2. 授权 Cloudflare 访问你的仓库
3. 选择项目仓库
4. 选择 **main** 分支

**GitLab / 其他**:

1. 添加 Git 仓库
2. 提供仓库 URL

### 3.3 配置构建设置

在 **Build settings** 中设置：

```yaml
Build command: bun run build
Build output directory: dist
Root directory: / (leave empty)
Node.js version: 18 (or latest)
```

### 3.4 配置环境变量

在 **Environment variables** 中添加：

```
RUST_API_URL=https://api.your-domain.com
```

### 3.5 部署

点击 **Save and Deploy**

Cloudflare Pages 会自动：
1. 拉取最新代码
2. 运行构建命令
3. 部署到全球 CDN

---

## 第四步：配置自定义域名（可选）

### 4.1 添加域名

1. 在 Pages 项目中点击 **Custom domains**
2. 点击 **Set up a custom domain**
3. 输入你的域名（如 `snatch.your-domain.com`）

### 4.2 配置 DNS

Cloudflare 会自动为你添加必要的 DNS 记录：

```
Type: CNAME
Name: snatch (或 www)
Target: snatch.pages.dev
Proxy: ✅ (自动启用，DNS only)
```

### 4.3 获取 SSL 证书

Cloudflare 会自动为你的域名签发 Let's Encrypt 证书。

---

## 第五步：测试部署

### 5.1 检查前端

```bash
# 访问你的域名
curl https://snatch.your-domain.com

# 或 Cloudflare 提供的域名
curl https://snatch.pages.dev
```

### 5.2 测试 API 连接

在浏览器中打开前端，粘贴一个视频 URL 测试下载功能。

### 5.3 检查 CORS 配置

如果遇到 CORS 错误，需要在 Docker 容器中设置 `ALLOWED_ORIGINS`：

```bash
# 停止容器
docker compose down

# 启动时设置环境变量
export ALLOWED_ORIGINS=https://snatch.your-domain.com,https://www.snatch.your-domain.com
docker compose up -d
```

或在 `docker-compose.yml` 中配置：

```yaml
services:
  api:
    environment:
      - ALLOWED_ORIGINS=https://snatch.your-domain.com,https://www.snatch.your-domain.com
```

---

## 更新和维护

### 更新前端

```bash
# 修改代码后
git add .
git commit -m "feat: add new feature"
git push
# Cloudflare Pages 自动部署
```

### 更新后端

```bash
cd /opt/snatch
git pull
docker compose up -d --build api
```

### 查看日志

```bash
# 后端日志
docker compose logs -f api

# Cloudflare Pages 日志
# 在 Cloudflare Dashboard > Pages > your-project > Functions > Logs
```

---

## 故障排查

### 问题：前端无法连接后端

**检查**：
1. 后端是否正在运行：`docker compose ps`
2. 环境变量是否正确设置
3. CORS 是否正确配置

**解决**：
```bash
# 检查后端健康状态
curl http://localhost:38701/health

# 从 Cloudflare Pages 检查连接
# 在 Cloudflare Pages > Functions > Realtime Logs 查看请求日志
```

### 问题：构建失败

**检查**：
1. `bun install` 是否成功
2. 构建命令是否正确
3. 是否有语法错误

**解决**：
```bash
# 本地测试构建
bun run build

# 检查 Node.js 版本兼容性
node --version
```

### 问题：Tunnel 不稳定

**解决**：
```bash
# 使用 systemd 管理 tunnel
sudo nano /etc/systemd/system/cloudflared.service
```

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=your-username
ExecStart=/usr/local/bin/cloudflared tunnel run snatch-api
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

---

## 成本

| 服务 | 费用 |
|------|------|
| Cloudflare Pages | $0 (免费套餐) |
| Cloudflare Tunnel | $0 |
| VPS (1GB RAM) | $5-6/月 |
| 域名 | $10-15/年 (可选) |
| **总计** | **$5-6/月** |

---

## 优势总结

✅ **前端全球加速** - 300+ 节点自动分发
✅ **零配置 HTTPS** - 自动 SSL 证书
✅ **后端完全控制** - Docker 随时管理
✅ **自动 CI/CD** - Git push 即部署
✅ **DDoS 防护** - Cloudflare 自动防护
✅ **成本低廉** - 前端完全免费
✅ **易于维护** - 前后端独立更新

---

## 相关文档

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages)
- [Cloudflare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Astro Cloudflare 适配器](https://docs.astro.build/en/guides/deploy/cloudflare/)
