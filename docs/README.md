# Snatch 项目文档

## 目录结构

```
snatch/
├── src/                              # Astro 前端 (SSR)
│   ├── components/                   # React 组件
│   │   ├── DownloaderApp.tsx        # 主应用组件
│   │   ├── DownloaderInput.tsx      # URL 输入组件
│   │   ├── DownloadResult.tsx       # 下载结果展示组件
│   │   └── ErrorBoundary.tsx        # React 错误边界
│   │
│   ├── lib/                          # 工具库
│   │   ├── validation.ts            # URL 验证
│   │   ├── validation.test.ts       # 验证测试
│   │   └── rate-limiter.ts          # 持久化限流器
│   │
│   ├── middleware/                   # API 中间件
│   │   ├── security.ts              # 安全检查 (限流、验证、清理)
│   │   └── security.test.ts         # 安全测试
│   │
│   ├── pages/                        # Astro 页面
│   │   ├── index.astro              # 首页
│   │   └── api/                     # API 路由
│   │       └── download.ts          # 下载 API 代理
│   │
│   ├── config/                       # 配置
│   │   └── env.ts                   # 环境变量配置
│   │
│   ├── types/                        # TypeScript 类型
│   │   └── download.ts              # 下载相关类型定义
│   │
│   ├── constants/                    # 常量
│   │   └── platforms.ts             # 支持的平台配置
│   │
│   ├── test/                         # 测试配置
│   │   └── setup.ts                 # Vitest 设置
│   │
│   ├── styles.css                    # 全局样式
│   └── logo.svg                      # 应用 Logo
│
├── snatch-rs/                        # Rust 后端
│   └── src/                          # Rust 源代码
│       ├── main.rs                   # 入口点 + 路由 + 中间件
│       ├── handlers.rs               # HTTP 处理器 + 测试
│       ├── extractor.rs              # yt-dlp 集成 + 超时
│       ├── models.rs                 # 数据模型
│       ├── validation.rs             # URL 验证模块 + 测试
│       ├── retry.rs                  # 重试逻辑 + 测试
│       └── cache.rs                  # LRU 缓存 + 测试
│   ├── Cargo.toml                    # Rust 依赖
│   └── Dockerfile                    # Rust Docker 镜像
│
├── docs/                             # 文档目录
│   ├── README.md                      # 项目文档
│   └── CLOUDFLARE_DEPLOYMENT.md      # Cloudflare 部署方案
│
├── data/                             # 运行时数据 (已忽略)
│   └── rate-limits.json              # 限流数据持久化
│
├── .husky/                           # Git hooks
│   └── pre-commit                    # Biome 检查
│
├── .gitignore                        # Git 忽略规则
├── .dockerignore                     # Docker 构建忽略
├── biome.json                        # Biome 配置
├── docker-compose.yml                # Docker Compose 配置
├── Dockerfile                        # 前端 Docker 镜像
├── package.json                      # Node 依赖
├── bun.lockb                         # Bun lockfile
├── vitest.config.ts                  # Vitest 配置
└── tsconfig.json                     # TypeScript 配置
```

---

## API 文档

### Base URL
- 开发环境: `http://localhost:3001`
- 生产环境: 通过 `RUST_API_URL` 环境变量配置

### 端点

#### 1. POST /api/extract

提取社交媒体视频的下载信息。

**请求:**
```json
{
  "url": "https://www.tiktok.com/@username/video/1234567890"
}
```

**响应 (成功):**
```json
{
  "success": true,
  "platform": "tiktok",
  "title": "Video Title",
  "thumbnail": "https://...",
  "formats": [
    {
      "quality": "1080p",
      "url": "https://...",
      "ext": "mp4",
      "filesize": 12345678
    },
    {
      "quality": "720p",
      "url": "https://...",
      "ext": "mp4",
      "filesize": 8765432
    }
  ]
}
```

**响应 (错误):**
```json
{
  "success": false,
  "error": "Error message"
}
```

**状态码:**
| 状态 | 说明 |
|------|------|
| 200 | 成功 |
| 400 | URL 无效或不支持的平台 |
| 429 | 限流 (10请求/分钟) |
| 500 | 提取失败 |

#### 2. GET /api/download

直接下载视频流。

**参数:**
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| url | string | 是 | 原始社交媒体 URL |

**示例:**
```
GET /api/download?url=https://www.tiktok.com/@username/video/123
```

**响应:**
- Content-Type: `video/mp4`
- Content-Disposition: `attachment; filename="video.mp4"`
- Body: 二进制视频流

