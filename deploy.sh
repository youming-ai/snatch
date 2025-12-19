#!/bin/bash
# Snatch - VPS Deployment Script
# Usage: chmod +x deploy.sh && ./deploy.sh

set -e

echo "🚀 Deploying Snatch..."

# 1. 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "📦 安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "⚠️  请重新登录以应用 Docker 用户组权限，然后重新运行此脚本"
    exit 1
fi

# 2. 检查 Docker Compose
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose 未找到，请确保 Docker 版本 >= 20.10"
    exit 1
fi

echo "✅ Docker 环境就绪"

# 3. 构建并启动服务
echo "🔨 构建 Docker 镜像..."
docker compose build --no-cache

echo "🚀 启动服务..."
docker compose up -d

# 4. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 5. 健康检查
echo "🔍 检查服务状态..."

if curl -s http://localhost:3001/health | grep -q "OK"; then
    echo "✅ API 服务正常 (端口 3001)"
else
    echo "❌ API 服务启动失败"
    docker compose logs api
    exit 1
fi

if curl -s http://localhost:4321 | grep -q "<!DOCTYPE html>"; then
    echo "✅ 前端服务正常 (端口 4321)"
else
    echo "❌ 前端服务启动失败"
    docker compose logs frontend
    exit 1
fi

echo ""
echo "============================================"
echo "🎉 部署成功!"
echo "============================================"
echo ""
echo "📍 访问地址:"
echo "   前端: http://$(hostname -I | awk '{print $1}'):4321"
echo "   API:  http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "📋 常用命令:"
echo "   查看日志:   docker compose logs -f"
echo "   重启服务:   docker compose restart"
echo "   停止服务:   docker compose down"
echo "   更新部署:   git pull && docker compose up -d --build"
echo ""
echo "⚠️  建议配置 Nginx 反向代理 + SSL 证书"
echo ""