#### 3. GET /health

健康检查端点。

**响应:** `OK`

### 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| URL is required | URL 为空 | 提供有效 URL |
| Invalid URL format | URL 格式错误 | 检查 URL 语法 |
| Unsupported platform | 不支持的平台 | 使用 TikTok/Instagram/X |
| Failed to extract | 提取失败 | 尝试其他帖子 |
| Download service unavailable | 后端未运行 | 启动 API 服务 |
| Rate limit exceeded | 请求过多 | 等待后重试 |

---

## 技术栈

### 前端
| 依赖 | 版本 | 用途 |
|------|------|------|
| Astro | ^5.16.3 | SSR 框架 |
| React | ^19.2.0 | UI 组件 |
| TailwindCSS | ^4.0.6 | 样式 |
| lucide-react | ^0.544.0 | 图标 |
| @astrojs/node | ^9.5.1 | Node 适配器 |
| @astrojs/react | ^4.4.2 | React 集成 |

### 后端 (Rust)
| 依赖 | 版本 | 用途 |
|------|------|------|
| axum | "0.7" | Web 框架 |
| tokio | "1" | 异步运行时 |
| tower-http | "0.5" | HTTP 中间件 |
| serde/serde_json | "1" | JSON 序列化 |
| url | "2.5" | URL 解析 |
| tracing | "0.1" | 日志 |

### DevOps
| 工具 | 用途 |
|------|------|
| Docker | 容器化 |
| Bun | 包管理器 |
| Husky | Git hooks |
| Biome | 代码格式化 |

---

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                           用户浏览器                            │
│                         (React UI)                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ HTTPS Request
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Astro 前端 (端口 4321)                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  pages/api/download.ts                                     │ │
│  │  - 限流检查 (持久化到 data/rate-limits.json)              │ │
│  │  - 请求大小验证 (10KB)                                      │ │
│  │  - URL 安全验证                                            │ │
│  │  - 转发到 Rust API                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ HTTP Request
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Rust API (端口 3001)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  handlers.rs                                               │ │
│  │  - URL 验证 (完整安全检查)                                  │ │
│  │  - 请求超时 (60s)                                          │ │
│  │  - Body 大小限制 (10KB)                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  extractor.rs                                              │ │
│  │  - URL 验证                                                │ │
│  │  - yt-dlp 超时 (30s)                                       │ │
│  │  - 重试逻辑 (指数退避,最多3次)                             │ │
│  │  - 缓存层 (LRU, TTL 5分钟)                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ Subprocess
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        yt-dlp                                  │
│                   (视频下载引擎)                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ Video Stream
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    社交媒体平台                                  │
│    Instagram | TikTok | X (Twitter)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 安全特性

| 特性 | 实现 | 位置 |
|------|------|------|
| 限流 | 持久化文件存储 (10请求/分钟) | `src/lib/rate-limiter.ts` |
| URL 验证 | 域名白名单 + 危险字符检查 | `snatch-rs/src/validation.rs` |
| 命令注入防护 | URL 解析验证 | `snatch-rs/src/extractor.rs` |
| 请求大小限制 | 10KB max | `src/pages/api/download.ts` |
| 超时保护 | 30s (yt-dlp) + 60s (HTTP) | `snatch-rs/src/extractor.rs` |
| 重试机制 | 指数退避 (最多3次) | `snatch-rs/src/retry.rs` |
| 缓存 | LRU + TTL | `snatch-rs/src/cache.rs` |
| Error Boundary | React 组件级错误捕获 | `src/components/ErrorBoundary.tsx` |
| CORS | 可配置源 | `snatch-rs/src/main.rs` |

---

## 支持的平台

| 平台 | URL 模式 | 状态 |
|------|----------|------|
| Instagram | `instagram.com/p/*`, `/reel/*`, `/tv/*` | ✅ Working |
| TikTok | `tiktok.com/video/*`, `@user/video/*` | ✅ Working |
| X (Twitter) | `x.com/*/status/*`, `twitter.com/*/status/*` | ✅ Working |

---

## 开发

### 本地运行

```bash
# 启动前端
bun dev

# 启动后端
cd snatch-rs
cargo run

# 或使用 Docker
docker compose up
```

### 测试

```bash
# 前端测试
bun test

# 后端测试
cd snatch-rs
cargo test

# 构建
bun run build
```

### 代码检查

```bash
# 运行 Biome (Git hooks 自动执行)
bunx biome check

# 手动修复
bunx biome check --write
```
